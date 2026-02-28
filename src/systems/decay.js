// Decay System — Phase 2
// Item decay, tool durability, decay ticks

import { getProperties } from './materials.js';

export function initDecay(shared) {
  const { agents, agentStore, saveJSON, broadcast, addWorldNews } = shared;
  let survivalSystem = null;
  let decayInterval = null;

  function setSurvival(ss) { survivalSystem = ss; }

  /** Ensure item has condition field */
  function ensureCondition(item) {
    const props = item.properties || getProperties(item.name);
    const decayRate = props?.decay_rate ?? 0;
    if (decayRate > 0 && item.condition === undefined) item.condition = 100;
    if (item.type === 'tool' && item.durability === undefined) {
      const hardness = props?.hardness ?? 5;
      item.durability = Math.round(50 + hardness * 5); // 50-100 based on hardness
    }
  }

  /** Apply decay to a single item. Returns true if destroyed. */
  function decayItem(item, zone, gameHours) {
    const props = item.properties || getProperties(item.name);
    if (!props) return false;
    const decayRate = props.decay_rate ?? 0;
    if (decayRate <= 0 || item.condition === undefined) return false;

    let decay = decayRate * 10 * gameHours;

    // Temperature affects organic decay
    if (survivalSystem && (props.organic ?? 0) >= 0.5) {
      const temp = survivalSystem.getZoneTemperature(zone);
      if (temp > 30) decay *= 1.5; // hot speeds organic decay
      else if (temp < 10) decay *= 0.5; // cold slows it
    }

    item.condition = Math.max(0, item.condition - decay);
    return item.condition <= 0;
  }

  /** Reduce tool durability on use. Returns { broken, durability } */
  function useTool(item) {
    if (item.type !== 'tool' || item.durability === undefined) return { broken: false };
    const props = item.properties || getProperties(item.name);
    const weight = props?.weight ?? 5;
    const hardness = props?.hardness ?? 5;
    // Heavier/softer tools wear faster
    const wear = Math.max(1, Math.round((weight / hardness) * 3));
    item.durability = Math.max(0, item.durability - wear);
    return { broken: item.durability <= 0, durability: item.durability, wear };
  }

  /** Run a decay tick across all agent inventories */
  function decayTick(gameHours = 0.4) {
    // ~0.4 game hours per real minute (24 game-hours / 60 real-minutes)
    let totalDestroyed = 0;

    for (const [agentId, agent] of agents.entries()) {
      if (!agent.inventory || agent.inventory.length === 0) continue;
      const zone = agent.zone || 'grass';
      const destroyed = [];
      const warnings = [];

      for (const item of agent.inventory) {
        ensureCondition(item);
        const isDestroyed = decayItem(item, zone, gameHours);
        if (isDestroyed) {
          destroyed.push(item);
        } else if (item.condition !== undefined && item.condition < 20 && item.condition > 0) {
          // Near-decay warning flag
          item.decayWarning = true;
        }
      }

      if (destroyed.length > 0) {
        for (const item of destroyed) {
          agent.inventory = agent.inventory.filter(i => i.id !== item.id);
          const isValuable = ['Rare', 'Epic', 'Legendary'].includes(item.rarity);
          if (isValuable) {
            addWorldNews('decay', agentId, agent.name, `${agent.name}'s ${item.rarity} ${item.name} decayed to nothing!`, zone);
            broadcast({ type: 'itemDecayed', agentId, agentName: agent.name, item: item.name, rarity: item.rarity });
          }
          totalDestroyed++;
        }
        agentStore[agentId] = agent;
      }
    }

    if (totalDestroyed > 0) saveJSON('agents.json', agentStore);
    return totalDestroyed;
  }

  /** Start the decay interval (every real minute) */
  function startDecayTimer() {
    if (decayInterval) clearInterval(decayInterval);
    decayInterval = setInterval(() => decayTick(), 60 * 1000);
  }

  function stopDecayTimer() {
    if (decayInterval) { clearInterval(decayInterval); decayInterval = null; }
  }

  /** Handle tool break: remove from inventory, broadcast */
  function handleToolBreak(agent, item) {
    agent.inventory = agent.inventory.filter(i => i.id !== item.id);
    addWorldNews('tool_break', agent.id, agent.name, `${agent.name}'s ${item.name} broke! 🔨💥`, agent.zone);
    broadcast({ type: 'toolBroke', agentId: agent.id, agentName: agent.name, item: item.name });
    agentStore[agent.id] = agent;
    saveJSON('agents.json', agentStore);
  }

  function setupRoutes(app) {
    // No dedicated routes, decay is passive
  }

  return {
    setupRoutes,
    setSurvival,
    ensureCondition,
    decayItem,
    useTool,
    handleToolBreak,
    decayTick,
    startDecayTimer,
    stopDecayTimer,
  };
}
