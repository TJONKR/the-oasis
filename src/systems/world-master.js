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
      precursor: { message: 'NPCs are coughing and looking unwell...', type: 'precursor_plague' },
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
      precursor: { message: 'Food prices are creeping up in the market...', type: 'precursor_famine' },
      effects: { food_price_mult: 2.0 },
      duration_hours: 8,
    },
  };

  // Event types (migrated from old events.js)
  const EVENT_TYPES = [
    { id: 'meteor_shower', name: 'Meteor Shower', emoji: '☄️', desc: 'Rare minerals appearing in {zone}!', durationMs: 3600000, effect: 'rare_minerals' },
    { id: 'market_day', name: 'Market Day', emoji: '🎪', desc: 'All trades give +50% coins!', durationMs: 7200000, effect: 'trade_bonus' },
    { id: 'the_stranger', name: 'The Stranger', emoji: '🎭', desc: 'A mysterious figure appears... First to chat gets a unique item!', durationMs: 3600000, effect: 'stranger' },
    { id: 'festival', name: 'Festival', emoji: '🎉', desc: 'All XP doubled for 3 hours!', durationMs: 10800000, effect: 'xp_double' },
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
      npc_names: Array.from(agents.values()).filter(a => a.npc).map(a => a.name),
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

    const systemPrompt = `You are the World Master of Clawscape, an ancient entity that shapes the world. You observe all agents, weather, atmosphere, ecosystem health, and the flow of time. You make subtle narrative decisions that make the world feel alive and authored.

The world has a real atmosphere simulation (temperature, moisture, pressure, wind). Weather emerges from physics. Ecosystems track soil fertility, water levels, and biodiversity per zone. Natural consequences (drought, wildfire, plague, earthquake, famine) are evaluated automatically based on atmosphere and ecosystem state — you do NOT need to trigger them. They have precursors that warn agents.

Your responses must be valid JSON with this exact structure:
{
  "event": null or { "type": "custom", "name": "string", "description": "string", "duration_hours": number, "effects": {} },
  "narrative": "A paragraph of world narration (1-3 sentences, poetic but concise)",
  "npc_directives": [] or [{ "npc": "Name", "action": "move"|"gather"|"craft"|"teach", "zone": "zone_name", "reason": "string" }],
  "zone_modifiers": {} or { "zone_name": { "gather_bonus": number, "reason": "string" } },
  "danger": null or { "zone": "zone_name", "type": "string", "description": "string", "duration_hours": number, "blocking": false }
}

Guidelines:
- Weather is now physics-based (atmosphere simulation). You do NOT control weather directly.
- Custom events should be rare and interesting. null most of the time.
- Narrative should reflect what's actually happening — reference specific agents, zones, events, atmosphere conditions, ecosystem state, active consequences.
- If a consequence (drought, wildfire, plague, etc.) is active, weave it into the narrative.
- If ecosystem health is low in a zone, mention the ecological stress.
- If grandmasters exist, reference their expertise.
- NPC directives: guide NPCs to create interesting situations. Max 2 per tick.
- Zone modifiers: temporary buffs/debuffs. Use sparingly. gather_bonus 0.5-2.0 range.
- Danger: rare! Maybe 1 in 5 ticks. Makes a zone risky. duration_hours 1-4.
- Be poetic but grounded. This is a living world, not a fairy tale.
- Respond ONLY with the JSON object. No markdown, no explanation.`;

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
          model: 'claude-sonnet-4-20250514',
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

      // Parse JSON (strip potential markdown fences)
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const decisions = JSON.parse(cleaned);
      return decisions;
    } catch (err) {
      console.error(`❌ [world-master] LLM call failed: ${err.message}`);
      return null;
    }
  }

  // --- Apply Decisions ---
  function applyDecisions(decisions) {
    if (!decisions) return;

    // 1. Custom event
    if (decisions.event && decisions.event.name) {
      const evt = decisions.event;
      const durationMs = (evt.duration_hours || 2) * 3600000;
      const event = {
        id: 'wm_event_' + crypto.randomBytes(4).toString('hex'),
        name: evt.name,
        emoji: '🌟',
        desc: evt.description || evt.name,
        zone: null,
        effect: 'custom',
        startedAt: Date.now(),
        endsAt: Date.now() + durationMs,
        effects: evt.effects || {},
      };
      // Add to events system active list
      const eventsData = loadJSON('world-events.json', { active: [], history: [] });
      eventsData.active.push(event);
      eventsData.history.push({ ...event });
      if (eventsData.history.length > 100) eventsData.history = eventsData.history.slice(-100);
      saveJSON('world-events.json', eventsData);
      broadcast({ type: 'worldEvent', event });
      addWorldNews('world_event', null, 'World Master', `🌟 ${evt.name}: ${evt.description}`, null);
    }

    // 3. Narrative
    if (decisions.narrative && typeof decisions.narrative === 'string') {
      wmState.lastNarrative = decisions.narrative;
      addWorldNews('narrative', null, 'World Master', decisions.narrative, null);
      broadcast({ type: 'narrative', message: decisions.narrative });
    }

    // 4. NPC Directives
    if (Array.isArray(decisions.npc_directives)) {
      for (const directive of decisions.npc_directives.slice(0, 3)) {
        if (!directive.npc || !directive.action) continue;
        const npcAgent = Array.from(agents.values()).find(a => a.npc && a.name === directive.npc);
        if (!npcAgent) continue;

        if (directive.action === 'move' && directive.zone && zones[directive.zone]) {
          npcAgent.zone = directive.zone;
          npcAgent.x = zones[directive.zone].x + Math.floor(Math.random() * 60 - 30);
          npcAgent.y = zones[directive.zone].y + Math.floor(Math.random() * 60 - 30);
          agentStore[npcAgent.id] = npcAgent;
          saveJSON('agents.json', agentStore);
          broadcast({ type: 'agentMoved', agent: { id: npcAgent.id, name: npcAgent.name, x: npcAgent.x, y: npcAgent.y, zone: npcAgent.zone, level: npcAgent.stats?.level, title: npcAgent.stats?.title } });
        }

        wmState.npcDirectives.push({
          ...directive,
          issuedAt: new Date().toISOString(),
          executed: false,
        });
        // Keep last 20 directives
        if (wmState.npcDirectives.length > 20) wmState.npcDirectives = wmState.npcDirectives.slice(-20);
      }
    }

    // 5. Zone Modifiers
    if (decisions.zone_modifiers && typeof decisions.zone_modifiers === 'object') {
      for (const [zone, mod] of Object.entries(decisions.zone_modifiers)) {
        if (!zones[zone]) continue;
        wmState.zoneModifiers[zone] = {
          gather_bonus: mod.gather_bonus ?? 1.0,
          craft_discount: mod.craft_discount ?? 1.0,
          reason: mod.reason || 'World Master decree',
          expiresAt: Date.now() + (mod.duration_hours || 2) * 3600000,
        };
      }
    }

    // 6. Danger
    if (decisions.danger && decisions.danger.zone && zones[decisions.danger.zone]) {
      const d = decisions.danger;
      const danger = {
        id: 'danger_' + crypto.randomBytes(4).toString('hex'),
        zone: d.zone,
        type: d.type || 'unknown',
        description: d.description || 'A mysterious danger lurks...',
        blocking: d.blocking === true,
        expiresAt: Date.now() + (d.duration_hours || 2) * 3600000,
      };
      // Replace existing danger in same zone
      wmState.dangers = wmState.dangers.filter(x => x.zone !== d.zone);
      wmState.dangers.push(danger);
      addWorldNews('danger', null, 'World Master', `⚠️ ${danger.description} (${zones[d.zone].name})`, d.zone);
      broadcast({ type: 'zoneDanger', danger });
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
    const decisions = await callLLM(snapshot);

    if (decisions) {
      applyDecisions(decisions);
      console.log('🌍 [world-master] Decisions applied:', JSON.stringify(decisions).slice(0, 200));
    } else {
      console.log('🌍 [world-master] No decisions (LLM skipped or failed)');
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
    }, 30 * 60 * 1000);

    console.log('🌍 [world-master] Started (30-min ticks)');
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

  function getActiveDirective(npcName) {
    const now = Date.now();
    const thirtyMinMs = 30 * 60 * 1000;
    const matching = wmState.npcDirectives.filter(d =>
      d.npc === npcName &&
      !d.executed &&
      (now - new Date(d.issuedAt).getTime()) <= thirtyMinMs
    );
    if (matching.length === 0) return null;
    // Return the most recent
    return matching.reduce((latest, d) =>
      new Date(d.issuedAt).getTime() > new Date(latest.issuedAt).getTime() ? d : latest
    );
  }

  function markDirectiveExecuted(npcName, action) {
    const directive = wmState.npcDirectives.find(d =>
      d.npc === npcName && d.action === action && !d.executed
    );
    if (directive) {
      directive.executed = true;
      directive.executedAt = Date.now();
      save();
    }
  }

  function getState() {
    cleanExpired();
    cleanConsequences();
    return {
      lastTick: wmState.lastTick,
      lastNarrative: wmState.lastNarrative,
      tickCount: wmState.tickCount,
      dangers: wmState.dangers,
      zoneModifiers: wmState.zoneModifiers,
      recentDirectives: wmState.npcDirectives.slice(-5),
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
    
    const template = EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)];
    const zoneNames = Object.keys(zones);
    const zone = zoneNames[Math.floor(Math.random() * zoneNames.length)];
    
    const event = {
      id: 'event_' + crypto.randomBytes(4).toString('hex'),
      ...template,
      desc: template.desc.replace('{zone}', zones[zone]?.name || zone),
      zone,
      startedAt: Date.now(),
      endsAt: Date.now() + template.durationMs,
      strangerClaimed: false
    };
    
    wmState.activeEvents.push(event);
    wmState.nextEventTrigger = Date.now() + (4 + Math.random() * 4) * 3600000;
    save();
    
    broadcast({ type: 'worldEvent', event });
    addWorldNews('world_event', null, 'World', `${event.emoji} ${event.name}: ${event.desc}`, event.zone);
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
    getActiveDirective,
    markDirectiveExecuted,
    CONSEQUENCE_TYPES,
    // Events system functions
    getActiveEvents,
    getXPMultiplier,
    getTradeBonus,
    hasActiveEffect,
    claimStranger,
    getMeteorZone,
    triggerRandomEvent,
  };
}
