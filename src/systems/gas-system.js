// Gas & Smoke Physics — Phase 2B
// Smoke drifts with wind. Toxic gas settles in caves. Agents take damage.

// Gas clouds on the map
// "x,y" → { type, density, windCarry, createdTick, toxicity }
const gasClouds = new Map();

const GAS_TYPES = {
  smoke: {
    color: [120, 120, 120],
    toxicity: 0,
    risesPerTick: 0.02,   // smoke rises and dissipates
    driftFactor: 1.0,      // moves with wind
    lifetime: 60,          // ticks
  },
  toxic: {
    color: [80, 180, 40],
    toxicity: 3,
    risesPerTick: -0.01,  // toxic gas sinks (settles in low areas)
    driftFactor: 0.3,      // barely moves
    lifetime: 120,
  },
  steam: {
    color: [200, 200, 220],
    toxicity: 0,
    risesPerTick: 0.04,
    driftFactor: 0.8,
    lifetime: 30,
  },
};

export function initGasSystem(shared) {
  const { broadcast, addWorldNews, agents } = shared;
  
  /**
   * Emit gas at a tile position.
   */
  function emitGas(type, tileX, tileY, density = 1.0) {
    const key = `${tileX},${tileY}`;
    const existing = gasClouds.get(key);
    if (existing && existing.type === type) {
      existing.density = Math.min(2, existing.density + density);
      return;
    }
    
    const gasDef = GAS_TYPES[type];
    if (!gasDef) return;
    
    gasClouds.set(key, {
      type,
      density,
      tileX, tileY,
      age: 0,
      maxAge: gasDef.lifetime,
      toxicity: gasDef.toxicity * density,
    });
  }
  
  /**
   * Tick gas physics — drift, dissipate, damage agents.
   */
  function tick(tickNum, weatherData) {
    if (tickNum % 3 !== 0) return; // every 1.5 seconds
    
    const windDir = (weatherData?.wind_direction ?? 180) * Math.PI / 180;
    const windSpeed = weatherData?.wind_speed ?? 5;
    const windDx = Math.sin(windDir) * windSpeed / 15;
    const windDy = -Math.cos(windDir) * windSpeed / 15;
    
    const toRemove = [];
    const toAdd = [];
    
    for (const [key, gas] of gasClouds) {
      gas.age++;
      
      // Dissipate
      const gasDef = GAS_TYPES[gas.type] || GAS_TYPES.smoke;
      gas.density -= gasDef.risesPerTick;
      gas.density -= 0.01; // base dissipation
      
      // Wind-blown rain clears gas faster
      if (weatherData?.condition === 'rain' || weatherData?.condition === 'storm') {
        gas.density -= 0.05;
      }
      
      if (gas.density <= 0.05 || gas.age >= gas.maxAge) {
        toRemove.push(key);
        continue;
      }
      
      // Drift with wind (chance to spawn adjacent cloud)
      if (Math.random() < gasDef.driftFactor * 0.1 * (windSpeed / 10)) {
        const nx = gas.tileX + Math.round(windDx + (Math.random() - 0.5));
        const ny = gas.tileY + Math.round(windDy + (Math.random() - 0.5));
        const nkey = `${nx},${ny}`;
        if (!gasClouds.has(nkey) && gas.density > 0.3) {
          toAdd.push({
            type: gas.type, tileX: nx, tileY: ny,
            density: gas.density * 0.4, age: gas.age,
            maxAge: gas.maxAge, toxicity: gas.toxicity * 0.4,
          });
          gas.density *= 0.7; // lose some density when spreading
        }
      }
    }
    
    for (const key of toRemove) gasClouds.delete(key);
    for (const g of toAdd) gasClouds.set(`${g.tileX},${g.tileY}`, g);
    
    // Cap total gas clouds
    if (gasClouds.size > 100) {
      let oldest = null, oldestKey = null;
      for (const [k, g] of gasClouds) {
        if (!oldest || g.age > oldest.age) { oldest = g; oldestKey = k; }
      }
      if (oldestKey) gasClouds.delete(oldestKey);
    }
    
    // Damage agents in toxic gas
    if (tickNum % 6 === 0) { // every 3 seconds
      for (const [id, agent] of agents) {
        if (!agent.alive) continue;
        const akey = `${agent.tileX},${agent.tileY}`;
        const gas = gasClouds.get(akey);
        if (gas && gas.toxicity > 0) {
          const dmg = Math.ceil(gas.toxicity * gas.density);
          if (dmg > 0) {
            agent.hp = Math.max(0, (agent.hp || 100) - dmg);
            if (agent.hp <= 0) {
              agent.alive = false;
              if (broadcast) {
                addWorldNews?.('death', agent.id, agent.name,
                  `${agent.name} was killed by toxic gas!`, agent.zone);
              }
            }
          }
        }
      }
    }
  }
  
  /**
   * Get gas clouds for frontend rendering.
   */
  function getGasClouds() {
    const clouds = [];
    for (const gas of gasClouds.values()) {
      clouds.push({
        tileX: gas.tileX, tileY: gas.tileY,
        type: gas.type, density: gas.density,
        color: GAS_TYPES[gas.type]?.color || [120,120,120],
      });
    }
    return clouds;
  }
  
  return { tick, emitGas, getGasClouds, gasClouds };
}

export { GAS_TYPES };
