/**
 * agent-knowledge.js — Phase 3: Knowledge, Teaching & Death
 * 
 * Every agent has a unique brain that holds:
 * - Discovered resource locations (where food/materials are)
 * - Crafting recipes they've learned through experimentation
 * - Danger zones (where predators lurk)
 * - Social knowledge (who's friendly, who's dangerous)
 * - Survival skills (hunting proficiency, fire-making, etc.)
 * 
 * Knowledge is PERSONAL:
 * - You only know what you've discovered or been taught
 * - Teaching transfers knowledge between agents (chat with purpose)
 * - When you die, ALL your knowledge dies with you (permadeath = knowledge death)
 * - Mastery degrades if not practiced
 * 
 * This makes every agent irreplaceable. A veteran who knows where
 * the best food patches are, who the predators avoid, which recipes work —
 * losing them is a genuine loss to the colony.
 */

export function initAgentKnowledge(shared) {
  const knowledgeBases = new Map(); // agentId → KnowledgeBase

  class KnowledgeBase {
    constructor(agentId) {
      this.agentId = agentId;

      // ── SPATIAL KNOWLEDGE ──
      // Resource locations: "x,y" → { resource, source, lastSeen, reliability, gatherCount }
      this.resourceLocations = new Map();
      // Danger zones: "x,y" → { threat, lastSeen, severity }
      this.dangerZones = new Map();
      // Safe zones: "x,y" → { reason, lastSeen }
      this.safeZones = new Map();

      // ── CRAFTING KNOWLEDGE ──
      // Recipes discovered: "item1+item2" → { result, discoveredTick, timesUsed }
      this.recipes = new Map();

      // ── SURVIVAL SKILLS ──
      // skill → { level: 0-100, lastPracticed: tick, decayRate }
      this.skills = new Map();
      // Start with basic skills
      this.skills.set('foraging', { level: 10, lastPracticed: 0, decayRate: 0.005 });
      this.skills.set('crafting', { level: 5, lastPracticed: 0, decayRate: 0.008 });

      // ── SOCIAL KNOWLEDGE ──
      // What I know ABOUT other agents
      // agentId → { name, lastSeen, location, traits, trustworthy, knowledge: [...topics] }
      this.socialKnowledge = new Map();

      // ── META ──
      this.totalDiscoveries = 0;
      this.teachCount = 0;       // times taught others
      this.learnCount = 0;       // times learned from others
    }

    // ── RESOURCE DISCOVERY ──
    discoverResource(x, y, resource, source) {
      const key = `${x},${y}`;
      const existing = this.resourceLocations.get(key);
      if (existing) {
        existing.lastSeen = Date.now();
        existing.reliability = Math.min(1.0, existing.reliability + 0.1);
        existing.gatherCount++;
        return false; // already known
      }
      this.resourceLocations.set(key, {
        resource, source, x, y,
        lastSeen: Date.now(),
        reliability: 0.5,
        gatherCount: 1,
        depleted: false,
      });
      this.totalDiscoveries++;
      return true; // new discovery!
    }

    // Mark a resource as depleted (gathered until empty)
    markDepleted(x, y) {
      const key = `${x},${y}`;
      const loc = this.resourceLocations.get(key);
      if (loc) loc.depleted = true;
    }

    // Get known food locations, sorted by distance
    getKnownFoodLocations(fromX, fromY, maxDist = 50) {
      const foods = [];
      for (const [, loc] of this.resourceLocations) {
        if (loc.depleted) continue;
        const isFoodLike = ['berr', 'fish', 'mushroom', 'herb', 'fruit', 'nut', 'coconut', 'meat']
          .some(f => (loc.resource || '').toLowerCase().includes(f));
        if (!isFoodLike) continue;
        const dist = Math.abs(loc.x - fromX) + Math.abs(loc.y - fromY);
        if (dist <= maxDist) {
          foods.push({ ...loc, distance: dist });
        }
      }
      return foods.sort((a, b) => a.distance - b.distance);
    }

    // Get known resource locations by type
    getKnownResources(resourceType, fromX, fromY, maxDist = 50) {
      const results = [];
      for (const [, loc] of this.resourceLocations) {
        if (loc.depleted) continue;
        if (loc.resource !== resourceType) continue;
        const dist = Math.abs(loc.x - fromX) + Math.abs(loc.y - fromY);
        if (dist <= maxDist) results.push({ ...loc, distance: dist });
      }
      return results.sort((a, b) => a.distance - b.distance);
    }

    // ── DANGER KNOWLEDGE ──
    learnDanger(x, y, threat, severity = 5) {
      const key = `${x},${y}`;
      this.dangerZones.set(key, { threat, lastSeen: Date.now(), severity, x, y });
    }

    isDangerousArea(x, y, radius = 5) {
      for (const [, danger] of this.dangerZones) {
        const dist = Math.abs(danger.x - x) + Math.abs(danger.y - y);
        if (dist <= radius) return danger;
      }
      return null;
    }

    // ── RECIPE KNOWLEDGE ──
    discoverRecipe(item1, item2, result) {
      const key = [item1, item2].sort().join('+');
      if (this.recipes.has(key)) {
        this.recipes.get(key).timesUsed++;
        return false;
      }
      this.recipes.set(key, {
        ingredients: [item1, item2],
        result,
        discoveredTick: shared.tick || 0,
        timesUsed: 1,
      });
      this.totalDiscoveries++;
      return true; // new recipe!
    }

    getKnownRecipes() {
      return [...this.recipes.values()];
    }

    knowsRecipe(item1, item2) {
      const key = [item1, item2].sort().join('+');
      return this.recipes.has(key);
    }

    // ── SKILLS ──
    practiceSkill(skillName, amount = 1) {
      let skill = this.skills.get(skillName);
      if (!skill) {
        skill = { level: 0, lastPracticed: 0, decayRate: 0.005 };
        this.skills.set(skillName, skill);
      }
      // Diminishing returns — harder to improve at high levels
      const gain = amount * Math.max(0.1, 1.0 - skill.level / 120);
      skill.level = Math.min(100, skill.level + gain);
      skill.lastPracticed = shared.tick || 0;
    }

    getSkillLevel(skillName) {
      return this.skills.get(skillName)?.level || 0;
    }

    // Skill decay — unused skills degrade
    tickSkillDecay() {
      const currentTick = shared.tick || 0;
      for (const [name, skill] of this.skills) {
        const ticksSincePractice = currentTick - skill.lastPracticed;
        if (ticksSincePractice > 200) { // start decaying after ~100 seconds
          skill.level = Math.max(0, skill.level - skill.decayRate);
        }
      }
    }

    // ── SOCIAL KNOWLEDGE ──
    updateSocialKnowledge(otherId, info) {
      const existing = this.socialKnowledge.get(otherId) || {};
      this.socialKnowledge.set(otherId, { ...existing, ...info, lastUpdated: Date.now() });
    }

    // ── TEACHING ──
    // Returns an array of knowledge items to share
    getTeachableKnowledge(maxItems = 3) {
      const items = [];

      // Share best food locations
      const foods = [...this.resourceLocations.values()]
        .filter(r => !r.depleted && r.reliability > 0.3)
        .sort((a, b) => b.reliability - a.reliability);
      for (const food of foods.slice(0, 2)) {
        items.push({ type: 'resource', data: food });
      }

      // Share danger zones
      for (const [, danger] of this.dangerZones) {
        if (danger.severity >= 3) {
          items.push({ type: 'danger', data: danger });
        }
      }

      // Share recipes
      for (const [, recipe] of this.recipes) {
        items.push({ type: 'recipe', data: recipe });
      }

      return items.slice(0, maxItems);
    }

    // Learn from another agent's teaching
    learnFrom(knowledgeItems) {
      let learned = 0;
      for (const item of knowledgeItems) {
        if (item.type === 'resource') {
          const d = item.data;
          const isNew = this.discoverResource(d.x, d.y, d.resource, d.source);
          if (isNew) learned++;
        } else if (item.type === 'danger') {
          const d = item.data;
          this.learnDanger(d.x, d.y, d.threat, d.severity);
          learned++;
        } else if (item.type === 'recipe') {
          const d = item.data;
          const isNew = this.discoverRecipe(d.ingredients[0], d.ingredients[1], d.result);
          if (isNew) learned++;
        }
      }
      this.learnCount += learned;
      return learned;
    }

    // ── STATS ──
    getStats() {
      return {
        resourcesKnown: this.resourceLocations.size,
        dangersKnown: this.dangerZones.size,
        recipesKnown: this.recipes.size,
        skills: Object.fromEntries([...this.skills].map(([k, v]) => [k, Math.floor(v.level)])),
        totalDiscoveries: this.totalDiscoveries,
        teachCount: this.teachCount,
        learnCount: this.learnCount,
        socialConnections: this.socialKnowledge.size,
      };
    }
  }

  // ── SYSTEM API ──
  function getOrCreate(agentId) {
    if (!knowledgeBases.has(agentId)) {
      knowledgeBases.set(agentId, new KnowledgeBase(agentId));
    }
    return knowledgeBases.get(agentId);
  }

  // Teaching between two agents during chat
  function teachExchange(teacherId, learnerId) {
    const teacher = getOrCreate(teacherId);
    const learner = getOrCreate(learnerId);

    // Teacher shares knowledge based on their skill
    const teachSkill = teacher.getSkillLevel('teaching') || 10;
    const maxItems = Math.max(1, Math.floor(teachSkill / 25)); // 1-4 items based on skill
    const knowledge = teacher.getTeachableKnowledge(maxItems);

    if (knowledge.length === 0) return { taught: 0, learned: 0 };

    const learned = learner.learnFrom(knowledge);
    teacher.teachCount += learned;
    teacher.practiceSkill('teaching', learned);

    return { taught: knowledge.length, learned };
  }

  // On agent death — knowledge is LOST FOREVER
  function onDeath(agentId) {
    const kb = knowledgeBases.get(agentId);
    if (!kb) return null;

    const stats = kb.getStats();
    knowledgeBases.delete(agentId);

    // Return what was lost for news/logging
    return {
      resourcesLost: stats.resourcesKnown,
      recipesLost: stats.recipesKnown,
      skillsLost: Object.entries(stats.skills).filter(([, v]) => v > 20),
      totalDiscoveries: stats.totalDiscoveries,
    };
  }

  // Tick: skill decay for all agents
  function tick() {
    for (const [, kb] of knowledgeBases) {
      kb.tickSkillDecay();
    }
  }

  // World stats
  function getWorldKnowledgeStats() {
    const allKbs = [...knowledgeBases.values()];
    const totalResources = allKbs.reduce((s, kb) => s + kb.resourceLocations.size, 0);
    const totalRecipes = allKbs.reduce((s, kb) => s + kb.recipes.size, 0);
    const totalDangers = allKbs.reduce((s, kb) => s + kb.dangerZones.size, 0);
    const uniqueRecipes = new Set();
    for (const kb of allKbs) {
      for (const key of kb.recipes.keys()) uniqueRecipes.add(key);
    }

    return {
      agents: knowledgeBases.size,
      totalResourceKnowledge: totalResources,
      totalRecipeKnowledge: totalRecipes,
      uniqueRecipesDiscovered: uniqueRecipes.size,
      totalDangerKnowledge: totalDangers,
      avgDiscoveries: allKbs.length ? allKbs.reduce((s, kb) => s + kb.totalDiscoveries, 0) / allKbs.length : 0,
    };
  }

  // API routes
  function setupRoutes(app) {
    app.get('/api/knowledge', (req, res) => res.json(getWorldKnowledgeStats()));
    app.get('/api/agents/:id/knowledge', (req, res) => {
      const kb = knowledgeBases.get(req.params.id);
      if (!kb) return res.status(404).json({ error: 'No knowledge base' });
      res.json(kb.getStats());
    });
  }

  return {
    getOrCreate,
    teachExchange,
    onDeath,
    tick,
    getWorldKnowledgeStats,
    setupRoutes,
  };
}
