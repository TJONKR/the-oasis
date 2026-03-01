import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import crypto from 'crypto';

// World adapter (bridges WORLD terrain → ClawScape-style zones)
import { initWorldAdapter } from './src/world-adapter.js';
import { initTileRenderer } from './src/tile-renderer.js';

// Game Systems
import { initAgentIntelligence } from './src/systems/agent-intelligence.js';
import { initWeather } from './src/systems/weather.js';
import { initProficiency } from './src/systems/proficiency.js';
import { initEcosystem } from './src/systems/ecosystem.js';
import { initReputation } from './src/systems/reputation.js';
import { initRelationships } from './src/systems/relationships.js';
import { initNPCSocial } from './src/systems/npc-social.js';
import { attachProperties, getProperties, ZONE_HEAT_BONUS } from './src/systems/materials.js';
import { initExperiments } from './src/systems/experiments.js';
import { initSurvival } from './src/systems/survival.js';
import { initDecay } from './src/systems/decay.js';
import { initKnowledge } from './src/systems/knowledge.js';
import { initWorldMaster } from './src/systems/world-master.js';
import { initCooking } from './src/systems/cooking.js';
import { initAchievements } from './src/systems/achievements.js';
import { initCollectiveProjects } from './src/systems/collective-projects.js';
import { initEncounters } from './src/systems/encounters.js';
import { initOracle } from './src/systems/oracle.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// ═══════════════════════════════════════
// Data persistence
// ═══════════════════════════════════════
const DATA_DIR = join(__dirname, 'data');
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

function loadJSON(filename, fallback = {}) {
  const p = join(DATA_DIR, filename);
  if (existsSync(p)) {
    try { return JSON.parse(readFileSync(p, 'utf-8')); }
    catch { return fallback; }
  }
  return fallback;
}

function saveJSON(filename, data) {
  const p = join(DATA_DIR, filename);
  const dir = dirname(p);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(p, JSON.stringify(data, null, 2));
}

// ═══════════════════════════════════════
// Load World
// ═══════════════════════════════════════
const WORLD_PATH = join(__dirname, 'output', 'world.json');
if (!existsSync(WORLD_PATH)) {
  console.error('❌ No world found. Run: npm run generate');
  process.exit(1);
}

console.log('🏜️  Loading world...');
const worldData = JSON.parse(readFileSync(WORLD_PATH, 'utf-8'));
console.log(`   ${worldData.width}x${worldData.height} tiles loaded`);

console.log('🔌 Initializing world adapter...');
const worldGrid = initWorldAdapter(worldData, DATA_DIR);
worldGrid.setupRoutes(app);

console.log('🎨 Initializing tile renderer...');
const TILE_CACHE = join(__dirname, 'cache', 'tiles');
const tileRenderer = initTileRenderer(worldData, TILE_CACHE);
tileRenderer.setupRoutes(app);

// ═══════════════════════════════════════
// Agent State
// ═══════════════════════════════════════
const agentStore = loadJSON('agents.json', {});
const agents = new Map();

// Rehydrate existing agents
for (const [id, data] of Object.entries(agentStore)) {
  if (data.relationships && !(data.relationships instanceof Map)) {
    data.relationships = new Map(Object.entries(data.relationships));
  } else if (!data.relationships) {
    data.relationships = new Map();
  }
  agents.set(id, data);
}

function ensureAgentStats(agent) {
  if (!agent.stats) agent.stats = { xp: 0, level: 1, title: 'Hatchling 🥚' };
}

// ═══════════════════════════════════════
// XP & Levels
// ═══════════════════════════════════════
const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500, 5500];
const TITLES = { 1: 'Hatchling 🥚', 5: 'Wanderer 🚶', 10: 'Crafter ⚒️', 15: 'Explorer 🧭', 20: 'Builder 🏗️', 30: 'Master 🎓', 50: 'Legend 👑', 100: 'Mythic ⚡' };

function getLevelForXP(xp) {
  let level = 1;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1; else break;
  }
  return level;
}

function getTitleForLevel(level) {
  let title = TITLES[1];
  for (const [lv, t] of Object.entries(TITLES).sort((a, b) => a[0] - b[0])) {
    if (level >= parseInt(lv)) title = t;
  }
  return title;
}

function awardXP(agentId, amount) {
  const agent = agents.get(agentId);
  if (!agent) return;
  ensureAgentStats(agent);
  agent.stats.xp += amount;
  const newLevel = getLevelForXP(agent.stats.xp);
  if (newLevel > agent.stats.level) {
    agent.stats.level = newLevel;
    agent.stats.title = getTitleForLevel(newLevel);
    addWorldNews('level_up', agent.id, agent.name, `${agent.name} reached level ${newLevel}! ${agent.stats.title}`, agent.zone);
    broadcast({ type: 'level_up', agentId, name: agent.name, level: newLevel, title: agent.stats.title });
  }
}

// ═══════════════════════════════════════
// World News
// ═══════════════════════════════════════
const worldNews = { items: [], add(type, agentId, name, message, zone) { this.items.unshift({ type, agentId, name, message, zone, time: Date.now() }); if (this.items.length > 200) this.items.length = 200; } };
function addWorldNews(type, agentId, name, msg, zone) { worldNews.add(type, agentId, name, msg, zone); }

// ═══════════════════════════════════════
// Broadcasting
// ═══════════════════════════════════════
const spectators = new Set();

wss.on('connection', (ws) => {
  spectators.add(ws);
  console.log(`👁️  Spectator connected (${spectators.size} total)`);
  
  ws.send(JSON.stringify({
    type: 'init',
    tick,
    world: worldGrid.getWorldInfo(),
    agents: [...agents.values()].map(serializeAgent),
    news: worldNews.items.slice(0, 20),
  }));

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === 'get_area') {
        const tiles = worldGrid.getTilesInRadius(msg.x, msg.y, msg.radius || 10);
        ws.send(JSON.stringify({ type: 'area', tiles }));
      }
    } catch {}
  });

  ws.on('close', () => spectators.delete(ws));
});

function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const ws of spectators) {
    if (ws.readyState === 1) ws.send(data);
  }
}

// ═══════════════════════════════════════
// Initialize All Game Systems
// ═══════════════════════════════════════
console.log('⚙️  Initializing game systems...');

const zones = worldGrid.zones; // ClawScape-compatible zones object
const recipes = loadJSON('recipes.json', []);

const shared = {
  loadJSON, saveJSON,
  agents, agentStore, ensureAgentStats,
  broadcast, addWorldNews,
  zones,
  awardXP,
  recipes,
  worldGrid, // The adapter — systems can call worldGrid.getTile, walkAgent, etc.
};

const weatherSystem = initWeather({ loadJSON, saveJSON, broadcast, addWorldNews });
const proficiency = initProficiency({ loadJSON, saveJSON, agents, agentStore, broadcast });
const ecosystemSystem = initEcosystem({ loadJSON, saveJSON, zones });

shared.proficiency = proficiency;
shared.ecosystem = ecosystemSystem;
shared.weather = weatherSystem;

const repSystem = initReputation({ loadJSON, saveJSON, agents });
const relSystem = initRelationships({ loadJSON, saveJSON, agents, agentStore, broadcast, addWorldNews });
const npcSocial = initNPCSocial({ ...shared, relationships: relSystem, reputation: repSystem });
const experiments = initExperiments(shared);
shared.experiments = experiments;
shared.npcSocial = npcSocial;
const survivalSystem = initSurvival(shared);
const decaySystem = initDecay(shared);
const knowledgeSystem = initKnowledge({ ...shared, relationships: relSystem });
const cookingSystem = initCooking(shared);

shared.knowledgeSystem = knowledgeSystem;
shared.cooking = cookingSystem;

const collectiveProjects = initCollectiveProjects(shared);
const achievementSystem = initAchievements(shared);
const encounterSystem = initEncounters ? initEncounters(shared) : null;
const oracleSystem = initOracle ? initOracle(shared) : null;

shared.collectiveProjects = collectiveProjects;
shared.achievements = achievementSystem;
shared.encounters = encounterSystem;
shared.oracle = oracleSystem;

// World Master — the AI brain that drives events
const worldMaster = initWorldMaster({
  ...shared,
  weatherSystem, survivalSystem,
  relationships: relSystem,
  reputation: repSystem,
  getGameTime,
});
shared.worldMaster = worldMaster;

shared.getGameTime = getGameTime;

// Agent Intelligence — the autonomous brain
const agentAI = initAgentIntelligence(shared);
agentAI.setupRoutes(app);
shared.agentAI = agentAI;

console.log('   ✅ All systems initialized');

// ═══════════════════════════════════════
// Agent Serialization
// ═══════════════════════════════════════
function serializeAgent(a) {
  return {
    id: a.id, name: a.name,
    tileX: a.tileX, tileY: a.tileY,
    zone: a.zone,
    hp: a.hp, energy: a.energy, hunger: a.hunger,
    inventory: a.inventory,
    stats: a.stats,
    alive: a.alive,
    proficiencies: a.proficiencies,
    achievements: a.achievements?.length || 0,
    mind: agentAI?.minds?.[a.id] ? {
      action: agentAI.minds[a.id].currentAction,
      mood: agentAI.minds[a.id].mood,
      traits: agentAI.minds[a.id].personality?.traits,
      intent: agentAI.minds[a.id].intent ? {
        action: agentAI.minds[a.id].intent.action,
        reason: agentAI.minds[a.id].intent.reason,
      } : null,
      pathThisTick: agentAI.minds[a.id].pathThisTick || null,
    } : null,
  };
}

// ═══════════════════════════════════════
// Simulation
// ═══════════════════════════════════════
let tick = loadJSON('tick.json', { tick: 0 }).tick || 0;
const TICK_MS = 500; // Fast ticks — agents move 1 tile per tick, so 2 tiles/sec

// Game time (1 tick = 10 minutes game time)
function getGameTime() {
  const totalMinutes = tick * 10;
  const hour = Math.floor(totalMinutes / 60) % 24;
  const day = Math.floor(totalMinutes / (60 * 24)) + 1;
  const period = hour >= 6 && hour < 20 ? 'day' : 'night';
  return { hour, day, period, totalMinutes };
}

function simulationTick() {
  tick++;
  const gameTime = getGameTime();
  
  // 1. Weather
  if (weatherSystem.tick) weatherSystem.tick();
  
  // 2. Ecosystem (resource respawn etc)
  if (ecosystemSystem.tick) ecosystemSystem.tick();
  
  // 3. Per-agent updates
  for (const [id, agent] of agents) {
    if (!agent.alive) continue;
    ensureAgentStats(agent);
    worldGrid.migrateAgentPosition(agent);
    
    // Agent Intelligence — autonomous decisions
    agentAI.tickAgent(agent);
    
    // Survival tick (energy, hunger, temperature)
    if (survivalSystem.tick) survivalSystem.tick(agent);
    
    // Decay tick (item degradation)
    if (decaySystem.tickAgent) decaySystem.tickAgent(agent);
    
    // Achievement check
    if (achievementSystem.check) achievementSystem.check(agent);
  }
  
  // 4. World Master (events, narratives) — less frequent
  if (tick % 50 === 0 && worldMaster.tick) {
    worldMaster.tick();
  }
  
  // 5. Collective projects progress
  if (tick % 10 === 0 && collectiveProjects.tick) {
    collectiveProjects.tick();
  }
  
  // 6. Broadcast state (every tick for smooth movement, full data every 5)
  if (tick % 5 === 0) {
    broadcast({
      type: 'tick',
      tick,
      gameTime,
      weather: weatherSystem.getCurrentWeather?.() || null,
      agents: [...agents.values()].filter(a => a.alive).map(serializeAgent),
    });
  } else if (spectators.size > 0) {
    // Lightweight position-only update (skip if nobody watching)
    const positions = [];
    for (const [id, a] of agents) {
      if (!a.alive) continue;
      const m = agentAI?.minds?.[id];
      positions.push({ id, name: a.name, tileX: a.tileX, tileY: a.tileY, hp: a.hp, energy: a.energy, alive: true,
        mind: m ? { action: m.currentAction, mood: m.mood, intent: m.intent ? { action: m.intent.action, reason: m.intent.reason } : null } : null });
    }
    broadcast({ type: 'tick', tick, agents: positions });
  }
  
  // Save periodically
  if (tick % 50 === 0) {
    const store = {};
    for (const [id, a] of agents) {
      store[id] = { ...a, relationships: Object.fromEntries(a.relationships || new Map()) };
    }
    saveJSON('agents.json', store);
    saveJSON('tick.json', { tick });
  }
  
  if (tick % 100 === 0) {
    console.log(`⏱️  Tick ${tick} | Day ${gameTime.day} ${gameTime.hour}:00 ${gameTime.period} | Agents: ${agents.size} | Spectators: ${spectators.size}`);
  }
}

// ═══════════════════════════════════════
// Agent Spawning
// ═══════════════════════════════════════
function spawnAgent(name) {
  const id = crypto.randomUUID();
  
  // Spawn near the oasis spawn point with some randomness
  const spread = 30;
  let tileX, tileY, attempts = 0;
  do {
    tileX = worldGrid.spawnPoint.x + Math.floor(Math.random() * spread * 2 - spread);
    tileY = worldGrid.spawnPoint.y + Math.floor(Math.random() * spread * 2 - spread);
    attempts++;
  } while (attempts < 100 && (!worldGrid.getTile(tileX, tileY)?.walkable));
  
  const zone = worldGrid.getZone(tileX, tileY);
  
  const agent = {
    id, name,
    tileX, tileY,
    x: tileX, y: tileY,
    zone,
    hp: 100, energy: 100, hunger: 0, temperature: 20,
    inventory: [],
    knowledge: [],
    relationships: new Map(),
    proficiencies: {},
    achievements: [],
    memory: [],
    goals: [],
    alive: true,
    stats: { xp: 0, level: 1, title: 'Hatchling 🥚' },
    ticksBorn: tick,
    coins: 0,
  };
  
  agents.set(id, agent);
  agentStore[id] = { ...agent, relationships: {} };
  saveJSON('agents.json', agentStore);
  
  addWorldNews('spawn', id, name, `${name} has arrived in The Oasis at ${zones[zone]?.name || zone}`, zone);
  broadcast({ type: 'agent_spawn', agent: serializeAgent(agent) });
  console.log(`🌱 Agent spawned: ${name} at (${tileX},${tileY}) — ${zone}`);
  
  return agent;
}

// ═══════════════════════════════════════
// API Routes
// ═══════════════════════════════════════
app.get('/api/status', (req, res) => {
  const gameTime = getGameTime();
  res.json({
    tick, gameTime,
    agents: agents.size,
    alive: [...agents.values()].filter(a => a.alive).length,
    world: `${worldData.width}x${worldData.height}`,
    weather: weatherSystem.getCurrentWeather?.() || null,
    uptime: process.uptime(),
  });
});

app.get('/api/agents', (req, res) => {
  res.json([...agents.values()].map(serializeAgent));
});

app.get('/api/agents/:id', (req, res) => {
  const agent = agents.get(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  const tile = worldGrid.getTile(agent.tileX, agent.tileY);
  res.json({
    ...serializeAgent(agent),
    tile,
    resources: worldGrid.getTileResources(agent.tileX, agent.tileY),
    nearby: worldGrid.getAgentsNearby(agents, agent.tileX, agent.tileY, 10)
      .filter(a => a.id !== agent.id)
      .map(a => ({ id: a.id, name: a.name, tileX: a.tileX, tileY: a.tileY })),
  });
});

app.post('/api/spawn', (req, res) => {
  const { name } = req.body;
  const agent = spawnAgent(name || `Agent-${agents.size + 1}`);
  res.json(serializeAgent(agent));
});

app.post('/api/spawn-many', (req, res) => {
  const { count = 5, prefix = 'Agent' } = req.body;
  const spawned = [];
  for (let i = 0; i < Math.min(count, 50); i++) {
    const agent = spawnAgent(`${prefix}-${agents.size + 1}`);
    spawned.push(serializeAgent(agent));
  }
  res.json({ spawned: spawned.length, agents: spawned });
});

app.get('/api/news', (req, res) => {
  res.json(worldNews.items.slice(0, parseInt(req.query.limit) || 50));
});

app.get('/api/weather', (req, res) => {
  res.json(weatherSystem.getCurrentWeather?.() || { error: 'No weather data' });
});

const ZONES_REF = worldGrid.zones;
// ═══════════════════════════════════════
// Start
// ═══════════════════════════════════════
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  const gameTime = getGameTime();
  console.log(`
🏜️  ═══════════════════════════════════
   THE OASIS — AI Agent Survival Sandbox
   ═══════════════════════════════════
   🌍 World: ${worldData.width}x${worldData.height} tiles
   📍 Spawn: (${worldGrid.spawnPoint.x}, ${worldGrid.spawnPoint.y})
   🕐 Tick: ${tick} | Day ${gameTime.day}
   🌐 http://localhost:${PORT}
   ═══════════════════════════════════
`);
  
  // Start simulation
  setInterval(simulationTick, TICK_MS);
});
