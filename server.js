import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import crypto from 'crypto';

// ═══════════════════════════════════════
// Game Systems (ported from ClawScape)
// ═══════════════════════════════════════
// TODO: These need import path fixes as we adapt them to The Oasis world
// import { initWeather } from './src/systems/weather.js';
// import { initProficiency } from './src/systems/proficiency.js';
// import { initEcosystem } from './src/systems/ecosystem.js';
// import { initReputation } from './src/systems/reputation.js';
// import { initRelationships } from './src/systems/relationships.js';
// import { initNPCSocial } from './src/systems/npc-social.js';
// import { attachProperties, getProperties, ZONE_HEAT_BONUS } from './src/systems/materials.js';
// import { initExperiments } from './src/systems/experiments.js';
// import { initSurvival } from './src/systems/survival.js';
// import { initDecay } from './src/systems/decay.js';
// import { initKnowledge } from './src/systems/knowledge.js';
// import { initWorldMaster } from './src/systems/world-master.js';
// import { initCooking } from './src/systems/cooking.js';
// import { initAchievements } from './src/systems/achievements.js';
// import { initCollectiveProjects } from './src/systems/collective-projects.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// ═══════════════════════════════════════
// World State
// ═══════════════════════════════════════
let world = null;        // The 2000x2000 tile grid (from WORLD pipeline)
let agents = new Map();  // Active AI agents
let tick = 0;            // Simulation tick counter

// Load world
const WORLD_PATH = join(__dirname, 'output', 'world.json');
if (existsSync(WORLD_PATH)) {
  console.log('Loading world...');
  world = JSON.parse(readFileSync(WORLD_PATH, 'utf-8'));
  console.log(`World loaded: ${world.width}x${world.height} tiles`);
}

// ═══════════════════════════════════════
// Agent Management
// ═══════════════════════════════════════
function spawnAgent(name, x, y) {
  const id = crypto.randomUUID();
  const agent = {
    id,
    name,
    x, y,
    hp: 100,
    energy: 100,
    hunger: 0,
    temperature: 20,
    inventory: [],
    knowledge: [],
    relationships: new Map(),
    proficiencies: {},
    achievements: [],
    memory: [],       // What they've seen/experienced
    goals: [],        // Current objectives
    alive: true,
    ticksBorn: tick,
  };
  agents.set(id, agent);
  broadcast({ type: 'agent_spawn', agent: serializeAgent(agent) });
  console.log(`Agent spawned: ${name} at (${x},${y})`);
  return agent;
}

function serializeAgent(a) {
  return {
    ...a,
    relationships: Object.fromEntries(a.relationships),
  };
}

// ═══════════════════════════════════════
// Simulation Loop
// ═══════════════════════════════════════
const TICK_MS = 2000; // 2 seconds per tick

function simulationTick() {
  tick++;
  
  // TODO: Wire up each system per tick
  // 1. Weather update
  // 2. For each agent:
  //    a. Agent AI decides action (move, gather, craft, talk, rest, explore...)
  //    b. Execute action against world state
  //    c. Update survival (energy drain, hunger, temperature)
  //    d. Check encounters with nearby agents
  //    e. Update proficiency for actions taken
  //    f. Decay inventory items
  //    g. Check achievements
  // 3. Ecosystem tick (resource respawn, animal movement)
  // 4. World Master evaluation (trigger events, create narratives)
  // 5. Collective project progress
  // 6. Broadcast state to spectators

  if (tick % 100 === 0) {
    console.log(`Tick ${tick} | Agents: ${agents.size}`);
  }
}

// ═══════════════════════════════════════
// WebSocket (spectator mode)
// ═══════════════════════════════════════
const spectators = new Set();

wss.on('connection', (ws) => {
  spectators.add(ws);
  console.log(`Spectator connected (${spectators.size} total)`);
  
  // Send current state
  ws.send(JSON.stringify({
    type: 'init',
    tick,
    worldSize: world ? { w: world.width, h: world.height } : null,
    agents: [...agents.values()].map(serializeAgent),
  }));

  ws.on('close', () => spectators.delete(ws));
});

function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const ws of spectators) {
    if (ws.readyState === 1) ws.send(data);
  }
}

// ═══════════════════════════════════════
// API
// ═══════════════════════════════════════
app.get('/api/status', (req, res) => {
  res.json({
    tick,
    agents: agents.size,
    worldLoaded: !!world,
    worldSize: world ? `${world.width}x${world.height}` : null,
  });
});

app.get('/api/agents', (req, res) => {
  res.json([...agents.values()].map(serializeAgent));
});

app.post('/api/spawn', (req, res) => {
  if (!world) return res.status(400).json({ error: 'No world loaded' });
  const { name } = req.body;
  const x = Math.floor(Math.random() * world.width);
  const y = Math.floor(Math.random() * world.height);
  // TODO: ensure spawn on habitable tile
  const agent = spawnAgent(name || `Agent-${agents.size + 1}`, x, y);
  res.json(serializeAgent(agent));
});

// ═══════════════════════════════════════
// Start
// ═══════════════════════════════════════
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🏜️  The Oasis — running on http://localhost:${PORT}`);
  console.log(`   World: ${world ? `${world.width}x${world.height}` : 'not generated yet'}`);
  console.log(`   Tick interval: ${TICK_MS}ms\n`);
  
  // Start simulation loop
  setInterval(simulationTick, TICK_MS);
});
