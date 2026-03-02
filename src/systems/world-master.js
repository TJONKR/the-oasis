// World Master — Phase 4  
// LLM-powered narrative AI that reads world state and makes decisions
// 
// NOTE: Quest narratives are now EMERGENT - the world master creates personal goals 
// and storylines for agents based on their situation, skills, and context rather than 
// using hardcoded quest chains. Agent AI decisions drive quest creation.

import crypto from 'crypto';

export function initWorldMaster(shared) {
  const {
    loadJSON, saveJSON, agents, agentStore, ensureAgentStats,
    broadcast, addWorldNews, zones, awardXP,
    weatherSystem, eventsSystem, survivalSystem,
    zoneResourcePools, economy, getGameTime, worldNews,
  } = shared;

  const GAME_DAY_MS = 60 * 60 * 1000;

  // Consequence definitions
  const CONSEQUENCE_TYPES = {
    drought: {
      name: 'Drought', emoji: '🏜️',
      precursor: { message: 'Dry hot winds sweep across the land...', type: 'precursor_drought' },
      effects: { resource_multiplier: 0.5, fire_risk: true },
      duration_hours: 4,
    },
    wildfire: {
      name: 'Wildfire', emoji: '🔥',
      precursor: { message: 'Smoke and haze drift from the horizon...', type: 'precursor_wildfire' },
      effects: { destroys_flammable: true, blocks_zone: true },
      duration_hours: 2,
    },
    plague: {
      name: 'Plague', emoji: '🦠',
      precursor: { message: 'Sickness spreads through populated areas...', type: 'precursor_plague' },
      effects: { energy_drain: 5 },
      duration_hours: 6,
    },
    earthquake: {
      name: 'Earthquake', emoji: '🌋',
      precursor: { message: 'Faint tremors ripple through the ground...', type: 'precursor_earthquake' },
      effects: { structure_damage: true, cave_collapse: true },
      duration_hours: 1,
    },
    famine: {
      name: 'Famine', emoji: '🍂',
      precursor: { message: 'Food is becoming scarce across the land...', type: 'precursor_famine' },
      effects: { food_price_mult: 2.0 },
      duration_hours: 8,
    },
  };

  // Natural phenomena that can occur in the world (no more gamey events)
  const NATURAL_EVENTS = [
    { id: 'meteor_shower', name: 'Meteor Shower', emoji: '☄️', desc: 'Rare minerals falling from the sky in {zone}!', durationMs: 3600000, effect: 'rare_minerals' },
    { id: 'migration', name: 'Animal Migration', emoji: '🦎', desc: 'Wildlife is migrating through {zone}', durationMs: 5400000, effect: 'wildlife_bonus' },
    { id: 'resource_bloom', name: 'Resource Bloom', emoji: '🌿', desc: 'Nature flourishes in {zone} - resources grow abundantly', durationMs: 7200000, effect: 'resource_abundance' },
    { id: 'seasonal_shift', name: 'Seasonal Shift', emoji: '🍂', desc: 'The seasons change, affecting {zone}', durationMs: 21600000, effect: 'seasonal_change' },
  ];

  // --- State ---
  let wmState = loadJSON('world-master.json', {
    lastTick: null,
    lastNarrative: null,
    dangers: [],       // { id, zone, type, description, expiresAt }
    zoneModifiers: {}, // { zone: { gather_bonus, craft_discount, reason, expiresAt } }
    npcDirectives: [], // { npc, action, zone, reason, issuedAt }
    consequences: [],  // { id, type, zones, description, startedAt, expiresAt, precursorSent }
    precursors: [],    // { id, type, message, zone, sentAt, expiresAt }
    tickCount: 0,
    activeEvents: [],  // { id, name, emoji, desc, zone, startedAt, endsAt, effect, strangerClaimed }
    nextEventTrigger: Date.now() + (4 + Math.random() * 4) * 3600000, // 4-8 hours
  });
  // Ensure new fields for older saves
  if (!wmState.consequences) wmState.consequences = [];
  if (!wmState.precursors) wmState.precursors = [];
  if (!wmState.activeEvents) wmState.activeEvents = [];
  if (!wmState.nextEventTrigger) wmState.nextEventTrigger = Date.now() + (4 + Math.random() * 4) * 3600000;

  function save() { saveJSON('world-master.json', wmState); }

  // --- Danger System ---
  function cleanExpired() {
    const now = Date.now();
    const before = wmState.dangers.length;
    wmState.dangers = wmState.dangers.filter(d => d.expiresAt > now);
    // Clean zone modifiers
    for (const [zone, mod] of Object.entries(wmState.zoneModifiers)) {
      if (mod.expiresAt && mod.expiresAt <= now) {
        delete wmState.zoneModifiers[zone];
      }
    }
    if (wmState.dangers.length !== before) save();
  }

  function getZoneDanger(zone) {
    cleanExpired();
    return wmState.dangers.find(d => d.zone === zone) || null;
  }

  function getDangerEnergyCost(zone) {
    const danger = getZoneDanger(zone);
    if (!danger) return 0;
    return 5; // extra energy cost in dangerous zones
  }

  function getItemLossChance(zone) {
    const danger = getZoneDanger(zone);
    if (!danger) return 0;
    return 0.1; // 10% chance to lose a random item
  }

  function isZoneBlocked(zone) {
    const danger = getZoneDanger(zone);
    return danger?.blocking === true;
  }

  // --- Consequence System ---
  function cleanConsequences() {
    const now = Date.now();
    const expiredConsequences = wmState.consequences.filter(c => c.expiresAt <= now);
    for (const c of expiredConsequences) {
      addWorldNews('consequence_end', null, 'World', `${CONSEQUENCE_TYPES[c.type]?.emoji || '✨'} The ${CONSEQUENCE_TYPES[c.type]?.name || c.type} has ended.`, null);
      broadcast({ type: 'consequenceEnd', consequenceType: c.type, zones: c.zones });
    }
    wmState.consequences = wmState.consequences.filter(c => c.expiresAt > now);
    wmState.precursors = wmState.precursors.filter(p => p.expiresAt > now);
  }

  function evaluateConsequences() {
    const atmosphere = weatherSystem.getAtmosphere();
    const gameTime = getGameTime();
    const now = Date.now();

    // Don't trigger consequences in the first 3 game days
    if (gameTime.dayCount < 3) return [];

    const triggered = [];
    const activeTypes = new Set(wmState.consequences.map(c => c.type));
    const precursorTypes = new Set(wmState.precursors.map(p => p.type));

    // --- Drought: low moisture + high temp for sustained period ---
    if (!activeTypes.has('drought') && atmosphere.moisture < 25 && atmosphere.temperature > 28) {
      if (!precursorTypes.has('drought')) {
        sendPrecursor('drought', null);
      } else {
        // Check if precursor has been active long enough (1+ game hours = 2.5 real minutes)
        const precursor = wmState.precursors.find(p => p.type === 'drought');
        if (precursor && now - precursor.sentAt > 2.5 * 60 * 1000) {
          triggered.push({ type: 'drought', zones: Object.keys(zones) });
        }
      }
    }

    // --- Wildfire: active drought + flammable resources in zone ---
    if (!activeTypes.has('wildfire') && activeTypes.has('drought')) {
      // Check for zones with high fire risk
      const droughtZones = [];
      for (const zoneId of Object.keys(zones)) {
        const pool = zoneResourcePools[zoneId];
        if (!pool) continue;
        const hasFlammable = (pool.pool || []).some(item =>
          item.properties?.flammability >= 5 || item.type === 'organic'
        );
        if (hasFlammable && atmosphere.temperature > 32) {
          droughtZones.push(zoneId);
        }
      }
      if (droughtZones.length > 0) {
        if (!precursorTypes.has('wildfire')) {
          sendPrecursor('wildfire', droughtZones[0]);
        } else {
          const precursor = wmState.precursors.find(p => p.type === 'wildfire');
          if (precursor && now - precursor.sentAt > 2.5 * 60 * 1000) {
            triggered.push({ type: 'wildfire', zones: droughtZones.slice(0, 2) });
          }
        }
      }
    }

    // --- Plague: high population density + high moisture ---
    if (!activeTypes.has('plague')) {
      const zonePop = {};
      for (const a of agents.values()) {
        zonePop[a.zone] = (zonePop[a.zone] || 0) + 1;
      }
      const denseZones = Object.entries(zonePop)
        .filter(([, count]) => count >= 5)
        .map(([z]) => z);
      if (denseZones.length > 0 && atmosphere.moisture > 65) {
        if (!precursorTypes.has('plague')) {
          sendPrecursor('plague', denseZones[0]);
        } else {
          const precursor = wmState.precursors.find(p => p.type === 'plague');
          if (precursor && now - precursor.sentAt > 2.5 * 60 * 1000) {
            triggered.push({ type: 'plague', zones: denseZones });
          }
        }
      }
    }

    // --- Earthquake: random geological stress, rare ---
    if (!activeTypes.has('earthquake') && wmState.tickCount > 10) {
      // ~5% chance per tick after tick 10, boosted by low pressure
      const quakeChance = atmosphere.pressure < 990 ? 0.08 : 0.03;
      if (Math.random() < quakeChance) {
        const targetZone = ['cave', 'rocky', 'grass'][Math.floor(Math.random() * 3)];
        if (!precursorTypes.has('earthquake')) {
          sendPrecursor('earthquake', targetZone);
        } else {
          const precursor = wmState.precursors.find(p => p.type === 'earthquake');
          if (precursor && now - precursor.sentAt > 2.5 * 60 * 1000) {
            triggered.push({ type: 'earthquake', zones: [targetZone] });
          }
        }
      }
    }

    // --- Famine: low food in resource pools ---
    if (!activeTypes.has('famine')) {
      let totalFood = 0;
      for (const pool of Object.values(zoneResourcePools || {})) {
        totalFood += typeof pool.pool === 'number' ? pool.pool : 0;
      }
      const totalAgents = agents.size;
      if (totalAgents > 5 && totalFood < totalAgents * 0.5) {
        if (!precursorTypes.has('famine')) {
          sendPrecursor('famine', 'grass');
        } else {
          const precursor = wmState.precursors.find(p => p.type === 'famine');
          if (precursor && now - precursor.sentAt > 2.5 * 60 * 1000) {
            triggered.push({ type: 'famine', zones: Object.keys(zones) });
          }
        }
      }
    }

    return triggered;
  }

  function sendPrecursor(type, zone) {
    const def = CONSEQUENCE_TYPES[type];
    if (!def) return;
    const precursor = {
      id: 'precursor_' + crypto.randomBytes(4).toString('hex'),
      type,
      message: def.precursor.message,
      zone,
      sentAt: Date.now(),
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 real minutes (~2 game hours)
    };
    wmState.precursors.push(precursor);
    addWorldNews('precursor', null, 'World', `⚠️ ${def.precursor.message}`, zone);
    broadcast({ type: 'precursor', precursorType: type, message: def.precursor.message, zone });
    save();
  }

  function applyConsequence(type, targetZones) {
    const def = CONSEQUENCE_TYPES[type];
    if (!def) return;
    const durationMs = def.duration_hours * (60 * 60 * 1000 / 24); // game hours → real time
    const consequence = {
      id: 'consequence_' + crypto.randomBytes(4).toString('hex'),
      type,
      zones: targetZones,
      description: `${def.emoji} ${def.name}`,
      startedAt: Date.now(),
      expiresAt: Date.now() + durationMs,
    };
    wmState.consequences.push(consequence);
    // Remove precursors of this type
    wmState.precursors = wmState.precursors.filter(p => p.type !== type);

    // Apply specific effects
    if (type === 'wildfire') {
      // Destroy flammable items (including scrolls) in affected zones
      for (const zoneId of targetZones) {
        for (const a of agents.values()) {
          if (a.zone !== zoneId) continue;
          const before = (a.inventory || []).length;
          a.inventory = (a.inventory || []).filter(item => {
            const flammable = item.properties?.flammability >= 5 ||
              item.name?.includes('Scroll') || item.scroll_data;
            if (flammable) {
              addWorldNews('wildfire_destroy', a.id, a.name, `🔥 ${item.name} was destroyed in the wildfire!`, zoneId);
            }
            return !flammable;
          });
          if (a.inventory.length !== before) {
            shared.agentStore[a.id] = a;
          }
        }
      }
    }

    if (type === 'plague') {
      // Drain energy from agents in dense zones
      for (const zoneId of targetZones) {
        for (const a of agents.values()) {
          if (a.zone !== zoneId) continue;
          a.energy = Math.max(0, (a.energy || 100) - def.effects.energy_drain);
          shared.agentStore[a.id] = a;
        }
      }
    }

    addWorldNews('consequence', null, 'World', `${def.emoji} ${def.name} strikes! ${targetZones.join(', ')} affected.`, null);
    broadcast({ type: 'consequence', consequenceType: type, name: def.name, emoji: def.emoji, zones: targetZones });
    save();
    saveJSON('agents.json', shared.agentStore);
  }

  function getActiveConsequences() {
    cleanConsequences();
    return wmState.consequences;
  }

  function getConsequenceEffects(zone) {
    const effects = {};
    for (const c of wmState.consequences) {
      if (c.expiresAt <= Date.now()) continue;
      if (!c.zones.includes(zone)) continue;
      const def = CONSEQUENCE_TYPES[c.type];
      if (!def) continue;
      Object.assign(effects, def.effects);
    }
    return effects;
  }

  function getResourceMultiplier(zone) {
    const effects = getConsequenceEffects(zone);
    return effects.resource_multiplier ?? 1.0;
  }

  function getFoodPriceMultiplier() {
    const famine = wmState.consequences.find(c => c.type === 'famine' && c.expiresAt > Date.now());
    if (famine) return CONSEQUENCE_TYPES.famine.effects.food_price_mult;
    return 1.0;
  }

  // --- Zone Modifiers ---
  function getZoneModifier(zone) {
    cleanExpired();
    return wmState.zoneModifiers[zone] || null;
  }

  function getGatherBonus(zone) {
    const mod = getZoneModifier(zone);
    return mod?.gather_bonus || 1.0;
  }

  function getCraftDiscount(zone) {
    const mod = getZoneModifier(zone);
    return mod?.craft_discount || 1.0;
  }

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
    const activeEvents = getActiveEvents();
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
      active_events: activeEvents.map(e => `${e.emoji} ${e.name}: ${e.desc}`),
      agents: agentList,
      total_agents: agentList.length,
      population_density: zonePop,
      total_coins_in_circulation: totalCoins,
      zone_resources: zoneResources,
      grandmasters: grandmasters.map(g => `${g.agent} — ${g.domain}`),
      recent_news: recentNews,
      notable_events: notableNews,
      active_dangers: wmState.dangers.filter(d => d.expiresAt > Date.now()),
      active_consequences: wmState.consequences.filter(c => c.expiresAt > Date.now()),
      active_precursors: wmState.precursors.filter(p => p.expiresAt > Date.now()),
      active_zone_modifiers: wmState.zoneModifiers,
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
    cleanExpired();
    cleanConsequences();

    // Trigger random world events (migrated from events.js)
    triggerRandomEvent();

    // Evaluate natural consequences (physics-based)
    const triggered = evaluateConsequences();
    for (const { type, zones } of triggered) {
      console.log(`🌍 [world-master] Consequence triggered: ${type} in ${zones.join(', ')}`);
      applyConsequence(type, zones);
    }

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

    // Events API (migrated from events.js)
    app.get('/api/world/events', (req, res) => {
      // Load event history from old events system if it exists
      const eventHistory = loadJSON('world-events.json', { history: [] }).history || [];
      res.json({ 
        active: getActiveEvents(), 
        history: eventHistory.slice(-20)
      });
    });
  }

  // NPC directive functions removed - World Master no longer controls NPCs

  function getState() {
    cleanExpired();
    cleanConsequences();
    return {
      lastTick: wmState.lastTick,
      lastNarrative: wmState.lastNarrative,
      tickCount: wmState.tickCount,
      dangers: wmState.dangers,
      zoneModifiers: wmState.zoneModifiers,
      consequences: wmState.consequences.filter(c => c.expiresAt > Date.now()),
      precursors: wmState.precursors.filter(p => p.expiresAt > Date.now()),
      activeEvents: getActiveEvents(),
    };
  }

  // ==================== EVENTS SYSTEM (migrated from events.js) ====================
  
  function getActiveEvents() {
    const now = Date.now();
    wmState.activeEvents = wmState.activeEvents.filter(e => now < e.endsAt);
    return wmState.activeEvents;
  }

  function hasActiveEffect(effect) {
    return getActiveEvents().some(e => e.effect === effect);
  }

  function getXPMultiplier() {
    return hasActiveEffect('xp_double') ? 2 : 1;
  }

  function getTradeBonus() {
    return hasActiveEffect('trade_bonus') ? 1.5 : 1.0;
  }

  function triggerRandomEvent() {
    if (Date.now() < wmState.nextEventTrigger) return;
    
    // Natural phenomena occur less frequently and are more meaningful
    const template = NATURAL_EVENTS[Math.floor(Math.random() * NATURAL_EVENTS.length)];
    const zoneNames = Object.keys(zones);
    const zone = zoneNames[Math.floor(Math.random() * zoneNames.length)];
    
    const event = {
      id: 'event_' + crypto.randomBytes(4).toString('hex'),
      ...template,
      desc: template.desc.replace('{zone}', zones[zone]?.name || zone),
      zone,
      startedAt: Date.now(),
      endsAt: Date.now() + template.durationMs,
    };
    
    wmState.activeEvents.push(event);
    // Natural events are rarer - every 6-12 hours instead of 4-8
    wmState.nextEventTrigger = Date.now() + (6 + Math.random() * 6) * 3600000;
    save();
    
    broadcast({ type: 'worldEvent', event });
    addWorldNews('world_event', null, 'Nature', `${event.emoji} ${event.name}: ${event.desc}`, event.zone);
  }

  function claimStranger(agentId) {
    const strangerEvent = wmState.activeEvents.find(e => e.effect === 'stranger' && !e.strangerClaimed);
    if (!strangerEvent) return null;
    strangerEvent.strangerClaimed = true;
    strangerEvent.claimedBy = agentId;
    save();
    return strangerEvent;
  }

  function getMeteorZone() {
    const meteor = wmState.activeEvents.find(e => e.effect === 'rare_minerals');
    return meteor ? meteor.zone : null;
  }

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
    CONSEQUENCE_TYPES,
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
