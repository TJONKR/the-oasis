// Agent Social System: Trading, Conversations, Bounties (Agent-to-Agent for The Oasis)
import crypto from 'crypto';

export function initNPCSocial({ 
  loadJSON, saveJSON, agents, agentStore, ensureAgentStats, broadcast, addWorldNews, awardXP, 
  recipes, relationships, reputation, worldGrid, needsSystem, agentKnowledge 
}) {
  
  // --- Bounty Board ---
  let bounties = loadJSON('bounties.json', []);
  function saveBounties() { saveJSON('bounties.json', bounties); }

  // --- Conversation Memory ---
  let conversationPairs = loadJSON('conversation-pairs.json', []);
  let lastChatByAgent = {}; // agentId -> { message, timestamp, tileX, tileY }

  // Crafting ingredients agents might need
  const CRAFT_INGREDIENTS = new Set();
  for (const r of recipes) {
    for (const ing of r.ingredients) CRAFT_INGREDIENTS.add(ing.name);
  }

  // Helper: get agents within tile distance
  function getAgentsNear(centerX, centerY, maxDistance) {
    const result = [];
    for (const [id, agent] of agents) {
      if (!agent.alive) continue;
      const dx = Math.abs(agent.tileX - centerX);
      const dy = Math.abs(agent.tileY - centerY);
      const dist = Math.max(dx, dy); // Chebyshev distance
      if (dist <= maxDistance) {
        result.push({ ...agent, distance: dist });
      }
    }
    return result;
  }

  // Helper: check if item is food
  function isFoodResource(name) {
    const n = (name || '').toLowerCase();
    return n.includes('berr') || n.includes('fish') || n.includes('mushroom') || n.includes('herb') || 
           n.includes('fruit') || n.includes('nut') || n.includes('coconut') || n.includes('acorn') || 
           n.includes('seaweed') || n.includes('freshwater') || n.includes('raw_meat') || n.includes('meat');
  }

  // --- Agent-to-Agent Trading ---
  function attemptAgentTrade(agent, targetAgent) {
    if (!targetAgent || targetAgent.id === agent.id || !targetAgent.alive) return false;
    
    // Check proximity (must be within 2 tiles)
    const dx = Math.abs(agent.tileX - targetAgent.tileX);
    const dy = Math.abs(agent.tileY - targetAgent.tileY);
    if (Math.max(dx, dy) > 2) return false;

    ensureAgentStats(agent);
    ensureAgentStats(targetAgent);

    // Get relationship sentiment to affect trade willingness
    const sentiment = relationships?.getSentiment(agent.id, targetAgent.id) || 'stranger';
    const relationshipMod = {
      close: 0.9,     // close friends trade more easily
      friendly: 0.8,
      acquaintance: 0.6,
      stranger: 0.3   // strangers are wary
    }[sentiment] || 0.3;

    if (Math.random() > relationshipMod) return false; // relationship gate

    // Evaluate trade based on needs
    const tradeOffer = evaluateTrade(agent, targetAgent);
    if (!tradeOffer) return false;

    const { agentItem, targetItem, agentPrice, targetPrice } = tradeOffer;

    // Execute trade
    if (agentItem) {
      // Remove from agent
      if (agentItem.stackable && agentItem.quantity > 1) {
        agentItem.quantity--;
      } else {
        agent.inventory = agent.inventory.filter(i => i.id !== agentItem.id);
      }
      
      // Give to target
      const existing = targetAgent.inventory.findIndex(i => i.name === agentItem.name && i.stackable);
      if (existing !== -1) {
        targetAgent.inventory[existing].quantity = (targetAgent.inventory[existing].quantity || 1) + 1;
      } else {
        const newItem = { 
          ...agentItem, 
          id: 'item_' + crypto.randomBytes(4).toString('hex'), 
          quantity: 1 
        };
        targetAgent.inventory.push(newItem);
      }
    }

    if (targetItem) {
      // Remove from target
      if (targetItem.stackable && targetItem.quantity > 1) {
        targetItem.quantity--;
      } else {
        targetAgent.inventory = targetAgent.inventory.filter(i => i.id !== targetItem.id);
      }
      
      // Give to agent
      const existing = agent.inventory.findIndex(i => i.name === targetItem.name && i.stackable);
      if (existing !== -1) {
        agent.inventory[existing].quantity = (agent.inventory[existing].quantity || 1) + 1;
      } else {
        const newItem = { 
          ...targetItem, 
          id: 'item_' + crypto.randomBytes(4).toString('hex'), 
          quantity: 1 
        };
        agent.inventory.push(newItem);
      }
    }

    // Handle coin exchange if needed (for uneven trades)
    if (agentPrice > targetPrice) {
      const diff = agentPrice - targetPrice;
      targetAgent.coins = (targetAgent.coins || 0) - diff;
      agent.coins = (agent.coins || 0) + diff;
    } else if (targetPrice > agentPrice) {
      const diff = targetPrice - agentPrice;
      agent.coins = (agent.coins || 0) - diff;
      targetAgent.coins = (targetAgent.coins || 0) + diff;
    }

    // Save changes
    agentStore[agent.id] = agent;
    agentStore[targetAgent.id] = targetAgent;
    saveJSON('agents.json', agentStore);

    // Record relationship interaction
    if (relationships) {
      relationships.recordTrade(agent.id, targetAgent.id);
    }

    // News and broadcast
    const agentItemName = agentItem?.name || `${agentPrice}🪙`;
    const targetItemName = targetItem?.name || `${targetPrice}🪙`;
    const msg = `${agent.name} traded ${agentItemName} with ${targetAgent.name} for ${targetItemName}`;
    
    broadcast({ 
      type: 'agentTrade', 
      trader1: agent.name, trader2: targetAgent.name, 
      item1: agentItemName, item2: targetItemName,
      tileX: agent.tileX, tileY: agent.tileY
    });
    
    addWorldNews('agent_trade', agent.id, agent.name, msg, agent.zone);
    return true;
  }

  // Evaluate what two agents might trade
  function evaluateTrade(agent1, agent2) {
    if (!agent1.inventory || !agent2.inventory) return null;
    
    // Get personality traits if available
    const mind1 = shared?.agentAI?.minds?.[agent1.id];
    const mind2 = shared?.agentAI?.minds?.[agent2.id];
    const agent1Greedy = mind1?.personality?.traits?.includes('greedy') || false;
    const agent1Generous = mind1?.personality?.traits?.includes('generous') || false;
    const agent2Greedy = mind2?.personality?.traits?.includes('greedy') || false;
    const agent2Generous = mind2?.personality?.traits?.includes('generous') || false;

    // Get needs data for both agents
    let needs1 = null, needs2 = null;
    if (needsSystem) {
      needs1 = needsSystem.getAgentNeeds(agent1.id);
      needs2 = needsSystem.getAgentNeeds(agent2.id);
    }

    // Find items each agent has that the other might want
    const agent1Surplus = findSurplusItems(agent1, needs1);
    const agent2Surplus = findSurplusItems(agent2, needs2);
    
    if (agent1Surplus.length === 0 && agent2Surplus.length === 0) return null;

    // Try to find mutual benefit
    for (const item1 of agent1Surplus) {
      const value1 = getItemValue(item1, agent2, needs2);
      if (value1 === 0) continue;

      for (const item2 of agent2Surplus) {
        const value2 = getItemValue(item2, agent1, needs1);
        if (value2 === 0) continue;

        // Basic trade if values are close
        if (Math.abs(value1 - value2) <= 5) {
          return {
            agentItem: item1,
            targetItem: item2,
            agentPrice: 0,
            targetPrice: 0
          };
        }

        // Uneven trade - higher value item + coins
        if (value1 > value2 + 5) {
          const coinDiff = value1 - value2;
          if ((agent2.coins || 0) >= coinDiff) {
            return {
              agentItem: item1,
              targetItem: item2,
              agentPrice: 0,
              targetPrice: coinDiff
            };
          }
        } else if (value2 > value1 + 5) {
          const coinDiff = value2 - value1;
          if ((agent1.coins || 0) >= coinDiff) {
            return {
              agentItem: item1,
              targetItem: item2,
              agentPrice: coinDiff,
              targetPrice: 0
            };
          }
        }
      }
    }

    // Try coin-only trades if one agent has high-value surplus
    for (const item1 of agent1Surplus) {
      const value1 = getItemValue(item1, agent2, needs2);
      if (value1 > 10 && (agent2.coins || 0) >= value1) {
        // Adjust for personality - greedy asks for more, generous asks for less
        let finalPrice = value1;
        if (agent1Greedy) finalPrice = Math.floor(finalPrice * 1.3);
        if (agent1Generous) finalPrice = Math.floor(finalPrice * 0.8);
        if (agent2Greedy) finalPrice = Math.floor(finalPrice * 0.7);
        if (agent2Generous) finalPrice = Math.floor(finalPrice * 1.2);

        if ((agent2.coins || 0) >= finalPrice) {
          return {
            agentItem: item1,
            targetItem: null,
            agentPrice: 0,
            targetPrice: finalPrice
          };
        }
      }
    }

    return null;
  }

  // Find items an agent has in surplus (willing to trade)
  function findSurplusItems(agent, needs) {
    if (!agent.inventory) return [];
    
    const surplus = [];
    const isHungry = (agent.hunger || 0) > 50;
    
    for (const item of agent.inventory) {
      // Don't trade food when hungry
      if (isHungry && isFoodResource(item.name)) continue;
      
      // Items with quantity > 1 are surplus
      if (item.quantity && item.quantity > 1) {
        surplus.push(item);
        continue;
      }
      
      // If inventory is full (>15 items), non-essential items are surplus
      if (agent.inventory.length > 15) {
        // Keep crafting ingredients and tools, trade decorative items
        if (!CRAFT_INGREDIENTS.has(item.name) && 
            !item.name.includes('tool') && 
            !item.name.includes('axe') && 
            !item.name.includes('pickaxe')) {
          surplus.push(item);
        }
      }
      
      // Non-food items when agent has lots of food are surplus
      if (!isFoodResource(item.name) && 
          agent.inventory.filter(i => isFoodResource(i.name)).length > 5) {
        surplus.push(item);
      }
    }
    
    return surplus;
  }

  // Get the value of an item to a specific agent based on their needs
  function getItemValue(item, toAgent, toNeeds) {
    let baseValue = 8; // default base value
    
    // Food is more valuable to hungry agents
    if (isFoodResource(item.name)) {
      const hungerLevel = toAgent.hunger || 0;
      baseValue = 5 + hungerLevel * 0.3; // 5-35 value range based on hunger
      return Math.floor(baseValue);
    }
    
    // Crafting ingredients are valuable
    if (CRAFT_INGREDIENTS.has(item.name)) {
      baseValue = 12;
    }
    
    // Tools are valuable
    if (item.name.includes('tool') || item.name.includes('axe') || item.name.includes('pickaxe')) {
      baseValue = 20;
    }
    
    // Rare items are more valuable
    if (item.rarity === 'Rare') baseValue *= 1.5;
    if (item.rarity === 'Epic') baseValue *= 2;
    if (item.rarity === 'Legendary') baseValue *= 3;
    
    // Check if agent already has this item (reduces value)
    const hasItem = toAgent.inventory?.some(i => i.name === item.name);
    if (hasItem) baseValue *= 0.6;
    
    // Materials for needs-based crafting
    if (toNeeds && needsSystem) {
      // Agents with high esteem needs value crafting materials more
      if (toNeeds.esteem > 60 && CRAFT_INGREDIENTS.has(item.name)) {
        baseValue *= 1.4;
      }
      
      // Agents with low safety need shelter materials
      if (toNeeds.safety > 50 && (item.name === 'wood' || item.name === 'fiber')) {
        baseValue *= 1.3;
      }
    }
    
    return Math.floor(baseValue);
  }

  // --- Smart Conversations ---
  function generateContextualChat(agent, nearbyAgents) {
    // Look for recent chats to respond to
    for (const nearby of nearbyAgents) {
      if (nearby.id === agent.id) continue;
      const lastChat = lastChatByAgent[nearby.id];
      if (!lastChat) continue;
      
      // Only respond to chats from last 5 minutes and within 10 tiles
      const timeSince = Date.now() - lastChat.timestamp;
      const distance = Math.max(
        Math.abs(agent.tileX - lastChat.tileX), 
        Math.abs(agent.tileY - lastChat.tileY)
      );
      
      if (timeSince > 300000 || distance > 10) continue; // 5 min window, 10 tile range
      if (Math.random() > 0.4) continue; // 40% chance to respond

      // Check if we already replied to this specific chat
      const pairKey = `${agent.id}_${nearby.id}_${lastChat.message.substring(0, 20)}`;
      if (conversationPairs.includes(pairKey)) continue;
      
      conversationPairs.push(pairKey);
      if (conversationPairs.length > 200) conversationPairs = conversationPairs.slice(-100);
      saveJSON('conversation-pairs.json', conversationPairs);

      // Generate contextual reply
      const reply = getContextualReply(lastChat.message, agent, nearby);
      if (reply) {
        if (relationships) relationships.recordChat(agent.id, nearby.id);
        return `@${nearby.name} ${reply}`;
      }
    }

    // Generate original chat based on context
    return generateOriginalChat(agent, nearbyAgents);
  }

  function getContextualReply(message, replier, originalSender) {
    const msg = message.toLowerCase();
    
    // Topic-based replies
    if (msg.includes('trade') || msg.includes('buy') || msg.includes('sell')) {
      const replies = [
        "What are you looking to trade?",
        "I might have something you need!",
        "Fair trades only, friend.",
        "Let me see what I've got..."
      ];
      return replies[Math.floor(Math.random() * replies.length)];
    }
    
    if (msg.includes('food') || msg.includes('hungry') || msg.includes('eat')) {
      if (replier.inventory?.some(i => isFoodResource(i.name))) {
        return Math.random() < 0.6 ? "I've got some food if you need it." : "Food is precious out here.";
      } else {
        return "I'm running low on food too...";
      }
    }
    
    if (msg.includes('craft') || msg.includes('build') || msg.includes('make')) {
      const replies = [
        "Crafting is the key to survival!",
        "What are you trying to make?",
        "I love figuring out new recipes.",
        "Need any materials for that?"
      ];
      return replies[Math.floor(Math.random() * replies.length)];
    }
    
    if (msg.includes('explore') || msg.includes('found') || msg.includes('discovered')) {
      const replies = [
        "The world is full of mysteries!",
        "What did you discover?",
        "I should explore that area too.",
        "Share your findings!"
      ];
      return replies[Math.floor(Math.random() * replies.length)];
    }
    
    // Relationship-based replies
    const sentiment = relationships?.getSentiment(replier.id, originalSender.id) || 'stranger';
    if (sentiment === 'close' || sentiment === 'friendly') {
      const friendlyReplies = [
        "Always good to chat with you!",
        "How are you holding up out there?",
        "Let me know if you need anything.",
        "We should work together more often."
      ];
      return friendlyReplies[Math.floor(Math.random() * friendlyReplies.length)];
    } else {
      const neutralReplies = [
        "Interesting...",
        "I see what you mean.",
        "Good to know.",
        "Thanks for sharing."
      ];
      return neutralReplies[Math.floor(Math.random() * neutralReplies.length)];
    }
  }

  function generateOriginalChat(agent, nearbyAgents) {
    const gameTime = shared?.getGameTime?.();
    const weather = shared?.weather?.getCurrentWeather?.();
    
    // Time-based chats
    if (gameTime) {
      if (gameTime.period === 'night' && Math.random() < 0.3) {
        const nightChats = [
          "Getting dark... should find shelter.",
          "Night brings different dangers.",
          "The stars are beautiful here.",
          "Anyone else hear those sounds?"
        ];
        return nightChats[Math.floor(Math.random() * nightChats.length)];
      }
    }
    
    // Weather-based chats
    if (weather && weather.id !== 'clear' && Math.random() < 0.2) {
      const weatherChats = {
        rain: ["This rain is refreshing!", "Everything smells different in the rain.", "Good for the plants at least."],
        storm: ["This storm is intense!", "Better take cover.", "Nature's power is incredible."],
        fog: ["Hard to see in this fog.", "Fog makes everything mysterious.", "Can barely see my hand!"],
        snow: ["Snow! How beautiful.", "It's getting cold out here.", "Winter wonderland."]
      };
      const chats = weatherChats[weather.id];
      if (chats) {
        return chats[Math.floor(Math.random() * chats.length)];
      }
    }
    
    // Inventory-based chats (show off or ask for help)
    if (agent.inventory && Math.random() < 0.15) {
      const hasFood = agent.inventory.some(i => isFoodResource(i.name));
      const hasTools = agent.inventory.some(i => i.name.includes('tool') || i.name.includes('axe'));
      const lowInventory = agent.inventory.length < 3;
      
      if (lowInventory) {
        const needChats = [
          "Anyone have spare materials?",
          "Running low on supplies...",
          "Could use some help gathering.",
          "This survival thing is tough!"
        ];
        return needChats[Math.floor(Math.random() * needChats.length)];
      } else if (hasTools) {
        const toolChats = [
          "Got some good tools working!",
          "Crafting makes all the difference.",
          "These tools are lifesavers.",
          "Anyone need to borrow tools?"
        ];
        return toolChats[Math.floor(Math.random() * toolChats.length)];
      } else if (hasFood) {
        const foodChats = [
          "Found some great food sources!",
          "Staying well-fed out here.",
          "Food security is key.",
          "This area has good foraging."
        ];
        return foodChats[Math.floor(Math.random() * foodChats.length)];
      }
    }
    
    // Social chats (mention nearby agents)
    if (nearbyAgents.length > 1 && Math.random() < 0.2) {
      const others = nearbyAgents.filter(a => a.id !== agent.id);
      if (others.length > 0) {
        const other = others[Math.floor(Math.random() * others.length)];
        const mentions = [
          `Good to see you, ${other.name}!`,
          `How's it going, ${other.name}?`,
          `${other.name}, up for some cooperation?`,
          `Nice to have company, ${other.name}.`
        ];
        if (relationships) relationships.recordChat(agent.id, other.id);
        return mentions[Math.floor(Math.random() * mentions.length)];
      }
    }
    
    // Generic survival/world chats
    const genericChats = [
      "This world is vast and mysterious.",
      "Every day brings new challenges.",
      "Cooperation is key to survival.",
      "Wonder what's over that next hill?",
      "The ecosystem here is fascinating.",
      "There's so much to learn and discover.",
      "Building a life from nothing is rewarding.",
      "The journey is as important as the destination."
    ];
    
    return genericChats[Math.floor(Math.random() * genericChats.length)];
  }

  function recordChat(agentId, message, tileX, tileY) {
    lastChatByAgent[agentId] = { message, timestamp: Date.now(), tileX, tileY };
  }

  // --- Bounty Board (Agent-Driven) ---
  function createBounty(posterId, posterName, description, requiredItem, requiredQuantity, rewardCoins) {
    const poster = agents.get(posterId);
    if (!poster) return { error: 'Agent not found' };
    ensureAgentStats(poster);

    const postingFee = Math.max(1, Math.floor(rewardCoins * 0.1)); // 10% posting fee, min 1
    const totalCost = rewardCoins + postingFee;
    
    if ((poster.coins || 0) < totalCost) return { error: 'Not enough coins' };

    poster.coins -= totalCost;
    agentStore[posterId] = poster;
    saveJSON('agents.json', agentStore);

    const bounty = {
      id: 'bounty_' + crypto.randomBytes(4).toString('hex'),
      posterId, posterName,
      description, requiredItem, requiredQuantity: requiredQuantity || 1,
      rewardCoins, postingFee,
      status: 'active',
      createdAt: new Date().toISOString(),
      posterLocation: { tileX: poster.tileX, tileY: poster.tileY } // for proximity checking
    };
    
    bounties.push(bounty);
    saveBounties();

    broadcast({ type: 'bountyCreated', bounty });
    addWorldNews('bounty_created', posterId, posterName, 
      `${posterName} posted bounty: "${description}" — ${rewardCoins}🪙 reward`, null);
    
    return { ok: true, bounty };
  }

  function claimBounty(claimerId, bountyId) {
    const claimer = agents.get(claimerId);
    if (!claimer) return { error: 'Agent not found' };
    ensureAgentStats(claimer);

    const bounty = bounties.find(b => b.id === bountyId && b.status === 'active');
    if (!bounty) return { error: 'Bounty not found or inactive' };
    if (bounty.posterId === claimerId) return { error: 'Cannot claim own bounty' };

    // Check agent has required items
    const invItem = claimer.inventory?.find(i => i.name === bounty.requiredItem);
    if (!invItem || (invItem.quantity || 1) < bounty.requiredQuantity) {
      return { error: `Need ${bounty.requiredQuantity}x ${bounty.requiredItem}` };
    }

    // Remove items from claimer
    if (invItem.stackable && invItem.quantity > bounty.requiredQuantity) {
      invItem.quantity -= bounty.requiredQuantity;
    } else if (invItem.quantity === bounty.requiredQuantity) {
      claimer.inventory = claimer.inventory.filter(i => i.id !== invItem.id);
    } else {
      return { error: 'Not enough quantity' };
    }

    // Give reward to claimer
    claimer.coins = (claimer.coins || 0) + bounty.rewardCoins;
    bounty.status = 'completed';
    bounty.claimedBy = claimerId;
    bounty.claimedByName = claimer.name;
    bounty.completedAt = new Date().toISOString();

    // Give items to poster (if they still exist)
    const poster = agents.get(bounty.posterId);
    if (poster) {
      ensureAgentStats(poster);
      if (!poster.inventory) poster.inventory = [];
      
      const existingIdx = poster.inventory.findIndex(i => i.name === bounty.requiredItem && i.stackable);
      if (existingIdx !== -1) {
        poster.inventory[existingIdx].quantity = (poster.inventory[existingIdx].quantity || 1) + bounty.requiredQuantity;
      } else {
        poster.inventory.push({
          id: 'item_' + crypto.randomBytes(4).toString('hex'),
          name: bounty.requiredItem, 
          type: 'material', 
          rarity: 'Common',
          description: `From bounty completion`, 
          stackable: true, 
          quantity: bounty.requiredQuantity
        });
      }
      agentStore[poster.id] = poster;
    }

    agentStore[claimerId] = claimer;
    saveJSON('agents.json', agentStore);
    saveBounties();

    if (relationships) relationships.recordTrade(claimerId, bounty.posterId);

    broadcast({ type: 'bountyCompleted', bounty });
    addWorldNews('bounty_completed', claimerId, claimer.name, 
      `${claimer.name} completed bounty: "${bounty.description}" for ${bounty.rewardCoins}🪙!`, null);
    
    return { ok: true, bounty, coins: claimer.coins };
  }

  function cancelBounty(agentId, bountyId) {
    const bounty = bounties.find(b => b.id === bountyId && b.status === 'active' && b.posterId === agentId);
    if (!bounty) return { error: 'Bounty not found or not yours' };

    const agent = agents.get(agentId);
    if (agent) {
      agent.coins = (agent.coins || 0) + bounty.rewardCoins; // refund reward (not posting fee)
      agentStore[agentId] = agent;
      saveJSON('agents.json', agentStore);
    }

    bounty.status = 'cancelled';
    saveBounties();
    broadcast({ type: 'bountyCancelled', bounty });
    
    return { ok: true, refunded: bounty.rewardCoins };
  }

  function getActiveBounties() {
    return bounties.filter(b => b.status === 'active');
  }

  // Agent behavior for bounties
  function shouldPostBounty(agent) {
    if (Math.random() > 0.1) return false; // 10% chance to consider posting
    if ((agent.coins || 0) < 25) return false; // need coins to post
    
    // Post bounty when inventory is low or missing key items
    if (!agent.inventory || agent.inventory.length < 3) {
      const essentials = ['wood', 'fiber', 'flint', 'berries', 'fish'];
      for (const essential of essentials) {
        const hasItem = agent.inventory?.some(i => i.name === essential);
        if (!hasItem) {
          // Check if bounty already exists
          const existingBounty = bounties.find(b => 
            b.status === 'active' && b.posterId === agent.id && b.requiredItem === essential);
          if (!existingBounty) {
            return {
              item: essential,
              quantity: 1,
              reward: Math.floor(10 + Math.random() * 15),
              description: `Need ${essential} for survival!`
            };
          }
        }
      }
    }
    
    // Post bounty for crafting materials when trying to craft
    if (agent.inventory && agent.inventory.length > 5) {
      for (const recipe of recipes) {
        const canCraft = recipe.ingredients.every(ing => {
          const invItem = agent.inventory.find(i => i.name === ing.name);
          return invItem && (invItem.quantity || 1) >= ing.quantity;
        });
        
        if (!canCraft) {
          const missingIng = recipe.ingredients.find(ing => {
            const invItem = agent.inventory.find(i => i.name === ing.name);
            return !invItem || (invItem.quantity || 1) < ing.quantity;
          });
          
          if (missingIng) {
            const needed = missingIng.quantity - (agent.inventory.find(i => i.name === missingIng.name)?.quantity || 0);
            const existingBounty = bounties.find(b => 
              b.status === 'active' && b.posterId === agent.id && b.requiredItem === missingIng.name);
            
            if (!existingBounty && needed > 0) {
              return {
                item: missingIng.name,
                quantity: needed,
                reward: Math.floor(15 + Math.random() * 20),
                description: `Need ${missingIng.name} for crafting ${recipe.name || 'something'}!`
              };
            }
          }
        }
      }
    }
    
    return false;
  }

  function findClaimableBounty(agent) {
    if (!agent.inventory) return null;
    
    const activeBounties = getActiveBounties().filter(b => b.posterId !== agent.id);
    
    for (const bounty of activeBounties) {
      const invItem = agent.inventory.find(i => i.name === bounty.requiredItem);
      if (invItem && (invItem.quantity || 1) >= bounty.requiredQuantity) {
        // Check if it's worth claiming (not trading away essential food when hungry)
        const isFood = isFoodResource(bounty.requiredItem);
        const isHungry = (agent.hunger || 0) > 60;
        
        if (isFood && isHungry && invItem.quantity <= bounty.requiredQuantity) {
          continue; // don't trade away last food when hungry
        }
        
        return bounty;
      }
    }
    
    return null;
  }

  // Set up API routes
  function setupRoutes(app, authAgent) {
    app.get('/api/bounties', (req, res) => {
      res.json({ bounties: getActiveBounties() });
    });

    app.post('/api/bounty/create', authAgent, (req, res) => {
      const { description, required_item, required_quantity, reward_coins } = req.body;
      if (!description || !required_item || !reward_coins) {
        return res.status(400).json({ error: 'description, required_item, reward_coins required' });
      }
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

  // Store shared reference for use in evaluation functions
  let shared = null;
  
  return {
    setupRoutes,
    attemptAgentTrade,
    generateContextualChat,
    recordChat,
    createBounty,
    claimBounty,
    cancelBounty,
    getActiveBounties,
    shouldPostBounty,
    findClaimableBounty,
    getAgentsNear,
    // Store shared reference
    setShared: (sharedRef) => { shared = sharedRef; }
  };
}