// Temperature Model — Phase 2
// Per-tile ambient temperature based on elevation, weather, time of day, and fire sources.
// Items have temperature state that changes over time.

/**
 * World fire sources — persistent fires on the map from campfires, experiments, etc.
 * { tileX, tileY, heat, startTick, durationTicks, createdBy }
 */
const worldFires = new Map(); // key: "x,y" → fire object

const BASE_TEMP = 20; // Celsius baseline

// Biome base temperatures
const BIOME_TEMP = {
  desert: 40, sand: 38, coast: 25, grass: 20, grassland: 20,
  forest: 18, swamp: 22, rocky: 15, mountain: 8, cave: 12,
  snow: -5, tundra: -10, lake: 16, ocean: 14,
};

// Weather temperature modifiers
const WEATHER_TEMP_MOD = {
  clear: 0, cloudy: -2, rain: -5, storm: -8, heatwave: 15,
  fog: -3, snow: -15, blizzard: -20, wind: -3,
};

// Time of day modifiers (hour 0-23)
function getTimeOfDayMod(hour) {
  // Coldest at 4am, warmest at 14:00
  const cycle = Math.cos((hour - 14) * Math.PI / 12);
  return cycle * 8; // ±8°C swing
}

// Elevation modifier: -6°C per 1000m (lapse rate), assuming elevation 0-1 maps to 0-3000m
function getElevationMod(elevation) {
  return -(elevation * 3000) * 6 / 1000;
}

/**
 * Get ambient temperature at a tile position.
 */
export function getAmbientTemp(tileX, tileY, options = {}) {
  const { zone = 'grass', elevation = 0, hour = 12, weather = 'clear' } = options;
  
  let temp = BIOME_TEMP[zone] ?? BASE_TEMP;
  temp += WEATHER_TEMP_MOD[weather] ?? 0;
  temp += getTimeOfDayMod(hour);
  temp += getElevationMod(elevation);
  
  // Nearby fire sources
  const fireHeat = getNearbyFireHeat(tileX, tileY);
  temp += fireHeat;
  
  return Math.round(temp * 10) / 10;
}

/**
 * Get heat contribution from nearby fires (inverse square falloff).
 */
function getNearbyFireHeat(tileX, tileY) {
  let totalHeat = 0;
  for (const fire of worldFires.values()) {
    const dx = tileX - fire.tileX;
    const dy = tileY - fire.tileY;
    const distSq = dx * dx + dy * dy;
    if (distSq <= 100) { // within ~10 tiles
      const falloff = 1 / (1 + distSq * 0.1);
      totalHeat += fire.heat * falloff;
    }
  }
  return totalHeat;
}

/**
 * Add a fire to the world. Returns fire key.
 */
export function addWorldFire(tileX, tileY, heat, durationTicks, createdBy = null) {
  const key = `${tileX},${tileY}`;
  worldFires.set(key, { tileX, tileY, heat, durationTicks, remainingTicks: durationTicks, createdBy });
  return key;
}

/**
 * Tick fires — reduce remaining time, remove expired ones.
 * Returns list of expired fire positions (for visual cleanup).
 */
export function tickFires() {
  const expired = [];
  for (const [key, fire] of worldFires) {
    fire.remainingTicks--;
    if (fire.remainingTicks <= 0) {
      expired.push({ tileX: fire.tileX, tileY: fire.tileY });
      worldFires.delete(key);
    }
  }
  return expired;
}

/**
 * Get all active fires (for frontend rendering).
 */
export function getActiveFires() {
  return Array.from(worldFires.values()).map(f => ({
    tileX: f.tileX, tileY: f.tileY, heat: f.heat,
    remaining: f.remainingTicks, createdBy: f.createdBy,
  }));
}

/**
 * Check if there's a fire at or adjacent to a tile.
 */
export function hasNearbyFire(tileX, tileY, range = 2) {
  for (const fire of worldFires.values()) {
    const dx = Math.abs(tileX - fire.tileX);
    const dy = Math.abs(tileY - fire.tileY);
    if (dx <= range && dy <= range) return true;
  }
  return false;
}

// ═══════════════════════════════════════
// Tool Amplifiers
// ═══════════════════════════════════════

const TOOL_AMPLIFIERS = {
  // Heat amplifiers
  heat: {
    'Charcoal': { multiplier: 1.5, label: 'charcoal fuel' },
    'Campfire': { multiplier: 2.0, label: 'campfire' },
    'Torch': { multiplier: 1.3, label: 'torch' },
    'Crystal Lens': { multiplier: 1.8, label: 'focused light' },
  },
  // Impact amplifiers
  impact: {
    'Stone Hammer': { multiplier: 1.5, label: 'stone hammer' },
    'Iron Pickaxe': { multiplier: 2.0, label: 'iron pickaxe' },
    'Shaped Molten Iron Ore': { multiplier: 1.8, label: 'iron tool' },
  },
  // Cut amplifiers
  cut: {
    'Flint Knife': { multiplier: 1.5, label: 'flint knife' },
    'Stone Axe': { multiplier: 1.8, label: 'stone axe' },
  },
  // Grow amplifiers
  grow: {
    'Compost': { multiplier: 1.5, label: 'composted soil' },
    'Cultivated herbs': { multiplier: 1.3, label: 'cultivated herbs' },
  },
};

/**
 * Get force multiplier from tools in inventory.
 * Returns { multiplier, label } for the best matching tool.
 */
export function getToolAmplifier(force, items) {
  const amps = TOOL_AMPLIFIERS[force];
  if (!amps) return { multiplier: 1, label: null };
  
  let best = { multiplier: 1, label: null };
  for (const item of items) {
    const amp = amps[item.name];
    if (amp && amp.multiplier > best.multiplier) {
      best = amp;
    }
  }
  return best;
}

/**
 * Get effective heat with tool amplifiers and ambient temperature.
 * Enhanced version of materials.js getEffectiveHeat.
 */
export function getEffectiveHeatV2(items, zone, options = {}) {
  const { tileX = 0, tileY = 0, elevation = 0, hour = 12, weather = 'clear' } = options;
  
  // Base: sum item temperatures
  let heat = items.reduce((sum, item) => {
    const temp = item.properties?.temperature || 0;
    return sum + Math.max(0, temp); // only count items with positive temp
  }, 0);
  
  // Zone forge bonus (caves/rocky = natural furnaces)
  const ZONE_HEAT = { rocky: 400, cave: 100 };
  heat += ZONE_HEAT[zone] || 0;
  
  // Nearby world fires
  heat += getNearbyFireHeat(tileX, tileY) * 10; // amplify fire contribution
  
  // Tool amplifier
  const amp = getToolAmplifier('heat', items);
  heat *= amp.multiplier;
  
  // Ambient temperature contribution (small)
  const ambient = getAmbientTemp(tileX, tileY, { zone, elevation, hour, weather });
  if (ambient > 30) heat += (ambient - 30) * 2; // hot climate helps a bit
  
  return Math.round(heat);
}

// ═══════════════════════════════════════
// Item Temperature State
// ═══════════════════════════════════════

/**
 * Cool down items in an agent's inventory over time.
 * Hot items (from experiments) gradually return to ambient.
 */
export function coolItems(agent, ambientTemp = 20) {
  if (!agent.inventory) return;
  const COOL_RATE = 0.05; // 5% per tick toward ambient
  
  for (const item of agent.inventory) {
    if (!item.properties) continue;
    const temp = item.properties.temperature || 20;
    if (Math.abs(temp - ambientTemp) < 1) continue; // close enough
    
    // Exponential decay toward ambient
    item.properties.temperature = temp + (ambientTemp - temp) * COOL_RATE;
  }
}

export { worldFires, BIOME_TEMP, WEATHER_TEMP_MOD, TOOL_AMPLIFIERS };
