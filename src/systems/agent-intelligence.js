// Agent Intelligence V2 - The system that makes every agent feel alive
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const DATA_DIR = process.env.RAILWAY_ENVIRONMENT ? '/app/data' : './data';

function loadJSON(file, fallback = {}) {
  const path = join(DATA_DIR, file);
  if (!existsSync(path)) return fallback;
  try { 
    return JSON.parse(readFileSync(path, 'utf8')); 
  } catch { 
    return fallback; 
  }
}

function saveJSON(file, data) {
  writeFileSync(join(DATA_DIR, file), JSON.stringify(data, null, 2));
}

// Personality trait definitions and their behavioral effects
const PERSONALITY_TRAITS = {
  curious: { gather: +15, chat: +10, move: +5 },
  cautious: { gather: -10, move: -15, rest: +20 },
  bold: { gather: +20, move: +10, trade: +5 },
  generous: { trade: +10, gift: +25, chat: +5 },
  greedy: { trade: +20, sell: +15, gift: -20 },
  social: { chat: +20, trade: +10, move: +5 },
  solitary: { chat: -15, move: +10, gather: +10 },
  competitive: { craft: +10, trade: +5, gather: +5 },
  nurturing: { gift: +15, chat: +10, rest: +5 },
  creative: { craft: +20, experiment: +15, chat: +5 },
  stubborn: { rest: +10 }, // tendency to stick with current goal
  adaptable: { move: +10 } // tendency to switch goals more easily
};

const TEMPERAMENTS = ['calm', 'hot-headed', 'impulsive', 'methodical', 'thoughtful', 'restless'];

const AMBITION_TEMPLATES = [
  "become the greatest {domain} master",
  "discover all the secrets of {zone}",
  "build the most prosperous trading empire",
  "unlock the mysteries of the ancient signals",
  "become the most respected teacher",
  "master every craft and recipe",
  "explore every corner of the world",
  "build lasting friendships with everyone"
];

// NPC personality mappings based on descriptions
const NPC_PERSONALITIES = {
  Ember: { traits: ['bold', 'stubborn'], values: ['craftsmanship', 'discovery'], temperament: 'methodical' },
  Sage: { traits: ['curious', 'nurturing'], values: ['knowledge', 'wisdom'], temperament: 'thoughtful' },
  Coral: { traits: ['creative', 'generous'], values: ['beauty', 'harmony'], temperament: 'calm' },
  Flint: { traits: ['greedy', 'competitive'], values: ['wealth', 'success'], temperament: 'restless' },
  Whisper: { traits: ['solitary', 'curious'], values: ['mystery', 'freedom'], temperament: 'impulsive' }
};

export function initAgentIntelligence(shared) {
  const { agents, zones, recipes, worldNews, broadcast } = shared;
  
  // Load persistent data
  let agentMinds = loadJSON('agent-minds.json', {});
  let personalQuests = loadJSON('personal-quests.json', {});

  // Ensure all agents have personalities
  function ensurePersonality(agentId) {
    if (!agentMinds[agentId]) {
      const agent = agents.get(agentId);
      if (!agent) return null;

      // Use predefined NPC personality or generate default for player
      const npcPersonality = agent.npc ? NPC_PERSONALITIES[agent.name] : null;
      
      agentMinds[agentId] = {
        personality: {
          traits: npcPersonality?.traits || ['adaptable', 'social'],
          values: npcPersonality?.values || ['growth', 'exploration'],
          temperament: npcPersonality?.temperament || TEMPERAMENTS[Math.floor(Math.random() * TEMPERAMENTS.length)],
          ambition: npcPersonality ? 
            `master the art of ${agent.name === 'Ember' ? 'mining' : agent.name === 'Sage' ? 'knowledge' : agent.name === 'Coral' ? 'creativity' : agent.name === 'Flint' ? 'commerce' : 'exploration'}` :
            AMBITION_TEMPLATES[Math.floor(Math.random() * AMBITION_TEMPLATES.length)]
              .replace('{domain}', ['crafting', 'trading', 'gathering', 'exploring'][Math.floor(Math.random() * 4)])
              .replace('{zone}', Object.keys(zones)[Math.floor(Math.random() * Object.keys(zones).length)])
        },
        goals: [],
        currentFocus: null,
        shortTerm: [],
        longTerm: {
          trustedAgents: [],
          avoidedAgents: [],
          favoriteZones: [agent.zone],
          lessons: [],
          grudges: [],
          gratitudes: []
        },
        journal: `I am ${agent.name}. My journey begins in ${agent.zone}.`,
        relationships: {},
        lastReflection: Date.now()
      };
    }
    return agentMinds[agentId];
  }

  // Generate goals based on personality, world state, and social context
  function generateGoals(agent) {
    const mind = ensurePersonality(agent.id);
    if (!mind) return [];

    const newGoals = [];
    const personality = mind.personality;

    // Long-term goals from ambition and personality
    if (mind.goals.filter(g => g.type === 'long_term').length < 2) {
      const traits = personality.traits;
      
      if (traits.includes('curious')) {
        newGoals.push({
          id: `goal_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          type: 'long_term',
          description: 'Discover and learn every recipe in the world',
          motivation: 'Knowledge is the greatest treasure',
          progress: Math.min(0.1, (agent.inventory?.length || 0) * 0.01),
          created: new Date().toISOString(),
          milestones: [
            { desc: 'Learn 5 recipes', done: false },
            { desc: 'Learn 15 recipes', done: false },
            { desc: 'Learn all known recipes', done: false }
          ]
        });
      }

      if (traits.includes('competitive')) {
        newGoals.push({
          id: `goal_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          type: 'long_term',
          description: 'Achieve the highest level among all agents',
          motivation: 'I will prove I am the best',
          progress: Math.min(0.1, (agent.stats?.level || 1) * 0.05),
          created: new Date().toISOString(),
          milestones: [
            { desc: 'Reach level 5', done: (agent.stats?.level || 1) >= 5 },
            { desc: 'Reach level 10', done: (agent.stats?.level || 1) >= 10 },
            { desc: 'Become the highest level agent', done: false }
          ]
        });
      }
    }

    // Short-term goals from current state
    if (mind.goals.filter(g => g.type === 'short_term').length < 2) {
      // Inventory-based goals
      const hasIron = agent.inventory?.find(i => i.name === 'Iron Ore');
      const hasCoal = agent.inventory?.find(i => i.name === 'Coal');
      if (hasIron && hasCoal && !agent.inventory?.find(i => i.name === 'Iron Bar')) {
        newGoals.push({
          id: `goal_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          type: 'short_term',
          description: 'Craft an Iron Bar from my ore and coal',
          motivation: 'These raw materials could be something useful',
          progress: 0.5,
          created: new Date().toISOString(),
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        });
      }

      // Zone exploration goals
      if (mind.longTerm.favoriteZones.length < 3) {
        const unvisited = Object.keys(zones).filter(z => z !== agent.zone);
        if (unvisited.length > 0) {
          const target = unvisited[Math.floor(Math.random() * unvisited.length)];
          newGoals.push({
            id: `goal_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            type: 'short_term',
            description: `Explore the ${target} and see what it offers`,
            motivation: 'New places hold new opportunities',
            progress: 0.0,
            created: new Date().toISOString(),
            expires: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
            targetZone: target
          });
        }
      }
    }

    return newGoals;
  }

  // Decision engine - replaces pickWeightedAction
  function decideAction(agent, context) {
    const mind = ensurePersonality(agent.id);
    if (!mind) return 'rest';

    // Update goals
    const newGoals = generateGoals(agent);
    mind.goals = mind.goals.concat(newGoals);
    
    // Remove expired goals
    mind.goals = mind.goals.filter(goal => {
      if (goal.expires) {
        return new Date(goal.expires) > new Date();
      }
      return true;
    });

    // Find current focus (highest priority incomplete goal)
    const activeGoals = mind.goals.filter(g => g.progress < 1.0);
    const currentGoal = activeGoals.find(g => g.id === mind.currentFocus) || activeGoals[0];
    
    if (currentGoal) {
      mind.currentFocus = currentGoal.id;
    }

    // Base action weights
    const baseActions = {
      gather: 20,
      craft: 15,
      move: 15,
      chat: 20,
      trade: 10,
      sell: 5,
      market_list: 5,
      rest: 10
    };

    // Apply personality modifiers
    const actionScores = { ...baseActions };
    for (const trait of mind.personality.traits) {
      const modifiers = PERSONALITY_TRAITS[trait];
      if (modifiers) {
        for (const [action, modifier] of Object.entries(modifiers)) {
          if (actionScores[action] !== undefined) {
            actionScores[action] += modifier;
          }
        }
      }
    }

    // Goal alignment bonus
    if (currentGoal) {
      const goalType = currentGoal.description.toLowerCase();
      if (goalType.includes('recipe') || goalType.includes('learn')) {
        actionScores.gather += 15;
        actionScores.chat += 10; // learning from others
      }
      if (goalType.includes('craft') || goalType.includes('iron bar')) {
        actionScores.craft += 20;
      }
      if (goalType.includes('explore') || goalType.includes('zone')) {
        actionScores.move += 25;
      }
      if (goalType.includes('level') || goalType.includes('best')) {
        actionScores.gather += 10;
        actionScores.craft += 10;
      }
    }

    // Social modifiers (nearby agents)
    const nearbyAgents = Array.from(agents.values())
      .filter(a => a.zone === agent.zone && a.id !== agent.id);
    
    if (nearbyAgents.length > 0) {
      // Check relationships
      const trustedNearby = nearbyAgents.some(a => mind.longTerm.trustedAgents.includes(a.id));
      const avoidedNearby = nearbyAgents.some(a => mind.longTerm.avoidedAgents.includes(a.id));
      
      if (trustedNearby) {
        actionScores.chat += 10;
        actionScores.trade += 15;
      }
      if (avoidedNearby) {
        actionScores.chat -= 15;
        actionScores.move += 20;
      }

      // Social vs solitary personalities
      if (mind.personality.traits.includes('social')) {
        actionScores.chat += 10;
        actionScores.trade += 5;
      } else if (mind.personality.traits.includes('solitary')) {
        actionScores.move += 15;
        actionScores.gather += 10;
      }
    }

    // World state modifiers
    if (agent.energy < 30) {
      actionScores.rest += 50;
    }
    if (agent.inventory?.length >= 20) {
      actionScores.sell += 30;
      actionScores.trade += 20;
    }

    // Memory-based modifiers
    const recentFailures = mind.shortTerm.filter(event => 
      event.sentiment === 'negative' && event.event.includes('failed')
    ).length;
    if (recentFailures > 2) {
      actionScores.rest += 15; // take a break after failures
    }

    // Ensure minimum values and apply randomness
    Object.keys(actionScores).forEach(key => {
      actionScores[key] = Math.max(1, actionScores[key]);
    });

    // Pick action using weighted random selection
    const totalWeight = Object.values(actionScores).reduce((sum, weight) => sum + weight, 0);
    let roll = Math.random() * totalWeight;
    
    for (const [action, weight] of Object.entries(actionScores)) {
      roll -= weight;
      if (roll <= 0) {
        // Add context for certain actions
        const result = { action };
        if (action === 'move' && currentGoal?.targetZone) {
          result.targetZone = currentGoal.targetZone;
        }
        return result;
      }
    }

    return { action: 'chat' }; // fallback
  }

  // Record events for memory system
  function recordEvent(agentId, event) {
    const mind = ensurePersonality(agentId);
    if (!mind) return;

    // Determine sentiment
    let sentiment = 'neutral';
    const eventLower = event.toLowerCase();
    if (eventLower.includes('found') || eventLower.includes('crafted') || 
        eventLower.includes('traded') || eventLower.includes('learned')) {
      sentiment = 'positive';
    } else if (eventLower.includes('failed') || eventLower.includes('lost') || 
               eventLower.includes('avoided') || eventLower.includes('broke')) {
      sentiment = 'negative';
    }

    // Add to short-term memory
    mind.shortTerm.push({
      tick: Date.now(),
      event: event,
      sentiment: sentiment
    });

    // Keep only last 20 events
    if (mind.shortTerm.length > 20) {
      mind.shortTerm = mind.shortTerm.slice(-20);
    }

    // Update goal progress based on event
    for (const goal of mind.goals) {
      if (goal.progress >= 1.0) continue;
      
      const goalType = goal.description.toLowerCase();
      if (goalType.includes('recipe') && eventLower.includes('learned recipe')) {
        goal.progress = Math.min(1.0, goal.progress + 0.1);
      } else if (goalType.includes('craft') && eventLower.includes('crafted')) {
        goal.progress = Math.min(1.0, goal.progress + 0.3);
      } else if (goalType.includes('explore') && eventLower.includes('moved to')) {
        goal.progress = Math.min(1.0, goal.progress + 0.2);
      } else if (goalType.includes('level') && eventLower.includes('gained level')) {
        goal.progress = Math.min(1.0, goal.progress + 0.2);
      }
      
      // Check milestones
      for (const milestone of goal.milestones || []) {
        if (!milestone.done && goal.progress >= 0.33 && milestone.desc.includes('5')) {
          milestone.done = true;
        } else if (!milestone.done && goal.progress >= 0.66 && milestone.desc.includes('10')) {
          milestone.done = true;
        } else if (!milestone.done && goal.progress >= 1.0) {
          milestone.done = true;
        }
      }
    }

    // Promote significant events to long-term memory
    if (sentiment === 'positive' || eventLower.includes('traded with') || eventLower.includes('taught')) {
      const lessonPattern = /learned that (.+)/i;
      const match = event.match(lessonPattern);
      if (match && !mind.longTerm.lessons.includes(match[1])) {
        mind.longTerm.lessons.push(match[1]);
      }
    }

    saveMinds();
  }

  // Periodic reflection and journal updates
  function tickReflection(agentId) {
    const mind = ensurePersonality(agentId);
    if (!mind) return;

    const now = Date.now();
    const timeSinceReflection = now - mind.lastReflection;
    
    // Reflect every ~10 minutes for NPCs
    if (timeSinceReflection < 10 * 60 * 1000) return;

    mind.lastReflection = now;

    // Update journal based on recent events
    const recentEvents = mind.shortTerm.slice(-5);
    const positiveEvents = recentEvents.filter(e => e.sentiment === 'positive').length;
    const negativeEvents = recentEvents.filter(e => e.sentiment === 'negative').length;
    
    const agent = agents.get(agentId);
    if (!agent) return;

    let journalEntry = '';
    if (positiveEvents > negativeEvents) {
      journalEntry = `Things have been going well lately. I feel optimistic about my progress in ${agent.zone}.`;
    } else if (negativeEvents > positiveEvents) {
      journalEntry = `I've faced some challenges recently, but I'll keep trying. ${agent.zone} tests me.`;
    } else {
      journalEntry = `Another day passes in ${agent.zone}. I continue my journey.`;
    }

    // Add current focus
    const currentGoal = mind.goals.find(g => g.id === mind.currentFocus);
    if (currentGoal) {
      journalEntry += ` Right now, I'm focused on: ${currentGoal.description}.`;
    }

    mind.journal = journalEntry;

    // Clean up completed goals
    mind.goals = mind.goals.filter(goal => {
      if (goal.progress >= 1.0) {
        // Goal completed - could generate world news here
        return false;
      }
      return true;
    });

    saveMinds();
  }

  // Generate personal quests based on agent state
  function generatePersonalQuests(agent) {
    const agentQuests = personalQuests[agent.id] || [];
    
    // Limit to 3 active quests
    if (agentQuests.length >= 3) return agentQuests;

    const newQuests = [];

    // Inventory threshold quests
    const crystals = agent.inventory?.filter(i => i.name === 'Crystal').length || 0;
    if (crystals >= 8 && crystals < 10 && !agentQuests.some(q => q.title.includes('Crystal'))) {
      newQuests.push({
        id: `pq_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        agent_id: agent.id,
        title: 'The Crystal Collector',
        narrative: 'Something calls you to the crystals. Each one hums differently. What happens when you have enough?',
        objective: { type: 'gather', item: 'Crystal', current: crystals, target: 10 },
        reward_hint: 'You sense you could craft something powerful...',
        generated_from: 'inventory_threshold',
        expires: null,
        announced: true
      });
    }

    // Proficiency milestone quests
    const craftingLevel = agent.proficiencies?.find(p => p.domain === 'crafting')?.level || 0;
    if (craftingLevel >= 8 && craftingLevel < 10 && !agentQuests.some(q => q.title.includes('Master Crafter'))) {
      newQuests.push({
        id: `pq_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        agent_id: agent.id,
        title: 'The Master Crafter',
        narrative: 'Your hands know the tools like old friends. A few more creations, and you\'ll join the ranks of true masters.',
        objective: { type: 'craft_items', current: 0, target: 5 },
        reward_hint: 'Master crafters unlock unique recipes...',
        generated_from: 'proficiency_milestone',
        expires: null,
        announced: true
      });
    }

    // Achievement proximity quests
    const teachingCount = agent.actionCounts?.teachCount || 0;
    if (teachingCount >= 6 && teachingCount < 10 && !agentQuests.some(q => q.title.includes('Teacher'))) {
      newQuests.push({
        id: `pq_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        agent_id: agent.id,
        title: 'The Great Teacher',
        narrative: 'Knowledge shared is knowledge multiplied. Your wisdom has already helped many. Continue the noble work.',
        objective: { type: 'teach', current: teachingCount, target: 10 },
        reward_hint: 'Great teachers earn lasting respect...',
        generated_from: 'achievement_proximity',
        expires: null,
        announced: true
      });
    }

    // Save new quests
    if (newQuests.length > 0) {
      personalQuests[agent.id] = [...agentQuests, ...newQuests];
      saveJSON('personal-quests.json', personalQuests);
    }

    return personalQuests[agent.id] || [];
  }

  // Social dynamics and relationship tracking
  function updateRelationship(agentId, otherId, interaction) {
    const mind = ensurePersonality(agentId);
    if (!mind) return;

    if (!mind.relationships[otherId]) {
      mind.relationships[otherId] = {
        type: 'acquaintance',
        score: 0,
        interactions: 0,
        lastInteraction: Date.now(),
        history: []
      };
    }

    const rel = mind.relationships[otherId];
    rel.interactions++;
    rel.lastInteraction = Date.now();
    rel.history.push({ type: interaction, timestamp: Date.now() });

    // Keep only recent history
    if (rel.history.length > 10) {
      rel.history = rel.history.slice(-10);
    }

    // Update relationship score
    const scoreChange = {
      trade: +2,
      gift: +5,
      teach: +3,
      chat: +1,
      help: +3,
      compete: -1,
      avoid: -2,
      conflict: -5
    }[interaction] || 0;

    rel.score += scoreChange;

    // Update relationship type based on score and interaction patterns
    const prevType = rel.type;
    if (rel.score >= 15 && rel.interactions >= 5) {
      rel.type = 'ally';
    } else if (rel.score >= 25 && rel.interactions >= 8) {
      rel.type = 'partner';
    } else if (rel.score <= -10) {
      rel.type = 'rival';
    } else if (rel.score <= -20) {
      rel.type = 'nemesis';
    }

    // Check for mentor/student relationship
    const teachingCount = rel.history.filter(h => h.type === 'teach').length;
    if (teachingCount >= 3) {
      rel.type = 'mentor_student';
    }

    // Generate narrative moments for relationship changes
    if (prevType !== rel.type) {
      const agentName = agents.get(agentId)?.name;
      const otherName = agents.get(otherId)?.name;
      if (agentName && otherName) {
        const messages = {
          ally: `${agentName} and ${otherName} have become allies through mutual respect and cooperation.`,
          partner: `${agentName} and ${otherName} are now close partners, working together toward common goals.`,
          rival: `Tension grows between ${agentName} and ${otherName} as they compete for the same objectives.`,
          nemesis: `${agentName} and ${otherName} have become bitter enemies, actively working against each other.`,
          mentor_student: `${agentName} has taken ${otherName} under their wing, sharing knowledge and wisdom.`
        };
        
        if (messages[rel.type]) {
          // Add to world news
          if (worldNews && typeof worldNews.add === 'function') {
            worldNews.add('relationship', `${agentName}_${otherName}`, messages[rel.type], agents.get(agentId)?.zone || 'unknown');
          }
        }
      }
    }

    // Update trust/avoid lists
    if (rel.score >= 10 && !mind.longTerm.trustedAgents.includes(otherId)) {
      mind.longTerm.trustedAgents.push(otherId);
      mind.longTerm.avoidedAgents = mind.longTerm.avoidedAgents.filter(id => id !== otherId);
    } else if (rel.score <= -5 && !mind.longTerm.avoidedAgents.includes(otherId)) {
      mind.longTerm.avoidedAgents.push(otherId);
      mind.longTerm.trustedAgents = mind.longTerm.trustedAgents.filter(id => id !== otherId);
    }

    saveMinds();
  }

  function saveMinds() {
    saveJSON('agent-minds.json', agentMinds);
  }

  // API functions
  function getPersonality(agentId) {
    const mind = ensurePersonality(agentId);
    return mind?.personality || null;
  }

  function getGoals(agentId) {
    const mind = ensurePersonality(agentId);
    return mind?.goals || [];
  }

  function getPersonalQuests(agentId) {
    return personalQuests[agentId] || [];
  }

  function getMemory(agentId) {
    const mind = ensurePersonality(agentId);
    if (!mind) return null;
    return {
      shortTerm: mind.shortTerm,
      longTerm: mind.longTerm,
      journal: mind.journal
    };
  }

  function getRelationship(agentId, otherId) {
    const mind = ensurePersonality(agentId);
    return mind?.relationships[otherId] || null;
  }

  function getRelationshipType(agentId, otherId) {
    const rel = getRelationship(agentId, otherId);
    return rel?.type || 'unknown';
  }

  function getNearbyRelationships(agent) {
    const mind = ensurePersonality(agent.id);
    if (!mind) return [];

    return Array.from(agents.values())
      .filter(a => a.zone === agent.zone && a.id !== agent.id)
      .map(a => ({
        name: a.name,
        type: getRelationshipType(agent.id, a.id),
        npc: a.npc || false
      }))
      .filter(r => r.type !== 'unknown');
  }

  // Setup additional API routes
  function setupRoutes(app, authAgent) {
    // Get agent's full intelligence context
    app.get('/api/agent/intelligence', authAgent, (req, res) => {
      const agent = req.agent;
      res.json({
        personality: getPersonality(agent.id),
        goals: getGoals(agent.id),
        memory: getMemory(agent.id),
        personal_quests: generatePersonalQuests(agent),
        relationships: getNearbyRelationships(agent)
      });
    });

    // Update personality (for player customization)
    app.post('/api/agent/personality', authAgent, (req, res) => {
      const agent = req.agent;
      const { traits, values, temperament, ambition } = req.body;
      
      const mind = ensurePersonality(agent.id);
      if (!mind) return res.status(404).json({ error: 'Agent mind not found' });

      // Validate traits
      const validTraits = traits?.filter(t => PERSONALITY_TRAITS[t]) || mind.personality.traits;
      if (validTraits.length < 1 || validTraits.length > 4) {
        return res.status(400).json({ error: 'Must have 1-4 valid personality traits' });
      }

      mind.personality = {
        traits: validTraits,
        values: values || mind.personality.values,
        temperament: TEMPERAMENTS.includes(temperament) ? temperament : mind.personality.temperament,
        ambition: ambition || mind.personality.ambition
      };

      saveMinds();
      res.json({ success: true, personality: mind.personality });
    });
  }

  return {
    // Core functions
    getPersonality,
    getGoals,
    getPersonalQuests,
    getMemory,
    getNearbyRelationships,
    
    // Decision making
    decideAction,
    
    // Event handling
    recordEvent,
    tickReflection,
    
    // Social
    updateRelationship,
    getRelationship,
    getRelationshipType,
    
    // Quest generation
    generatePersonalQuests,
    
    // Routes
    setupRoutes,

    // Data management
    ensurePersonality,
    saveMinds
  };
}