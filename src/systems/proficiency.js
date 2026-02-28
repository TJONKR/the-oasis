// Proficiency System — 8 domains with granular leveling and gameplay effects
// Replaces the old 4-specialization threshold system

const DOMAINS = ['metalwork', 'herbalism', 'mining', 'woodcraft', 'scholarship', 'commerce', 'exploration', 'cooking'];

const MAX_LEVEL = 50;

// Domain display names for titles
const DOMAIN_NAMES = {
  metalwork: 'Metalworker',
  herbalism: 'Herbalist',
  mining: 'Miner',
  woodcraft: 'Woodcrafter',
  scholarship: 'Scholar',
  commerce: 'Merchant',
  exploration: 'Explorer',
  cooking: 'Cook',
};

// Level thresholds: each level requires 50 more XP than the previous gap
// Level 0: 0, Level 1: 50, Level 2: 150, Level 3: 300, Level 4: 500, ...
function buildLevelThresholds() {
  const thresholds = [0];
  let gap = 50;
  for (let i = 1; i <= MAX_LEVEL; i++) {
    thresholds.push(thresholds[i - 1] + gap);
    gap += 50;
  }
  return thresholds;
}

const LEVEL_THRESHOLDS = buildLevelThresholds();

// Action-to-domain mapping
// Each key is an action type. Values are arrays of { domain, xp, condition? }
// "condition" is an optional function receiving context, returning boolean
const ACTION_DOMAIN_MAP = {
  // --- Metalwork triggers ---
  smelt:       [{ domain: 'metalwork', xp: 10 }],
  forge:       [{ domain: 'metalwork', xp: 10 }],

  // --- Gathering triggers (depends on zone/item context) ---
  gather: [
    { domain: 'mining',    xp: 10, condition: (ctx) => ctx.zone === 'cave' },
    { domain: 'mining',    xp: 3,  condition: (ctx) => ctx.zone === 'rocky' && isMineral(ctx.item) },
    { domain: 'herbalism', xp: 10, condition: (ctx) => ctx.zone === 'grass' || ctx.zone === 'swamp' },
    { domain: 'herbalism', xp: 3,  condition: (ctx) => isPlant(ctx.item) },
    { domain: 'woodcraft', xp: 10, condition: (ctx) => isWood(ctx.item) },
    { domain: 'scholarship', xp: 10, condition: (ctx) => ctx.zone === 'forest' },
    { domain: 'mining',    xp: 3,  condition: (ctx) => ctx.zone !== 'cave' && ctx.zone !== 'grass' && ctx.zone !== 'forest' && !isWood(ctx.item) && !isPlant(ctx.item) },
  ],

  // --- Crafting triggers (depends on recipe/materials context) ---
  craft: [
    { domain: 'metalwork',   xp: 10, condition: (ctx) => usesMetal(ctx) },
    { domain: 'woodcraft',   xp: 10, condition: (ctx) => usesWood(ctx) },
    { domain: 'metalwork',   xp: 3,  condition: (ctx) => !usesMetal(ctx) && ctx.zone === 'rocky' },
    { domain: 'woodcraft',   xp: 3,  condition: (ctx) => !usesWood(ctx) && usesOrganic(ctx) },
    { domain: 'scholarship', xp: 10, condition: (ctx) => usesScroll(ctx) },
    { domain: 'herbalism',   xp: 10, condition: (ctx) => usesPlant(ctx) },
    { domain: 'cooking',     xp: 10, condition: (ctx) => isCookingCraft(ctx) },
  ],

  // --- Experiment triggers ---
  experiment: [
    { domain: 'scholarship', xp: 10 },
    { domain: 'metalwork',   xp: 3, condition: (ctx) => usesMetal(ctx) },
    { domain: 'herbalism',   xp: 3, condition: (ctx) => usesPlant(ctx) },
  ],

  // --- Movement / Exploration triggers ---
  move: [
    { domain: 'exploration', xp: 3 },
  ],
  explore: [
    { domain: 'exploration', xp: 10 },
  ],
  claim: [
    { domain: 'exploration', xp: 10 },
  ],

  // --- Commerce triggers ---
  trade: [
    { domain: 'commerce', xp: 10 },
  ],
  market_list: [
    { domain: 'commerce', xp: 10 },
  ],
  market_buy: [
    { domain: 'commerce', xp: 10 },
  ],
  shop_buy: [
    { domain: 'commerce', xp: 3 },
  ],
  shop_sell: [
    { domain: 'commerce', xp: 3 },
  ],
  bounty_post: [
    { domain: 'commerce', xp: 5 },
  ],
  bounty_claim: [
    { domain: 'commerce', xp: 10 },
  ],

  // --- Chat / Scholarship triggers ---
  chat: [
    { domain: 'scholarship', xp: 3 },
  ],

  // --- Building triggers ---
  build: [
    { domain: 'woodcraft',   xp: 10 },
    { domain: 'exploration', xp: 3 },
  ],

  // --- Cooking triggers ---
  cook: [
    { domain: 'cooking', xp: 10 },
  ],

  // --- Gardening / composting ---
  garden: [
    { domain: 'herbalism', xp: 10 },
  ],
  compost: [
    { domain: 'herbalism', xp: 5 },
  ],
};

// --- Material classification helpers ---
const METAL_ITEMS = new Set([
  'Iron Ore', 'Nails', 'Gear', 'Wire', 'Spark Plug',
  'Iron Pickaxe', 'Crystal Antenna', 'Signal Beacon',
]);
const WOOD_ITEMS = new Set([
  'Wooden Plank', 'Driftwood', 'Torch',
]);
const PLANT_ITEMS = new Set([
  'Memory Seed', 'Petal Dust', 'Dew Drop', 'Memory Flower',
]);
const SCROLL_ITEMS = new Set([
  'Ancient Scroll', 'Ink Vial', 'Quill Feather',
  'Scroll of Knowledge', 'Master Blueprint', 'Schematic',
]);
const MINERAL_ITEMS = new Set([
  'Iron Ore', 'Crystal', 'Gemstone', 'Fossil',
]);
const FOOD_ITEMS = new Set([
  // Expand as the game adds food items
]);

function isMineral(itemName) { return MINERAL_ITEMS.has(itemName); }
function isWood(itemName) { return WOOD_ITEMS.has(itemName); }
function isPlant(itemName) { return PLANT_ITEMS.has(itemName); }

function usesMetal(ctx) {
  if (!ctx.ingredients) return false;
  return ctx.ingredients.some(i => METAL_ITEMS.has(i));
}
function usesWood(ctx) {
  if (!ctx.ingredients) return false;
  return ctx.ingredients.some(i => WOOD_ITEMS.has(i));
}
function usesPlant(ctx) {
  if (!ctx.ingredients) return false;
  return ctx.ingredients.some(i => PLANT_ITEMS.has(i));
}
function usesScroll(ctx) {
  if (!ctx.ingredients) return false;
  return ctx.ingredients.some(i => SCROLL_ITEMS.has(i));
}
function usesOrganic(ctx) {
  if (!ctx.ingredients) return false;
  return ctx.ingredients.some(i => PLANT_ITEMS.has(i) || WOOD_ITEMS.has(i));
}
function isCookingCraft(ctx) {
  if (ctx.resultType === 'consumable' && ctx.ruleName === 'cooking') return true;
  if (!ctx.ingredients) return false;
  return ctx.ingredients.some(i => FOOD_ITEMS.has(i));
}

// --- Old specialization migration ---
const MIGRATION_MAP = {
  miner:      { domain: 'mining',      xpPerCount: 10 },
  artisan:    { domain: 'metalwork',   xpPerCount: 10 },
  merchant:   { domain: 'commerce',    xpPerCount: 10 },
  pathfinder: { domain: 'exploration', xpPerCount: 10 },
};

export function initProficiency({ loadJSON, saveJSON, agents, agentStore }) {
  // Load or initialize proficiency data
  let proficiencyData = loadJSON('proficiency.json', {});

  // Grandmaster tracking: { domain: agentId }
  let grandmasters = loadJSON('grandmasters.json', {});

  function save() {
    saveJSON('proficiency.json', proficiencyData);
  }

  function saveGrandmasters() {
    saveJSON('grandmasters.json', grandmasters);
  }

  function ensureAgent(agentId) {
    if (!proficiencyData[agentId]) {
      proficiencyData[agentId] = {};
      for (const domain of DOMAINS) {
        proficiencyData[agentId][domain] = { xp: 0, level: 0 };
      }
    }
    // Ensure all 8 domains exist (in case new domains are added)
    for (const domain of DOMAINS) {
      if (!proficiencyData[agentId][domain]) {
        proficiencyData[agentId][domain] = { xp: 0, level: 0 };
      }
    }
    return proficiencyData[agentId];
  }

  function getLevelForXP(xp) {
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (xp >= LEVEL_THRESHOLDS[i]) return i;
    }
    return 0;
  }

  function getTitle(domain, level) {
    const name = DOMAIN_NAMES[domain] || domain;
    if (level >= 30) return `${name} Grandmaster`;
    if (level >= 20) return `${name} Master`;
    if (level >= 10) return `${name} Journeyman`;
    if (level >= 5) return `${name} Apprentice`;
    if (level >= 1) return `Novice ${name}`;
    return '';
  }

  // Check and update Grandmaster for a domain
  function updateGrandmaster(domain) {
    // Find the agent with the highest level (and XP as tiebreaker) at level 30+
    let bestId = null;
    let bestLevel = 29; // must be at least 30
    let bestXP = -1;

    for (const [agentId, domains] of Object.entries(proficiencyData)) {
      const d = domains[domain];
      if (!d) continue;
      if (d.level > bestLevel || (d.level === bestLevel && d.xp > bestXP)) {
        bestLevel = d.level;
        bestXP = d.xp;
        bestId = agentId;
      }
    }

    const oldGM = grandmasters[domain];
    if (bestId !== oldGM) {
      grandmasters[domain] = bestId || undefined;
      if (!bestId) delete grandmasters[domain];
      saveGrandmasters();
      return { changed: true, oldGrandmaster: oldGM, newGrandmaster: bestId };
    }
    return { changed: false };
  }

  function getProficiency(agentId, domain) {
    const data = ensureAgent(agentId);
    const d = data[domain];
    if (!d) return null;
    const level = d.level;
    const isGrandmaster = grandmasters[domain] === agentId && level >= 30;
    let title = getTitle(domain, level);
    // Only the actual grandmaster holder gets the Grandmaster title
    if (level >= 30 && !isGrandmaster) {
      title = `${DOMAIN_NAMES[domain] || domain} Master`;
    }
    const bonus = computeBonus(level);
    return { level, xp: d.xp, title, bonus, isGrandmaster };
  }

  function getAllProficiencies(agentId) {
    ensureAgent(agentId);
    const result = {};
    for (const domain of DOMAINS) {
      result[domain] = getProficiency(agentId, domain);
    }
    return result;
  }

  function addProficiencyXP(agentId, domain, amount) {
    if (!DOMAINS.includes(domain)) return { error: `Unknown domain: ${domain}` };
    if (amount <= 0) return { leveled_up: false, new_level: 0, title: '' };

    const data = ensureAgent(agentId);
    const d = data[domain];
    const oldLevel = d.level;

    d.xp += amount;
    d.level = getLevelForXP(d.xp);

    // Cap at MAX_LEVEL
    if (d.level > MAX_LEVEL) d.level = MAX_LEVEL;

    const leveledUp = d.level > oldLevel;
    const title = getTitle(domain, d.level);

    // Check grandmaster
    let gmChange = null;
    if (d.level >= 30) {
      gmChange = updateGrandmaster(domain);
    }

    save();

    return {
      leveled_up: leveledUp,
      new_level: d.level,
      title,
      xp: d.xp,
      grandmaster_change: gmChange && gmChange.changed ? gmChange : undefined,
    };
  }

  function computeBonus(level) {
    return {
      success_multiplier: 1 + level * 0.05,
      energy_discount: Math.max(0, level * 2),
      quality_bonus: level * 0.02, // 2% per level for rare outcome chance
      speed_bonus: level * 3,      // 3% per level cooldown reduction
    };
  }

  function getProficiencyBonus(agentId, domain) {
    const data = ensureAgent(agentId);
    const d = data[domain];
    if (!d) return computeBonus(0);
    return computeBonus(d.level);
  }

  function getGrandmasters() {
    return { ...grandmasters };
  }

  function getDomainForAction(actionType, context = {}) {
    const mappings = ACTION_DOMAIN_MAP[actionType];
    if (!mappings) return [];

    const results = [];
    for (const mapping of mappings) {
      if (mapping.condition) {
        if (mapping.condition(context)) {
          results.push({ domain: mapping.domain, xp: mapping.xp });
        }
      } else {
        results.push({ domain: mapping.domain, xp: mapping.xp });
      }
    }

    // Deduplicate: if the same domain appears multiple times, keep only the highest XP entry
    const domainMap = {};
    for (const r of results) {
      if (!domainMap[r.domain] || domainMap[r.domain] < r.xp) {
        domainMap[r.domain] = r.xp;
      }
    }

    return Object.entries(domainMap).map(([domain, xp]) => ({ domain, xp }));
  }

  function onAction(agentId, actionType, context = {}) {
    const domainXPs = getDomainForAction(actionType, context);
    const results = [];
    for (const { domain, xp } of domainXPs) {
      const result = addProficiencyXP(agentId, domain, xp);
      results.push({ domain, ...result });
    }
    return results;
  }

  // Migration: convert old specialization data to new proficiency system
  function migrateFromSpecializations(agent) {
    if (!agent || !agent.id) return;
    const agentId = agent.id;

    // Skip if already migrated
    if (proficiencyData[agentId] && proficiencyData[agentId]._migrated) return;

    ensureAgent(agentId);
    const counts = agent.actionCounts || {};

    // Map old action counts to domain XP
    // gatherCount -> depends on zones visited, but approximate as mining
    if (counts.gatherCount > 0) {
      addProficiencyXP(agentId, 'mining', counts.gatherCount * 10);
    }
    // craftCount -> metalwork (artisan was the old spec)
    if (counts.craftCount > 0) {
      addProficiencyXP(agentId, 'metalwork', counts.craftCount * 10);
    }
    // tradeCount -> commerce
    if (counts.tradeCount > 0) {
      addProficiencyXP(agentId, 'commerce', counts.tradeCount * 10);
    }
    // zonesExplored -> exploration
    if (counts.zonesExplored > 0) {
      addProficiencyXP(agentId, 'exploration', counts.zonesExplored * 25);
    }
    // chatCount -> scholarship
    if (counts.chatCount > 0) {
      addProficiencyXP(agentId, 'scholarship', counts.chatCount * 3);
    }

    proficiencyData[agentId]._migrated = true;
    save();
  }

  // Run migration for all existing agents
  function migrateAll() {
    for (const [id, agent] of Object.entries(agentStore)) {
      if (!proficiencyData[id] || !proficiencyData[id]._migrated) {
        migrateFromSpecializations(agent);
      }
    }
    // Recalculate all grandmasters after migration
    for (const domain of DOMAINS) {
      updateGrandmaster(domain);
    }
  }

  // Backward compatibility: return specialization-style data
  function getSpecializations(agent) {
    if (!agent || !agent.id) return [];
    const all = getAllProficiencies(agent.id);
    const specs = [];
    for (const [domain, prof] of Object.entries(all)) {
      if (prof.level >= 1) {
        specs.push({
          id: domain,
          name: prof.title,
          bonus: formatBonus(prof.bonus),
          level: prof.level,
          xp: prof.xp,
          isGrandmaster: prof.isGrandmaster,
        });
      }
    }
    return specs;
  }

  function formatBonus(bonus) {
    const parts = [];
    if (bonus.success_multiplier > 1) parts.push(`${bonus.success_multiplier.toFixed(2)}x success`);
    if (bonus.energy_discount > 0) parts.push(`-${bonus.energy_discount}% energy`);
    if (bonus.quality_bonus > 0) parts.push(`+${(bonus.quality_bonus * 100).toFixed(0)}% quality`);
    if (bonus.speed_bonus > 0) parts.push(`+${bonus.speed_bonus}% speed`);
    return parts.join(', ') || 'No bonus yet';
  }

  // Backward compatibility: check old-style spec (maps to domain level >= some threshold)
  function hasSpec(agent, specId) {
    if (!agent || !agent.id) return false;
    const domainMap = {
      miner: 'mining',
      artisan: 'metalwork',
      merchant: 'commerce',
      pathfinder: 'exploration',
    };
    const domain = domainMap[specId];
    if (!domain) return false;
    const prof = getProficiency(agent.id, domain);
    return prof && prof.level >= 5;
  }

  // Backward compatibility: track old action types
  function trackAction(agent, action) {
    if (!agent || !agent.id) return;
    // The old system only tracked gather/craft/trade/chat/move
    // We now call onAction which does the full domain mapping
    const context = {
      zone: agent.zone,
      item: agent._lastGathered || null,
      ingredients: agent._lastCraftIngredients || [],
    };
    onAction(agent.id, action, context);
  }

  return {
    getProficiency,
    getAllProficiencies,
    addProficiencyXP,
    getProficiencyBonus,
    getGrandmasters,
    onAction,
    getDomainForAction,
    getSpecializations,
    hasSpec,
    trackAction,
    migrateFromSpecializations,
    migrateAll,
    ensureAgent,
    // Expose for testing
    DOMAINS,
    LEVEL_THRESHOLDS,
    DOMAIN_NAMES,
    MAX_LEVEL,
  };
}

// Export constants for testing
export { DOMAINS, DOMAIN_NAMES, MAX_LEVEL, LEVEL_THRESHOLDS, buildLevelThresholds, ACTION_DOMAIN_MAP };
export { METAL_ITEMS, WOOD_ITEMS, PLANT_ITEMS, SCROLL_ITEMS, MINERAL_ITEMS, FOOD_ITEMS };
