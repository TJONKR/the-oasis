// Reputation System
export function initReputation({ loadJSON, saveJSON, agents, agentStore, ensureAgentStats, zones }) {
  let reputationData = loadJSON('reputation.json', {});

  const REP_LEVELS = [
    { name: 'Newcomer', min: 0, bonus: 0 },
    { name: 'Regular', min: 10, bonus: 1 },
    { name: 'Respected', min: 25, bonus: 2 },
    { name: 'Honored', min: 50, bonus: 3 },
    { name: 'Legendary', min: 100, bonus: 4 },
  ];

  function getRepLevel(score) {
    let level = REP_LEVELS[0];
    for (const l of REP_LEVELS) {
      if (score >= l.min) level = l;
    }
    return level;
  }

  function ensureRep(agentId) {
    if (!reputationData[agentId]) {
      reputationData[agentId] = {};
      for (const zone of Object.keys(zones)) {
        reputationData[agentId][zone] = 0;
      }
    }
    // Ensure all zones exist
    for (const zone of Object.keys(zones)) {
      if (reputationData[agentId][zone] === undefined) reputationData[agentId][zone] = 0;
    }
    return reputationData[agentId];
  }

  function addRep(agentId, zone, amount) {
    if (!zone || !zones[zone]) return;
    const rep = ensureRep(agentId);
    rep[zone] = Math.round((rep[zone] + amount) * 10) / 10;
    reputationData[agentId] = rep;
    saveJSON('reputation.json', reputationData);
    return rep[zone];
  }

  function getRep(agentId) {
    const rep = ensureRep(agentId);
    const result = {};
    for (const [zone, score] of Object.entries(rep)) {
      const level = getRepLevel(score);
      result[zone] = { score: Math.round(score * 10) / 10, level: level.name, bonus: level.bonus };
    }
    return result;
  }

  function getGatherBonus(agentId, zone) {
    const rep = ensureRep(agentId);
    const level = getRepLevel(rep[zone] || 0);
    return 1 + (level.bonus * 0.1); // +10% per level
  }

  function getZoneTitle(agentId, zone) {
    const rep = ensureRep(agentId);
    const level = getRepLevel(rep[zone] || 0);
    if (level.name === 'Legendary') return `${zones[zone]?.name || zone} Legend`;
    if (level.name === 'Honored') return `${zones[zone]?.name || zone} Champion`;
    return null;
  }

  function setupRoutes(app) {
    app.get('/api/agent/:id/reputation', (req, res) => {
      const agent = agents.get(req.params.id);
      if (!agent) return res.status(404).json({ error: 'Agent not found' });
      res.json({ agentId: agent.id, name: agent.name, reputation: getRep(agent.id) });
    });
  }

  return { setupRoutes, addRep, getRep, getGatherBonus, getZoneTitle, getRepLevel, ensureRep };
}
