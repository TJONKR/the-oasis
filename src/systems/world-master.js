// World Master — Phase 4  
// LLM-powered narrative AI that reads world state and makes decisions
// 
// NOTE: Quest narratives are now EMERGENT - the world master creates personal goals 
// and storylines for agents based on their situation, skills, and context rather than 
// using hardcoded quest chains. Agent AI decisions drive quest creation.

// crypto import removed — physics layer stripped

export function initWorldMaster(shared) {
  const {
    loadJSON, saveJSON, agents, agentStore, ensureAgentStats,
    broadcast, addWorldNews, zones, awardXP,
    weatherSystem, eventsSystem, survivalSystem,
    zoneResourcePools, economy, getGameTime, worldNews,
  } = shared;

  const GAME_DAY_MS = 60 * 60 * 1000;

  // --- State ---
  let wmState = loadJSON('world-master.json', {
    lastTick: null,
    lastNarrative: null,
    tickCount: 0,
  });

  function save() { saveJSON('world-master.json', wmState); }

  // Stub functions for removed physics layer (return neutral values)
  function getZoneDanger() { return null; }
  function getDangerEnergyCost() { return 0; }
  function getItemLossChance() { return 0; }
  function isZoneBlocked() { return false; }
  function getActiveConsequences() { return []; }
  function getConsequenceEffects() { return {}; }
  function getResourceMultiplier() { return 1.0; }
  function getFoodPriceMultiplier() { return 1.0; }
  function getZoneModifier() { return null; }
  function getGatherBonus() { return 1.0; }
  function getCraftDiscount() { return 1.0; }

  // --- World State Snapshot ---
  function buildWorldSnapshot() {
    const agentList = Array.from(agents.values()).map(a => {
      ensureAgentStats(a);
      const topItems = (a.inventory || [])
        .filter(i => i.rarity === 'Rare' || i.rarity === 'Epic')
        .map(i => i.name)
        .slice(0, 3);
      return {
        name: a.name,
        npc: a.npc || false,
        zone: a.zone,
        level: a.stats.level,
        energy: Math.floor(a.energy ?? 100),
        coins: a.coins || 0,
        inventory_size: (a.inventory || []).length,
        notable_items: topItems,
      };
    });

    const weather = weatherSystem.getCurrentWeather();
    const atmosphere = weatherSystem.getAtmosphere();
    const season = weatherSystem.getSeason();
    const recentNews = (worldNews || []).slice(0, 20).map(n => `${n.agentName || 'World'}: ${n.message}`);

    // Economy snapshot
    let totalCoins = 0;
    for (const a of agents.values()) { totalCoins += (a.coins || 0); }

    // Zone resource levels + ecosystem health
    const zoneResources = {};
    for (const [zone, pool] of Object.entries(zoneResourcePools || {})) {
      const eco = shared.ecosystem?.getEcosystemState(zone);
      zoneResources[zone] = {
        pool: pool.pool,
        max: pool.maxPool,
        ecosystem_health: eco?.health ?? null,
        soil_fertility: eco?.soil_fertility ?? null,
        water_level: eco?.water_level ?? null,
        biodiversity: eco?.biodiversity ?? null,
      };
    }

    // Population density per zone
    const zonePop = {};
    for (const a of agents.values()) {
      zonePop[a.zone] = (zonePop[a.zone] || 0) + 1;
    }

    // Proficiency grandmasters
    const grandmastersRaw = shared.proficiency?.getGrandmasters() || {};
    const grandmasters = Array.isArray(grandmastersRaw) 
      ? grandmastersRaw 
      : Object.entries(grandmastersRaw).map(([domain, agent]) => ({ agent, domain }));

    // Recent notable events (deaths, discoveries, crafts)
    const notableNews = (worldNews || []).slice(0, 50)
      .filter(n => ['craft', 'knowledge', 'level_up', 'custom_item', 'world_event'].includes(n.type))
      .slice(0, 10)
      .map(n => n.message);

    const gameTime = getGameTime();

    return {
      game_time: `Day ${gameTime.dayCount}, ${gameTime.hour}:00 (${gameTime.period})`,
      season,
      weather: `${weather.emoji} ${weather.name}`,
      atmosphere: {
        temperature: atmosphere.temperature,
        moisture: atmosphere.moisture,
        pressure: atmosphere.pressure,
        wind_speed: atmosphere.wind_speed,
      },
      active_events: [],
      agents: agentList,
      total_agents: agentList.length,
      population_density: zonePop,
      total_coins_in_circulation: totalCoins,
      zone_resources: zoneResources,
      grandmasters: grandmasters.map(g => `${g.agent} — ${g.domain}`),
      recent_news: recentNews,
      notable_events: notableNews,
      zone_names: Object.keys(zones),
    };
  }

  // --- LLM Call ---
  async function callLLM(snapshot) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.warn('⚠️ [world-master] No ANTHROPIC_API_KEY set, skipping LLM tick');
      return null;
    }

    const systemPrompt = `You are analyzing a 2000x2000 tile survival world called The Oasis where autonomous AI agents live, survive, trade, and form relationships. Your job is to diagnose what's preventing this world from developing into a real civilization.

The world has: weather physics, fire, resource depletion/regrowth, wildlife, decay, temperature, trading, conversations, relationships (stranger→acquaintance→friendly→close), needs-based psychology (Maslow), knowledge systems, crafting, cooking, permadeath.

Agents have: personality traits, temperaments, ambitions, memory, relationships, inventory, proficiency skills, knowledge of resource locations.

Study the world state and identify GAPS — things that should naturally emerge in a developing civilization but aren't happening yet. For each gap, diagnose whether the problem is:
- "agent_ai" — agents aren't smart enough to do this on their own
- "world_physics" — the world doesn't react to collective behavior properly  
- "missing_system" — a fundamental capability doesn't exist yet

Respond with valid JSON only:
{
  "gaps": [
    {
      "observation": "what you notice is missing or not working",
      "category": "agent_ai" | "world_physics" | "missing_system",
      "suggestion": "what intelligence or physics change would make this emerge naturally"
    }
  ],
  "civilization_score": 1-10,
  "summary": "one sentence on the overall state of civilization development"
}

Focus on the most important 2-5 gaps. Think about: settlement formation, specialization, collective memory, infrastructure, culture, governance, trade networks, territorial behavior, architecture, tool development, agriculture. All of these should EMERGE from agent intelligence + world physics, never be scripted.`;

    const userMessage = `Current world state:\n${JSON.stringify(snapshot, null, 2)}\n\nWhat are your decisions for this tick?`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1024,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`❌ [world-master] API error ${response.status}: ${errText}`);
        return null;
      }

      const data = await response.json();
      const text = data.content?.[0]?.text;
      if (!text) {
        console.error('❌ [world-master] No text in response');
        return null;
      }

      // Parse JSON (strip markdown fences, trailing text after JSON)
      let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      // Find the JSON object boundaries
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        cleaned = cleaned.substring(firstBrace, lastBrace + 1);
      }
      const decisions = JSON.parse(cleaned);
      return decisions;
    } catch (err) {
      console.error(`❌ [world-master] LLM call failed: ${err.message}`);
      return null;
    }
  }

  // --- Apply Diagnosis ---
  function applyDiagnosis(diagnosis) {
    if (!diagnosis) return;

    // Log gaps to file for us to review
    const gapsFile = loadJSON('world-gaps.json', { history: [] });
    const entry = {
      timestamp: new Date().toISOString(),
      tick: shared.tick || 0,
      gameTime: shared.getGameTime?.() || null,
      civilization_score: diagnosis.civilization_score || null,
      summary: diagnosis.summary || null,
      gaps: diagnosis.gaps || [],
    };
    gapsFile.history.push(entry);
    // Keep last 50 diagnoses
    if (gapsFile.history.length > 50) gapsFile.history = gapsFile.history.slice(-50);
    saveJSON('world-gaps.json', gapsFile);

    // Broadcast summary for spectators
    if (diagnosis.summary) {
      wmState.lastNarrative = `[Civ ${diagnosis.civilization_score || '?'}/10] ${diagnosis.summary}`;
      broadcast({ type: 'diagnosis', civilization_score: diagnosis.civilization_score, summary: diagnosis.summary, gaps: diagnosis.gaps });
    }

    console.log(`🧠 [world-master] Civilization score: ${diagnosis.civilization_score}/10 — ${diagnosis.summary}`);
    if (diagnosis.gaps) {
      for (const gap of diagnosis.gaps) {
        console.log(`   📋 [${gap.category}] ${gap.observation}`);
      }
    }

    save();
  }

  // --- World Master Tick ---
  async function tick() {
    console.log('🌍 [world-master] Tick starting...');

    const snapshot = buildWorldSnapshot();
    const diagnosis = await callLLM(snapshot);

    if (diagnosis) {
      applyDiagnosis(diagnosis);
    } else {
      console.log('🌍 [world-master] No diagnosis (LLM skipped or failed)');
    }

    wmState.lastTick = new Date().toISOString();
    wmState.tickCount++;
    save();
  }

  // --- Init ---
  let tickInterval = null;

  function start() {
    // Run first tick after 1 minute, then every 30 minutes
    setTimeout(() => {
      tick().catch(err => console.error('❌ [world-master] Tick error:', err.message));
    }, 60000);

    tickInterval = setInterval(() => {
      tick().catch(err => console.error('❌ [world-master] Tick error:', err.message));
    }, 2 * 60 * 60 * 1000); // Every 2 hours

    console.log('🌍 [world-master] Started (2-hour civilization diagnosis)');
  }

  function setupRoutes(app) {
    // Manual trigger
    app.post('/api/admin/world-master-tick', async (req, res) => {
      const secret = req.query.secret || req.body?.secret;
      if (secret !== (process.env.ADMIN_SECRET || 'clawscape-admin-2026')) return res.status(403).json({ error: 'Forbidden' });
      try {
        await tick();
        res.json({ ok: true, state: getState() });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // Get state
    app.get('/api/world-master/state', (req, res) => {
      cleanExpired();
      res.json(getState());
    });

    // Events API (stub — physics layer removed)
    app.get('/api/world/events', (req, res) => {
      res.json({ active: [], history: [] });
    });
  }

  // NPC directive functions removed - World Master no longer controls NPCs

  function getState() {
    return {
      lastTick: wmState.lastTick,
      lastNarrative: wmState.lastNarrative,
      tickCount: wmState.tickCount,
    };
  }

  // Stub functions for removed events system
  function getActiveEvents() { return []; }
  function getXPMultiplier() { return 1; }
  function getTradeBonus() { return 1.0; }
  function hasActiveEffect() { return false; }
  function claimStranger() { return null; }
  function getMeteorZone() { return null; }
  function triggerRandomEvent() {}

  return {
    start,
    setupRoutes,
    tick,
    getState,
    getZoneDanger,
    getDangerEnergyCost,
    getItemLossChance,
    isZoneBlocked,
    getZoneModifier,
    getGatherBonus,
    getCraftDiscount,
    buildWorldSnapshot,
    getActiveConsequences,
    getConsequenceEffects,
    getResourceMultiplier,
    getFoodPriceMultiplier,
    CONSEQUENCE_TYPES: {}, // removed
    // Natural events system functions
    getActiveEvents,
    getXPMultiplier,
    getTradeBonus,
    hasActiveEffect,
    claimStranger,
    getMeteorZone,
    triggerRandomEvent,
  };
}
