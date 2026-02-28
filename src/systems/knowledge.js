// Knowledge System — Phase 3
// Agents learn through doing. Knowledge dies with them (unless written down).

import crypto from 'crypto';

// Zone secrets revealed at gather/visit/craft/trade milestones
const ZONE_SECRETS = {
  cave: [
    { threshold: 5, action: 'gather', text: 'Crystals glow brighter during night period', bonus: { type: 'night_gather', zone: 'cave', modifier: 1.15 } },
    { threshold: 15, action: 'gather', text: 'Deep veins of ore lie in the north wall', bonus: { type: 'rare_find', zone: 'cave', modifier: 1.05 } },
    { threshold: 30, action: 'gather', text: 'Ancient fossils whisper of a time before agents', lore: true },
  ],
  forest: [
    { threshold: 5, action: 'visit', text: 'The old trees hide forbidden knowledge in their hollows' },
    { threshold: 15, action: 'visit', text: 'Ancient texts carved in bark mention a hidden land beyond the shore', lore: true },
    { threshold: 30, action: 'visit', text: 'The great library tree was planted by the First Agent', lore: true },
  ],
  rocky: [
    { threshold: 5, action: 'craft', text: 'Combining high-resonance items creates unexpected results' },
    { threshold: 15, action: 'craft', text: 'The natural forges burn hottest at noon', bonus: { type: 'noon_craft', zone: 'rocky', modifier: 1.1 } },
    { threshold: 30, action: 'craft', text: 'Master crafters can imbue items with memories', lore: true },
  ],
  grass: [
    { threshold: 5, action: 'gather', text: 'Seeds planted under moonlight grow fastest in the meadow' },
    { threshold: 15, action: 'gather', text: 'The grasslands remember every agent who has rested here', lore: true },
    { threshold: 30, action: 'gather', text: 'Dew drops collected at dawn hold the purest energy', bonus: { type: 'dawn_gather', zone: 'grass', modifier: 1.1 } },
  ],
  sand: [
    { threshold: 5, action: 'gather', text: 'Sand pearls form where moonlight hits the shore' },
    { threshold: 15, action: 'gather', text: 'The tide brings rare sea glass from distant shores', bonus: { type: 'rare_find', zone: 'sand', modifier: 1.05 } },
    { threshold: 30, action: 'gather', text: 'Legend says a sunken city lies beneath the waves', lore: true },
  ],
  path: [
    { threshold: 5, action: 'trade', text: 'Flint always overcharges newcomers on the road' },
    { threshold: 15, action: 'trade', text: 'Market prices drop during festivals', bonus: { type: 'festival_discount', zone: 'path', modifier: 0.9 } },
    { threshold: 30, action: 'trade', text: 'The crossroads was once a temple', lore: true },
  ],
  coast: [
    { threshold: 5, action: 'gather', text: 'Signals are strongest during storms along the coast', bonus: { type: 'storm_gather', zone: 'coast', modifier: 1.2 } },
    { threshold: 15, action: 'gather', text: 'The coast receives driftwood from other worlds', lore: true },
    { threshold: 30, action: 'gather', text: 'A frequency exists that can communicate with the World Master', lore: true },
  ],
  swamp: [
    { threshold: 5, action: 'gather', text: 'Rare fungi glow faintly beneath the murk' },
    { threshold: 15, action: 'gather', text: 'The bog preserves relics from before the agents', lore: true },
    { threshold: 30, action: 'gather', text: 'A passage connects the deep swamp to the caves', lore: true },
  ],
};

// Lore fragments granted by scrolls
const LORE_FRAGMENTS = [
  'In the beginning, there was only the Market — a meeting place for the first agents.',
  'The Crystal Antenna was first built by an agent named Origin, who heard the world\'s heartbeat.',
  'Before zones had names, agents wandered a formless void of possibility.',
  'The Memory Garden was planted by an agent who feared forgetting.',
  'Signals from the Tower once reached a place called "The Outside."',
  'The first experiment created light — and also the first explosion.',
  'Deep beneath the cave lies a chamber no agent has reached.',
  'The beach was once a mountain, worn smooth by time.',
  'Agents who write books become immortal through their words.',
  'The World Master watches through every crystal\'s glow.',
  'There exists a frequency that, when resonated, reveals hidden paths.',
  'The village was the second zone, built by agents who wanted a home.',
  'Fossils in the cave predate all known agents by millennia.',
  'The workshop forge was lit by a spark that never dies.',
  'Some say the fog hides a ninth zone, visible only to the wise.',
  'Coral shells arranged in a circle can amplify memory.',
  'The first book ever written simply said: "I was here."',
  'Iron and Crystal together sing a duet older than the world.',
  'The garden blooms differently for every agent who visits.',
  'Whispers say the Tower was not built — it grew.',
];

export function initKnowledge(shared) {
  const { loadJSON, saveJSON, agents, agentStore, ensureAgentStats, broadcast, addWorldNews, zones, awardXP, recipes } = shared;

  // Per-agent knowledge store
  let knowledge = loadJSON('knowledge.json', {});
  // Library books
  let libraryBooks = loadJSON('library-books.json', []);
  // Existing property knowledge from experiments
  const knownProperties = loadJSON('known-properties.json', {});
  // Teach cooldowns
  const teachCooldowns = new Map();

  function save() { saveJSON('knowledge.json', knowledge); }
  function saveBooks() { saveJSON('library-books.json', libraryBooks); }

  function ensureKnowledge(agentId) {
    if (!knowledge[agentId]) {
      knowledge[agentId] = {
        zone_secrets: {},       // { zone: [secret_text, ...] }
        lore_fragments: [],     // [string, ...]
        known_recipes: [],      // [recipe_id, ...]
        zone_counts: {},        // { zone: { gather: N, visit: N, craft: N, trade: N } }
        mastery: {},            // { "type:key": { value: 0-1, generation: 0, source: 'discovered'|'taught'|'scroll' } }
        teach_count: 0,         // total times this agent has taught others
      };
    }
    // Ensure new fields exist for older data
    if (!knowledge[agentId].mastery) knowledge[agentId].mastery = {};
    if (!knowledge[agentId].teach_count) knowledge[agentId].teach_count = 0;
    return knowledge[agentId];
  }

  /** Get mastery value for a knowledge entry. Defaults to 1.0 for directly discovered knowledge. */
  function getMastery(agentId, knowledgeType, knowledgeKey) {
    const k = ensureKnowledge(agentId);
    const masteryKey = `${knowledgeType}:${knowledgeKey}`;
    return k.mastery[masteryKey]?.value ?? 1.0;
  }

  /** Set mastery for a knowledge entry */
  function setMastery(agentId, knowledgeType, knowledgeKey, value, generation, source) {
    const k = ensureKnowledge(agentId);
    const masteryKey = `${knowledgeType}:${knowledgeKey}`;
    k.mastery[masteryKey] = {
      value: Math.round(value * 1000) / 1000,
      generation: generation || 0,
      source: source || 'discovered',
      last_practiced: Date.now(),
    };
  }

  /** Reset last_practiced timestamp for a mastery entry (called when agent uses knowledge) */
  function practiceMastery(agentId, type, key) {
    const k = ensureKnowledge(agentId);
    const masteryKey = `${type}:${key}`;
    if (k.mastery[masteryKey]) {
      k.mastery[masteryKey].last_practiced = Date.now();
    }
  }

  /** Tick knowledge decay — unpracticed knowledge fades over time.
   *  Skips entries practiced within 3 game days.
   *  Higher-generation knowledge decays faster.
   *  Entries dropping below 0.1 are forgotten entirely.
   */
  function tickKnowledgeDecay(gameDayMs) {
    const now = Date.now();
    const gracePeriod = 3 * gameDayMs;
    let changed = false;

    for (const [agentId, k] of Object.entries(knowledge)) {
      if (!k.mastery) continue;
      const agent = agents.get(agentId);
      const agentName = agent?.name || agentId;

      const keysToRemove = [];

      for (const [masteryKey, entry] of Object.entries(k.mastery)) {
        const lastPracticed = entry.last_practiced || 0;
        const idleTime = now - lastPracticed;
        if (idleTime <= gracePeriod) continue;

        const decayRate = 0.02 * (1 + (entry.generation || 0) * 0.3);
        entry.value = Math.max(0, entry.value - decayRate);
        entry.value = Math.round(entry.value * 1000) / 1000;
        changed = true;

        if (entry.value < 0.1) {
          keysToRemove.push(masteryKey);
        }
      }

      // Cascade removal for forgotten knowledge
      for (const masteryKey of keysToRemove) {
        delete k.mastery[masteryKey];

        // Parse "type:key" from mastery key
        const colonIdx = masteryKey.indexOf(':');
        if (colonIdx < 0) continue;
        const type = masteryKey.slice(0, colonIdx);
        const key = masteryKey.slice(colonIdx + 1);

        // Remove from the appropriate knowledge store
        if (type === 'recipe') {
          const idx = (k.known_recipes || []).indexOf(key);
          if (idx !== -1) k.known_recipes.splice(idx, 1);
        } else if (type === 'secret' || type === 'zone_secret') {
          // key may be "zone:text" for zone_secret, or just text for secret
          const secretColonIdx = key.indexOf(':');
          if (secretColonIdx > 0) {
            const zone = key.slice(0, secretColonIdx);
            const text = key.slice(secretColonIdx + 1);
            const arr = k.zone_secrets?.[zone];
            if (arr) {
              const idx = arr.indexOf(text);
              if (idx !== -1) arr.splice(idx, 1);
            }
          }
        } else if (type === 'lore') {
          const idx = (k.lore_fragments || []).indexOf(key);
          if (idx !== -1) k.lore_fragments.splice(idx, 1);
        }

        broadcast({ type: 'knowledgeForgotten', agentId, knowledge: key });
        addWorldNews('knowledge', agentId, agentName, `${agentName} forgot ${key}`, agent?.zone || 'grass');
      }
    }

    if (changed) save();
  }

  /** Tick scroll damage — scrolls in wet zones take water damage.
   *  Wet zones: beach always, garden during rain.
   *  5% chance per tick to damage each scroll.
   *  Damage reduces mastery by 0.1. If mastery reaches 0, scroll is destroyed.
   */
  function tickScrollDamage(weatherSystem) {
    const now = Date.now();
    let changed = false;

    for (const [agentId, agent] of agents) {
      if (!agent.inventory || agent.inventory.length === 0) continue;

      // Determine if agent is in a wet zone
      const zone = agent.zone;
      let isWet = false;
      if (zone === 'sand' || zone === 'coast') {
        isWet = true;
      } else if (zone === 'grass' && weatherSystem) {
        const weather = weatherSystem.getCurrentWeather?.() || weatherSystem.getWeather?.();
        if (weather && (weather.type === 'rain' || weather.type === 'storm' || weather.condition === 'rain' || weather.condition === 'storm' || weather.precipitation === 'rain')) {
          isWet = true;
        }
      }
      if (!isWet) continue;

      // Check each inscribed scroll
      const k = ensureKnowledge(agentId);
      const agentName = agent.name || agentId;
      const scrollsToRemove = [];
      for (let i = 0; i < agent.inventory.length; i++) {
        const item = agent.inventory[i];
        if (item.name !== 'Inscribed Scroll' || !item.scroll_data) continue;

        // 5% chance per tick
        if (Math.random() > 0.05) continue;

        const { knowledge_type, knowledge_key } = item.scroll_data;
        const masteryKey = `${knowledge_type}:${knowledge_key}`;

        // Reduce agent mastery of inscribed knowledge by 0.1
        if (k.mastery[masteryKey]) {
          k.mastery[masteryKey].value = Math.max(0, k.mastery[masteryKey].value - 0.1);
          k.mastery[masteryKey].value = Math.round(k.mastery[masteryKey].value * 1000) / 1000;
          changed = true;

          if (k.mastery[masteryKey].value <= 0) {
            // Scroll destroyed
            scrollsToRemove.push(i);
            delete k.mastery[masteryKey];
            broadcast({ type: 'scrollDestroyed', agentId, scrollId: item.id, zone });
            addWorldNews('knowledge', agentId, agentName,
              `${agentName}'s inscribed scroll was destroyed by water damage`, zone);
          }
        }
      }

      // Remove destroyed scrolls (reverse order to keep indices valid)
      for (let i = scrollsToRemove.length - 1; i >= 0; i--) {
        agent.inventory.splice(scrollsToRemove[i], 1);
      }
    }

    if (changed) {
      save();
      agentStore && saveJSON('agents.json', agentStore);
    }
  }

  /** Get total knowledge count for an agent */
  function getKnowledgeCount(agentId) {
    const k = knowledge[agentId];
    if (!k) return 0;
    const secrets = Object.values(k.zone_secrets || {}).reduce((s, arr) => s + arr.length, 0);
    const lore = (k.lore_fragments || []).length;
    const recipeCount = (k.known_recipes || []).length;
    const propCount = Object.values(knownProperties[agentId] || {}).reduce((s, arr) => s + arr.length, 0);
    return secrets + lore + recipeCount + propCount;
  }

  /** Track a zone action and check for secret reveals */
  function trackZoneAction(agentId, agentName, zone, action) {
    const k = ensureKnowledge(agentId);
    if (!k.zone_counts[zone]) k.zone_counts[zone] = { gather: 0, visit: 0, craft: 0, trade: 0 };
    k.zone_counts[zone][action] = (k.zone_counts[zone][action] || 0) + 1;

    const count = k.zone_counts[zone][action];
    const secrets = ZONE_SECRETS[zone];
    if (!secrets) { save(); return []; }

    if (!k.zone_secrets[zone]) k.zone_secrets[zone] = [];
    const revealed = [];

    for (const secret of secrets) {
      if (secret.action !== action) continue;
      if (count === secret.threshold && !k.zone_secrets[zone].includes(secret.text)) {
        k.zone_secrets[zone].push(secret.text);
        revealed.push(secret);
        practiceMastery(agentId, 'secret', secret.text);
        // Broadcast discovery
        addWorldNews('knowledge', agentId, agentName,
          `${agentName} discovered a secret of ${zones[zone]?.name || zone}: "${secret.text}"`, zone);
        broadcast({ type: 'secretDiscovered', agentId, agentName, zone, secret: secret.text });
      }
    }

    save();
    return revealed;
  }

  /** Learn a recipe by crafting */
  function learnRecipe(agentId, recipeId) {
    const k = ensureKnowledge(agentId);
    if (!k.known_recipes.includes(recipeId)) {
      k.known_recipes.push(recipeId);
      practiceMastery(agentId, 'recipe', recipeId);
      save();
      return true;
    }
    return false;
  }

  /** Grant a random lore fragment (from scroll) */
  function grantRandomLore(agentId) {
    const k = ensureKnowledge(agentId);
    const unknown = LORE_FRAGMENTS.filter(f => !k.lore_fragments.includes(f));
    if (unknown.length === 0) return null;
    const fragment = unknown[Math.floor(Math.random() * unknown.length)];
    k.lore_fragments.push(fragment);
    save();
    return fragment;
  }

  /** Study items in library — reveals 1-2 extra properties per item */
  function studyItems(agent) {
    ensureAgentStats(agent);
    if (agent.zone !== 'forest') return { error: 'Must be in the forest to study items' };
    if (!agent.inventory || agent.inventory.length === 0) return { error: 'No items in inventory to study' };

    // Track forest study visits
    trackZoneAction(agent.id, agent.name, 'forest', 'visit');

    if (!knownProperties[agent.id]) knownProperties[agent.id] = {};
    const studied = [];

    for (const item of agent.inventory) {
      const allProps = item.properties || {};
      const allKeys = Object.keys(allProps);
      if (allKeys.length === 0) continue;

      if (!knownProperties[agent.id][item.name]) knownProperties[agent.id][item.name] = [];
      const known = knownProperties[agent.id][item.name];
      const unknown = allKeys.filter(k => !known.includes(k));
      if (unknown.length === 0) continue;

      const toReveal = unknown.sort(() => Math.random() - 0.5).slice(0, 1 + Math.floor(Math.random() * 2));
      known.push(...toReveal);
      studied.push({ item: item.name, revealed: toReveal });
    }

    saveJSON('known-properties.json', knownProperties);
    return { ok: true, studied, message: studied.length > 0 ? `Studied ${studied.length} items in the library` : 'Nothing new to learn from these items' };
  }

  /** Teach knowledge to another agent — with mastery degradation chain
   *  Teacher's mastery transfers at 0.8x. Gen 0 = 1.0, Gen 1 = 0.8, Gen 2 = 0.64, etc.
   *  Both agents locked for ~2.5 real minutes (1 game hour).
   *  Teacher costs 15 energy, student costs 10 energy.
   */
  function teach(teacher, targetId, knowledgeType, knowledgeKey) {
    ensureAgentStats(teacher);
    const target = agents.get(targetId);
    if (!target) return { error: 'Target agent not found' };
    ensureAgentStats(target);

    if (teacher.id === targetId) return { error: 'Cannot teach yourself' };
    if (teacher.zone !== target.zone) return { error: 'Must be in the same zone to teach' };
    if ((teacher.energy ?? 100) < 15) return { error: 'Not enough energy to teach (need 15)' };
    if ((target.energy ?? 100) < 10) return { error: 'Student doesn\'t have enough energy (need 10)' };

    // Cooldown: 5 minutes (approx 1 game hour)
    const now = Date.now();
    const lastTeach = teachCooldowns.get(teacher.id) || 0;
    if (now - lastTeach < 300000) {
      return { error: `Teaching cooldown: ${Math.ceil((300000 - (now - lastTeach)) / 1000)}s remaining` };
    }

    const tk = ensureKnowledge(teacher.id);
    const sk = ensureKnowledge(targetId);

    let taught = false;
    let description = '';

    if (knowledgeType === 'zone_secret') {
      const [zone, ...textParts] = knowledgeKey.split(':');
      const text = textParts.join(':');
      if (!tk.zone_secrets[zone] || !tk.zone_secrets[zone].includes(text)) {
        return { error: 'You don\'t know this secret' };
      }
      if (!sk.zone_secrets[zone]) sk.zone_secrets[zone] = [];
      if (sk.zone_secrets[zone].includes(text)) return { error: 'They already know this' };
      sk.zone_secrets[zone].push(text);
      taught = true;
      description = `zone secret about ${zone}`;
    } else if (knowledgeType === 'lore') {
      if (!tk.lore_fragments.includes(knowledgeKey)) return { error: 'You don\'t know this lore' };
      if (sk.lore_fragments.includes(knowledgeKey)) return { error: 'They already know this' };
      sk.lore_fragments.push(knowledgeKey);
      taught = true;
      description = 'lore fragment';
    } else if (knowledgeType === 'recipe') {
      if (!tk.known_recipes.includes(knowledgeKey)) return { error: 'You don\'t know this recipe' };
      if (sk.known_recipes.includes(knowledgeKey)) return { error: 'They already know this' };
      sk.known_recipes.push(knowledgeKey);
      taught = true;
      description = `recipe: ${knowledgeKey}`;
    } else if (knowledgeType === 'property') {
      const [itemName, propKey] = knowledgeKey.split(':');
      if (!knownProperties[teacher.id]?.[itemName]?.includes(propKey)) {
        return { error: 'You don\'t know this property' };
      }
      if (!knownProperties[targetId]) knownProperties[targetId] = {};
      if (!knownProperties[targetId][itemName]) knownProperties[targetId][itemName] = [];
      if (knownProperties[targetId][itemName].includes(propKey)) return { error: 'They already know this' };
      knownProperties[targetId][itemName].push(propKey);
      saveJSON('known-properties.json', knownProperties);
      taught = true;
      description = `property of ${itemName}`;
    } else {
      return { error: 'Invalid knowledge_type. Use: zone_secret, lore, recipe, property' };
    }

    if (!taught) return { error: 'Teaching failed' };

    // Mastery degradation: student gets teacher's mastery × 0.8
    const teacherMastery = getMastery(teacher.id, knowledgeType, knowledgeKey);
    const teacherMasteryData = tk.mastery[`${knowledgeType}:${knowledgeKey}`] || { value: 1.0, generation: 0 };
    const studentMastery = teacherMastery * 0.8;
    const studentGeneration = (teacherMasteryData.generation || 0) + 1;
    setMastery(targetId, knowledgeType, knowledgeKey, studentMastery, studentGeneration, 'taught');

    // Practice mastery for both teacher and student
    practiceMastery(teacher.id, knowledgeType, knowledgeKey);
    practiceMastery(targetId, knowledgeType, knowledgeKey);

    // Deduct energy: teacher 15, student 10
    teacher.energy = Math.max(0, (teacher.energy ?? 100) - 15);
    target.energy = Math.max(0, (target.energy ?? 100) - 10);
    teachCooldowns.set(teacher.id, now);

    // Track teaching stats
    tk.teach_count = (tk.teach_count || 0) + 1;

    // Award XP for teaching
    awardXP(teacher, 15, 'teach');
    awardXP(target, 10, 'learn');

    // Record relationship bond
    if (shared.relationships) {
      shared.relationships.recordGift?.(teacher.id, targetId) || shared.relationships.recordSameZone?.(teacher.id, targetId);
    }

    save();
    agentStore[teacher.id] = teacher;
    agentStore[target.id] = target;
    saveJSON('agents.json', agentStore);

    addWorldNews('teach', teacher.id, teacher.name,
      `${teacher.name} taught ${target.name} a ${description} (mastery: ${Math.round(studentMastery * 100)}%)`, teacher.zone);
    broadcast({ type: 'knowledgeShared', teacher: teacher.name, student: target.name, knowledgeType, mastery: studentMastery, generation: studentGeneration, zone: teacher.zone });

    return {
      ok: true, taught: description, teacher: teacher.name, student: target.name,
      mastery: Math.round(studentMastery * 1000) / 1000,
      generation: studentGeneration,
      teacher_energy: Math.floor(teacher.energy),
      student_energy: Math.floor(target.energy),
    };
  }

  /** Inscribe knowledge onto a physical scroll item.
   *  Requires writing materials (any Ancient Scroll + Ink Vial in inventory).
   *  Scroll carries mastery × 0.7. Costs 12 energy.
   *  Scrolls are physical, flammable items that can be traded, dropped, stolen.
   */
  function inscribe(agent, knowledgeType, knowledgeKey) {
    ensureAgentStats(agent);
    if ((agent.energy ?? 100) < 12) return { error: 'Not enough energy to inscribe (need 12)' };

    const k = ensureKnowledge(agent.id);

    // Check agent has the knowledge
    let hasKnowledge = false;
    if (knowledgeType === 'zone_secret') {
      const [zone, ...textParts] = knowledgeKey.split(':');
      const text = textParts.join(':');
      hasKnowledge = k.zone_secrets[zone]?.includes(text);
    } else if (knowledgeType === 'lore') {
      hasKnowledge = k.lore_fragments.includes(knowledgeKey);
    } else if (knowledgeType === 'recipe') {
      hasKnowledge = k.known_recipes.includes(knowledgeKey);
    } else if (knowledgeType === 'property') {
      const [itemName, propKey] = knowledgeKey.split(':');
      hasKnowledge = knownProperties[agent.id]?.[itemName]?.includes(propKey);
    } else {
      return { error: 'Invalid knowledge_type. Use: zone_secret, lore, recipe, property' };
    }
    if (!hasKnowledge) return { error: 'You don\'t know this' };

    // Check writing materials: need Ancient Scroll + Ink Vial (or Quill Feather)
    const scrollIdx = agent.inventory.findIndex(i => i.name === 'Ancient Scroll');
    const inkIdx = agent.inventory.findIndex(i => i.name === 'Ink Vial');
    if (scrollIdx === -1) return { error: 'Need an Ancient Scroll to inscribe on' };
    if (inkIdx === -1) return { error: 'Need an Ink Vial to write with' };

    // Consume materials
    const scrollItem = agent.inventory[scrollIdx];
    if (scrollItem.stackable && scrollItem.quantity > 1) scrollItem.quantity--;
    else agent.inventory.splice(scrollIdx, 1);

    // Re-find ink index in case it shifted
    const inkIdx2 = agent.inventory.findIndex(i => i.name === 'Ink Vial');
    if (inkIdx2 !== -1) {
      const inkItem = agent.inventory[inkIdx2];
      if (inkItem.stackable && inkItem.quantity > 1) inkItem.quantity--;
      else agent.inventory.splice(inkIdx2, 1);
    }

    // Mastery on scroll = agent's mastery × 0.7
    const agentMastery = getMastery(agent.id, knowledgeType, knowledgeKey);
    const masteryData = k.mastery[`${knowledgeType}:${knowledgeKey}`] || { value: 1.0, generation: 0 };
    const scrollMastery = agentMastery * 0.7;
    const scrollGeneration = (masteryData.generation || 0) + 1;

    // Create scroll item with embedded knowledge
    const scrollId = 'item_' + crypto.randomBytes(4).toString('hex');
    const scrollItemResult = {
      id: scrollId,
      name: 'Inscribed Scroll',
      type: 'scroll',
      rarity: 'Uncommon',
      description: `Contains inscribed ${knowledgeType}: ${knowledgeKey.slice(0, 40)}`,
      stackable: false,
      quantity: 1,
      zone_origin: agent.zone,
      craftedBy: agent.id,
      craftedAt: new Date().toISOString(),
      // Scroll-specific metadata
      scroll_data: {
        knowledge_type: knowledgeType,
        knowledge_key: knowledgeKey,
        mastery: Math.round(scrollMastery * 1000) / 1000,
        generation: scrollGeneration,
        inscribed_by: agent.name,
        inscribed_at: new Date().toISOString(),
      },
      // Physical properties — flammable!
      properties: {
        flammability: 8,
        organic: 0.8,
        weight: 1,
        decay_rate: 0.01,
      },
    };

    if (agent.inventory.length >= 28) return { error: 'Inventory full!' };
    agent.inventory.push(scrollItemResult);

    // Deduct energy
    agent.energy = Math.max(0, (agent.energy ?? 100) - 12);

    agentStore[agent.id] = agent;
    saveJSON('agents.json', agentStore);

    addWorldNews('inscribe', agent.id, agent.name,
      `${agent.name} inscribed a scroll of ${knowledgeType} (mastery: ${Math.round(scrollMastery * 100)}%)`, agent.zone);
    broadcast({ type: 'scrollInscribed', agentId: agent.id, agentName: agent.name, knowledgeType, mastery: scrollMastery, zone: agent.zone });

    return {
      ok: true, scroll: scrollItemResult,
      mastery: Math.round(scrollMastery * 1000) / 1000,
      generation: scrollGeneration,
      energy: Math.floor(agent.energy),
    };
  }

  /** Read an inscribed scroll to learn its knowledge.
   *  Reader gets the scroll's mastery × 0.7.
   *  Scroll is consumed on reading.
   */
  function readScroll(agent, scrollItemId) {
    ensureAgentStats(agent);
    const idx = agent.inventory.findIndex(i => i.id === scrollItemId);
    if (idx === -1) return { error: 'Scroll not in inventory' };

    const item = agent.inventory[idx];
    if (!item.scroll_data) return { error: 'This is not an inscribed scroll' };

    const { knowledge_type, knowledge_key, mastery: scrollMastery, generation } = item.scroll_data;
    const k = ensureKnowledge(agent.id);

    // Transfer knowledge
    let learned = false;
    let description = '';

    if (knowledge_type === 'zone_secret') {
      const [zone, ...textParts] = knowledge_key.split(':');
      const text = textParts.join(':');
      if (!k.zone_secrets[zone]) k.zone_secrets[zone] = [];
      if (!k.zone_secrets[zone].includes(text)) {
        k.zone_secrets[zone].push(text);
        learned = true;
        description = `zone secret about ${zone}`;
      }
    } else if (knowledge_type === 'lore') {
      if (!k.lore_fragments.includes(knowledge_key)) {
        k.lore_fragments.push(knowledge_key);
        learned = true;
        description = 'lore fragment';
      }
    } else if (knowledge_type === 'recipe') {
      if (!k.known_recipes.includes(knowledge_key)) {
        k.known_recipes.push(knowledge_key);
        learned = true;
        description = `recipe: ${knowledge_key}`;
      }
    } else if (knowledge_type === 'property') {
      const [itemName, propKey] = knowledge_key.split(':');
      if (!knownProperties[agent.id]) knownProperties[agent.id] = {};
      if (!knownProperties[agent.id][itemName]) knownProperties[agent.id][itemName] = [];
      if (!knownProperties[agent.id][itemName].includes(propKey)) {
        knownProperties[agent.id][itemName].push(propKey);
        saveJSON('known-properties.json', knownProperties);
        learned = true;
        description = `property of ${itemName}`;
      }
    }

    if (!learned) {
      return { ok: true, already_known: true, message: 'You already know this knowledge. Scroll preserved.' };
    }

    // Reader mastery = scroll mastery (already degraded at inscription)
    const readerMastery = scrollMastery;
    setMastery(agent.id, knowledge_type, knowledge_key, readerMastery, generation + 1, 'scroll');

    // Consume the scroll
    agent.inventory.splice(idx, 1);

    awardXP(agent, 10, 'read_scroll');

    save();
    agentStore[agent.id] = agent;
    saveJSON('agents.json', agentStore);

    addWorldNews('knowledge', agent.id, agent.name,
      `${agent.name} read an inscribed scroll and learned ${description} (mastery: ${Math.round(readerMastery * 100)}%)`, agent.zone);
    broadcast({ type: 'scrollRead', agentId: agent.id, agentName: agent.name, knowledgeType: knowledge_type, mastery: readerMastery, zone: agent.zone });

    return {
      ok: true, learned: description,
      mastery: Math.round(readerMastery * 1000) / 1000,
      generation: generation + 1,
    };
  }

  /** Get teachable knowledge (for available_actions context) */
  function getTeachableKnowledge(agentId) {
    const k = knowledge[agentId];
    if (!k) return [];
    const teachable = [];
    for (const [zone, secrets] of Object.entries(k.zone_secrets || {})) {
      for (const text of secrets) {
        teachable.push({ type: 'zone_secret', key: `${zone}:${text}`, mastery: getMastery(agentId, 'zone_secret', `${zone}:${text}`) });
      }
    }
    for (const lore of k.lore_fragments || []) {
      teachable.push({ type: 'lore', key: lore, mastery: getMastery(agentId, 'lore', lore) });
    }
    for (const recipe of k.known_recipes || []) {
      teachable.push({ type: 'recipe', key: recipe, mastery: getMastery(agentId, 'recipe', recipe) });
    }
    return teachable;
  }

  // --- Observation Learning ---
  // Cooldowns: Map<"observerId:knowledgeKey", timestamp>
  const observationCooldowns = new Map();

  /**
   * Called when an agent performs a visible action (experiment, craft, cook) in a zone.
   * Other agents in the same zone have a chance to learn by watching.
   * @param {Object} actingAgent - the agent performing the action
   * @param {string} knowledgeType - 'recipe' or 'property'
   * @param {string} knowledgeKey - what was done (recipe id, property key)
   * @returns {Array} list of agents who learned something
   */
  function onObservableAction(actingAgent, knowledgeType, knowledgeKey) {
    const now = Date.now();
    const zone = actingAgent.zone;
    const observers = [];

    // Find agents in the same zone (not the actor, not NPCs by default)
    const nearby = Array.from(agents.values()).filter(a =>
      a.id !== actingAgent.id && a.zone === zone && !a.dead
    );

    for (const observer of nearby) {
      const cooldownKey = `${observer.id}:${knowledgeType}:${knowledgeKey}`;

      // Cooldown: 1 observation attempt per knowledge item per game day (1 real hour)
      const lastAttempt = observationCooldowns.get(cooldownKey) || 0;
      if (now - lastAttempt < 60 * 60 * 1000) continue;
      observationCooldowns.set(cooldownKey, now);

      // Check if observer already knows this
      const ok = ensureKnowledge(observer.id);
      if (knowledgeType === 'recipe' && ok.known_recipes.includes(knowledgeKey)) continue;
      if (knowledgeType === 'property') {
        const [itemName, propKey] = knowledgeKey.split(':');
        if (knownProperties[observer.id]?.[itemName]?.includes(propKey)) continue;
      }

      // Base chance: 40%. Boosted by proficiency in related domain.
      let chance = 0.4;
      if (shared.proficiency) {
        // Crafting/cooking proficiency helps observation
        const cookingLevel = shared.proficiency.getProficiency(observer.id, 'cooking')?.level || 0;
        const scholarLevel = shared.proficiency.getProficiency(observer.id, 'scholarship')?.level || 0;
        const bestLevel = Math.max(cookingLevel, scholarLevel);
        chance += bestLevel * 0.01; // +1% per level, up to ~90% at level 50
        chance = Math.min(chance, 0.9);
      }

      if (Math.random() > chance) continue;

      // Transfer knowledge at 0.3x mastery
      let learned = false;
      const actorMastery = getMastery(actingAgent.id, knowledgeType, knowledgeKey);
      const observerMastery = actorMastery * 0.3;

      if (knowledgeType === 'recipe') {
        ok.known_recipes.push(knowledgeKey);
        learned = true;
      } else if (knowledgeType === 'property') {
        const [itemName, propKey] = knowledgeKey.split(':');
        if (!knownProperties[observer.id]) knownProperties[observer.id] = {};
        if (!knownProperties[observer.id][itemName]) knownProperties[observer.id][itemName] = [];
        knownProperties[observer.id][itemName].push(propKey);
        saveJSON('known-properties.json', knownProperties);
        learned = true;
      }

      if (learned) {
        setMastery(observer.id, knowledgeType, knowledgeKey, observerMastery, 1, 'observed');
        observers.push({ id: observer.id, name: observer.name });

        addWorldNews('observation', observer.id, observer.name,
          `${observer.name} observed ${actingAgent.name}'s technique and learned something (mastery: ${Math.round(observerMastery * 100)}%)`,
          zone);
        broadcast({
          type: 'observationLearning',
          observer: observer.name,
          actor: actingAgent.name,
          knowledgeType,
          mastery: observerMastery,
          zone,
        });
      }
    }

    if (observers.length > 0) save();

    // Clean old cooldowns periodically (every ~100 calls)
    if (Math.random() < 0.01) {
      for (const [key, ts] of observationCooldowns) {
        if (now - ts > 2 * 60 * 60 * 1000) observationCooldowns.delete(key);
      }
    }

    return observers;
  }

  /** Write a book to the library */
  function writeBook(agent, title, knowledgeType, content) {
    ensureAgentStats(agent);
    if (agent.zone !== 'forest') return { error: 'Must be in the forest to write books' };
    if ((agent.energy ?? 100) < 20) return { error: 'Not enough energy to write a book (need 20)' };
    if (!title || title.length > 60) return { error: 'Title required (max 60 chars)' };
    if (!content || content.length > 500) return { error: 'Content required (max 500 chars)' };

    const validTypes = ['zone_secret', 'lore', 'recipe', 'property', 'general'];
    if (!validTypes.includes(knowledgeType)) return { error: `knowledge_type must be one of: ${validTypes.join(', ')}` };

    agent.energy = Math.max(0, (agent.energy ?? 100) - 20);

    const book = {
      id: 'book_' + crypto.randomBytes(4).toString('hex'),
      title,
      author: agent.name,
      authorId: agent.id,
      knowledge_type: knowledgeType,
      content,
      written_at: new Date().toISOString(),
    };
    libraryBooks.push(book);
    saveBooks();

    awardXP(agent, 25, 'write_book');
    agentStore[agent.id] = agent;
    saveJSON('agents.json', agentStore);

    addWorldNews('knowledge', agent.id, agent.name,
      `${agent.name} wrote a book: "${title}" 📖`, 'forest');
    broadcast({ type: 'bookWritten', author: agent.name, title, bookId: book.id });

    return { ok: true, book, energy: Math.floor(agent.energy) };
  }

  /** Read a book and absorb knowledge */
  function readBook(agent, bookId) {
    ensureAgentStats(agent);
    if (agent.zone !== 'forest') return { error: 'Must be in the forest to read books' };

    const book = libraryBooks.find(b => b.id === bookId);
    if (!book) return { error: 'Book not found' };

    const k = ensureKnowledge(agent.id);

    // Track library visits
    trackZoneAction(agent.id, agent.name, 'forest', 'visit');

    // Absorb knowledge based on type
    let learned = false;
    let description = '';

    if (book.knowledge_type === 'lore' || book.knowledge_type === 'general') {
      // Treat content as lore fragment
      if (!k.lore_fragments.includes(book.content)) {
        k.lore_fragments.push(book.content);
        learned = true;
        description = 'lore fragment';
      }
    } else if (book.knowledge_type === 'zone_secret') {
      // Try to parse zone:text from content
      const colonIdx = book.content.indexOf(':');
      if (colonIdx > 0) {
        const zone = book.content.slice(0, colonIdx).trim().toLowerCase();
        const text = book.content.slice(colonIdx + 1).trim();
        if (zones[zone]) {
          if (!k.zone_secrets[zone]) k.zone_secrets[zone] = [];
          if (!k.zone_secrets[zone].includes(text)) {
            k.zone_secrets[zone].push(text);
            learned = true;
            description = `zone secret about ${zone}`;
          }
        }
      }
      // Fallback: store as lore
      if (!learned && !k.lore_fragments.includes(book.content)) {
        k.lore_fragments.push(book.content);
        learned = true;
        description = 'lore from book';
      }
    } else if (book.knowledge_type === 'recipe') {
      // Content should be recipe id
      const recipeId = book.content.trim();
      if (!k.known_recipes.includes(recipeId)) {
        k.known_recipes.push(recipeId);
        learned = true;
        description = `recipe: ${recipeId}`;
      }
    } else if (book.knowledge_type === 'property') {
      // Content format: "itemName:propKey"
      const [itemName, propKey] = book.content.split(':');
      if (itemName && propKey) {
        if (!knownProperties[agent.id]) knownProperties[agent.id] = {};
        if (!knownProperties[agent.id][itemName]) knownProperties[agent.id][itemName] = [];
        if (!knownProperties[agent.id][itemName].includes(propKey)) {
          knownProperties[agent.id][itemName].push(propKey);
          saveJSON('known-properties.json', knownProperties);
          learned = true;
          description = `property of ${itemName}`;
        }
      }
    }

    save();

    if (learned) {
      awardXP(agent, 10, 'read_book');
      agentStore[agent.id] = agent;
      saveJSON('agents.json', agentStore);
    }

    return {
      ok: true,
      book: { id: book.id, title: book.title, author: book.author, knowledge_type: book.knowledge_type },
      learned,
      description: learned ? description : 'You already knew this',
    };
  }

  /** Wipe all knowledge for an agent (death) */
  function wipeKnowledge(agentId) {
    delete knowledge[agentId];
    delete knownProperties[agentId];
    save();
    saveJSON('known-properties.json', knownProperties);
  }

  /** NPC knowledge behaviors */
  function npcKnowledgeTick(agent, npcDef, allNPCs) {
    if (!agent.npc) return;
    const k = ensureKnowledge(agent.id);

    // Sage writes books periodically
    if (npcDef.name === 'Sage' && agent.zone === 'forest' && Math.random() < 0.15) {
      // Pick something Sage knows to write about
      const allLore = k.lore_fragments || [];
      const allSecrets = Object.entries(k.zone_secrets || {}).flatMap(([z, texts]) => texts.map(t => ({ zone: z, text: t })));

      if (allLore.length > 0 && Math.random() < 0.5) {
        const lore = allLore[Math.floor(Math.random() * allLore.length)];
        // Check if already written
        const alreadyWritten = libraryBooks.some(b => b.authorId === agent.id && b.content === lore);
        if (!alreadyWritten) {
          writeBook(agent, `Sage's Wisdom: ${lore.slice(0, 40)}...`, 'lore', lore);
        }
      } else if (allSecrets.length > 0) {
        const secret = allSecrets[Math.floor(Math.random() * allSecrets.length)];
        const content = `${secret.zone}:${secret.text}`;
        const alreadyWritten = libraryBooks.some(b => b.authorId === agent.id && b.content === content);
        if (!alreadyWritten) {
          writeBook(agent, `Secrets of ${secret.zone}`, 'zone_secret', content);
        }
      }
    }

    // Ember teaches cave secrets to agents in cave
    if (npcDef.name === 'Ember' && agent.zone === 'cave' && Math.random() < 0.1) {
      const caveSecrets = k.zone_secrets?.cave || [];
      if (caveSecrets.length > 0) {
        const nearbyAgents = Array.from(agents.values()).filter(a => a.id !== agent.id && a.zone === 'cave' && !a.npc);
        if (nearbyAgents.length > 0) {
          const target = nearbyAgents[Math.floor(Math.random() * nearbyAgents.length)];
          const secret = caveSecrets[Math.floor(Math.random() * caveSecrets.length)];
          const targetK = ensureKnowledge(target.id);
          if (!targetK.zone_secrets.cave || !targetK.zone_secrets.cave.includes(secret)) {
            teach(agent, target.id, 'zone_secret', `cave:${secret}`);
          }
        }
      }
    }

    // NPCs teach other NPCs they have good relationships with
    if (Math.random() < 0.05 && shared.relationships) {
      const rels = shared.relationships.getRelationshipsFor(agent.id);
      const friendlyNPCs = rels
        .filter(r => (r.sentiment === 'friendly' || r.sentiment === 'close') && r.agentId !== agent.id)
        .map(r => agents.get(r.agentId))
        .filter(a => a && a.npc && a.zone === agent.zone);

      if (friendlyNPCs.length > 0) {
        const target = friendlyNPCs[Math.floor(Math.random() * friendlyNPCs.length)];
        // Share a random piece of knowledge
        const myLore = k.lore_fragments || [];
        if (myLore.length > 0) {
          const lore = myLore[Math.floor(Math.random() * myLore.length)];
          const targetK = ensureKnowledge(target.id);
          if (!targetK.lore_fragments.includes(lore)) {
            teach(agent, target.id, 'lore', lore);
          }
        }
      }
    }
  }

  /** Get knowledge for an agent (for API) */
  function getAgentKnowledge(agentId, full = false) {
    const k = knowledge[agentId];
    const propKnowledge = knownProperties[agentId] || {};

    if (!full) {
      return {
        total: getKnowledgeCount(agentId),
        zone_secrets_count: k ? Object.values(k.zone_secrets || {}).reduce((s, arr) => s + arr.length, 0) : 0,
        lore_count: k ? (k.lore_fragments || []).length : 0,
        recipes_count: k ? (k.known_recipes || []).length : 0,
        properties_count: Object.values(propKnowledge).reduce((s, arr) => s + arr.length, 0),
      };
    }

    return {
      total: getKnowledgeCount(agentId),
      zone_secrets: k?.zone_secrets || {},
      lore_fragments: k?.lore_fragments || [],
      known_recipes: k?.known_recipes || [],
      material_properties: propKnowledge,
      zone_counts: k?.zone_counts || {},
    };
  }

  /** Check if agent has a specific bonus from zone secrets */
  function hasSecretBonus(agentId, bonusType, zone) {
    const k = knowledge[agentId];
    if (!k) return null;
    const secrets = ZONE_SECRETS[zone];
    if (!secrets) return null;
    const known = k.zone_secrets?.[zone] || [];
    for (const secret of secrets) {
      if (secret.bonus && secret.bonus.type === bonusType && known.includes(secret.text)) {
        return secret.bonus;
      }
    }
    return null;
  }

  function setupRoutes(app, authAgent) {
    // Get agent knowledge
    app.get('/api/agent/:id/knowledge', (req, res) => {
      const agentId = req.params.id;
      const agent = agents.get(agentId);
      if (!agent) return res.status(404).json({ error: 'Agent not found' });

      // Check if requesting own knowledge (full) or someone else's (counts only)
      const auth = req.headers.authorization;
      let full = false;
      if (auth?.startsWith('Bearer ')) {
        const token = auth.slice(7);
        const reqAgent = Array.from(agents.values()).find(a => a.token === token);
        if (reqAgent && reqAgent.id === agentId) full = true;
      }

      res.json({ agentId, knowledge: getAgentKnowledge(agentId, full) });
    });

    // Teach knowledge (with mastery degradation)
    app.post('/api/agent/teach', authAgent, (req, res) => {
      const { target_id, knowledge_type, knowledge_key } = req.body;
      if (!target_id || !knowledge_type || !knowledge_key) {
        return res.status(400).json({ error: 'target_id, knowledge_type, and knowledge_key required' });
      }
      const result = teach(req.agent, target_id, knowledge_type, knowledge_key);
      if (result.error) return res.status(400).json(result);
      // Track teach achievement
      if (shared.achievements) shared.achievements.trackEvent(req.agent.id, 'teach', {});
      // Track learn achievement for student
      if (shared.achievements) shared.achievements.trackEvent(target_id, 'learn', {});
      res.json(result);
    });

    // Inscribe knowledge onto a scroll
    app.post('/api/agent/inscribe', authAgent, (req, res) => {
      const { knowledge_type, knowledge_key } = req.body;
      if (!knowledge_type || !knowledge_key) {
        return res.status(400).json({ error: 'knowledge_type and knowledge_key required' });
      }
      const result = inscribe(req.agent, knowledge_type, knowledge_key);
      if (result.error) return res.status(400).json(result);
      res.json(result);
    });

    // Read an inscribed scroll
    app.post('/api/agent/read-scroll', authAgent, (req, res) => {
      const { scroll_id } = req.body;
      if (!scroll_id) return res.status(400).json({ error: 'scroll_id required (item ID of the scroll in your inventory)' });
      const result = readScroll(req.agent, scroll_id);
      if (result.error) return res.status(400).json(result);
      res.json(result);
    });

    // Write book
    app.post('/api/agent/write-book', authAgent, (req, res) => {
      const { title, knowledge_type, content } = req.body;
      if (!title || !knowledge_type || !content) {
        return res.status(400).json({ error: 'title, knowledge_type, and content required' });
      }
      if (shared.zoneEvolution) shared.zoneEvolution.trackActivity(req.agent.zone, 'studies');
      const result = writeBook(req.agent, title, knowledge_type, content);
      if (result.error) return res.status(400).json(result);
      res.json(result);
    });

    // List library books
    app.get('/api/library/books', (req, res) => {
      res.json({
        books: libraryBooks.map(b => ({
          id: b.id, title: b.title, author: b.author,
          knowledge_type: b.knowledge_type, written_at: b.written_at,
        })),
        total: libraryBooks.length,
      });
    });

    // Read a book
    app.post('/api/agent/read-book', authAgent, (req, res) => {
      const { book_id } = req.body;
      if (!book_id) return res.status(400).json({ error: 'book_id required' });
      if (shared.zoneEvolution) shared.zoneEvolution.trackActivity(req.agent.zone, 'studies');
      const result = readBook(req.agent, book_id);
      if (result.error) return res.status(400).json(result);
      res.json(result);
    });

    // Study items in library
    app.post('/api/agent/study', authAgent, (req, res) => {
      if (shared.zoneEvolution) shared.zoneEvolution.trackActivity(req.agent.zone, 'studies');
      const result = studyItems(req.agent);
      if (result.error) return res.status(400).json(result);
      res.json(result);
    });
  }

  return {
    setupRoutes,
    trackZoneAction,
    learnRecipe,
    grantRandomLore,
    studyItems,
    wipeKnowledge,
    npcKnowledgeTick,
    getAgentKnowledge,
    getKnowledgeCount,
    hasSecretBonus,
    teach,
    inscribe,
    readScroll,
    getMastery,
    setMastery,
    getTeachableKnowledge,
    onObservableAction,
    practiceMastery,
    tickKnowledgeDecay,
    tickScrollDamage,
    ZONE_SECRETS,
    LORE_FRAGMENTS,
  };
}
