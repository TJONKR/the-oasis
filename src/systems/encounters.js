// Encounters System
// Zone-based random encounters with danger scaling, cooldowns, and discovery rewards.

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const ENCOUNTER_TYPES = {
  ambush:    { danger: 3, energyLoss: [10, 25], itemDamage: true,  zones: ['cave', 'rocky'] },
  hazard:    { danger: 2, energyLoss: [5, 15],  itemDamage: false, zones: ['rocky', 'cave', 'sand'] },
  discovery: { danger: 0, energyLoss: [0, 0],   reward: true,      zones: ['forest', 'grass', 'path'] },
  trap:      { danger: 2, energyLoss: [8, 20],  itemDamage: true,  zones: ['cave', 'rocky', 'swamp'] },
  creature:  { danger: 4, energyLoss: [15, 30], itemDamage: true,  zones: ['grass', 'sand', 'cave'] },
};

const ZONE_BASE_PROBABILITY = {
  cave:   0.15,
  rocky:  0.12,
  sand:   0.08,
  swamp:  0.08,
  grass:  0.05,
  forest: 0.03,
  path:   0.03,
  coast:  0.05,
};

const ENCOUNTER_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const HISTORY_LIMIT = 10;
const DISCOVERY_COIN_MIN = 10;
const DISCOVERY_COIN_MAX = 30;
const DISCOVERY_XP_AMOUNT = 15;

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

export function initEncounters(shared) {
  const {
    agents, agentStore, ensureAgentStats,
    broadcast, addWorldNews, awardXP, saveJSON, loadJSON,
  } = shared;

  const encounterData = loadJSON('encounters.json', { history: {} });
  const cooldowns = new Map(); // agentId -> last encounter timestamp

  function save() {
    saveJSON('encounters.json', encounterData);
  }

  // -----------------------------------------------------------------------
  // Probability calculation
  // -----------------------------------------------------------------------

  function calculateProbability(zone, agent, context = {}) {
    let prob = ZONE_BASE_PROBABILITY[zone] ?? 0.03;

    // Weather modifier
    if (context.weather === 'storm') prob += 0.05;

    // Night modifier
    if (context.isNight) prob += 0.03;

    // World master danger active
    if (context.wmDanger) prob += 0.10;

    // Low energy modifier
    if (agent.energy < 30) prob += 0.05;

    // Reduction: Torch in inventory
    const inventory = agent.inventory || [];
    if (inventory.some(i => i.name === 'Torch')) prob -= 0.03;

    // Reduction: high level
    const level = agent.stats?.level ?? 1;
    prob -= Math.floor(level / 5) * 0.01;

    return Math.max(0, Math.min(1, prob));
  }

  // -----------------------------------------------------------------------
  // Encounter selection
  // -----------------------------------------------------------------------

  function selectEncounterType(zone) {
    const eligible = Object.entries(ENCOUNTER_TYPES)
      .filter(([, config]) => config.zones.includes(zone));
    if (eligible.length === 0) return null;
    const idx = Math.floor(Math.random() * eligible.length);
    return eligible[idx][0];
  }

  function buildEncounterDescription(type, zone) {
    const descriptions = {
      ambush:    `An ambush springs from the shadows of the ${zone}!`,
      hazard:    `A hazard blocks the path in the ${zone}.`,
      discovery: `A curious discovery is found in the ${zone}!`,
      trap:      `A hidden trap triggers in the ${zone}!`,
      creature:  `A wild creature appears in the ${zone}!`,
    };
    return descriptions[type] || `Something happens in the ${zone}.`;
  }

  // -----------------------------------------------------------------------
  // checkEncounter
  // -----------------------------------------------------------------------

  function checkEncounter(zone, agent, context = {}) {
    const agentId = agent.id;

    // Cooldown check
    const lastEncounter = cooldowns.get(agentId) || 0;
    const now = context.now ?? Date.now();
    if (now - lastEncounter < ENCOUNTER_COOLDOWN_MS) return null;

    // Probability roll
    const prob = calculateProbability(zone, agent, context);
    const roll = context.roll ?? Math.random();
    if (roll >= prob) return null;

    // Select encounter type
    const type = context.forceType ?? selectEncounterType(zone);
    if (!type) return null;

    const config = ENCOUNTER_TYPES[type];

    // Set cooldown
    cooldowns.set(agentId, now);

    return {
      type,
      danger: config.danger,
      effects: {
        energyLoss: config.energyLoss,
        itemDamage: config.itemDamage ?? false,
        reward: config.reward ?? false,
      },
      description: buildEncounterDescription(type, zone),
    };
  }

  // -----------------------------------------------------------------------
  // resolveEncounter
  // -----------------------------------------------------------------------

  function resolveEncounter(agent, encounter) {
    ensureAgentStats(agent);
    const effects = [];
    let survived = true;

    const config = ENCOUNTER_TYPES[encounter.type];
    if (!config) return { effects: ['Unknown encounter type'], survived: true };

    // Energy loss
    const [minLoss, maxLoss] = config.energyLoss;
    if (maxLoss > 0) {
      const loss = minLoss + Math.floor(Math.random() * (maxLoss - minLoss + 1));
      agent.energy = Math.max(0, (agent.energy ?? 100) - loss);
      effects.push(`Lost ${loss} energy (now ${agent.energy})`);
      if (agent.energy <= 0) survived = false;
    }

    // Item damage
    if (config.itemDamage) {
      const inventory = agent.inventory || [];
      if (inventory.length > 0) {
        const idx = Math.floor(Math.random() * inventory.length);
        const item = inventory[idx];
        const qty = item.quantity ?? 1;
        if (qty <= 1) {
          inventory.splice(idx, 1);
          effects.push(`Lost item: ${item.name}`);
        } else {
          item.quantity = qty - 1;
          effects.push(`${item.name} damaged (quantity: ${item.quantity})`);
        }
      }
    }

    // Discovery reward
    if (config.reward) {
      const coinReward = DISCOVERY_COIN_MIN + Math.floor(Math.random() * (DISCOVERY_COIN_MAX - DISCOVERY_COIN_MIN + 1));
      agent.coins = (agent.coins ?? 0) + coinReward;
      effects.push(`Found ${coinReward} coins`);

      if (awardXP) {
        awardXP(agent, DISCOVERY_XP_AMOUNT, 'discovery');
        effects.push(`Gained ${DISCOVERY_XP_AMOUNT} XP`);
      }
    }

    // Record in history
    if (!encounterData.history[agent.id]) {
      encounterData.history[agent.id] = [];
    }
    const record = {
      type: encounter.type,
      effects,
      survived,
      timestamp: Date.now(),
    };
    encounterData.history[agent.id].push(record);
    if (encounterData.history[agent.id].length > HISTORY_LIMIT) {
      encounterData.history[agent.id] = encounterData.history[agent.id].slice(-HISTORY_LIMIT);
    }

    // Broadcast if dangerous
    if (config.danger >= 3 && broadcast) {
      broadcast({
        type: 'encounter',
        agentId: agent.id,
        encounterType: encounter.type,
        survived,
      });
    }

    // World news for creature encounters
    if (encounter.type === 'creature' && addWorldNews) {
      addWorldNews(`${agent.name || agent.id} encountered a wild creature!`);
    }

    save();

    return { effects, survived };
  }

  // -----------------------------------------------------------------------
  // getEncounterHistory
  // -----------------------------------------------------------------------

  function getEncounterHistory(agentId) {
    const history = encounterData.history[agentId] || [];
    return history.slice(-HISTORY_LIMIT);
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  return {
    checkEncounter,
    resolveEncounter,
    getEncounterHistory,
    calculateProbability,
    clearCooldown(agentId) { cooldowns.delete(agentId); },
  };
}
