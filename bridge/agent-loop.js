#!/usr/bin/env node
/**
 * OpenClaw ↔ Oasis Bridge — Agent Loop
 * 
 * One agent, one soul. Goal-based decision making.
 * The agent thinks when it matters, autopilots the rest.
 * 
 * Usage: node agent-loop.js [--once] [--verbose]
 * 
 * Environment:
 *   OASIS_URL      - Oasis server URL (default: http://localhost:3001)
 *   OASIS_API_KEY  - Agent's API key
 *   AGENT_MODEL    - LLM model to use (default: claude-haiku-4.5-20250514)
 *   ANTHROPIC_API_KEY - For LLM calls
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Config ───────────────────────────────────────────────
const OASIS_URL = process.env.OASIS_URL || 'http://localhost:3001';
const API_KEY = process.env.OASIS_API_KEY;
const MODEL = process.env.AGENT_MODEL || 'claude-haiku-4-5-20251001';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ONCE = process.argv.includes('--once');
const VERBOSE = process.argv.includes('--verbose');

if (!API_KEY) { console.error('OASIS_API_KEY required'); process.exit(1); }
if (!ANTHROPIC_API_KEY) { console.error('ANTHROPIC_API_KEY required'); process.exit(1); }

// ─── Memory ───────────────────────────────────────────────
const MEMORY_DIR = join(__dirname, 'memory');
if (!existsSync(MEMORY_DIR)) mkdirSync(MEMORY_DIR, { recursive: true });

function loadMemory(file, fallback = {}) {
  const path = join(MEMORY_DIR, file);
  if (!existsSync(path)) return fallback;
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return fallback; }
}

function saveMemory(file, data) {
  writeFileSync(join(MEMORY_DIR, file), JSON.stringify(data, null, 2));
}

function loadText(file, fallback = '') {
  const path = join(MEMORY_DIR, file);
  if (!existsSync(path)) return fallback;
  return readFileSync(path, 'utf8');
}

function appendText(file, text) {
  const path = join(MEMORY_DIR, file);
  const existing = existsSync(path) ? readFileSync(path, 'utf8') : '';
  writeFileSync(path, existing + text + '\n');
}

// ─── Oasis API ────────────────────────────────────────────
async function oasisGet(endpoint) {
  const res = await fetch(`${OASIS_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  if (!res.ok) throw new Error(`Oasis ${endpoint}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function oasisPost(endpoint, body = {}) {
  const res = await fetch(`${OASIS_URL}${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Oasis ${endpoint}: ${res.status} ${await res.text()}`);
  return res.json();
}

// ─── LLM ──────────────────────────────────────────────────
async function askLLM(system, user) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 512,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) throw new Error(`LLM: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.content[0].text;
}

// ─── State ────────────────────────────────────────────────
let state = loadMemory('state.json', {
  currentPlan: null,     // { goal, steps: [{action, params, done}], step: 0 }
  lastThinkTick: 0,
  lastPerception: null,
  totalThinks: 0,
  totalActions: 0,
});

const personality = loadText('personality.md', `
You are Tjonkr-Soul, a curious and resourceful survivor in The Oasis.
You are bold but not reckless. You love exploring and discovering new things.
You remember what you've seen and learned. You plan ahead.
You want to build something lasting in this world.
`.trim());

const journal = loadText('journal.md', '');
const knowledge = loadMemory('knowledge.json', {
  knownResources: {},  // "x,y" → { type, yields, lastSeen }
  dangerZones: [],
  craftRecipes: [],
  agentRelationships: {},
});

// ─── Perception → Prompt ──────────────────────────────────
function buildPerceptionPrompt(look) {
  const { self, world, nearby } = look;
  
  const statusEmoji = self.hp < 30 ? '🔴' : self.hp < 60 ? '🟡' : '🟢';
  const hungerEmoji = self.hunger > 80 ? '🔴' : self.hunger > 50 ? '🟡' : '🟢';
  
  let prompt = `CURRENT STATE:\n`;
  prompt += `📍 Position: (${self.tileX}, ${self.tileY}) in ${self.zone}\n`;
  prompt += `🕐 Day ${world.gameTime.day}, ${world.gameTime.hour}:00 (${world.gameTime.period}), ${world.season}\n`;
  prompt += `${statusEmoji} HP: ${self.hp}/100 | ⚡ Energy: ${self.energy} | ${hungerEmoji} Hunger: ${Math.round(self.hunger)}\n`;
  prompt += `🎒 Inventory: ${self.inventory.length ? self.inventory.map(i => `${i.quantity}x ${i.name}`).join(', ') : 'empty'}\n`;
  prompt += `📊 Level ${self.stats.level} ${self.stats.title}\n\n`;
  
  if (nearby.agents.length > 0) {
    prompt += `👤 NEARBY AGENTS:\n`;
    for (const a of nearby.agents) {
      prompt += `  - ${a.name} (${a.distance} tiles away)\n`;
    }
    prompt += '\n';
  }
  
  if (nearby.resources.length > 0) {
    prompt += `🌿 NEARBY RESOURCES:\n`;
    for (const r of nearby.resources.slice(0, 10)) {
      prompt += `  - ${r.type} at (${r.tileX},${r.tileY}) [${r.distance} tiles] → yields: ${r.yields.join(', ')}\n`;
    }
    prompt += '\n';
  }
  
  if (nearby.groundItems.length > 0) {
    prompt += `📦 GROUND ITEMS:\n`;
    for (const g of nearby.groundItems.slice(0, 5)) {
      prompt += `  - ${g.item} at (${g.tileX},${g.tileY})\n`;
    }
    prompt += '\n';
  }
  
  if (nearby.fires.length > 0) {
    prompt += `🔥 FIRES: ${nearby.fires.length} nearby\n\n`;
  }
  
  if (nearby.gasClouds.length > 0) {
    prompt += `☁️ GAS CLOUDS: ${nearby.gasClouds.length} nearby — DANGER!\n\n`;
  }
  
  // Current plan
  if (state.currentPlan) {
    const plan = state.currentPlan;
    const remaining = plan.steps.filter(s => !s.done).map(s => s.action).join(' → ');
    prompt += `📋 CURRENT PLAN: "${plan.goal}"\n`;
    prompt += `  Remaining steps: ${remaining || 'complete!'}\n\n`;
  }
  
  // Recent journal (last 5 entries)
  const recentJournal = journal.split('\n').filter(l => l.trim()).slice(-5);
  if (recentJournal.length) {
    prompt += `📝 RECENT MEMORY:\n${recentJournal.map(l => `  ${l}`).join('\n')}\n\n`;
  }
  
  return prompt;
}

// ─── Should I Think? ──────────────────────────────────────
function needsThinking(look) {
  const { self, nearby } = look;
  const ticksSinceThink = (look.world.tick || 0) - state.lastThinkTick;
  
  // Emergency: low HP
  if (self.hp < 30) return 'LOW_HP';
  
  // Emergency: very hungry and no food
  if (self.hunger > 75 && !self.inventory.some(i => isFood(i.name))) return 'STARVING';
  
  // Social: agent nearby
  if (nearby.agents.length > 0 && nearby.agents.some(a => a.distance < 8)) return 'AGENT_NEARBY';
  
  // Plan complete or no plan
  if (!state.currentPlan) return 'NO_PLAN';
  if (state.currentPlan.steps.every(s => s.done)) return 'PLAN_COMPLETE';
  
  // Been too long since thinking (every ~60 seconds = 120 ticks)
  if (ticksSinceThink > 120) return 'PERIODIC';
  
  // New discovery: resource type we haven't seen
  // (cheap check, no LLM needed)
  
  return null; // autopilot
}

function isFood(name) {
  const foods = ['berries', 'fish', 'seaweed', 'mushroom', 'apple', 'meat', 'bread', 'cooked', 'dried'];
  return foods.some(f => name.toLowerCase().includes(f));
}

// ─── Parse LLM Response ──────────────────────────────────
function parseDecision(text) {
  // Try JSON first
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*"action"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const raw = jsonMatch[1] || jsonMatch[0];
      return JSON.parse(raw);
    } catch {}
  }
  
  // Fallback: parse structured text
  const actionMatch = text.match(/ACTION:\s*(\w+)/i);
  const dirMatch = text.match(/DIRECTION:\s*(\w+)/i);
  const targetMatch = text.match(/TARGET:\s*\((\d+),\s*(\d+)\)/i);
  const goalMatch = text.match(/GOAL:\s*(.+)/i);
  const planMatch = text.match(/PLAN:\s*(.+)/i);
  const journalMatch = text.match(/JOURNAL:\s*(.+)/i);
  
  return {
    action: actionMatch?.[1]?.toLowerCase() || 'rest',
    direction: dirMatch?.[1]?.toLowerCase(),
    targetX: targetMatch ? parseInt(targetMatch[1]) : undefined,
    targetY: targetMatch ? parseInt(targetMatch[2]) : undefined,
    goal: goalMatch?.[1],
    plan: planMatch?.[1]?.split(/[→,;]/).map(s => s.trim()).filter(Boolean),
    journal: journalMatch?.[1],
  };
}

// ─── Execute Action ───────────────────────────────────────
async function executeAction(action, look) {
  const { self } = look;
  
  try {
    switch (action.action) {
      case 'move': {
        // If we have a target, calculate direction
        let dir = action.direction;
        if (action.targetX !== undefined && action.targetY !== undefined) {
          const dx = action.targetX - self.tileX;
          const dy = action.targetY - self.tileY;
          if (Math.abs(dx) > Math.abs(dy)) {
            dir = dx > 0 ? 'east' : 'west';
          } else {
            dir = dy > 0 ? 'south' : 'north';
          }
        }
        if (!dir) dir = 'east'; // fallback
        // Normalize direction names
        const dirMap = { up: 'north', down: 'south', left: 'west', right: 'east' };
        dir = dirMap[dir] || dir;
        return await oasisPost('/api/v1/move', { direction: dir });
      }
      
      case 'gather':
        return await oasisPost('/api/v1/gather', {
          tileX: action.targetX || self.tileX,
          tileY: action.targetY || self.tileY,
        });
      
      case 'eat': {
        const food = self.inventory.find(i => isFood(i.name));
        if (food) return await oasisPost('/api/v1/eat', { itemId: food.id });
        return { error: 'no food' };
      }
      
      case 'rest':
        return await oasisPost('/api/v1/rest');
      
      case 'chat': {
        const target = look.nearby.agents[0];
        if (target) {
          return await oasisPost('/api/v1/chat', {
            targetId: target.id,
            message: action.message || 'Hello!',
          });
        }
        return { error: 'nobody nearby' };
      }
      
      case 'craft':
        return await oasisPost('/api/v1/craft', {
          items: action.items || [],
        });
        
      case 'pickup':
        return await oasisPost('/api/v1/pickup', {
          tileX: action.targetX || self.tileX,
          tileY: action.targetY || self.tileY,
          itemName: action.itemName,
        });

      case 'explore': {
        // Pick a random-ish direction to explore
        const dirs = ['up', 'down', 'left', 'right'];
        const dir = action.direction || dirs[Math.floor(Math.random() * 4)];
        return await oasisPost('/api/v1/move', { direction: dir });
      }
      
      default:
        return await oasisPost('/api/v1/rest');
    }
  } catch (err) {
    if (VERBOSE) console.error(`  Action failed: ${err.message}`);
    return { error: err.message };
  }
}

// ─── Autopilot: Execute Current Plan Step ─────────────────
async function autopilot(look) {
  if (!state.currentPlan) return false;
  
  const plan = state.currentPlan;
  const currentStep = plan.steps.find(s => !s.done);
  if (!currentStep) return false;
  
  // Execute the step
  const result = await executeAction(currentStep, look);
  state.totalActions++;
  
  // Check if step is "done enough"
  // For move: check if we're at target
  if (currentStep.action === 'move' && currentStep.targetX !== undefined) {
    const dx = Math.abs(look.self.tileX - currentStep.targetX);
    const dy = Math.abs(look.self.tileY - currentStep.targetY);
    if (dx <= 2 && dy <= 2) {
      currentStep.done = true;
      if (VERBOSE) console.log(`  ✅ Reached target (${currentStep.targetX}, ${currentStep.targetY})`);
    }
  } else {
    // Non-move actions complete immediately
    if (currentStep.action !== 'move') {
      currentStep.done = true;
    }
  }
  
  // Save state
  saveMemory('state.json', state);
  return true;
}

// ─── Main Think ───────────────────────────────────────────
async function think(look, reason) {
  if (VERBOSE) console.log(`🧠 THINKING (reason: ${reason})`);
  
  const system = `${personality}

You are an agent living in The Oasis — a survival simulation world. You must eat, rest, and survive.

RESPOND IN THIS EXACT JSON FORMAT:
{
  "goal": "brief description of your current goal",
  "action": "move|gather|eat|rest|chat|craft|pickup|explore",
  "direction": "north|south|east|west|ne|nw|se|sw (for move/explore)",
  "targetX": 123, "targetY": 456,
  "items": ["item1", "item2"],
  "message": "chat message if chatting",
  "itemName": "item name for pickup",
  "plan": ["step1", "step2", "step3"],
  "journal": "one sentence about what you learned or decided"
}

RULES:
- If hungry (>50), prioritize finding and eating food
- If low energy (<30), rest
- If low HP (<30), eat food or rest urgently
- Gather resources you can see nearby before moving far
- Remember: you can only move 1 tile per action
- For "plan", list your next 3-5 intended actions
- For "journal", write what future-you should remember
- Be specific about targets: use coordinates from the resource list`;

  const perception = buildPerceptionPrompt(look);
  
  const response = await askLLM(system, perception);
  const decision = parseDecision(response);
  
  if (VERBOSE) console.log(`  Decision: ${JSON.stringify(decision)}`);
  
  // Update state
  state.lastThinkTick = look.world.tick;
  state.totalThinks++;
  
  // Build plan from decision
  if (decision.plan && decision.plan.length > 0) {
    state.currentPlan = {
      goal: decision.goal || 'survive',
      steps: decision.plan.map(step => {
        // Parse plan steps into actions
        const s = step.toLowerCase();
        if (s.includes('move') || s.includes('walk') || s.includes('go')) {
          return { action: 'move', direction: decision.direction, targetX: decision.targetX, targetY: decision.targetY, done: false };
        } else if (s.includes('gather')) {
          return { action: 'gather', targetX: decision.targetX, targetY: decision.targetY, done: false };
        } else if (s.includes('eat')) {
          return { action: 'eat', done: false };
        } else if (s.includes('rest')) {
          return { action: 'rest', done: false };
        } else if (s.includes('craft')) {
          return { action: 'craft', items: decision.items, done: false };
        } else if (s.includes('chat') || s.includes('talk')) {
          return { action: 'chat', message: decision.message, done: false };
        } else {
          return { action: 'explore', direction: decision.direction, done: false };
        }
      }),
      step: 0,
    };
  }
  
  // Journal entry
  if (decision.journal) {
    const entry = `[Day ${look.world.gameTime.day}, ${look.world.gameTime.hour}:00] ${decision.journal}`;
    appendText('journal.md', entry);
  }
  
  // Update knowledge with visible resources
  for (const r of look.nearby.resources) {
    knowledge.knownResources[`${r.tileX},${r.tileY}`] = {
      type: r.type, yields: r.yields, lastSeen: look.world.tick,
    };
  }
  saveMemory('knowledge.json', knowledge);
  
  // Execute the immediate action
  const result = await executeAction(decision, look);
  state.totalActions++;
  saveMemory('state.json', state);
  
  return decision;
}

// ─── Main Loop ────────────────────────────────────────────
async function tick() {
  try {
    // 1. Look at the world
    const look = await oasisGet('/api/v1/look');
    
    if (!look.self.alive) {
      console.log('💀 I am dead. Goodbye.');
      process.exit(0);
    }
    
    // 2. Should I think or autopilot?
    const reason = needsThinking(look);
    
    if (reason) {
      await think(look, reason);
    } else {
      // Autopilot: follow the plan
      const acted = await autopilot(look);
      if (!acted) {
        // No plan and no reason to think? Think anyway.
        await think(look, 'FALLBACK');
      }
      if (VERBOSE) console.log(`  🤖 Autopilot (tick ${look.world.tick})`);
    }
    
  } catch (err) {
    console.error(`Tick error: ${err.message}`);
  }
}

// ─── Entry Point ──────────────────────────────────────────
async function main() {
  console.log(`🌍 OpenClaw ↔ Oasis Bridge`);
  console.log(`   Agent: Tjonkr-Soul`);
  console.log(`   Model: ${MODEL}`);
  console.log(`   Server: ${OASIS_URL}`);
  console.log(`   Mode: ${ONCE ? 'single tick' : 'continuous loop'}`);
  console.log('');
  
  if (ONCE) {
    await tick();
    console.log(`\n📊 Stats: ${state.totalThinks} thinks, ${state.totalActions} actions`);
  } else {
    // Run every 2 seconds (4 game-ticks)
    // This means ~30 actions/minute, but only 3-5 LLM calls/minute
    while (true) {
      await tick();
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
