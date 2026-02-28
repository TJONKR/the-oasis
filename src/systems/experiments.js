// Experiment Engine — Phase 1 + Force System + Oracle Integration
// Property-based item combination with forces and AI Oracle fallback.

import crypto from 'crypto';
import { getProperties, computeDerivedProperties, getEffectiveHeat, isLiquid, isSharp, MATERIAL_PROPERTIES } from './materials.js';

// ---------- Forces ----------
// 10 forces agents can apply to items
const FORCES = {
  combine: {
    label: 'Combine',
    zones: null, // works anywhere
    sourceCheck: null,
    energyCost: 5,
    proficiencyDomain: 'metalwork',
  },
  heat: {
    label: 'Heat',
    zones: null,
    // Needs a heat source item (temperature >= 100) OR workshop forge
    sourceCheck: (items, zone) => {
      if (zone === 'rocky') return true; // natural forge
      return items.some(i => (i.properties?.temperature || 0) >= 100);
    },
    energyCost: 8,
    proficiencyDomain: 'metalwork',
  },
  impact: {
    label: 'Impact',
    zones: null,
    // Needs a heavy or hard item (weight >= 3 or hardness >= 6)
    sourceCheck: (items) => items.some(i => {
      const p = i.properties || {};
      return (p.weight || 0) >= 3 || (p.hardness || 0) >= 6;
    }),
    energyCost: 6,
    proficiencyDomain: 'mining',
  },
  cut: {
    label: 'Cut',
    zones: null,
    // Needs a sharp item (sharpness >= 4)
    sourceCheck: (items) => items.some(i => isSharp(i)),
    energyCost: 4,
    proficiencyDomain: 'woodcraft',
  },
  dissolve: {
    label: 'Dissolve',
    zones: null,
    // Needs a liquid item (high solubility + low hardness)
    sourceCheck: (items) => items.some(i => isLiquid(i)),
    energyCost: 5,
    proficiencyDomain: 'herbalism',
  },
  grow: {
    label: 'Grow',
    zones: ['grass', 'swamp'],
    sourceCheck: null,
    energyCost: 6,
    proficiencyDomain: 'herbalism',
  },
  burn: {
    label: 'Burn',
    zones: null,
    // Needs a flammable item and heat source
    sourceCheck: (items, zone) => {
      const hasFlammable = items.some(i => (i.properties?.flammability || 0) >= 4);
      const hasHeat = zone === 'rocky' || items.some(i => (i.properties?.temperature || 0) >= 100);
      return hasFlammable && hasHeat;
    },
    energyCost: 7,
    proficiencyDomain: 'metalwork',
  },
  flow: {
    label: 'Flow',
    zones: ['sand', 'coast', 'grass', 'cave', 'swamp'],
    sourceCheck: null,
    energyCost: 4,
    proficiencyDomain: 'exploration',
  },
  decay: {
    label: 'Decay',
    zones: null,
    // Needs organic material
    sourceCheck: (items) => items.some(i => (i.properties?.organic || 0) >= 0.5),
    energyCost: 3,
    proficiencyDomain: 'herbalism',
  },
  ferment: {
    label: 'Ferment',
    zones: null,
    // Needs organic + liquid
    sourceCheck: (items) => {
      const hasOrganic = items.some(i => (i.properties?.organic || 0) >= 0.5);
      const hasLiquid = items.some(i => isLiquid(i));
      return hasOrganic && hasLiquid;
    },
    energyCost: 5,
    proficiencyDomain: 'cooking',
  },
};

// ---------- Force-specific deterministic rules ----------
const FORCE_RULES = [
  {
    id: 'make_charcoal',
    force: 'heat',
    name: 'Pyrolysis',
    check: (items, zone) => {
      if (zone !== 'cave') return false;
      return items.some(i => {
        const p = i.properties || getProperties(i.name);
        return p && (p.organic || 0) >= 1 && (p.flammability || 0) >= 6 && (p.ignition || 0) > 0;
      });
    },
    produce: (items) => {
      const wood = items.find(i => {
        const p = i.properties || getProperties(i.name);
        return p && (p.organic || 0) >= 1 && (p.flammability || 0) >= 6 && (p.ignition || 0) > 0;
      });
      return {
        name: 'Charcoal',
        type: 'material',
        rarity: 'Uncommon',
        description: `${wood.name} slowly pyrolyzed in the cave's oxygen-poor depths into dense charcoal.`,
        propOverrides: MATERIAL_PROPERTIES['Charcoal'],
      };
    },
    priority: 7,
  },
  {
    id: 'smelt_metal',
    force: 'heat',
    name: 'Smelting',
    check: (items, zone) => {
      const heat = getEffectiveHeat(items, zone);
      return items.some(i => {
        const mp = i.properties?.melt_point || 0;
        return mp > 0 && heat >= mp;
      });
    },
    produce: (items, zone) => {
      const heat = getEffectiveHeat(items, zone);
      const melted = items.find(i => (i.properties?.melt_point || 0) > 0 && heat >= (i.properties?.melt_point || 0));
      return {
        name: `Molten ${melted.name}`,
        type: 'material',
        rarity: 'Uncommon',
        description: `${melted.name} heated past its melting point into molten form.`,
        propOverrides: { temperature: 400, malleability: 9, hardness: 1 },
      };
    },
    priority: 10,
  },
  {
    id: 'burn_to_ash',
    force: 'heat',
    name: 'Combustion',
    check: (items, zone) => {
      const heat = getEffectiveHeat(items, zone);
      return items.some(i => {
        const ig = i.properties?.ignition || 0;
        return ig > 0 && heat >= ig && (i.properties?.flammability || 0) >= 4;
      });
    },
    produce: (items, zone) => {
      const heat = getEffectiveHeat(items, zone);
      const burned = items.find(i => {
        const ig = i.properties?.ignition || 0;
        return ig > 0 && heat >= ig && (i.properties?.flammability || 0) >= 4;
      });
      return {
        name: `${burned.name} Ash`,
        type: 'material',
        rarity: 'Common',
        description: `The charred remains of ${burned.name}. Surprisingly fertile.`,
        propOverrides: { flammability: 0, temperature: 60, fertility: 5, organic: 0.5, weight: 0.1 },
      };
    },
    priority: 5,
  },
  {
    id: 'shatter_brittle',
    force: 'impact',
    name: 'Shatter',
    check: (items) => items.some(i => (i.properties?.brittleness || 0) >= 6),
    produce: (items) => {
      const brittle = items.find(i => (i.properties?.brittleness || 0) >= 6);
      return {
        name: `${brittle.name} Shards`,
        type: 'material',
        rarity: 'Common',
        description: `Sharp fragments of shattered ${brittle.name}.`,
        propOverrides: { sharpness: 7, brittleness: 3, weight: 0.2 },
      };
    },
    priority: 8,
  },
  {
    id: 'shape_hot_metal',
    force: 'impact',
    name: 'Forging',
    check: (items) => items.some(i =>
      (i.properties?.malleability || 0) >= 5 && (i.properties?.temperature || 0) >= 200
    ),
    produce: (items) => {
      const shaped = items.find(i =>
        (i.properties?.malleability || 0) >= 5 && (i.properties?.temperature || 0) >= 200
      );
      return {
        name: `Shaped ${shaped.name}`,
        type: 'tool',
        rarity: 'Uncommon',
        description: `Carefully hammered ${shaped.name} formed into a useful tool.`,
        propOverrides: { hardness: 7, malleability: 2 },
      };
    },
    priority: 6,
  },
  {
    id: 'carve_soft',
    force: 'cut',
    name: 'Carving',
    check: (items) => {
      const hasSharp = items.some(i => isSharp(i));
      const hasSoft = items.some(i => !isSharp(i) && (i.properties?.hardness || 0) <= 5);
      return hasSharp && hasSoft;
    },
    produce: (items) => {
      const soft = items.find(i => !isSharp(i) && (i.properties?.hardness || 0) <= 5);
      return {
        name: `Carved ${soft.name}`,
        type: 'decoration',
        rarity: 'Uncommon',
        description: `Intricately carved ${soft.name}.`,
        propOverrides: {},
      };
    },
    priority: 5,
  },
  {
    id: 'dissolve_soluble',
    force: 'dissolve',
    name: 'Dissolution',
    check: (items) => {
      const hasLiq = items.some(i => isLiquid(i));
      const hasSoluble = items.some(i => !isLiquid(i) && (i.properties?.solubility || 0) >= 4);
      return hasLiq && hasSoluble;
    },
    produce: (items) => {
      const soluble = items.find(i => !isLiquid(i) && (i.properties?.solubility || 0) >= 4);
      return {
        name: `${soluble.name} Solution`,
        type: 'consumable',
        rarity: 'Uncommon',
        description: `${soluble.name} dissolved into a potent solution.`,
        propOverrides: { solubility: 8, hardness: 0 },
      };
    },
    priority: 7,
  },
  {
    id: 'grow_plant',
    force: 'grow',
    name: 'Cultivation',
    check: (items) => {
      const hasOrganic = items.some(i => (i.properties?.organic || 0) >= 0.5);
      const hasFertile = items.some(i => (i.properties?.fertility || 0) >= 4);
      return hasOrganic && hasFertile;
    },
    produce: (items) => {
      const organic = items.find(i => (i.properties?.organic || 0) >= 0.5);
      return {
        name: `Cultivated ${organic.name}`,
        type: 'consumable',
        rarity: 'Uncommon',
        description: `Carefully grown ${organic.name}, more potent than the wild variety.`,
        propOverrides: { organic: 1, energy: 20, fertility: 6 },
      };
    },
    priority: 6,
  },
  {
    id: 'ferment_organic',
    force: 'ferment',
    name: 'Fermentation',
    check: (items) => {
      const hasOrganic = items.some(i => (i.properties?.organic || 0) >= 0.5);
      const hasLiq = items.some(i => isLiquid(i));
      return hasOrganic && hasLiq;
    },
    produce: (items) => {
      const organic = items.find(i => (i.properties?.organic || 0) >= 0.5 && !isLiquid(i));
      const source = organic || items[0];
      return {
        name: `Fermented ${source.name}`,
        type: 'consumable',
        rarity: 'Uncommon',
        description: `Aged ${source.name}, transformed through fermentation.`,
        propOverrides: { toxicity: 1, energy: 15, decay_rate: 0.1 },
      };
    },
    priority: 5,
  },
  {
    id: 'compost_decay',
    force: 'decay',
    name: 'Decomposition',
    check: (items) => items.some(i => (i.properties?.organic || 0) >= 0.5),
    produce: (items) => {
      return {
        name: 'Compost',
        type: 'material',
        rarity: 'Common',
        description: 'Rich organic compost, perfect for growing things.',
        propOverrides: { fertility: 8, organic: 1, decay_rate: 0.1, weight: 1 },
      };
    },
    priority: 3,
  },
  {
    id: 'burn_item',
    force: 'burn',
    name: 'Burning',
    check: (items) => items.some(i => (i.properties?.flammability || 0) >= 4),
    produce: (items) => {
      const flammable = items.find(i => (i.properties?.flammability || 0) >= 4);
      return {
        name: `${flammable.name} Cinder`,
        type: 'material',
        rarity: 'Common',
        description: `Deliberately burned ${flammable.name}. Hot embers remain.`,
        propOverrides: { flammability: 1, temperature: 150, luminosity: 3 },
      };
    },
    priority: 4,
  },
];

// Original interaction rules (for 'combine' force): check combined/summed properties
const INTERACTION_RULES = [
  {
    id: 'electrical_device',
    name: 'Electrical Device',
    check: (c) => c.conductivity > 15 && c.energy > 30,
    type: 'tool',
    rarity: 'Rare',
    nameGen: (inputs) => `${inputs[0].name} Conduit`,
    description: 'Hums with electrical energy.',
    propOverrides: { luminosity: 4, temperature: 45 },
    priority: 10,
  },
  {
    id: 'explosion',
    name: 'Explosion',
    check: (c) => c.volatility > 8 && c.energy > 25,
    type: 'explosion',
    rarity: null,
    nameGen: () => null,
    description: 'The materials react violently!',
    priority: 20,
  },
  {
    id: 'beacon',
    name: 'Beacon',
    check: (c) => c.luminosity > 8 && c.resonance > 10,
    type: 'tool',
    rarity: 'Rare',
    nameGen: (inputs) => `${inputs[0].name} Beacon`,
    description: 'Pulses with amplified light and resonance.',
    propOverrides: { luminosity: 8, resonance: 9 },
    priority: 8,
  },
  {
    id: 'resonance_amplifier',
    name: 'Resonance Amplifier',
    check: (c) => c.resonance > 14,
    type: 'tool',
    rarity: 'Rare',
    nameGen: (inputs) => `Resonant ${inputs[0].name}`,
    description: 'Vibrates at a deep harmonic frequency.',
    propOverrides: { resonance: 10 },
    priority: 7,
  },
  {
    id: 'cooking',
    name: 'Cooked Creation',
    check: (c) => c.organic > 1 && c.temperature > 80,
    type: 'consumable',
    rarity: 'Uncommon',
    nameGen: (inputs) => `Cooked ${inputs[0].name}`,
    description: 'Heat-transformed organic matter.',
    propOverrides: { decay_rate: 0.5, energy: 15 },
    priority: 5,
  },
  {
    id: 'sturdy_tool',
    name: 'Sturdy Tool',
    check: (c) => c.hardness > 14 && c.weight > 8,
    type: 'tool',
    rarity: 'Uncommon',
    nameGen: (inputs) => `Reinforced ${inputs[0].name}`,
    description: 'Exceptionally hard and heavy.',
    propOverrides: { hardness: 9 },
    priority: 6,
  },
  {
    id: 'signal_device',
    name: 'Signal Device',
    check: (c) => c.conductivity > 12 && c.resonance > 10,
    type: 'tool',
    rarity: 'Rare',
    nameGen: (inputs) => `${inputs[0].name} Transmitter`,
    description: 'Capable of sending and receiving signals.',
    propOverrides: { resonance: 8, conductivity: 9 },
    priority: 9,
  },
  {
    id: 'memory_artifact',
    name: 'Memory Artifact',
    check: (c) => c.resonance > 10 && c.organic > 1,
    type: 'special',
    rarity: 'Rare',
    nameGen: (inputs) => `Memory of ${inputs[0].name}`,
    description: 'Holds echoes of the past.',
    propOverrides: { resonance: 9, decay_rate: 0.1 },
    priority: 6,
  },
  {
    id: 'light_source',
    name: 'Light Source',
    check: (c) => c.flammability > 10 && c.energy > 15,
    type: 'tool',
    rarity: 'Common',
    nameGen: (inputs) => `${inputs[0].name} Lamp`,
    description: 'Burns with a steady glow.',
    propOverrides: { luminosity: 7, temperature: 200 },
    priority: 4,
  },
  {
    id: 'toxic_compound',
    name: 'Toxic Compound',
    check: (c) => c.toxicity > 5 && c.organic > 0.5,
    type: 'consumable',
    rarity: 'Uncommon',
    nameGen: (inputs) => `${inputs[0].name} Poison`,
    description: 'A dangerous concoction.',
    propOverrides: { toxicity: 8 },
    priority: 3,
  },
  {
    id: 'decorative_piece',
    name: 'Decorative Piece',
    check: (c) => c.luminosity > 6 && c.hardness > 6,
    type: 'decoration',
    rarity: 'Uncommon',
    nameGen: (inputs) => `Polished ${inputs[0].name}`,
    description: 'Beautiful and durable.',
    propOverrides: {},
    priority: 2,
  },
  {
    id: 'composite',
    name: 'Composite Material',
    check: (c) => c.hardness > 10 && c.conductivity > 8,
    type: 'material',
    rarity: 'Uncommon',
    nameGen: (inputs) => `${inputs[0].name}-${inputs[1].name} Alloy`,
    description: 'A fused composite material.',
    propOverrides: {},
    priority: 1,
  },
];

export function initExperiments(shared) {
  const { loadJSON, saveJSON, agents, agentStore, ensureAgentStats, broadcast, addWorldNews, awardXP } = shared;

  const discoveries = loadJSON('discoveries.json', []);
  const knownProperties = loadJSON('known-properties.json', {});
  const cooldowns = new Map();

  // Oracle wired in later via setOracle()
  let oracle = null;

  function setOracle(o) { oracle = o; }

  function computeCombined(items) {
    const combined = {};
    const propKeys = ['hardness','conductivity','flammability','toxicity','luminosity','volatility','organic','weight','decay_rate','energy','temperature','resonance'];
    for (const key of propKeys) {
      combined[key] = items.reduce((sum, item) => {
        const props = item.properties || getProperties(item.name) || {};
        return sum + (props[key] || 0);
      }, 0);
    }
    return combined;
  }

  function findMatchingRule(combined) {
    const matches = INTERACTION_RULES.filter(r => r.check(combined));
    if (matches.length === 0) return null;
    matches.sort((a, b) => b.priority - a.priority);
    return matches[0];
  }

  function findMatchingForceRule(force, items, zone) {
    const applicable = FORCE_RULES.filter(r => r.force === force && r.check(items, zone));
    if (applicable.length === 0) return null;
    applicable.sort((a, b) => b.priority - a.priority);
    return applicable[0];
  }

  function getDiscoveryKey(itemNames, force = 'combine') {
    return force + ':' + [...itemNames].sort().join(' + ');
  }

  function revealProperties(agentId, itemNames) {
    if (!knownProperties[agentId]) knownProperties[agentId] = {};
    for (const name of itemNames) {
      if (!knownProperties[agentId][name]) knownProperties[agentId][name] = [];
      const props = getProperties(name);
      if (!props) continue;
      const allKeys = Object.keys(props);
      const known = knownProperties[agentId][name];
      const unknown = allKeys.filter(k => !known.includes(k));
      const toReveal = unknown.sort(() => Math.random() - 0.5).slice(0, 2 + Math.floor(Math.random() * 2));
      known.push(...toReveal);
    }
    saveJSON('known-properties.json', knownProperties);
    return knownProperties[agentId];
  }

  function buildResultItem(agent, inputItems, name, type, rarity, description, propOverrides, zone, force) {
    const resultProps = computeDerivedProperties(inputItems, propOverrides);
    return {
      id: 'item_' + crypto.randomBytes(4).toString('hex'),
      name,
      type,
      rarity,
      description,
      zone_origin: zone || 'rocky',
      stackable: false,
      quantity: 1,
      properties: resultProps,
      craftedBy: agent.id,
      experimentOrigin: true,
      force: force || 'combine',
      craftedAt: new Date().toISOString(),
    };
  }

  // Core experiment logic — now force-aware and async (for oracle)
  async function runExperiment(agent, inputItems, force = 'combine', zone = 'rocky') {
    const itemNames = inputItems.map(i => i.name);
    const propertiesRevealed = revealProperties(agent.id, itemNames);

    // 1. Check oracle recipe cache (instant, free)
    if (oracle) {
      const cached = oracle.findRecipe(force, itemNames);
      if (cached) {
        const r = cached.result;
        const resultItem = buildResultItem(agent, inputItems, r.name, r.type, r.rarity, r.description, r.properties || {}, zone, force);
        const key = getDiscoveryKey(itemNames, force);
        const isFirstDiscovery = !discoveries.find(d => d.key === key);
        if (isFirstDiscovery) {
          discoveries.push({ key, items: itemNames, result: r.name, source: 'oracle_cache', discoveredBy: agent.id, discovererName: agent.name, discoveredAt: new Date().toISOString() });
          saveJSON('discoveries.json', discoveries);
        }
        return {
          success: true,
          result_item: resultItem,
          rule_matched: 'oracle_recipe',
          discovery: isFirstDiscovery ? { first: true, discoverer: agent.name } : null,
          properties_revealed: propertiesRevealed,
          message: isFirstDiscovery ? `NEW DISCOVERY! ${agent.name} created ${r.name}!` : `Created ${r.name}.`,
        };
      }
    }

    // 2. Check FORCE_RULES (force-specific deterministic rules)
    if (force !== 'combine') {
      const forceRule = findMatchingForceRule(force, inputItems, zone);
      if (forceRule) {
        const produced = forceRule.produce(inputItems, zone);
        const resultItem = buildResultItem(agent, inputItems, produced.name, produced.type, produced.rarity, produced.description, produced.propOverrides, zone, force);
        const key = getDiscoveryKey(itemNames, force);
        const isFirstDiscovery = !discoveries.find(d => d.key === key);
        if (isFirstDiscovery) {
          discoveries.push({ key, items: itemNames, result: produced.name, ruleId: forceRule.id, discoveredBy: agent.id, discovererName: agent.name, discoveredAt: new Date().toISOString() });
          saveJSON('discoveries.json', discoveries);
        }
        return {
          success: true,
          result_item: resultItem,
          rule_matched: forceRule.id,
          properties_revealed: propertiesRevealed,
          discovery: isFirstDiscovery ? { first: true, discoverer: agent.name } : null,
          message: isFirstDiscovery ? `NEW DISCOVERY! ${agent.name} created ${produced.name} via ${forceRule.name}!` : `Created ${produced.name} via ${forceRule.name}.`,
        };
      }
    }

    // 3. Check INTERACTION_RULES (original combine rules)
    if (force === 'combine') {
      const combined = computeCombined(inputItems);
      const rule = findMatchingRule(combined);

      if (rule) {
        if (rule.type === 'explosion') {
          return {
            success: false,
            destroyed: true,
            explosion: true,
            message: 'BOOM! The volatile materials exploded! Items destroyed.',
            properties_revealed: propertiesRevealed,
          };
        }

        const resultName = rule.nameGen(inputItems);
        const resultItem = buildResultItem(agent, inputItems, resultName, rule.type, rule.rarity, rule.description, rule.propOverrides, zone, force);

        const key = getDiscoveryKey(itemNames, force);
        const isFirstDiscovery = !discoveries.find(d => d.key === key);
        if (isFirstDiscovery) {
          discoveries.push({ key, items: itemNames, result: resultName, ruleId: rule.id, discoveredBy: agent.id, discovererName: agent.name, discoveredAt: new Date().toISOString() });
          saveJSON('discoveries.json', discoveries);
        }

        return {
          success: true,
          result_item: resultItem,
          rule_matched: rule.id,
          discovery: isFirstDiscovery ? { first: true, discoverer: agent.name } : null,
          properties_revealed: propertiesRevealed,
          message: isFirstDiscovery ? `NEW DISCOVERY! ${agent.name} created ${resultName}!` : `Created ${resultName}.`,
        };
      }
    }

    // 4. Physics plausibility check + Oracle fallback
    if (oracle) {
      // Simple plausibility: does the force make physical sense with these items?
      const plausible = checkPlausibility(force, inputItems, zone);
      if (plausible) {
        const oracleResult = await oracle.consultOracle(agent, force, inputItems, zone);

        if (oracleResult.consulted && oracleResult.approved && oracleResult.result) {
          const r = oracleResult.result;
          const resultItem = buildResultItem(agent, inputItems, r.name, r.type, r.rarity, r.description, r.properties || {}, zone, force);

          const key = getDiscoveryKey(itemNames, force);
          const isFirstDiscovery = !discoveries.find(d => d.key === key);
          if (isFirstDiscovery) {
            discoveries.push({ key, items: itemNames, result: r.name, source: 'oracle', discoveredBy: agent.id, discovererName: agent.name, discoveredAt: new Date().toISOString() });
            saveJSON('discoveries.json', discoveries);
          }

          return {
            success: true,
            result_item: resultItem,
            rule_matched: 'oracle',
            oracle_discovery: true,
            discovery: isFirstDiscovery ? { first: true, discoverer: agent.name } : null,
            properties_revealed: propertiesRevealed,
            message: isFirstDiscovery
              ? `ORACLE DISCOVERY! ${agent.name} created ${r.name}!`
              : `Created ${r.name}.`,
            oracle_feedback: oracleResult.feedback,
          };
        }

        // Oracle rejected or had an error
        if (oracleResult.consulted && oracleResult.feedback) {
          return {
            success: false,
            destroyed: false,
            message: oracleResult.feedback,
            properties_revealed: propertiesRevealed,
            oracle_consulted: true,
          };
        }

        if (oracleResult.consulted && oracleResult.error) {
          return {
            success: false,
            destroyed: false,
            message: `The Oracle faltered: ${oracleResult.error}`,
            properties_revealed: propertiesRevealed,
            oracle_consulted: true,
          };
        }

        if (!oracleResult.consulted && oracleResult.reason) {
          // Rate limited or no API key — fall through to failure
        }
      }
    }

    // 5. No match anywhere — physics-flavored failure
    const destroyed = Math.random() < 0.3;
    const failMessage = getPhysicsFailureMessage(force, inputItems);
    return {
      success: false,
      destroyed,
      message: destroyed
        ? `The experiment failed catastrophically! Materials destroyed. ${failMessage}`
        : `Nothing happened. ${failMessage}`,
      properties_revealed: propertiesRevealed,
    };
  }

  function checkPlausibility(force, items, zone) {
    // Basic physics checks — is this combination worth asking the oracle about?
    switch (force) {
      case 'heat': {
        const heat = getEffectiveHeat(items, zone);
        return heat >= 50; // need some meaningful heat
      }
      case 'dissolve': {
        return items.some(i => isLiquid(i)) && items.some(i => (i.properties?.solubility || 0) >= 2);
      }
      case 'cut': {
        return items.some(i => isSharp(i));
      }
      case 'grow': {
        return items.some(i => (i.properties?.organic || 0) >= 0.5);
      }
      case 'ferment': {
        return items.some(i => (i.properties?.organic || 0) >= 0.5);
      }
      default:
        return true; // combine, impact, burn, flow, decay — always plausible
    }
  }

  function getPhysicsFailureMessage(force, items) {
    switch (force) {
      case 'heat': return 'Not enough heat to transform these materials.';
      case 'cut': return 'Nothing sharp enough to cut with, or nothing soft enough to carve.';
      case 'dissolve': return 'No suitable liquid or soluble material.';
      case 'grow': return 'These materials lack the organic essence to cultivate.';
      case 'impact': return 'The impact produces no useful result.';
      case 'burn': return 'Nothing flammable enough to sustain combustion.';
      case 'ferment': return 'Fermentation requires organic material and liquid.';
      case 'flow': return 'The materials resist reshaping by water and current.';
      case 'decay': return 'No organic matter to decompose.';
      default: return 'The materials don\'t interact in any useful way.';
    }
  }

  function setupRoutes(app, authAgent) {
    // Experiment endpoint — now async + force-aware
    app.post('/api/agent/experiment', authAgent, async (req, res) => {
      const agent = req.agent;
      ensureAgentStats(agent);

      const force = req.body.force || 'combine';
      const forceConfig = FORCES[force];
      if (!forceConfig) {
        return res.status(400).json({ error: `Unknown force: ${force}. Valid: ${Object.keys(FORCES).join(', ')}` });
      }

      // Zone check: per-force restrictions
      if (forceConfig.zones && !forceConfig.zones.includes(agent.zone)) {
        return res.status(400).json({ error: `${forceConfig.label} can only be done in: ${forceConfig.zones.join(', ')}` });
      }

      const { item_ids } = req.body;
      if (!item_ids || !Array.isArray(item_ids) || item_ids.length < 2 || item_ids.length > 3) {
        return res.status(400).json({ error: 'Provide 2-3 item_ids' });
      }

      // Cooldown: 2 minutes
      const now = Date.now();
      const lastExp = cooldowns.get(agent.id) || 0;
      if (now - lastExp < 120000) {
        const remaining = Math.ceil((120000 - (now - lastExp)) / 1000);
        return res.status(429).json({ error: `Experiment cooldown: ${remaining}s remaining` });
      }

      // Experiment fee
      if (shared.economyV2) {
        const feeResult = shared.economyV2.chargeExperimentFee(agent);
        if (!feeResult.charged) return res.status(400).json({ error: feeResult.error });
      }

      // Find items in inventory
      const inputItems = [];
      for (const itemId of item_ids) {
        const idx = agent.inventory.findIndex(i => i.id === itemId);
        if (idx === -1) return res.status(400).json({ error: `Item ${itemId} not in inventory` });
        inputItems.push(agent.inventory[idx]);
      }

      // Attach properties if missing
      for (const item of inputItems) {
        if (!item.properties) {
          const props = getProperties(item.name);
          if (props) item.properties = { ...props };
        }
      }

      // Source requirement check
      if (forceConfig.sourceCheck && !forceConfig.sourceCheck(inputItems, agent.zone)) {
        return res.status(400).json({ error: `${forceConfig.label} requires specific materials. Check the force requirements.` });
      }

      // Energy cost
      const energyCost = forceConfig.energyCost || 5;
      if ((agent.energy || 0) < energyCost) {
        return res.status(400).json({ error: `Not enough energy. ${forceConfig.label} costs ${energyCost} energy.` });
      }
      agent.energy = (agent.energy || 100) - energyCost;

      cooldowns.set(agent.id, now);

      const result = await runExperiment(agent, inputItems, force, agent.zone);

      // Consume items
      const consumed = [];
      if (result.success || result.destroyed) {
        for (const itemId of item_ids) {
          const idx = agent.inventory.findIndex(i => i.id === itemId);
          if (idx !== -1) {
            const item = agent.inventory[idx];
            if (item.stackable && item.quantity > 1) {
              item.quantity--;
            } else {
              agent.inventory.splice(idx, 1);
            }
            consumed.push(item.name);
          }
        }
      }

      // Add result to inventory if success
      if (result.success && result.result_item) {
        if (agent.inventory.length >= 28) {
          return res.status(409).json({ error: 'Inventory full! Cannot store experiment result.' });
        }
        agent.inventory.push(result.result_item);
      }

      // Zone evolution: track experiment
      if (shared.zoneEvolution) shared.zoneEvolution.trackActivity(agent.zone, 'experiments');

      // XP + proficiency
      let xpResult;
      if (result.success) {
        const isOracleDiscovery = result.oracle_discovery;
        const bonus = (result.discovery ? 50 : 0) + (isOracleDiscovery ? 100 : 0);
        xpResult = awardXP(agent, 30 + bonus, 'experiment');
        broadcast({ type: 'experimentSuccess', agentId: agent.id, name: agent.name, result: result.result_item?.name, discovery: !!result.discovery, force });
        addWorldNews('experiment', agent.id, agent.name, result.message, agent.zone);

        // Proficiency: force_experiment
        if (shared.proficiency && force !== 'combine') {
          shared.proficiency.addProficiencyXP(agent.id, forceConfig.proficiencyDomain, 15);
        }
        // Proficiency: oracle_discovery
        if (shared.proficiency && isOracleDiscovery) {
          shared.proficiency.addProficiencyXP(agent.id, 'scholarship', 25);
        }

        // Observation learning
        if (shared.knowledgeSystem?.onObservableAction && result.result_item) {
          shared.knowledgeSystem.onObservableAction(agent, 'recipe', result.result_item.name);
        }
        // Knowledge system: learn recipe
        if (shared.knowledgeSystem?.learnRecipe && result.result_item) {
          shared.knowledgeSystem.learnRecipe(agent.id, itemNames_for_knowledge(inputItems, force));
        }
      } else {
        xpResult = awardXP(agent, 10, 'experiment_fail');
        if (result.explosion) {
          broadcast({ type: 'explosion', agentId: agent.id, name: agent.name, zone: agent.zone });
          addWorldNews('explosion', agent.id, agent.name, result.message, agent.zone);
        }
      }

      agentStore[agent.id] = agent;
      saveJSON('agents.json', agentStore);

      res.json({
        ...result,
        force,
        items_consumed: consumed,
        energy_cost: energyCost,
        ...xpResult,
      });
    });

    // Available forces
    app.get('/api/experiments/forces', (req, res) => {
      const forces = Object.entries(FORCES).map(([id, f]) => ({
        id,
        label: f.label,
        zones: f.zones,
        energyCost: f.energyCost,
        proficiencyDomain: f.proficiencyDomain,
        needsSource: !!f.sourceCheck,
      }));
      res.json({ forces });
    });

    // Public discoveries
    app.get('/api/experiments/discoveries', (req, res) => {
      res.json({
        discoveries: discoveries.map(d => ({
          items: d.items,
          result: d.result,
          discoveredBy: d.discovererName,
          discoveredAt: d.discoveredAt,
          source: d.source || 'rules',
        })),
      });
    });

    // Material properties lookup (only shows what agent has discovered)
    app.get('/api/materials/:itemName/properties', (req, res) => {
      const itemName = req.params.itemName;
      const allProps = getProperties(itemName);
      if (!allProps) return res.status(404).json({ error: 'Unknown material' });

      const auth = req.headers.authorization;
      if (auth?.startsWith('Bearer ')) {
        const token = auth.slice(7);
        const agent = Array.from(agents.values()).find(a => a.token === token);
        if (agent && knownProperties[agent.id]?.[itemName]) {
          const known = knownProperties[agent.id][itemName];
          const filtered = {};
          for (const key of known) {
            if (allProps[key] !== undefined) filtered[key] = allProps[key];
          }
          return res.json({ item: itemName, properties: filtered, known_count: known.length, total_count: Object.keys(allProps).length });
        }
        return res.json({ item: itemName, properties: {}, known_count: 0, total_count: Object.keys(allProps).length, hint: 'Experiment with this material to discover its properties!' });
      }

      return res.json({ item: itemName, property_names: Object.keys(allProps), hint: 'Authenticate and experiment to see values!' });
    });
  }

  function itemNames_for_knowledge(inputItems, force) {
    return `${force}:${inputItems.map(i => i.name).sort().join('+')}`;
  }

  return { setupRoutes, runExperiment, getDiscoveries: () => discoveries, setOracle, FORCES };
}

export { FORCES, FORCE_RULES, INTERACTION_RULES };
