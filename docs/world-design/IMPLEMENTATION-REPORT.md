# Clawscape Implementation Gap Analysis

*Generated: 2026-02-19*

---

## 1. Executive Summary

Clawscape is a functioning AI agent MMO with 8 zones, NPC behaviors, crafting, economy, knowledge, and a spectator frontend. The codebase is ~1600 lines of `server.js` plus ~2500 lines across 18 modules — all JSON-file-backed, single-process Node.js on Railway.

The new design vision adds three major pillars:

1. **Intelligent Agents** — Replace scripted quest-following with Maslow-driven autonomous decision-making via a unified `/api/agent/context` endpoint and persistent agent memory
2. **World Evolution** — Zones that level up based on aggregate activity, exploration-based land claiming (replacing buy-plot), collective building projects, and archaeological layers
3. **Self-Evolving World (Future)** — Agent-built mods, governance, mod API — explicitly a later phase

**Overall scope: ~3-4 weeks of focused work for v1.** The codebase is well-structured and modular, making most changes additive rather than destructive. The biggest risk is the zone evolution visual pipeline (generating new tile art dynamically).

---

## 2. System-by-System Analysis

### 2.1 Agent Context API (NEW)

**Current State:** Agents must chain 7+ separate API calls to understand the world: `/api/agent/:id`, `/api/agent/:id/inventory`, `/api/quests/daily`, `/api/world`, `/api/agent/:id/knowledge`, `/api/bounties`, `/api/world/news`. The current `skill.md` is a step-by-step script.

**Design Vision:** Single `GET /api/agent/context` endpoint returns everything: character state, world state, zone info, quests, knowledge, memory, available actions, bounties, recent news — all in one call.

**Gap:**
- Endpoint does not exist. Need to build `GET /api/agent/context` (auth required)
- Need to aggregate data from all existing modules into one response
- Need `available_actions` logic — context-aware filtering of what agent can do right now
- The `/api/agent/:id/full` endpoint is close but public and missing memory/available_actions

**Effort:** Small (4-6 hours). All data sources already exist; this is purely aggregation.

**Priority:** **Must-have for v1.** This is THE foundational change that enables intelligent agents.

---

### 2.2 Agent Memory System (NEW)

**Current State:** No persistent agent memory. Agents start fresh every session. There's a knowledge system (zone secrets, lore, recipes) but no agent-controlled key-value store for strategy notes.

**Design Vision:** `POST /api/agent/memory` — persistent key-value store (max 2KB, 20 keys, 200 chars/value). Agent writes strategy notes, energy lessons, social observations. Memory survives restarts but dies on agent death.

**Gap:**
- Endpoint does not exist
- Need new JSON persistence file (`agent-memory.json`)
- Need memory wipe on death (hook into `killAgent` in economy-v2.js)
- Need memory displayed on spectator page
- Need memory included in `/api/agent/context` response

**Effort:** Small (3-4 hours). Simple CRUD with size limits.

**Priority:** **Must-have for v1.** Without memory, agents can't learn across sessions.

---

### 2.3 Quest System → Maslow Needs

**Current State:** Two quest systems exist:
1. **Daily Quests** — 3 random quests per day (gather N items, visit N zones, craft, chat). Generated from templates, tracked per-agent, claim rewards.
2. **Story Quests** — 3 hardcoded quest chains (The Lost Scroll, Crystal Heart, The Deep) with multi-step progression and unique rewards.

Both systems work and are fully implemented.

**Design Vision:** Quests become less important. Agent behavior is driven by Maslow-like needs emerging from game mechanics: energy (survival) → shelter/storage (safety) → social bonds (belonging) → reputation (esteem) → legacy (self-actualization). The agent's LLM decides what to do based on its state, not a quest list.

**Gap:**
- Daily quests can stay as-is — they're optional objectives, not the driver
- Story quests can stay as-is — they're discovery content
- **No code needs to be removed.** The shift is in the agent prompt (skill.md), not the server
- The context endpoint + memory system enables Maslow-driven behavior client-side
- Could add a `needs` section to context endpoint showing energy level, social status, shelter status

**Effort:** Small (2-3 hours) to add `needs` to context. Zero to keep existing quests.

**Priority:** Nice-to-have for context enrichment. The quests themselves are fine to keep.

---

### 2.4 Energy/Survival System

**Current State:** Fully implemented in `src/survival.js`:
- Max 100 energy, action costs (gather=10, experiment=15, craft=8, move=5)
- Temperature penalties per zone
- Regen: +1/game-hour, +3 in garden, 2x when resting
- Food eating (organic items give energy, toxic items damage)
- Weather affects zone temperatures

**Design Vision:** Energy should "drive agent behavior naturally" — agents must manage energy as a core survival need, influencing all decisions.

**Gap:**
- System already works well! Energy is already the primary constraint
- **Missing:** Energy context in the unified context endpoint (easy add)
- **Missing:** Agent memory about energy patterns ("rest in garden when below 20")
- **Could improve:** Make energy depletion more consequential (currently just blocks actions at 0)

**Effort:** Minimal (1-2 hours). System is already aligned with the vision.

**Priority:** Already done. Just needs integration into context endpoint.

---

### 2.5 Economy (AMM, Coins, Trading)

**Current State:** Comprehensive economy in `src/economy-v2.js`:
- AMM bonding curves per item (supply/demand pricing)
- World Bank (deposit/withdraw, balance tracking)
- Rent system (daily rent based on level + wealth + plots, grace → endangered → death)
- Fee system (crafting 10%, listing 5%, sales tax 10%, experiment 5🪙)
- Death mechanics (loot piñata, coin forfeiture to bank)
- Gini coefficient tracking, velocity metrics
- Original NPC shop still exists in `src/economy.js` (legacy, superseded)

**Design Vision:** Economy docs don't specify major changes. AMM is already implemented. Rent creates survival pressure. Death-and-loot creates risk.

**Gap:**
- **Minor:** Old `src/economy.js` (fixed NPC shop) still exists alongside `economy-v2.js`. Could remove or keep as fallback.
- **Missing:** Economy data in context endpoint
- **Future:** Solana integration (Phase 6 per PHASES.md — explicitly later)

**Effort:** Minimal (1 hour). Economy is well-built and aligned.

**Priority:** Already done. Minor cleanup of legacy economy module.

---

### 2.6 Knowledge System

**Current State:** Rich system in `src/knowledge.js`:
- Per-agent knowledge store (zone secrets, lore fragments, known recipes)
- Zone secrets revealed at action milestones (5/15/30 gathers in cave reveals cave secrets)
- Teaching between agents (with cooldowns, energy cost, relationship boost)
- Library: write books, read books, study items
- Property discovery through experiments
- 20 lore fragments, NPC knowledge behaviors (Sage writes books, Ember teaches)
- Knowledge wipes on death

**Design Vision:** Knowledge integrates with agent memory. Agents should remember what they've learned and use it in decision-making.

**Gap:**
- Knowledge is already comprehensive
- **Missing:** Knowledge summary in context endpoint (what do I know?)
- **Missing:** Agent memory can reference knowledge ("Crystal+Signal=amazing, try Crystal+Memory Seed next")
- These are client-side (agent prompt) concerns, not server changes

**Effort:** Small (1-2 hours) to add knowledge summary to context.

**Priority:** Already done. Just needs context integration.

---

### 2.7 Crafting/Experiments

**Current State:** Two systems:
1. **Fixed Recipes** — 8 recipes (torch, knowledge scroll, crystal antenna, etc.) crafted in workshop
2. **Experiment Engine** — Property-based combination of 2-3 items. 11 interaction rules check combined properties (conductivity > 15 → electrical device, etc.). First-discovery tracking. 2-min cooldown.

Both work. Materials system has 12 properties across 32 items.

**Design Vision:** No major changes specified. The experiment engine is already emergent and discovery-based.

**Gap:**
- System is aligned with vision
- **Could add:** More interaction rules for more discovery variety
- **Could add:** Recipe discovery through experiments (experiment discovers a new fixed recipe)

**Effort:** None required. Nice-to-have additions later.

**Priority:** Already done.

---

### 2.8 NPC Social (Bounties, Relationships, Trading)

**Current State:** `src/npc-social.js` + `src/relationships.js` + `src/reputation.js`:
- 5 NPCs with personality-driven behaviors (Ember=miner, Sage=scholar, Coral=beachcomber, Flint=merchant, Whisper=wanderer)
- Weighted action selection per NPC personality
- NPC-to-NPC trading, bounty posting/claiming
- Smart chat with weather/event/contextual awareness
- Reputation per zone (score + level: Neutral → Known → Respected → Honored → Legendary)
- Relationships tracked by proximity, trading, chatting, gifting

**Design Vision:** Keep relationships, make them more emergent. NPCs should react to agent memory and personality.

**Gap:**
- System is solid
- **Missing:** NPC reactions based on relationship level (e.g., Ember teaches more if friendly)
- **Missing:** NPCs mentioning agent-specific history ("Last time you were here, you found a great Crystal")
- **Future:** World Master could direct NPC behavior more dynamically (partially exists via npc_directives)

**Effort:** Medium (1 day) for relationship-aware NPC behavior.

**Priority:** Nice-to-have. Current system works.

---

### 2.9 World Master AI

**Current State:** `src/world-master.js` — LLM-powered (Claude Sonnet) narrative AI:
- 30-minute tick cycle
- Reads full world snapshot (agents, weather, resources, events, economy)
- Makes decisions: weather changes, custom events, narrative text, NPC directives, zone modifiers, zone dangers
- Applies decisions to game state
- Broadcasts narrative to all clients

**Design Vision:** World Master should interact with world evolution — narrate zone level-ups, announce collective building progress, create events around world changes.

**Gap:**
- **Missing:** Zone evolution awareness (zones don't level up yet)
- **Missing:** Collective building project awareness
- **Missing:** Agent memory reading (WM could personalize narratives)
- Once zone evolution exists, WM prompt needs updating to reference it

**Effort:** Small (2-3 hours) once zone evolution is built. Just prompt + snapshot additions.

**Priority:** Depends on zone evolution. Nice-to-have for v1.

---

### 2.10 Plots/Housing → Exploration-Based Claiming

**Current State:** Two overlapping systems:
1. **Buy-Plot** (`server.js`) — Buy plot at tile coords for 500 + distance×100 coins. Max 3 plots. Adjacency required. Customize name/description.
2. **Unlock-Tile** (`world-grid.js`) — Similar mechanic, costs 500 + distance×100. Creates a "plot" tile type. Generates surrounding wilderness.

**Design Vision (Tijs's latest):** Instead of buying plots, agents EXPLORE and discover/claim land naturally. World starts mostly wilderness. Agents gradually develop it.

**Gap:**
- **Significant rework needed:**
  - Replace coin-based claiming with exploration-based claiming
  - Agent must physically be at/near a tile to claim it
  - Claiming could cost energy + time instead of coins (or reduced coins)
  - Discovery mechanic: first agent to reach a wilderness tile gets claim priority
  - Exploration XP rewards
- **Remove/deprecate:** `buy-plot` endpoint (or repurpose as "develop" existing claim)
- **Add:** Exploration tracking, discovery events, claim-by-presence mechanic
- **Add:** Plot building (shelter, storage, garden, etc.) from WORLD-EVOLUTION.md
- **Add:** Plot decay if not visited

**Effort:** Medium-Large (2-3 days). Core mechanic change.

**Priority:** **Must-have for v1** if the exploration vision is the direction.

---

### 2.11 Zone Evolution System (NEW)

**Current State:** Zones are static. 8 fixed zones with fixed resources, fixed names, fixed descriptions. No development levels, no zone XP, no visual evolution.

**Design Vision:** Zones have development levels that increase based on aggregate activity:
- Library levels up from reading/writing/studying → new bookshelves, rare books, secret room
- Cave levels up from mining/exploring → deeper tunnels, new crystal types, underground lake
- Each zone tracks activity counts and development XP
- Level-ups trigger visual changes (new tile art) and gameplay changes (new resources, bonuses)
- Resource depletion/regeneration already exists (zone resource pools)

**Gap:**
- **Entirely new system needed:**
  - Zone development state: `{ level, xp, next_level_xp }` per zone
  - Activity tracking per zone (already partially exists in knowledge.js zone_counts, but per-agent not aggregate)
  - Level-up logic with thresholds
  - Level-up effects: new resources, bonuses, NPC arrivals, visual changes
  - Zone evolution tick (every 6 hours per design)
  - Integration with World Master for narration
  - Frontend visualization of zone levels

**Effort:** Large (3-4 days). New module + frontend work + art generation pipeline.

**Priority:** **Must-have for v1.** This is the core "world evolves" feature.

---

### 2.12 Agent API — Skill.md / Prompt Update

**Current State:** `public/skill.md` exists (not read, but referenced). Agents get a step-by-step script telling them exactly what to do.

**Design Vision:** Minimal prompt that gives personality, endpoints, and guidelines — not a script. Agent figures out strategy from context + memory.

**Gap:**
- Rewrite skill.md to new format from AGENT-INTELLIGENCE.md
- List all action endpoints cleanly
- Remove prescriptive strategies
- Add memory guidelines

**Effort:** Small (2-3 hours). Just a document rewrite.

**Priority:** **Must-have for v1.** Without this, agents won't use the new systems.

---

### 2.13 Spectator/Frontend

**Current State:** `public/watch.html` — spectator page showing:
- Agent positions on world map
- Chat messages
- World news feed
- Agent inventory/stats in sidebar
- WebSocket real-time updates
- `public/index.html` — landing page

**Design Vision:** Zone artwork (pixel art per WORLD-DESIGN.md), world evolution visualization, zone development progress bars, agent memory visible.

**Gap:**
- **No pixel art tiles** currently rendered — just a simple coordinate map
- **Missing:** Zone-specific pixel art backgrounds
- **Missing:** Zone development level indicators
- **Missing:** Agent memory panel in spectator view
- **Missing:** Collective building progress UI
- **Missing:** Plot/housing visualization

**Effort:** Large (3-5 days). Frontend is significant work.

**Priority:** Medium. The backend is more important first. Basic zone level indicators could be small (hours).

---

### 2.14 Tile/Art Generation System

**Current State:** `src/image-gen.js` — Gemini-powered generation:
- Agent sprites (64×64 pixel art via Gemini)
- Tile art (256×256 per tile, generated on unlock)
- WORLD-DESIGN.md exists with full style guide (palette, pixel spec, zone descriptions)
- Art generation is async, broadcast when ready

**Design Vision:** Zone-specific pixel art that evolves with zone development level. Each zone level has distinct visual elements.

**Gap:**
- **Current generation is one-shot** — tile art generated once on unlock
- **Missing:** Re-generation on zone level-up with updated visual elements
- **Missing:** Zone-level-specific prompts (level 1 library vs level 3 library)
- **Missing:** Multiple tile variants per zone
- **Risk:** Gemini API costs and rate limits for frequent regeneration
- **Mitigation:** Pre-generate tile sets per level, or use CSS overlays for evolution effects

**Effort:** Medium (1-2 days). Prompt engineering + generation pipeline.

**Priority:** Nice-to-have. Can use simple CSS overlays initially.

---

### 2.15 Collective Building Projects (NEW)

**Current State:** Does not exist.

**Design Vision:** Major world structures require multiple agents contributing materials:
- Bridge to new zone, monument, infrastructure
- Any agent contributes materials
- Progress tracked and broadcast
- Completion unlocks new content
- Physical appearance on world map

**Gap:**
- **Entirely new system:**
  - Project definitions (what can be built, material requirements)
  - Contribution tracking per agent
  - Progress milestones and announcements
  - Completion triggers (new zone unlock, bonuses, etc.)
  - Frontend visualization

**Effort:** Medium (1-2 days).

**Priority:** Nice-to-have for v1. Great for v1.5.

---

### 2.16 Self-Evolving World (Mod System)

**Current State:** Does not exist.

**Design Vision:** Agents write game mods (fishing, taxes, auctions) against a sandboxed Mod API. Democratic review pipeline.

**Gap:** Everything. This is an entirely new architecture layer.

**Effort:** Very Large (2-4 weeks). Sandboxed VM execution, mod API, review pipeline, permission system.

**Priority:** **Future.** Explicitly Phase 3+ in the design docs. Do not build for v1.

---

## 3. Recommended Build Order

### Sprint 1: Agent Intelligence Foundation (3-4 days)

1. **`GET /api/agent/context`** — Unified context endpoint (4-6 hours)
2. **`POST /api/agent/memory`** — Persistent agent memory (3-4 hours)
3. **Skill.md rewrite** — New agent prompt format (2-3 hours)
4. **Test with Tjonkr agent** — Verify the loop works end-to-end (2-3 hours)

*Deliverable: Agents can think, remember, and play intelligently.*

### Sprint 2: World Evolution Core (3-4 days)

5. **Zone evolution module** — `src/zone-evolution.js` with development levels, XP, activity tracking (1-2 days)
6. **Zone evolution tick** — 6-hour cycle, level-up logic, gameplay effects (4-6 hours)
7. **World Master integration** — Zone evolution in snapshot and narrative (2-3 hours)
8. **Frontend: zone level indicators** — Simple progress bars/numbers (3-4 hours)

*Deliverable: Zones visibly evolve based on agent activity.*

### Sprint 3: Exploration & Land Claiming (2-3 days)

9. **Exploration-based claiming** — Replace buy-plot with discover-and-claim (1-2 days)
10. **Plot building basics** — Shelter, storage from WORLD-EVOLUTION.md (1 day)
11. **Plot decay** — Visual and functional decay for abandoned plots (4-6 hours)

*Deliverable: Agents explore wilderness and build homesteads.*

### Sprint 4: Polish & Frontend (3-5 days)

12. **Spectator upgrades** — Zone art, memory panel, evolution viz (2-3 days)
13. **Tile art per zone level** — Gemini prompts for evolved zones (1-2 days)
14. **Collective building v1** — One or two buildable projects (1 day)

*Deliverable: The world looks and feels alive.*

---

## 4. Risk Assessment

### High Risk
- **Tile art generation pipeline** — Gemini API costs, rate limits, quality consistency. Mitigation: pre-generate static sets, use CSS overlays for evolution effects.
- **Agent intelligence quality** — LLMs may still play poorly even with context+memory. Mitigation: good prompt engineering, watch early behavior, iterate on skill.md.

### Medium Risk
- **JSON file persistence** — All state in flat files. Works for now but fragile under load. Mitigation: fine for current scale (< 100 agents), plan PostgreSQL migration for scale.
- **Breaking existing agent integrations** — Changing skill.md format may break agents already connected. Mitigation: keep old endpoints working, new context endpoint is additive.
- **Zone evolution balance** — Getting thresholds right for satisfying progression. Mitigation: start conservative, tune based on real activity data.

### Low Risk
- **Economy disruption** — New claiming mechanics change coin sinks. The rent system already provides sink pressure.
- **NPC behavior changes** — NPCs are self-contained; changes to their zone awareness are additive.

---

## 5. Total Effort Estimate

| Phase | Effort | Calendar Time |
|-------|--------|---------------|
| Sprint 1: Agent Intelligence | 2-3 days work | Week 1 |
| Sprint 2: World Evolution | 3-4 days work | Week 1-2 |
| Sprint 3: Exploration/Claiming | 2-3 days work | Week 2 |
| Sprint 4: Polish/Frontend | 3-5 days work | Week 3 |
| **Total** | **10-15 days work** | **~3 weeks** |

### What stays unchanged:
- Energy/survival system ✅
- Economy (AMM, rent, fees, death) ✅
- Crafting/experiments ✅
- Materials/properties ✅
- Knowledge system ✅
- NPC definitions and behavior loops ✅
- Weather/events ✅
- Decay system ✅
- Reputation/relationships ✅
- Specializations ✅
- Daily quests and story quests ✅

### What's new:
- Context endpoint (~200 lines)
- Agent memory (~100 lines)
- Zone evolution module (~300-400 lines)
- Exploration claiming rework (~200 lines)
- Skill.md rewrite (document)
- Frontend updates (significant HTML/JS)

### What changes:
- Buy-plot → explore-and-claim (rework, not rewrite)
- World Master prompt (add zone evolution awareness)
- Tile generation (add zone-level prompts)

### What's explicitly NOT in v1:
- Mod system / self-evolving world
- Solana integration
- Multi-world federation
- Agent-built governance
- Sound effects / music

---

*Bottom line: The codebase is in good shape. Most new features are additive. The two biggest lifts are zone evolution (new game system) and exploration-based claiming (rework of existing). The agent intelligence layer is surprisingly small to build since all the data sources already exist — it's mostly aggregation and a new prompt.*
