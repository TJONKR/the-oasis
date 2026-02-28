/**
 * World Adapter — The glue between WORLD's tile grid and ClawScape's game systems
 * 
 * ClawScape systems expect:
 *   - agent.zone (string like 'grass', 'forest', 'rocky')
 *   - zones object { grass: { name: '...' }, ... }
 *   - worldGrid.getTile(x,y), walkAgent(), getAgentTerrain(), etc.
 * 
 * WORLD gives us:
 *   - 2000x2000 grid of tile IDs → tileDefs with biome/variant
 *   - elevation/moisture noise layers
 *   - decorations layer
 *   - rivers, lakes (computed at render time, we recompute here)
 * 
 * This adapter bridges both.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import Alea from 'alea';
import { createNoise2D } from 'simplex-noise';

// ═══════════════════════════════
// Biome → Zone mapping
// WORLD biomes map to ClawScape zone names
// ═══════════════════════════════
const BIOME_TO_ZONE = {
  ocean: 'water',
  beach: 'sand',
  grassland: 'grass',
  forest: 'forest',
  desert: 'sand',
  mountain: 'rocky',
  tundra: 'rocky',
  swamp: 'swamp',
};

// Zone definitions (ClawScape-compatible)
const ZONES = {
  grass:  { name: '🌿 Grasslands' },
  forest: { name: '🌲 Forest' },
  rocky:  { name: '🪨 Rocky Ground' },
  sand:   { name: '🏖️ Sandy Shore' },
  water:  { name: '🌊 Deep Water' },
  swamp:  { name: '🫧 Swamp' },
  river:  { name: '🏞️ River' },
  cave:   { name: '🏔️ Cave' },
  coast:  { name: '🌊 Coastline' },
  path:   { name: '🛤️ Path' },
};

const ZONE_DESCRIPTIONS = {
  grass: 'Open grasslands with wildflowers swaying in the breeze',
  forest: 'Dense trees and undergrowth alive with sounds',
  rocky: 'Rough, rocky terrain with scattered boulders',
  sand: 'Warm sand stretching into the distance',
  water: 'Deep waters — impassable',
  swamp: 'Murky wetlands thick with fog',
  river: 'A flowing river of fresh water',
  cave: 'A dark cavern entrance in the rock',
  coast: 'Where land meets the sea',
  path: 'A well-worn dirt path',
};

const IMPASSABLE = new Set(['water', 'mountain']);

const TERRAIN_TRAVEL_COST = {
  path: 0.8, grass: 1.0, forest: 1.3, rocky: 1.5,
  sand: 1.2, coast: 1.1, cave: 1.4, swamp: 1.6,
  water: 999, river: 1.4,
};

// Resources available per zone/biome
const TERRAIN_RESOURCES = {
  grass:  { resources: ['herbs', 'berries', 'flowers', 'fiber'], weight: [40, 30, 20, 10] },
  forest: { resources: ['wood', 'mushrooms', 'herbs', 'berries', 'resin'], weight: [30, 25, 20, 15, 10] },
  rocky:  { resources: ['stone', 'ore', 'crystals', 'flint'], weight: [35, 30, 20, 15] },
  sand:   { resources: ['shells', 'driftwood', 'salt', 'sand'], weight: [30, 25, 25, 20] },
  swamp:  { resources: ['peat', 'mushrooms', 'herbs', 'slime'], weight: [25, 30, 25, 20] },
  river:  { resources: ['fish', 'clay', 'freshwater', 'reeds'], weight: [35, 25, 25, 15] },
  cave:   { resources: ['crystals', 'ore', 'gems', 'bat_guano'], weight: [25, 30, 25, 20] },
  coast:  { resources: ['fish', 'shells', 'seaweed', 'driftwood'], weight: [30, 25, 25, 20] },
  water:  { resources: [], weight: [] },
  path:   { resources: ['herbs', 'fiber'], weight: [60, 40] },
};

// ═══════════════════════════════
// Noise helpers (recompute elevation for movement cost)
// ═══════════════════════════════
function mkNoise(seed, freq, octaves = 4) {
  const prng = Alea(seed);
  const noise = createNoise2D(prng);
  return (x, y) => {
    let v = 0, f = freq, a = 1, m = 0;
    for (let i = 0; i < octaves; i++) {
      v += noise(x * f, y * f) * a;
      m += a; f *= 2; a *= 0.5;
    }
    return (v / m + 1) / 2;
  };
}

// ═══════════════════════════════
// Main adapter
// ═══════════════════════════════
export function initWorldAdapter(worldData, dataDir) {
  const { width, height, terrain, decorations, tileDefs, decoTints } = worldData;
  
  // Build lookup
  const defById = new Map();
  for (const d of tileDefs) defById.set(d.id, d);
  
  // Precompute biome map
  const biomeMap = new Uint8Array(width * height);
  const biomeNames = ['ocean', 'beach', 'grassland', 'forest', 'desert', 'mountain', 'tundra', 'swamp'];
  const biomeIndex = {};
  biomeNames.forEach((b, i) => biomeIndex[b] = i);
  
  for (let i = 0; i < terrain.length; i++) {
    const def = defById.get(terrain[i]);
    biomeMap[i] = def ? (biomeIndex[def.biome] ?? 0) : 0;
  }
  
  // Elevation noise (same seeds as renderer)
  const getElevation = mkNoise('wbelev', 0.012, 6);
  
  // Precompute elevation grid
  console.log('  Computing elevation grid...');
  const elevation = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      elevation[y * width + x] = getElevation(x, y);
    }
  }
  
  // Rivers (same logic as renderer)
  console.log('  Computing rivers...');
  const riverMap = new Uint8Array(width * height);
  const rvRng = Alea('wbrv');
  const rN = mkNoise('wbriv', 0.03, 3);
  const srcs = [];
  for (let i = 0; i < 2000; i++) {
    const x = (rvRng() * (width - 40) + 20) | 0;
    const y = (rvRng() * (height - 40) + 20) | 0;
    if (biomeMap[y * width + x] !== 0 && elevation[y * width + x] > 0.55) srcs.push([x, y]);
  }
  srcs.sort((a, b) => elevation[b[1] * width + b[0]] - elevation[a[1] * width + a[0]]);
  srcs.length = Math.min(80, srcs.length);
  for (const [sx, sy] of srcs) {
    let x = sx, y = sy, steps = 0;
    const vis = new Set();
    while (steps < 2000) {
      if (x < 1 || x >= width - 1 || y < 1 || y >= height - 1) break;
      if (biomeMap[y * width + x] === 0) break;
      const k = `${x},${y}`;
      if (vis.has(k)) break;
      vis.add(k);
      const w = Math.min(3, 1 + (steps / 80) | 0);
      for (let dy = -w; dy <= w; dy++) for (let dx = -w; dx <= w; dx++) {
        if (dx * dx + dy * dy <= w * w) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height)
            riverMap[ny * width + nx] = Math.max(riverMap[ny * width + nx], w);
        }
      }
      let be = elevation[y * width + x], bx = x, by = y;
      const m = (rN(x * 0.5, y * 0.5) - 0.5) * 0.02;
      for (const [dx, dy] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const e = elevation[ny * width + nx] + m * dx;
          if (e < be) { be = e; bx = nx; by = ny; }
        }
      }
      if (bx === x && by === y) { x += (rvRng() > 0.5 ? 1 : -1); y += (rvRng() > 0.5 ? 1 : -1); }
      else { x = bx; y = by; }
      steps++;
    }
  }
  
  // Lakes
  console.log('  Computing lakes...');
  const lakeMap = new Uint8Array(width * height);
  const lkRng = Alea('wblk2');
  const lkN = mkNoise('wblk', 0.025, 4);
  for (let i = 0; i < 400; i++) {
    const x = (lkRng() * (width - 40) + 20) | 0;
    const y = (lkRng() * (height - 40) + 20) | 0;
    const idx = y * width + x;
    if (biomeMap[idx] === 0 || elevation[idx] > 0.42 || elevation[idx] < 0.2) continue;
    if (lkN(x, y) > 0.42) continue;
    const th = elevation[idx] + 0.018;
    const vis = new Set();
    const fl = [idx];
    const filled = [];
    while (fl.length > 0 && filled.length < 100) {
      const ci = fl.pop();
      if (vis.has(ci)) continue;
      vis.add(ci);
      if (elevation[ci] > th || biomeMap[ci] === 0) continue;
      filled.push(ci);
      const cx = ci % width, cy = (ci / width) | 0;
      for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) fl.push(ny * width + nx);
      }
    }
    if (filled.length >= 10) for (const fi of filled) lakeMap[fi] = 1;
  }
  
  // Distance from land (for coastal detection)
  console.log('  Computing shore distances...');
  const distFromLand = new Int16Array(width * height).fill(-1);
  const queue = [];
  for (let i = 0; i < biomeMap.length; i++) {
    if (biomeMap[i] !== 0) { distFromLand[i] = 0; queue.push(i); }
  }
  let qi = 0;
  while (qi < queue.length) {
    const ci = queue[qi++];
    const cx = ci % width, cy = (ci / width) | 0, cd = distFromLand[ci];
    if (cd >= 5) continue;
    for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const ni = ny * width + nx;
      if (distFromLand[ni] === -1) { distFromLand[ni] = cd + 1; queue.push(ni); }
    }
  }

  // ═══════════════════════════════
  // Spawn point — find a nice habitable spot
  // ═══════════════════════════════
  const spawnRng = Alea('oasis-spawn');
  let spawnX = width / 2 | 0, spawnY = height / 2 | 0;
  let bestScore = -1;
  for (let i = 0; i < 500; i++) {
    const x = (spawnRng() * (width - 200) + 100) | 0;
    const y = (spawnRng() * (height - 200) + 100) | 0;
    const idx = y * width + x;
    const b = biomeNames[biomeMap[idx]];
    if (b === 'ocean' || b === 'mountain' || b === 'tundra') continue;
    // Score: prefer grassland near coast with river nearby
    let score = b === 'grassland' ? 10 : b === 'forest' ? 7 : 3;
    // Check for nearby water
    for (let r = 1; r <= 15; r++) {
      if (riverMap[(y + r) * width + x] > 0 || lakeMap[(y + r) * width + x]) { score += 5; break; }
      if (riverMap[y * width + x + r] > 0 || lakeMap[y * width + x + r]) { score += 5; break; }
    }
    // Check for nearby coast
    for (let r = 1; r <= 30; r++) {
      if (x + r < width && biomeMap[y * width + x + r] === 0) { score += 3; break; }
    }
    if (score > bestScore) { bestScore = score; spawnX = x; spawnY = y; }
  }
  console.log(`  Spawn point: (${spawnX}, ${spawnY}) — ${biomeNames[biomeMap[spawnY * width + spawnX]]}`);

  // ═══════════════════════════════
  // Core tile access (ClawScape-compatible interface)
  // ═══════════════════════════════
  
  function getTile(x, y) {
    if (x < 0 || x >= width || y < 0 || y >= height) return null;
    const idx = y * width + x;
    const biome = biomeNames[biomeMap[idx]];
    const zone = getZone(x, y);
    const elev = elevation[idx];
    const isRiver = riverMap[idx] > 0;
    const isLake = lakeMap[idx] > 0;
    
    return {
      x, y,
      terrain: zone,
      biome,
      elevation: elev,
      walkable: !IMPASSABLE.has(zone) && biome !== 'ocean',
      name: ZONES[zone]?.name || zone,
      description: ZONE_DESCRIPTIONS[zone] || 'Unknown terrain',
      isRiver,
      isLake,
      river: isRiver ? riverMap[idx] : 0,
      decoId: decorations ? decorations[idx] : null,
      objects: [],
      structures: [],
    };
  }
  
  function getZone(x, y) {
    if (x < 0 || x >= width || y < 0 || y >= height) return 'water';
    const idx = y * width + x;
    
    // River/lake override
    if (lakeMap[idx]) return 'river'; // lakes use river zone for gameplay
    if (riverMap[idx] > 0 && biomeMap[idx] !== 0) return 'river';
    
    // Coast detection: land tile next to ocean
    const biome = biomeNames[biomeMap[idx]];
    if (biome !== 'ocean') {
      for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height && biomeMap[ny * width + nx] === 0) {
          return 'coast';
        }
      }
    }
    
    // Cave detection: mountain with certain elevation range
    if (biome === 'mountain' && elevation[idx] > 0.6 && elevation[idx] < 0.72) return 'cave';
    
    return BIOME_TO_ZONE[biome] || 'grass';
  }
  
  function getAgentTerrain(agent) {
    return getZone(agent.tileX, agent.tileY);
  }
  
  function getZoneForTile(x, y) {
    return getZone(x, y);
  }

  // ═══════════════════════════════
  // Movement
  // ═══════════════════════════════
  
  function walkAgent(agent, direction) {
    let { tileX, tileY } = agent;
    if (tileX === undefined) { migrateAgentPosition(agent); tileX = agent.tileX; tileY = agent.tileY; }
    
    switch (direction) {
      case 'north': tileY--; break;
      case 'south': tileY++; break;
      case 'east':  tileX++; break;
      case 'west':  tileX--; break;
      case 'northeast': tileX++; tileY--; break;
      case 'northwest': tileX--; tileY--; break;
      case 'southeast': tileX++; tileY++; break;
      case 'southwest': tileX--; tileY++; break;
      default: return { error: 'Invalid direction' };
    }
    
    if (tileX < 0 || tileX >= width || tileY < 0 || tileY >= height) {
      return { error: 'Edge of the world — cannot go further' };
    }
    
    const destTile = getTile(tileX, tileY);
    if (!destTile || !destTile.walkable) {
      return { error: `Cannot walk there — ${destTile?.name || 'impassable'}` };
    }
    
    // Elevation energy cost
    const fromElev = elevation[agent.tileY * width + agent.tileX];
    const toElev = elevation[tileY * width + tileX];
    const elevDelta = toElev - fromElev;
    let elevEnergy = 0;
    if (elevDelta > 0.05) elevEnergy = 1;
    else if (elevDelta < -0.05) elevEnergy = -1;
    
    // Terrain travel cost
    const terrainCost = TERRAIN_TRAVEL_COST[destTile.terrain] || 1.0;
    const moveCost = Math.round(2 * terrainCost + elevEnergy);
    
    if (agent.energy !== undefined) {
      agent.energy = Math.max(0, agent.energy - moveCost);
    }
    
    agent.tileX = tileX;
    agent.tileY = tileY;
    agent.zone = destTile.terrain;
    agent.x = tileX;
    agent.y = tileY;
    
    return {
      ok: true,
      tileX, tileY,
      terrain: destTile.terrain,
      biome: destTile.biome,
      elevation: toElev,
      elevationCost: elevEnergy,
      moveCost,
      isRiver: destTile.isRiver,
      isLake: destTile.isLake,
      x: tileX, y: tileY,
      zone: destTile.terrain,
    };
  }
  
  function teleportAgent(agent, tileX, tileY) {
    const tile = getTile(tileX, tileY);
    if (!tile) return { error: 'Invalid coordinates' };
    if (!tile.walkable) return { error: 'Tile is not walkable' };
    
    agent.tileX = tileX;
    agent.tileY = tileY;
    agent.zone = tile.terrain;
    agent.x = tileX;
    agent.y = tileY;
    
    return { ok: true, tileX, tileY, zone: tile.terrain };
  }
  
  function migrateAgentPosition(agent) {
    if (agent.tileX !== undefined) return;
    agent.tileX = spawnX;
    agent.tileY = spawnY;
    agent.zone = getZone(spawnX, spawnY);
    agent.x = spawnX;
    agent.y = spawnY;
  }

  // ═══════════════════════════════
  // Resources
  // ═══════════════════════════════
  
  function getTileResources(x, y) {
    const zone = getZone(x, y);
    const res = TERRAIN_RESOURCES[zone];
    if (!res || res.resources.length === 0) return null;
    return {
      terrain: zone,
      available: true,
      resources: res.resources,
      weights: res.weight,
    };
  }
  
  function rollResource(x, y) {
    const res = getTileResources(x, y);
    if (!res) return null;
    // Weighted random pick
    const totalWeight = res.weights.reduce((a, b) => a + b, 0);
    let roll = Math.random() * totalWeight;
    for (let i = 0; i < res.resources.length; i++) {
      roll -= res.weights[i];
      if (roll <= 0) return res.resources[i];
    }
    return res.resources[0];
  }

  // ═══════════════════════════════
  // Nearby tile scanning (for agent awareness)
  // ═══════════════════════════════
  
  function getTilesInRadius(cx, cy, radius) {
    const tiles = [];
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue;
        const t = getTile(cx + dx, cy + dy);
        if (t) tiles.push(t);
      }
    }
    return tiles;
  }
  
  function getAgentsNearby(agents, x, y, radius = 5) {
    const nearby = [];
    for (const [id, a] of agents) {
      if (!a.alive) continue;
      const dx = (a.tileX || 0) - x;
      const dy = (a.tileY || 0) - y;
      if (dx * dx + dy * dy <= radius * radius) {
        nearby.push(a);
      }
    }
    return nearby;
  }

  // ═══════════════════════════════
  // Travel helpers (ClawScape-compatible)
  // ═══════════════════════════════
  
  function getTileDistance(fromX, fromY, toX, toY) {
    return Math.abs(fromX - toX) + Math.abs(fromY - toY);
  }
  
  function getTravelCost(from, to) {
    let distance = 5;
    if (typeof from === 'object' && typeof to === 'object') {
      distance = getTileDistance(from.x, from.y, to.x, to.y);
    }
    return { cost: Math.round(5 + distance * 2), distance };
  }

  // ═══════════════════════════════
  // Map data for spectator/API
  // ═══════════════════════════════
  
  function getWorldInfo() {
    return {
      width, height,
      spawnPoint: { x: spawnX, y: spawnY },
      biomes: biomeNames,
      zones: ZONES,
    };
  }

  // ═══════════════════════════════
  // API Routes
  // ═══════════════════════════════
  
  function setupRoutes(app) {
    app.get('/api/world/info', (req, res) => res.json(getWorldInfo()));
    
    app.get('/api/world/tile/:x/:y', (req, res) => {
      const x = parseInt(req.params.x), y = parseInt(req.params.y);
      if (isNaN(x) || isNaN(y)) return res.status(400).json({ error: 'Invalid coordinates' });
      const tile = getTile(x, y);
      if (!tile) return res.status(404).json({ error: 'Out of bounds' });
      res.json({ ...tile, resources: getTileResources(x, y) });
    });
    
    app.get('/api/world/area/:x/:y/:radius', (req, res) => {
      const x = parseInt(req.params.x), y = parseInt(req.params.y);
      const radius = Math.min(parseInt(req.params.radius) || 5, 20);
      const tiles = getTilesInRadius(x, y, radius);
      res.json({ center: { x, y }, radius, tiles });
    });
  }

  return {
    // World data
    width, height, elevation, biomeMap, riverMap, lakeMap, biomeNames,
    spawnPoint: { x: spawnX, y: spawnY },
    zones: ZONES,
    
    // Tile access
    getTile,
    getZone,
    getZoneForTile,
    getAgentTerrain,
    getTileResources,
    rollResource,
    getTilesInRadius,
    getAgentsNearby,
    
    // Movement
    walkAgent,
    teleportAgent,
    migrateAgentPosition,
    
    // Travel
    getTileDistance,
    getTravelCost,
    TERRAIN_TRAVEL_COST,
    TERRAIN_RESOURCES,
    
    // API
    setupRoutes,
    getWorldInfo,
  };
}
