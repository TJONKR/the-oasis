// Material Properties System — Phase 1 + Force Extensions
// Every item has real physical/chemical properties that drive the experiment engine.

const PROPERTIES = {
  hardness:     { min: 0, max: 10 },
  conductivity: { min: 0, max: 10 },
  flammability: { min: 0, max: 10 },
  toxicity:     { min: 0, max: 10 },
  luminosity:   { min: 0, max: 10 },
  volatility:   { min: 0, max: 10 },
  organic:      { min: 0, max: 1 },
  weight:       { min: 0.1, max: 100 },
  decay_rate:   { min: 0, max: 1 },
  energy:       { min: 0, max: 100 },
  temperature:  { min: -50, max: 500 },
  resonance:    { min: 0, max: 10 },
  // Force-system properties
  melt_point:   { min: 0, max: 2000 },
  ignition:     { min: 0, max: 1000 },
  sharpness:    { min: 0, max: 10 },
  solubility:   { min: 0, max: 10 },
  malleability: { min: 0, max: 10 },
  brittleness:  { min: 0, max: 10 },
  fertility:    { min: 0, max: 10 },
};

// ---------- Gathered resources ----------
const MATERIAL_PROPERTIES = {
  // Library
  'Ancient Scroll': {
    hardness: 1, conductivity: 1, flammability: 7, toxicity: 0, luminosity: 1,
    volatility: 1, organic: 1, weight: 0.3, decay_rate: 0.4, energy: 5,
    temperature: 20, resonance: 3,
    melt_point: 0, ignition: 200, sharpness: 0, solubility: 3, malleability: 1, brittleness: 8, fertility: 2,
  },
  'Ink Vial': {
    hardness: 2, conductivity: 2, flammability: 3, toxicity: 2, luminosity: 0,
    volatility: 1, organic: 0.5, weight: 0.2, decay_rate: 0.1, energy: 2,
    temperature: 20, resonance: 1,
    melt_point: 0, ignition: 0, sharpness: 0, solubility: 9, malleability: 0, brittleness: 7, fertility: 0,
  },
  'Quill Feather': {
    hardness: 1, conductivity: 0, flammability: 6, toxicity: 0, luminosity: 0,
    volatility: 0, organic: 1, weight: 0.05, decay_rate: 0.2, energy: 1,
    temperature: 20, resonance: 0.5,
    melt_point: 0, ignition: 200, sharpness: 2, solubility: 0, malleability: 3, brittleness: 5, fertility: 1,
  },

  // Village
  'Wooden Plank': {
    hardness: 4, conductivity: 0, flammability: 7, toxicity: 0, luminosity: 0,
    volatility: 0, organic: 1, weight: 3, decay_rate: 0.15, energy: 8,
    temperature: 20, resonance: 0.5,
    melt_point: 0, ignition: 250, sharpness: 0, solubility: 0, malleability: 4, brittleness: 3, fertility: 1,
  },
  'Nails': {
    hardness: 8, conductivity: 5, flammability: 0, toxicity: 0, luminosity: 0,
    volatility: 0, organic: 0, weight: 0.3, decay_rate: 0, energy: 0,
    temperature: 20, resonance: 0,
    melt_point: 800, ignition: 0, sharpness: 6, solubility: 0, malleability: 7, brittleness: 2, fertility: 0,
  },
  'Fabric Scrap': {
    hardness: 1, conductivity: 0, flammability: 8, toxicity: 0, luminosity: 0,
    volatility: 0, organic: 1, weight: 0.1, decay_rate: 0.2, energy: 3,
    temperature: 20, resonance: 0,
    melt_point: 0, ignition: 200, sharpness: 0, solubility: 1, malleability: 8, brittleness: 1, fertility: 0,
  },

  // Cave
  'Iron Ore': {
    hardness: 8, conductivity: 6, flammability: 0, toxicity: 0, luminosity: 0,
    volatility: 0, organic: 0, weight: 15, decay_rate: 0, energy: 3,
    temperature: 20, resonance: 1,
    melt_point: 800, ignition: 0, sharpness: 1, solubility: 0, malleability: 5, brittleness: 4, fertility: 0,
  },
  'Crystal': {
    hardness: 7, conductivity: 9, flammability: 0, toxicity: 0, luminosity: 5,
    volatility: 3, organic: 0, weight: 2, decay_rate: 0, energy: 30,
    temperature: 20, resonance: 8,
    melt_point: 700, ignition: 0, sharpness: 3, solubility: 0, malleability: 0, brittleness: 8, fertility: 0,
  },
  'Gemstone': {
    hardness: 9, conductivity: 3, flammability: 0, toxicity: 0, luminosity: 4,
    volatility: 1, organic: 0, weight: 0.5, decay_rate: 0, energy: 15,
    temperature: 20, resonance: 5,
    melt_point: 1200, ignition: 0, sharpness: 4, solubility: 0, malleability: 0, brittleness: 9, fertility: 0,
  },
  'Fossil': {
    hardness: 6, conductivity: 1, flammability: 0, toxicity: 0, luminosity: 0,
    volatility: 0, organic: 0.5, weight: 4, decay_rate: 0, energy: 10,
    temperature: 20, resonance: 4,
    melt_point: 0, ignition: 0, sharpness: 0, solubility: 1, malleability: 0, brittleness: 7, fertility: 3,
  },

  // Tower
  'Signal Fragment': {
    hardness: 2, conductivity: 8, flammability: 1, toxicity: 0, luminosity: 3,
    volatility: 2, organic: 0, weight: 0.1, decay_rate: 0, energy: 25,
    temperature: 30, resonance: 7,
    melt_point: 500, ignition: 400, sharpness: 1, solubility: 0, malleability: 2, brittleness: 6, fertility: 0,
  },
  'Circuit Board': {
    hardness: 3, conductivity: 9, flammability: 2, toxicity: 1, luminosity: 1,
    volatility: 1, organic: 0, weight: 0.2, decay_rate: 0, energy: 15,
    temperature: 25, resonance: 4,
    melt_point: 600, ignition: 250, sharpness: 1, solubility: 0, malleability: 1, brittleness: 7, fertility: 0,
  },
  'Antenna': {
    hardness: 5, conductivity: 8, flammability: 0, toxicity: 0, luminosity: 0,
    volatility: 0, organic: 0, weight: 1.5, decay_rate: 0, energy: 5,
    temperature: 20, resonance: 6,
    melt_point: 900, ignition: 0, sharpness: 1, solubility: 0, malleability: 6, brittleness: 3, fertility: 0,
  },

  // Workshop
  'Gear': {
    hardness: 7, conductivity: 4, flammability: 0, toxicity: 0, luminosity: 0,
    volatility: 0, organic: 0, weight: 2, decay_rate: 0, energy: 2,
    temperature: 20, resonance: 1,
    melt_point: 800, ignition: 0, sharpness: 2, solubility: 0, malleability: 7, brittleness: 2, fertility: 0,
  },
  'Wire': {
    hardness: 3, conductivity: 9, flammability: 0, toxicity: 0, luminosity: 0,
    volatility: 0, organic: 0, weight: 0.3, decay_rate: 0, energy: 1,
    temperature: 20, resonance: 2,
    melt_point: 800, ignition: 0, sharpness: 2, solubility: 0, malleability: 9, brittleness: 1, fertility: 0,
  },
  'Schematic': {
    hardness: 1, conductivity: 0, flammability: 5, toxicity: 0, luminosity: 0,
    volatility: 0, organic: 0.5, weight: 0.1, decay_rate: 0.3, energy: 8,
    temperature: 20, resonance: 2,
    melt_point: 0, ignition: 240, sharpness: 0, solubility: 2, malleability: 1, brittleness: 6, fertility: 0,
  },
  'Spark Plug': {
    hardness: 6, conductivity: 7, flammability: 0, toxicity: 0, luminosity: 2,
    volatility: 4, organic: 0, weight: 0.4, decay_rate: 0, energy: 20,
    temperature: 40, resonance: 3,
    melt_point: 900, ignition: 0, sharpness: 0, solubility: 0, malleability: 3, brittleness: 4, fertility: 0,
  },

  // Garden
  'Memory Seed': {
    hardness: 2, conductivity: 2, flammability: 3, toxicity: 1, luminosity: 2,
    volatility: 2, organic: 1, weight: 0.05, decay_rate: 0.3, energy: 20,
    temperature: 22, resonance: 7,
    melt_point: 0, ignition: 180, sharpness: 0, solubility: 2, malleability: 1, brittleness: 3, fertility: 8,
  },
  'Petal Dust': {
    hardness: 0, conductivity: 1, flammability: 4, toxicity: 0, luminosity: 3,
    volatility: 1, organic: 1, weight: 0.01, decay_rate: 0.5, energy: 8,
    temperature: 20, resonance: 5,
    melt_point: 0, ignition: 150, sharpness: 0, solubility: 7, malleability: 0, brittleness: 0, fertility: 6,
  },
  'Dew Drop': {
    hardness: 0, conductivity: 3, flammability: 0, toxicity: 0, luminosity: 4,
    volatility: 0, organic: 0.5, weight: 0.02, decay_rate: 0.6, energy: 12,
    temperature: 5, resonance: 6,
    melt_point: 0, ignition: 0, sharpness: 0, solubility: 10, malleability: 0, brittleness: 0, fertility: 5,
  },

  // Beach
  'Shell': {
    hardness: 4, conductivity: 0, flammability: 0, toxicity: 0, luminosity: 1,
    volatility: 0, organic: 0.5, weight: 0.5, decay_rate: 0.05, energy: 1,
    temperature: 25, resonance: 2,
    melt_point: 500, ignition: 0, sharpness: 2, solubility: 2, malleability: 0, brittleness: 8, fertility: 2,
  },
  'Driftwood': {
    hardness: 3, conductivity: 0, flammability: 8, toxicity: 0, luminosity: 0,
    volatility: 0, organic: 1, weight: 2, decay_rate: 0.2, energy: 10,
    temperature: 25, resonance: 0.5,
    melt_point: 0, ignition: 200, sharpness: 0, solubility: 0, malleability: 5, brittleness: 4, fertility: 2,
  },
  'Sand Pearl': {
    hardness: 6, conductivity: 1, flammability: 0, toxicity: 0, luminosity: 6,
    volatility: 0, organic: 0.5, weight: 0.3, decay_rate: 0, energy: 5,
    temperature: 25, resonance: 4,
    melt_point: 1000, ignition: 0, sharpness: 0, solubility: 0, malleability: 0, brittleness: 6, fertility: 0,
  },
  'Sea Glass': {
    hardness: 5, conductivity: 2, flammability: 0, toxicity: 0, luminosity: 5,
    volatility: 0, organic: 0, weight: 0.2, decay_rate: 0, energy: 3,
    temperature: 20, resonance: 3,
    melt_point: 1100, ignition: 0, sharpness: 5, solubility: 0, malleability: 0, brittleness: 7, fertility: 0,
  },

  // ---------- Crafted items ----------
  'Torch': {
    hardness: 3, conductivity: 0, flammability: 9, toxicity: 1, luminosity: 8,
    volatility: 2, organic: 0.5, weight: 1.5, decay_rate: 0.3, energy: 25,
    temperature: 300, resonance: 1,
    melt_point: 0, ignition: 200, sharpness: 0, solubility: 0, malleability: 2, brittleness: 3, fertility: 0,
  },
  'Scroll of Knowledge': {
    hardness: 1, conductivity: 1, flammability: 6, toxicity: 0, luminosity: 2,
    volatility: 0, organic: 1, weight: 0.4, decay_rate: 0.3, energy: 15,
    temperature: 20, resonance: 5,
    melt_point: 0, ignition: 230, sharpness: 0, solubility: 3, malleability: 1, brittleness: 7, fertility: 1,
  },
  'Crystal Antenna': {
    hardness: 6, conductivity: 10, flammability: 0, toxicity: 0, luminosity: 4,
    volatility: 2, organic: 0, weight: 2.5, decay_rate: 0, energy: 35,
    temperature: 25, resonance: 9,
    melt_point: 1600, ignition: 0, sharpness: 2, solubility: 0, malleability: 1, brittleness: 6, fertility: 0,
  },
  'Memory Flower': {
    hardness: 1, conductivity: 2, flammability: 4, toxicity: 0, luminosity: 5,
    volatility: 1, organic: 1, weight: 0.1, decay_rate: 0.4, energy: 18,
    temperature: 20, resonance: 8,
    melt_point: 0, ignition: 160, sharpness: 0, solubility: 4, malleability: 2, brittleness: 2, fertility: 7,
  },
  'Iron Pickaxe': {
    hardness: 9, conductivity: 5, flammability: 0, toxicity: 0, luminosity: 0,
    volatility: 0, organic: 0, weight: 8, decay_rate: 0, energy: 2,
    temperature: 20, resonance: 0.5,
    melt_point: 1540, ignition: 0, sharpness: 7, solubility: 0, malleability: 4, brittleness: 2, fertility: 0,
  },
  'Signal Beacon': {
    hardness: 4, conductivity: 9, flammability: 1, toxicity: 0, luminosity: 6,
    volatility: 3, organic: 0, weight: 3, decay_rate: 0, energy: 50,
    temperature: 35, resonance: 9,
    melt_point: 1000, ignition: 0, sharpness: 0, solubility: 0, malleability: 2, brittleness: 5, fertility: 0,
  },
  'Pearl Necklace': {
    hardness: 5, conductivity: 2, flammability: 0, toxicity: 0, luminosity: 5,
    volatility: 0, organic: 0.5, weight: 0.8, decay_rate: 0, energy: 8,
    temperature: 22, resonance: 5,
    melt_point: 1400, ignition: 0, sharpness: 0, solubility: 0, malleability: 1, brittleness: 5, fertility: 0,
  },
  'Master Blueprint': {
    hardness: 1, conductivity: 0, flammability: 5, toxicity: 0, luminosity: 1,
    volatility: 0, organic: 0.5, weight: 0.3, decay_rate: 0.2, energy: 20,
    temperature: 20, resonance: 4,
    melt_point: 0, ignition: 240, sharpness: 0, solubility: 2, malleability: 1, brittleness: 6, fertility: 0,
  },

  // ---------- Heat sources ----------
  'Campfire': {
    hardness: 1, conductivity: 1, flammability: 9, toxicity: 0, luminosity: 7,
    volatility: 0, organic: 1, weight: 8, decay_rate: 0.5, energy: 40,
    temperature: 200, resonance: 0,
    melt_point: 0, ignition: 0, sharpness: 0, solubility: 0, malleability: 0, brittleness: 0, fertility: 0,
  },
  'Charcoal': {
    hardness: 2, conductivity: 0, flammability: 10, toxicity: 0, luminosity: 2,
    volatility: 0, organic: 1, weight: 3, decay_rate: 0.1, energy: 80,
    temperature: 500, resonance: 0,
    melt_point: 0, ignition: 0, sharpness: 0, solubility: 0, malleability: 0, brittleness: 0, fertility: 0,
  },
};

// Terrain heat bonuses (rocky terrain has natural forges)
const ZONE_HEAT_BONUS = {
  rocky: 400,
  cave: 100,
};

/**
 * Get effective heat from items + zone forge bonus.
 * Sums temperature of all items, adds zone forge bonus.
 */
export function getEffectiveHeat(items, zone) {
  const itemHeat = items.reduce((sum, item) => {
    const props = item.properties || MATERIAL_PROPERTIES[item.name];
    return sum + (props?.temperature || 0);
  }, 0);
  return itemHeat + (ZONE_HEAT_BONUS[zone] || 0);
}

/**
 * Check if an item is a liquid (high solubility, low hardness).
 */
export function isLiquid(item) {
  const props = item.properties || MATERIAL_PROPERTIES[item.name];
  if (!props) return false;
  return props.solubility >= 8 && props.hardness <= 1;
}

/**
 * Check if an item is sharp enough to cut.
 */
export function isSharp(item) {
  const props = item.properties || MATERIAL_PROPERTIES[item.name];
  if (!props) return false;
  return props.sharpness >= 4;
}

/**
 * Get properties for a named item. Returns a copy with slight variance if requested.
 */
export function getProperties(itemName) {
  return MATERIAL_PROPERTIES[itemName] || null;
}

/**
 * Attach properties to an item object (mutates item, returns it).
 */
export function attachProperties(item) {
  const props = MATERIAL_PROPERTIES[item.name];
  if (props) {
    item.properties = { ...props };
  }
  return item;
}

/**
 * Generate properties for a new/unknown item by averaging inputs and adding noise.
 */
export function computeDerivedProperties(inputItems, overrides = {}) {
  const result = {};
  for (const key of Object.keys(PROPERTIES)) {
    const values = inputItems.map(i => {
      const p = i.properties || MATERIAL_PROPERTIES[i.name];
      return p ? (p[key] ?? 0) : 0;
    });
    const avg = values.reduce((s, v) => s + v, 0) / values.length;
    // +/-15% randomness
    const noise = 1 + (Math.random() * 0.3 - 0.15);
    const val = avg * noise;
    const { min, max } = PROPERTIES[key];
    result[key] = Math.round(Math.min(max, Math.max(min, val)) * 100) / 100;
  }
  Object.assign(result, overrides);
  return result;
}

export { PROPERTIES, MATERIAL_PROPERTIES, ZONE_HEAT_BONUS };
