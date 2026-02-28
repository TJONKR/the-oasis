// Cooking System
// Dedicated cooking mechanics with quality tiers, spoilage, and proficiency integration.
// The experiment system handles generic property-based reactions (organic > 1 && temperature > 80).
// This module provides intentional cooking: selecting food items, applying heat, and producing
// quality-tiered meals whose energy and spoilage scale with the agent's cooking proficiency.

import crypto from 'crypto';
import { getProperties } from './materials.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const QUALITY_TIERS = Object.freeze({
  raw:      { label: 'Raw',      minLevel: -1, energyMult: 1.0, spoilRate: 1.0  },
  cooked:   { label: 'Cooked',   minLevel: 0,  energyMult: 1.5, spoilRate: 0.5  },
  seasoned: { label: 'Seasoned', minLevel: 10, energyMult: 2.0, spoilRate: 0.4  },
  gourmet:  { label: 'Gourmet',  minLevel: 20, energyMult: 2.5, spoilRate: 0.33 },
});

const COOKING_ENERGY_COST = 12;
const MIN_ORGANIC_THRESHOLD = 0.5;
const COMPLEX_RECIPE_SIZE = 3;
const BURN_CHANCE = 0.3;
const BURN_PROFICIENCY_CEILING = 5;
const BURNT_ENERGY_MULT = 0.5;
const INVENTORY_CAP = 28;

// Items that qualify as portable heat sources (high temperature or flammability).
// Agents in the workshop zone do not need one.
const HEAT_SOURCE_NAMES = new Set([
  'Torch', 'Spark Plug', 'Campfire', 'Charcoal',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Determine whether an inventory item counts as a heat source. */
function isHeatSource(item) {
  if (HEAT_SOURCE_NAMES.has(item.name)) return true;
  const props = item.properties || getProperties(item.name);
  if (!props) return false;
  // Anything with temperature >= 100 or flammability >= 7 can provide cooking heat.
  return (props.temperature >= 100) || (props.flammability >= 7);
}

/** Determine whether an inventory item is edible food (organic >= threshold). */
function isFoodItem(item) {
  const props = item.properties || getProperties(item.name);
  if (!props) return false;
  return (props.organic ?? 0) >= MIN_ORGANIC_THRESHOLD;
}

/** Get the base energy value of an item from its properties. */
function getBaseEnergy(item) {
  const props = item.properties || getProperties(item.name);
  if (!props) return 0;
  return props.energy ?? 0;
}

/** Compute the combined base energy across multiple food items. */
function computeCombinedEnergy(items) {
  return items.reduce((sum, item) => sum + getBaseEnergy(item), 0);
}

/** Generate a cooked food name from input items and quality tier. */
function generateCookedName(items, tierLabel, burnt) {
  if (burnt) return `Burnt ${items[0].name}`;
  const primary = items[0].name;
  if (items.length === 1) return `${tierLabel} ${primary}`;
  if (items.length === 2) return `${tierLabel} ${primary} with ${items[1].name}`;
  return `${tierLabel} ${primary} with ${items[1].name} & ${items[2].name}`;
}

/** Compute averaged properties for the cooked result, with cooking-specific overrides. */
function computeCookedProperties(items, energyValue, spoilRate) {
  const propKeys = [
    'hardness', 'conductivity', 'flammability', 'toxicity', 'luminosity',
    'volatility', 'organic', 'weight', 'decay_rate', 'energy',
    'temperature', 'resonance',
  ];
  const result = {};
  for (const key of propKeys) {
    const values = items.map(item => {
      const p = item.properties || getProperties(item.name) || {};
      return p[key] ?? 0;
    });
    result[key] = values.reduce((s, v) => s + v, 0) / values.length;
  }
  // Override with cooked values
  result.energy = energyValue;
  result.decay_rate = spoilRate;
  result.organic = Math.max(result.organic, MIN_ORGANIC_THRESHOLD);
  // Cooking reduces toxicity slightly
  result.toxicity = Math.max(0, result.toxicity * 0.7);
  // Round for cleanliness
  for (const key of propKeys) {
    result[key] = Math.round(result[key] * 100) / 100;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Module entry point
// ---------------------------------------------------------------------------

export function initCooking(shared) {
  const {
    loadJSON, saveJSON, agents, agentStore,
    ensureAgentStats, broadcast, addWorldNews, proficiency,
  } = shared;

  // Persistent cooking history (optional analytics / future features)
  const cookingData = loadJSON('cooking.json', {});

  function save() {
    saveJSON('cooking.json', cookingData);
  }

  // -----------------------------------------------------------------------
  // Quality tier resolution
  // -----------------------------------------------------------------------

  /**
   * Return the quality tier key for an agent based on their cooking proficiency level.
   * @param {string} agentId
   * @returns {string} One of 'raw', 'cooked', 'seasoned', 'gourmet'.
   */
  function getCookingQuality(agentId) {
    if (!proficiency) return 'cooked';
    const prof = proficiency.getProficiency(agentId, 'cooking');
    const level = prof ? prof.level : 0;
    if (level >= 20) return 'gourmet';
    if (level >= 10) return 'seasoned';
    return 'cooked';
  }

  /** Return the numeric cooking proficiency level for an agent. */
  function getCookingLevel(agentId) {
    if (!proficiency) return 0;
    const prof = proficiency.getProficiency(agentId, 'cooking');
    return prof ? prof.level : 0;
  }

  // -----------------------------------------------------------------------
  // Available cooking actions
  // -----------------------------------------------------------------------

  /**
   * Inspect an agent's inventory and return an array of cooking options.
   * Each option describes the food items available and whether a heat source
   * is present.
   *
   * @param {object} agent
   * @returns {{ foodItems: object[], heatSources: object[], hasHeat: boolean, inWorkshop: boolean, canCook: boolean, quality: string }}
   */
  function getAvailableCookingActions(agent) {
    ensureAgentStats(agent);
    const inv = agent.inventory || [];

    const foodItems = inv.filter(isFoodItem);
    const heatSources = inv.filter(isHeatSource);
    const inWorkshop = agent.zone === 'rocky';
    const hasHeat = heatSources.length > 0 || inWorkshop;
    const quality = getCookingQuality(agent.id);

    return {
      foodItems: foodItems.map(i => ({
        id: i.id,
        name: i.name,
        energy: getBaseEnergy(i),
        organic: (i.properties || getProperties(i.name) || {}).organic ?? 0,
      })),
      heatSources: heatSources.map(i => ({ id: i.id, name: i.name })),
      hasHeat,
      inWorkshop,
      canCook: foodItems.length >= 1 && hasHeat,
      quality,
    };
  }

  // -----------------------------------------------------------------------
  // Core cook action
  // -----------------------------------------------------------------------

  /**
   * Cook one to three food items using a heat source.
   *
   * @param {object}   agent        - The agent performing the action.
   * @param {string[]} itemIds      - Array of 1-3 inventory item IDs (food).
   * @param {string}   heatSourceId - Inventory item ID of the heat source, or null
   *                                  if the agent is in the workshop zone.
   * @returns {{ ok: boolean, result_item?: object, quality?: string, energy_value?: number, burnt?: boolean, error?: string }}
   */
  function cook(agent, itemIds, heatSourceId) {
    // --- Validation -----------------------------------------------------------
    ensureAgentStats(agent);

    if (!Array.isArray(itemIds) || itemIds.length < 1 || itemIds.length > 3) {
      return { ok: false, error: 'Provide 1-3 item IDs to cook.' };
    }

    // Deduplicate check — same ID used twice is invalid
    if (new Set(itemIds).size !== itemIds.length) {
      return { ok: false, error: 'Duplicate item IDs are not allowed.' };
    }

    // Energy check
    if ((agent.energy ?? 100) < COOKING_ENERGY_COST) {
      return { ok: false, error: `Not enough energy. Need ${COOKING_ENERGY_COST}, have ${Math.floor(agent.energy ?? 0)}.` };
    }

    // Heat source check
    const inWorkshop = agent.zone === 'rocky';
    let heatItem = null;
    if (!inWorkshop) {
      if (!heatSourceId) {
        return { ok: false, error: 'Need a heat source item or be on rocky terrain.' };
      }
      heatItem = (agent.inventory || []).find(i => i.id === heatSourceId);
      if (!heatItem) {
        return { ok: false, error: 'Heat source not found in inventory.' };
      }
      if (!isHeatSource(heatItem)) {
        return { ok: false, error: `${heatItem.name} is not a valid heat source.` };
      }
      // Heat source must not also be one of the food items
      if (itemIds.includes(heatSourceId)) {
        return { ok: false, error: 'Heat source cannot also be a food ingredient.' };
      }
    }

    // Resolve food items
    const foodItems = [];
    for (const id of itemIds) {
      const item = (agent.inventory || []).find(i => i.id === id);
      if (!item) {
        return { ok: false, error: `Item ${id} not found in inventory.` };
      }
      if (!isFoodItem(item)) {
        return { ok: false, error: `${item.name} is not food (organic < ${MIN_ORGANIC_THRESHOLD}).` };
      }
      foodItems.push(item);
    }

    // Inventory space check — we remove N items and add 1, so we only need
    // space if inventory is at cap and we are net-adding (which never happens
    // since we always remove at least 1). Still, guard against edge cases.
    const netChange = 1 - foodItems.length; // always <= 0
    if (netChange > 0 && (agent.inventory || []).length >= INVENTORY_CAP) {
      return { ok: false, error: 'Inventory full.' };
    }

    // --- Resolution ----------------------------------------------------------

    // Deduct energy
    agent.energy = Math.max(0, (agent.energy ?? 100) - COOKING_ENERGY_COST);

    const cookingLevel = getCookingLevel(agent.id);
    const isComplex = foodItems.length >= COMPLEX_RECIPE_SIZE;
    const shouldBurn = isComplex && cookingLevel < BURN_PROFICIENCY_CEILING && Math.random() < BURN_CHANCE;

    // Determine quality tier
    const tierKey = shouldBurn ? 'raw' : getCookingQuality(agent.id);
    const tier = QUALITY_TIERS[tierKey];

    const baseEnergy = computeCombinedEnergy(foodItems);
    const energyMult = shouldBurn ? BURNT_ENERGY_MULT : tier.energyMult;
    const energyValue = Math.round(baseEnergy * energyMult);
    const spoilRate = shouldBurn ? 1.0 : tier.spoilRate;

    const cookedName = generateCookedName(foodItems, tier.label, shouldBurn);
    const cookedProps = computeCookedProperties(foodItems, energyValue, spoilRate);

    const resultItem = {
      id: 'item_' + crypto.randomBytes(4).toString('hex'),
      name: cookedName,
      type: 'consumable',
      rarity: shouldBurn ? 'Common' : (tierKey === 'gourmet' ? 'Rare' : 'Uncommon'),
      description: shouldBurn
        ? 'Charred beyond recognition. Still technically edible.'
        : `${tier.label} meal prepared with care.`,
      zone_origin: agent.zone,
      stackable: false,
      quantity: 1,
      properties: cookedProps,
      spoil_rate: spoilRate,
      quality: tierKey,
      cookedBy: agent.id,
      cookedAt: new Date().toISOString(),
      ingredients: foodItems.map(i => i.name),
    };

    // --- Inventory mutation ---------------------------------------------------

    // Remove consumed food items
    for (const food of foodItems) {
      const idx = (agent.inventory || []).findIndex(i => i.id === food.id);
      if (idx !== -1) {
        const inv = agent.inventory[idx];
        if (inv.stackable && inv.quantity > 1) {
          inv.quantity--;
        } else {
          agent.inventory.splice(idx, 1);
        }
      }
    }

    // Add result
    agent.inventory.push(resultItem);

    // --- Side effects --------------------------------------------------------

    // Proficiency XP
    if (proficiency) {
      proficiency.onAction(agent.id, 'cook', {
        zone: agent.zone,
        ingredients: foodItems.map(i => i.name),
      });
    }

    // Track in cooking history
    if (!cookingData[agent.id]) cookingData[agent.id] = { totalCooked: 0, totalBurnt: 0 };
    cookingData[agent.id].totalCooked++;
    if (shouldBurn) cookingData[agent.id].totalBurnt++;
    cookingData[agent.id].lastCooked = new Date().toISOString();
    save();

    // Persist agent
    agentStore[agent.id] = agent;
    saveJSON('agents.json', agentStore);

    // Broadcast & news
    if (shouldBurn) {
      broadcast({
        type: 'cookingBurnt',
        agentId: agent.id,
        name: agent.name,
        item: cookedName,
        zone: agent.zone,
      });
      addWorldNews('cooking', agent.id, agent.name,
        `${agent.name} burnt their ${foodItems[0].name} while cooking!`, agent.zone);
    } else {
      broadcast({
        type: 'cookingSuccess',
        agentId: agent.id,
        name: agent.name,
        item: cookedName,
        quality: tierKey,
        zone: agent.zone,
      });
      if (tierKey === 'gourmet') {
        addWorldNews('cooking', agent.id, agent.name,
          `${agent.name} prepared a gourmet ${cookedName}!`, agent.zone);
      }
    }

    return {
      ok: true,
      result_item: resultItem,
      quality: tierKey,
      energy_value: energyValue,
      burnt: shouldBurn,
    };
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  return {
    cook,
    getCookingQuality,
    getAvailableCookingActions,
    QUALITY_TIERS,
  };
}
