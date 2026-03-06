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
  // Death & Decomposition cycle: Remains → Decaying Remains → Bones + Rich Soil
  'Remains':           { hardness: 1, conductivity: 1, flammability: 2, toxicity: 3, luminosity: 0, volatility: 2, organic: 1, weight: 30, decay_rate: 0.4, energy: 0, temperature: 20, resonance: 0, melt_point: 0, ignition: 200, sharpness: 0, solubility: 0, malleability: 0, brittleness: 2, fertility: 5 },
  'Decaying Remains':  { hardness: 0, conductivity: 0, flammability: 1, toxicity: 6, luminosity: 0, volatility: 4, organic: 1, weight: 20, decay_rate: 0.5, energy: 0, temperature: 20, resonance: 0, melt_point: 0, ignition: 0, sharpness: 0, solubility: 1, malleability: 0, brittleness: 1, fertility: 12 },
  'Corpse':            { hardness: 1, conductivity: 1, flammability: 2, toxicity: 5, luminosity: 0, volatility: 3, organic: 1, weight: 30, decay_rate: 0.4, energy: 0, temperature: 20, resonance: 0, melt_point: 0, ignition: 200, sharpness: 0, solubility: 0, malleability: 0, brittleness: 2, fertility: 0 },
  'Bones':             { hardness: 5, conductivity: 0, flammability: 1, toxicity: 0, luminosity: 0, volatility: 0, organic: 0.5, weight: 2, decay_rate: 0.01, energy: 0, temperature: 20, resonance: 1, melt_point: 0, ignition: 0, sharpness: 2, solubility: 1, malleability: 0, brittleness: 6, fertility: 4 },
  // Rich Soil — long-lasting fertility boost from decomposed remains
  'Rich Soil':         { hardness: 1, conductivity: 0, flammability: 0, toxicity: 0, luminosity: 0, volatility: 0, organic: 0.8, weight: 5, decay_rate: 0.02, energy: 0, temperature: 20, resonance: 0, melt_point: 0, ignition: 0, sharpness: 0, solubility: 2, malleability: 1, brittleness: 0, fertility: 15 },
};

// Ground items — items that exist on tiles (dropped, corpses, etc.)
// Map of "x,y" → [{ item, dropTick, decayProgress }]
const groundItems = new Map();

// Structure durability constants
const STRUCTURE_DECAY_INTERVAL = 100; // ticks between durability checks
const STRUCTURE_MAX_DURABILITY = 100;
const WEATHER_DURABILITY_DAMAGE = {
  clear: 0, sunny: 0, cloudy: 0.1, rain: 0.5, storm: 1.5, fog: 0.2, wind: 0.3,
};

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

    // Create remains (first stage of decomposition cycle)
    groundItems.get(key).push({
      item: {
        name: 'Remains',
        type: 'organic',
        description: `The remains of ${agent.name}. Will decompose over time, enriching the soil.`,
        properties: { ...ROTTEN_MATERIALS['Remains'] },
        originAgent: agent.name,
        decompositionStage: 0, // 0 = fresh, 1 = decaying, 2 = bones
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
        ? `${agent.name} has died. Their remains and ${droppedCount} items lie at (${agent.tileX}, ${agent.tileY}). They will decompose and enrich the soil.`
        : `${agent.name} has died. Their remains lie at (${agent.tileX}, ${agent.tileY}). They will decompose and enrich the soil.`;
      addWorldNews('death', agent.id, agent.name, deathMsg, agent.zone);
    }

    console.log(`💀 Agent ${agent.name} died at (${agent.tileX}, ${agent.tileY}), dropped ${droppedCount} items`);
  }
  
  /**
   * Handle animal death — create animal remains on ground (nutrient cycle).
   */
  function onAnimalDeath(animal, species) {
    if (!animal || !species) return;

    const key = `${animal.tileX},${animal.tileY}`;
    if (!groundItems.has(key)) groundItems.set(key, []);

    // Create animal remains (smaller than agent remains, faster decay)
    const corpseSize = Math.max(0.5, species.hp / 20); // larger animals = more corpse mass
    const fertilityBonus = Math.round(corpseSize * 4); // larger animals = more nutrients
    groundItems.get(key).push({
      item: {
        name: 'Remains',
        type: 'organic',
        description: `The remains of a ${animal.species} ${species.emoji}. Will decompose and enrich the soil.`,
        properties: {
          ...ROTTEN_MATERIALS['Remains'],
          weight: corpseSize * 5,
          decay_rate: 0.5, // animals decay slightly faster
          fertility: fertilityBonus,
        },
        originSpecies: animal.species,
        decompositionStage: 0,
      },
      dropTick: shared.tick || 0,
      decayProgress: 0,
    });

    if (broadcast) {
      broadcast({ type: 'tileEffect', effect: 'blood', tileX: animal.tileX, tileY: animal.tileY, duration: 2000 });
      addWorldNews?.('death', null, 'Nature',
        `A ${animal.species} ${species.emoji} has died at (${animal.tileX}, ${animal.tileY}). Nature will reclaim it.`, '');
    }
  }
  
  /**
   * Tick ground items — decay them, transform remains through decomposition stages.
   * Death → Decomposition → Fertile Soil → Better Growth → More Food (nutrient cycle)
   */
  function tickGroundItems(tick) {
    if (tick % DECAY_INTERVAL !== 0) return;

    for (const [key, items] of groundItems) {
      const toRemove = [];
      const [x, y] = key.split(',').map(Number);

      for (let i = 0; i < items.length; i++) {
        const entry = items[i];
        const decayRate = entry.item.properties?.decay_rate || 0.1;
        entry.decayProgress += decayRate * 0.15; // ground items decay 50% faster

        if (entry.decayProgress >= 1) {
          const itemName = entry.item.name;

          // ═══ REMAINS DECOMPOSITION CYCLE ═══
          // Stage 0: Fresh Remains → Stage 1: Decaying Remains
          if (itemName === 'Remains' && (entry.item.decompositionStage || 0) === 0) {
            entry.item.name = 'Decaying Remains';
            entry.item.description = `Decaying remains. The soil grows darker and richer here.`;
            entry.item.properties = { ...ROTTEN_MATERIALS['Decaying Remains'] };
            entry.item.decompositionStage = 1;
            entry.decayProgress = 0;

            if (broadcast) {
              addWorldNews?.('decay', null, 'Nature',
                `Remains at (${x},${y}) are decomposing, releasing nutrients into the soil.`, '');
            }
          }
          // Stage 1: Decaying Remains → Stage 2: Bones + Rich Soil
          else if (itemName === 'Decaying Remains') {
            entry.item.name = 'Bones';
            entry.item.description = `Weathered bones. A reminder of what once was.`;
            entry.item.properties = { ...ROTTEN_MATERIALS['Bones'] };
            entry.item.decompositionStage = 2;
            entry.decayProgress = 0;

            // Create Rich Soil — long-lasting fertility boost
            items.push({
              item: {
                name: 'Rich Soil',
                type: 'material',
                description: 'Dark, nutrient-rich soil from decomposed remains. Plants grow faster here.',
                properties: { ...ROTTEN_MATERIALS['Rich Soil'] },
              },
              dropTick: tick,
              decayProgress: 0,
            });

            // Zone-level fertility boost (nutrient cycle!)
            const zone = shared.worldGrid?.getZone?.(x, y) || 'grass';
            if (shared.ecosystem?.onCompost) {
              shared.ecosystem.onCompost(zone, { fertility: 12 }); // significant boost
            }

            if (broadcast) {
              broadcast({ type: 'tileEffect', effect: 'sparkle', tileX: x, tileY: y, duration: 2000 });
              addWorldNews?.('decay', null, 'Nature',
                `Remains at (${x},${y}) have fully decomposed into bones and rich soil. The land is now more fertile.`, '');
            }
          }
          // Legacy Corpse handling (backwards compatibility)
          else if (itemName === 'Corpse' || itemName === 'Animal Corpse') {
            // Convert to new Remains system
            entry.item.name = 'Decaying Remains';
            entry.item.properties = { ...ROTTEN_MATERIALS['Decaying Remains'] };
            entry.item.decompositionStage = 1;
            entry.decayProgress = 0;
          }
          // Bones last a very long time, don't remove
          else if (itemName === 'Bones') {
            entry.decayProgress = 0.9;
          }
          // Rich Soil eventually gets absorbed into the ground
          else if (itemName === 'Rich Soil') {
            // Final stage: Rich Soil disappears but permanently boosts zone fertility
            const zone = shared.worldGrid?.getZone?.(x, y) || 'grass';
            if (shared.ecosystem?.onCompost) {
              shared.ecosystem.onCompost(zone, { fertility: 5 }); // additional permanent boost
            }
            toRemove.push(i);

            if (broadcast) {
              addWorldNews?.('decay', null, 'Nature',
                `Rich soil at (${x},${y}) has been absorbed into the earth, permanently enriching the land.`, '');
            }
          }
          // Compost (from organic growth fire ash, etc.)
          else if (itemName === 'Compost' || (entry.item.properties?.fertility || 0) > 3) {
            const zone = shared.worldGrid?.getZone?.(x, y) || 'grass';
            if (shared.ecosystem?.onCompost) {
              shared.ecosystem.onCompost(zone, entry.item);
            }
            toRemove.push(i);
          }
          // Other items just disappear
          else {
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
  
  /**
   * Tick structure durability — structures degrade over time and need maintenance.
   * Weather damages structures, especially rain and storms.
   */
  function tickStructureDurability(tick) {
    if (tick % STRUCTURE_DECAY_INTERVAL !== 0) return;

    const weather = shared.weather?.getCurrentWeather?.() || {};
    const weatherDamage = WEATHER_DURABILITY_DAMAGE[weather.id || weather.condition] || 0;

    for (const [key, items] of groundItems) {
      const toRemove = [];
      const [x, y] = key.split(',').map(Number);

      for (let i = 0; i < items.length; i++) {
        const entry = items[i];
        if (!entry.isStructure && !entry.item.isStructure) continue;

        // Initialize durability if not set
        if (entry.durability === undefined) {
          entry.durability = STRUCTURE_MAX_DURABILITY;
        }

        // Weather damage + natural wear
        const baseDamage = 0.1; // natural wear per interval
        entry.durability -= (baseDamage + weatherDamage);

        // Check if structure is destroyed
        if (entry.durability <= 0) {
          toRemove.push(i);
          if (broadcast) {
            addWorldNews?.('decay', null, 'Nature',
              `A ${entry.item.name} at (${x},${y}) has collapsed from disrepair.`, '');
            broadcast({ type: 'tileEffect', effect: 'smoke', tileX: x, tileY: y, duration: 2000 });
          }
        } else if (entry.durability <= 25 && !entry._warnedLow) {
          // Warn when durability is low
          entry._warnedLow = true;
          if (addWorldNews) {
            addWorldNews('warning', null, 'World',
              `A ${entry.item.name} at (${x},${y}) is in poor condition and needs maintenance.`, '');
          }
        }
      }

      // Remove destroyed structures
      for (let i = toRemove.length - 1; i >= 0; i--) {
        items.splice(toRemove[i], 1);
      }

      if (items.length === 0) groundItems.delete(key);
    }
  }

  /**
   * Get structures near a tile position.
   * Returns array of { structure, distance, tileX, tileY }
   */
  function getNearbyStructures(tileX, tileY, range = 5) {
    const results = [];

    for (const [key, items] of groundItems) {
      const [x, y] = key.split(',').map(Number);
      const dist = Math.abs(x - tileX) + Math.abs(y - tileY);
      if (dist > range) continue;

      for (const entry of items) {
        if (!entry.isStructure && !entry.item.isStructure) continue;
        results.push({
          structure: entry.item,
          durability: entry.durability ?? STRUCTURE_MAX_DURABILITY,
          distance: dist,
          tileX: x,
          tileY: y,
        });
      }
    }

    return results.sort((a, b) => a.distance - b.distance);
  }

  /**
   * Calculate structure benefits for an agent based on nearby structures.
   * Returns { shelterBonus, warmthBonus, storageBonus, lightBonus }
   */
  function getStructureBenefits(tileX, tileY) {
    const nearby = getNearbyStructures(tileX, tileY, 3); // structures work within 3 tiles

    let shelterBonus = 0;
    let warmthBonus = 0;
    let storageBonus = 0;
    let lightBonus = 0;

    for (const { structure, distance, durability } of nearby) {
      // Benefits scale with durability (max when 100, half at 50, etc.)
      const durabilityFactor = Math.max(0, durability / STRUCTURE_MAX_DURABILITY);
      // Benefits fall off with distance
      const distanceFactor = 1 - (distance / 4); // 100% at 0, 75% at 1, 50% at 2, 25% at 3
      const effectFactor = durabilityFactor * distanceFactor;

      const props = structure.structureProperties || structure.properties || {};

      // Shelter reduces weather damage (rain, storm damage)
      shelterBonus = Math.max(shelterBonus, (props.shelter || 0) * effectFactor);
      // Warmth provides temperature bonus
      warmthBonus = Math.max(warmthBonus, (props.warmth || 0) * effectFactor);
      // Storage expands inventory capacity
      storageBonus = Math.max(storageBonus, (props.storage || 0) * effectFactor);
      // Light affects vision and morale at night
      lightBonus = Math.max(lightBonus, (props.luminosity || 0) * effectFactor);
    }

    return {
      shelterBonus: Math.round(shelterBonus),
      warmthBonus: Math.round(warmthBonus),
      storageBonus: Math.round(storageBonus / 10), // storage 100 = +10 inventory slots
      lightBonus: Math.round(lightBonus),
    };
  }

  /**
   * Repair a structure by an agent. Requires materials.
   */
  function repairStructure(agent, tileX, tileY) {
    const key = `${tileX},${tileY}`;
    const items = groundItems.get(key);
    if (!items) return { ok: false, reason: 'No structures here' };

    const structureEntry = items.find(e => e.isStructure || e.item.isStructure);
    if (!structureEntry) return { ok: false, reason: 'No structures here' };

    if ((structureEntry.durability ?? 100) >= STRUCTURE_MAX_DURABILITY) {
      return { ok: false, reason: 'Structure is already in perfect condition' };
    }

    // Require wood or fiber for repairs
    const repairMat = agent.inventory?.find(i =>
      ['wood', 'fiber', 'reeds', 'palm_fronds', 'driftwood'].includes(i.name)
    );
    if (!repairMat) {
      return { ok: false, reason: 'Need wood or fiber to repair' };
    }

    // Consume material
    if (repairMat.quantity > 1) repairMat.quantity--;
    else agent.inventory = agent.inventory.filter(i => i !== repairMat);

    // Repair
    structureEntry.durability = Math.min(STRUCTURE_MAX_DURABILITY, (structureEntry.durability || 0) + 25);
    structureEntry._warnedLow = false; // reset warning

    return {
      ok: true,
      structure: structureEntry.item.name,
      durability: structureEntry.durability,
      materialUsed: repairMat.name,
    };
  }

  function tick(tickNum) {
    tickInventoryDecay(tickNum);
    tickGroundItems(tickNum);
    tickStructureDurability(tickNum);
  }

  return {
    tick,
    onAgentDeath,
    onAnimalDeath,
    getTileFertility,
    getGroundItems,
    groundItems,
    getNearbyStructures,
    getStructureBenefits,
    repairStructure,
    STRUCTURE_MAX_DURABILITY,
  };
}

export { DECAY_TRANSFORMS, ROTTEN_MATERIALS };
