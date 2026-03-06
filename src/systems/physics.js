// Physics Engine — Phase 2
// Material properties for ALL gathered resources + practical transformation rules.
// This extends materials.js with the resources agents actually find in The Oasis.

import { MATERIAL_PROPERTIES } from './materials.js';

// ═══════════════════════════════════════
// Properties for all 26 gathered resources
// (from world-adapter.js DECO_RESOURCES + TERRAIN_RESOURCES)
// ═══════════════════════════════════════

const GATHERED_RESOURCE_PROPERTIES = {
  // ── Trees ──
  wood: {
    hardness: 4, conductivity: 0, flammability: 7, toxicity: 0, luminosity: 0,
    volatility: 0, organic: 1, weight: 3, decay_rate: 0.1, energy: 8,
    temperature: 20, resonance: 0,
    melt_point: 0, ignition: 250, sharpness: 0, solubility: 0, malleability: 4, brittleness: 3, fertility: 1,
    // Emergent properties: a branch/stick
    length: 5, flexibility: 2, insulation: 2, structural: 4, absorbency: 2,
  },
  resin: {
    hardness: 1, conductivity: 0, flammability: 8, toxicity: 0, luminosity: 1,
    volatility: 2, organic: 1, weight: 0.2, decay_rate: 0.05, energy: 12,
    temperature: 20, resonance: 0,
    melt_point: 80, ignition: 180, sharpness: 0, solubility: 2, malleability: 6, brittleness: 1, fertility: 0,
    length: 0, flexibility: 0, insulation: 1, structural: 0, absorbency: 0,
  },
  pine_nuts: {
    hardness: 2, conductivity: 0, flammability: 3, toxicity: 0, luminosity: 0,
    volatility: 0, organic: 1, weight: 0.05, decay_rate: 0.3, energy: 15,
    temperature: 20, resonance: 0,
    melt_point: 0, ignition: 200, sharpness: 0, solubility: 0, malleability: 0, brittleness: 4, fertility: 3,
    length: 0, flexibility: 0, insulation: 0, structural: 0, absorbency: 0,
  },
  acorns: {
    hardness: 3, conductivity: 0, flammability: 3, toxicity: 0, luminosity: 0,
    volatility: 0, organic: 1, weight: 0.1, decay_rate: 0.2, energy: 12,
    temperature: 20, resonance: 0,
    melt_point: 0, ignition: 200, sharpness: 0, solubility: 0, malleability: 0, brittleness: 5, fertility: 5,
    length: 0, flexibility: 0, insulation: 0, structural: 0, absorbency: 0,
  },
  bark: {
    hardness: 3, conductivity: 0, flammability: 6, toxicity: 0, luminosity: 0,
    volatility: 0, organic: 1, weight: 0.5, decay_rate: 0.15, energy: 5,
    temperature: 20, resonance: 0,
    melt_point: 0, ignition: 220, sharpness: 0, solubility: 1, malleability: 3, brittleness: 4, fertility: 1,
    length: 2, flexibility: 4, insulation: 4, structural: 2, absorbency: 3,
  },
  coconuts: {
    // Can be cracked open to get coconut meat + shell bowl
    hardness: 5, conductivity: 0, flammability: 3, toxicity: 0, luminosity: 0,
    volatility: 0, organic: 1, weight: 1.5, decay_rate: 0.2, energy: 25,
    temperature: 20, resonance: 0,
    melt_point: 0, ignition: 250, sharpness: 0, solubility: 0, malleability: 0, brittleness: 6, fertility: 2,
    length: 1, flexibility: 0, insulation: 2, structural: 3, absorbency: 0,
  },
  palm_fronds: {
    hardness: 1, conductivity: 0, flammability: 5, toxicity: 0, luminosity: 0,
    volatility: 0, organic: 1, weight: 0.3, decay_rate: 0.25, energy: 3,
    temperature: 20, resonance: 0,
    melt_point: 0, ignition: 180, sharpness: 1, solubility: 0, malleability: 7, brittleness: 2, fertility: 1,
    // Fibers can be twisted into rope; large leaves provide shade/shelter
    length: 6, flexibility: 8, insulation: 3, structural: 1, absorbency: 4,
  },

  // ── Rocks ──
  stone: {
    hardness: 7, conductivity: 1, flammability: 0, toxicity: 0, luminosity: 0,
    volatility: 0, organic: 0, weight: 8, decay_rate: 0, energy: 0,
    temperature: 20, resonance: 0.5,
    melt_point: 1200, ignition: 0, sharpness: 2, solubility: 0, malleability: 1, brittleness: 5, fertility: 0,
    // Good for structures, fire containment
    length: 1, flexibility: 0, insulation: 1, structural: 6, absorbency: 0,
  },
  flint: {
    // THE survival stone: knappable into sharp edges, strikes sparks against steel/pyrite
    hardness: 8, conductivity: 0, flammability: 0, toxicity: 0, luminosity: 0,
    volatility: 0, organic: 0, weight: 0.5, decay_rate: 0, energy: 5,
    temperature: 20, resonance: 0,
    melt_point: 1400, ignition: 0, sharpness: 7, solubility: 0, malleability: 0, brittleness: 7, fertility: 0,
    length: 1, flexibility: 0, insulation: 0, structural: 3, absorbency: 0,
  },
  ore: {
    hardness: 7, conductivity: 5, flammability: 0, toxicity: 0, luminosity: 0,
    volatility: 0, organic: 0, weight: 12, decay_rate: 0, energy: 3,
    temperature: 20, resonance: 1,
    melt_point: 800, ignition: 0, sharpness: 1, solubility: 0, malleability: 5, brittleness: 4, fertility: 0,
    length: 1, flexibility: 0, insulation: 0, structural: 4, absorbency: 0,
  },
  crystals: {
    hardness: 7, conductivity: 8, flammability: 0, toxicity: 0, luminosity: 5,
    volatility: 2, organic: 0, weight: 1, decay_rate: 0, energy: 25,
    temperature: 20, resonance: 8,
    melt_point: 700, ignition: 0, sharpness: 3, solubility: 0, malleability: 0, brittleness: 8, fertility: 0,
    length: 1, flexibility: 0, insulation: 0, structural: 2, absorbency: 0,
  },

  // ── Plants ──
  flowers: {
    hardness: 0, conductivity: 0, flammability: 4, toxicity: 0, luminosity: 1,
    volatility: 0, organic: 1, weight: 0.05, decay_rate: 0.4, energy: 5,
    temperature: 20, resonance: 2,
    melt_point: 0, ignition: 150, sharpness: 0, solubility: 3, malleability: 1, brittleness: 1, fertility: 4,
    length: 1, flexibility: 5, insulation: 0, structural: 0, absorbency: 3,
  },
  herbs: {
    hardness: 0, conductivity: 0, flammability: 4, toxicity: 0, luminosity: 0,
    volatility: 1, organic: 1, weight: 0.05, decay_rate: 0.35, energy: 10,
    temperature: 20, resonance: 1,
    melt_point: 0, ignition: 160, sharpness: 0, solubility: 4, malleability: 1, brittleness: 1, fertility: 3,
    length: 1, flexibility: 4, insulation: 0, structural: 0, absorbency: 2,
  },
  fiber: {
    // Plant fiber: can be twisted into cordage/rope
    hardness: 1, conductivity: 0, flammability: 5, toxicity: 0, luminosity: 0,
    volatility: 0, organic: 1, weight: 0.1, decay_rate: 0.1, energy: 2,
    temperature: 20, resonance: 0,
    melt_point: 0, ignition: 200, sharpness: 0, solubility: 0, malleability: 8, brittleness: 1, fertility: 0,
    length: 3, flexibility: 9, insulation: 2, structural: 1, absorbency: 5,
  },
  mushrooms: {
    hardness: 0, conductivity: 0, flammability: 2, toxicity: 1, luminosity: 0,
    volatility: 0, organic: 1, weight: 0.1, decay_rate: 0.5, energy: 20,
    temperature: 20, resonance: 1,
    melt_point: 0, ignition: 180, sharpness: 0, solubility: 2, malleability: 2, brittleness: 3, fertility: 2,
    length: 0, flexibility: 1, insulation: 0, structural: 0, absorbency: 4,
  },
  berries: {
    hardness: 0, conductivity: 0, flammability: 2, toxicity: 0, luminosity: 0,
    volatility: 0, organic: 1, weight: 0.05, decay_rate: 0.5, energy: 15,
    temperature: 20, resonance: 0,
    melt_point: 0, ignition: 180, sharpness: 0, solubility: 5, malleability: 1, brittleness: 1, fertility: 2,
    length: 0, flexibility: 0, insulation: 0, structural: 0, absorbency: 0,
  },
  cactus_fruit: {
    hardness: 1, conductivity: 0, flammability: 2, toxicity: 0, luminosity: 0,
    volatility: 0, organic: 1, weight: 0.3, decay_rate: 0.3, energy: 18,
    temperature: 20, resonance: 0,
    melt_point: 0, ignition: 180, sharpness: 0, solubility: 4, malleability: 2, brittleness: 2, fertility: 1,
    length: 0, flexibility: 0, insulation: 0, structural: 0, absorbency: 0,
  },
  cactus_water: {
    hardness: 0, conductivity: 2, flammability: 0, toxicity: 0, luminosity: 0,
    volatility: 0, organic: 0.5, weight: 0.2, decay_rate: 0.2, energy: 12,
    temperature: 20, resonance: 0,
    melt_point: 0, ignition: 0, sharpness: 0, solubility: 9, malleability: 0, brittleness: 0, fertility: 3,
    length: 0, flexibility: 0, insulation: 0, structural: 0, absorbency: 0,
  },

  // ── Water/Coast ──
  reeds: {
    // Hollow, can be woven into baskets/mats, good tinder
    hardness: 2, conductivity: 0, flammability: 5, toxicity: 0, luminosity: 0,
    volatility: 0, organic: 1, weight: 0.2, decay_rate: 0.15, energy: 3,
    temperature: 20, resonance: 0,
    melt_point: 0, ignition: 180, sharpness: 1, solubility: 0, malleability: 7, brittleness: 3, fertility: 1,
    length: 5, flexibility: 6, insulation: 2, structural: 1, absorbency: 3,
  },
  clay: {
    hardness: 2, conductivity: 0, flammability: 0, toxicity: 0, luminosity: 0,
    volatility: 0, organic: 0, weight: 3, decay_rate: 0, energy: 0,
    temperature: 20, resonance: 0,
    melt_point: 900, ignition: 0, sharpness: 0, solubility: 3, malleability: 9, brittleness: 2, fertility: 2,
    length: 0, flexibility: 0, insulation: 3, structural: 2, absorbency: 6,
  },
  seaweed: {
    hardness: 0, conductivity: 1, flammability: 2, toxicity: 0, luminosity: 0,
    volatility: 0, organic: 1, weight: 0.1, decay_rate: 0.4, energy: 8,
    temperature: 20, resonance: 0,
    melt_point: 0, ignition: 200, sharpness: 0, solubility: 3, malleability: 5, brittleness: 1, fertility: 3,
    length: 3, flexibility: 8, insulation: 1, structural: 0, absorbency: 6,
  },
  salt: {
    hardness: 3, conductivity: 3, flammability: 0, toxicity: 0, luminosity: 1,
    volatility: 0, organic: 0, weight: 0.3, decay_rate: 0, energy: 0,
    temperature: 20, resonance: 0,
    melt_point: 800, ignition: 0, sharpness: 0, solubility: 10, malleability: 0, brittleness: 6, fertility: 0,
    length: 0, flexibility: 0, insulation: 0, structural: 0, absorbency: 0,
  },

  // ── Ice/Snow ──
  ice: {
    hardness: 3, conductivity: 2, flammability: 0, toxicity: 0, luminosity: 2,
    volatility: 0, organic: 0, weight: 1, decay_rate: 0.6, energy: 5,
    temperature: -5, resonance: 1,
    melt_point: 0, ignition: 0, sharpness: 1, solubility: 10, malleability: 0, brittleness: 7, fertility: 1,
    length: 0, flexibility: 0, insulation: 5, structural: 2, absorbency: 0,
  },
  freshwater: {
    hardness: 0, conductivity: 3, flammability: 0, toxicity: 0, luminosity: 0,
    volatility: 0, organic: 0, weight: 0.5, decay_rate: 0, energy: 8,
    temperature: 15, resonance: 0,
    melt_point: 0, ignition: 0, sharpness: 0, solubility: 10, malleability: 0, brittleness: 0, fertility: 5,
    length: 0, flexibility: 0, insulation: 0, structural: 0, absorbency: 0,
  },

  // ── Terrain fallbacks ──
  pebbles: {
    hardness: 5, conductivity: 0, flammability: 0, toxicity: 0, luminosity: 0,
    volatility: 0, organic: 0, weight: 0.5, decay_rate: 0, energy: 0,
    temperature: 20, resonance: 0,
    melt_point: 1200, ignition: 0, sharpness: 1, solubility: 0, malleability: 0, brittleness: 4, fertility: 0,
    length: 0, flexibility: 0, insulation: 0, structural: 3, absorbency: 0,
  },
  sand: {
    // Abrasive, can polish/grind; melts into glass at high temp
    hardness: 2, conductivity: 0, flammability: 0, toxicity: 0, luminosity: 0,
    volatility: 0, organic: 0, weight: 2, decay_rate: 0, energy: 0,
    temperature: 25, resonance: 0,
    melt_point: 1200, ignition: 0, sharpness: 0, solubility: 0, malleability: 3, brittleness: 0, fertility: 0,
    length: 0, flexibility: 0, insulation: 1, structural: 1, absorbency: 2,
  },
  shells: {
    // Can be sharpened into scrapers/cutters
    hardness: 4, conductivity: 0, flammability: 0, toxicity: 0, luminosity: 1,
    volatility: 0, organic: 0.5, weight: 0.2, decay_rate: 0.05, energy: 1,
    temperature: 20, resonance: 1,
    melt_point: 500, ignition: 0, sharpness: 2, solubility: 2, malleability: 0, brittleness: 7, fertility: 1,
    length: 0, flexibility: 0, insulation: 0, structural: 1, absorbency: 0,
  },
  driftwood: {
    // Weathered wood, good fuel, can be shaped
    hardness: 3, conductivity: 0, flammability: 7, toxicity: 0, luminosity: 0,
    volatility: 0, organic: 1, weight: 1.5, decay_rate: 0.2, energy: 8,
    temperature: 20, resonance: 0,
    melt_point: 0, ignition: 200, sharpness: 0, solubility: 0, malleability: 4, brittleness: 4, fertility: 1,
    length: 4, flexibility: 1, insulation: 2, structural: 3, absorbency: 3,
  },
  fish: {
    hardness: 0, conductivity: 0, flammability: 1, toxicity: 0, luminosity: 0,
    volatility: 0, organic: 1, weight: 0.5, decay_rate: 0.6, energy: 20,
    temperature: 10, resonance: 0,
    melt_point: 0, ignition: 0, sharpness: 0, solubility: 0, malleability: 3, brittleness: 2, fertility: 1,
    length: 2, flexibility: 3, insulation: 0, structural: 0, absorbency: 0,
  },
  peat: {
    hardness: 1, conductivity: 0, flammability: 6, toxicity: 0, luminosity: 0,
    volatility: 0, organic: 1, weight: 2, decay_rate: 0.05, energy: 15,
    temperature: 20, resonance: 0,
    melt_point: 0, ignition: 200, sharpness: 0, solubility: 1, malleability: 3, brittleness: 1, fertility: 7,
    length: 0, flexibility: 0, insulation: 5, structural: 1, absorbency: 7,
  },
  slime: {
    hardness: 0, conductivity: 1, flammability: 0, toxicity: 2, luminosity: 1,
    volatility: 1, organic: 1, weight: 0.3, decay_rate: 0.3, energy: 3,
    temperature: 20, resonance: 1,
    melt_point: 0, ignition: 0, sharpness: 0, solubility: 7, malleability: 9, brittleness: 0, fertility: 2,
    length: 0, flexibility: 0, insulation: 0, structural: 0, absorbency: 8,
  },
  dust: {
    hardness: 0, conductivity: 0, flammability: 1, toxicity: 0, luminosity: 0,
    volatility: 1, organic: 0, weight: 0.01, decay_rate: 0, energy: 0,
    temperature: 20, resonance: 0,
    melt_point: 0, ignition: 0, sharpness: 0, solubility: 1, malleability: 0, brittleness: 0, fertility: 0,
    length: 0, flexibility: 0, insulation: 0, structural: 0, absorbency: 1,
  },
  bat_guano: {
    hardness: 0, conductivity: 0, flammability: 3, toxicity: 1, luminosity: 0,
    volatility: 2, organic: 1, weight: 0.3, decay_rate: 0.2, energy: 5,
    temperature: 20, resonance: 0,
    melt_point: 0, ignition: 180, sharpness: 0, solubility: 4, malleability: 2, brittleness: 0, fertility: 9,
    length: 0, flexibility: 0, insulation: 0, structural: 0, absorbency: 3,
  },
};

// ═══════════════════════════════════════
// Practical crafting rules (force-based)
// These produce useful tools, food, and survival items
// ═══════════════════════════════════════

const PRACTICAL_RULES = [
  // ── Fire & Heat ──
  {
    id: 'make_fire',
    force: 'combine',
    name: 'Fire Starting',
    check: (items) => {
      const hasFlint = items.some(i => i.name === 'flint');
      const hasWood = items.some(i => ['wood', 'driftwood', 'bark', 'reeds'].includes(i.name));
      return hasFlint && hasWood;
    },
    produce: (items) => ({
      name: 'Campfire',
      type: 'structure',
      rarity: 'Common',
      description: 'Striking flint against wood produces sparks — fire crackles to life.',
    }),
    propOverrides: { temperature: 500, luminosity: 7, flammability: 9 },
    consume: 'all',
    priority: 15,
  },
  {
    id: 'make_torch',
    force: 'combine',
    name: 'Torch Crafting',
    check: (items) => {
      const hasWood = items.some(i => ['wood', 'driftwood'].includes(i.name));
      const hasResin = items.some(i => ['resin', 'fiber', 'bark'].includes(i.name));
      return hasWood && hasResin;
    },
    produce: (items) => ({
      name: 'Torch',
      type: 'tool',
      rarity: 'Common',
      description: 'A stick wrapped in fuel — light it for warmth and vision.',
    }),
    propOverrides: { temperature: 300, luminosity: 6, flammability: 8 },
    consume: 'all',
    priority: 12,
  },

  // ── Tools ──
  {
    id: 'stone_axe',
    force: 'combine',
    name: 'Stone Axe',
    check: (items) => {
      const hasStone = items.some(i => ['stone', 'flint'].includes(i.name));
      const hasWood = items.some(i => ['wood', 'driftwood'].includes(i.name));
      const hasBind = items.some(i => ['fiber', 'reeds', 'bark'].includes(i.name));
      return hasStone && hasWood && hasBind;
    },
    produce: () => ({
      name: 'Stone Axe',
      type: 'tool',
      rarity: 'Common',
      description: 'A rough stone lashed to a wooden handle. Cuts wood faster.',
    }),
    propOverrides: { hardness: 6, sharpness: 5, weight: 4 },
    consume: 'all',
    priority: 14,
  },
  {
    id: 'stone_pickaxe',
    force: 'combine',
    name: 'Stone Pickaxe',
    check: (items) => {
      const hasFlint = items.some(i => ['flint', 'stone'].includes(i.name));
      const hasWood = items.some(i => ['wood', 'driftwood'].includes(i.name));
      const hasBind = items.some(i => ['fiber', 'reeds'].includes(i.name));
      return hasFlint && hasWood && hasBind;
    },
    produce: () => ({
      name: 'Stone Pickaxe',
      type: 'tool',
      rarity: 'Common',
      description: 'A pointed flint bound to a shaft. Mines ore from rock.',
    }),
    propOverrides: { hardness: 7, sharpness: 6, weight: 5 },
    consume: 'all',
    priority: 13,
  },
  {
    id: 'flint_knife',
    force: 'impact',
    name: 'Flint Knapping',
    check: (items) => {
      return items.some(i => i.name === 'flint') && items.some(i => ['stone', 'pebbles'].includes(i.name));
    },
    produce: () => ({
      name: 'Flint Knife',
      type: 'tool',
      rarity: 'Common',
      description: 'Sharp flint shaped by careful strikes. Cuts and carves.',
    }),
    propOverrides: { sharpness: 8, hardness: 7, weight: 0.3 },
    consume: ['flint'], // stone survives as anvil
    priority: 14,
  },
  {
    id: 'make_rope',
    force: 'combine',
    name: 'Rope Making',
    check: (items) => {
      const fiberCount = items.filter(i => ['fiber', 'reeds', 'palm_fronds'].includes(i.name)).length;
      return fiberCount >= 2;
    },
    produce: () => ({
      name: 'Rope',
      type: 'material',
      rarity: 'Common',
      description: 'Twisted plant fibers form a strong rope.',
    }),
    propOverrides: { malleability: 8, hardness: 2, weight: 0.5 },
    consume: 'all',
    priority: 11,
  },

  // ── Containers & Storage ──
  {
    id: 'clay_pot',
    force: 'heat',
    name: 'Pottery',
    check: (items, zone) => {
      const hasCite = items.some(i => i.name === 'clay');
      const heat = items.reduce((s, i) => s + (i.properties?.temperature || 0), 0) + (zone === 'rocky' ? 400 : 0);
      return hasCite && heat >= 200;
    },
    produce: () => ({
      name: 'Clay Pot',
      type: 'tool',
      rarity: 'Common',
      description: 'Fired clay hardened into a useful vessel. Stores water and food.',
    }),
    propOverrides: { hardness: 5, brittleness: 6, weight: 2, malleability: 0 },
    consume: ['clay'],
    priority: 12,
  },

  // ── Food Processing ──
  {
    id: 'cook_fish',
    force: 'heat',
    name: 'Fish Cooking',
    check: (items, zone) => {
      const hasFish = items.some(i => i.name === 'fish');
      const heat = items.reduce((s, i) => s + (i.properties?.temperature || 0), 0) + (zone === 'rocky' ? 400 : 0);
      return hasFish && heat >= 100;
    },
    produce: () => ({
      name: 'Cooked Fish',
      type: 'consumable',
      rarity: 'Common',
      description: 'Perfectly roasted fish. Nourishing and satisfying.',
    }),
    propOverrides: { energy: 35, decay_rate: 0.3, organic: 1, toxicity: 0 },
    consume: ['fish'],
    priority: 11,
  },
  {
    id: 'cook_mushroom',
    force: 'heat',
    name: 'Mushroom Roasting',
    check: (items, zone) => {
      const hasMush = items.some(i => i.name === 'mushrooms');
      const heat = items.reduce((s, i) => s + (i.properties?.temperature || 0), 0) + (zone === 'rocky' ? 400 : 0);
      return hasMush && heat >= 100;
    },
    produce: () => ({
      name: 'Roasted Mushrooms',
      type: 'consumable',
      rarity: 'Common',
      description: 'Heat removes toxins and brings out earthy flavor.',
    }),
    propOverrides: { energy: 25, decay_rate: 0.35, organic: 1, toxicity: 0 },
    consume: ['mushrooms'],
    priority: 11,
  },
  {
    id: 'salt_preserve',
    force: 'combine',
    name: 'Salt Preservation',
    check: (items) => {
      const hasSalt = items.some(i => i.name === 'salt');
      const hasFood = items.some(i => ['fish', 'mushrooms', 'berries', 'herbs', 'seaweed'].includes(i.name));
      return hasSalt && hasFood;
    },
    produce: (items) => {
      const food = items.find(i => ['fish', 'mushrooms', 'berries', 'herbs', 'seaweed'].includes(i.name));
      return {
        name: `Salted ${food.name}`,
        type: 'consumable',
        rarity: 'Uncommon',
        description: `${food.name} preserved with salt. Lasts much longer.`,
      };
    },
    propOverrides: { decay_rate: 0.02, energy: 18 },
    consume: 'all',
    priority: 10,
  },
  {
    id: 'herbal_medicine',
    force: 'dissolve',
    name: 'Herbal Medicine',
    check: (items) => {
      const hasHerb = items.some(i => ['herbs', 'flowers', 'mushrooms'].includes(i.name));
      const hasWater = items.some(i => ['freshwater', 'cactus_water'].includes(i.name));
      return hasHerb && hasWater;
    },
    produce: () => ({
      name: 'Herbal Tonic',
      type: 'consumable',
      rarity: 'Uncommon',
      description: 'Healing infusion of herbs and clean water. Restores health.',
    }),
    propOverrides: { energy: 30, toxicity: 0, organic: 1, decay_rate: 0.2 },
    consume: 'all',
    priority: 12,
  },

  // ── Building Materials ──
  {
    id: 'make_bricks',
    force: 'heat',
    name: 'Brick Firing',
    check: (items, zone) => {
      const hasClay = items.some(i => i.name === 'clay');
      const hasSand = items.some(i => ['sand', 'pebbles'].includes(i.name));
      const heat = items.reduce((s, i) => s + (i.properties?.temperature || 0), 0) + (zone === 'rocky' ? 400 : 0);
      return hasClay && hasSand && heat >= 200;
    },
    produce: () => ({
      name: 'Bricks',
      type: 'material',
      rarity: 'Common',
      description: 'Kiln-fired clay and sand bricks. Strong building material.',
    }),
    propOverrides: { hardness: 7, brittleness: 4, weight: 5, malleability: 0, fertility: 0 },
    consume: ['clay', 'sand'],
    priority: 10,
  },
  {
    id: 'make_glass',
    force: 'heat',
    name: 'Glassmaking',
    check: (items, zone) => {
      const hasSand = items.some(i => i.name === 'sand');
      const heat = items.reduce((s, i) => s + (i.properties?.temperature || 0), 0) + (zone === 'rocky' ? 400 : 0);
      return hasSand && heat >= 500; // sand melts at high temp
    },
    produce: () => ({
      name: 'Glass',
      type: 'material',
      rarity: 'Uncommon',
      description: 'Molten sand cooled into transparent glass. Fragile but useful.',
    }),
    propOverrides: { hardness: 5, brittleness: 9, luminosity: 3, sharpness: 4, weight: 1 },
    consume: ['sand'],
    priority: 13,
  },

  // ── Smelting Chain ──
  {
    id: 'smelt_ore',
    force: 'heat',
    name: 'Ore Smelting',
    check: (items, zone) => {
      const hasOre = items.some(i => i.name === 'ore');
      const heat = items.reduce((s, i) => s + (i.properties?.temperature || 0), 0) + (zone === 'rocky' ? 400 : 0);
      return hasOre && heat >= 800;
    },
    produce: () => ({
      name: 'Iron Ingot',
      type: 'material',
      rarity: 'Uncommon',
      description: 'Raw ore smelted into workable iron. The foundation of metalwork.',
    }),
    propOverrides: { hardness: 8, malleability: 7, conductivity: 5, weight: 6, melt_point: 1540 },
    consume: ['ore'],
    priority: 15,
  },
  {
    id: 'forge_iron_tool',
    force: 'impact',
    name: 'Iron Forging',
    check: (items) => {
      const hasIngot = items.some(i => i.name === 'Iron Ingot');
      const hasWood = items.some(i => ['wood', 'driftwood'].includes(i.name));
      return hasIngot && hasWood;
    },
    produce: () => ({
      name: 'Iron Axe',
      type: 'tool',
      rarity: 'Uncommon',
      description: 'A forged iron axe. Far superior to stone tools.',
    }),
    propOverrides: { hardness: 8, sharpness: 7, weight: 5 },
    consume: 'all',
    priority: 14,
  },

  // ── Fertilizer ──
  {
    id: 'make_fertilizer',
    force: 'combine',
    name: 'Fertilizer Mixing',
    check: (items) => {
      const hasGuano = items.some(i => ['bat_guano', 'peat'].includes(i.name));
      const hasOrganic = items.some(i => ['herbs', 'seaweed', 'flowers', 'berries'].includes(i.name));
      return hasGuano && hasOrganic;
    },
    produce: () => ({
      name: 'Rich Fertilizer',
      type: 'material',
      rarity: 'Common',
      description: 'Potent mix of guano and plant matter. Makes anything grow.',
    }),
    propOverrides: { fertility: 10, organic: 1, weight: 1 },
    consume: 'all',
    priority: 10,
  },

  // ── Woven Items ──
  {
    id: 'weave_basket',
    force: 'combine',
    name: 'Basket Weaving',
    check: (items) => {
      const weavable = items.filter(i => ['reeds', 'palm_fronds', 'fiber'].includes(i.name));
      return weavable.length >= 2;
    },
    produce: () => ({
      name: 'Woven Basket',
      type: 'tool',
      rarity: 'Common',
      description: 'A tightly woven basket. Carry more when gathering.',
    }),
    propOverrides: { weight: 0.3, malleability: 5 },
    consume: 'all',
    priority: 10,
  },

  // ── Advanced Discovery ──
  {
    id: 'crystal_lens',
    force: 'heat',
    name: 'Crystal Lens',
    check: (items, zone) => {
      const hasCrystal = items.some(i => i.name === 'crystals');
      const heat = items.reduce((s, i) => s + (i.properties?.temperature || 0), 0) + (zone === 'rocky' ? 400 : 0);
      return hasCrystal && heat >= 700;
    },
    produce: () => ({
      name: 'Crystal Lens',
      type: 'tool',
      rarity: 'Rare',
      description: 'A crystal melted and shaped into a focusing lens. Concentrates light.',
    }),
    propOverrides: { luminosity: 8, conductivity: 9, resonance: 6, brittleness: 5, temperature: 100 },
    consume: ['crystals'],
    priority: 13,
  },

  // ── Phase 2: Multi-step Chain Rules ──

  // Charcoal + ore → higher-quality smelt (charcoal is better fuel)
  {
    id: 'charcoal_smelt',
    force: 'heat',
    name: 'Charcoal Smelting',
    check: (items, zone) => {
      const hasCharcoal = items.some(i => i.name === 'Charcoal');
      const hasOre = items.some(i => i.name === 'ore' || i.name === 'Iron Ore');
      return hasCharcoal && hasOre;
    },
    produce: () => ({
      name: 'Iron Ingot',
      type: 'material',
      rarity: 'Uncommon',
      description: 'Pure iron, smelted with intense charcoal heat. Ready for forging.',
    }),
    propOverrides: { hardness: 8, conductivity: 6, malleability: 7, weight: 5, temperature: 300, melt_point: 1540 },
    consume: 'all',
    priority: 14,
  },

  // Iron Ingot + stone → Anvil (enables better forging)
  {
    id: 'make_anvil',
    force: 'combine',
    name: 'Anvil Crafting',
    check: (items) => {
      return items.some(i => i.name === 'Iron Ingot') && items.some(i => i.name === 'stone' || i.name === 'large_rock');
    },
    produce: () => ({
      name: 'Anvil',
      type: 'tool',
      rarity: 'Rare',
      description: 'A heavy iron anvil. Essential for serious metalwork.',
    }),
    propOverrides: { hardness: 9, weight: 30, malleability: 0, temperature: 20 },
    consume: 'all',
    priority: 12,
  },

  // Iron Ingot + wood → Iron Sword
  {
    id: 'forge_iron_sword',
    force: 'impact',
    name: 'Sword Forging',
    check: (items) => {
      const hasIron = items.some(i => i.name === 'Iron Ingot' || (i.name?.startsWith('Shaped') && i.properties?.temperature > 100));
      const hasWood = items.some(i => i.name === 'wood');
      return hasIron && hasWood;
    },
    produce: () => ({
      name: 'Iron Sword',
      type: 'tool',
      rarity: 'Rare',
      description: 'A forged iron blade with wooden grip. Deadly and beautiful.',
    }),
    propOverrides: { hardness: 8, sharpness: 9, weight: 4, malleability: 3 },
    consume: 'all',
    priority: 13,
  },

  // Resin + fiber → Waterproof Wrap
  {
    id: 'waterproof_wrap',
    force: 'combine',
    name: 'Waterproofing',
    check: (items) => items.some(i => i.name === 'resin') && items.some(i => i.name === 'fiber'),
    produce: () => ({
      name: 'Waterproof Wrap',
      type: 'material',
      rarity: 'Common',
      description: 'Fiber sealed with resin. Repels water.',
    }),
    propOverrides: { solubility: 0, decay_rate: 0.02, malleability: 6 },
    consume: 'all',
    priority: 9,
  },

  // Herbs + freshwater → Herbal Tea (consumable, heals)
  {
    id: 'herbal_tea',
    force: 'heat',
    name: 'Brewing',
    check: (items) => {
      const hasHerbs = items.some(i => i.name === 'herbs');
      const hasWater = items.some(i => i.name === 'freshwater');
      const hasHeat = items.some(i => (i.properties?.temperature || 0) >= 100) || items.length >= 2;
      return hasHerbs && hasWater;
    },
    produce: () => ({
      name: 'Herbal Tea',
      type: 'consumable',
      rarity: 'Common',
      description: 'A warm, soothing brew. Restores energy and calms the mind.',
    }),
    propOverrides: { energy: 20, toxicity: 0, temperature: 60, organic: 1, decay_rate: 0.4 },
    consume: 'all',
    priority: 11,
  },

  // Mushrooms + herbs → Poultice (healing item)
  {
    id: 'make_poultice',
    force: 'combine',
    name: 'Poultice Making',
    check: (items) => items.some(i => i.name === 'mushrooms') && items.some(i => i.name === 'herbs'),
    produce: () => ({
      name: 'Healing Poultice',
      type: 'consumable',
      rarity: 'Uncommon',
      description: 'A medicinal paste. Apply to wounds for rapid healing.',
    }),
    propOverrides: { organic: 1, toxicity: 0, energy: 15, decay_rate: 0.3 },
    consume: 'all',
    priority: 10,
  },

  // Sand + heat → Glass (already in smelt_metal but explicit for sand)
  {
    id: 'make_glass_from_sand',
    force: 'heat',
    name: 'Glassmaking',
    check: (items, zone) => {
      const hasSand = items.some(i => i.name === 'sand');
      const heat = items.reduce((s, i) => s + (i.properties?.temperature || 0), 0) + (zone === 'rocky' ? 400 : 0);
      return hasSand && heat >= 600;
    },
    produce: () => ({
      name: 'Raw Glass',
      type: 'material',
      rarity: 'Uncommon',
      description: 'Molten sand cooled into translucent glass. Fragile but versatile.',
    }),
    propOverrides: { hardness: 5, brittleness: 8, luminosity: 3, conductivity: 2, sharpness: 6, melt_point: 600 },
    consume: ['sand'],
    priority: 12,
  },

  // Bark + resin → Bark Shield
  {
    id: 'bark_shield',
    force: 'combine',
    name: 'Shield Crafting',
    check: (items) => items.some(i => i.name === 'bark') && items.some(i => i.name === 'resin'),
    produce: () => ({
      name: 'Bark Shield',
      type: 'tool',
      rarity: 'Common',
      description: 'Layered bark reinforced with resin. Light but protective.',
    }),
    propOverrides: { hardness: 5, weight: 2, decay_rate: 0.1 },
    consume: 'all',
    priority: 8,
  },

  // Flowers + freshwater → Dye
  {
    id: 'make_dye',
    force: 'dissolve',
    name: 'Dye Extraction',
    check: (items) => items.some(i => i.name === 'flowers') && items.some(i => i.name === 'freshwater'),
    produce: () => ({
      name: 'Natural Dye',
      type: 'material',
      rarity: 'Common',
      description: 'Vibrant pigment extracted from flower petals.',
    }),
    propOverrides: { solubility: 8, organic: 1, luminosity: 2, decay_rate: 0.2 },
    consume: 'all',
    priority: 9,
  },

  // Seaweed + salt → Dried Seaweed (preserved food)
  {
    id: 'dry_seaweed',
    force: 'combine',
    name: 'Drying',
    check: (items) => items.some(i => i.name === 'seaweed') && items.some(i => i.name === 'salt'),
    produce: () => ({
      name: 'Dried Seaweed',
      type: 'consumable',
      rarity: 'Common',
      description: 'Salt-dried seaweed. Nutritious and long-lasting.',
    }),
    propOverrides: { energy: 12, decay_rate: 0.02, organic: 1 },
    consume: 'all',
    priority: 8,
  },

  // Crystals + fiber → Crystal Pendant (social/trade item)
  {
    id: 'crystal_pendant',
    force: 'combine',
    name: 'Jewelry Crafting',
    check: (items) => items.some(i => i.name === 'crystals') && items.some(i => i.name === 'fiber'),
    produce: () => ({
      name: 'Crystal Pendant',
      type: 'decoration',
      rarity: 'Rare',
      description: 'A luminous crystal suspended on woven fiber. Beautiful.',
    }),
    propOverrides: { luminosity: 6, resonance: 7, weight: 0.2 },
    consume: 'all',
    priority: 10,
  },
];

// ═══════════════════════════════════════
// Physics feedback messages (describe what happens, don't hint)
// ═══════════════════════════════════════

const PHYSICS_FEEDBACK = {
  heat: {
    no_effect:    items => `The materials warm slightly but nothing changes.`,
    partial:      items => `Heat ripples through the materials. Something shifts, but not enough.`,
    no_source:    items => `There's no heat source here. The materials sit cold and unchanged.`,
  },
  impact: {
    no_effect:    items => `The impact produces a dull thud. Nothing breaks or shapes.`,
    partial:      items => `Cracks form but the material holds. More force, or a different approach?`,
  },
  cut: {
    no_effect:    items => `Nothing here is sharp enough to cut, or tough enough to resist.`,
  },
  dissolve: {
    no_effect:    items => `The materials sit in liquid without changing.`,
    no_liquid:    items => `There's nothing liquid to dissolve into.`,
  },
  combine: {
    no_effect:    items => `The materials sit together without reacting. Just... stuff.`,
  },
  grow: {
    no_effect:    items => `Nothing takes root. The ground rejects the offering.`,
    wrong_zone:   items => `This isn't fertile ground. Plants need softer earth.`,
  },
  burn: {
    no_effect:    items => `Nothing here catches fire.`,
  },
};

/**
 * Register all gathered resource properties into the main MATERIAL_PROPERTIES map.
 * Call this on server init.
 */
export function registerGatheredResources() {
  let count = 0;
  for (const [name, props] of Object.entries(GATHERED_RESOURCE_PROPERTIES)) {
    if (!MATERIAL_PROPERTIES[name]) {
      MATERIAL_PROPERTIES[name] = props;
      count++;
    }
  }
  console.log(`  📦 Registered ${count} gathered resource properties`);
  return count;
}

/**
 * Get all practical rules (to be merged with FORCE_RULES in experiments.js)
 */
export function getPracticalRules() {
  return PRACTICAL_RULES;
}

export function getPhysicsFeedback(force, context) {
  const fb = PHYSICS_FEEDBACK[force];
  if (!fb) return 'Nothing happens.';
  if (context && fb[context]) return fb[context]();
  return fb.no_effect ? fb.no_effect() : 'Nothing happens.';
}

export { GATHERED_RESOURCE_PROPERTIES };
