// World Physics Engine — Phase 2 Complete
// Handles: state of matter, fire propagation, water flow, time-based reactions,
// and continuous property transformation.
//
// This runs as a per-tick system alongside the simulation loop.

import { getAmbientTemp, addWorldFire, worldFires, tickFires, hasNearbyFire } from './temperature.js';
import { MATERIAL_PROPERTIES, getProperties } from './materials.js';

// ═══════════════════════════════════════
// 1. STATE OF MATTER
// ═══════════════════════════════════════

// Phase transition thresholds for common materials
const PHASE_TRANSITIONS = {
  // name → { melt: solid→liquid, boil: liquid→gas, freeze: liquid→solid }
  water:       { freeze: 0, melt: 0, boil: 100 },
  freshwater:  { freeze: 0, melt: 0, boil: 100 },
  ice:         { freeze: -999, melt: 0, boil: 100 },  // ice melts at 0
  resin:       { melt: 80, boil: 300 },
  ore:         { melt: 800, boil: 2800 },
  'Iron Ore':  { melt: 800, boil: 2800 },
  'Iron Ingot':{ melt: 1540, boil: 2860 },
  sand:        { melt: 600, boil: 2200 },  // becomes glass
  stone:       { melt: 1200, boil: 3000 },
  crystals:    { melt: 700, boil: 2000 },
  wax:         { melt: 60, boil: 250 },
  salt:        { melt: 801, boil: 1465 },
  'Raw Glass': { melt: 600, boil: 2200 },
};

// What materials transform into at each state
const STATE_TRANSFORMS = {
  // material → { liquid: newName, gas: newName, solid: newName }
  water:       { solid: 'ice', gas: 'steam' },
  freshwater:  { solid: 'ice', gas: 'steam' },
  ice:         { liquid: 'freshwater', gas: 'steam' },
  sand:        { liquid: 'Raw Glass' },
  ore:         { liquid: 'Molten Iron Ore' },
  'Iron Ore':  { liquid: 'Molten Iron Ore' },
  'Iron Ingot':{ liquid: 'Molten Iron' },
};

/**
 * Determine the state of matter for an item based on its temperature.
 */
function getMatterState(item) {
  const name = item.name;
  const temp = item.properties?.temperature ?? 20;
  const transitions = PHASE_TRANSITIONS[name];
  
  if (!transitions) {
    // Infer from properties
    const mp = item.properties?.melt_point || 0;
    if (mp > 0 && temp >= mp) return 'liquid';
    if (item.properties?.solubility >= 8 && item.properties?.hardness <= 1) return 'liquid';
    return 'solid';
  }
  
  if (transitions.boil && temp >= transitions.boil) return 'gas';
  if (transitions.melt && temp >= transitions.melt) return 'liquid';
  if (transitions.freeze && temp <= transitions.freeze) return 'solid';
  
  // Default based on material type
  if (name === 'ice') return 'solid';
  if (['water', 'freshwater'].includes(name)) return 'liquid';
  return 'solid';
}

/**
 * Check if an item should undergo a phase transition and transform it.
 * Returns { changed: bool, newItem?: obj, effect?: string }
 */
function checkPhaseTransition(item) {
  const currentState = item._state || 'solid';
  const newState = getMatterState(item);
  
  if (newState === currentState) return { changed: false };
  
  item._state = newState;
  
  const transforms = STATE_TRANSFORMS[item.name];
  if (transforms && transforms[newState]) {
    const newName = transforms[newState];
    const oldName = item.name;
    item.name = newName;
    
    // Update properties from the new material
    const newProps = getProperties(newName);
    if (newProps) {
      const temp = item.properties?.temperature ?? 20;
      item.properties = { ...newProps, temperature: temp };
    }
    
    return {
      changed: true,
      effect: newState === 'gas' ? 'steam' : newState === 'liquid' ? 'melt' : 'freeze',
      message: `${oldName} ${newState === 'gas' ? 'evaporated into' : newState === 'liquid' ? 'melted into' : 'froze into'} ${newName}`,
    };
  }
  
  return { changed: false };
}

// ═══════════════════════════════════════
// 2. FIRE PROPAGATION
// ═══════════════════════════════════════

// Flammable decoration IDs (trees, flowers, reeds)
const FLAMMABLE_DECOS = new Set([150, 151, 152, 155, 158]); // pine, oak, palm, flower, reed

/**
 * Tick fire propagation. Fires spread to adjacent tiles with flammable decorations.
 * Returns array of { tileX, tileY, type } for new fires and burned tiles.
 */
function tickFirePropagation(worldGrid, weatherData, tick) {
  const events = [];
  if (!worldGrid?.getDecoration) return events;
  
  // Only propagate every 4 ticks (2 seconds) to keep it manageable
  if (tick % 4 !== 0) return events;
  
  const windDir = (weatherData?.wind_direction ?? 180) * Math.PI / 180;
  const windSpeed = weatherData?.wind_speed ?? 5;
  const isRaining = weatherData?.condition === 'rain' || weatherData?.condition === 'storm';
  
  // Rain suppresses fire spread heavily
  if (isRaining) {
    // 80% chance rain extinguishes each fire
    for (const [key, fire] of worldFires) {
      if (Math.random() < 0.3) {
        fire.remainingTicks = Math.min(fire.remainingTicks, 5);
        events.push({ type: 'extinguish', tileX: fire.tileX, tileY: fire.tileY });
      }
    }
    return events;
  }
  
  const newFires = [];
  
  for (const [key, fire] of worldFires) {
    if (fire.heat < 50) continue; // weak fires don't spread
    
    // Check 8 adjacent tiles
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        
        const nx = fire.tileX + dx;
        const ny = fire.tileY + dy;
        const nkey = `${nx},${ny}`;
        
        // Don't spread to existing fires
        if (worldFires.has(nkey)) continue;
        
        const deco = worldGrid.getDecoration(nx, ny);
        if (!deco || !FLAMMABLE_DECOS.has(deco.id)) continue;
        
        // Spread probability based on wind direction alignment
        const toDx = dx, toDy = dy;
        const windDx = Math.sin(windDir), windDy = -Math.cos(windDir);
        const alignment = (toDx * windDx + toDy * windDy); // -1 to 1
        
        // Base spread chance: 3%, wind-boosted up to 12%
        let spreadChance = 0.03 + Math.max(0, alignment) * 0.09 * (windSpeed / 15);
        
        // Diagonal = lower chance
        if (dx !== 0 && dy !== 0) spreadChance *= 0.6;
        
        if (Math.random() < spreadChance) {
          newFires.push({ tileX: nx, tileY: ny, heat: fire.heat * 0.8, duration: 40 + Math.floor(Math.random() * 30) });
        }
      }
    }
  }
  
  // Cap new fires per tick to prevent runaway
  const maxNewFires = 3;
  for (const nf of newFires.slice(0, maxNewFires)) {
    addWorldFire(nf.tileX, nf.tileY, nf.heat, nf.duration, 'fire_spread');
    events.push({ type: 'fireSpread', tileX: nf.tileX, tileY: nf.tileY });
  }
  
  // Cap total world fires
  if (worldFires.size > 50) {
    // Remove oldest/weakest
    let weakest = null, weakestKey = null;
    for (const [k, f] of worldFires) {
      if (!weakest || f.heat < weakest.heat) { weakest = f; weakestKey = k; }
    }
    if (weakestKey) worldFires.delete(weakestKey);
  }
  
  return events;
}

// ═══════════════════════════════════════
// 3. WATER FLOW (simplified)
// ═══════════════════════════════════════

// Water pools on the map — when rain is heavy or agents pour water
const waterPools = new Map(); // "x,y" → { depth, flowDir }

/**
 * Tick water physics — pools flow downhill, evaporate in heat.
 */
function tickWater(worldGrid, weatherData, gameTime) {
  // Rain adds water to random tiles
  if (weatherData?.condition === 'rain' || weatherData?.condition === 'storm') {
    // We don't actually create pools everywhere — just track it conceptually
    // This affects ambient temperature and fire suppression
  }
  
  // Evaporation: remove pools in hot areas
  for (const [key, pool] of waterPools) {
    const [x, y] = key.split(',').map(Number);
    const zone = worldGrid?.getZone?.(x, y) || 'grass';
    if (zone === 'desert' || zone === 'sand') {
      pool.depth -= 0.1;
    }
    if (pool.depth <= 0) waterPools.delete(key);
  }
}

// ═══════════════════════════════════════
// 4. TIME-BASED REACTIONS
// ═══════════════════════════════════════

// Items can have ongoing reactions that progress each tick
// item._reaction = { type, progress, target, startTick }

const TIMED_REACTIONS = {
  fermentation: {
    duration: 60, // ticks (~30 seconds)
    // Only ferment raw organic items in swamp/wet zones — needs moisture
    check: (item, ambientTemp, nearFire, isWet) => {
      if (item._reacted) return false; // already transformed once
      if (!isWet) return false; // needs wet environment
      return (item.properties?.organic ?? 0) >= 0.5 && (item.properties?.solubility ?? 0) >= 2;
    },
    result: (item) => ({
      name: `Fermented ${item.name}`,
      propOverrides: { toxicity: 1, energy: 18, decay_rate: 0.05 },
    }),
  },
  drying: {
    duration: 40, // ticks (~20 seconds)
    // Only in hot+dry biomes (desert, sand) with high temp
    check: (item, ambientTemp) => {
      if (item._reacted) return false;
      return ambientTemp > 35 && (item.properties?.organic ?? 0) >= 0.5 && (item.properties?.decay_rate ?? 0) > 0.15;
    },
    result: (item) => ({
      name: `Dried ${item.name}`,
      propOverrides: { weight: (item.properties?.weight ?? 1) * 0.5, decay_rate: 0.01, flammability: (item.properties?.flammability ?? 0) + 2 },
    }),
  },
  smoking: {
    duration: 80, // ticks (~40 seconds) — needs nearby fire
    check: (item, ambientTemp, nearFire) => {
      if (item._reacted) return false;
      return nearFire && (item.properties?.organic ?? 0) >= 0.5 && (item.properties?.decay_rate ?? 0) > 0.1;
    },
    result: (item) => ({
      name: `Smoked ${item.name}`,
      propOverrides: { decay_rate: 0.005, energy: (item.properties?.energy ?? 5) + 5, toxicity: 0 },
    }),
  },
  rusting: {
    duration: 200, // ticks (~100 seconds)
    check: (item, ambientTemp, nearFire, isWet) => {
      if (item._reacted) return false;
      return isWet && (item.properties?.conductivity ?? 0) >= 4 && (item.properties?.organic ?? 0) < 0.5;
    },
    result: (item) => ({
      name: `Rusted ${item.name}`,
      propOverrides: { hardness: Math.max(0, (item.properties?.hardness ?? 5) - 2), brittleness: (item.properties?.brittleness ?? 0) + 3 },
    }),
  },
};

/**
 * Tick time-based reactions for all items in an agent's inventory.
 * Returns array of { agentId, item, reaction, completed, message }
 */
function tickReactions(agent, ambientTemp, nearFire, isWet) {
  const results = [];
  if (!agent.inventory) return results;
  
  for (const item of agent.inventory) {
    // Check if item has an active reaction
    if (item._reaction) {
      item._reaction.progress++;
      const def = TIMED_REACTIONS[item._reaction.type];
      if (def && item._reaction.progress >= def.duration) {
        // Reaction complete!
        const reactionType = item._reaction.type;
        const result = def.result(item);
        const oldName = item.name;
        item.name = result.name;
        if (result.propOverrides && item.properties) {
          Object.assign(item.properties, result.propOverrides);
        }
        item._reacted = true; // prevent re-reaction
        delete item._reaction;
        results.push({
          agentId: agent.id,
          item,
          completed: true,
          message: `${oldName} has ${reactionType} into ${result.name}!`,
        });
      }
      continue;
    }
    
    // Check if any reaction should start
    for (const [type, def] of Object.entries(TIMED_REACTIONS)) {
      if (def.check(item, ambientTemp, nearFire, isWet)) {
        // Start reaction (only one at a time per item)
        item._reaction = { type, progress: 0 };
        break;
      }
    }
  }
  
  return results;
}

// ═══════════════════════════════════════
// 5. CONTINUOUS PROPERTY TRANSFORMATION
// ═══════════════════════════════════════

// Temperature thresholds for wood-like materials
const HEAT_STAGES = {
  // Below these temps: no change. At threshold: properties shift.
  wood: [
    { temp: 100, props: { decay_rate: 0.05 }, label: 'drying' },
    { temp: 150, props: { flammability: 8 }, label: 'smoking', effect: 'smoke' },
    { temp: 250, props: { flammability: 10, luminosity: 3, temperature: 300 }, label: 'igniting', effect: 'fire', transformTo: 'Burning Wood' },
    { temp: 400, props: { flammability: 2, organic: 0.5, luminosity: 0 }, label: 'charring', transformTo: 'Charcoal' },
    { temp: 600, props: { flammability: 0, organic: 0, weight: 0.1, fertility: 5 }, label: 'ashing', transformTo: 'Wood Ash' },
  ],
  bark: [
    { temp: 150, props: { flammability: 8 }, label: 'smoking' },
    { temp: 220, props: { luminosity: 2 }, label: 'igniting', effect: 'fire' },
    { temp: 400, props: {}, label: 'charring', transformTo: 'Charcoal' },
  ],
  resin: [
    { temp: 80, props: { malleability: 9, hardness: 0 }, label: 'softening' },
    { temp: 180, props: { luminosity: 3, flammability: 10 }, label: 'igniting', effect: 'fire', transformTo: 'Burning Resin' },
    { temp: 300, props: {}, label: 'vaporizing', transformTo: null }, // destroyed
  ],
  herbs: [
    { temp: 60, props: { energy: 12 }, label: 'warming' },
    { temp: 100, props: { solubility: 6, energy: 15 }, label: 'brewing', transformTo: 'Herbal Extract' },
    { temp: 160, props: { flammability: 6 }, label: 'burning', effect: 'fire' },
  ],
  fiber: [
    { temp: 100, props: { malleability: 9 }, label: 'softening' },
    { temp: 200, props: { luminosity: 2 }, label: 'igniting', effect: 'fire', transformTo: 'Burning Fiber' },
    { temp: 350, props: {}, label: 'ashing', transformTo: 'Ash' },
  ],
  mushrooms: [
    { temp: 60, props: { energy: 12 }, label: 'warming' },
    { temp: 100, props: { toxicity: 0, energy: 18 }, label: 'cooking', transformTo: 'Cooked Mushrooms' },
    { temp: 200, props: {}, label: 'charring', transformTo: 'Charred Remains' },
  ],
  fish: [
    { temp: 60, props: { energy: 15 }, label: 'warming' },
    { temp: 100, props: { toxicity: 0, energy: 25, decay_rate: 0.3 }, label: 'cooking', transformTo: 'Cooked Fish' },
    { temp: 250, props: {}, label: 'burning', transformTo: 'Charred Remains' },
  ],
  ore: [
    { temp: 400, props: { temperature: 400 }, label: 'glowing' },
    { temp: 800, props: { malleability: 8, hardness: 2 }, label: 'melting', effect: 'melt', transformTo: 'Molten Iron Ore' },
  ],
  crystals: [
    { temp: 300, props: { luminosity: 7, resonance: 9 }, label: 'resonating', effect: 'sparkle' },
    { temp: 700, props: { malleability: 6, hardness: 1 }, label: 'melting', effect: 'melt', transformTo: 'Molten Crystal' },
  ],
  sand: [
    { temp: 300, props: { temperature: 300 }, label: 'heating' },
    { temp: 600, props: { malleability: 8, hardness: 1, luminosity: 3 }, label: 'melting', effect: 'melt', transformTo: 'Molten Glass' },
  ],
  stone: [
    { temp: 600, props: { brittleness: 7 }, label: 'cracking' },
    { temp: 1200, props: { malleability: 6 }, label: 'melting', effect: 'melt', transformTo: 'Molten Stone' },
  ],
};

// Register transformed material properties
const TRANSFORMED_MATERIALS = {
  'Burning Wood':    { hardness: 3, conductivity: 1, flammability: 10, toxicity: 1, luminosity: 7, volatility: 2, organic: 1, weight: 2.5, decay_rate: 0.5, energy: 30, temperature: 300, resonance: 0, melt_point: 0, ignition: 0, sharpness: 0, solubility: 0, malleability: 2, brittleness: 4, fertility: 0 },
  'Burning Resin':   { hardness: 0, conductivity: 0, flammability: 10, toxicity: 2, luminosity: 6, volatility: 5, organic: 1, weight: 0.1, decay_rate: 0.8, energy: 20, temperature: 250, resonance: 0, melt_point: 0, ignition: 0, sharpness: 0, solubility: 0, malleability: 0, brittleness: 0, fertility: 0 },
  'Burning Fiber':   { hardness: 0, conductivity: 0, flammability: 10, toxicity: 0, luminosity: 4, volatility: 1, organic: 1, weight: 0.05, decay_rate: 0.9, energy: 8, temperature: 250, resonance: 0, melt_point: 0, ignition: 0, sharpness: 0, solubility: 0, malleability: 0, brittleness: 0, fertility: 0 },
  'Herbal Extract':  { hardness: 0, conductivity: 1, flammability: 2, toxicity: 0, luminosity: 1, volatility: 1, organic: 1, weight: 0.1, decay_rate: 0.3, energy: 20, temperature: 40, resonance: 2, melt_point: 0, ignition: 0, sharpness: 0, solubility: 8, malleability: 0, brittleness: 0, fertility: 2 },
  'Cooked Mushrooms':{ hardness: 0, conductivity: 0, flammability: 2, toxicity: 0, luminosity: 0, volatility: 0, organic: 1, weight: 0.1, decay_rate: 0.3, energy: 18, temperature: 60, resonance: 0, melt_point: 0, ignition: 0, sharpness: 0, solubility: 1, malleability: 0, brittleness: 0, fertility: 1 },
  'Cooked Fish':     { hardness: 1, conductivity: 0, flammability: 2, toxicity: 0, luminosity: 0, volatility: 0, organic: 1, weight: 0.8, decay_rate: 0.3, energy: 25, temperature: 60, resonance: 0, melt_point: 0, ignition: 0, sharpness: 0, solubility: 0, malleability: 1, brittleness: 2, fertility: 0 },
  'Charred Remains': { hardness: 1, conductivity: 0, flammability: 1, toxicity: 0, luminosity: 0, volatility: 0, organic: 0.5, weight: 0.2, decay_rate: 0.05, energy: 2, temperature: 80, resonance: 0, melt_point: 0, ignition: 0, sharpness: 0, solubility: 0, malleability: 0, brittleness: 6, fertility: 3 },
  'Wood Ash':        { hardness: 0, conductivity: 0, flammability: 0, toxicity: 0, luminosity: 0, volatility: 0, organic: 0.5, weight: 0.1, decay_rate: 0.01, energy: 1, temperature: 40, resonance: 0, melt_point: 0, ignition: 0, sharpness: 0, solubility: 3, malleability: 0, brittleness: 0, fertility: 6 },
  'Ash':             { hardness: 0, conductivity: 0, flammability: 0, toxicity: 0, luminosity: 0, volatility: 0, organic: 0.5, weight: 0.05, decay_rate: 0.01, energy: 0, temperature: 30, resonance: 0, melt_point: 0, ignition: 0, sharpness: 0, solubility: 2, malleability: 0, brittleness: 0, fertility: 5 },
  'Molten Iron Ore': { hardness: 1, conductivity: 7, flammability: 0, toxicity: 0, luminosity: 4, volatility: 0, organic: 0, weight: 12, decay_rate: 0, energy: 5, temperature: 900, resonance: 1, melt_point: 800, ignition: 0, sharpness: 0, solubility: 0, malleability: 9, brittleness: 0, fertility: 0 },
  'Molten Crystal':  { hardness: 1, conductivity: 9, flammability: 0, toxicity: 0, luminosity: 8, volatility: 2, organic: 0, weight: 1, decay_rate: 0, energy: 30, temperature: 800, resonance: 9, melt_point: 700, ignition: 0, sharpness: 0, solubility: 0, malleability: 8, brittleness: 0, fertility: 0 },
  'Molten Glass':    { hardness: 1, conductivity: 3, flammability: 0, toxicity: 0, luminosity: 5, volatility: 0, organic: 0, weight: 2, decay_rate: 0, energy: 3, temperature: 700, resonance: 2, melt_point: 600, ignition: 0, sharpness: 0, solubility: 0, malleability: 9, brittleness: 0, fertility: 0 },
  'Molten Stone':    { hardness: 1, conductivity: 2, flammability: 0, toxicity: 0, luminosity: 3, volatility: 0, organic: 0, weight: 8, decay_rate: 0, energy: 2, temperature: 1300, resonance: 1, melt_point: 1200, ignition: 0, sharpness: 0, solubility: 0, malleability: 7, brittleness: 0, fertility: 0 },
  'Molten Iron':     { hardness: 1, conductivity: 8, flammability: 0, toxicity: 0, luminosity: 5, volatility: 0, organic: 0, weight: 5, decay_rate: 0, energy: 3, temperature: 1600, resonance: 0, melt_point: 1540, ignition: 0, sharpness: 0, solubility: 0, malleability: 10, brittleness: 0, fertility: 0 },
  ice:               { hardness: 3, conductivity: 2, flammability: 0, toxicity: 0, luminosity: 1, volatility: 0, organic: 0, weight: 1, decay_rate: 0, energy: 0, temperature: -5, resonance: 0, melt_point: 0, ignition: 0, sharpness: 2, solubility: 10, malleability: 0, brittleness: 6, fertility: 0 },
  steam:             { hardness: 0, conductivity: 1, flammability: 0, toxicity: 0, luminosity: 0, volatility: 3, organic: 0, weight: 0, decay_rate: 0, energy: 2, temperature: 100, resonance: 0, melt_point: 0, ignition: 0, sharpness: 0, solubility: 10, malleability: 0, brittleness: 0, fertility: 0 },
};

/**
 * Apply continuous heat transformation to an item.
 * If the item's temperature crosses a threshold, its properties shift.
 * Returns { changed, effect, label, transformedTo } or null.
 */
function applyHeatTransform(item) {
  const stages = HEAT_STAGES[item.name];
  if (!stages) return null;
  
  const temp = item.properties?.temperature ?? 20;
  
  // Find the highest stage we've crossed
  let activeStage = null;
  for (const stage of stages) {
    if (temp >= stage.temp) activeStage = stage;
  }
  
  if (!activeStage) return null;
  
  // Check if we already applied this stage
  if (item._heatStage === activeStage.label) return null;
  item._heatStage = activeStage.label;
  
  // Apply property changes
  if (item.properties && activeStage.props) {
    Object.assign(item.properties, activeStage.props);
  }
  
  // Transform item name if specified
  if (activeStage.transformTo !== undefined) {
    if (activeStage.transformTo === null) {
      // Destroyed
      return { changed: true, destroyed: true, label: activeStage.label, effect: activeStage.effect };
    }
    const oldName = item.name;
    item.name = activeStage.transformTo;
    const newProps = TRANSFORMED_MATERIALS[activeStage.transformTo] || getProperties(activeStage.transformTo);
    if (newProps) {
      item.properties = { ...newProps, temperature: temp };
    }
    return {
      changed: true,
      label: activeStage.label,
      effect: activeStage.effect,
      transformedTo: activeStage.transformTo,
      message: `${oldName} → ${activeStage.transformTo} (${activeStage.label})`,
    };
  }
  
  return { changed: true, label: activeStage.label, effect: activeStage.effect };
}


// ═══════════════════════════════════════
// UNIFIED PHYSICS TICK
// ═══════════════════════════════════════

export function initWorldPhysics(shared) {
  const { broadcast, addWorldNews, worldGrid } = shared;
  
  // Register transformed material properties
  for (const [name, props] of Object.entries(TRANSFORMED_MATERIALS)) {
    if (!MATERIAL_PROPERTIES[name]) {
      MATERIAL_PROPERTIES[name] = props;
    }
  }
  console.log(`  🔬 Registered ${Object.keys(TRANSFORMED_MATERIALS).length} phase-transition materials`);
  
  /**
   * Per-agent physics tick — handles item transformations and reactions.
   */
  function tickAgent(agent, gameTime, weatherData) {
    if (!agent.alive || !agent.inventory) return;
    
    const ambientTemp = getAmbientTemp(agent.tileX, agent.tileY, {
      zone: agent.zone,
      hour: gameTime?.hour ?? 12,
      weather: weatherData?.condition ?? 'clear',
    });
    const nearFire = hasNearbyFire(agent.tileX, agent.tileY, 3);
    const isWet = weatherData?.condition === 'rain' || weatherData?.condition === 'storm' || agent.zone === 'swamp' || agent.zone === 'coast';
    
    // Items near fire get heated
    if (nearFire) {
      for (const item of agent.inventory) {
        if (item.properties && (item.properties.temperature || 20) < 200) {
          item.properties.temperature = (item.properties.temperature || 20) + 5; // gradual heating
        }
      }
    }
    
    // 5. Continuous property transforms
    const toRemove = [];
    for (let i = 0; i < agent.inventory.length; i++) {
      const item = agent.inventory[i];
      if (!item.properties) continue;
      
      const result = applyHeatTransform(item);
      if (result?.changed) {
        if (result.destroyed) {
          toRemove.push(i);
          if (broadcast) {
            broadcast({ type: 'tileEffect', effect: 'smoke', tileX: agent.tileX, tileY: agent.tileY, duration: 2000 });
            addWorldNews?.('physics', agent.id, agent.name, `${agent.name}'s item was destroyed by heat`, agent.zone);
          }
        } else if (result.message) {
          if (broadcast) {
            if (result.effect === 'fire') {
              broadcast({ type: 'tileEffect', effect: 'fire', tileX: agent.tileX, tileY: agent.tileY, duration: 3000 });
            } else if (result.effect === 'melt') {
              broadcast({ type: 'tileEffect', effect: 'sparkle', tileX: agent.tileX, tileY: agent.tileY, duration: 2000 });
            } else if (result.effect === 'smoke') {
              broadcast({ type: 'tileEffect', effect: 'smoke', tileX: agent.tileX, tileY: agent.tileY, duration: 2000 });
            }
            addWorldNews?.('physics', agent.id, agent.name, result.message, agent.zone);
          }
        }
      }
      
      // Phase transitions
      const phase = checkPhaseTransition(item);
      if (phase.changed && phase.message) {
        if (broadcast) {
          const eff = phase.effect === 'steam' ? 'smoke' : phase.effect === 'freeze' ? 'sparkle' : 'sparkle';
          broadcast({ type: 'tileEffect', effect: eff, tileX: agent.tileX, tileY: agent.tileY, duration: 2000 });
          addWorldNews?.('physics', agent.id, agent.name, phase.message, agent.zone);
        }
      }
    }
    
    // Remove destroyed items (reverse order)
    for (let i = toRemove.length - 1; i >= 0; i--) {
      agent.inventory.splice(toRemove[i], 1);
    }
    
    // 4. Time-based reactions
    const reactions = tickReactions(agent, ambientTemp, nearFire, isWet);
    for (const r of reactions) {
      if (r.completed && broadcast) {
        broadcast({ type: 'tileEffect', effect: 'sparkle', tileX: agent.tileX, tileY: agent.tileY, duration: 1500 });
        addWorldNews?.('reaction', agent.id, agent.name, r.message, agent.zone);
      }
    }
  }
  
  /**
   * Global physics tick — fire propagation, water flow.
   */
  function tickWorld(tick, gameTime, weatherData) {
    // Fire propagation
    const fireEvents = tickFirePropagation(worldGrid, weatherData, tick);
    for (const evt of fireEvents) {
      if (evt.type === 'fireSpread' && broadcast) {
        broadcast({ type: 'tileEffect', effect: 'fire', tileX: evt.tileX, tileY: evt.tileY, duration: 4000 });
      }
    }
    
    // Water flow (lightweight)
    tickWater(worldGrid, weatherData, gameTime);
  }
  
  return { tickAgent, tickWorld, getMatterState, getActiveFires: () => [...worldFires.values()] };
}

export { PHASE_TRANSITIONS, STATE_TRANSFORMS, HEAT_STAGES, TRANSFORMED_MATERIALS, TIMED_REACTIONS };
