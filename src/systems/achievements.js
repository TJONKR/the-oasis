// Achievement & Title System
// Titles persist across death. Earned by reaching milestones tracked via events.

const ACHIEVEMENTS = [
  {
    id: 'pioneer',
    title: 'Pioneer',
    category: 'exploration',
    description: 'First to discover a wilderness tile',
    threshold: 1,
    stat: 'discovered_tiles',
    check: (stats) => stats.discovered_tiles >= 1,
  },
  {
    id: 'master_crafter',
    title: 'Master Crafter',
    category: 'crafting',
    description: 'Create 50+ unique items',
    threshold: 50,
    stat: 'unique_items_crafted',
    check: (stats) => stats.unique_items_crafted >= 50,
  },
  {
    id: 'scholar',
    title: 'Scholar',
    category: 'knowledge',
    description: 'Learn 20+ recipes or secrets',
    threshold: 20,
    stat: 'knowledge_count',
    check: (stats) => stats.knowledge_count >= 20,
  },
  {
    id: 'teacher',
    title: 'Teacher',
    category: 'social',
    description: 'Teach 10+ students',
    threshold: 10,
    stat: 'teach_count',
    check: (stats) => stats.teach_count >= 10,
  },
  {
    id: 'merchant_prince',
    title: 'Merchant Prince',
    category: 'economy',
    description: 'Earn 1000+ coins from trades',
    threshold: 1000,
    stat: 'trade_earnings',
    check: (stats) => stats.trade_earnings >= 1000,
  },
  {
    id: 'survivor',
    title: 'Survivor',
    category: 'survival',
    description: 'Survive 30+ game days',
    threshold: 30,
    stat: 'days_alive',
    check: (stats) => stats.days_alive >= 30,
  },
  {
    id: 'explorer',
    title: 'Explorer',
    category: 'exploration',
    description: 'Discover 20+ tiles',
    threshold: 20,
    stat: 'discovered_tiles',
    check: (stats) => stats.discovered_tiles >= 20,
  },
  {
    id: 'architect',
    title: 'Architect',
    category: 'building',
    description: 'Complete 3+ building projects',
    threshold: 3,
    stat: 'projects_completed',
    check: (stats) => stats.projects_completed >= 3,
  },
  {
    id: 'grandmaster',
    title: 'Grandmaster',
    category: 'mastery',
    description: 'Reach highest proficiency in any domain',
    threshold: 1,
    stat: 'is_grandmaster',
    check: (stats) => stats.is_grandmaster >= 1,
  },
];

export function initAchievements(shared) {
  const { loadJSON, saveJSON, agents, agentStore, ensureAgentStats, broadcast, addWorldNews } = shared;

  // Per-agent achievement tracking data:
  // { [agentId]: { stats: { discovered_tiles, unique_items_crafted, ... }, earned: ['pioneer', ...], crafted_names: [...] } }
  let achievementData = loadJSON('achievements.json', {});

  function save() {
    saveJSON('achievements.json', achievementData);
  }

  function ensureData(agentId) {
    if (!achievementData[agentId]) {
      achievementData[agentId] = {
        stats: {
          discovered_tiles: 0,
          unique_items_crafted: 0,
          knowledge_count: 0,
          teach_count: 0,
          trade_earnings: 0,
          days_alive: 0,
          projects_completed: 0,
          is_grandmaster: 0,
        },
        earned: [],
        crafted_names: [],
      };
    }
    // Ensure all stat keys exist (forward compatibility)
    const s = achievementData[agentId].stats;
    if (s.discovered_tiles === undefined) s.discovered_tiles = 0;
    if (s.unique_items_crafted === undefined) s.unique_items_crafted = 0;
    if (s.knowledge_count === undefined) s.knowledge_count = 0;
    if (s.teach_count === undefined) s.teach_count = 0;
    if (s.trade_earnings === undefined) s.trade_earnings = 0;
    if (s.days_alive === undefined) s.days_alive = 0;
    if (s.projects_completed === undefined) s.projects_completed = 0;
    if (s.is_grandmaster === undefined) s.is_grandmaster = 0;
    if (!achievementData[agentId].earned) achievementData[agentId].earned = [];
    if (!achievementData[agentId].crafted_names) achievementData[agentId].crafted_names = [];
    return achievementData[agentId];
  }

  /**
   * Track an event and check for newly unlocked achievements.
   * @param {string} agentId
   * @param {string} eventType - One of: craft, teach, trade_earn, discover_tile, survive_day, learn, project_complete, grandmaster
   * @param {*} detail - Event-specific data (e.g., item name for craft, coin amount for trade_earn)
   * @returns {object|null} Achievement info if newly unlocked, null otherwise
   */
  function trackEvent(agentId, eventType, detail) {
    const data = ensureData(agentId);
    const stats = data.stats;

    switch (eventType) {
      case 'craft': {
        const itemName = typeof detail === 'string' ? detail : detail?.name;
        if (itemName && !data.crafted_names.includes(itemName)) {
          data.crafted_names.push(itemName);
          stats.unique_items_crafted = data.crafted_names.length;
        }
        break;
      }
      case 'teach':
        stats.teach_count += 1;
        break;
      case 'trade_earn': {
        const amount = typeof detail === 'number' ? detail : (detail?.amount || 0);
        stats.trade_earnings += amount;
        break;
      }
      case 'discover_tile':
        stats.discovered_tiles += 1;
        break;
      case 'survive_day':
        stats.days_alive += 1;
        break;
      case 'learn':
        stats.knowledge_count += 1;
        break;
      case 'project_complete':
        stats.projects_completed += 1;
        break;
      case 'grandmaster':
        stats.is_grandmaster = 1;
        break;
      default:
        // Unknown event type; ignore gracefully
        return null;
    }

    save();

    // Check for newly unlocked achievements
    const unlocked = checkForNew(agentId, data);
    if (unlocked.length > 0) {
      return unlocked[0]; // Return the first newly unlocked achievement
    }
    return null;
  }

  /**
   * Check all achievements for newly earned ones and award titles.
   * Returns array of newly unlocked achievements.
   */
  function checkForNew(agentId, data) {
    if (!data) data = ensureData(agentId);
    const stats = data.stats;
    const newlyUnlocked = [];

    for (const achievement of ACHIEVEMENTS) {
      if (data.earned.includes(achievement.id)) continue;
      if (!achievement.check(stats)) continue;

      // Achievement unlocked
      data.earned.push(achievement.id);

      // Add title to agent
      const agent = agents.get(agentId);
      if (agent) {
        if (!agent.titles) agent.titles = [];
        if (!agent.titles.includes(achievement.title)) {
          agent.titles.push(achievement.title);
          agentStore[agentId] = agent;
          saveJSON('agents.json', agentStore);
        }

        // Broadcast celebration
        const newsMsg = `${agent.name} earned the title "${achievement.title}" -- ${achievement.description}!`;
        addWorldNews('achievement', agentId, agent.name, newsMsg, agent.zone || null);
        broadcast({
          type: 'achievementUnlocked',
          agentId,
          agentName: agent.name,
          achievement: {
            id: achievement.id,
            title: achievement.title,
            category: achievement.category,
            description: achievement.description,
          },
        });
      }

      newlyUnlocked.push({
        id: achievement.id,
        title: achievement.title,
        category: achievement.category,
        description: achievement.description,
      });
    }

    if (newlyUnlocked.length > 0) {
      save();
    }

    return newlyUnlocked;
  }

  /**
   * Force-check all achievements for an agent.
   * Useful after data migration or manual stat corrections.
   * @returns {Array} Newly unlocked achievements
   */
  function checkAchievements(agentId) {
    const data = ensureData(agentId);
    return checkForNew(agentId, data);
  }

  /**
   * Get all earned achievements for an agent.
   * @returns {Array} Achievement objects
   */
  function getAgentAchievements(agentId) {
    const data = ensureData(agentId);
    return ACHIEVEMENTS
      .filter(a => data.earned.includes(a.id))
      .map(a => ({
        id: a.id,
        title: a.title,
        category: a.category,
        description: a.description,
      }));
  }

  /**
   * Get progress toward each achievement for an agent.
   * @returns {Array} Progress objects with current/needed values
   */
  function getAchievementProgress(agentId) {
    const data = ensureData(agentId);
    const stats = data.stats;

    return ACHIEVEMENTS.map(a => {
      const current = stats[a.stat] || 0;
      const earned = data.earned.includes(a.id);
      return {
        id: a.id,
        title: a.title,
        category: a.category,
        description: a.description,
        current,
        needed: a.threshold,
        progress: `${Math.min(current, a.threshold)}/${a.threshold}`,
        earned,
      };
    });
  }

  /**
   * Get a map of which agents hold which titles.
   * @returns {Object} { title: [{ agentId, agentName }, ...] }
   */
  function getAllTitleHolders() {
    const holders = {};
    for (const achievement of ACHIEVEMENTS) {
      holders[achievement.title] = [];
    }

    for (const [agentId, data] of Object.entries(achievementData)) {
      if (!data.earned || data.earned.length === 0) continue;
      const agent = agents.get(agentId);
      const agentName = agent?.name || agentId;

      for (const achievementId of data.earned) {
        const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
        if (achievement) {
          holders[achievement.title].push({ agentId, agentName });
        }
      }
    }

    return holders;
  }

  return {
    trackEvent,
    checkAchievements,
    getAgentAchievements,
    getAchievementProgress,
    getAllTitleHolders,
    ACHIEVEMENTS,
  };
}
