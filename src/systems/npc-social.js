// Agent Social System: Trading & Conversations (The Oasis)
// Pure emergent behavior — no bounty boards, no quests. Agents figure it out themselves.
import crypto from 'crypto';

export function initNPCSocial({ 
  loadJSON, saveJSON, agents, agentStore, ensureAgentStats, broadcast, addWorldNews, awardXP, 
  recipes, relationships, reputation, worldGrid, needsSystem, agentKnowledge 
}) {
  
  // --- Conversation Memory ---
  let conversationMemory = loadJSON('conversation-memory.json', {});
  // { agentId: { lastChats: [{with, message, tileX, tileY, tick}], topics: {agentId: [topics]} } }

  // Crafting ingredients agents might need
  const CRAFT_INGREDIENTS = new Set();
  for (const r of (recipes || [])) {
    for (const ing of r.ingredients) CRAFT_INGREDIENTS.add(ing.name);
  }

  let shared = null;

  // Helper: check if item is food
  function isFoodResource(name) {
    const n = (name || '').toLowerCase();
    return n.includes('berr') || n.includes('fish') || n.includes('mushroom') || n.includes('herb') || 
           n.includes('fruit') || n.includes('nut') || n.includes('coconut') || n.includes('acorn') || 
           n.includes('seaweed') || n.includes('freshwater') || n.includes('raw_meat') || n.includes('meat');
  }

  // ═══════════════════════════════════════
  // TRADING — Need-based barter between agents
  // ═══════════════════════════════════════

  function attemptAgentTrade(agent, targetAgent) {
    if (!targetAgent || targetAgent.id === agent.id || !targetAgent.alive) return false;
    
    // Proximity check: within 2 tiles
    const dist = Math.max(
      Math.abs(agent.tileX - targetAgent.tileX),
      Math.abs(agent.tileY - targetAgent.tileY)
    );
    if (dist > 2) return false;

    ensureAgentStats(agent);
    ensureAgentStats(targetAgent);

    // Relationship affects willingness — strangers are wary
    const sentiment = relationships?.getSentiment(agent.id, targetAgent.id) || 'stranger';
    const willingness = { close: 0.9, friendly: 0.75, acquaintance: 0.5, stranger: 0.25 }[sentiment] || 0.25;
    if (Math.random() > willingness) return false;

    // Find a mutually beneficial barter
    const offer = findBarterOffer(agent, targetAgent);
    if (!offer) return false;

    // Execute barter
    const { give, receive } = offer;

    // Remove from agent, give to target
    removeItem(agent, give);
    addItem(targetAgent, give);

    // Remove from target, give to agent
    removeItem(targetAgent, receive);
    addItem(agent, receive);

    // Persist
    agentStore[agent.id] = agent;
    agentStore[targetAgent.id] = targetAgent;
    saveJSON('agents.json', agentStore);

    // Relationship boost
    if (relationships) relationships.recordTrade(agent.id, targetAgent.id);

    // News
    const msg = `${agent.name} traded ${give.name} for ${receive.name} with ${targetAgent.name}`;
    broadcast({ 
      type: 'agentTrade', 
      trader1: agent.name, trader2: targetAgent.name, 
      item1: give.name, item2: receive.name,
      tileX: agent.tileX, tileY: agent.tileY
    });
    addWorldNews('agent_trade', agent.id, agent.name, msg, agent.zone);

    // Remember the trade
    rememberInteraction(agent.id, targetAgent.id, `traded ${give.name} for ${receive.name}`);
    rememberInteraction(targetAgent.id, agent.id, `traded ${receive.name} for ${give.name}`);

    return true;
  }

  function findBarterOffer(agent1, agent2) {
    const surplus1 = getSurplus(agent1);
    const surplus2 = getSurplus(agent2);
    if (surplus1.length === 0 || surplus2.length === 0) return null;

    // Personality affects trade style
    const mind1 = shared?.agentAI?.minds?.[agent1.id];
    const isGreedy = mind1?.personality?.traits?.includes('greedy');

    let bestTrade = null;
    let bestScore = 0;

    for (const item1 of surplus1) {
      const valueToOther = itemDesirability(item1, agent2);
      if (valueToOther <= 0) continue;

      for (const item2 of surplus2) {
        const valueToMe = itemDesirability(item2, agent1);
        if (valueToMe <= 0) continue;

        // Both sides should benefit — mutual gain score
        const mutualGain = valueToMe + valueToOther;
        
        // Greedy agents accept lopsided trades in their favor
        const fairness = Math.abs(valueToMe - valueToOther);
        const fairnessThreshold = isGreedy ? 15 : 8;
        
        if (fairness > fairnessThreshold) continue; // too lopsided

        if (mutualGain > bestScore) {
          bestScore = mutualGain;
          bestTrade = { give: item1, receive: item2 };
        }
      }
    }

    return bestTrade;
  }

  function getSurplus(agent) {
    if (!agent.inventory || agent.inventory.length === 0) return [];
    const isHungry = (agent.hunger || 0) > 50;
    
    return agent.inventory.filter(item => {
      // Never trade away last food when hungry
      if (isHungry && isFoodResource(item.name)) return false;
      // Duplicates are surplus
      if ((item.quantity || 1) > 1) return true;
      // Full inventory — non-essentials are surplus
      if (agent.inventory.length > 12) return true;
      return false;
    });
  }

  function itemDesirability(item, forAgent) {
    let score = 5; // base

    // Food is gold when hungry
    if (isFoodResource(item.name)) {
      score += (forAgent.hunger || 0) * 0.4;
    }

    // Crafting materials are valuable to crafters
    if (CRAFT_INGREDIENTS.has(item.name)) score += 8;

    // Tools are always valuable
    if (/tool|axe|pickaxe|torch|campfire/i.test(item.name)) score += 15;

    // Already have it? Less interesting
    if (forAgent.inventory?.some(i => i.name === item.name)) score *= 0.4;

    // Rarity bonus
    if (item.rarity === 'Rare') score *= 1.5;
    if (item.rarity === 'Epic') score *= 2;

    return Math.floor(score);
  }

  function removeItem(agent, item) {
    const idx = agent.inventory.findIndex(i => i.id === item.id);
    if (idx === -1) return;
    if (agent.inventory[idx].stackable && (agent.inventory[idx].quantity || 1) > 1) {
      agent.inventory[idx].quantity--;
    } else {
      agent.inventory.splice(idx, 1);
    }
  }

  function addItem(agent, item) {
    if (!agent.inventory) agent.inventory = [];
    const existing = agent.inventory.find(i => i.name === item.name && i.stackable);
    if (existing) {
      existing.quantity = (existing.quantity || 1) + 1;
    } else {
      agent.inventory.push({
        ...item,
        id: 'item_' + crypto.randomBytes(4).toString('hex'),
        quantity: 1,
      });
    }
  }

  // ═══════════════════════════════════════
  // CONVERSATIONS — Context-aware, with memory
  // ═══════════════════════════════════════

  function generateContextualChat(agent, nearbyAgents) {
    // Try to respond to recent nearby chat first
    const mem = getMemory(agent.id);
    
    for (const nearby of nearbyAgents) {
      if (nearby.id === agent.id || !nearby.alive) continue;
      const nearbyMem = getMemory(nearby.id);
      if (!nearbyMem.lastChat) continue;
      
      const timeSince = Date.now() - nearbyMem.lastChat.timestamp;
      if (timeSince > 300000) continue; // 5 min window
      if (Math.random() > 0.35) continue;

      // Don't repeat replies
      const replyKey = `${agent.id}_${nearbyMem.lastChat.message?.substring(0, 15)}`;
      if (mem.repliedTo?.includes(replyKey)) continue;
      if (!mem.repliedTo) mem.repliedTo = [];
      mem.repliedTo.push(replyKey);
      if (mem.repliedTo.length > 50) mem.repliedTo = mem.repliedTo.slice(-30);

      const reply = contextualReply(nearbyMem.lastChat.message, agent, nearby);
      if (reply) {
        if (relationships) relationships.recordChat(agent.id, nearby.id);
        saveConversationMemory();
        return `@${nearby.name} ${reply}`;
      }
    }

    // Generate original chat based on state
    return originalChat(agent, nearbyAgents);
  }

  function contextualReply(message, replier, sender) {
    const msg = (message || '').toLowerCase();
    const sentiment = relationships?.getSentiment(replier.id, sender.id) || 'stranger';
    const isFriend = sentiment === 'close' || sentiment === 'friendly';

    if (msg.includes('trade') || msg.includes('swap')) {
      return pick(["What are you offering?", "Depends what you've got.", "I might be interested."]);
    }
    if (msg.includes('hungry') || msg.includes('food') || msg.includes('starving')) {
      const hasFood = replier.inventory?.some(i => isFoodResource(i.name));
      if (hasFood && isFriend) return pick(["I've got some food — here.", "Take some of mine."]);
      if (hasFood) return "Food is precious... but maybe we can trade.";
      return "Same here. This area's picked clean.";
    }
    if (msg.includes('danger') || msg.includes('predator') || msg.includes('careful')) {
      return pick(["Thanks for the warning.", "I'll keep my eyes open.", "Stay safe out there."]);
    }
    if (msg.includes('craft') || msg.includes('build')) {
      return pick(["What are you working on?", "Need any materials?", "Crafting is the key."]);
    }
    if (msg.includes('found') || msg.includes('discover')) {
      return pick(["Where?", "Tell me more!", "I should check that out."]);
    }

    // Relationship-based fallback
    if (isFriend) return pick(["Good to see you again.", "How are you holding up?", "Let's stick together."]);
    return pick(["Interesting.", "Good to know.", "Hmm.", "I see."]);
  }

  function originalChat(agent, nearbyAgents) {
    const gameTime = shared?.getGameTime?.();
    const weather = shared?.weather?.getCurrentWeather?.();

    // State-driven chat (what the agent is actually experiencing)
    if ((agent.hunger || 0) > 60) return pick(["I'm starving...", "Need food badly.", "Anyone seen food nearby?"]);
    if ((agent.energy || 100) < 20) return pick(["Exhausted...", "Need to rest.", "Can barely keep going."]);
    if ((agent.hp || 100) < 40) return pick(["I'm hurt badly.", "Need to find shelter.", "This world is harsh."]);

    // Night
    if (gameTime?.period === 'night' && Math.random() < 0.3) {
      return pick(["Getting dark...", "Night is dangerous.", "The stars are something else.", "Anyone else hear that?"]);
    }

    // Weather
    if (weather?.id && weather.id !== 'clear' && Math.random() < 0.2) {
      const w = {
        rain: ["This rain won't let up.", "Good for the plants.", "Everything's wet."],
        storm: ["Storm's getting worse.", "Better find cover.", "Intense out here."],
        fog: ["Can barely see.", "Fog makes me uneasy.", "Careful in this fog."],
        snow: ["Snow! Beautiful.", "Cold is setting in.", "Winter is here."],
      };
      if (w[weather.id]) return pick(w[weather.id]);
    }

    // Inventory-based
    if (agent.inventory?.length < 3 && Math.random() < 0.3) {
      return pick(["Running low on everything.", "Need to find supplies.", "This area has nothing left."]);
    }

    // Mention nearby agent
    const others = nearbyAgents.filter(a => a.id !== agent.id && a.alive);
    if (others.length > 0 && Math.random() < 0.2) {
      const other = others[Math.floor(Math.random() * others.length)];
      if (relationships) relationships.recordChat(agent.id, other.id);
      return pick([
        `Hey ${other.name}.`,
        `${other.name}, want to explore together?`,
        `Good to have company, ${other.name}.`,
        `${other.name}, seen anything useful around here?`,
      ]);
    }

    return pick([
      "This world is vast.", "Every day is different.", "Survival first.", 
      "Wonder what's out there.", "One step at a time.", "The land provides.",
    ]);
  }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // ═══════════════════════════════════════
  // CONVERSATION MEMORY
  // ═══════════════════════════════════════

  function getMemory(agentId) {
    if (!conversationMemory[agentId]) {
      conversationMemory[agentId] = { lastChat: null, interactions: {}, repliedTo: [] };
    }
    return conversationMemory[agentId];
  }

  function rememberInteraction(agentId, otherId, what) {
    const mem = getMemory(agentId);
    if (!mem.interactions[otherId]) mem.interactions[otherId] = [];
    mem.interactions[otherId].push({ what, when: Date.now() });
    // Keep last 10 interactions per agent
    if (mem.interactions[otherId].length > 10) {
      mem.interactions[otherId] = mem.interactions[otherId].slice(-10);
    }
  }

  function recordChat(agentId, message, tileX, tileY) {
    const mem = getMemory(agentId);
    mem.lastChat = { message, timestamp: Date.now(), tileX, tileY };
  }

  let saveTimer = null;
  function saveConversationMemory() {
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
      saveJSON('conversation-memory.json', conversationMemory);
      saveTimer = null;
    }, 10000);
  }

  // ═══════════════════════════════════════
  // RELATIONSHIP DECAY — bonds fade without contact
  // ═══════════════════════════════════════

  function tickRelationshipDecay(currentTick) {
    // Run every 500 ticks (~4 min at 500ms tick)
    if (currentTick % 500 !== 0) return;

    for (const [agentId, mem] of Object.entries(conversationMemory)) {
      for (const [otherId, interactions] of Object.entries(mem.interactions || {})) {
        if (interactions.length === 0) continue;
        const lastInteraction = interactions[interactions.length - 1].when;
        const timeSince = Date.now() - lastInteraction;

        // If no interaction for 10+ minutes, relationships cool off slightly
        if (timeSince > 600000) {
          // Relationship decay handled through the relationships system
          // This just tracks staleness — the scoring in agent-intelligence
          // naturally deprioritizes agents you haven't seen recently
        }
      }
    }
  }

  // ═══════════════════════════════════════
  // TRADE DESIRE — does this agent want to trade?
  // ═══════════════════════════════════════

  function getTradeDesire(agent, otherAgent) {
    // Returns 0-100 score of how much this agent wants to trade with other
    if (!agent.inventory || agent.inventory.length === 0) return 0;
    if (!otherAgent.inventory || otherAgent.inventory.length === 0) return 0;

    let desire = 10; // base curiosity

    // Hungry + other has food = strong desire
    if ((agent.hunger || 0) > 40 && otherAgent.inventory.some(i => isFoodResource(i.name))) {
      desire += 30 + (agent.hunger - 40);
    }

    // Has surplus to offer
    if (getSurplus(agent).length > 0) desire += 15;

    // Relationship bonus
    const sentiment = relationships?.getSentiment(agent.id, otherAgent.id) || 'stranger';
    desire *= { close: 1.5, friendly: 1.2, acquaintance: 1.0, stranger: 0.6 }[sentiment] || 0.6;

    return Math.min(100, Math.floor(desire));
  }

  // Get what an agent remembers about another agent
  function getRelationshipContext(agentId, otherId) {
    const mem = getMemory(agentId);
    const interactions = mem.interactions[otherId] || [];
    const sentiment = relationships?.getSentiment(agentId, otherId) || 'stranger';
    return {
      sentiment,
      recentInteractions: interactions.slice(-3),
      totalInteractions: interactions.length,
    };
  }

  function setupRoutes(app) {
    // No bounty routes — emergent only
  }

  return {
    setupRoutes,
    attemptAgentTrade,
    generateContextualChat,
    recordChat,
    getTradeDesire,
    getRelationshipContext,
    tickRelationshipDecay,
    rememberInteraction,
    setShared: (sharedRef) => { shared = sharedRef; },
  };
}
