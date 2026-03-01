/**
 * wildlife.js — Animals, Predators & Prey
 * 
 * Brings the world to life with autonomous wildlife:
 * - Prey animals: food source, flee from agents/predators
 * - Predators: hunt prey AND agents, territory-based, real danger
 * - Ambient wildlife: birds, insects (atmosphere, no interaction)
 * 
 * Animals have simple behavior: wander, flee, hunt, rest
 * They spawn in biome-appropriate zones and persist on the map.
 */

// ── SPECIES DEFINITIONS ──
const SPECIES = {
  // PREY — food sources, flee from threats
  rabbit: {
    type: 'prey', hp: 15, speed: 2, damage: 0,
    zones: ['grass', 'forest', 'plains'],
    drops: [{ name: 'raw_meat', qty: 1 }, { name: 'fur', qty: 1 }],
    fleeRange: 8, groupSize: [2, 4], spawnWeight: 5,
    emoji: '🐇',
  },
  deer: {
    type: 'prey', hp: 30, speed: 2, damage: 0,
    zones: ['grass', 'forest', 'plains'],
    drops: [{ name: 'raw_meat', qty: 3 }, { name: 'hide', qty: 1 }, { name: 'bone', qty: 1 }],
    fleeRange: 12, groupSize: [2, 5], spawnWeight: 3,
    emoji: '🦌',
  },
  fish_school: {
    type: 'prey', hp: 10, speed: 1, damage: 0,
    zones: ['coast', 'river', 'lake'],
    drops: [{ name: 'fish', qty: 2 }],
    fleeRange: 4, groupSize: [1, 1], spawnWeight: 6,
    emoji: '🐟',
  },
  boar: {
    type: 'prey', hp: 40, speed: 1, damage: 5,  // fights back!
    zones: ['forest', 'grass'],
    drops: [{ name: 'raw_meat', qty: 4 }, { name: 'tusks', qty: 1 }, { name: 'hide', qty: 1 }],
    fleeRange: 5, groupSize: [1, 3], spawnWeight: 2,
    emoji: '🐗',
  },

  // PREDATORS — hunt prey AND agents, real threat
  wolf: {
    type: 'predator', hp: 50, speed: 2, damage: 12,
    zones: ['forest', 'grass', 'plains', 'rocky'],
    drops: [{ name: 'fur', qty: 2 }, { name: 'fangs', qty: 1 }],
    huntRange: 15, aggroRange: 10, groupSize: [2, 5], spawnWeight: 2,
    emoji: '🐺',
    packHunter: true, // bonus damage per pack member nearby
  },
  bear: {
    type: 'predator', hp: 120, speed: 1, damage: 25,
    zones: ['forest', 'mountain', 'cave', 'rocky'],
    drops: [{ name: 'raw_meat', qty: 5 }, { name: 'hide', qty: 2 }, { name: 'bone', qty: 2 }, { name: 'bear_claw', qty: 1 }],
    huntRange: 8, aggroRange: 6, groupSize: [1, 1], spawnWeight: 1,
    emoji: '🐻',
    territorial: true, // attacks anything that enters territory
  },
  snake: {
    type: 'predator', hp: 20, speed: 1, damage: 15,
    zones: ['sand', 'desert', 'grass', 'swamp'],
    drops: [{ name: 'venom_sac', qty: 1 }, { name: 'snake_skin', qty: 1 }],
    huntRange: 3, aggroRange: 3, groupSize: [1, 2], spawnWeight: 3,
    emoji: '🐍',
    venomous: true, // poison damage over time
  },
  mountain_lion: {
    type: 'predator', hp: 60, speed: 3, damage: 18,
    zones: ['mountain', 'rocky', 'cave', 'forest'],
    drops: [{ name: 'raw_meat', qty: 3 }, { name: 'hide', qty: 1 }, { name: 'fangs', qty: 1 }],
    huntRange: 12, aggroRange: 8, groupSize: [1, 1], spawnWeight: 1,
    emoji: '🦁',
    ambush: true, // first attack does double damage
  },
  crocodile: {
    type: 'predator', hp: 80, speed: 1, damage: 20,
    zones: ['swamp', 'river', 'coast'],
    drops: [{ name: 'raw_meat', qty: 4 }, { name: 'tough_hide', qty: 1 }, { name: 'bone', qty: 2 }],
    huntRange: 5, aggroRange: 4, groupSize: [1, 2], spawnWeight: 1,
    emoji: '🐊',
  },

  // AMBIENT — atmosphere, no real interaction
  eagle: {
    type: 'ambient', hp: 20, speed: 3, damage: 0,
    zones: ['mountain', 'rocky', 'plains', 'coast'],
    drops: [{ name: 'feather', qty: 2 }],
    fleeRange: 20, groupSize: [1, 2], spawnWeight: 2,
    emoji: '🦅',
  },
};

// Drop properties for animal-sourced items
const ANIMAL_DROP_PROPERTIES = {
  raw_meat:   { hardness: 0, conductivity: 0, flammability: 3, toxicity: 0, luminosity: 0, volatility: 0, organic: 1, weight: 1, decay_rate: 0.3, energy: 30, temperature: 20, resonance: 0, melt_point: 0, ignition: 250, sharpness: 0, solubility: 0, malleability: 0, brittleness: 0, fertility: 0 },
  fur:        { hardness: 1, conductivity: 0, flammability: 4, toxicity: 0, luminosity: 0, volatility: 0, organic: 1, weight: 0.5, decay_rate: 0.05, energy: 0, temperature: 20, resonance: 0, melt_point: 0, ignition: 200, sharpness: 0, solubility: 0, malleability: 6, brittleness: 1, fertility: 0 },
  hide:       { hardness: 3, conductivity: 0, flammability: 3, toxicity: 0, luminosity: 0, volatility: 0, organic: 1, weight: 2, decay_rate: 0.02, energy: 0, temperature: 20, resonance: 0, melt_point: 0, ignition: 250, sharpness: 0, solubility: 0, malleability: 5, brittleness: 2, fertility: 0 },
  tough_hide: { hardness: 5, conductivity: 0, flammability: 2, toxicity: 0, luminosity: 0, volatility: 0, organic: 1, weight: 3, decay_rate: 0.01, energy: 0, temperature: 20, resonance: 0, melt_point: 0, ignition: 300, sharpness: 0, solubility: 0, malleability: 3, brittleness: 3, fertility: 0 },
  bone:       { hardness: 6, conductivity: 0, flammability: 0, toxicity: 0, luminosity: 0, volatility: 0, organic: 0.5, weight: 0.5, decay_rate: 0, energy: 0, temperature: 20, resonance: 0, melt_point: 800, ignition: 0, sharpness: 3, solubility: 0, malleability: 1, brittleness: 5, fertility: 1 },
  fangs:      { hardness: 7, conductivity: 0, flammability: 0, toxicity: 0, luminosity: 0, volatility: 0, organic: 0.5, weight: 0.1, decay_rate: 0, energy: 0, temperature: 20, resonance: 0, melt_point: 800, ignition: 0, sharpness: 8, solubility: 0, malleability: 0, brittleness: 4, fertility: 0 },
  tusks:      { hardness: 7, conductivity: 0, flammability: 0, toxicity: 0, luminosity: 0, volatility: 0, organic: 0.5, weight: 1, decay_rate: 0, energy: 0, temperature: 20, resonance: 0, melt_point: 900, ignition: 0, sharpness: 5, solubility: 0, malleability: 1, brittleness: 3, fertility: 0 },
  venom_sac:  { hardness: 0, conductivity: 1, flammability: 1, toxicity: 8, luminosity: 1, volatility: 3, organic: 1, weight: 0.1, decay_rate: 0.1, energy: 0, temperature: 20, resonance: 2, melt_point: 0, ignition: 0, sharpness: 0, solubility: 7, malleability: 0, brittleness: 0, fertility: 0 },
  snake_skin: { hardness: 2, conductivity: 0, flammability: 3, toxicity: 0, luminosity: 0, volatility: 0, organic: 1, weight: 0.2, decay_rate: 0.02, energy: 0, temperature: 20, resonance: 0, melt_point: 0, ignition: 200, sharpness: 0, solubility: 0, malleability: 7, brittleness: 1, fertility: 0 },
  bear_claw:  { hardness: 7, conductivity: 0, flammability: 0, toxicity: 0, luminosity: 0, volatility: 0, organic: 0.5, weight: 0.2, decay_rate: 0, energy: 0, temperature: 20, resonance: 0, melt_point: 800, ignition: 0, sharpness: 7, solubility: 0, malleability: 0, brittleness: 3, fertility: 0 },
  feather:    { hardness: 0, conductivity: 0, flammability: 5, toxicity: 0, luminosity: 0, volatility: 0, organic: 1, weight: 0.01, decay_rate: 0.01, energy: 0, temperature: 20, resonance: 1, melt_point: 0, ignition: 150, sharpness: 0, solubility: 0, malleability: 2, brittleness: 1, fertility: 0 },
};

const MAX_ANIMALS = 80;       // world cap
const SPAWN_INTERVAL = 50;    // ticks between spawn attempts
const ANIMAL_TICK_INTERVAL = 2; // animals move every N ticks (lighter than agents)

export function initWildlife(shared) {
  const animals = new Map(); // id → animal
  const { worldGrid, agents, broadcast, addWorldNews } = shared;

  let nextId = 1;

  function createAnimal(speciesName, x, y) {
    const species = SPECIES[speciesName];
    if (!species) return null;

    const id = `animal_${nextId++}`;
    const animal = {
      id,
      species: speciesName,
      type: species.type,
      tileX: x, tileY: y,
      hp: species.hp,
      maxHp: species.hp,
      alive: true,
      state: 'idle', // idle, wandering, fleeing, hunting, resting
      target: null,   // what they're fleeing from or hunting
      emoji: species.emoji,
      spawnTick: shared.tick || 0,
      lastMoveTick: 0,
      restTicks: 0,
    };

    animals.set(id, animal);
    return animal;
  }

  // ── SPAWN ──
  function trySpawn() {
    if (animals.size >= MAX_ANIMALS) return;

    // Pick a random species weighted by spawnWeight
    const speciesList = Object.entries(SPECIES);
    const totalWeight = speciesList.reduce((s, [, sp]) => s + sp.spawnWeight, 0);
    let roll = Math.random() * totalWeight;
    let chosenName = speciesList[0][0];
    for (const [name, sp] of speciesList) {
      roll -= sp.spawnWeight;
      if (roll <= 0) { chosenName = name; break; }
    }

    const species = SPECIES[chosenName];

    // Pick a random valid zone tile
    const validZones = species.zones;
    let x, y, zone, attempts = 0;
    do {
      x = Math.floor(Math.random() * (worldGrid.width || 2000));
      y = Math.floor(Math.random() * (worldGrid.height || 2000));
      zone = worldGrid.getZone?.(x, y);
      attempts++;
    } while (attempts < 50 && (!zone || !validZones.includes(zone)));

    if (!zone || !validZones.includes(zone)) return;

    // Spawn group
    const [minGroup, maxGroup] = species.groupSize;
    const groupSize = minGroup + Math.floor(Math.random() * (maxGroup - minGroup + 1));

    for (let i = 0; i < groupSize; i++) {
      const ox = x + Math.floor(Math.random() * 5 - 2);
      const oy = y + Math.floor(Math.random() * 5 - 2);
      const tile = worldGrid.getTile?.(ox, oy);
      if (tile && tile.walkable) {
        createAnimal(chosenName, ox, oy);
      }
    }
  }

  // ── ANIMAL AI ──
  function tickAnimal(animal, currentTick) {
    if (!animal.alive) return;

    const species = SPECIES[animal.species];
    if (!species) return;

    // Rest cooldown
    if (animal.restTicks > 0) {
      animal.restTicks--;
      animal.state = 'resting';
      return;
    }

    if (species.type === 'prey') tickPrey(animal, species, currentTick);
    else if (species.type === 'predator') tickPredator(animal, species, currentTick);
    else tickAmbient(animal, species);
  }

  function tickPrey(animal, species, currentTick) {
    // Check for nearby threats (agents and predators)
    const threat = findNearestThreat(animal, species.fleeRange);

    if (threat) {
      // FLEE — move away from threat
      animal.state = 'fleeing';
      const dx = animal.tileX - threat.x;
      const dy = animal.tileY - threat.y;
      const dist = Math.max(1, Math.abs(dx) + Math.abs(dy));
      const fleeX = animal.tileX + Math.round(dx / dist * species.speed);
      const fleeY = animal.tileY + Math.round(dy / dist * species.speed);
      moveAnimal(animal, fleeX, fleeY, species.speed);
    } else if (Math.random() < 0.3) {
      // WANDER
      animal.state = 'wandering';
      const wx = animal.tileX + Math.floor(Math.random() * 7 - 3);
      const wy = animal.tileY + Math.floor(Math.random() * 7 - 3);
      moveAnimal(animal, wx, wy, 1);
    } else {
      animal.state = 'idle';
    }
  }

  function tickPredator(animal, species, currentTick) {
    // Check for nearby agents to attack
    const nearestAgent = findNearestAgent(animal, species.aggroRange);

    if (nearestAgent) {
      const dist = Math.abs(nearestAgent.tileX - animal.tileX) + Math.abs(nearestAgent.tileY - animal.tileY);

      if (dist <= 1) {
        // ATTACK!
        animal.state = 'attacking';
        let dmg = species.damage;

        // Ambush bonus (first strike)
        if (species.ambush && !animal._hasAttacked) {
          dmg *= 2;
          animal._hasAttacked = true;
        }

        // Pack bonus
        if (species.packHunter) {
          const packNearby = [...animals.values()].filter(a =>
            a.alive && a.species === animal.species && a.id !== animal.id &&
            Math.abs(a.tileX - animal.tileX) + Math.abs(a.tileY - animal.tileY) <= 3
          ).length;
          dmg += packNearby * 3; // +3 damage per pack member
        }

        // Apply damage
        nearestAgent.hp = Math.max(0, (nearestAgent.hp || 100) - dmg);

        // Venom — apply poison status
        if (species.venomous) {
          if (!nearestAgent._poison) nearestAgent._poison = 0;
          nearestAgent._poison += 3; // 3 ticks of poison
        }

        // News
        addWorldNews?.('attack', animal.id, species.emoji + ' ' + animal.species,
          `A ${animal.species} attacked ${nearestAgent.name} for ${dmg} damage!`,
          worldGrid.getZone?.(animal.tileX, animal.tileY) || 'wild');

        // After attack, rest briefly
        animal.restTicks = 3;
      } else {
        // HUNT — move toward agent
        animal.state = 'hunting';
        moveAnimal(animal, nearestAgent.tileX, nearestAgent.tileY, species.speed);
      }
    } else {
      // Check for prey
      const nearestPrey = findNearestPrey(animal, species.huntRange);
      if (nearestPrey) {
        const dist = Math.abs(nearestPrey.tileX - animal.tileX) + Math.abs(nearestPrey.tileY - animal.tileY);
        if (dist <= 1) {
          // Kill prey
          nearestPrey.hp = 0;
          nearestPrey.alive = false;
          animal.restTicks = 10; // rest after eating
          animal.state = 'resting';
        } else {
          animal.state = 'hunting';
          moveAnimal(animal, nearestPrey.tileX, nearestPrey.tileY, species.speed);
        }
      } else if (Math.random() < 0.2) {
        // Wander
        animal.state = 'wandering';
        const wx = animal.tileX + Math.floor(Math.random() * 9 - 4);
        const wy = animal.tileY + Math.floor(Math.random() * 9 - 4);
        moveAnimal(animal, wx, wy, 1);
      } else {
        animal.state = 'idle';
      }
    }
  }

  function tickAmbient(animal, species) {
    if (Math.random() < 0.15) {
      const wx = animal.tileX + Math.floor(Math.random() * 11 - 5);
      const wy = animal.tileY + Math.floor(Math.random() * 11 - 5);
      moveAnimal(animal, wx, wy, species.speed);
      animal.state = 'wandering';
    } else {
      animal.state = 'idle';
    }
  }

  // ── MOVEMENT ──
  function moveAnimal(animal, targetX, targetY, speed) {
    for (let step = 0; step < speed; step++) {
      const dx = Math.sign(targetX - animal.tileX);
      const dy = Math.sign(targetY - animal.tileY);
      if (dx === 0 && dy === 0) break;

      // Try main direction, then fallback
      const candidates = [];
      if (dx !== 0 && dy !== 0) candidates.push([dx, dy], [dx, 0], [0, dy]);
      else if (dx !== 0) candidates.push([dx, 0], [dx, 1], [dx, -1]);
      else candidates.push([0, dy], [1, dy], [-1, dy]);

      let moved = false;
      for (const [mx, my] of candidates) {
        const nx = animal.tileX + mx;
        const ny = animal.tileY + my;
        const tile = worldGrid.getTile?.(nx, ny);
        if (tile && tile.walkable) {
          animal.tileX = nx;
          animal.tileY = ny;
          moved = true;
          break;
        }
      }
      if (!moved) break;
    }
  }

  // ── DETECTION ──
  function findNearestThreat(animal, range) {
    let nearest = null;
    let nearestDist = range + 1;

    // Agents are threats to prey
    for (const [, agent] of agents) {
      if (!agent.alive) continue;
      const d = Math.abs(agent.tileX - animal.tileX) + Math.abs(agent.tileY - animal.tileY);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = { x: agent.tileX, y: agent.tileY, type: 'agent' };
      }
    }

    // Predators are also threats to prey
    for (const [, other] of animals) {
      if (!other.alive || other.id === animal.id) continue;
      const otherSpecies = SPECIES[other.species];
      if (otherSpecies?.type !== 'predator') continue;
      const d = Math.abs(other.tileX - animal.tileX) + Math.abs(other.tileY - animal.tileY);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = { x: other.tileX, y: other.tileY, type: 'predator' };
      }
    }

    return nearest;
  }

  function findNearestAgent(animal, range) {
    let nearest = null;
    let nearestDist = range + 1;

    for (const [, agent] of agents) {
      if (!agent.alive) continue;
      const d = Math.abs(agent.tileX - animal.tileX) + Math.abs(agent.tileY - animal.tileY);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = agent;
      }
    }

    return nearest;
  }

  function findNearestPrey(animal, range) {
    let nearest = null;
    let nearestDist = range + 1;

    for (const [, other] of animals) {
      if (!other.alive || other.id === animal.id) continue;
      const otherSpecies = SPECIES[other.species];
      if (otherSpecies?.type !== 'prey') continue;
      const d = Math.abs(other.tileX - animal.tileX) + Math.abs(other.tileY - animal.tileY);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = other;
      }
    }

    return nearest;
  }

  // ── COMBAT (agent attacks animal) ──
  function attackAnimal(agent, animalId) {
    const animal = animals.get(animalId);
    if (!animal || !animal.alive) return null;

    const species = SPECIES[animal.species];
    if (!species) return null;

    // Agent damage based on weapon/tools
    let agentDmg = 10; // base fist damage
    const weapon = agent.inventory?.find(i => 
      i.name === 'stone_axe' || i.name === 'spear' || i.name === 'knife' ||
      (i.properties?.sharpness >= 5)
    );
    if (weapon) agentDmg += (weapon.properties?.sharpness || 0) * 3;

    animal.hp = Math.max(0, animal.hp - agentDmg);

    // Animal fights back (if it has damage)
    let counterDmg = 0;
    if (species.damage > 0 && animal.hp > 0) {
      counterDmg = species.damage;
      agent.hp = Math.max(0, (agent.hp || 100) - counterDmg);
    }

    const killed = animal.hp <= 0;
    if (killed) {
      animal.alive = false;

      // Drop items on the ground or into agent inventory
      const drops = [];
      for (const drop of species.drops) {
        const item = {
          name: drop.name,
          quantity: drop.qty,
          properties: { ...(ANIMAL_DROP_PROPERTIES[drop.name] || {}) },
        };
        
        if (agent.inventory && agent.inventory.length < 20) {
          const existing = agent.inventory.find(i => i.name === drop.name);
          if (existing && (existing.quantity || 1) < 20) {
            existing.quantity = (existing.quantity || 1) + drop.qty;
          } else {
            agent.inventory.push(item);
          }
          drops.push(drop.name);
        }
      }

      addWorldNews?.('hunt', agent.id, agent.name,
        `${agent.name} hunted a ${animal.species} ${species.emoji} and got: ${drops.join(', ')}`,
        worldGrid.getZone?.(animal.tileX, animal.tileY) || 'wild');
    }

    return { killed, agentDmg, counterDmg, drops: killed ? species.drops : [] };
  }

  // ── POISON TICK ──
  function tickPoison(agent) {
    if (!agent._poison || agent._poison <= 0) return;
    agent.hp = Math.max(0, (agent.hp || 100) - 2); // 2 HP/tick poison
    agent._poison--;
    if (agent._poison <= 0) delete agent._poison;
  }

  // ── MAIN TICK ──
  function tick(currentTick) {
    // Spawn new animals periodically
    if (currentTick % SPAWN_INTERVAL === 0) {
      trySpawn();
    }

    // Tick each animal (at reduced rate)
    if (currentTick % ANIMAL_TICK_INTERVAL !== 0) return;

    // Clean up dead animals (after 100 ticks)
    for (const [id, animal] of animals) {
      if (!animal.alive && currentTick - (animal._deathTick || currentTick) > 100) {
        animals.delete(id);
      }
      if (!animal.alive && !animal._deathTick) {
        animal._deathTick = currentTick;
      }
    }

    for (const [, animal] of animals) {
      if (!animal.alive) continue;
      tickAnimal(animal, currentTick);
    }

    // Tick poison on agents
    for (const [, agent] of agents) {
      if (!agent.alive) continue;
      tickPoison(agent);
    }
  }

  // ── QUERY ──
  function getAnimalsNear(x, y, range) {
    const result = [];
    for (const [, animal] of animals) {
      if (!animal.alive) continue;
      const d = Math.abs(animal.tileX - x) + Math.abs(animal.tileY - y);
      if (d <= range) {
        result.push({
          id: animal.id,
          species: animal.species,
          type: animal.type,
          tileX: animal.tileX,
          tileY: animal.tileY,
          hp: animal.hp,
          maxHp: animal.maxHp,
          state: animal.state,
          emoji: SPECIES[animal.species]?.emoji || '?',
          distance: d,
        });
      }
    }
    return result;
  }

  function getAll() {
    return [...animals.values()].filter(a => a.alive).map(a => ({
      id: a.id, species: a.species, type: SPECIES[a.species]?.type,
      tileX: a.tileX, tileY: a.tileY, hp: a.hp, maxHp: a.maxHp,
      state: a.state, emoji: SPECIES[a.species]?.emoji,
    }));
  }

  function getStats() {
    const alive = [...animals.values()].filter(a => a.alive);
    const bySpecies = {};
    for (const a of alive) {
      bySpecies[a.species] = (bySpecies[a.species] || 0) + 1;
    }
    return {
      total: alive.length,
      max: MAX_ANIMALS,
      bySpecies,
      predators: alive.filter(a => SPECIES[a.species]?.type === 'predator').length,
      prey: alive.filter(a => SPECIES[a.species]?.type === 'prey').length,
      ambient: alive.filter(a => SPECIES[a.species]?.type === 'ambient').length,
    };
  }

  // ── API ROUTES ──
  function setupRoutes(app) {
    app.get('/api/wildlife', (req, res) => res.json(getStats()));
    app.get('/api/wildlife/all', (req, res) => res.json(getAll()));
    app.get('/api/wildlife/near/:x/:y', (req, res) => {
      const x = parseInt(req.params.x), y = parseInt(req.params.y);
      const range = parseInt(req.query.range) || 20;
      res.json(getAnimalsNear(x, y, range));
    });
  }

  return {
    tick,
    getAnimalsNear,
    getAll,
    getStats,
    attackAnimal,
    setupRoutes,
    animals,
    SPECIES,
    ANIMAL_DROP_PROPERTIES,
  };
}
