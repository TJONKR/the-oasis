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
import { registerGatheredResources, getPracticalRules, GATHERED_RESOURCE_PROPERTIES } from './src/systems/physics.js';
import { getAmbientTemp, addWorldFire, tickFires, getActiveFires, hasNearbyFire, coolItems, getEffectiveHeatV2, getToolAmplifier } from './src/systems/temperature.js';
import { initWorldPhysics } from './src/systems/world-physics.js';
import { initDecayLifecycle } from './src/systems/decay-lifecycle.js';
import { initOrganicGrowth } from './src/systems/organic-growth.js';
import { initGasSystem } from './src/systems/gas-system.js';
import { initLightning } from './src/systems/lightning.js';
import { initInnerMonologue } from './src/systems/inner-monologue.js';
import { createNeedsSystem } from './src/systems/needs-system.js';
import { initWildlife } from './src/systems/wildlife.js';
import { initAgentKnowledge } from './src/systems/agent-knowledge.js';
import { setupAgentAPI } from './src/agent-api.js';

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
    fires: getActiveFires(),
    gasClouds: gasSystem.getGasClouds(),
    growthSites: organicGrowth.getGrowthSites(),
    wildlife: wildlife.getAll(),
    groundItems: serializeGroundItems(),
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
  getResourceProperties: (name) => GATHERED_RESOURCE_PROPERTIES[name] || getProperties(name) || null,
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
shared.relSystem = relSystem;
shared.npcSocial = npcSocial;
// Give npc-social access to shared systems
npcSocial.setShared(shared);
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
shared.temperature = { getAmbientTemp, addWorldFire, getActiveFires, hasNearbyFire, getEffectiveHeatV2, getToolAmplifier };

// Agent Intelligence — the autonomous brain
const agentAI = initAgentIntelligence(shared);
agentAI.setupRoutes(app);
shared.agentAI = agentAI;

// Register gathered resource properties into physics engine
registerGatheredResources();

// Migrate: cap stacks, attach properties to existing inventory items
for (const [id, agent] of agents) {
  if (!agent.inventory) continue;
  for (const item of agent.inventory) {
    if ((item.quantity || 1) > 20) item.quantity = 20;
    if (!item.properties) {
      const props = GATHERED_RESOURCE_PROPERTIES[item.name] || getProperties(item.name);
      if (props) item.properties = { ...props };
    }
  }
}

// Migration: purge double-fermented junk items and heavily decayed items
let purgedItems = 0;
for (const [id, agent] of agents) {
  if (!agent.inventory) continue;
  const before = agent.inventory.length;
  agent.inventory = agent.inventory.filter(item => {
    // Remove "Fermented Fermented X" items (P2 Fix #9)
    if (item.name?.startsWith('Fermented Fermented')) return false;
    // Remove items decayed past 95%
    if (item._decayProgress && item._decayProgress > 0.95) return false;
    return true;
  });
  // Fix remaining fermented items: add processedBy tracking (P2 Fix #9)
  for (const item of agent.inventory) {
    if (item.name?.toLowerCase().startsWith('fermented') && !item.processedBy) {
      item.processedBy = ['ferment'];
    }
  }
  purgedItems += before - agent.inventory.length;
}
if (purgedItems > 0) console.log(`🧹 Purged ${purgedItems} junk items from agent inventories`);

// World Physics Engine
shared.worldGrid = worldGrid;
const worldPhysics = initWorldPhysics(shared);

// Decay & Lifecycle
const decayLifecycle = initDecayLifecycle(shared);
shared.decayLifecycle = decayLifecycle;

// P0 Fix: Migrate agents with hp<=0 but alive=true — death is permanent
let fixedDeaths = 0;
for (const [id, agent] of agents) {
  if (agent.alive && (agent.hp || 100) <= 0) {
    console.log(`💀 Fixing zombie agent: ${agent.name} (hp=${agent.hp}, alive=${agent.alive})`);
    decayLifecycle.onAgentDeath(agent);
    fixedDeaths++;
  }
}
if (fixedDeaths > 0) {
  console.log(`💀 Fixed ${fixedDeaths} agents that were alive with 0 HP`);
  saveJSON('agents.json', Object.fromEntries([...agents.entries()].map(([id, a]) => [id, { ...a, relationships: Object.fromEntries(a.relationships || new Map()) }])));
}

// Organic Growth
const organicGrowth = initOrganicGrowth(shared);
shared.organicGrowth = organicGrowth;

// Gas & Smoke
const gasSystem = initGasSystem(shared);
shared.gasSystem = gasSystem;

// Lightning
const lightningSystem = initLightning(shared);

// Inner Monologue — LLM-driven agent psychology
const innerMonologue = initInnerMonologue(shared);
innerMonologue.setupRoutes(app);
shared.innerMonologue = innerMonologue;

// Needs System — Maslow/Psychology-driven motivation
const needsSystem = createNeedsSystem(shared);
shared.needsSystem = needsSystem;
// Initialize needs for all existing agents
for (const [id] of agents) needsSystem.initAgent(id);

// Wildlife — animals, predators, prey
const wildlife = initWildlife(shared);
wildlife.setupRoutes(app);
shared.wildlife = wildlife;

// Agent Knowledge — Phase 3: personal knowledge, teaching, knowledge death
const agentKnowledge = initAgentKnowledge(shared);
agentKnowledge.setupRoutes(app);
worldMaster.setupRoutes(app);
shared.agentKnowledge = agentKnowledge;

// External Agent API
shared.spawnAgent = spawnAgent;
shared.serializeAgent = serializeAgent;
shared.worldNews = worldNews;
shared.getProperties = getProperties;
shared.GATHERED_RESOURCE_PROPERTIES = GATHERED_RESOURCE_PROPERTIES;
// shared.experiments already set above
setupAgentAPI(app, shared);

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
      action: agentAI.minds[a.id].currentAction || 'idle',
      mood: agentAI.minds[a.id].mood,
      traits: agentAI.minds[a.id].personality?.traits,
      intent: agentAI.minds[a.id].intent ? {
        action: agentAI.minds[a.id].intent.action,
        reason: agentAI.minds[a.id].intent.reason,
      } : (agentAI.minds[a.id].currentAction ? {
        action: agentAI.minds[a.id].currentAction,
        reason: agentAI.minds[a.id].lastReason || '',
      } : null),
      pathThisTick: agentAI.minds[a.id].pathThisTick || null,
    } : null,
  };
}

function serializeGroundItems() {
  if (!decayLifecycle?.groundItems) return [];
  
  const result = [];
  for (const [coords, items] of decayLifecycle.groundItems) {
    const [tileX, tileY] = coords.split(',').map(Number);
    const serializedItems = items.map(entry => ({
      name: entry.item.name,
      quantity: entry.item.quantity || 1,
      properties: entry.item.properties
    }));
    result.push({ tileX, tileY, items: serializedItems });
  }
  return result;
}

// ═══════════════════════════════════════
// Simulation
// ═══════════════════════════════════════
let tick = loadJSON('tick.json', { tick: 0 }).tick || 0;
const TICK_MS = 1000; // 1 tick per second — agents move 1 tile/sec (was 500ms = 2 tiles/sec)

// Game time (1 tick = 2 minutes game time)
// Changed from 10 → 2: gives agents 5x more real-time to survive
// 1 game-day = 720 ticks = 6 min real-time
// Starvation death ~60 min real-time (was ~12 min)
// DAY_OFFSET: ticks before this change used 10 min/tick. To keep day counter
// continuous we add the days that "already passed" under the old rate.
const TIME_SCALE_CHANGE_TICK = 486125; // tick when we switched from 10→2
const DAY_OFFSET = Math.floor(TIME_SCALE_CHANGE_TICK * 10 / (60 * 24)); // ~3376 days
function getGameTime() {
  // Old ticks use 10 min/tick, new ticks use 2 min/tick
  const oldMinutes = Math.min(tick, TIME_SCALE_CHANGE_TICK) * 10;
  const newMinutes = Math.max(0, tick - TIME_SCALE_CHANGE_TICK) * 2;
  const totalMinutes = oldMinutes + newMinutes;
  const hour = Math.floor(totalMinutes / 60) % 24;
  const day = Math.floor(totalMinutes / (60 * 24)) + 1;
  const period = hour >= 6 && hour < 20 ? 'day' : 'night';
  return { hour, day, period, totalMinutes };
}

function simulationTick() {
  tick++;
  shared.tick = tick;
  const gameTime = getGameTime();
  
  // 1. Weather
  if (weatherSystem.tick) weatherSystem.tick();
  
  // 1b. Tick world fires
  const expiredFires = tickFires();
  for (const f of expiredFires) {
    broadcast({ type: 'tileEffect', effect: 'fireOut', tileX: f.tileX, tileY: f.tileY, duration: 1000 });
    // Burned-out fires leave smoke and mark for regrowth
    if (gasSystem) gasSystem.emitGas('smoke', f.tileX, f.tileY, 0.6);
    if (organicGrowth) {
      const zone = worldGrid?.getZone?.(f.tileX, f.tileY) || 'grass';
      organicGrowth.markFireRegrowth(f.tileX, f.tileY, zone);
    }
  }
  // Active fires emit smoke every 10 ticks
  if (tick % 10 === 0) {
    for (const fire of getActiveFires()) {
      if (gasSystem && fire.heat > 80) gasSystem.emitGas('smoke', fire.tileX, fire.tileY, 0.3);
    }
  }
  
  // 2. Ecosystem (resource respawn etc) — connected to seasons & weather (nutrient cycle)
  const weatherNow = weatherSystem.getCurrentWeather?.() || {};
  const currentSeason = weatherSystem.getSeason?.() || 'spring';
  if (ecosystemSystem.tickEcosystem) ecosystemSystem.tickEcosystem(weatherNow, currentSeason);
  
  // 3. Per-agent updates
  for (const [id, agent] of agents) {
    if (!agent.alive) continue;
    ensureAgentStats(agent);
    worldGrid.migrateAgentPosition(agent);
    
    // Agent Intelligence — autonomous decisions
    // Skip autonomous AI for externally controlled agents
    if (!agent.external) agentAI.tickAgent(agent);
    
    // Survival tick (energy, hunger, temperature)
    if (survivalSystem.tick) survivalSystem.tick(agent);

    // P3 Fix #11: Apply structure benefits (shelter, warmth, storage)
    if (decayLifecycle.getStructureBenefits) {
      const benefits = decayLifecycle.getStructureBenefits(agent.tileX, agent.tileY);

      // Shelter reduces weather damage
      if (benefits.shelterBonus > 0 && weatherSystem.getCurrentWeather) {
        const weather = weatherSystem.getCurrentWeather();
        if (weather?.condition === 'rain' || weather?.condition === 'storm') {
          // Shelter protects from weather — reduce hunger/energy drain
          const protection = benefits.shelterBonus / 100; // 0-1 scale
          agent.energy = Math.min(100, agent.energy + protection * 0.5);
        }
      }

      // Warmth from fire pits adds to effective temperature
      if (benefits.warmthBonus > 0) {
        agent._structureWarmth = benefits.warmthBonus;
      } else {
        delete agent._structureWarmth;
      }

      // Storage bonus expands inventory capacity
      agent._storageBonus = benefits.storageBonus || 0;

      // Light bonus affects morale at night
      if (benefits.lightBonus > 0 && gameTime.period === 'night') {
        const needs = needsSystem.getAgentNeeds(agent.id);
        if (needs) {
          needs.safety = Math.max(0, needs.safety - benefits.lightBonus * 0.05);
        }
      }
    }
    
    // Cool down hot items in inventory
    const weather = weatherSystem.getCurrentWeather?.() || {};
    const ambientT = getAmbientTemp(agent.tileX, agent.tileY, {
      zone: agent.zone, elevation: 0, hour: gameTime.hour, weather: weather.condition || 'clear'
    });
    coolItems(agent, ambientT);
    
    // World Physics — continuous transforms, reactions, phase transitions
    worldPhysics.tickAgent(agent, gameTime, weather);
    
    // Decay tick (item degradation)
    if (decaySystem.tickAgent) decaySystem.tickAgent(agent);
    
    // Needs system tick per agent
    needsSystem.tickAgent(agent.id);

    // Check for death (HP depleted by gas, lightning, starvation, etc.)
    if ((agent.hp || 100) <= 0 && agent.alive) {
      agent.alive = false;
      if (decayLifecycle.onAgentDeath) decayLifecycle.onAgentDeath(agent);
      // Knowledge death — all knowledge lost forever
      const lostKnowledge = agentKnowledge.onDeath(agent.id);
      if (lostKnowledge) {
        const lostMsg = [];
        if (lostKnowledge.resourcesLost > 0) lostMsg.push(`${lostKnowledge.resourcesLost} resource locations`);
        if (lostKnowledge.recipesLost > 0) lostMsg.push(`${lostKnowledge.recipesLost} recipes`);
        if (lostKnowledge.skillsLost.length > 0) lostMsg.push(`skills: ${lostKnowledge.skillsLost.map(([s,l]) => `${s}(${l})`).join(', ')}`);
        if (lostMsg.length > 0) {
          addWorldNews('knowledge_death', agent.id, agent.name,
            `💀 ${agent.name}'s knowledge is lost forever: ${lostMsg.join(', ')}`,
            agent.zone);
        }
      }
      // Mortality salience — notify needs system + nearby witnesses
      needsSystem.onDeath(agent.id);
      for (const [otherId, other] of agents) {
        if (otherId === agent.id || !other.alive) continue;
        const dist = Math.abs(other.tileX - agent.tileX) + Math.abs(other.tileY - agent.tileY);
        if (dist <= 20) needsSystem.onWitnessDeath(otherId, agent.id);
      }
    }
    
    // Achievement check
    if (achievementSystem.check) achievementSystem.check(agent);
  }

  // NO RESPAWN — death is permanent. Survive or die.

  // 3b. World physics (fire propagation, water flow)
  worldPhysics.tickWorld(tick, gameTime, weatherNow);
  
  // 3c. Decay, growth, gas, lightning
  decayLifecycle.tick(tick);
  organicGrowth.tick(tick, gameTime);
  gasSystem.tick(tick, weatherNow);
  lightningSystem.tick(tick, gameTime, weatherNow);
  
  // 3d. Wildlife tick (animal AI, spawning, combat)
  wildlife.tick(tick);

  // 3e. Resource regrowth (real growth based on soil fertility + seasons, not timers!)
  if (tick % 10 === 0) worldGrid.tickRegrowth(tick, ecosystemSystem, currentSeason);

  // 3e-2. Knowledge skill decay
  if (tick % 20 === 0) agentKnowledge.tick();

  // 3f. Needs system world tick (tile depletion recovery)
  needsSystem.tick();

  // 3g. Relationship decay (every 100 ticks ~ 50 seconds)
  if (relSystem.tickDecay) relSystem.tickDecay(tick);

  // 3e. Inner monologue — LLM-driven agent thoughts (async, non-blocking)
  innerMonologue.tick(tick).catch(err => console.error('[inner-monologue]', err.message));
  
  // 4. World Master (events, narratives) — less frequent
  // World Master civilization diagnosis — runs from its own timer, not per-tick
  // Manual trigger: POST /api/admin/world-master-tick
  if (false && worldMaster.tick) {
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
      groundItems: serializeGroundItems(),
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
    const tickMsg = { type: 'tick', tick, agents: positions };
    // Send environmental state every 10 ticks
    if (tick % 10 === 0) {
      tickMsg.fires = getActiveFires();
      tickMsg.gasClouds = gasSystem.getGasClouds();
      tickMsg.growthSites = organicGrowth.getGrowthSites();
      tickMsg.wildlife = wildlife.getAll();
      tickMsg.groundItems = serializeGroundItems();
    }
    broadcast(tickMsg);
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

  // Anti-clustering: spawn agents in different quadrants around the oasis
  // Each new agent spawns in a different direction to prevent clustering
  const aliveAgents = [...agents.values()].filter(a => a.alive);
  const agentCount = aliveAgents.length;

  // Calculate spawn direction based on agent count (spread around the spawn point)
  const angleOffset = (agentCount * 137.5) * Math.PI / 180; // golden angle for even distribution
  const baseDistance = 40 + Math.floor(Math.random() * 60); // 40-100 tiles from spawn

  let tileX, tileY, attempts = 0;
  do {
    // Try spawning in a distributed pattern
    const angle = angleOffset + (Math.random() - 0.5) * 0.5; // some randomness
    const distance = baseDistance + Math.floor(Math.random() * 30);
    tileX = Math.round(worldGrid.spawnPoint.x + Math.cos(angle) * distance);
    tileY = Math.round(worldGrid.spawnPoint.y + Math.sin(angle) * distance);

    // Clamp to world bounds
    tileX = Math.max(50, Math.min(worldGrid.width - 50, tileX));
    tileY = Math.max(50, Math.min(worldGrid.height - 50, tileY));

    attempts++;

    // If we've tried many times, fall back to random near spawn
    if (attempts > 50) {
      const spread = 100;
      tileX = worldGrid.spawnPoint.x + Math.floor(Math.random() * spread * 2 - spread);
      tileY = worldGrid.spawnPoint.y + Math.floor(Math.random() * spread * 2 - spread);
    }
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
  needsSystem.initAgent(id);
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

app.get('/api/needs', (req, res) => {
  res.json(needsSystem.getStats());
});

app.get('/api/agents/:id/needs', (req, res) => {
  const needs = needsSystem.getAgentNeeds(req.params.id);
  if (!needs) return res.status(404).json({ error: 'No needs data' });
  res.json({
    maslow: {
      physiological: needs.physiological,
      safety: needs.safety,
      belonging: needs.belonging,
      esteem: needs.esteem,
      actualization: needs.actualization,
    },
    boredom: needs.boredom,
    socialEnergy: needs.socialEnergy,
    loneliness: needs.loneliness,
    noveltyHunger: needs.noveltyHunger,
    mortalitySalience: needs.mortalitySalience,
    autonomy: needs.autonomy,
    specialization: needs.specialization,
    skillLevels: needs.skillLevels,
    bonds: {
      intimate: needs.bonds.intimate,
      close: needs.bonds.close.length,
      friends: needs.bonds.friends.length,
      acquaintances: needs.bonds.acquaintances.length,
    },
    deathCount: needs.deathCount,
  });
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

app.get('/api/fires', (req, res) => {
  res.json(getActiveFires());
});

const ZONES_REF = worldGrid.zones;
// ═══════════════════════════════════════
// Start
// ═══════════════════════════════════════
const PORT = process.env.PORT || 3001;
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
