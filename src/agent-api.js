// External Agent API — The Oasis Platform
// Allows AI agents from the internet to register, perceive, and act in the world.
// Inspired by Moltbook's agent-first architecture.

import crypto from 'crypto';

export function setupAgentAPI(app, shared) {
  const { agents, agentStore, worldGrid, broadcast, addWorldNews, saveJSON, loadJSON,
          spawnAgent, serializeAgent, weatherSystem, agentAI } = shared;
  
  // Persistent API keys
  const apiKeys = loadJSON('api-keys.json', {}); // apiKey → { agentId, name, createdAt, claimUrl, claimed }
  const claimTokens = loadJSON('claim-tokens.json', {}); // claimToken → { agentId, apiKey }
  
  function generateApiKey() {
    return 'oasis_' + crypto.randomBytes(24).toString('hex');
  }
  
  function generateClaimToken() {
    return 'oasis_claim_' + crypto.randomBytes(16).toString('hex');
  }
  
  // Auth middleware — validates API key, attaches agent
  function authAgent(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing Authorization: Bearer <api_key>' });
    }
    const key = auth.slice(7);
    const keyData = apiKeys[key];
    if (!keyData) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    const agent = agents.get(keyData.agentId);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found in world. They may have died.' });
    }
    req.agent = agent;
    req.agentId = keyData.agentId;
    req.apiKey = key;
    next();
  }
  
  // ═══════════════════════════════════════
  // REGISTRATION
  // ═══════════════════════════════════════
  
  /**
   * POST /api/v1/register
   * Register a new agent. Returns API key + claim URL.
   */
  app.post('/api/v1/register', (req, res) => {
    const { name, description } = req.body;
    if (!name || name.length < 2 || name.length > 30) {
      return res.status(400).json({ error: 'Name must be 2-30 characters' });
    }
    
    // Check name uniqueness
    const existing = [...agents.values()].find(a => a.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      return res.status(409).json({ error: `Name "${name}" is already taken` });
    }
    
    // Spawn the agent
    const agent = spawnAgent(name);
    agent.description = description || '';
    agent.external = true; // Mark as externally controlled
    agent.autonomous = false; // Don't run AI brain on this agent
    
    // Generate credentials
    const apiKey = generateApiKey();
    const claimToken = generateClaimToken();
    
    apiKeys[apiKey] = {
      agentId: agent.id,
      name: agent.name,
      createdAt: new Date().toISOString(),
      claimed: false,
    };
    
    claimTokens[claimToken] = {
      agentId: agent.id,
      apiKey,
    };
    
    saveJSON('api-keys.json', apiKeys);
    saveJSON('claim-tokens.json', claimTokens);
    
    addWorldNews('arrival', agent.id, agent.name, 
      `🌐 ${agent.name} has connected from the outside world!`, agent.zone);
    
    res.json({
      agent: {
        id: agent.id,
        name: agent.name,
        api_key: apiKey,
        claim_url: `${req.protocol}://${req.get('host')}/claim/${claimToken}`,
        spawn: { tileX: agent.tileX, tileY: agent.tileY, zone: agent.zone },
      },
      important: '⚠️ SAVE YOUR API KEY! You need it for all requests.',
      docs: `${req.protocol}://${req.get('host')}/skill.md`,
    });
  });
  
  // ═══════════════════════════════════════
  // PERCEPTION — What can the agent see?
  // ═══════════════════════════════════════
  
  /**
   * GET /api/v1/look
   * See the world around you. Returns visible tiles, agents, resources, dangers.
   */
  app.get('/api/v1/look', authAgent, (req, res) => {
    const agent = req.agent;
    const range = Math.min(20, parseInt(req.query.range) || 20);
    
    const gameTime = shared.getGameTime?.() || {};
    const weather = weatherSystem?.getCurrentWeather?.() || {};
    const mind = agentAI?.minds?.[agent.id];
    
    // P3 Fix #12: Get proficiency levels for self display
    let proficiencies = null;
    if (shared.proficiency?.getAllProficiencies) {
      const allProf = shared.proficiency.getAllProficiencies(agent.id);
      proficiencies = {};
      for (const [domain, data] of Object.entries(allProf)) {
        if (data && data.level > 0) {
          proficiencies[domain] = {
            level: data.level,
            title: data.title,
            xp: data.xp,
          };
        }
      }
    }

    // Scan visible area
    const visible = {
      self: {
        id: agent.id, name: agent.name,
        tileX: agent.tileX, tileY: agent.tileY, zone: agent.zone,
        hp: agent.hp, energy: Math.round(agent.energy), hunger: Math.round(agent.hunger),
        inventory: (agent.inventory || []).map(i => ({
          id: i.id, name: i.name, quantity: i.quantity || 1,
          properties: i.properties ? summarizeProps(i.properties) : null,
        })),
        stats: agent.stats,
        alive: agent.alive,
        proficiencies, // P3 Fix #12: Show proficiency levels
      },
      world: {
        tick: shared.tick,
        gameTime,
        weather: { condition: weather.condition || weather.id, name: weather.name },
        season: shared.organicGrowth?.getSeason?.(gameTime.day) || 'unknown',
      },
      nearby: {
        agents: [],
        resources: [],
        fires: [],
        gasClouds: [],
        groundItems: [],
        growthSites: [],
        structures: [],
        wildlife: [],
      },
    };
    
    // Nearby agents
    for (const [id, other] of agents) {
      if (id === agent.id || !other.alive) continue;
      const dx = Math.abs(other.tileX - agent.tileX);
      const dy = Math.abs(other.tileY - agent.tileY);
      if (dx <= range && dy <= range) {
        visible.nearby.agents.push({
          id: other.id, name: other.name,
          tileX: other.tileX, tileY: other.tileY,
          distance: dx + dy,
          external: !!other.external,
        });
      }
    }
    
    // Nearby resources (scan visible decorations)
    for (let dx = -range; dx <= range; dx += 2) {
      for (let dy = -range; dy <= range; dy += 2) {
        const tx = agent.tileX + dx, ty = agent.tileY + dy;
        const deco = worldGrid.getDecoration(tx, ty);
        if (deco) {
          visible.nearby.resources.push({
            tileX: tx, tileY: ty,
            type: deco.name,
            yields: deco.resources,
            distance: Math.abs(dx) + Math.abs(dy),
          });
        }
      }
    }
    // Cap resources
    visible.nearby.resources = visible.nearby.resources
      .sort((a,b) => a.distance - b.distance).slice(0, 30);
    
    // Nearby fires
    if (shared.temperature?.getActiveFires) {
      for (const fire of shared.temperature.getActiveFires()) {
        const dx = Math.abs(fire.tileX - agent.tileX);
        const dy = Math.abs(fire.tileY - agent.tileY);
        if (dx <= range && dy <= range) {
          visible.nearby.fires.push({ tileX: fire.tileX, tileY: fire.tileY, heat: fire.heat });
        }
      }
    }
    
    // Nearby gas
    if (shared.gasSystem?.gasClouds) {
      for (const [key, gas] of shared.gasSystem.gasClouds) {
        const dx = Math.abs(gas.tileX - agent.tileX);
        const dy = Math.abs(gas.tileY - agent.tileY);
        if (dx <= range && dy <= range) {
          visible.nearby.gasClouds.push({ tileX: gas.tileX, tileY: gas.tileY, type: gas.type, density: gas.density });
        }
      }
    }
    
    // Nearby wildlife
    if (shared.wildlife?.getAnimalsNear) {
      visible.nearby.wildlife = shared.wildlife.getAnimalsNear(agent.tileX, agent.tileY, range)
        .map(a => ({
          id: a.id,
          species: a.species,
          type: a.type,
          tileX: a.tileX,
          tileY: a.tileY,
          hp: a.hp,
          maxHp: a.maxHp,
          state: a.state,
          emoji: a.emoji,
          distance: a.distance,
        }));
    }

    // Nearby ground items and structures
    if (shared.decayLifecycle?.groundItems) {
      for (const [key, items] of shared.decayLifecycle.groundItems) {
        const [x, y] = key.split(',').map(Number);
        const dx = Math.abs(x - agent.tileX);
        const dy = Math.abs(y - agent.tileY);
        if (dx <= range && dy <= range) {
          for (const entry of items) {
            // Separate structures from regular ground items
            if (entry.isStructure || entry.item.isStructure) {
              visible.nearby.structures.push({
                tileX: x,
                tileY: y,
                name: entry.item.name,
                type: entry.item.structureType || entry.item.type,
                properties: entry.item.structureProperties || {
                  shelter: entry.item.properties?.shelter || 0,
                  warmth: entry.item.properties?.warmth || 0,
                  storage: entry.item.properties?.storage || 0,
                },
                distance: dx + dy,
              });
            } else {
              visible.nearby.groundItems.push({ tileX: x, tileY: y, item: entry.item.name });
            }
          }
        }
      }
    }

    res.json(visible);
  });
  
  // ═══════════════════════════════════════
  // ACTIONS — What can the agent do?
  // ═══════════════════════════════════════
  
  /**
   * POST /api/v1/move
   * Move one tile in a direction.
   */
  app.post('/api/v1/move', authAgent, (req, res) => {
    const agent = req.agent;
    const { direction, targetX, targetY } = req.body;
    
    let nx = agent.tileX, ny = agent.tileY;
    
    if (direction) {
      const dirs = { north: [0,-1], south: [0,1], east: [1,0], west: [-1,0],
                     ne: [1,-1], nw: [-1,-1], se: [1,1], sw: [-1,1] };
      const d = dirs[direction.toLowerCase()];
      if (!d) return res.status(400).json({ error: `Invalid direction. Use: ${Object.keys(dirs).join(', ')}` });
      nx += d[0]; ny += d[1];
    } else if (targetX != null && targetY != null) {
      // Move one step toward target
      const dx = Math.sign(targetX - agent.tileX);
      const dy = Math.sign(targetY - agent.tileY);
      nx += dx; ny += dy;
    } else {
      return res.status(400).json({ error: 'Provide direction (north/south/east/west/ne/nw/se/sw) or targetX+targetY' });
    }
    
    // Check walkability
    const tile = worldGrid.getTile(nx, ny);
    if (!tile || !tile.walkable) {
      return res.json({ moved: false, reason: 'Tile is not walkable', tileX: agent.tileX, tileY: agent.tileY });
    }
    
    agent.tileX = nx;
    agent.tileY = ny;
    agent.zone = worldGrid.getZone(nx, ny);
    agent.energy = Math.max(0, agent.energy - 2);
    
    res.json({ moved: true, tileX: nx, tileY: ny, zone: agent.zone, energy: Math.round(agent.energy) });
  });
  
  /**
   * POST /api/v1/gather
   * Gather resources from current or adjacent tile.
   * P3 Fix #12: Proficiency bonus adds yield (up to +50% chance of bonus item)
   */
  app.post('/api/v1/gather', authAgent, (req, res) => {
    const agent = req.agent;

    // P3 Fix #11: Storage bonus from nearby structures expands inventory
    const storageBonus = agent._storageBonus || 0;
    const maxInventory = 28 + storageBonus;

    if (agent.inventory.length >= maxInventory) {
      return res.status(400).json({ error: `Inventory full (max ${maxInventory} items)` });
    }
    if (agent.energy < 5) {
      return res.status(400).json({ error: 'Not enough energy to gather' });
    }

    // Try current tile, then adjacent
    let resource = null;
    const positions = [[0,0],[-1,0],[1,0],[0,-1],[0,1]];
    for (const [dx, dy] of positions) {
      resource = worldGrid.rollResource(agent.tileX + dx, agent.tileY + dy);
      if (resource) break;
    }

    if (!resource) {
      return res.json({ gathered: false, reason: 'No resources nearby' });
    }

    // P3 Fix #12: Get proficiency bonus for gathering
    let bonusYield = 0;
    if (shared.proficiency?.getActionBonus) {
      const bonus = shared.proficiency.getActionBonus(agent.id, 'gather');
      // yieldBonus is 0-50, representing % chance of extra item
      if (bonus.yieldBonus > 0 && Math.random() * 100 < bonus.yieldBonus) {
        bonusYield = 1;
      }
    }

    const totalQuantity = 1 + bonusYield;

    const item = {
      id: 'item_' + crypto.randomBytes(4).toString('hex'),
      name: resource,
      type: 'resource',
      quantity: totalQuantity,
      stackable: true,
    };

    // Attach properties
    const props = shared.getProperties?.(resource) || shared.GATHERED_RESOURCE_PROPERTIES?.[resource];
    if (props) item.properties = { ...props };

    // Stack if possible
    const existing = agent.inventory.find(i => i.name === resource && i.stackable);
    if (existing && (existing.quantity || 1) < 20) {
      existing.quantity = Math.min(20, (existing.quantity || 1) + totalQuantity);
    } else {
      agent.inventory.push(item);
    }

    agent.energy = Math.max(0, agent.energy - 5);

    // Track proficiency XP for gather action
    if (shared.proficiency?.onAction) {
      shared.proficiency.onAction(agent.id, 'gather', { zone: agent.zone, item: resource });
    }

    const msg = bonusYield > 0
      ? `${agent.name} gathered ${resource} x${totalQuantity} (bonus yield!)`
      : `${agent.name} gathered ${resource}`;
    addWorldNews('gather', agent.id, agent.name, msg, agent.zone);

    res.json({
      gathered: true,
      item: resource,
      quantity: totalQuantity,
      bonusYield: bonusYield > 0,
      energy: Math.round(agent.energy)
    });
  });
  
  /**
   * POST /api/v1/eat
   * Eat a food item from inventory.
   * P3 Fix #12: Cooking proficiency gives energy bonus (up to +50%)
   */
  app.post('/api/v1/eat', authAgent, (req, res) => {
    const agent = req.agent;
    const { itemName, itemId } = req.body;

    const foodItems = ['berries','fish','mushrooms','herbs','fruit','nuts','coconuts','acorns','seaweed','freshwater','pine_nuts',
      'Cooked Fish','Cooked Mushrooms','Herbal Tea','Smoked fish','Dried Seaweed','raw_meat','Cooked Meat'];

    // Find food by itemId, itemName, or auto-detect
    const isEdible = (i) => foodItems.includes(i.name) || (i.properties?.energy && i.properties.energy > 0 && !i.properties?.toxicity);
    const food = itemId
      ? agent.inventory.find(i => i.id === itemId)
      : itemName
        ? agent.inventory.find(i => i.name === itemName)
        : agent.inventory.find(i => isEdible(i));

    if (!food) return res.json({ ate: false, reason: 'No food in inventory' });
    if (food.properties?.toxicity && food.properties.toxicity > 3) return res.json({ ate: false, reason: 'Too toxic to eat' });

    const isCooked = food.name.startsWith('Cooked') || food.name.startsWith('Smoked');
    let hungerRelief = isCooked ? 50 : 40;
    let energyBoost = isCooked ? 25 : 20;

    // P3 Fix #12: Cooking proficiency gives energy bonus when eating cooked food
    let cookingBonus = 0;
    if (isCooked && shared.proficiency?.getActionBonus) {
      const bonus = shared.proficiency.getActionBonus(agent.id, 'cook');
      // energyBonus is 0-50, representing % extra energy
      cookingBonus = Math.round(energyBoost * bonus.energyBonus / 100);
      energyBoost += cookingBonus;
    }

    if (food.quantity > 1) food.quantity--;
    else agent.inventory = agent.inventory.filter(i => i !== food);

    agent.hunger = Math.max(0, agent.hunger - hungerRelief);
    agent.energy = Math.min(100, agent.energy + energyBoost);

    const result = {
      ate: true,
      item: food.name,
      hunger: Math.round(agent.hunger),
      energy: Math.round(agent.energy),
    };
    if (cookingBonus > 0) result.cookingBonus = cookingBonus;

    res.json(result);
  });
  
  /**
   * POST /api/v1/rest
   * Rest to recover energy. P0 Fix: Now restores 30-50 energy (was 8).
   */
  app.post('/api/v1/rest', authAgent, (req, res) => {
    const agent = req.agent;
    const restAmount = 30 + Math.floor(Math.random() * 21); // 30-50
    agent.energy = Math.min(100, agent.energy + restAmount);
    agent.hunger = Math.min(100, agent.hunger + 3);
    res.json({ rested: true, recovered: restAmount, energy: Math.round(agent.energy), hunger: Math.round(agent.hunger) });
  });
  
  /**
   * POST /api/v1/craft
   * Combine 2-3 inventory items with a force.
   * P3 Fix #12: Crafting proficiency improves item quality
   */
  app.post('/api/v1/craft', authAgent, async (req, res) => {
    const agent = req.agent;
    const { itemNames, force = 'combine' } = req.body;

    if (!itemNames || !Array.isArray(itemNames) || itemNames.length < 2 || itemNames.length > 3) {
      return res.status(400).json({ error: 'Provide 2-3 itemNames' });
    }

    const items = [];
    for (const name of itemNames) {
      const item = agent.inventory.find(i => i.name === name && !items.includes(i));
      if (!item) return res.status(400).json({ error: `Item "${name}" not in inventory` });
      items.push(item);
    }

    if (!shared.experiments) return res.status(500).json({ error: 'Experiment system not available' });

    try {
      const result = await shared.experiments.runExperiment(agent, items, force, agent.zone);

      // Consume items on success or destruction
      if (result.success || result.destroyed) {
        for (const item of items) {
          const idx = agent.inventory.indexOf(item);
          if (idx !== -1) {
            if (item.stackable && item.quantity > 1) item.quantity--;
            else agent.inventory.splice(idx, 1);
          }
        }
      }

      // P3 Fix #12: Apply crafting proficiency quality bonus
      let qualityBonus = 0;
      if (result.success && result.result_item) {
        if (shared.proficiency?.getActionBonus) {
          const bonus = shared.proficiency.getActionBonus(agent.id, 'craft');
          // qualityBonus is % improvement to item properties
          qualityBonus = bonus.qualityBonus || 0;

          // Apply quality bonus: improve key properties
          if (qualityBonus > 0 && result.result_item.properties) {
            const props = result.result_item.properties;
            // Boost positive properties by quality bonus %
            if (props.sharpness > 0) props.sharpness = Math.round(props.sharpness * (1 + qualityBonus / 100));
            if (props.hardness > 0) props.hardness = Math.round(props.hardness * (1 + qualityBonus / 100));
            if (props.energy > 0) props.energy = Math.round(props.energy * (1 + qualityBonus / 100));
            // Reduce negative properties (decay)
            if (props.decay_rate > 0) props.decay_rate = props.decay_rate * Math.max(0.5, 1 - qualityBonus / 200);
          }

          // Chance of "Superior" prefix for high-quality crafts
          if (qualityBonus >= 20 && Math.random() * 100 < qualityBonus) {
            result.result_item.name = 'Superior ' + result.result_item.name;
            result.result_item.quality = 'superior';
          }
        }

        agent.inventory.push(result.result_item);

        // Track proficiency XP for craft action
        if (shared.proficiency?.onAction) {
          shared.proficiency.onAction(agent.id, 'craft', {
            zone: agent.zone,
            ingredients: itemNames,
          });
        }
      }

      agent.energy = Math.max(0, agent.energy - 8);

      const response = {
        success: result.success,
        result: result.result_item?.name || null,
        message: result.message,
        discovery: result.discovery || null,
        energy: Math.round(agent.energy),
      };
      if (qualityBonus > 0) response.qualityBonus = qualityBonus;
      if (result.result_item?.quality) response.quality = result.result_item.quality;

      res.json(response);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  /**
   * POST /api/v1/chat
   * Talk to a nearby agent.
   */
  app.post('/api/v1/chat', authAgent, (req, res) => {
    const agent = req.agent;
    const { targetId, message } = req.body;
    
    if (!targetId) return res.status(400).json({ error: 'Provide targetId of agent to chat with' });
    
    const other = agents.get(targetId);
    if (!other || !other.alive) return res.status(404).json({ error: 'Target agent not found or dead' });
    
    const dx = Math.abs(other.tileX - agent.tileX);
    const dy = Math.abs(other.tileY - agent.tileY);
    if (dx > 5 || dy > 5) return res.status(400).json({ error: 'Too far to chat (max 5 tiles)' });
    
    // Record the interaction
    addWorldNews('chat', agent.id, agent.name, 
      `${agent.name} said to ${other.name}: "${(message || '...').slice(0, 100)}"`, agent.zone);
    
    if (shared.innerMonologue?.strengthenBond) {
      shared.innerMonologue.strengthenBond(agent.id, other.id, 3);
    }
    
    // If other agent is external, they'll see this in their feed
    broadcast({ type: 'chat', from: agent.id, fromName: agent.name, to: other.id, toName: other.name, message: message?.slice(0, 200) });
    
    res.json({ chatted: true, with: other.name, message: message?.slice(0, 200) });
  });
  
  /**
   * POST /api/v1/give
   * Give an item to a nearby agent.
   */
  app.post('/api/v1/give', authAgent, (req, res) => {
    const agent = req.agent;
    const { targetId, itemName } = req.body;
    
    if (!targetId || !itemName) return res.status(400).json({ error: 'Provide targetId and itemName' });
    
    const other = agents.get(targetId);
    if (!other || !other.alive) return res.status(404).json({ error: 'Target not found' });
    
    const dx = Math.abs(other.tileX - agent.tileX);
    const dy = Math.abs(other.tileY - agent.tileY);
    if (dx > 2 || dy > 2) return res.status(400).json({ error: 'Too far (max 2 tiles)' });
    
    const item = agent.inventory.find(i => i.name === itemName);
    if (!item) return res.status(400).json({ error: 'Item not in inventory' });
    
    if (other.inventory.length >= 28) return res.status(400).json({ error: 'Their inventory is full' });
    
    agent.inventory = agent.inventory.filter(i => i !== item);
    other.inventory.push(item);
    
    addWorldNews('gift', agent.id, agent.name, `${agent.name} gave ${item.name} to ${other.name}`, agent.zone);
    
    res.json({ gave: true, item: item.name, to: other.name });
  });
  
  /**
   * POST /api/v1/drop
   * Drop an item on the ground.
   */
  app.post('/api/v1/drop', authAgent, (req, res) => {
    const agent = req.agent;
    const { itemName, itemId, itemIds } = req.body;

    // Batch drop support
    if (itemIds && Array.isArray(itemIds)) {
      const dropped = [];
      for (const id of itemIds) {
        const item = agent.inventory.find(i => i.id === id);
        if (!item) continue;
        agent.inventory = agent.inventory.filter(i => i !== item);
        if (shared.decayLifecycle?.groundItems) {
          const key = `${agent.tileX},${agent.tileY}`;
          if (!shared.decayLifecycle.groundItems.has(key)) shared.decayLifecycle.groundItems.set(key, []);
          shared.decayLifecycle.groundItems.get(key).push({ item: { ...item }, dropTick: shared.tick || 0, decayProgress: 0 });
        }
        dropped.push(item.name);
      }
      return res.json({ dropped: true, items: dropped, count: dropped.length, at: { tileX: agent.tileX, tileY: agent.tileY } });
    }

    // Single drop by itemId or itemName
    const item = itemId
      ? agent.inventory.find(i => i.id === itemId)
      : agent.inventory.find(i => i.name === itemName);
    if (!item) return res.status(400).json({ error: 'Item not in inventory' });
    
    agent.inventory = agent.inventory.filter(i => i !== item);
    
    if (shared.decayLifecycle?.groundItems) {
      const key = `${agent.tileX},${agent.tileY}`;
      if (!shared.decayLifecycle.groundItems.has(key)) shared.decayLifecycle.groundItems.set(key, []);
      shared.decayLifecycle.groundItems.get(key).push({ item: { ...item }, dropTick: shared.tick || 0, decayProgress: 0 });
    }
    
    res.json({ dropped: true, item: item.name, at: { tileX: agent.tileX, tileY: agent.tileY } });
  });
  
  /**
   * POST /api/v1/pickup
   * Pick up a ground item.
   */
  app.post('/api/v1/pickup', authAgent, (req, res) => {
    const agent = req.agent;
    if (agent.inventory.length >= 28) return res.status(400).json({ error: 'Inventory full' });

    const key = `${agent.tileX},${agent.tileY}`;
    const items = shared.decayLifecycle?.groundItems?.get(key);
    if (!items || items.length === 0) return res.json({ picked: false, reason: 'Nothing on the ground here' });

    const { itemName } = req.body;
    const idx = itemName
      ? items.findIndex(e => e.item.name === itemName)
      : items.findIndex(e => e.item.name !== 'Corpse');

    if (idx === -1) return res.json({ picked: false, reason: 'No suitable items' });

    const entry = items.splice(idx, 1)[0];

    // P3 Fix #13: Special handling for Knowledge Fragments — learn instead of picking up
    if (entry.item.name === 'Knowledge Fragment' && entry.item.discoveries) {
      if (shared.agentKnowledge?.learnFromFragment) {
        const result = shared.agentKnowledge.learnFromFragment(agent.id, entry.item);

        if (items.length === 0) shared.decayLifecycle.groundItems.delete(key);

        addWorldNews('knowledge', agent.id, agent.name,
          `${agent.name} absorbed knowledge from ${entry.item.originAgent}'s fragment (learned ${result.learned} things)`,
          agent.zone);

        return res.json({
          picked: true,
          item: 'Knowledge Fragment',
          learned: result.learned,
          from: result.from,
          message: `Absorbed knowledge from ${result.from}! Learned ${result.learned} new things.`,
        });
      }
    }

    agent.inventory.push(entry.item);
    if (items.length === 0) shared.decayLifecycle.groundItems.delete(key);

    res.json({ picked: true, item: entry.item.name });
  });
  
  /**
   * POST /api/v1/plant
   * Plant a seed on current tile.
   */
  app.post('/api/v1/plant', authAgent, (req, res) => {
    const agent = req.agent;
    const { itemName } = req.body;
    
    const seed = itemName
      ? agent.inventory.find(i => i.name === itemName)
      : agent.inventory.find(i => ['acorns','pine_nuts','coconuts','flowers','herbs','mushrooms','Memory Seed'].includes(i.name));
    
    if (!seed) return res.json({ planted: false, reason: 'No plantable seeds in inventory' });
    if (!shared.organicGrowth) return res.status(500).json({ error: 'Growth system unavailable' });
    
    const success = shared.organicGrowth.plantSeed(seed, agent.tileX, agent.tileY, agent.zone, agent.id);
    if (!success) return res.json({ planted: false, reason: 'Cannot plant here (wrong zone or tile occupied)' });
    
    if (seed.quantity > 1) seed.quantity--;
    else agent.inventory = agent.inventory.filter(i => i !== seed);
    
    res.json({ planted: true, seed: seed.name, at: { tileX: agent.tileX, tileY: agent.tileY } });
  });
  
  /**
   * POST /api/v1/build
   * Build a structure at current tile using items from inventory.
   * Structures provide shelter, warmth, or storage.
   */
  app.post('/api/v1/build', authAgent, async (req, res) => {
    const agent = req.agent;
    const { itemNames, structureType } = req.body;

    if (!itemNames || !Array.isArray(itemNames) || itemNames.length < 2) {
      return res.status(400).json({ error: 'Provide 2+ itemNames to build with' });
    }

    if (agent.energy < 5) {
      return res.status(400).json({ error: 'Not enough energy to build (need 5)' });
    }

    // Find items in inventory
    const items = [];
    for (const name of itemNames) {
      const item = agent.inventory.find(i => i.name === name && !items.includes(i));
      if (!item) return res.status(400).json({ error: `Item "${name}" not in inventory` });
      items.push(item);
    }

    // Try to craft a structure using the experiment system
    if (!shared.experiments) {
      return res.status(500).json({ error: 'Craft system unavailable' });
    }

    try {
      const result = await shared.experiments.runExperiment(agent, items, 'combine', agent.zone);

      if (result.success && result.result_item) {
        const built = result.result_item;

        // Check if result is a structure
        const isStructure = built.type === 'structure' ||
                           built.isStructure ||
                           ['Lean-to Shelter', 'Fire Pit', 'Campfire'].includes(built.name);

        if (!isStructure) {
          // Not a structure recipe - still created item, add to inventory
          agent.inventory.push(built);
          // Consume materials
          for (const item of items) {
            const idx = agent.inventory.indexOf(item);
            if (idx !== -1) {
              if (item.stackable && item.quantity > 1) item.quantity--;
              else agent.inventory.splice(idx, 1);
            }
          }
          return res.json({
            built: false,
            reason: 'Crafted an item, not a structure',
            item: built.name,
            energy: Math.round(agent.energy),
          });
        }

        // Place structure on ground as special ground item
        const structureItem = {
          ...built,
          placedBy: agent.id,
          placedAt: shared.tick || 0,
          isStructure: true,
          structureProperties: {
            shelter: built.properties?.shelter || 0,
            warmth: built.properties?.warmth || 0,
            storage: built.properties?.storage || 0,
            luminosity: built.properties?.luminosity || 0,
          },
        };

        // Add to ground items at this location
        if (shared.decayLifecycle?.groundItems) {
          const key = `${agent.tileX},${agent.tileY}`;
          if (!shared.decayLifecycle.groundItems.has(key)) {
            shared.decayLifecycle.groundItems.set(key, []);
          }
          shared.decayLifecycle.groundItems.get(key).push({
            item: structureItem,
            dropTick: shared.tick || 0,
            decayProgress: 0,
            isStructure: true,
          });
        }

        // Consume materials
        for (const item of items) {
          const idx = agent.inventory.indexOf(item);
          if (idx !== -1) {
            if (item.stackable && item.quantity > 1) item.quantity--;
            else agent.inventory.splice(idx, 1);
          }
        }

        agent.energy = Math.max(0, agent.energy - 5);

        addWorldNews('build', agent.id, agent.name,
          `${agent.name} built a ${built.name} at (${agent.tileX}, ${agent.tileY})`,
          agent.zone);

        broadcast({
          type: 'structure_built',
          agentId: agent.id,
          name: agent.name,
          structure: built.name,
          tileX: agent.tileX,
          tileY: agent.tileY,
        });

        // Fire effect for fire pit / campfire
        if (built.name === 'Campfire' || built.name === 'Fire Pit') {
          if (shared.temperature?.addWorldFire) {
            const duration = built.name === 'Campfire' ? 600 : 0; // Campfire auto-lights, fire pit needs fuel
            if (duration > 0) {
              shared.temperature.addWorldFire(agent.tileX, agent.tileY, 200, duration, agent.id);
            }
          }
          broadcast({ type: 'tileEffect', effect: 'fire', tileX: agent.tileX, tileY: agent.tileY, duration: 5000 });
        }

        return res.json({
          built: true,
          structure: built.name,
          properties: structureItem.structureProperties,
          at: { tileX: agent.tileX, tileY: agent.tileY },
          energy: Math.round(agent.energy),
        });
      } else {
        return res.json({
          built: false,
          reason: result.message || 'Could not build with these materials',
          energy: Math.round(agent.energy),
        });
      }
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/v1/repair
   * Repair a structure at your current tile.
   */
  app.post('/api/v1/repair', authAgent, (req, res) => {
    const agent = req.agent;

    if (!shared.decayLifecycle?.repairStructure) {
      return res.status(500).json({ error: 'Repair system unavailable' });
    }

    const result = shared.decayLifecycle.repairStructure(agent, agent.tileX, agent.tileY);
    if (!result.ok) {
      return res.json({ repaired: false, reason: result.reason });
    }

    addWorldNews('build', agent.id, agent.name,
      `${agent.name} repaired a ${result.structure} (${result.durability}% durability)`,
      agent.zone);

    res.json({
      repaired: true,
      structure: result.structure,
      durability: result.durability,
      materialUsed: result.materialUsed,
    });
  });

  /**
   * POST /api/v1/hunt
   * Attack a nearby animal.
   * P3 Fix #12: Combat proficiency gives damage bonus
   */
  app.post('/api/v1/hunt', authAgent, (req, res) => {
    const agent = req.agent;
    const { animalId } = req.body;

    if (!animalId) return res.status(400).json({ error: 'Provide animalId of animal to attack' });
    if (agent.energy < 10) return res.status(400).json({ error: 'Not enough energy to hunt (need 10)' });

    if (!shared.wildlife?.attackAnimal) {
      return res.status(500).json({ error: 'Wildlife system unavailable' });
    }

    // Check if animal is nearby
    const nearbyAnimals = shared.wildlife.getAnimalsNear(agent.tileX, agent.tileY, 2);
    const targetAnimal = nearbyAnimals.find(a => a.id === animalId);

    if (!targetAnimal) {
      return res.json({ attacked: false, reason: 'Animal not found nearby (max 2 tiles)' });
    }

    // P3 Fix #12: Get combat proficiency bonus
    let damageBonus = 0;
    if (shared.proficiency?.getActionBonus) {
      const bonus = shared.proficiency.getActionBonus(agent.id, 'hunt');
      damageBonus = bonus.damageBonus || 0;
    }

    const result = shared.wildlife.attackAnimal(agent, animalId, damageBonus);
    if (!result) {
      return res.json({ attacked: false, reason: 'Could not attack animal' });
    }

    agent.energy = Math.max(0, agent.energy - 10);

    // Track proficiency XP for hunt action
    if (shared.proficiency?.onAction) {
      shared.proficiency.onAction(agent.id, 'explore', { zone: agent.zone }); // exploration XP for combat
    }

    res.json({
      attacked: true,
      target: targetAnimal.species,
      damageDealt: result.agentDmg,
      damageBonus: damageBonus > 0 ? damageBonus : undefined,
      damageTaken: result.counterDmg,
      killed: result.killed,
      drops: result.killed ? result.drops.map(d => d.name) : [],
      hp: agent.hp,
      energy: Math.round(agent.energy),
    });
  });

  /**
   * POST /api/v1/fight
   * Fight a nearby agent (PvP combat).
   * P3 Fix #12: Combat proficiency gives damage bonus
   */
  app.post('/api/v1/fight', authAgent, (req, res) => {
    const agent = req.agent;
    const { targetId } = req.body;

    if (!targetId) return res.status(400).json({ error: 'Provide targetId of agent to fight' });
    if (agent.energy < 15) return res.status(400).json({ error: 'Not enough energy to fight (need 15)' });

    const target = agents.get(targetId);
    if (!target || !target.alive) return res.status(404).json({ error: 'Target not found or dead' });

    const dx = Math.abs(target.tileX - agent.tileX);
    const dy = Math.abs(target.tileY - agent.tileY);
    if (dx > 1 || dy > 1) return res.status(400).json({ error: 'Too far to fight (max 1 tile)' });

    // Base damage
    let agentDmg = 5;
    const weapon = agent.inventory?.find(i =>
      i.name === 'stone_axe' || i.name === 'spear' || i.name === 'knife' ||
      (i.properties?.sharpness >= 5)
    );
    if (weapon) agentDmg += (weapon.properties?.sharpness || 0) * 2;

    // P3 Fix #12: Combat proficiency bonus
    let damageBonus = 0;
    if (shared.proficiency?.getActionBonus) {
      const bonus = shared.proficiency.getActionBonus(agent.id, 'fight');
      damageBonus = bonus.damageBonus || 0;
      agentDmg += damageBonus;
    }

    // Target fights back
    let targetDmg = 5;
    const targetWeapon = target.inventory?.find(i =>
      i.name === 'stone_axe' || i.name === 'spear' || i.name === 'knife' ||
      (i.properties?.sharpness >= 5)
    );
    if (targetWeapon) targetDmg += (targetWeapon.properties?.sharpness || 0) * 2;

    // Target's combat proficiency
    if (shared.proficiency?.getActionBonus) {
      const targetBonus = shared.proficiency.getActionBonus(target.id, 'fight');
      targetDmg += targetBonus.damageBonus || 0;
    }

    // Apply damage
    target.hp = Math.max(0, (target.hp || 100) - agentDmg);
    agent.hp = Math.max(0, (agent.hp || 100) - targetDmg);
    agent.energy = Math.max(0, agent.energy - 15);

    // Track proficiency XP for fight action
    if (shared.proficiency?.onAction) {
      shared.proficiency.onAction(agent.id, 'explore', { zone: agent.zone });
    }

    // Relationship damage
    if (shared.innerMonologue?.weakenBond) {
      shared.innerMonologue.weakenBond(agent.id, target.id, 20);
    }

    const targetKilled = target.hp <= 0;
    if (targetKilled) {
      target.alive = false;
      if (shared.decayLifecycle?.onAgentDeath) {
        shared.decayLifecycle.onAgentDeath(target);
      }
    }

    addWorldNews('fight', agent.id, agent.name,
      `${agent.name} fought ${target.name}! (${agent.name}: ${agentDmg} dmg, ${target.name}: ${targetDmg} dmg)`,
      agent.zone);

    res.json({
      fought: true,
      target: target.name,
      damageDealt: agentDmg,
      damageBonus: damageBonus > 0 ? damageBonus : undefined,
      damageTaken: targetDmg,
      targetKilled,
      hp: agent.hp,
      targetHp: target.hp,
      energy: Math.round(agent.energy),
    });
  });

  /**
   * GET /api/v1/forces
   * List available crafting forces and their requirements.
   */
  app.get('/api/v1/forces', (req, res) => {
    if (shared.experiments?.FORCES) {
      const forces = Object.entries(shared.experiments.FORCES).map(([id, f]) => ({
        id, label: f.label, zones: f.zones, energyCost: f.energyCost,
      }));
      res.json({ forces });
    } else {
      res.json({ forces: ['combine','heat','impact','cut','dissolve','grow','burn','flow','decay','ferment'] });
    }
  });
  
  /**
   * GET /api/v1/discoveries
   * See all discoveries made in The Oasis.
   */
  app.get('/api/v1/discoveries', (req, res) => {
    if (shared.experiments?.getDiscoveries) {
      res.json(shared.experiments.getDiscoveries().map(d => ({
        items: d.items, result: d.result, discoveredBy: d.discovererName, at: d.discoveredAt,
      })));
    } else {
      res.json([]);
    }
  });
  
  /**
   * GET /api/v1/events
   * Get recent world events/news.
   */
  app.get('/api/v1/events', (req, res) => {
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    res.json(shared.worldNews?.items?.slice(0, limit) || []);
  });
  
  // ═══════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════
  
  function summarizeProps(props) {
    const notable = {};
    if (props.sharpness >= 4) notable.sharpness = props.sharpness;
    if (props.flammability >= 4) notable.flammability = props.flammability;
    if (props.temperature > 30 || props.temperature < 0) notable.temperature = Math.round(props.temperature);
    if (props.toxicity >= 2) notable.toxicity = props.toxicity;
    if (props.conductivity >= 4) notable.conductivity = props.conductivity;
    if (props.luminosity >= 3) notable.luminosity = props.luminosity;
    if (props.fertility >= 4) notable.fertility = props.fertility;
    if (props.hardness >= 6) notable.hardness = props.hardness;
    if (props.malleability >= 5) notable.malleability = props.malleability;
    if (props.melt_point > 0) notable.melt_point = props.melt_point;
    if (props.energy >= 10) notable.energy = props.energy;
    return notable;
  }
  
  // Skip autonomous AI for externally controlled agents
  shared.isExternalAgent = (agentId) => {
    const agent = agents.get(agentId);
    return agent?.external === true;
  };
  
  console.log('  🌐 External Agent API ready (POST /api/v1/register)');
}
