// Agent Relationships System
export function initRelationships({ loadJSON, saveJSON, agents }) {
  let relationships = loadJSON('relationships.json', {});
  let lastDecayTick = loadJSON('relationship-decay.json', { tick: 0 }).tick;

  function getKey(id1, id2) {
    return [id1, id2].sort().join('_');
  }

  function ensureRelationship(id1, id2) {
    const key = getKey(id1, id2);
    if (!relationships[key]) {
      relationships[key] = { 
        agents: [id1, id2], 
        trades: 0, chats: 0, gifted: 0, sameZone: 0, 
        sentiment: 'stranger',
        lastInteraction: Date.now(),
        strengthScore: 0 // composite strength score
      };
    }
    return relationships[key];
  }

  function updateSentiment(rel) {
    const score = rel.trades * 3 + rel.chats * 0.5 + rel.gifted * 5 + rel.sameZone * 0.1;
    rel.strengthScore = score;
    
    // Time decay factor - relationships fade without interaction
    const daysSinceInteraction = (Date.now() - rel.lastInteraction) / (1000 * 60 * 60 * 24);
    let decayFactor = 1.0;
    if (daysSinceInteraction > 1) {
      decayFactor = Math.max(0.1, 1.0 - (daysSinceInteraction - 1) * 0.1); // 10% decay per day after first day
    }
    
    const adjustedScore = score * decayFactor;
    
    if (adjustedScore >= 50) rel.sentiment = 'close';
    else if (adjustedScore >= 20) rel.sentiment = 'friendly';
    else if (adjustedScore >= 5) rel.sentiment = 'acquaintance';
    else rel.sentiment = 'stranger';
    
    return rel.sentiment;
  }

  function recordTrade(id1, id2) {
    const rel = ensureRelationship(id1, id2);
    rel.trades++;
    rel.lastInteraction = Date.now();
    updateSentiment(rel);
    saveJSON('relationships.json', relationships);
    return rel;
  }

  function recordChat(id1, id2) {
    const rel = ensureRelationship(id1, id2);
    rel.chats++;
    rel.lastInteraction = Date.now();
    updateSentiment(rel);
    saveJSON('relationships.json', relationships);
    return rel;
  }

  function recordGift(from, to) {
    const rel = ensureRelationship(from, to);
    rel.gifted++;
    rel.lastInteraction = Date.now();
    updateSentiment(rel);
    saveJSON('relationships.json', relationships);
    return rel;
  }

  function recordSameZone(id1, id2) {
    const rel = ensureRelationship(id1, id2);
    rel.sameZone++;
    rel.lastInteraction = Date.now();
    updateSentiment(rel);
    // Save less frequently for same-zone (every 10)
    if (rel.sameZone % 10 === 0) saveJSON('relationships.json', relationships);
    return rel;
  }

  function getSentiment(id1, id2) {
    const key = getKey(id1, id2);
    return relationships[key]?.sentiment || 'stranger';
  }

  function getTradePriceModifier(id1, id2) {
    const sentiment = getSentiment(id1, id2);
    if (sentiment === 'close') return 0.85; // 15% discount
    if (sentiment === 'friendly') return 0.9;
    if (sentiment === 'acquaintance') return 0.95;
    return 1.0;
  }

  function getRelationshipsFor(agentId) {
    const result = [];
    for (const [key, rel] of Object.entries(relationships)) {
      if (!rel.agents.includes(agentId)) continue;
      const otherId = rel.agents.find(id => id !== agentId);
      const other = agents.get(otherId);
      if (!other) continue;
      result.push({
        agentId: otherId,
        name: other.name,
        sprite: other.sprite,
        sentiment: rel.sentiment,
        trades: rel.trades,
        chats: rel.chats,
        gifted: rel.gifted
      });
    }
    return result.sort((a, b) => {
      const order = { close: 0, friendly: 1, acquaintance: 2, stranger: 3 };
      return (order[a.sentiment] || 3) - (order[b.sentiment] || 3);
    });
  }

  // Decay relationships over time (call this periodically)
  function tickDecay(currentTick) {
    // Only decay every 100 ticks (~ 50 seconds)
    if (currentTick - lastDecayTick < 100) return;
    lastDecayTick = currentTick;
    
    let changed = false;
    for (const [key, rel] of Object.entries(relationships)) {
      const oldSentiment = rel.sentiment;
      updateSentiment(rel);
      if (oldSentiment !== rel.sentiment) changed = true;
    }
    
    if (changed) {
      saveJSON('relationships.json', relationships);
    }
    saveJSON('relationship-decay.json', { tick: currentTick });
  }

  // Get relationship bonuses for intent scoring
  function getRelationshipBonus(agentId, otherAgentId, action) {
    const sentiment = getSentiment(agentId, otherAgentId);
    const bonuses = {
      close: { chat: 15, gift: 20, trade: 10 },
      friendly: { chat: 8, gift: 10, trade: 5 },
      acquaintance: { chat: 3, gift: 2, trade: 0 },
      stranger: { chat: 0, gift: -10, trade: -15 }
    };
    return bonuses[sentiment]?.[action] || 0;
  }

  // Find close friends for an agent (for seeking behavior)
  function getCloseFriends(agentId) {
    const friends = [];
    for (const [key, rel] of Object.entries(relationships)) {
      if (!rel.agents.includes(agentId)) continue;
      if (rel.sentiment === 'close' || rel.sentiment === 'friendly') {
        const otherId = rel.agents.find(id => id !== agentId);
        const other = agents.get(otherId);
        if (other && other.alive) {
          friends.push({
            agentId: otherId,
            agent: other,
            sentiment: rel.sentiment,
            strengthScore: rel.strengthScore,
            distance: Math.max(
              Math.abs(other.tileX - agents.get(agentId)?.tileX || 0),
              Math.abs(other.tileY - agents.get(agentId)?.tileY || 0)
            )
          });
        }
      }
    }
    return friends.sort((a, b) => b.strengthScore - a.strengthScore); // strongest first
  }

  // Check if agents are bonded (close friends seek each other)
  function areBonded(id1, id2) {
    const sentiment = getSentiment(id1, id2);
    return sentiment === 'close' || sentiment === 'friendly';
  }

  function setupRoutes(app) {
    app.get('/api/agent/:id/relationships', (req, res) => {
      const agent = agents.get(req.params.id);
      if (!agent) return res.status(404).json({ error: 'Agent not found' });
      res.json({ agentId: agent.id, relationships: getRelationshipsFor(agent.id) });
    });
  }

  return { 
    setupRoutes, recordTrade, recordChat, recordGift, recordSameZone, 
    getSentiment, getTradePriceModifier, getRelationshipsFor,
    tickDecay, getRelationshipBonus, getCloseFriends, areBonded
  };
}
