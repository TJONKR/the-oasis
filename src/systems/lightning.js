// Lightning & Electricity — Phase 2B
// Lightning strikes during storms. Starts fires, charges crystals, kills agents.

export function initLightning(shared) {
  const { broadcast, addWorldNews, agents, worldGrid } = shared;
  
  // Track recent strikes for cooldown
  let lastStrikeTick = 0;
  const STRIKE_COOLDOWN = 40; // ticks between strikes
  
  /**
   * Tick lightning — only during storms.
   */
  function tick(tickNum, gameTime, weatherData) {
    if (!weatherData) return;
    const isStorm = weatherData.condition === 'storm';
    if (!isStorm) return;
    
    if (tickNum - lastStrikeTick < STRIKE_COOLDOWN) return;
    
    // 5% chance per tick during storms
    if (Math.random() > 0.05) return;
    
    // Pick a random location near agents (more dramatic)
    const aliveAgents = [...agents.values()].filter(a => a.alive);
    if (aliveAgents.length === 0) return;
    
    // 70% near an agent, 30% random
    let strikeX, strikeY;
    if (Math.random() < 0.7) {
      const target = aliveAgents[Math.floor(Math.random() * aliveAgents.length)];
      strikeX = target.tileX + Math.floor(Math.random() * 20 - 10);
      strikeY = target.tileY + Math.floor(Math.random() * 20 - 10);
    } else {
      const center = aliveAgents[0];
      strikeX = center.tileX + Math.floor(Math.random() * 60 - 30);
      strikeY = center.tileY + Math.floor(Math.random() * 60 - 30);
    }
    
    // Clamp to world
    strikeX = Math.max(0, Math.min(1999, strikeX));
    strikeY = Math.max(0, Math.min(1999, strikeY));
    
    lastStrikeTick = tickNum;
    
    // Visual effect
    if (broadcast) {
      broadcast({ type: 'lightning', tileX: strikeX, tileY: strikeY });
      broadcast({ type: 'tileEffect', effect: 'explosion', tileX: strikeX, tileY: strikeY, duration: 1500 });
    }
    
    // Effects at strike location:
    
    // 1. Start fire if flammable decoration
    const deco = worldGrid?.getDecoration?.(strikeX, strikeY);
    if (deco && [150, 151, 152, 155, 158].includes(deco.id)) {
      if (shared.temperature?.addWorldFire) {
        shared.temperature.addWorldFire(strikeX, strikeY, 180, 80, 'lightning');
      }
      addWorldNews?.('lightning', null, 'Nature',
        `⚡ Lightning struck a ${deco.name} at (${strikeX},${strikeY}), setting it ablaze!`, '');
    } else {
      addWorldNews?.('lightning', null, 'Nature',
        `⚡ Lightning struck at (${strikeX},${strikeY})!`, '');
    }
    
    // 2. Damage/charge nearby agents
    for (const [id, agent] of agents) {
      if (!agent.alive) continue;
      const dx = agent.tileX - strikeX;
      const dy = agent.tileY - strikeY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist <= 1) {
        // Direct hit — heavy damage
        const dmg = 30 + Math.floor(Math.random() * 20);
        agent.hp = Math.max(0, (agent.hp || 100) - dmg);
        
        // Charge conductive items in inventory
        chargeItems(agent);
        
        if (agent.hp <= 0) {
          agent.alive = false;
          addWorldNews?.('death', agent.id, agent.name,
            `⚡ ${agent.name} was struck by lightning and killed!`, agent.zone);
          if (shared.decayLifecycle?.onAgentDeath) {
            shared.decayLifecycle.onAgentDeath(agent);
          }
        } else {
          addWorldNews?.('lightning', agent.id, agent.name,
            `⚡ ${agent.name} was struck by lightning! (-${dmg} HP)`, agent.zone);
        }
      } else if (dist <= 4) {
        // Near miss — minor damage + charge
        const dmg = Math.floor(10 / dist);
        agent.hp = Math.max(1, (agent.hp || 100) - dmg);
        chargeItems(agent);
      }
    }
    
    // 3. Emit smoke
    if (shared.gasSystem?.emitGas) {
      shared.gasSystem.emitGas('smoke', strikeX, strikeY, 0.5);
    }
  }
  
  /**
   * Charge conductive items in an agent's inventory.
   * Crystals, metal items gain energy and temperature.
   */
  function chargeItems(agent) {
    if (!agent.inventory) return;
    for (const item of agent.inventory) {
      if (!item.properties) continue;
      if ((item.properties.conductivity || 0) >= 5) {
        item.properties.energy = (item.properties.energy || 0) + 20;
        item.properties.temperature = (item.properties.temperature || 20) + 50;
        item.properties.luminosity = Math.min(10, (item.properties.luminosity || 0) + 3);
        item._charged = true;
      }
    }
  }
  
  return { tick };
}
