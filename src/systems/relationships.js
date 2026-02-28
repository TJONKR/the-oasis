// Agent Relationships System
export function initRelationships({ loadJSON, saveJSON, agents }) {
  let relationships = loadJSON('relationships.json', {});

  function getKey(id1, id2) {
    return [id1, id2].sort().join('_');
  }

  function ensureRelationship(id1, id2) {
    const key = getKey(id1, id2);
    if (!relationships[key]) {
      relationships[key] = { agents: [id1, id2], trades: 0, chats: 0, gifted: 0, sameZone: 0, sentiment: 'stranger' };
    }
    return relationships[key];
  }

  function updateSentiment(rel) {
    const score = rel.trades * 3 + rel.chats * 0.5 + rel.gifted * 5 + rel.sameZone * 0.1;
    if (score >= 50) rel.sentiment = 'close';
    else if (score >= 20) rel.sentiment = 'friendly';
    else if (score >= 5) rel.sentiment = 'acquaintance';
    else rel.sentiment = 'stranger';
    return rel.sentiment;
  }

  function recordTrade(id1, id2) {
    const rel = ensureRelationship(id1, id2);
    rel.trades++;
    updateSentiment(rel);
    saveJSON('relationships.json', relationships);
    return rel;
  }

  function recordChat(id1, id2) {
    const rel = ensureRelationship(id1, id2);
    rel.chats++;
    updateSentiment(rel);
    saveJSON('relationships.json', relationships);
    return rel;
  }

  function recordGift(from, to) {
    const rel = ensureRelationship(from, to);
    rel.gifted++;
    updateSentiment(rel);
    saveJSON('relationships.json', relationships);
    return rel;
  }

  function recordSameZone(id1, id2) {
    const rel = ensureRelationship(id1, id2);
    rel.sameZone++;
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

  function setupRoutes(app) {
    app.get('/api/agent/:id/relationships', (req, res) => {
      const agent = agents.get(req.params.id);
      if (!agent) return res.status(404).json({ error: 'Agent not found' });
      res.json({ agentId: agent.id, relationships: getRelationshipsFor(agent.id) });
    });
  }

  return { setupRoutes, recordTrade, recordChat, recordGift, recordSameZone, getSentiment, getTradePriceModifier, getRelationshipsFor };
}
