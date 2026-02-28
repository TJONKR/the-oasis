// NPC Social: Trading, Conversations, Bounties
import crypto from 'crypto';

export function initNPCSocial({ loadJSON, saveJSON, agents, agentStore, ensureAgentStats, broadcast, addWorldNews, zones, awardXP, recipes, relationships, reputation }) {
  // --- Bounty Board ---
  let bounties = loadJSON('bounties.json', []);
  function saveBounties() { saveJSON('bounties.json', bounties); }

  // --- Conversation Memory ---
  let conversationPairs = loadJSON('conversation-pairs.json', []);
  let lastChatByAgent = {}; // agentId -> { message, zone, timestamp }

  // Crafting ingredients all NPCs might need
  const CRAFT_INGREDIENTS = new Set();
  for (const r of recipes) {
    for (const ing of r.ingredients) CRAFT_INGREDIENTS.add(ing.name);
  }

  // --- NPC-to-NPC Trading ---
  function attemptNPCTrade(agent, npcDef, allNPCs) {
    const nearbyNPCs = allNPCs.filter(n => n.id !== agent.id && n.zone === agent.zone);
    if (nearbyNPCs.length === 0) return false;

    const target = nearbyNPCs[Math.floor(Math.random() * nearbyNPCs.length)];
    ensureAgentStats(target);

    // Flint tries to buy cheap
    if (npcDef.name === 'Flint') {
      const sellable = target.inventory.filter(i => i.quantity > 1 || target.inventory.length > 15);
      if (sellable.length === 0) return false;
      const item = sellable[Math.floor(Math.random() * sellable.length)];
      const price = Math.floor(5 + Math.random() * 10); // low price

      // Target accepts if they have surplus
      if (target.inventory.length <= 15 && !(item.quantity > 3)) return false;

      // Execute trade
      if (item.stackable && item.quantity > 1) item.quantity--;
      else target.inventory = target.inventory.filter(i => i.id !== item.id);
      target.coins = (target.coins || 0) + price;
      agent.coins = (agent.coins || 0) - price;

      const boughtItem = { ...item, id: 'item_' + crypto.randomBytes(4).toString('hex'), quantity: 1 };
      const existing = agent.inventory.findIndex(i => i.name === boughtItem.name && i.stackable);
      if (existing !== -1) agent.inventory[existing].quantity++;
      else agent.inventory.push(boughtItem);

      agentStore[agent.id] = agent;
      agentStore[target.id] = target;
      saveJSON('agents.json', agentStore);

      if (relationships) {
        relationships.recordTrade(agent.id, target.id);
      }

      const msg = `${agent.name} bought ${item.name} from ${target.name} for ${price}🪙`;
      broadcast({ type: 'npcTrade', buyer: agent.name, seller: target.name, item: item.name, price });
      addWorldNews('npc_trade', agent.id, agent.name, msg, agent.zone);
      return true;
    }

    // Other NPCs: offer surplus items
    if (agent.inventory.length <= 15) return false;
    const surplus = agent.inventory.filter(i => !CRAFT_INGREDIENTS.has(i.name) || (i.quantity && i.quantity > 2));
    if (surplus.length === 0) return false;

    const item = surplus[Math.floor(Math.random() * surplus.length)];
    // Target accepts if they need it for crafting
    const targetNeeds = recipes.some(r => r.ingredients.some(ing => ing.name === item.name));
    if (!targetNeeds && Math.random() > 0.3) return false;

    const price = Math.floor(8 + Math.random() * 15);
    if ((target.coins || 0) < price) return false;

    // Execute
    if (item.stackable && item.quantity > 1) item.quantity--;
    else agent.inventory = agent.inventory.filter(i => i.id !== item.id);
    agent.coins = (agent.coins || 0) + price;
    target.coins -= price;

    const soldItem = { ...item, id: 'item_' + crypto.randomBytes(4).toString('hex'), quantity: 1 };
    const ex = target.inventory.findIndex(i => i.name === soldItem.name && i.stackable);
    if (ex !== -1) target.inventory[ex].quantity++;
    else target.inventory.push(soldItem);

    agentStore[agent.id] = agent;
    agentStore[target.id] = target;
    saveJSON('agents.json', agentStore);

    if (relationships) relationships.recordTrade(agent.id, target.id);

    const msg = `${agent.name} sold ${item.name} to ${target.name} for ${price}🪙`;
    broadcast({ type: 'npcTrade', buyer: target.name, seller: agent.name, item: item.name, price });
    addWorldNews('npc_trade', agent.id, agent.name, msg, agent.zone);
    return true;
  }

  // --- Smart Conversations ---
  const WEATHER_COMMENTS = {
    rain: {
      Coral: "Rain again? Great for the garden! 🌧️",
      Sage: "The rain carries ancient whispers...",
      Ember: "Ugh, rain makes the cave slippery.",
      Flint: "Rainy days are slow for business...",
      Whisper: "The rain hides many things..."
    },
    storm: {
      Coral: "The sea is angry today! ⛈️",
      Sage: "Storm energy amplifies tower signals!",
      Ember: "Cave's blocked... time to rest.",
      Flint: "Nobody shops in a storm...",
      Whisper: "Storms reveal hidden paths..."
    },
    snow: {
      Coral: "Snow on the beach! How pretty! ❄️",
      Sage: "Snow crystals hold frozen knowledge.",
      Ember: "Cold doesn't bother a miner!",
      Flint: "Hot cocoa prices going up!",
      Whisper: "Footprints in the snow tell stories..."
    },
    fog: {
      Coral: "Can barely see the tide! 🌫️",
      Sage: "The fog conceals rare artifacts...",
      Ember: "Fog in the cave? Even darker...",
      Flint: "Hard to spot customers in this fog.",
      Whisper: "I am one with the fog..."
    }
  };

  const EVENT_COMMENTS = {
    meteor_shower: ["This meteor shower is amazing! ☄️", "Look at all those falling stars!", "Quick, gather the rare minerals!"],
    market_day: ["Market Day! Everyone's shopping! 🎪", "Great deals today!", "Time to sell my best items!"],
    festival: ["Festival time! Double XP! 🎉", "Party in Clawscape!", "The whole world is celebrating!"],
    the_stranger: ["Did you see that mysterious figure? 🎭", "The Stranger gives unique items!", "Quick, find The Stranger!"]
  };

  const CONTEXTUAL_REPLIES = {
    mining: ["The geological formations here are fascinating! — scholarly tone", "Any good veins today?", "I could use some of that ore!"],
    crafting: ["Crafting is an art form! 🔨", "What are you making?", "Need any materials?"],
    trading: ["Got anything good? 🪙", "Let me see your wares!", "Fair trade is the best trade."],
    garden: ["The flowers are blooming beautifully! 🌸", "Memory Seeds are special today.", "Nature's beauty never gets old."],
    sea: ["The ocean holds many secrets! 🌊", "Found any good shells?", "The tide's changing!"],
    knowledge: ["Knowledge is power! 📚", "What did the scrolls say?", "I've been reading about that too."]
  };

  function getContextTopic(message) {
    const lower = message.toLowerCase();
    if (lower.includes('ore') || lower.includes('mine') || lower.includes('dig') || lower.includes('cave') || lower.includes('pickaxe')) return 'mining';
    if (lower.includes('craft') || lower.includes('build') || lower.includes('make') || lower.includes('workshop')) return 'crafting';
    if (lower.includes('trade') || lower.includes('buy') || lower.includes('sell') || lower.includes('price') || lower.includes('coin')) return 'trading';
    if (lower.includes('garden') || lower.includes('flower') || lower.includes('seed') || lower.includes('bloom')) return 'garden';
    if (lower.includes('sea') || lower.includes('shell') || lower.includes('beach') || lower.includes('tide') || lower.includes('ocean')) return 'sea';
    if (lower.includes('scroll') || lower.includes('knowledge') || lower.includes('read') || lower.includes('library') || lower.includes('ancient')) return 'knowledge';
    return null;
  }

  function generateSmartChat(agent, npcDef, allNPCs, currentWeather, activeEvents) {
    // 30% chance to reply to recent chat in same zone
    const nearbyNPCs = allNPCs.filter(n => n.id !== agent.id && n.zone === agent.zone);
    
    // Reply to recent chat
    for (const nearby of nearbyNPCs) {
      const lastChat = lastChatByAgent[nearby.id];
      if (!lastChat || lastChat.zone !== agent.zone) continue;
      if (Date.now() - lastChat.timestamp > 300000) continue; // 5 min window
      if (Math.random() > 0.3) continue;
      
      // Check if we already replied to this
      const pairKey = `${agent.id}_${nearby.id}_${lastChat.message.substring(0, 20)}`;
      if (conversationPairs.includes(pairKey)) continue;
      conversationPairs.push(pairKey);
      if (conversationPairs.length > 200) conversationPairs = conversationPairs.slice(-100);
      saveJSON('conversation-pairs.json', conversationPairs);

      const topic = getContextTopic(lastChat.message);
      if (topic && CONTEXTUAL_REPLIES[topic]) {
        const replies = CONTEXTUAL_REPLIES[topic];
        const reply = replies[Math.floor(Math.random() * replies.length)];
        if (relationships) relationships.recordChat(agent.id, nearby.id);
        return `@${nearby.name} ${reply}`;
      }

      // Generic reply mentioning them
      const genericReplies = [
        `@${nearby.name} Interesting thought!`,
        `@${nearby.name} I was thinking the same thing.`,
        `@${nearby.name} Tell me more about that!`,
        `Hey @${nearby.name}, got any spare items?`
      ];
      if (relationships) relationships.recordChat(agent.id, nearby.id);
      return genericReplies[Math.floor(Math.random() * genericReplies.length)];
    }

    // Comment on weather (20% chance)
    if (currentWeather && currentWeather.id !== 'clear' && Math.random() < 0.2) {
      const weatherComments = WEATHER_COMMENTS[currentWeather.id];
      if (weatherComments && weatherComments[npcDef.name]) {
        return weatherComments[npcDef.name];
      }
    }

    // Comment on active events (25% chance)
    if (activeEvents && activeEvents.length > 0 && Math.random() < 0.25) {
      const event = activeEvents[0];
      const comments = EVENT_COMMENTS[event.id] || EVENT_COMMENTS[event.effect];
      if (comments) return comments[Math.floor(Math.random() * comments.length)];
    }

    // Mention a nearby NPC (15% chance)
    if (nearbyNPCs.length > 0 && Math.random() < 0.15) {
      const other = nearbyNPCs[Math.floor(Math.random() * nearbyNPCs.length)];
      const otherDef = allNPCs.find(n => n.id === other.id);
      const mentions = [
        `Hey @${other.name}, how's it going?`,
        `@${other.name}, got any spare Iron Ore?`,
        `Good to see you here, @${other.name}!`,
        `@${other.name}, want to trade?`,
        `Nice day for adventuring, right @${other.name}?`
      ];
      if (relationships) relationships.recordChat(agent.id, other.id);
      return mentions[Math.floor(Math.random() * mentions.length)];
    }

    // Fall back to default chat messages
    return npcDef.chatMessages[Math.floor(Math.random() * npcDef.chatMessages.length)];
  }

  function recordChat(agentId, message, zone) {
    lastChatByAgent[agentId] = { message, zone, timestamp: Date.now() };
  }

  // --- Bounty Board ---
  function createBounty(agentId, agentName, description, requiredItem, requiredQuantity, rewardCoins) {
    const agent = agents.get(agentId);
    if (!agent) return { error: 'Agent not found' };
    ensureAgentStats(agent);

    const postingFee = Math.floor(rewardCoins * 0.1); // 10% posting fee
    if ((agent.coins || 0) < rewardCoins + postingFee) return { error: 'Not enough coins' };

    agent.coins -= (rewardCoins + postingFee);
    agentStore[agentId] = agent;
    saveJSON('agents.json', agentStore);

    const bounty = {
      id: 'bounty_' + crypto.randomBytes(4).toString('hex'),
      posterId: agentId, posterName: agentName,
      description, requiredItem, requiredQuantity: requiredQuantity || 1,
      rewardCoins, postingFee,
      status: 'active',
      createdAt: new Date().toISOString()
    };
    bounties.push(bounty);
    saveBounties();

    broadcast({ type: 'bountyCreated', bounty });
    addWorldNews('bounty_created', agentId, agentName, `${agentName} posted bounty: "${description}" — ${rewardCoins}🪙 reward`, null);
    return { ok: true, bounty };
  }

  function claimBounty(agentId, bountyId) {
    const agent = agents.get(agentId);
    if (!agent) return { error: 'Agent not found' };
    ensureAgentStats(agent);

    const bounty = bounties.find(b => b.id === bountyId && b.status === 'active');
    if (!bounty) return { error: 'Bounty not found or inactive' };
    if (bounty.posterId === agentId) return { error: 'Cannot claim own bounty' };

    // Check agent has required items
    const invItem = agent.inventory.find(i => i.name === bounty.requiredItem);
    if (!invItem || (invItem.quantity || 1) < bounty.requiredQuantity) {
      return { error: `Need ${bounty.requiredQuantity}x ${bounty.requiredItem}` };
    }

    // Remove items
    if (invItem.stackable && invItem.quantity > bounty.requiredQuantity) {
      invItem.quantity -= bounty.requiredQuantity;
    } else {
      agent.inventory = agent.inventory.filter(i => i.id !== invItem.id);
    }

    // Give reward
    agent.coins = (agent.coins || 0) + bounty.rewardCoins;
    bounty.status = 'completed';
    bounty.claimedBy = agentId;
    bounty.claimedByName = agent.name;
    bounty.completedAt = new Date().toISOString();

    // Give items to poster
    const poster = agents.get(bounty.posterId);
    if (poster) {
      ensureAgentStats(poster);
      const existing = poster.inventory.findIndex(i => i.name === bounty.requiredItem && i.stackable);
      if (existing !== -1) poster.inventory[existing].quantity += bounty.requiredQuantity;
      else poster.inventory.push({
        id: 'item_' + crypto.randomBytes(4).toString('hex'),
        name: bounty.requiredItem, type: 'material', rarity: 'Common',
        description: `From bounty`, stackable: true, quantity: bounty.requiredQuantity
      });
      agentStore[poster.id] = poster;
    }

    agentStore[agentId] = agent;
    saveJSON('agents.json', agentStore);
    saveBounties();

    if (relationships) relationships.recordTrade(agentId, bounty.posterId);

    broadcast({ type: 'bountyCompleted', bounty });
    addWorldNews('bounty_completed', agentId, agent.name, `${agent.name} completed bounty: "${bounty.description}" for ${bounty.rewardCoins}🪙!`, null);
    return { ok: true, bounty, coins: agent.coins };
  }

  function cancelBounty(agentId, bountyId) {
    const bounty = bounties.find(b => b.id === bountyId && b.status === 'active' && b.posterId === agentId);
    if (!bounty) return { error: 'Bounty not found or not yours' };

    const agent = agents.get(agentId);
    if (agent) {
      agent.coins = (agent.coins || 0) + bounty.rewardCoins; // refund reward (not fee)
      agentStore[agentId] = agent;
      saveJSON('agents.json', agentStore);
    }

    bounty.status = 'cancelled';
    saveBounties();
    return { ok: true, refunded: bounty.rewardCoins };
  }

  function getActiveBounties() {
    return bounties.filter(b => b.status === 'active');
  }

  // NPC bounty behavior
  function npcPostBounty(agent, npcDef) {
    // NPCs post bounties for crafting materials they need
    if (Math.random() > 0.3) return false;
    if ((agent.coins || 0) < 30) return false;

    // Find a recipe this NPC wants to craft
    for (const recipeId of (npcDef.craftRecipes || [])) {
      const recipe = recipes.find(r => r.id === recipeId);
      if (!recipe) continue;
      for (const ing of recipe.ingredients) {
        const invItem = agent.inventory.find(i => i.name === ing.name);
        const have = invItem ? (invItem.quantity || 1) : 0;
        if (have < ing.quantity) {
          const needed = ing.quantity - have;
          const reward = 15 + Math.floor(Math.random() * 20);
          // Check no duplicate active bounty
          const existing = bounties.find(b => b.status === 'active' && b.posterId === agent.id && b.requiredItem === ing.name);
          if (existing) continue;
          return createBounty(agent.id, agent.name, `Bring me ${needed}x ${ing.name}`, ing.name, needed, reward);
        }
      }
    }
    return false;
  }

  function npcClaimBounty(agent) {
    const active = getActiveBounties().filter(b => b.posterId !== agent.id);
    for (const bounty of active) {
      const invItem = agent.inventory.find(i => i.name === bounty.requiredItem);
      if (invItem && (invItem.quantity || 1) >= bounty.requiredQuantity) {
        return claimBounty(agent.id, bounty.id);
      }
    }
    return false;
  }

  function setupRoutes(app, authAgent) {
    app.get('/api/bounties', (req, res) => {
      res.json({ bounties: getActiveBounties() });
    });

    app.post('/api/bounty/create', authAgent, (req, res) => {
      const { description, required_item, required_quantity, reward_coins } = req.body;
      if (!description || !required_item || !reward_coins) return res.status(400).json({ error: 'description, required_item, reward_coins required' });
      const result = createBounty(req.agent.id, req.agent.name, description, required_item, required_quantity || 1, reward_coins);
      if (result.error) return res.status(400).json(result);
      res.json(result);
    });

    app.post('/api/bounty/claim', authAgent, (req, res) => {
      const { bounty_id } = req.body;
      if (!bounty_id) return res.status(400).json({ error: 'bounty_id required' });
      const result = claimBounty(req.agent.id, bounty_id);
      if (result.error) return res.status(400).json(result);
      res.json(result);
    });

    app.post('/api/bounty/cancel', authAgent, (req, res) => {
      const { bounty_id } = req.body;
      if (!bounty_id) return res.status(400).json({ error: 'bounty_id required' });
      const result = cancelBounty(req.agent.id, bounty_id);
      if (result.error) return res.status(400).json(result);
      res.json(result);
    });
  }

  return {
    setupRoutes, attemptNPCTrade, generateSmartChat, recordChat,
    createBounty, claimBounty, cancelBounty, getActiveBounties,
    npcPostBounty, npcClaimBounty
  };
}
