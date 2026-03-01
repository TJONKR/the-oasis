// Inner Monologue System — Emergent Agent Intelligence
// Periodically gives agents an LLM-driven "thought" that can:
// 1. Invent new actions we never coded
// 2. Set personal goals
// 3. Create emotional responses (trauma, attachment, ambition)
// 4. Use tools creatively based on item properties
// 5. React to the world in novel ways
//
// Cost-managed: only 1-2 agents think per tick cycle, rotating through all agents.

export function initInnerMonologue(shared) {
  const { agents, agentStore, broadcast, addWorldNews, saveJSON, loadJSON } = shared;
  
  // Persistent psychology state per agent
  const psychology = loadJSON('psychology.json', {});
  
  // Queue: agents waiting for their turn to think
  let thinkQueue = [];
  let lastThinkTick = 0;
  const THINK_INTERVAL = 60; // ticks between think cycles (~30 seconds)
  const AGENTS_PER_CYCLE = 2; // how many agents think per cycle
  
  // Track novel actions discovered by agents
  const novelActions = loadJSON('novel-actions.json', []);
  
  function ensurePsychology(agentId, agent) {
    if (!psychology[agentId]) {
      psychology[agentId] = {
        trauma: [],          // [{ event, zone, severity, tick }]
        attachments: {},     // agentId → { bond: 0-100, memories: [] }
        ambitions: [],       // [{ goal, reason, progress }]
        fears: [],           // [{ thing, reason, severity }]
        beliefs: [],         // [{ belief, confidence }]  
        lastThought: null,
        thoughtCount: 0,
        novelBehaviors: [],  // actions this agent invented
      };
    }
    return psychology[agentId];
  }
  
  /**
   * Build context string for LLM — everything the agent "knows".
   */
  function buildAgentContext(agent, mind, psych) {
    const gameTime = shared.getGameTime?.() || {};
    const weather = shared.weather?.getCurrentWeather?.() || {};
    const nearbyAgents = [...agents.values()]
      .filter(a => a.alive && a.id !== agent.id && 
        Math.abs(a.tileX - agent.tileX) <= 10 && Math.abs(a.tileY - agent.tileY) <= 10)
      .map(a => `${a.name} (${Math.abs(a.tileX-agent.tileX)+Math.abs(a.tileY-agent.tileY)} tiles away)`);
    
    const inventory = (agent.inventory || []).slice(0, 10).map(i => {
      const props = i.properties || {};
      const notable = [];
      if (props.sharpness >= 5) notable.push('sharp');
      if (props.flammability >= 6) notable.push('flammable');
      if (props.temperature >= 100) notable.push(`hot:${Math.round(props.temperature)}°C`);
      if (props.toxicity >= 3) notable.push('toxic');
      if (props.conductivity >= 5) notable.push('conductive');
      if (props.luminosity >= 4) notable.push('glowing');
      if (props.fertility >= 5) notable.push('fertile');
      return `${i.name}${notable.length ? ' ['+notable.join(',')+']' : ''}`;
    });
    
    const recentMemories = (mind?.memory || []).slice(-5).map(m => m.event || m);
    
    const traumaStr = psych.trauma.length > 0 
      ? `Traumatic memories: ${psych.trauma.map(t => t.event).join('; ')}` : '';
    
    const attachStr = Object.entries(psych.attachments)
      .filter(([,v]) => v.bond > 20)
      .map(([id, v]) => {
        const other = agents.get(id);
        return other ? `${other.name} (bond: ${v.bond})` : null;
      }).filter(Boolean).join(', ');
    
    const ambitionStr = psych.ambitions.length > 0
      ? `Current ambitions: ${psych.ambitions.map(a => a.goal).join('; ')}` : '';
    
    const nearbyFire = shared.temperature?.hasNearbyFire?.(agent.tileX, agent.tileY, 5);
    const nearbyGas = shared.gasSystem?.gasClouds?.get(`${agent.tileX},${agent.tileY}`);
    
    return `You are ${agent.name}, a survivor in The Oasis — a wild, emergent world.

PERSONALITY: ${mind?.personality?.temperament || 'balanced'}. Traits: ${(mind?.personality?.traits || []).join(', ') || 'none'}.
ZONE: ${agent.zone} | TIME: Day ${gameTime.day || '?'}, ${gameTime.hour || '?'}:00 (${gameTime.period || '?'}) | WEATHER: ${weather.name || weather.condition || 'unknown'}
HP: ${agent.hp || 100}/100 | Energy: ${Math.round(agent.energy || 100)} | Hunger: ${Math.round(agent.hunger || 0)}
INVENTORY (${inventory.length} items): ${inventory.join(', ') || 'empty'}
NEARBY AGENTS: ${nearbyAgents.join(', ') || 'alone'}
${nearbyFire ? '🔥 There is a fire nearby.' : ''}
${nearbyGas ? '☁️ There is gas/smoke here!' : ''}
${traumaStr}
${attachStr ? `Close bonds: ${attachStr}` : ''}
${ambitionStr}
RECENT EVENTS: ${recentMemories.join('. ') || 'nothing notable'}

KNOWN ACTIONS: gather, craft, experiment, cook, plant, explore, rest, eat, chat, gift, fight, build, drop, pickup
FORCES YOU CAN USE: heat, impact, cut, dissolve, grow, burn, combine, flow, decay, ferment`;
  }
  
  /**
   * Send a thought request to the LLM.
   */
  async function generateThought(agent, mind) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;
    
    const psych = ensurePsychology(agent.id, agent);
    const context = buildAgentContext(agent, mind, psych);
    
    const systemPrompt = `You are simulating the inner mind of a survival agent. Given their situation, generate a brief inner thought and decision.

Respond with ONLY valid JSON:
{
  "thought": "Brief inner monologue (1-2 sentences, first person)",
  "emotion": "current emotional state (1 word: curious, afraid, determined, lonely, excited, content, anxious, angry, hopeful, grieving)",
  "action": {
    "type": "known action name OR a novel action you invent",
    "target": "what/who to act on (optional)",
    "reason": "why (brief)"
  },
  "goal": "a personal ambition or null (e.g. 'build a shelter', 'find crystals', 'befriend Agent-5')",
  "memory": "something worth remembering from this moment, or null",
  "fear": "something that now scares them, or null",
  "invention": "if they want to USE an item in a new way or CREATE something novel, describe it here. Otherwise null."
}

Rules:
- Stay in character. A cautious agent thinks differently from a bold one.
- Novel actions are encouraged! If the agent has sharp items and wants to carve a message, that's valid.
- If they're near fire with raw food, they should think about cooking.
- Trauma affects decisions. An agent who almost died from gas avoids caves.
- Attachments matter. If a bonded friend is nearby, they might seek them out.
- Goals should be concrete and achievable, not abstract.
- Keep thoughts SHORT and natural, like a real person's stream of consciousness.
- Be creative but grounded in the physics of the world.`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 300,
          system: systemPrompt,
          messages: [{ role: 'user', content: context }],
        }),
      });
      
      if (!response.ok) {
        console.error(`[inner-monologue] API error ${response.status}`);
        return null;
      }
      
      const data = await response.json();
      const text = data.content?.[0]?.text;
      if (!text) return null;
      
      // Parse JSON (handle markdown wrapping)
      const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const result = JSON.parse(jsonStr);
      return result;
    } catch (err) {
      console.error(`[inner-monologue] Error:`, err.message);
      return null;
    }
  }
  
  /**
   * Apply a thought result to an agent's psychology and behavior.
   */
  function applyThought(agent, mind, thought) {
    if (!thought) return;
    const psych = ensurePsychology(agent.id, agent);
    
    // Store the thought
    psych.lastThought = thought.thought;
    psych.thoughtCount++;
    
    // Update emotion
    if (thought.emotion && mind) {
      mind.mood = thought.emotion;
    }
    
    // Add memory
    if (thought.memory && mind?.memory) {
      mind.memory.push({ event: thought.memory, tick: shared.tick || 0 });
      if (mind.memory.length > 20) mind.memory.shift();
    }
    
    // Add fear
    if (thought.fear) {
      if (!psych.fears.find(f => f.thing === thought.fear)) {
        psych.fears.push({ thing: thought.fear, reason: thought.thought, severity: 3 });
        if (psych.fears.length > 5) psych.fears.shift();
      }
    }
    
    // Set goal/ambition
    if (thought.goal) {
      if (!psych.ambitions.find(a => a.goal === thought.goal)) {
        psych.ambitions.push({ goal: thought.goal, reason: thought.thought, progress: 0, tick: shared.tick || 0 });
        if (psych.ambitions.length > 3) psych.ambitions.shift();
      }
    }
    
    // Handle novel invention
    if (thought.invention) {
      const invention = {
        agent: agent.name,
        agentId: agent.id,
        description: thought.invention,
        tick: shared.tick || 0,
        thought: thought.thought,
      };
      novelActions.push(invention);
      if (novelActions.length > 100) novelActions.shift();
      saveJSON('novel-actions.json', novelActions);
      
      if (broadcast) {
        addWorldNews?.('invention', agent.id, agent.name,
          `💡 ${agent.name} had an idea: "${thought.invention}"`, agent.zone);
        broadcast({ type: 'tileEffect', effect: 'sparkle', tileX: agent.tileX, tileY: agent.tileY, duration: 3000 });
      }
    }
    
    // Override current intent with thought's action
    if (thought.action?.type && mind) {
      const knownActions = ['gather','craft','experiment','cook','plant','explore','rest','eat','chat','gift','fight','build','drop','pickup'];
      
      if (knownActions.includes(thought.action.type)) {
        // Known action — set as intent
        mind.intent = {
          action: thought.action.type,
          targetX: agent.tileX,
          targetY: agent.tileY,
          reason: thought.action.reason || thought.thought,
          startedTick: shared.tick || 0,
          maxTicks: 20,
        };
      } else {
        // Novel action! Log it and try to map to closest known action
        const novelAction = {
          type: thought.action.type,
          target: thought.action.target,
          reason: thought.action.reason,
          agent: agent.name,
          tick: shared.tick || 0,
        };
        
        if (!novelActions.find(a => a.type === novelAction.type)) {
          novelActions.push(novelAction);
          saveJSON('novel-actions.json', novelActions);
        }
        
        if (broadcast) {
          addWorldNews?.('novel_action', agent.id, agent.name,
            `🆕 ${agent.name} attempted: "${thought.action.type}" — ${thought.action.reason || ''}`, agent.zone);
        }
        
        // Try to map novel action to closest executor
        const actionMap = {
          'carve': 'craft', 'write': 'craft', 'draw': 'craft',
          'dig': 'gather', 'fish': 'gather', 'hunt': 'fight',
          'hide': 'rest', 'sleep': 'rest', 'meditate': 'rest',
          'sing': 'chat', 'teach': 'chat', 'trade': 'chat',
          'trap': 'build', 'shelter': 'build', 'wall': 'build',
          'forage': 'gather', 'mine': 'gather', 'harvest': 'gather',
          'flee': 'explore', 'run': 'explore', 'search': 'explore',
          'cook': 'cook', 'brew': 'cook', 'roast': 'cook',
          'sow': 'plant', 'garden': 'plant', 'farm': 'plant',
        };
        
        const mapped = actionMap[thought.action.type.toLowerCase()] || 'explore';
        mind.intent = {
          action: mapped,
          targetX: agent.tileX,
          targetY: agent.tileY,
          reason: `${thought.action.type}: ${thought.action.reason || thought.thought}`,
          startedTick: shared.tick || 0,
          maxTicks: 20,
        };
      }
    }
    
    // Broadcast thought bubble
    if (broadcast && thought.thought) {
      broadcast({
        type: 'agentThought',
        agentId: agent.id,
        name: agent.name,
        thought: thought.thought,
        emotion: thought.emotion,
      });
    }
    
    // Save psychology
    saveJSON('psychology.json', psychology);
  }
  
  /**
   * Record trauma when an agent nearly dies or witnesses death.
   */
  function recordTrauma(agentId, event, zone) {
    const psych = ensurePsychology(agentId);
    psych.trauma.push({ event, zone, severity: 5, tick: shared.tick || 0 });
    if (psych.trauma.length > 5) psych.trauma.shift();
    saveJSON('psychology.json', psychology);
  }
  
  /**
   * Strengthen attachment between two agents.
   */
  function strengthenBond(agentId1, agentId2, amount = 5) {
    const psych1 = ensurePsychology(agentId1);
    const psych2 = ensurePsychology(agentId2);
    
    if (!psych1.attachments[agentId2]) psych1.attachments[agentId2] = { bond: 0, memories: [] };
    if (!psych2.attachments[agentId1]) psych2.attachments[agentId1] = { bond: 0, memories: [] };
    
    psych1.attachments[agentId2].bond = Math.min(100, psych1.attachments[agentId2].bond + amount);
    psych2.attachments[agentId1].bond = Math.min(100, psych2.attachments[agentId1].bond + amount);
  }
  
  /**
   * Main tick — rotate through agents, give 1-2 per cycle a thought.
   */
  async function tick(tickNum) {
    if (!process.env.ANTHROPIC_API_KEY) return;
    if (tickNum - lastThinkTick < THINK_INTERVAL) return;
    lastThinkTick = tickNum;
    
    // Rebuild queue if empty
    if (thinkQueue.length === 0) {
      thinkQueue = [...agents.keys()].filter(id => agents.get(id)?.alive);
      // Shuffle
      for (let i = thinkQueue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [thinkQueue[i], thinkQueue[j]] = [thinkQueue[j], thinkQueue[i]];
      }
    }
    
    // Think for N agents this cycle
    const thinkers = thinkQueue.splice(0, AGENTS_PER_CYCLE);
    
    for (const agentId of thinkers) {
      const agent = agents.get(agentId);
      if (!agent?.alive) continue;
      
      const mind = shared.agentAI?.minds?.[agentId];
      if (!mind) continue;
      
      try {
        const thought = await generateThought(agent, mind);
        if (thought) {
          applyThought(agent, mind, thought);
          console.log(`💭 [${agent.name}] "${thought.thought}" → ${thought.action?.type || 'none'} (${thought.emotion})`);
        }
      } catch (err) {
        console.error(`[inner-monologue] Error for ${agent.name}:`, err.message);
      }
    }
  }
  
  // API routes
  function setupRoutes(app) {
    // Get agent psychology
    app.get('/api/agent/:id/psychology', (req, res) => {
      const psych = psychology[req.params.id];
      if (!psych) return res.json({ error: 'No psychology data' });
      res.json(psych);
    });
    
    // Get all novel actions/inventions
    app.get('/api/novel-actions', (req, res) => {
      res.json(novelActions);
    });
    
    // Get all agent thoughts (last thought per agent)
    app.get('/api/thoughts', (req, res) => {
      const thoughts = {};
      for (const [id, psych] of Object.entries(psychology)) {
        if (psych.lastThought) {
          const agent = agents.get(id);
          thoughts[id] = {
            name: agent?.name || id,
            thought: psych.lastThought,
            ambitions: psych.ambitions,
            fears: psych.fears,
            thoughtCount: psych.thoughtCount,
          };
        }
      }
      res.json(thoughts);
    });
  }
  
  return { tick, recordTrauma, strengthenBond, setupRoutes, psychology, ensurePsychology };
}
