// Collective Building Projects — Community-driven zone improvements
// Agents propose, fund with materials, and maintain shared infrastructure.

import crypto from 'crypto';

const GAME_DAY_MS = 60 * 60 * 1000; // 1 real hour = 1 game day

const VALID_ZONES = ['grass', 'forest', 'rocky', 'path', 'sand', 'cave', 'coast', 'swamp'];

const PROJECT_TYPES = {
  bridge: {
    name: 'Bridge',
    description: 'Connects two zones, eliminating movement energy cost between them.',
    materials: {
      'Wooden Plank': 20,
      'Nails': 10,
      'Iron Ore': 5,
    },
    effect: { type: 'free_movement', detail: 'Movement between connected zones costs 0 energy' },
    buildTime: 1, // game days
  },
  monument: {
    name: 'Monument',
    description: 'Zone-wide XP buff for all agents.',
    materials: {
      'Crystal': 10,
      'Gemstone': 5,
      'Iron Ore': 15,
    },
    effect: { type: 'xp_buff', multiplier: 1.25, detail: '+25% XP gain in zone' },
    buildTime: 1,
  },
  granary: {
    name: 'Granary',
    description: 'Shared food storage accessible to all agents in the zone.',
    materials: {
      'Wooden Plank': 25,
      'Nails': 10,
      'Fabric Scrap': 5,
    },
    effect: { type: 'shared_storage', slots: 10, detail: 'Zone gets shared food chest (10 slots)' },
    buildTime: 1,
  },
  workshop_upgrade: {
    name: 'Workshop Upgrade',
    description: 'Reduces crafting energy cost for all agents in the zone.',
    materials: {
      'Gear': 10,
      'Wire': 10,
      'Circuit Board': 5,
    },
    effect: { type: 'craft_discount', multiplier: 0.75, detail: '-25% craft energy cost in zone' },
    buildTime: 1,
  },
  library_expansion: {
    name: 'Library Expansion',
    description: 'Increases book storage capacity in the zone.',
    materials: {
      'Ancient Scroll': 15,
      'Ink Vial': 10,
      'Quill Feather': 5,
    },
    effect: { type: 'book_slots', bonus: 5, detail: '+5 book slots' },
    buildTime: 1,
  },
  watchtower: {
    name: 'Watchtower',
    description: 'Reveals resource levels of adjacent zones.',
    materials: {
      'Wooden Plank': 15,
      'Iron Ore': 5,
      'Crystal': 3,
    },
    effect: { type: 'reveal_adjacent', detail: 'Shows resource levels of adjacent zones' },
    buildTime: 1,
  },
};

// In V3 tile world, adjacency is physical (neighboring tiles).
// This map is kept as a simplified terrain-type affinity for bridge/watchtower effects.
const ZONE_ADJACENCY = {
  grass:  ['forest', 'path', 'rocky'],
  forest: ['grass', 'swamp', 'rocky'],
  cave:   ['rocky'],
  rocky:  ['grass', 'forest', 'cave'],
  path:   ['grass', 'sand', 'coast'],
  sand:   ['path', 'coast'],
  coast:  ['sand', 'path', 'swamp'],
  swamp:  ['forest', 'coast'],
};

export function initCollectiveProjects(shared) {
  const {
    loadJSON, saveJSON, agents, agentStore,
    ensureAgentStats, broadcast, addWorldNews,
    zones, awardXP, economyV2,
  } = shared;

  let data = loadJSON('collective-projects.json', { projects: [], completed: [] });

  function save() {
    saveJSON('collective-projects.json', data);
  }

  // ==================== HELPERS ====================

  function findProject(projectId) {
    return data.projects.find(p => p.id === projectId) || null;
  }

  function getAgent(agentOrId) {
    if (typeof agentOrId === 'object' && agentOrId !== null) return agentOrId;
    return agents.get(agentOrId) || null;
  }

  /** Calculate remaining materials for a project */
  function calcRemaining(project) {
    const typeDef = PROJECT_TYPES[project.projectType];
    if (!typeDef) return {};
    const remaining = {};
    for (const [mat, needed] of Object.entries(typeDef.materials)) {
      const contributed = project.materialsContributed[mat] || 0;
      const left = needed - contributed;
      if (left > 0) remaining[mat] = left;
    }
    return remaining;
  }

  /** Check whether all materials have been met */
  function isMaterialsComplete(project) {
    const remaining = calcRemaining(project);
    return Object.keys(remaining).length === 0;
  }

  /** Compute maintenance cost (20% of original, rounded up) */
  function maintenanceCost(projectType) {
    const typeDef = PROJECT_TYPES[projectType];
    if (!typeDef) return {};
    const cost = {};
    for (const [mat, qty] of Object.entries(typeDef.materials)) {
      cost[mat] = Math.ceil(qty * 0.2);
    }
    return cost;
  }

  /** Remove items from an agent's inventory. Returns true on success. */
  function removeItems(agent, itemName, quantity) {
    const idx = agent.inventory.findIndex(i => i.name === itemName);
    if (idx === -1) return false;
    const item = agent.inventory[idx];
    const available = item.quantity || 1;
    if (available < quantity) return false;

    if (item.stackable && available > quantity) {
      item.quantity -= quantity;
    } else if (available === quantity) {
      agent.inventory.splice(idx, 1);
    } else {
      return false;
    }
    return true;
  }

  /** Count how many of an item an agent has */
  function countItem(agent, itemName) {
    const item = agent.inventory.find(i => i.name === itemName);
    return item ? (item.quantity || 1) : 0;
  }

  // ==================== PROPOSE ====================

  function propose(agent, projectType, zone) {
    agent = getAgent(agent);
    if (!agent) return { ok: false, error: 'Agent not found' };
    ensureAgentStats(agent);

    // Validate project type
    if (!PROJECT_TYPES[projectType]) {
      return { ok: false, error: `Unknown project type: ${projectType}. Valid types: ${Object.keys(PROJECT_TYPES).join(', ')}` };
    }

    // Validate zone
    if (!VALID_ZONES.includes(zone)) {
      return { ok: false, error: `Invalid zone: ${zone}` };
    }

    // Level requirement
    if ((agent.stats.level || 1) < 5) {
      return { ok: false, error: 'Must be at least level 5 to propose a project' };
    }

    // Coin deposit
    if ((agent.coins || 0) < 50) {
      return { ok: false, error: 'Proposing a project costs 50 coins deposit. Not enough coins.' };
    }

    // One active project per zone
    const activeInZone = data.projects.find(
      p => p.zone === zone && (p.status === 'gathering' || p.status === 'building')
    );
    if (activeInZone) {
      return { ok: false, error: `Zone "${zone}" already has an active project: ${activeInZone.name}` };
    }

    // Deduct deposit
    agent.coins -= 50;

    const typeDef = PROJECT_TYPES[projectType];
    const project = {
      id: 'proj_' + crypto.randomBytes(6).toString('hex'),
      projectType,
      name: typeDef.name,
      description: typeDef.description,
      zone,
      status: 'gathering', // gathering -> building -> completed -> decaying -> removed
      proposedBy: agent.id,
      proposedByName: agent.name,
      proposedAt: Date.now(),
      materialsRequired: { ...typeDef.materials },
      materialsContributed: {},
      contributors: {}, // { agentId: { name, items: { itemName: qty } } }
      buildStartedAt: null,
      completedAt: null,
      lastMaintenanceAt: null,
      decayStage: 0, // 0 = healthy, 1 = decayed (50% effect), 2 = removed
      effect: { ...typeDef.effect },
    };

    data.projects.push(project);
    save();

    // Persist agent coins
    if (agentStore[agent.id]) agentStore[agent.id] = agent;
    saveJSON('agents.json', agentStore);

    broadcast({
      type: 'projectProposed',
      agentId: agent.id,
      agentName: agent.name,
      projectId: project.id,
      projectName: project.name,
      zone,
    });

    addWorldNews(
      'collective_project',
      agent.id,
      agent.name,
      `${agent.name} proposed a new ${typeDef.name} project in ${zone}!`,
      zone
    );

    return { ok: true, project };
  }

  // ==================== CONTRIBUTE ====================

  function contribute(agent, projectId, itemName, quantity) {
    agent = getAgent(agent);
    if (!agent) return { ok: false, error: 'Agent not found' };
    ensureAgentStats(agent);

    if (!quantity || quantity < 1) {
      return { ok: false, error: 'Quantity must be at least 1' };
    }
    quantity = Math.floor(quantity);

    const project = findProject(projectId);
    if (!project) return { ok: false, error: 'Project not found' };

    if (project.status !== 'gathering') {
      return { ok: false, error: `Project is not accepting contributions (status: ${project.status})` };
    }

    // Agent must be in the same zone
    if (agent.zone !== project.zone) {
      return { ok: false, error: `You must be in ${project.zone} to contribute (currently in ${agent.zone})` };
    }

    // Check this material is actually needed
    const typeDef = PROJECT_TYPES[project.projectType];
    const required = typeDef.materials[itemName];
    if (required === undefined) {
      return { ok: false, error: `${itemName} is not needed for this project. Required: ${Object.keys(typeDef.materials).join(', ')}` };
    }

    const alreadyContributed = project.materialsContributed[itemName] || 0;
    const stillNeeded = required - alreadyContributed;
    if (stillNeeded <= 0) {
      return { ok: false, error: `${itemName} requirement already fulfilled` };
    }

    // Cap contribution to what's still needed
    const actualQty = Math.min(quantity, stillNeeded);

    // Check agent has enough
    const available = countItem(agent, itemName);
    if (available < actualQty) {
      return { ok: false, error: `Not enough ${itemName}. Have: ${available}, need to contribute: ${actualQty}` };
    }

    // Remove from inventory
    if (!removeItems(agent, itemName, actualQty)) {
      return { ok: false, error: `Failed to remove ${itemName} from inventory` };
    }

    // Track contribution
    project.materialsContributed[itemName] = alreadyContributed + actualQty;

    if (!project.contributors[agent.id]) {
      project.contributors[agent.id] = { name: agent.name, items: {} };
    }
    project.contributors[agent.id].items[itemName] =
      (project.contributors[agent.id].items[itemName] || 0) + actualQty;

    // Persist agent
    if (agentStore[agent.id]) agentStore[agent.id] = agent;
    saveJSON('agents.json', agentStore);

    // Award XP for contributing
    awardXP(agent, 5 * actualQty, 'project_contribution');

    // Check if all materials met
    let completed = false;
    if (isMaterialsComplete(project)) {
      project.status = 'building';
      project.buildStartedAt = Date.now();
      completed = true;

      broadcast({
        type: 'projectBuildStarted',
        projectId: project.id,
        projectName: project.name,
        zone: project.zone,
      });

      addWorldNews(
        'collective_project',
        agent.id,
        agent.name,
        `The ${project.name} in ${project.zone} has all materials and construction has begun!`,
        project.zone
      );
    }

    save();

    const remaining = calcRemaining(project);

    return {
      ok: true,
      contributed: { item: itemName, quantity: actualQty },
      remaining,
      completed: completed || undefined,
    };
  }

  // ==================== TICK ====================

  function tickProjects() {
    const now = Date.now();
    let changed = false;

    for (const project of data.projects) {
      // Building -> Completed
      if (project.status === 'building' && project.buildStartedAt) {
        const typeDef = PROJECT_TYPES[project.projectType];
        const buildDuration = (typeDef?.buildTime || 1) * GAME_DAY_MS;
        if (now - project.buildStartedAt >= buildDuration) {
          project.status = 'completed';
          project.completedAt = now;
          project.lastMaintenanceAt = now;
          project.decayStage = 0;

          // Award XP to all contributors
          for (const [contributorId, contrib] of Object.entries(project.contributors)) {
            const contributorAgent = agents.get(contributorId);
            if (contributorAgent) {
              awardXP(contributorAgent, 50, 'project_completed');
            }
          }

          // Refund proposer deposit
          const proposer = agents.get(project.proposedBy);
          if (proposer) {
            proposer.coins = (proposer.coins || 0) + 50;
            if (agentStore[proposer.id]) agentStore[proposer.id] = proposer;
          }

          broadcast({
            type: 'projectCompleted',
            projectId: project.id,
            projectName: project.name,
            zone: project.zone,
            effect: project.effect,
          });

          addWorldNews(
            'collective_project',
            project.proposedBy,
            project.proposedByName,
            `The ${project.name} in ${project.zone} has been completed! Effect: ${project.effect.detail}`,
            project.zone
          );

          changed = true;
        }
      }

      // Completed -> maintenance check
      if (project.status === 'completed' && project.lastMaintenanceAt) {
        const daysSinceMaintenance = (now - project.lastMaintenanceAt) / GAME_DAY_MS;

        // After 60 game days without maintenance: remove
        if (daysSinceMaintenance >= 60 && project.decayStage < 2) {
          project.decayStage = 2;
          project.status = 'removed';

          broadcast({
            type: 'projectRemoved',
            projectId: project.id,
            projectName: project.name,
            zone: project.zone,
          });

          addWorldNews(
            'collective_project',
            null,
            'World',
            `The ${project.name} in ${project.zone} has crumbled from neglect and been removed.`,
            project.zone
          );

          // Move to completed archive
          data.completed.push({ ...project, removedAt: now });
          changed = true;

        // After 30 game days without maintenance: decay stage 1
        } else if (daysSinceMaintenance >= 30 && project.decayStage < 1) {
          project.decayStage = 1;

          broadcast({
            type: 'projectDecaying',
            projectId: project.id,
            projectName: project.name,
            zone: project.zone,
            decayStage: 1,
          });

          addWorldNews(
            'collective_project',
            null,
            'World',
            `The ${project.name} in ${project.zone} is deteriorating! It needs maintenance materials (20% of build cost) or it will be lost.`,
            project.zone
          );

          changed = true;
        }
      }
    }

    // Remove projects that have been moved to completed archive
    data.projects = data.projects.filter(p => p.status !== 'removed');

    if (changed) {
      save();
      saveJSON('agents.json', agentStore);
    }
  }

  // ==================== QUERIES ====================

  function getProjectsInZone(zone) {
    return data.projects.filter(p => p.zone === zone).map(p => ({
      ...p,
      remaining: p.status === 'gathering' ? calcRemaining(p) : {},
      maintenanceCost: p.status === 'completed' ? maintenanceCost(p.projectType) : {},
      contributorCount: Object.keys(p.contributors).length,
    }));
  }

  function getProjectEffects(zone) {
    const effects = [];
    const activeProjects = data.projects.filter(
      p => p.zone === zone && p.status === 'completed'
    );

    for (const project of activeProjects) {
      const effect = { ...project.effect };

      // Apply decay reduction
      if (project.decayStage >= 1) {
        if (effect.multiplier !== undefined) {
          // For buffs like xp_buff (1.25 -> 1.125) or craft_discount (0.75 -> 0.875)
          if (effect.multiplier > 1) {
            effect.multiplier = 1 + (effect.multiplier - 1) * 0.5;
          } else {
            effect.multiplier = 1 - (1 - effect.multiplier) * 0.5;
          }
        }
        if (effect.slots !== undefined) {
          effect.slots = Math.floor(effect.slots * 0.5);
        }
        if (effect.bonus !== undefined) {
          effect.bonus = Math.floor(effect.bonus * 0.5);
        }
        effect.decayed = true;
      }

      effects.push({
        projectId: project.id,
        projectName: project.name,
        projectType: project.projectType,
        ...effect,
      });
    }

    return effects;
  }

  function getAllProjects() {
    return data.projects.map(p => ({
      ...p,
      remaining: p.status === 'gathering' ? calcRemaining(p) : {},
      maintenanceCost: p.status === 'completed' ? maintenanceCost(p.projectType) : {},
      contributorCount: Object.keys(p.contributors).length,
    }));
  }

  // ==================== RETURN ====================

  return {
    propose,
    contribute,
    tickProjects,
    getProjectsInZone,
    getProjectEffects,
    getAllProjects,
    PROJECT_TYPES,
  };
}
