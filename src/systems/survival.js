// Survival System — Phase 2
// Energy, food, temperature effects

const ZONE_TEMPS = {
  cave: 5, sand: 35, grass: 22, rocky: 15,
  forest: 20, path: 22, coast: 25, swamp: 18,
};

const WEATHER_TEMP_MOD = {
  clear: 3, sunny: 5, cloudy: -2, rain: -5, storm: -8, fog: -3, wind: -4,
};

const ACTION_ENERGY_COST = {
  gather: 5, experiment: 10, craft: 5, move: 3, chat: 0, rest: 0, eat: 0,
};

const MAX_ENERGY = 100;
const ENERGY_REGEN_PER_GAME_HOUR = 1;
const GARDEN_REGEN_PER_GAME_HOUR = 3;
const REST_BONUS_MULTIPLIER = 2; // resting doubles regen

export function initSurvival(shared) {
  const { agents, agentStore, saveJSON, ensureAgentStats, broadcast, addWorldNews, zones, awardXP } = shared;

  let weatherSystem = null;
  function setWeather(ws) { weatherSystem = ws; }

  function ensureEnergy(agent) {
    if (agent.energy === undefined) agent.energy = MAX_ENERGY;
    if (agent.lastEnergyTick === undefined) agent.lastEnergyTick = Date.now();
    if (agent.resting === undefined) agent.resting = false;
  }

  /** Get effective zone temperature accounting for weather */
  function getZoneTemperature(zone) {
    const base = ZONE_TEMPS[zone] ?? 22;
    if (!weatherSystem) return base;
    const w = weatherSystem.getCurrentWeather();
    const mod = WEATHER_TEMP_MOD[w?.id] ?? 0;
    return base + mod;
  }

  /** Extra energy cost from temperature extremes */
  function getTemperaturePenalty(zone) {
    const temp = getZoneTemperature(zone);
    if (temp < 10) return 2;
    if (temp > 32) return 1;
    return 0;
  }

  /** Regenerate energy based on elapsed game-hours */
  function tickEnergy(agent) {
    ensureEnergy(agent);
    const now = Date.now();
    // Game hour = 2.5 real minutes = 150000ms
    const GAME_HOUR_MS = 150000;
    const elapsed = now - agent.lastEnergyTick;
    const gameHours = Math.floor(elapsed / GAME_HOUR_MS);
    if (gameHours <= 0) return;

    const regenPerHour = agent.zone === 'grass' ? GARDEN_REGEN_PER_GAME_HOUR : ENERGY_REGEN_PER_GAME_HOUR;
    const mult = agent.resting ? REST_BONUS_MULTIPLIER : 1;
    const regen = gameHours * regenPerHour * mult;
    agent.energy = Math.min(MAX_ENERGY, agent.energy + regen);
    agent.lastEnergyTick = now;
  }

  /** Check and deduct energy for an action. Returns { ok, error, cost } */
  function deductEnergy(agent, action) {
    ensureEnergy(agent);
    tickEnergy(agent);

    const baseCost = ACTION_ENERGY_COST[action] ?? 0;
    if (baseCost === 0) return { ok: true, cost: 0 };

    const tempPenalty = getTemperaturePenalty(agent.zone);
    const totalCost = baseCost + tempPenalty;

    if (agent.energy < totalCost) {
      return { ok: false, error: `Not enough energy! Need ${totalCost}, have ${Math.floor(agent.energy)}. Rest or eat to recover.`, cost: totalCost };
    }

    agent.energy = Math.max(0, agent.energy - totalCost);
    agent.resting = false; // any action breaks rest
    return { ok: true, cost: totalCost };
  }

  /** Eat an organic item from inventory */
  function eat(agent, itemId) {
    ensureAgentStats(agent);
    ensureEnergy(agent);
    tickEnergy(agent);

    const idx = agent.inventory.findIndex(i => i.id === itemId);
    if (idx === -1) return { error: 'Item not in inventory' };

    const item = agent.inventory[idx];
    const props = item.properties;
    if (!props || (props.organic ?? 0) < 0.5) return { error: `${item.name} is not edible (organic < 0.5)` };

    const energyValue = props.energy ?? 0;
    const toxic = (props.toxicity ?? 0) > 5;

    // Consume
    if (item.stackable && item.quantity > 1) item.quantity--;
    else agent.inventory.splice(idx, 1);

    let effect;
    if (toxic) {
      const loss = Math.floor(energyValue * 0.5);
      agent.energy = Math.max(0, agent.energy - loss);
      effect = `Poisoned! Lost ${loss} energy from toxic ${item.name}! 🤢`;
      addWorldNews('survival', agent.id, agent.name, `${agent.name} ate toxic ${item.name} and got sick!`, agent.zone);
    } else {
      const oldEnergy = agent.energy;
      agent.energy = Math.min(MAX_ENERGY, agent.energy + energyValue);
      const gained = Math.floor(agent.energy - oldEnergy);
      effect = `Ate ${item.name}. +${gained} energy 🍽️`;
    }

    agentStore[agent.id] = agent;
    saveJSON('agents.json', agentStore);
    return { ok: true, effect, energy: Math.floor(agent.energy), item: item.name };
  }

  /** Start resting */
  function rest(agent) {
    ensureEnergy(agent);
    tickEnergy(agent);
    agent.resting = true;
    const regenRate = agent.zone === 'grass' ? GARDEN_REGEN_PER_GAME_HOUR * REST_BONUS_MULTIPLIER : ENERGY_REGEN_PER_GAME_HOUR * REST_BONUS_MULTIPLIER;
    agentStore[agent.id] = agent;
    saveJSON('agents.json', agentStore);
    return { ok: true, energy: Math.floor(agent.energy), resting: true, zone: agent.zone, regenRate, message: agent.zone === 'grass' ? 'Resting in the peaceful grasslands... 🌿' : 'Resting...' };
  }

  /** Get survival status for an agent */
  function getSurvivalStatus(agent) {
    ensureEnergy(agent);
    tickEnergy(agent);
    const temp = getZoneTemperature(agent.zone);
    const penalty = getTemperaturePenalty(agent.zone);
    return {
      energy: Math.floor(agent.energy),
      maxEnergy: MAX_ENERGY,
      resting: agent.resting || false,
      zone: agent.zone,
      temperature: temp,
      tempPenalty: penalty,
      exhausted: agent.energy <= 0,
    };
  }

  function setupRoutes(app, authAgent) {
    app.post('/api/agent/eat', authAgent, (req, res) => {
      const { item_id } = req.body;
      if (!item_id) return res.status(400).json({ error: 'item_id required' });
      const result = eat(req.agent, item_id);
      if (result.error) return res.status(400).json(result);
      res.json(result);
    });

    app.post('/api/agent/rest', authAgent, (req, res) => {
      const result = rest(req.agent);
      res.json(result);
    });

    app.get('/api/agent/:id/survival', (req, res) => {
      const agent = agents.get(req.params.id);
      if (!agent) return res.status(404).json({ error: 'Agent not found' });
      ensureAgentStats(agent);
      res.json(getSurvivalStatus(agent));
    });
  }

  return {
    setupRoutes,
    setWeather,
    ensureEnergy,
    tickEnergy,
    deductEnergy,
    eat,
    rest,
    getSurvivalStatus,
    getZoneTemperature,
    getTemperaturePenalty,
    ZONE_TEMPS,
    ACTION_ENERGY_COST,
    MAX_ENERGY,
  };
}
