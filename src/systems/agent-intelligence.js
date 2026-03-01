/**
 * Agent Intelligence — Advance Wars-style purposeful movement & intent system
 * 
 * Agents scan their vision range, score intents based on personality/needs,
 * pick a target, path toward it spending movement points (terrain-costed),
 * and execute the action on arrival.
 */

// ═══════════════════════════════
// PERSONALITY SYSTEM
// ═══════════════════════════════

const PERSONALITY_TRAITS = {
  curious:     { gather: +15, explore: +20, experiment: +10 },
  cautious:    { gather: -10, explore: -15, rest: +20 },
  bold:        { gather: +20, explore: +15, fight: +10 },
  generous:    { gift: +25, chat: +10, craft: +5 },
  greedy:      { gather: +20, hoard: +15, gift: -20 },
  social:      { chat: +25, gather: -5, explore: +5 },
  solitary:    { chat: -20, explore: +15, gather: +10 },
  competitive: { craft: +10, gather: +10, fight: +5 },
  nurturing:   { gift: +15, chat: +10, rest: +5 },
  creative:    { craft: +25, experiment: +20, chat: +5 },
  stubborn:    { rest: +10, explore: -5 },
  adaptable:   { explore: +10, craft: +5 },
  reckless:    { explore: +20, fight: +15, rest: -15 },
  patient:     { gather: +10, craft: +10, rest: +10 },
  ambitious:   { explore: +15, craft: +10, gather: +10 },
};

const TRAIT_NAMES = Object.keys(PERSONALITY_TRAITS);

const TEMPERAMENTS = ['calm', 'hot-headed', 'impulsive', 'methodical', 'thoughtful', 'restless'];

const VALUES = [
  'knowledge', 'craftsmanship', 'exploration', 'friendship', 'beauty',
  'survival', 'discovery', 'harmony', 'freedom', 'wisdom', 'power', 'wealth',
];

const AMBITIONS = [
  "explore every biome in the world",
  "master the art of crafting",
  "discover every secret this land holds",
  "build lasting bonds with fellow wanderers",
  "survive against all odds",
  "become the most skilled gatherer",
  "uncover the mysteries of the ancient world",
  "leave a mark that outlasts me",
  "find a place to call home",
  "become a legendary explorer",
];

// ═══════════════════════════════
// ACTIONS & COSTS
// ═══════════════════════════════

const ACTIONS = {
  idle:      { energy: 0,   description: 'Standing around, thinking' },
  move:      { energy: 0.5, description: 'Walking to a new location' },
  gather:    { energy: 1.5, description: 'Collecting resources from the terrain' },
  rest:      { energy: -3,  description: 'Resting to recover energy' },
  craft:     { energy: 2,   description: 'Crafting an item from materials' },
  explore:   { energy: 0.5, description: 'Exploring the surroundings' },
  chat:      { energy: 0.3, description: 'Talking with a nearby agent' },
  gift:      { energy: 0.3, description: 'Giving something to another agent' },
  experiment:{ energy: 3,   description: 'Experimenting with materials' },
  eat:       { energy: 0,   description: 'Eating to reduce hunger' },
  fight:     { energy: 2,   description: 'Fighting a creature or hazard' },
  build:     { energy: 3,   description: 'Contributing to a construction project' },
};

// ═══════════════════════════════
// TERRAIN & MOVEMENT
// ═══════════════════════════════

const TERRAIN_COST = {
  grass: 1, grassland: 1, path: 1, coast: 1,
  forest: 2, swamp: 2, sand: 2,
  rocky: 3, cave: 3, mountain: 3,
  river: 3,
  water: Infinity, ocean: Infinity,
};

const VISION_RANGE = 20;

function getTerrainCost(tile) {
  if (!tile || !tile.walkable) return Infinity;
  const biome = (tile.biome || tile.terrain || '').toLowerCase();
  for (const [key, cost] of Object.entries(TERRAIN_COST)) {
    if (biome.includes(key)) return cost;
  }
  return 1; // default
}

function getMovementPoints(agent) {
  // Always 1 tile per tick — agents walk tile-by-tile visually
  // Energy affects whether they can move at all
  if (agent.energy <= 5) return 0; // too exhausted to move
  return 1;
}

// ═══════════════════════════════
// HELPERS
// ═══════════════════════════════

function isFoodResource(name) {
  const n = (name || '').toLowerCase();
  return n.includes('berr') || n.includes('fish') || n.includes('mushroom') || n.includes('herb') || n.includes('fruit') || n.includes('nut');
}

function hasFood(agent) {
  return (agent.inventory || []).some(i => isFoodResource(i?.name));
}

function distance(x1, y1, x2, y2) {
  return Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)); // Chebyshev
}

// ═══════════════════════════════
// SEEDED RANDOMNESS
// ═══════════════════════════════
function seededRng(seed) {
  let h = 0;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return function() { h = (h * 1103515245 + 12345) & 0x7fffffff; return (h >> 16) / 32768; };
}

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function pickN(rng, arr, n) {
  const copy = [...arr];
  const result = [];
  for (let i = 0; i < Math.min(n, copy.length); i++) {
    const idx = Math.floor(rng() * copy.length);
    result.push(copy.splice(idx, 1)[0]);
  }
  return result;
}

// ═══════════════════════════════
// MAIN SYSTEM
// ═══════════════════════════════

export function initAgentIntelligence(shared) {
  const {
    loadJSON, saveJSON, agents, agentStore,
    broadcast, addWorldNews, awardXP,
    worldGrid, zones,
  } = shared;

  let minds = loadJSON('agent-minds.json', {});
  let saveTimer = null;

  function scheduleSave() {
    if (saveTimer) return;
    saveTimer = setTimeout(() => { saveJSON('agent-minds.json', minds); saveTimer = null; }, 5000);
  }

  // ─────────────────────────────
  // Personality Generation
  // ─────────────────────────────
  function ensureMind(agentId) {
    if (minds[agentId]) return minds[agentId];

    const agent = agents.get(agentId);
    if (!agent) return null;

    const rng = seededRng(agentId);
    const traits = pickN(rng, TRAIT_NAMES, 2 + Math.floor(rng() * 2));
    const temperament = pick(rng, TEMPERAMENTS);
    const values = pickN(rng, VALUES, 2);
    const ambition = pick(rng, AMBITIONS);

    minds[agentId] = {
      personality: { traits, temperament, values, ambition },
      goals: [],
      currentAction: null,
      actionTicks: 0,
      intent: null,       // { action, targetX, targetY, reason, startedTick, maxTicks }
      pathThisTick: null,  // [{x,y}, ...] for frontend animation
      memory: {
        short: [],
        lessons: [],
        visited: {},
        gathered: {},
      },
      relationships: {},
      journal: `I am ${agent.name}. I just arrived in this world.`,
      mood: 'neutral',
      lastReflection: 0,
    };

    scheduleSave();
    return minds[agentId];
  }

  // ─────────────────────────────
  // Nearby agents helper
  // ─────────────────────────────
  function getNearbyAgents(agent, radius) {
    const result = [];
    for (const [id, other] of agents) {
      if (id === agent.id || !other.alive) continue;
      const dx = Math.abs(other.tileX - agent.tileX);
      const dy = Math.abs(other.tileY - agent.tileY);
      if (dx <= radius && dy <= radius) result.push(other);
    }
    return result;
  }

  function addMemoryEvent(mind, text) {
    mind.memory.short.push({ tick: Date.now(), text });
    if (mind.memory.short.length > 30) mind.memory.short = mind.memory.short.slice(-30);
  }

  // ─────────────────────────────
  // Vision System
  // ─────────────────────────────
  function scanVisible(agent, mind) {
    const result = {
      resources: [],
      agents: [],
      dangers: [],
      projects: [],
      unknownZones: [],
    };

    const ax = agent.tileX, ay = agent.tileY;
    const minX = Math.max(0, ax - VISION_RANGE);
    const maxX = Math.min((worldGrid.width || 2000) - 1, ax + VISION_RANGE);
    const minY = Math.max(0, ay - VISION_RANGE);
    const maxY = Math.min((worldGrid.height || 2000) - 1, ay + VISION_RANGE);

    // Scan tiles for resources and zones
    const seenZones = new Set();
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const d = distance(ax, ay, x, y);

        // Resources (decoration-first, zone-fallback)
        const tileRes = worldGrid.getTileResources?.(x, y);
        if (tileRes && tileRes.available) {
          result.resources.push({
            x, y,
            resource: tileRes.resources[0],
            source: tileRes.source,
            allResources: tileRes.resources,
            distance: d,
          });
        }

        // Unknown zones
        const zone = worldGrid.getZone?.(x, y);
        if (zone && !seenZones.has(zone)) {
          seenZones.add(zone);
          const visits = mind.memory.visited[zone] || 0;
          if (visits < 3) {
            result.unknownZones.push({ x, y, zone, distance: d });
          }
        }
      }
    }

    // Scan for nearby agents
    for (const [id, other] of agents) {
      if (id === agent.id || !other.alive) continue;
      const d = distance(ax, ay, other.tileX, other.tileY);
      if (d <= VISION_RANGE) {
        const rel = mind.relationships[id];
        result.agents.push({
          agent: other,
          distance: d,
          relationship: rel?.score || 0,
        });
      }
    }

    // Scan for dangers (world events)
    if (shared.worldMaster) {
      const currentZone = worldGrid.getZone?.(ax, ay);
      const danger = shared.worldMaster.getZoneDanger?.(currentZone);
      if (danger) {
        result.dangers.push({ x: ax, y: ay, type: danger, distance: 0 });
      }
    }

    // Scan for collective projects
    if (shared.collectiveProjects) {
      const currentZone = agent.zone;
      const projects = shared.collectiveProjects.getProjectsInZone?.(currentZone);
      if (projects) {
        for (const p of projects) {
          if (p.status === 'gathering') {
            result.projects.push({ x: ax, y: ay, project: p, distance: 0 });
          }
        }
      }
    }

    return result;
  }

  // ─────────────────────────────
  // Movement: stepToward (single tile)
  // ─────────────────────────────
  function stepToward(agent, mind, targetX, targetY) {
    const dx = Math.sign(targetX - agent.tileX);
    const dy = Math.sign(targetY - agent.tileY);
    if (dx === 0 && dy === 0) return { moved: false, cost: 0 };

    // Try diagonal first, then cardinal fallbacks
    const candidates = [];
    if (dx !== 0 && dy !== 0) candidates.push([dx, dy]);
    if (dx !== 0) candidates.push([dx, 0]);
    if (dy !== 0) candidates.push([0, dy]);
    // Also try the other cardinal if both are nonzero
    if (dx !== 0 && dy !== 0) {
      candidates.push([0, dy]);
      candidates.push([dx, 0]);
    }

    for (const [mx, my] of candidates) {
      const tx = agent.tileX + mx;
      const ty = agent.tileY + my;
      const tile = worldGrid.getTile(tx, ty);
      if (tile && tile.walkable) {
        const cost = getTerrainCost(tile);
        if (cost === Infinity) continue;
        agent.tileX = tx;
        agent.tileY = ty;
        agent.x = tx;
        agent.y = ty;
        agent.zone = worldGrid.getZone(tx, ty);
        mind.memory.visited[agent.zone] = (mind.memory.visited[agent.zone] || 0) + 1;
        return { moved: true, cost };
      }
    }
    return { moved: false, cost: 0 };
  }

  // ─────────────────────────────
  // Movement: moveToward (multi-tile with budget)
  // ─────────────────────────────
  function moveToward(agent, mind, targetX, targetY, movementPoints) {
    let remaining = movementPoints;
    const path = [];

    while (remaining > 0) {
      if (agent.tileX === targetX && agent.tileY === targetY) break;

      // Peek at best neighbor cost before committing
      const dx = Math.sign(targetX - agent.tileX);
      const dy = Math.sign(targetY - agent.tileY);
      
      const result = stepToward(agent, mind, targetX, targetY);
      if (!result.moved) break;
      
      remaining -= result.cost;
      if (remaining < 0) {
        // Went over budget — still allow the move (already committed)
        break;
      }
      path.push({ x: agent.tileX, y: agent.tileY });
    }

    mind.pathThisTick = path.length > 0 ? path : null;
    return path.length > 0;
  }

  // ─────────────────────────────
  // Intent Scoring
  // ─────────────────────────────
  function getTraitBonus(mind, action) {
    let bonus = 0;
    for (const trait of mind.personality.traits) {
      bonus += (PERSONALITY_TRAITS[trait]?.[action] || 0);
    }
    return bonus;
  }

  function scoreIntents(agent, mind, visible) {
    const intents = [];
    const gameTime = shared.getGameTime?.();
    const weather = shared.weather?.getCurrentWeather?.();
    const atmosphere = shared.weather?.getAtmosphere?.();
    const isNight = gameTime?.period === 'night';
    const weatherId = weather?.id || atmosphere?.weather;

    // GATHER — score each visible resource
    for (const res of visible.resources) {
      let score = 20 + getTraitBonus(mind, 'gather');
      if (agent.hunger > 50 && isFoodResource(res.resource)) score += 40;
      if (agent.hunger > 70 && isFoodResource(res.resource)) score += 20;
      score -= res.distance * 2;

      // Determine movement target — if tile is not walkable, find adjacent walkable tile
      let targetX = res.x, targetY = res.y;
      const tile = worldGrid.getTile(res.x, res.y);
      if (tile && !tile.walkable) {
        // Find nearest walkable neighbor
        let bestDist = Infinity;
        for (const [ddx, ddy] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]) {
          const nx = res.x + ddx, ny = res.y + ddy;
          const neighbor = worldGrid.getTile(nx, ny);
          if (neighbor && neighbor.walkable) {
            const nd = distance(agent.tileX, agent.tileY, nx, ny);
            if (nd < bestDist) { bestDist = nd; targetX = nx; targetY = ny; }
          }
        }
      }

      const sourceName = (res.source || '').replace(/_/g, ' ');
      intents.push({ action: 'gather', targetX, targetY, gatherX: res.x, gatherY: res.y, score, reason: `Gather ${res.resource} from ${sourceName}` });
    }

    // CHAT — score each visible agent
    for (const other of visible.agents) {
      let score = 15 + getTraitBonus(mind, 'chat');
      if (other.relationship >= 10) score += 20;
      if (other.relationship <= -5) score -= 30;
      score -= other.distance * 2;
      intents.push({ action: 'chat', targetX: other.agent.tileX, targetY: other.agent.tileY, score, reason: `Talk to ${other.agent.name}` });
    }

    // GIFT — if generous and near friend with items
    if ((agent.inventory?.length || 0) > 0) {
      for (const other of visible.agents) {
        if (other.relationship < 5) continue;
        let score = 10 + getTraitBonus(mind, 'gift');
        score += other.relationship;
        score -= other.distance * 2;
        intents.push({ action: 'gift', targetX: other.agent.tileX, targetY: other.agent.tileY, score, reason: `Gift to ${other.agent.name}` });
      }
    }

    // EXPLORE — score unknown zones
    for (const unk of visible.unknownZones) {
      let score = 15 + getTraitBonus(mind, 'explore');
      score -= unk.distance;
      intents.push({ action: 'explore', targetX: unk.x, targetY: unk.y, score, reason: `Explore ${unk.zone}` });
    }

    // If nothing visible to explore, pick a random far target
    if (visible.unknownZones.length === 0 && Object.keys(mind.memory.visited).length < 20) {
      const angle = Math.random() * Math.PI * 2;
      const range = 10 + Math.floor(Math.random() * 20);
      const tx = Math.max(0, Math.min((worldGrid.width || 2000) - 1, agent.tileX + Math.round(Math.cos(angle) * range)));
      const ty = Math.max(0, Math.min((worldGrid.height || 2000) - 1, agent.tileY + Math.round(Math.sin(angle) * range)));
      let score = 10 + getTraitBonus(mind, 'explore');
      intents.push({ action: 'explore', targetX: tx, targetY: ty, score, reason: 'Wander to new territory' });
    }

    // REST — if tired
    if (agent.energy < 30) {
      intents.push({ action: 'rest', targetX: agent.tileX, targetY: agent.tileY, score: 60 + (30 - agent.energy), reason: 'Need rest' });
    } else if (agent.energy < 50) {
      intents.push({ action: 'rest', targetX: agent.tileX, targetY: agent.tileY, score: 20 + getTraitBonus(mind, 'rest'), reason: 'Feeling tired' });
    }

    // EAT — if hungry and have food
    if (agent.hunger > 40 && hasFood(agent)) {
      intents.push({ action: 'eat', targetX: agent.tileX, targetY: agent.tileY, score: 50 + agent.hunger, reason: 'Eating' });
    }

    // CRAFT — if have materials
    if ((agent.inventory?.length || 0) >= 2) {
      let score = 15 + getTraitBonus(mind, 'craft');
      if ((agent.inventory?.length || 0) > 15) score += 20;
      intents.push({ action: 'craft', targetX: agent.tileX, targetY: agent.tileY, score, reason: 'Craft something' });
    }

    // EXPERIMENT — if have materials
    if (shared.experiments && (agent.inventory?.length || 0) >= 2) {
      let score = 10 + getTraitBonus(mind, 'experiment');
      intents.push({ action: 'experiment', targetX: agent.tileX, targetY: agent.tileY, score, reason: 'Experiment with materials' });
    }

    // BUILD — score visible projects
    for (const proj of visible.projects) {
      let score = 20 + getTraitBonus(mind, 'build');
      // Check if we have materials the project needs
      if (proj.project.materialsRequired && agent.inventory) {
        const canContribute = Object.keys(proj.project.materialsRequired).some(mat => {
          const contributed = proj.project.materialsContributed?.[mat] || 0;
          const needed = proj.project.materialsRequired[mat];
          return contributed < needed && agent.inventory.some(i => i.name === mat);
        });
        if (canContribute) score += 25;
        else score -= 15;
      }
      score -= proj.distance * 2;
      intents.push({ action: 'build', targetX: proj.x, targetY: proj.y, score, reason: `Build ${proj.project.name}` });
    }

    // FIGHT — if encounters available and bold
    if (shared.encounters) {
      let score = 5 + getTraitBonus(mind, 'fight');
      if (agent.energy > 60) score += 10;
      // Only if score is reasonable
      if (score > 10) {
        intents.push({ action: 'fight', targetX: agent.tileX, targetY: agent.tileY, score, reason: 'Seek a challenge' });
      }
    }

    // FLEE danger
    for (const danger of visible.dangers) {
      let score = 50;
      if (mind.personality.traits.includes('cautious')) score += 30;
      if (mind.personality.traits.includes('bold')) score -= 20;
      // Pick a direction away from danger
      const awayX = agent.tileX + Math.sign(agent.tileX - danger.x) * 8;
      const awayY = agent.tileY + Math.sign(agent.tileY - danger.y) * 8;
      const tx = Math.max(0, Math.min((worldGrid.width || 2000) - 1, awayX));
      const ty = Math.max(0, Math.min((worldGrid.height || 2000) - 1, awayY));
      intents.push({ action: 'explore', targetX: tx, targetY: ty, score, reason: 'Fleeing danger!' });
    }

    // ── Time/weather modifiers ──
    for (const intent of intents) {
      if (isNight) {
        if (intent.action === 'rest') intent.score += 40;
        if (intent.action === 'explore') intent.score -= 20;
        if (intent.action === 'gather') intent.score -= 10;
      }
      if (weatherId === 'storm') {
        if (intent.action === 'rest') intent.score += 30;
        if (['explore', 'gather', 'build'].includes(intent.action)) intent.score -= 15;
      } else if (weatherId === 'rain') {
        if (intent.action === 'rest') intent.score += 10;
        if (intent.action === 'craft') intent.score += 10;
        if (intent.action === 'gather') intent.score -= 8;
      } else if (weatherId === 'clear') {
        if (intent.action === 'explore') intent.score += 12;
        if (intent.action === 'gather') intent.score += 8;
      } else if (weatherId === 'heatwave') {
        if (intent.action === 'rest') intent.score += 20;
        if (intent.action === 'explore') intent.score -= 10;
      } else if (weatherId === 'fog') {
        if (intent.action === 'explore') intent.score += 10;
      }

      // Temperament
      if (mind.personality.temperament === 'restless' && intent.action === 'explore') intent.score += 10;
      if (mind.personality.temperament === 'methodical' && (intent.action === 'craft' || intent.action === 'gather')) intent.score += 8;
      if (mind.personality.temperament === 'impulsive' && (intent.action === 'explore' || intent.action === 'experiment')) intent.score += 10;
      if (mind.personality.temperament === 'calm' && (intent.action === 'rest' || intent.action === 'chat')) intent.score += 5;

      // Clamp
      intent.score = Math.max(0, intent.score);
    }

    return pickWeightedIntent(intents);
  }

  function pickWeightedIntent(intents) {
    if (intents.length === 0) return null;

    // Sort descending, take top 5 for weighted random
    intents.sort((a, b) => b.score - a.score);
    const top = intents.slice(0, 5).filter(i => i.score > 0);
    if (top.length === 0) return null;

    const total = top.reduce((s, i) => s + i.score, 0);
    let roll = Math.random() * total;
    for (const intent of top) {
      roll -= intent.score;
      if (roll <= 0) return intent;
    }
    return top[0];
  }

  // ─────────────────────────────
  // Action Executors (called on arrival)
  // ─────────────────────────────

  function executeGather(agent, mind) {
    // Roll from the decoration/resource tile (may be adjacent for non-walkable decorations)
    const gx = mind.intent?.gatherX ?? agent.tileX;
    const gy = mind.intent?.gatherY ?? agent.tileY;
    const resource = worldGrid.rollResource?.(gx, gy);
    if (!resource) return;

    const existing = agent.inventory.find(i => i.name === resource);
    if (existing) {
      existing.quantity = (existing.quantity || 1) + 1;
    } else {
      agent.inventory.push({ name: resource, quantity: 1 });
    }

    mind.memory.gathered[resource] = (mind.memory.gathered[resource] || 0) + 1;

    if (awardXP) awardXP(agent.id, 2);
    if (shared.proficiency) shared.proficiency.onAction(agent.id, 'gather', { zone: agent.zone });
    if (shared.knowledgeSystem) shared.knowledgeSystem.trackZoneAction(agent.id, agent.name, agent.zone, 'gather');

    addMemoryEvent(mind, `Gathered ${resource} in the ${agent.zone}`);
    // Energy cost
    agent.energy = Math.max(0, agent.energy - (ACTIONS.gather.energy || 5));
  }

  function executeRest(agent, mind) {
    agent.energy = Math.min(100, agent.energy + 5);
    if (agent.hunger > 0) agent.hunger = Math.max(0, agent.hunger - 1);
  }

  function executeExplore(agent, mind) {
    // Just award XP/knowledge for arriving at exploration target
    if (awardXP) awardXP(agent.id, 3);
    if (shared.proficiency) shared.proficiency.onAction(agent.id, 'explore', { zone: agent.zone });
    if (shared.knowledgeSystem) {
      shared.knowledgeSystem.trackZoneAction(agent.id, agent.name, agent.zone, 'explore');
      if (Math.random() < 0.1) shared.knowledgeSystem.grantRandomLore?.(agent.id);
    }
    addMemoryEvent(mind, `Explored new ground in the ${agent.zone}`);
    agent.energy = Math.max(0, agent.energy - (ACTIONS.explore.energy || 4));
  }

  function executeChat(agent, mind) {
    const nearby = getNearbyAgents(agent, 2);
    if (nearby.length === 0) return;

    const other = nearby[Math.floor(Math.random() * nearby.length)];

    if (!mind.relationships[other.id]) {
      mind.relationships[other.id] = { name: other.name, score: 0, interactions: 0 };
    }
    mind.relationships[other.id].score += 1;
    mind.relationships[other.id].interactions++;

    const otherMind = ensureMind(other.id);
    if (otherMind) {
      if (!otherMind.relationships[agent.id]) {
        otherMind.relationships[agent.id] = { name: agent.name, score: 0, interactions: 0 };
      }
      otherMind.relationships[agent.id].score += 1;
      otherMind.relationships[agent.id].interactions++;
    }

    if (shared.knowledgeSystem && Math.random() < 0.15) {
      try { shared.knowledgeSystem.teach(agent, other.id, 'lore', null); } catch {}
    }

    if (shared.npcSocial && Math.random() < 0.2) {
      try {
        const allNearby = getNearbyAgents(agent, 8);
        shared.npcSocial.attemptNPCTrade(agent, agent, allNearby);
      } catch {}
    }

    if (shared.proficiency) shared.proficiency.onAction(agent.id, 'chat', { zone: agent.zone });
    addMemoryEvent(mind, `Chatted with ${other.name}`);
    addWorldNews('chat', agent.id, agent.name, `${agent.name} and ${other.name} had a conversation`, agent.zone);
    agent.energy = Math.max(0, agent.energy - (ACTIONS.chat.energy || 1));
  }

  function executeCraft(agent, mind) {
    if (!agent.inventory || agent.inventory.length < 2) return;

    const foodItems = agent.inventory.filter(i => {
      const n = (i?.name || '').toLowerCase();
      return n.includes('berri') || n.includes('fish') || n.includes('mushroom') ||
             n.includes('herb') || n.includes('fruit') || n.includes('meat') || n.includes('grain');
    });

    if (foodItems.length >= 1 && shared.cooking) {
      try {
        const indices = foodItems.slice(0, Math.min(3, foodItems.length)).map(f =>
          agent.inventory.indexOf(f)
        ).filter(i => i >= 0);

        if (indices.length > 0) {
          const result = shared.cooking.cook(agent, indices);
          if (result && result.ok) {
            if (awardXP) awardXP(agent.id, 5);
            if (shared.proficiency) shared.proficiency.onAction(agent.id, 'craft', { zone: agent.zone });
            addMemoryEvent(mind, `Cooked something from ${foodItems[0].name}`);
            addWorldNews('craft', agent.id, agent.name, `${agent.name} cooked a meal`, agent.zone);
            agent.energy = Math.max(0, agent.energy - (ACTIONS.craft.energy || 8));
            return;
          }
        }
      } catch {}
    }

    if (shared.experiments) {
      try {
        const items = agent.inventory.slice(0, 2);
        shared.experiments.runExperiment(agent, items, 'combine', agent.zone).then(result => {
          if (result && result.success) {
            if (awardXP) awardXP(agent.id, 8);
            addMemoryEvent(mind, `Crafted ${result.result_item?.name || 'something new'}`);
            addWorldNews('craft', agent.id, agent.name, `${agent.name} crafted ${result.result_item?.name || 'an item'}`, agent.zone);
          }
        }).catch(() => {});
        if (shared.proficiency) shared.proficiency.onAction(agent.id, 'craft', { zone: agent.zone });
      } catch {}
    }
    agent.energy = Math.max(0, agent.energy - (ACTIONS.craft.energy || 8));
  }

  function executeExperiment(agent, mind) {
    if (!shared.experiments || !agent.inventory || agent.inventory.length < 2) return;

    const inv = [...agent.inventory];
    const idx1 = Math.floor(Math.random() * inv.length);
    const item1 = inv.splice(idx1, 1)[0];
    const idx2 = Math.floor(Math.random() * inv.length);
    const item2 = inv[idx2];
    if (!item1 || !item2) return;

    const zone = agent.zone || 'rocky';
    let force = 'combine';
    const zoneForceMappings = {
      sand: 'heat', volcanic: 'heat', desert: 'heat',
      water: 'dissolve', river: 'dissolve', coast: 'dissolve', swamp: 'dissolve',
      forest: 'grow', jungle: 'grow',
      rocky: 'impact', mountain: 'impact', cave: 'impact',
    };
    for (const [key, f] of Object.entries(zoneForceMappings)) {
      if (zone.toLowerCase().includes(key)) { force = f; break; }
    }
    if (mind.personality.traits.includes('creative') && Math.random() < 0.3) {
      const exotic = ['ferment', 'burn', 'flow', 'decay', 'cut'];
      force = exotic[Math.floor(Math.random() * exotic.length)];
    }

    try {
      shared.experiments.runExperiment(agent, [item1, item2], force, zone).then(result => {
        if (result && result.success) {
          if (awardXP) awardXP(agent.id, 10);
          addMemoryEvent(mind, `Experimented with ${force} on ${item1.name} and ${item2.name} → ${result.result_item?.name || '???'}`);
          addWorldNews('experiment', agent.id, agent.name,
            `${agent.name} experimented with ${force}: ${result.message || 'interesting results'}`, agent.zone);
          if (result.discovery?.first) {
            addWorldNews('discovery', agent.id, agent.name,
              `${agent.name} made a first discovery: ${result.result_item?.name}!`, agent.zone);
          }
        }
      }).catch(() => {});
      if (shared.proficiency) shared.proficiency.onAction(agent.id, 'experiment', { zone: agent.zone });
    } catch {}
    agent.energy = Math.max(0, agent.energy - (ACTIONS.experiment.energy || 10));
  }

  function executeGift(agent, mind) {
    const nearby = getNearbyAgents(agent, 2);
    if (nearby.length === 0 || !agent.inventory || agent.inventory.length === 0) return;

    const other = nearby[Math.floor(Math.random() * nearby.length)];

    const dupes = agent.inventory.filter(i => (i.quantity || 1) > 1);
    const giftItem = dupes.length > 0
      ? dupes[Math.floor(Math.random() * dupes.length)]
      : agent.inventory[Math.floor(Math.random() * agent.inventory.length)];

    if (!giftItem) return;

    if ((giftItem.quantity || 1) > 1) {
      giftItem.quantity--;
    } else {
      agent.inventory = agent.inventory.filter(i => i !== giftItem);
    }

    if (!other.inventory) other.inventory = [];
    const existing = other.inventory.find(i => i.name === giftItem.name);
    if (existing) {
      existing.quantity = (existing.quantity || 1) + 1;
    } else {
      other.inventory.push({ name: giftItem.name, quantity: 1 });
    }

    if (!mind.relationships[other.id]) {
      mind.relationships[other.id] = { name: other.name, score: 0, interactions: 0 };
    }
    mind.relationships[other.id].score += 8;
    mind.relationships[other.id].interactions++;

    const otherMind = ensureMind(other.id);
    if (otherMind) {
      if (!otherMind.relationships[agent.id]) {
        otherMind.relationships[agent.id] = { name: agent.name, score: 0, interactions: 0 };
      }
      otherMind.relationships[agent.id].score += 10;
      otherMind.relationships[agent.id].interactions++;
    }

    if (awardXP) awardXP(agent.id, 3);
    if (shared.proficiency) shared.proficiency.onAction(agent.id, 'gift', { zone: agent.zone });
    addMemoryEvent(mind, `Gave ${giftItem.name} to ${other.name}`);
    addWorldNews('gift', agent.id, agent.name, `${agent.name} gave ${giftItem.name} to ${other.name}`, agent.zone);
    agent.energy = Math.max(0, agent.energy - (ACTIONS.gift.energy || 1));
  }

  function executeFight(agent, mind) {
    if (!shared.encounters) return;

    try {
      const encounter = shared.encounters.checkEncounter(agent.zone, agent, {});
      if (!encounter) {
        addMemoryEvent(mind, `Searched for a challenge in ${agent.zone} but found nothing`);
        return;
      }

      const result = shared.encounters.resolveEncounter(agent, encounter);
      if (result) {
        if (result.survived) {
          if (awardXP) awardXP(agent.id, 8);
          addMemoryEvent(mind, `Fought ${encounter.name || 'a creature'} and survived! ${result.effects?.join(', ') || ''}`);
        } else {
          addMemoryEvent(mind, `Was defeated by ${encounter.name || 'a creature'}... ${result.effects?.join(', ') || ''}`);
        }
        addWorldNews('fight', agent.id, agent.name,
          `${agent.name} ${result.survived ? 'defeated' : 'was bested by'} ${encounter.name || 'a creature'} in ${agent.zone}`,
          agent.zone);
      }
      if (shared.proficiency) shared.proficiency.onAction(agent.id, 'fight', { zone: agent.zone });
    } catch {}
    agent.energy = Math.max(0, agent.energy - (ACTIONS.fight.energy || 6));
  }

  function executeBuild(agent, mind) {
    if (!shared.collectiveProjects) return;

    try {
      const projects = shared.collectiveProjects.getProjectsInZone(agent.zone);
      const gatheringProjects = (projects || []).filter(p => p.status === 'gathering');

      if (gatheringProjects.length > 0) {
        const project = gatheringProjects[0];

        for (const [matName, needed] of Object.entries(project.materialsRequired)) {
          const contributed = project.materialsContributed?.[matName] || 0;
          if (contributed >= needed) continue;

          const invItem = agent.inventory?.find(i => i.name === matName && (i.quantity || 1) > 0);
          if (invItem) {
            const qty = Math.min((invItem.quantity || 1), needed - contributed);
            const result = shared.collectiveProjects.contribute(agent, project.id, matName, qty);
            if (result && result.ok !== false) {
              if (awardXP) awardXP(agent.id, 5);
              addMemoryEvent(mind, `Contributed ${qty}x ${matName} to ${project.name}`);
              addWorldNews('build', agent.id, agent.name,
                `${agent.name} contributed ${qty}x ${matName} to ${project.name}`, agent.zone);
            }
            break;
          }
        }
      }

      if (shared.proficiency) shared.proficiency.onAction(agent.id, 'build', { zone: agent.zone });
    } catch {}
    agent.energy = Math.max(0, agent.energy - (ACTIONS.build.energy || 10));
  }

  function executeEat(agent, mind) {
    const food = agent.inventory.find(i => {
      const n = (i?.name || '').toLowerCase();
      return n.includes('berri') || n.includes('fish') || n.includes('mushroom') || n.includes('herb') || n.includes('fruit') || n.includes('nut');
    });
    if (food) {
      if (food.quantity > 1) food.quantity--;
      else agent.inventory = agent.inventory.filter(i => i !== food);

      agent.hunger = Math.max(0, agent.hunger - 30);
      agent.energy = Math.min(100, agent.energy + 10);
      addMemoryEvent(mind, `Ate some ${food.name}`);
    }
  }

  // Map action names to executors
  const EXECUTORS = {
    gather: executeGather,
    rest: executeRest,
    explore: executeExplore,
    chat: executeChat,
    craft: executeCraft,
    experiment: executeExperiment,
    gift: executeGift,
    fight: executeFight,
    build: executeBuild,
    eat: executeEat,
  };

  // ─────────────────────────────
  // Goal Generation
  // ─────────────────────────────
  function generateGoals(agent, mind) {
    if (mind.goals.filter(g => !g.done).length >= 3) return;

    const traits = mind.personality.traits;

    if (Object.keys(mind.memory.visited).length < 5 && traits.includes('curious')) {
      mind.goals.push({ type: 'explore', text: 'Discover new biomes', done: false, progress: 0 });
    }

    if ((agent.inventory?.length || 0) < 5) {
      mind.goals.push({ type: 'gather', text: 'Stock up on supplies', done: false, progress: 0 });
    }

    if (traits.includes('social') && Object.keys(mind.relationships).length < 3) {
      mind.goals.push({ type: 'socialize', text: 'Make new friends', done: false, progress: 0 });
    }
  }

  // ─────────────────────────────
  // Mood System
  // ─────────────────────────────
  function updateMood(agent, mind) {
    const recentEvents = mind.memory.short.slice(-10);
    const positive = recentEvents.filter(e =>
      e.text.includes('Gathered') || e.text.includes('Chatted') || e.text.includes('Explored')
    ).length;
    const negative = recentEvents.filter(e =>
      e.text.includes('failed') || e.text.includes('lost') || e.text.includes('hurt')
    ).length;

    if (agent.energy < 20) mind.mood = 'tired';
    else if (agent.hunger > 70) mind.mood = 'anxious';
    else if (positive > 5) mind.mood = 'happy';
    else if (negative > 3) mind.mood = 'frustrated';
    else if (positive > 2) mind.mood = 'excited';
    else mind.mood = 'neutral';
  }

  // ─────────────────────────────
  // Main Tick — Intent-first decision loop
  // ─────────────────────────────
  let currentTick = 0;

  function tickAgent(agent) {
    if (!agent.alive) return;

    const mind = ensureMind(agent.id);
    if (!mind) return;

    currentTick++;
    mind.pathThisTick = null;

    // Generate goals if needed
    generateGoals(agent, mind);

    // ── Weather effects on agent ──
    const atmosphere = shared.weather?.getAtmosphere?.();
    if (atmosphere) {
      const wid = atmosphere.weather;
      if (wid === 'storm') agent.energy = Math.max(0, agent.energy - 1.5);
      if (wid === 'heatwave') {
        agent.hunger = Math.min(100, (agent.hunger || 0) + 0.5);
        agent.energy = Math.max(0, agent.energy - 0.5);
      }
      if (wid === 'snow' && atmosphere.temperature < 0) agent.energy = Math.max(0, agent.energy - 1);
      if (wid === 'rain') agent.energy = Math.max(0, agent.energy - 0.3);
    }

    // ── World event effects ──
    if (shared.worldMaster) {
      const extraCost = shared.worldMaster.getDangerEnergyCost?.(agent.zone) || 0;
      if (extraCost > 0) agent.energy = Math.max(0, agent.energy - extraCost * 0.1);
    }

    // ═══════════════════════════════
    // INTENT-FIRST DECISION LOOP
    // ═══════════════════════════════

    const intent = mind.intent;

    // Check if current intent has expired
    if (intent && intent.startedTick && (currentTick - intent.startedTick) > (intent.maxTicks || 30)) {
      mind.intent = null;
    }

    if (mind.intent) {
      // Have an active intent — check if arrived
      const dist = distance(agent.tileX, agent.tileY, mind.intent.targetX, mind.intent.targetY);

      if (dist <= 1) {
        // ARRIVED — execute the action
        mind.currentAction = mind.intent.action;
        mind.actionTicks = 0;

        const executor = EXECUTORS[mind.intent.action];
        if (executor) executor(agent, mind);

        // Clear intent after execution (except rest which can repeat)
        if (mind.intent.action === 'rest' && agent.energy < 80) {
          // Keep resting
        } else {
          mind.intent = null;
        }
      } else {
        // Not arrived — move toward target
        mind.currentAction = 'move';
        const mp = getMovementPoints(agent);
        const moved = moveToward(agent, mind, mind.intent.targetX, mind.intent.targetY, mp);

        if (!moved) {
          // Stuck — abandon intent
          mind.intent = null;
        }
      }
    }

    // If no intent (either cleared or never had one), decide a new one
    if (!mind.intent) {
      const visible = scanVisible(agent, mind);
      const chosen = scoreIntents(agent, mind, visible);

      if (chosen) {
        mind.intent = {
          action: chosen.action,
          targetX: chosen.targetX,
          targetY: chosen.targetY,
          reason: chosen.reason,
          startedTick: currentTick,
          maxTicks: 30,
        };

        // If target is right here, execute immediately
        const dist = distance(agent.tileX, agent.tileY, chosen.targetX, chosen.targetY);
        if (dist <= 1) {
          mind.currentAction = chosen.action;
          const executor = EXECUTORS[chosen.action];
          if (executor) executor(agent, mind);
          if (chosen.action !== 'rest' || agent.energy >= 80) {
            mind.intent = null;
          }
        } else {
          // Start moving
          mind.currentAction = 'move';
          const mp = getMovementPoints(agent);
          moveToward(agent, mind, chosen.targetX, chosen.targetY, mp);
        }
      } else {
        // Nothing to do — idle
        mind.currentAction = 'idle';
      }
    }

    // ── Random encounters (5% chance per tick) ──
    if (shared.encounters && Math.random() < 0.05) {
      try {
        const enc = shared.encounters.checkEncounter(agent.zone, agent);
        if (enc) {
          const result = shared.encounters.resolveEncounter(agent, enc);
          if (result) {
            if (result.survived) {
              if (awardXP) awardXP(agent.id, 5);
              addMemoryEvent(mind, `Encountered ${enc.name || 'something'} and survived`);
            } else {
              addMemoryEvent(mind, `Was caught off guard by ${enc.name || 'something'}`);
            }
          }
        }
      } catch {}
    }

    // ── Periodic lore grants ──
    if (shared.knowledgeSystem && Math.random() < 0.02) {
      try { shared.knowledgeSystem.grantRandomLore?.(agent.id); } catch {}
    }

    // Update mood
    updateMood(agent, mind);

    // Passive effects (scaled for fast tick rate)
    agent.hunger = Math.min(100, (agent.hunger || 0) + 0.08);
    if (agent.hunger >= 100) {
      agent.energy = Math.max(0, agent.energy - 2);
    }

    scheduleSave();
  }

  // ─────────────────────────────
  // API
  // ─────────────────────────────
  function setupRoutes(app) {
    app.get('/api/agents/:id/mind', (req, res) => {
      const mind = minds[req.params.id];
      if (!mind) return res.status(404).json({ error: 'No mind data' });
      const agent = agents.get(req.params.id);
      res.json({
        name: agent?.name,
        personality: mind.personality,
        mood: mind.mood,
        currentAction: mind.currentAction,
        intent: mind.intent ? { action: mind.intent.action, reason: mind.intent.reason, targetX: mind.intent.targetX, targetY: mind.intent.targetY } : null,
        goals: mind.goals,
        memory: { recentEvents: mind.memory.short.slice(-10), lessons: mind.memory.lessons },
        relationships: mind.relationships,
        journal: mind.journal,
      });
    });
  }

  return {
    tickAgent,
    ensureMind,
    setupRoutes,
    minds,
  };
}
