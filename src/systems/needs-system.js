/**
 * needs-system.js — Human Motivation Engine
 * 
 * Grounded in real psychology:
 * - Maslow's Hierarchy: needs unlock in layers, lower needs dominate
 * - Self-Determination Theory: autonomy, competence, relatedness
 * - Optimal Foraging Theory: resource depletion drives movement
 * - Prospect Theory: loss aversion, risk under desperation
 * - Dunbar's Layers: 1.5 / 5 / 15 relationship slots with maintenance cost
 * - Boredom & Novelty-Seeking: repetition decay, curiosity drive
 * - Terror Management: death awareness drives meaning-seeking
 */

// ── MASLOW LEVELS ──
// Each need has a value 0–100. 0 = fully satisfied, 100 = desperate.
// Higher Maslow levels only matter when lower ones are < threshold.
const MASLOW_LEVELS = {
  physiological: { level: 0, threshold: 30, weight: 5.0 },  // hunger, energy, warmth
  safety:        { level: 1, threshold: 40, weight: 3.5 },  // HP, shelter, no threats
  belonging:     { level: 2, threshold: 50, weight: 2.5 },  // bonds, loneliness
  esteem:        { level: 3, threshold: 50, weight: 1.8 },  // mastery, uniqueness, recognition
  actualization: { level: 4, threshold: 60, weight: 1.0 },  // purpose, legacy, creation
};

// ── DUNBAR LAYERS ──
// Agents have limited relationship slots. Maintaining bonds costs time.
const DUNBAR_SLOTS = {
  intimate: 1,     // best friend / partner
  close:    4,     // inner circle
  friends:  10,    // casual friends
  acquaintances: 17, // everyone else they've met
};
// Total: 32 — exactly our agent count, so they CAN'T be friends with everyone

// ── BOREDOM SYSTEM ──
// Each action type has a "satiation" counter. Doing the same thing repeatedly
// reduces its appeal. Novelty resets it.
const BOREDOM_DECAY_RATE = 0.02;    // per tick, boredom recovers slowly
const BOREDOM_PENALTY_PER_REP = 5;  // each repeat adds this much penalty (was 8)
const MAX_BOREDOM = 100;

// ── RESOURCE DEPLETION ──
// Tiles that have been gathered from get a depletion counter
// Forces agents to MOVE to find new patches (Optimal Foraging Theory)
const DEPLETION_PER_GATHER = 25;    // 4 gathers = tile depleted
const DEPLETION_RECOVERY = 0.01;    // per tick, tiles slowly recover
const DEPLETION_THRESHOLD = 80;     // above this, gathering yields nothing

// ── MORTALITY SALIENCE ──
// Agents who have died before (or witnessed death) get lasting behavioral changes
const DEATH_MEMORY_DURATION = 5000; // ticks (~40 minutes) before death memory fades

function createNeedsSystem(shared) {
  const agentNeeds = new Map();      // id → needs state
  const tileDepletion = new Map();   // "x,y" → depletion level (0-100)
  const deathMemories = new Map();   // id → { deaths, lastDeath, witnessed: [] }

  function initAgent(agentId) {
    if (agentNeeds.has(agentId)) return agentNeeds.get(agentId);
    const needs = {
      // Maslow needs (0 = satisfied, 100 = desperate)
      physiological: 0,
      safety: 0,
      belonging: 50,    // start lonely — they need to EARN connections
      esteem: 60,       // start with desire for mastery
      actualization: 80, // far from self-actualized

      // Boredom per action type
      boredom: {},  // action → satiation (0-100, higher = more bored of it)
      lastActions: [],  // ring buffer of last 20 actions

      // Social bonds (Dunbar layers)
      bonds: {
        intimate: null,       // single best friend
        close: [],            // up to 4
        friends: [],          // up to 10
        acquaintances: [],    // up to 17
      },
      socialEnergy: 100,      // depletes from socializing, recharges alone
      loneliness: 0,          // increases when alone, decreases when with bonds
      lastSocialTick: 0,

      // Novelty & exploration
      tilesVisited: new Set(), // track unique tiles visited
      zonesVisited: new Set(),
      noveltyHunger: 50,       // desire for new experiences

      // Mortality awareness
      deathCount: 0,
      hasWitnessedDeath: false,
      mortalitySalience: 0,    // 0-100, rises after death/witnessing death

      // Competence tracking (SDT)
      specialization: null,    // what they're best at
      skillLevels: {},         // action → proficiency (0-100)
      masteryDesire: 50,       // how much they want to get better

      // Autonomy (SDT) — do they feel in control?
      autonomy: 50,            // forced survival actions reduce this
      choicesSinceForced: 0,
    };
    agentNeeds.set(agentId, needs);
    return needs;
  }

  // ── COMPUTE MASLOW NEEDS from agent state ──
  function updateNeeds(agent, needs, visible) {
    // PHYSIOLOGICAL: hunger + energy deficit + temperature
    const hungerPain = (agent.hunger || 0);
    const energyDeficit = Math.max(0, 50 - (agent.energy || 100));
    const tempStress = getTemperatureStress(agent);
    needs.physiological = Math.min(100, hungerPain * 0.6 + energyDeficit * 0.8 + tempStress * 0.3);

    // SAFETY: HP deficit + nearby dangers + storm + no shelter
    const hpDeficit = Math.max(0, 100 - (agent.hp || 100));
    const dangerNearby = (visible.dangers?.length || 0) * 15;
    const fireNearby = shared.temperature?.hasNearbyFire?.(agent.tileX, agent.tileY, 2) ? 10 : 0;
    const gasNearby = shared.gasSystem?.gasClouds?.get(`${agent.tileX},${agent.tileY}`) ? 25 : 0;
    const stormFear = (shared.weather?.getCurrentWeather?.()?.id === 'storm') ? 15 : 0;
    needs.safety = Math.min(100, hpDeficit * 1.5 + dangerNearby + fireNearby + gasNearby + stormFear);

    // BELONGING: loneliness + bond health
    updateLoneliness(agent, needs, visible);
    const bondHealth = getBondHealth(needs);
    needs.belonging = Math.min(100, needs.loneliness * 0.6 + (100 - bondHealth) * 0.4);

    // ESTEEM: mastery stagnation + lack of recognition
    const maxSkill = Math.max(0, ...Object.values(needs.skillLevels));
    const masteryGap = Math.max(0, 100 - maxSkill);
    const uniqueness = needs.specialization ? 0 : 30; // penalty for no specialization
    needs.esteem = Math.min(100, masteryGap * 0.5 + uniqueness + needs.masteryDesire * 0.3);

    // ACTUALIZATION: only activates when lower needs are mostly met
    const lowerNeedsMet = needs.physiological < 30 && needs.safety < 30 &&
                          needs.belonging < 50 && needs.esteem < 50;
    if (lowerNeedsMet) {
      // Desire to create, teach, leave legacy
      const hasCreated = (agent.stats?.crafted || 0) + (agent.stats?.built || 0);
      const hasTaught = agent.stats?.taught || 0;
      needs.actualization = Math.max(10, 80 - hasCreated * 2 - hasTaught * 5);
    }

    // MORTALITY SALIENCE — slowly decays
    if (needs.mortalitySalience > 0) {
      needs.mortalitySalience = Math.max(0, needs.mortalitySalience - 0.01);
    }
  }

  function getTemperatureStress(agent) {
    if (!shared.temperature?.getAmbientTemp) return 0;
    const weather = shared.weather?.getCurrentWeather?.();
    const temp = shared.temperature.getAmbientTemp(agent.tileX, agent.tileY, {
      zone: agent.zone, hour: shared.getGameTime?.()?.hour ?? 12,
      weather: weather?.condition ?? 'clear'
    });
    if (temp == null) return 0;
    if (temp < 5) return (5 - temp) * 5;   // cold stress
    if (temp > 40) return (temp - 40) * 3;  // heat stress
    return 0;
  }

  // ── LONELINESS ──
  function updateLoneliness(agent, needs, visible) {
    const nearbyBonds = visible.agents?.filter(a => {
      const rel = getBondLevel(needs, a.agent?.id);
      return rel !== null;
    }) || [];

    if (nearbyBonds.length === 0) {
      // Alone — loneliness increases, but introverts are fine longer
      needs.loneliness = Math.min(100, needs.loneliness + 0.05);
    } else {
      // With bonded agents — loneliness decreases proportional to bond strength
      const bestBondNearby = Math.max(...nearbyBonds.map(a => getBondStrength(needs, a.agent?.id)));
      needs.loneliness = Math.max(0, needs.loneliness - 0.1 * (bestBondNearby / 100));
    }

    // Social energy — socializing depletes it (introverts faster)
    if (agent._lastAction === 'chat') {
      needs.socialEnergy = Math.max(0, needs.socialEnergy - 2);
    } else {
      // Recharges when not socializing
      needs.socialEnergy = Math.min(100, needs.socialEnergy + 0.3);
    }
  }

  // ── DUNBAR BONDS ──
  function getBondLevel(needs, otherId) {
    if (!otherId) return null;
    if (needs.bonds.intimate === otherId) return 'intimate';
    if (needs.bonds.close.includes(otherId)) return 'close';
    if (needs.bonds.friends.includes(otherId)) return 'friends';
    if (needs.bonds.acquaintances.includes(otherId)) return 'acquaintances';
    return null;
  }

  function getBondStrength(needs, otherId) {
    const level = getBondLevel(needs, otherId);
    if (level === 'intimate') return 100;
    if (level === 'close') return 70;
    if (level === 'friends') return 40;
    if (level === 'acquaintances') return 15;
    return 0;
  }

  function getBondHealth(needs) {
    // How "full" are the relationship slots? Empty slots = unmet need.
    const hasIntimate = needs.bonds.intimate ? 1 : 0;
    const closeCount = needs.bonds.close.length;
    const friendCount = needs.bonds.friends.length;
    // Weight intimate bonds higher
    return Math.min(100,
      hasIntimate * 30 +
      (closeCount / DUNBAR_SLOTS.close) * 30 +
      (friendCount / DUNBAR_SLOTS.friends) * 25 +
      15 // baseline
    );
  }

  function strengthenBond(agentId, otherId) {
    const needs = agentNeeds.get(agentId);
    if (!needs || !otherId) return;

    const currentLevel = getBondLevel(needs, otherId);

    if (!currentLevel) {
      // New acquaintance
      if (needs.bonds.acquaintances.length >= DUNBAR_SLOTS.acquaintances) {
        // Dunbar limit! Must forget someone to make room
        needs.bonds.acquaintances.shift(); // FIFO — forget oldest
      }
      needs.bonds.acquaintances.push(otherId);
    } else if (currentLevel === 'acquaintances') {
      // Promote to friend? Only with repeated interaction
      const interactions = (needs._interactionCounts?.[otherId] || 0) + 1;
      if (!needs._interactionCounts) needs._interactionCounts = {};
      needs._interactionCounts[otherId] = interactions;
      if (interactions >= 5 && needs.bonds.friends.length < DUNBAR_SLOTS.friends) {
        needs.bonds.acquaintances = needs.bonds.acquaintances.filter(id => id !== otherId);
        needs.bonds.friends.push(otherId);
      }
    } else if (currentLevel === 'friends') {
      const interactions = (needs._interactionCounts?.[otherId] || 0) + 1;
      needs._interactionCounts[otherId] = interactions;
      if (interactions >= 15 && needs.bonds.close.length < DUNBAR_SLOTS.close) {
        needs.bonds.friends = needs.bonds.friends.filter(id => id !== otherId);
        needs.bonds.close.push(otherId);
      }
    } else if (currentLevel === 'close') {
      const interactions = (needs._interactionCounts?.[otherId] || 0) + 1;
      needs._interactionCounts[otherId] = interactions;
      if (interactions >= 30 && !needs.bonds.intimate) {
        needs.bonds.close = needs.bonds.close.filter(id => id !== otherId);
        needs.bonds.intimate = otherId;
      }
    }
  }

  // ── BOREDOM ──
  function getBoredom(needs, action) {
    return needs.boredom[action] || 0;
  }

  function recordAction(agentId, action) {
    const needs = agentNeeds.get(agentId);
    if (!needs) return;

    // Increase boredom for this action
    needs.boredom[action] = Math.min(MAX_BOREDOM,
      (needs.boredom[action] || 0) + BOREDOM_PENALTY_PER_REP);

    // Track action history
    needs.lastActions.push(action);
    if (needs.lastActions.length > 20) needs.lastActions.shift();

    // Update skill levels (SDT: Competence)
    needs.skillLevels[action] = Math.min(100,
      (needs.skillLevels[action] || 0) + 0.5);

    // Check for specialization emergence
    const bestAction = Object.entries(needs.skillLevels)
      .sort((a, b) => b[1] - a[1])[0];
    if (bestAction && bestAction[1] > 30) {
      needs.specialization = bestAction[0];
    }

    // Autonomy: was this forced?
    const wasForced = (action === 'eat' && needs.physiological > 70) ||
                      (action === 'rest' && needs.physiological > 70);
    if (wasForced) {
      needs.autonomy = Math.max(0, needs.autonomy - 5);
      needs.choicesSinceForced = 0;
    } else {
      needs.choicesSinceForced++;
      if (needs.choicesSinceForced > 5) {
        needs.autonomy = Math.min(100, needs.autonomy + 2);
      }
    }
  }

  function tickBoredom(needs) {
    // All boredom slowly decays (novelty hunger grows)
    for (const action of Object.keys(needs.boredom)) {
      needs.boredom[action] = Math.max(0,
        needs.boredom[action] - BOREDOM_DECAY_RATE);
    }

    // Novelty hunger increases when doing repetitive things
    const lastFive = needs.lastActions.slice(-5);
    const unique = new Set(lastFive).size;
    if (unique <= 2) {
      needs.noveltyHunger = Math.min(100, needs.noveltyHunger + 0.1);
    } else {
      needs.noveltyHunger = Math.max(0, needs.noveltyHunger - 0.05);
    }
  }

  // ── TILE DEPLETION (Optimal Foraging) ──
  function depleteTile(x, y) {
    const key = `${x},${y}`;
    const current = tileDepletion.get(key) || 0;
    tileDepletion.set(key, Math.min(100, current + DEPLETION_PER_GATHER));
  }

  function getTileDepletion(x, y) {
    return tileDepletion.get(`${x},${y}`) || 0;
  }

  function isTileDepleted(x, y) {
    return getTileDepletion(x, y) >= DEPLETION_THRESHOLD;
  }

  function tickDepletion() {
    // Tiles slowly recover
    for (const [key, val] of tileDepletion) {
      const newVal = val - DEPLETION_RECOVERY;
      if (newVal <= 0) tileDepletion.delete(key);
      else tileDepletion.set(key, newVal);
    }
  }

  // ── MORTALITY ──
  function onDeath(agentId) {
    const needs = agentNeeds.get(agentId);
    if (!needs) return;
    needs.deathCount++;
    needs.mortalitySalience = 100;
  }

  function onWitnessDeath(witnessId, deadAgentId) {
    const needs = agentNeeds.get(witnessId);
    if (!needs) return;
    needs.hasWitnessedDeath = true;
    needs.mortalitySalience = Math.min(100, needs.mortalitySalience + 40);
    // Witnessing a bonded agent die hits harder
    const bondLevel = getBondLevel(needs, deadAgentId);
    if (bondLevel === 'intimate') needs.mortalitySalience = 100;
    else if (bondLevel === 'close') needs.mortalitySalience = Math.min(100, needs.mortalitySalience + 30);
  }

  // ── SCORE MODIFIER ──
  // This is the key function: maps needs state → intent score multipliers
  function getScoreModifiers(agent, needs) {
    const mods = {};

    // MASLOW PRIORITY: lower unmet needs suppress higher-level actions
    const physioPriority = needs.physiological > MASLOW_LEVELS.physiological.threshold;
    const safetyPriority = needs.safety > MASLOW_LEVELS.safety.threshold;

    // Physiological actions
    mods.eat = needs.physiological * MASLOW_LEVELS.physiological.weight;
    mods.rest = (agent.energy < 50 ? (50 - agent.energy) : 0) * 2.0;
    mods.gather = needs.physiological > 30 ? needs.physiological * 1.5 : 15;

    // Safety actions
    mods.flee = needs.safety * MASLOW_LEVELS.safety.weight;
    mods.shelter = safetyPriority ? needs.safety * 2 : 0;

    // Belonging actions — SUPPRESSED when starving/unsafe
    const belongingMult = (physioPriority || safetyPriority) ? 0.2 : 1.0;
    mods.chat = needs.belonging * MASLOW_LEVELS.belonging.weight * belongingMult;
    mods.gift = needs.belonging > 40 ? needs.belonging * 1.0 * belongingMult : 5;

    // But: social energy limits chatting even when lonely
    if (needs.socialEnergy < 20) {
      mods.chat *= 0.3; // too socially drained to chat
    }

    // Esteem actions — SUPPRESSED when lower needs unmet
    const esteemMult = (physioPriority || safetyPriority) ? 0.1 :
                       needs.belonging > 60 ? 0.3 : 1.0;
    mods.craft = needs.esteem * MASLOW_LEVELS.esteem.weight * esteemMult;
    mods.experiment = needs.esteem * 1.5 * esteemMult;
    mods.build = needs.esteem * 1.2 * esteemMult;

    // Actualization — only when everything else is OK
    const selfMult = (physioPriority || safetyPriority || needs.belonging > 60) ? 0.05 : 1.0;
    mods.plant = needs.actualization * 0.8 * selfMult;
    mods.teach = needs.actualization * 1.0 * selfMult;

    // EXPLORATION — driven by boredom/novelty hunger + foraging need
    const boredomPush = needs.noveltyHunger * 0.35;
    const foragingPush = needs.physiological > 20 ? needs.physiological * 0.3 : 0;
    mods.explore = Math.max(boredomPush, foragingPush, 10); // always some baseline urge
    // Mortality salience boosts meaning-seeking actions
    if (needs.mortalitySalience > 20) {
      const deathBoost = needs.mortalitySalience * 0.3;
      mods.build = (mods.build || 0) + deathBoost;
      mods.plant = (mods.plant || 0) + deathBoost;
      mods.craft = (mods.craft || 0) + deathBoost * 0.5;
      mods.gift = (mods.gift || 0) + deathBoost * 0.7;
    }

    // Apply boredom penalties to ALL actions
    for (const action of Object.keys(mods)) {
      const boredom = getBoredom(needs, action);
      mods[action] *= Math.max(0.1, 1.0 - boredom / MAX_BOREDOM);
    }

    // PROSPECT THEORY: when desperate (low HP, high hunger), take bigger risks
    if (needs.physiological > 70 || (agent.hp || 100) < 30) {
      mods.fight = (mods.fight || 5) * 2.5;  // desperate = risk-seeking
      mods.explore *= 2.0;                     // will go further to find food
    }

    return mods;
  }

  // ── PREFERRED CHAT TARGETS (Dunbar-aware) ──
  function getChatPreference(needs, otherId) {
    const level = getBondLevel(needs, otherId);
    if (!level) return 0.5;  // stranger — mild interest
    if (level === 'intimate') return 3.0;
    if (level === 'close') return 2.0;
    if (level === 'friends') return 1.2;
    if (level === 'acquaintances') return 0.8;
    return 0.5;
  }

  // ── WORLD TICK ──
  function tick() {
    tickDepletion();
  }

  // ── AGENT TICK ──
  function tickAgent(agentId) {
    const needs = agentNeeds.get(agentId);
    if (!needs) return;
    tickBoredom(needs);
  }

  // ── API ──
  function getAgentNeeds(agentId) {
    return agentNeeds.get(agentId) || null;
  }

  function getStats() {
    const allNeeds = [...agentNeeds.values()];
    return {
      agents: agentNeeds.size,
      depletedTiles: [...tileDepletion.values()].filter(v => v >= DEPLETION_THRESHOLD).length,
      totalDepletion: tileDepletion.size,
      avgPhysiological: avg(allNeeds.map(n => n.physiological)),
      avgSafety: avg(allNeeds.map(n => n.safety)),
      avgBelonging: avg(allNeeds.map(n => n.belonging)),
      avgEsteem: avg(allNeeds.map(n => n.esteem)),
      avgActualization: avg(allNeeds.map(n => n.actualization)),
      avgNoveltyHunger: avg(allNeeds.map(n => n.noveltyHunger)),
      avgMortalitySalience: avg(allNeeds.map(n => n.mortalitySalience)),
    };
  }

  function avg(arr) { return arr.length ? arr.reduce((a,b) => a+b, 0) / arr.length : 0; }

  return {
    initAgent,
    updateNeeds,
    getScoreModifiers,
    recordAction,
    depleteTile,
    isTileDepleted,
    getTileDepletion,
    strengthenBond,
    getChatPreference,
    onDeath,
    onWitnessDeath,
    tickAgent,
    tick,
    getAgentNeeds,
    getStats,
    getBondLevel,
    getBondStrength,
    MASLOW_LEVELS,
    DUNBAR_SLOTS,
  };
}

export { createNeedsSystem };
