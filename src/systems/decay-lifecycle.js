// Decay & Lifecycle System — Phase 2B
// Food rots, corpses decompose, mushrooms grow on decay.
// The circle of life in The Oasis.

import { MATERIAL_PROPERTIES, getProperties } from './materials.js';

// Items with decay_rate > 0 lose quality over time
// When quality hits 0, item transforms or is destroyed

// How many ticks before decay check (every 20 ticks = ~10 seconds)
const DECAY_INTERVAL = 20;

// Decay transforms — what items become when fully decayed
const DECAY_TRANSFORMS = {
  berries:     'Rotten Berries',
  fish:        'Rotten Fish',
  mushrooms:   'Rotten Mushrooms',
  herbs:       'Dried Herbs',  // herbs don't rot, they dry
  fruit:       'Rotten Fruit',
  nuts:        null, // nuts last forever basically
  coconuts:    'Rotten Coconut',
  seaweed:     'Dried Seaweed',
  flowers:     'Wilted Flowers',
  'Cooked Fish':      'Spoiled Fish',
  'Cooked Mushrooms': 'Spoiled Mushrooms',
  'Herbal Tea':       null, // evaporates, just remove
};

// Rotten material properties
const ROTTEN_MATERIALS = {
  'Rotten Berries':    { hardness: 0, conductivity: 0, flammability: 1, toxicity: 3, luminosity: 0, volatility: 1, organic: 1, weight: 0.05, decay_rate: 0.5, energy: -5, temperature: 20, resonance: 0, melt_point: 0, ignition: 0, sharpness: 0, solubility: 3, malleability: 0, brittleness: 0, fertility: 6 },
  'Rotten Fish':       { hardness: 0, conductivity: 0, flammability: 1, toxicity: 5, luminosity: 0, volatility: 3, organic: 1, weight: 0.7, decay_rate: 0.6, energy: -10, temperature: 20, resonance: 0, melt_point: 0, ignition: 0, sharpness: 0, solubility: 2, malleability: 0, brittleness: 0, fertility: 7 },
  'Rotten Mushrooms':  { hardness: 0, conductivity: 0, flammability: 1, toxicity: 4, luminosity: 1, volatility: 2, organic: 1, weight: 0.05, decay_rate: 0.5, energy: -5, temperature: 20, resonance: 0, melt_point: 0, ignition: 0, sharpness: 0, solubility: 2, malleability: 0, brittleness: 0, fertility: 8 },
  'Rotten Fruit':      { hardness: 0, conductivity: 0, flammability: 1, toxicity: 2, luminosity: 0, volatility: 2, organic: 1, weight: 0.1, decay_rate: 0.4, energy: -3, temperature: 20, resonance: 0, melt_point: 0, ignition: 0, sharpness: 0, solubility: 4, malleability: 0, brittleness: 0, fertility: 7 },
  'Rotten Coconut':    { hardness: 2, conductivity: 0, flammability: 2, toxicity: 2, luminosity: 0, volatility: 1, organic: 1, weight: 1.2, decay_rate: 0.3, energy: -5, temperature: 20, resonance: 0, melt_point: 0, ignition: 0, sharpness: 0, solubility: 1, malleability: 0, brittleness: 4, fertility: 5 },
  'Dried Herbs':       { hardness: 1, conductivity: 0, flammability: 6, toxicity: 0, luminosity: 0, volatility: 1, organic: 1, weight: 0.02, decay_rate: 0.01, energy: 8, temperature: 20, resonance: 1, melt_point: 0, ignition: 140, sharpness: 0, solubility: 5, malleability: 0, brittleness: 3, fertility: 2 },
  'Dried Seaweed':     { hardness: 1, conductivity: 0, flammability: 3, toxicity: 0, luminosity: 0, volatility: 0, organic: 1, weight: 0.03, decay_rate: 0.02, energy: 10, temperature: 20, resonance: 0, melt_point: 0, ignition: 180, sharpness: 0, solubility: 4, malleability: 1, brittleness: 3, fertility: 2 },
  'Wilted Flowers':    { hardness: 0, conductivity: 0, flammability: 5, toxicity: 0, luminosity: 0, volatility: 0, organic: 1, weight: 0.03, decay_rate: 0.3, energy: 1, temperature: 20, resonance: 1, melt_point: 0, ignition: 130, sharpness: 0, solubility: 2, malleability: 0, brittleness: 1, fertility: 5 },
  'Spoiled Fish':      { hardness: 0, conductivity: 0, flammability: 1, toxicity: 6, luminosity: 0, volatility: 4, organic: 1, weight: 0.5, decay_rate: 0.7, energy: -15, temperature: 20, resonance: 0, melt_point: 0, ignition: 0, sharpness: 0, solubility: 1, malleability: 0, brittleness: 0, fertility: 8 },
  'Spoiled Mushrooms': { hardness: 0, conductivity: 0, flammability: 1, toxicity: 7, luminosity: 0, volatility: 3, organic: 1, weight: 0.04, decay_rate: 0.6, energy: -10, temperature: 20, resonance: 0, melt_point: 0, ignition: 0, sharpness: 0, solubility: 2, malleability: 0, brittleness: 0, fertility: 9 },
  'Corpse':            { hardness: 1, conductivity: 1, flammability: 2, toxicity: 5, luminosity: 0, volatility: 3, organic: 1, weight: 30, decay_rate: 0.8, energy: 0, temperature: 20, resonance: 0, melt_point: 0, ignition: 200, sharpness: 0, solubility: 0, malleability: 0, brittleness: 2, fertility: 0 },
  'Bones':             { hardness: 5, conductivity: 0, flammability: 1, toxicity: 0, luminosity: 0, volatility: 0, organic: 0.5, weight: 2, decay_rate: 0.01, energy: 0, temperature: 20, resonance: 1, melt_point: 0, ignition: 0, sharpness: 2, solubility: 1, malleability: 0, brittleness: 6, fertility: 4 },
};

// Ground items — items that exist on tiles (dropped, corpses, etc.)
// Map of "x,y" → [{ item, dropTick, decayProgress }]
const groundItems = new Map();

export function initDecayLifecycle(shared) {
  const { broadcast, addWorldNews, agents, agentStore, saveJSON, loadJSON } = shared;
  
  // Register rotten material properties
  for (const [name, props] of Object.entries(ROTTEN_MATERIALS)) {
    if (!MATERIAL_PROPERTIES[name]) MATERIAL_PROPERTIES[name] = props;
  }
  
  /**
   * Tick decay for all agents' inventories.
   */
  function tickInventoryDecay(tick) {
    if (tick % DECAY_INTERVAL !== 0) return;
    
    for (const [id, agent] of agents) {
      if (!agent.alive || !agent.inventory) continue;
      
      const toRemove = [];
      for (let i = 0; i < agent.inventory.length; i++) {
        const item = agent.inventory[i];
        if (!item.properties) continue;
        
        const decayRate = item.properties.decay_rate || 0;
        if (decayRate <= 0.02) continue; // practically immortal
        
        // Initialize decay progress
        if (item._decayProgress === undefined) item._decayProgress = 0;
        
        // Advance decay — rate affected by temperature
        const tempFactor = Math.max(0.5, 1 + (item.properties.temperature - 20) / 100);
        item._decayProgress += decayRate * tempFactor * 0.1;
        
        if (item._decayProgress >= 1) {
          // Item has fully decayed
          const transform = DECAY_TRANSFORMS[item.name];
          if (transform === null) {
            // Item destroyed
            toRemove.push(i);
          } else if (transform) {
            const oldName = item.name;
            item.name = transform;
            item._decayProgress = 0;
            item._reacted = true;
            const newProps = ROTTEN_MATERIALS[transform] || getProperties(transform);
            if (newProps) item.properties = { ...newProps };
            
            if (broadcast) {
              addWorldNews?.('decay', agent.id, agent.name,
                `${agent.name}'s ${oldName} rotted into ${transform}`, agent.zone);
            }
          } else {
            // No transform defined, just mark as decayed
            item._decayProgress = 0.9; // slow it down, don't loop
          }
        }
      }
      
      // Remove destroyed items
      for (let i = toRemove.length - 1; i >= 0; i--) {
        agent.inventory.splice(toRemove[i], 1);
      }
    }
  }
  
  /**
   * Handle agent death — drop inventory and create corpse on ground.
   * P0 Fix: Ensure death is properly handled with inventory drop.
   */
  function onAgentDeath(agent) {
    if (!agent) return;

    // Ensure agent is marked dead
    agent.alive = false;
    agent.hp = 0;

    const key = `${agent.tileX},${agent.tileY}`;
    if (!groundItems.has(key)) groundItems.set(key, []);

    // Drop ALL inventory on ground
    const droppedCount = (agent.inventory || []).length;
    for (const item of (agent.inventory || [])) {
      groundItems.get(key).push({
        item: { ...item },
        dropTick: shared.tick || 0,
        decayProgress: 0
      });
    }

    // Clear agent's inventory after dropping
    agent.inventory = [];

    // Create corpse
    groundItems.get(key).push({
      item: {
        name: 'Corpse',
        type: 'organic',
        description: `The remains of ${agent.name}. Will decompose over time.`,
        properties: { ...ROTTEN_MATERIALS['Corpse'] },
        originAgent: agent.name,
      },
      dropTick: shared.tick || 0,
      decayProgress: 0,
    });

    if (broadcast) {
      broadcast({ type: 'tileEffect', effect: 'smoke', tileX: agent.tileX, tileY: agent.tileY, duration: 3000 });
      broadcast({ type: 'agent_death', agentId: agent.id, name: agent.name, tileX: agent.tileX, tileY: agent.tileY });
    }
    if (addWorldNews) {
      const deathMsg = droppedCount > 0
        ? `${agent.name} has died. Their body and ${droppedCount} items lie at (${agent.tileX}, ${agent.tileY})`
        : `${agent.name} has died. Their body lies at (${agent.tileX}, ${agent.tileY})`;
      addWorldNews('death', agent.id, agent.name, deathMsg, agent.zone);
    }

    console.log(`💀 Agent ${agent.name} died at (${agent.tileX}, ${agent.tileY}), dropped ${droppedCount} items`);
  }
  
  /**
   * Handle animal death — create animal corpse on ground (nutrient cycle).
   */
  function onAnimalDeath(animal, species) {
    if (!animal || !species) return;
    
    const key = `${animal.tileX},${animal.tileY}`;
    if (!groundItems.has(key)) groundItems.set(key, []);
    
    // Create animal corpse (smaller than agent corpse)
    const corpseSize = Math.max(0.5, species.hp / 20); // larger animals = more corpse mass
    groundItems.get(key).push({
      item: {
        name: 'Animal Corpse',
        type: 'organic',
        description: `The remains of a ${animal.species} ${species.emoji}. Will decompose and enrich the soil.`,
        properties: {
          ...ROTTEN_MATERIALS['Corpse'],
          weight: corpseSize * 5,
          decay_rate: 0.6, // animals decay faster than agent corpses
          fertility: Math.round(corpseSize * 3), // larger animals = more nutrients
        },
        originSpecies: animal.species,
      },
      dropTick: shared.tick || 0,
      decayProgress: 0,
    });
    
    if (broadcast) {
      broadcast({ type: 'tileEffect', effect: 'blood', tileX: animal.tileX, tileY: animal.tileY, duration: 2000 });
      addWorldNews?.('death', null, 'Nature', `A ${animal.species} ${species.emoji} has died at (${animal.tileX}, ${animal.tileY}). Nature will reclaim it.`, '');
    }
  }
  
  /**
   * Tick ground items — decay them, transform corpses to bones/compost.
   */
  function tickGroundItems(tick) {
    if (tick % DECAY_INTERVAL !== 0) return;
    
    for (const [key, items] of groundItems) {
      const toRemove = [];
      for (let i = 0; i < items.length; i++) {
        const entry = items[i];
        const decayRate = entry.item.properties?.decay_rate || 0.1;
        entry.decayProgress += decayRate * 0.15; // ground items decay 50% faster
        
        if (entry.decayProgress >= 1) {
          if (entry.item.name === 'Corpse' || entry.item.name === 'Animal Corpse') {
            // Corpse → Bones + Compost
            entry.item.name = 'Bones';
            entry.item.properties = { ...ROTTEN_MATERIALS['Bones'] };
            entry.decayProgress = 0;
            
            // Also spawn compost (more for larger animal corpses)
            const compostAmount = entry.item.name === 'Animal Corpse' ? 
              (entry.item.properties?.fertility || 8) : 8;
            items.push({
              item: {
                name: 'Compost',
                type: 'material',
                properties: { fertility: compostAmount, organic: 1, decay_rate: 0.1, weight: 1 },
              },
              dropTick: tick,
              decayProgress: 0,
            });
            
            const [x, y] = key.split(',').map(Number);
            
            // Update ecosystem soil fertility (nutrient cycle connection!)
            if (shared.ecosystem?.onCompost) {
              const zone = shared.worldGrid?.getZone?.(x, y) || 'grass';
              shared.ecosystem.onCompost(zone, { fertility: compostAmount });
            }
            
            if (broadcast) {
              addWorldNews?.('decay', null, 'Nature', `A corpse at (${x},${y}) has decomposed into bones and compost, enriching the soil`, '');
            }
          } else if (entry.item.name === 'Bones') {
            // Bones last a very long time, don't remove
            entry.decayProgress = 0.9;
          } else if (entry.item.properties?.fertility > 3) {
            // Fertile remains enrich the soil directly, then disappear
            const [x, y] = key.split(',').map(Number);
            if (shared.ecosystem?.onCompost) {
              const zone = shared.worldGrid?.getZone?.(x, y) || 'grass';
              shared.ecosystem.onCompost(zone, entry.item);
            }
            toRemove.push(i);
          } else {
            toRemove.push(i);
          }
        }
      }
      
      for (let i = toRemove.length - 1; i >= 0; i--) {
        items.splice(toRemove[i], 1);
      }
      
      if (items.length === 0) groundItems.delete(key);
    }
  }
  
  /**
   * Check if a tile has fertile ground items (compost, rotten stuff).
   */
  function getTileFertility(tileX, tileY) {
    const key = `${tileX},${tileY}`;
    const items = groundItems.get(key);
    if (!items) return 0;
    return items.reduce((sum, e) => sum + (e.item.properties?.fertility || 0), 0);
  }
  
  /**
   * Get ground items at a tile (for agent pickup).
   */
  function getGroundItems(tileX, tileY) {
    const key = `${tileX},${tileY}`;
    return groundItems.get(key) || [];
  }
  
  function tick(tickNum) {
    tickInventoryDecay(tickNum);
    tickGroundItems(tickNum);
  }
  
  return { tick, onAgentDeath, onAnimalDeath, getTileFertility, getGroundItems, groundItems };
}

export { DECAY_TRANSFORMS, ROTTEN_MATERIALS };
