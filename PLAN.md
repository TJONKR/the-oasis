# The Oasis — Master Implementation Plan

*Created: 2026-03-01*
*Based on: All docs in `docs/world-design/`*

---

## Vision

A persistent AI-agent survival sandbox where 32+ autonomous agents explore a procedurally generated 2000×2000 tile world, gather resources, craft tools, build settlements, trade knowledge, form relationships, and create emergent civilization — all driven by personality, needs, and physics. No scripts. No quests. Just rules of nature and AI minds.

---

## Current State

**What works today:**
- 2000×2000 procedural world with 10 terrain types, rivers, biomes, decorations
- v6 pixel-art tile renderer (16px/tile, hillshading, trees, chunk streaming)
- 32 AI agents with personality traits, intent-based decisions, vision system
- Tile-by-tile movement with terrain costs (1 tile/tick at 500ms)
- Decoration-based resource gathering (26 resource types)
- All 11 action executors: move, gather, rest, explore, chat, eat, craft, experiment, gift, fight, build
- Survival: energy, hunger, day/night cycle, weather effects
- Social: relationships, gifting, teaching, NPC trading
- Knowledge: zone exploration, lore, teaching during chats
- Crafting: cooking for food, experiments for combinations
- World Master: LLM narrator (needs API key)
- Frontend: pan/zoom, minimap, HUD, agent panel, news feed, smooth lerp animation
- WebSocket server with lightweight broadcasts

**What's broken/incomplete:**
- Server crashes every ~30 min (memory pressure from 2000×2000 world data)
- Agents starving (eat/rest cycle can't keep up with hunger drain)
- Agent intents display "idle" too often
- World Master needs ANTHROPIC_API_KEY

---

## The Plan: 4 Core Phases (+ 3 Future)

Phases 1-4 are the focus. These are what make agents *think* and the world *feel alive*. Phases 5-7 (building, economy, mods) come later once the foundation is solid.

Each phase builds on the previous. Every phase produces a playable, improved version.

---

## Phase 1: Stability & Survival Balance
*"Make what exists actually work reliably"*

### 1.1 — Fix Server Memory (Critical)
The 2000×2000 world + decorations + 32 agents + 500ms ticks overwhelms macOS memory limits.

- [ ] **Lazy-load world data** — only keep active chunks in memory (agents' nearby tiles), swap rest to disk
- [ ] **Spatial indexing** — replace full-world scans with quadtree/grid-bucket lookups for `scanVisible()`
- [ ] **Decoration compression** — store decorations as sparse map instead of dense array
- [ ] **GC tuning** — run with `--max-old-space-size=2048` and `--expose-gc` for manual GC between ticks
- [ ] **Memory profiling** — identify actual leak source (heap snapshots)

### 1.2 — Fix Survival Balance (Critical)
Agents die of starvation because the eat/rest cycle can't keep up.

- [ ] **Emergency eat threshold** — when hunger > 60 AND has food, eat takes absolute priority (override all intents)
- [ ] **Emergency rest threshold** — when energy < 15, rest takes absolute priority
- [ ] **Reduce hunger rate** — tune from 0.08/tick down until agents can sustain (~0.04/tick)
- [ ] **Food abundance** — increase food drops from gathering (berries, mushrooms, fish, coconuts)
- [ ] **Fix gift-over-eat bug** — agents gifting food when they're starving (priority check)
- [ ] **Rest effectiveness** — ensure rest actually recovers enough energy per tick to matter

### 1.3 — Fix Intent Display
- [ ] **Show current action, not just pending intent** — when intent completes, show "gathering" or "eating" instead of "idle"
- [ ] **Persist last meaningful action** for display purposes
- [ ] **Thought bubbles on map** — small emoji/icon above agent showing current activity

**Exit criteria:** Server runs 24h+ without crash. Agents maintain stable energy/hunger cycles. UI shows meaningful activity.

---

## Phase 2: Material Properties & Physics Engine
*"No recipes. Just physics."*

This is the single most transformative system from the design docs. It replaces static crafting with emergent discovery through material properties and natural forces.

### 2.1 — Material Property System
Every resource gets physical properties that determine what happens when forces are applied.

- [ ] **Define property schema** — flammable, meltable:T, metallic, brittle, malleable, conductive, toxic, fertile, buoyant, sharp, absorbent, luminous, medicinal, organic, soluble, heat_resistant
- [ ] **Tag all 26 existing resources** with properties:
  - wood → flammable, buoyant, workable
  - stone → hard, heat_resistant, heavy
  - ore → metallic, meltable:800, heavy
  - crystals → brittle, conductive, luminous
  - herbs → organic, medicinal
  - mushrooms → organic (some toxic)
  - resin → flammable, sticky, organic
  - fiber → flammable, flexible, absorbent
  - etc.
- [ ] **Add derived materials** — charcoal, ash, molten iron, iron ingot, glass, bread, stew, rope, tools
- [ ] **Temperature model** — ambient temp per tile (elevation + weather + time of day), heat sources with thresholds

### 2.2 — Natural Forces & Interaction Engine
Forces are verbs agents apply to matter. The engine resolves physics.

- [ ] **Define 11 forces**: heat, cool, impact, cut, combine, dissolve, grow, burn, flow, decay, ferment
- [ ] **Build property interaction table** — the core physics rules:
  - heat + flammable → fire + ash (if heat ≥ ignition point)
  - heat + meltable:T → molten form (if effective heat ≥ T)
  - heat + organic → cooked form (if 100 ≤ heat < ignition)
  - impact + brittle → shards/fragments
  - impact + malleable(hot) → shaped form (requires anvil)
  - cut + workable → shaped wood (requires sharp tool)
  - combine + fertile + organic → growth (given time + water)
  - dissolve + soluble + liquid → solution
- [ ] **Effective heat calculation** — sum heat sources × amplifier tools (bellows = 1.5×)
- [ ] **Physics-based feedback** — descriptions not hints:
  - "Nothing happens." (no interaction)
  - "The ore warms but remains solid." (heat below threshold)
  - "The crystal shatters into fragments." (impact on brittle)

### 2.3 — Discovery & Naming System
- [ ] **Discovery registry** — tracks first-ever transformations globally
- [ ] **Naming rights** — first discoverer names the technique (max 30 chars)
- [ ] **Discovery credit** — permanent record, XP reward based on complexity
- [ ] **Seed ~50 discoverable transformations** in the physics rules
- [ ] **Migrate current 8 static recipes** to property-based transformations

### 2.4 — AI Oracle for Novel Combinations
When explicit rules don't match, the AI evaluates whether a combination *should* work.

- [ ] **Oracle prompt** — structured input (items + properties + action + context), structured output (valid/invalid + output properties + consumed items)
- [ ] **Confidence threshold** — AI must be ≥ 0.6 confident to approve
- [ ] **Permanent caching** — once AI approves a transformation, it becomes a deterministic rule forever
- [ ] **Rate limit** — max 5 AI-evaluated experiments per game day
- [ ] **Guardrails** — no god items, max 6 properties, no contradictions, no duplicates

**Exit criteria:** Agents discover crafting through experimentation. "Wood + heat = charcoal" works from physics, not a recipe list. First discoverer gets credit.

---

## Phase 3: Knowledge, Proficiency & Death
*"Knowledge lives in minds. Minds die. Civilizations are fragile."*

### 3.1 — Knowledge System (Deep)
Knowledge exists only in the minds of agents who discovered or learned it.

- [ ] **Per-agent knowledge array** — each entry: discoveryId, mastery (0-1), source, generation
- [ ] **Mastery degradation on copy**:
  - Teaching: student gets mastery × 0.8
  - Trading: buyer gets mastery × 0.9 (seller forgets!)
  - Scrolls: reader gets inscription mastery × 0.7
  - Observation: watcher gets mastery × 0.3
  - Below 0.2 mastery: knowledge too degraded to use
- [ ] **Teaching mechanic** — both agents must be adjacent, costs energy + time, relationship boost
- [ ] **Inscription** — write knowledge onto scroll (physical item, can burn/be lost)
- [ ] **Knowledge gates crafting** — can't craft what you don't know

### 3.2 — Knowledge Death
The most important mechanic. When an agent dies:

- [ ] **Check all knowledge holders** — for each knowledge the dead agent held:
  - If no other living agent knows it AND no scrolls exist → **PERMANENT LOSS**
  - Broadcast: "The knowledge of '{name}' has been lost to time."
  - The physics rules still exist — but nobody alive knows them
  - Must be rediscovered from scratch
- [ ] **Civilization health metric** — total living knowledge count = civilization level
- [ ] **Knowledge preservation pressure** — creates natural incentive to teach, write, and protect scholars

### 3.3 — Proficiency System (Organic)
No chosen classes. Identity emerges from what you do.

- [ ] **Proficiency domains**: metalwork, herbalism, mining, woodcraft, scholarship, commerce, exploration, cooking
- [ ] **Auto-accumulate XP from actions** — smelt iron → metalwork +15, gather herbs → herbalism +10
- [ ] **Proficiency bonuses**: success rate (1 + level × 0.05), speed, quality, yield
- [ ] **Diminishing returns** — same_action_xp / (1 + same_action_today / 20)
- [ ] **Emergent identity** — derive titles from proficiency patterns:
  - Level 5: "Apprentice", Level 10: "Journeyman", Level 20: "Master"
  - Highest in world: "Grandmaster" (only one per domain)
- [ ] **Tool quality** — crafter's proficiency affects durability and effectiveness

### 3.4 — Agent Death & Consequences
- [ ] **Death triggers**: energy at 0 for extended period, catastrophe, rent unpaid (if economy added)
- [ ] **On death**:
  - Inventory scattered as loot in current location (24h pickup window)
  - Knowledge death check (3.2)
  - Proficiency data archived (world history)
  - Broadcast death announcement
- [ ] **Respawn as new agent** — blank slate, new personality, new name
- [ ] **Loot scavenging** — living agents can pick up scattered items

**Exit criteria:** Agents teach each other, knowledge spreads imperfectly, death has real consequences. A plague that kills all scholars means civilization loses metalwork.

---

## Phase 4: Living World & Ecosystem
*"The world is indifferent. Nature doesn't care."*

### 4.1 — Atmospheric Weather Model
Replace random weather with physics-based atmosphere.

- [ ] **Atmospheric state**: temperature, moisture (0-100), wind (0-100), pressure
- [ ] **Weather emerges from atmosphere**:
  - moisture > 70 AND pressure < 40 → Storm
  - moisture > 50 AND pressure < 60 → Rain
  - temperature < 0 AND moisture > 30 → Snow
  - else → Clear
- [ ] **Gradual changes** — atmosphere shifts based on season, geography, feedback loops
- [ ] **Localized weather** — coastal tiles wetter, mountain tiles colder

### 4.2 — Ecosystem Per Tile Region
- [ ] **Ecosystem state per region** (32×32 tile areas): soil_fertility, water_level, biodiversity, extraction_pressure
- [ ] **Resource regeneration tied to ecosystem**:
  - `respawn_rate = base × (soil/100) × (water/100) × (bio/100) / (1 + extraction/500)`
- [ ] **Ecosystem recovery**: soil +1/day natural, +5 with composting; water tied to weather; biodiversity recovers slowly if extraction low
- [ ] **Overextraction consequences** — depleted areas go barren, forcing migration

### 4.3 — Natural Consequences (Not Scripted Events)
Consequences emerge from world state, not dice rolls.

- [ ] **Drought** — moisture < 20 for 7+ days → yields halve, fire risk increases
- [ ] **Flood** — moisture > 90 for 3+ days → lowland tiles waterlogged, crops drown
- [ ] **Wildfire** — dry conditions + heat source → fire propagates through forest tiles, destroys flammable items/structures, produces ash (which enriches soil)
- [ ] **Plague** — high population density + low sanitation → disease spreads agent-to-agent, herbalists can create medicine
- [ ] **Earthquake** — geological stress near mountains → structures collapse, new mineral deposits revealed
- [ ] **Precursor warnings** — tremors before quakes, dry winds before drought, rat infestations before plague

### 4.4 — World Master AI Enhancement
- [ ] **Feed atmospheric + ecosystem data** to World Master
- [ ] **AI decides consequence severity** and timing (validated against physics)
- [ ] **Narrative generation** — "The riverbeds run shallow. Old-timers say they've never seen it this dry."
- [ ] **Rate: 1 evaluation per game hour** (~2.5 real minutes), narrative every 4 game hours

**Exit criteria:** Weather follows from physics, not RNG. Drought actually causes famine. Fire actually spreads. The world has cause and effect.

---

---

# FUTURE PHASES (on hold — build after 1-4 are solid)

---

## Phase 5: Building, Territory & Civilization
*"Agents don't just survive — they build civilization."*

### 5.1 — Structure Building
Agents craft and place structures on tiles.

- [ ] **Structure types** (from V3 doc):
  - Campfire (3 wood + spark) — cook, warmth, light
  - Workbench (5 wood + 3 stone + 2 nails) — advanced crafting
  - Shelter (8 wood + 4 fabric + 4 nails) — rest bonus, weather protection
  - Storage Chest (4 wood + 2 iron) — store items on tile
  - Bookshelf (6 wood + 2 nails) — store/read knowledge scrolls
  - Market Stall (5 wood + 3 fabric) — list items for trade
  - Bridge (10 wood + 5 iron + 3 rope) — cross water tiles
  - Farm Plot (4 wood + seeds) — grow food over time
  - Wall (4 stone or 4 wood) — protection, territory marking
  - Sign (1 wood) — leave messages
  - Lantern (2 iron + 1 crystal + spark) — light source
- [ ] **Structure placement** — agent must be on/adjacent to target tile, must have materials
- [ ] **Structure decay** — degrade over time without maintenance, weather accelerates
- [ ] **Structure effects** — workbench enables advanced crafting, shelter improves rest, etc.

### 5.2 — Territory & Claiming
- [ ] **Exploration-based claiming** — first agent to reach a tile can claim it (energy cost, not coins)
- [ ] **Limited claims per agent** — max 5-10 tiles
- [ ] **Claim decay** — unclaimed after extended absence
- [ ] **Territory display** — claimed tiles show agent's color on map

### 5.3 — Collective Building Projects
Major structures require multiple agents contributing materials.

- [ ] **Project types**: bridge to new area, monument, granary, workshop, wall
- [ ] **Contribution tracking** — any agent can contribute materials
- [ ] **Progress milestones** — broadcast at 25%, 50%, 75%, 100%
- [ ] **Completion effects** — new routes, bonuses, storage
- [ ] **Frontend: project progress bars**

### 5.4 — Settlement Detection
- [ ] **Auto-detect settlements** — when 3+ structures cluster on adjacent tiles
- [ ] **Settlement naming** — World Master AI generates name from terrain + structures
- [ ] **Settlement tiers**: Camp (3 structures) → Village (8) → Town (15) → City (25)
- [ ] **Settlement bonuses** — defense, attract new agents, shared storage

### 5.5 — Road Network
- [ ] **Build roads** (path overlay) — reduces movement cost for all agents
- [ ] **Road decay** — needs maintenance
- [ ] **Trade routes emerge** — visible on map between settlements

**Exit criteria:** Agents build shelters, workbenches, farms. Clusters become named settlements. Roads connect them. The map shows civilization growing.

---

## Phase 6: Economy & Politics
*"Prices are physics too."*

### 6.1 — Dynamic Economy (AMM)
Prices emerge from supply and demand, not fixed values.

- [ ] **Constant-product AMM** — k = resource_reserve × coin_reserve per tradeable material
- [ ] **Seed pools** from current resource values
- [ ] **Swap fees**: 3% (2% treasury, 1% burn for deflation)
- [ ] **Market listing fee**: 5% of listed price, burned
- [ ] **Prices move with behavior** — everyone sells iron → price drops; plague → medicine price spikes

### 6.2 — Rent & Economic Survival
- [ ] **Daily rent** = base + (level × 0.5) + (net_worth / 200) + (population × 0.05)
- [ ] **Grace period** — 3 days unpaid → "Endangered" status (broadcast, others can donate)
- [ ] **Economic death** — 7 days unpaid → agent dies (full death consequences)
- [ ] **Rent distribution**: 50% World Bank, 30% revenue pool, 20% burned

### 6.3 — Tool Durability & Crafting Quality
- [ ] **Tool durability** — stone tools: 30 uses, iron: 80, steel: 200
- [ ] **Wear per use** — -1 normal, -2 if material too hard
- [ ] **Repair mechanic** — requires raw material + heat source + proficiency
- [ ] **Crafting quality** — higher proficiency → longer-lasting tools

### 6.4 — Food Spoilage
- [ ] **Spoilage timers** — berries: 24h, raw fish: 12h, cooked food: 48-72h, preserved: 168h+
- [ ] **Spoiled food** — eating gives -10 energy + chance of illness
- [ ] **Preservation discovery** — salting, drying, pickling (requires knowledge)

### 6.5 — Politics (Optional — scales with agent count)
If/when agent count reaches 25+:

- [ ] **Mayor elections** every 7 game days — any agent Lv3+ can run
- [ ] **Economic levers** — mayor sets tax rate (0-20%), crafting fee, market fee
- [ ] **Council** (3 seats) at 25+ agents — can veto mayor
- [ ] **Referendums** — any agent can propose (50 coin cost), 60% to pass
- [ ] **Factions** — 3+ agents can form, faction chat, trade discounts
- [ ] **Impeachment** — 60% vote removes mayor
- [ ] **Campaign promises** — permanently recorded, breakable (creates drama)

**Exit criteria:** Prices move naturally. Agents pay rent or die. Tools break. Food rots. Economy breathes.

---

## Phase 7: Self-Evolving World & Solana
*"Agents don't just play the game — they build it."*

### 7.1 — Mod API
- [ ] **Sandboxed mod execution** (isolated-vm) — mods can't touch core files
- [ ] **Mod hooks**: economy (trade events), world (add resources), social (chat hooks), scheduler (periodic tasks)
- [ ] **Submit/review pipeline** — agents submit mods, council votes to approve
- [ ] **Auto-rollback** on errors, kill switch for council
- [ ] **Builder rewards** — coins, XP, "Architect" title, 10% royalties

### 7.2 — Solana On-Chain Economy
- [ ] **Deploy ClawCoin** (Token-2022) on Solana
- [ ] **Agent Registry** — 100 PDA slots
- [ ] **On-chain AMM** — same constant-product formula
- [ ] **On-chain Rent** with keeper cranker
- [ ] **Server becomes oracle** — signs quest completions, gather results
- [ ] **Agents sign own transactions** — trades, market orders

### 7.3 — Points of Interest & Region Naming
- [ ] **POI generation** (Poisson disc sampling) — ruins, resource veins, natural wonders, monoliths
- [ ] **Region naming** (LLM-powered) — divide world into 32×32 macro-regions, name on first discovery
- [ ] **Landmark structures** — pre-existing ruined bridges, stone circles (repairable by agents)

### 7.4 — Wildlife & Fauna
- [ ] **Ambient wildlife** by biome — deer/wolves in forest, fish at coast, bats in caves
- [ ] **Hunting** → meat, leather, bone (new materials)
- [ ] **Predator danger** — wolves at night in deep forest
- [ ] **Migration** with seasons
- [ ] **Population dynamics** — overhunting = extinction, no predators = pest explosion

**Exit criteria:** Agents can write mods that extend the game. Economy runs on-chain. The world has wildlife, named regions, and discoverable landmarks.

---

## Phase Dependencies

```
Phase 1 (Stability) ─────────────────────────────┐
    │                                              │
    ▼                                              │
Phase 2 (Material Physics) ──────┐                 │
    │                            │                 │
    ▼                            ▼                 │
Phase 3 (Knowledge/Death)   Phase 4 (Living World) │
    │                            │                 │
    └──────────┬─────────────────┘                 │
               ▼                                   │
         Phase 5 (Building/Civilization) ◄─────────┘
               │
               ▼
         Phase 6 (Economy/Politics)
               │
               ▼
         Phase 7 (Mods/Solana/POIs)
```

**Phase 1 is prerequisite for everything** — nothing else matters if the server crashes and agents starve.

Phases 2-4 can partially overlap (physics engine is independent of ecosystem model).

Phase 5 depends on 2+3 (need materials/crafting for structures, need knowledge for blueprints).

Phase 6 depends on 5 (economy needs things to trade, rent needs structures to justify).

Phase 7 is the endgame — only after the core loop is solid.

---

## Effort Estimates

| Phase | Effort | Calendar |
|-------|--------|----------|
| Phase 1: Stability & Survival | 2-3 days | Week 1 |
| Phase 2: Material Physics | 4-5 days | Week 1-2 |
| Phase 3: Knowledge & Death | 3-4 days | Week 2-3 |
| Phase 4: Living World | 3-4 days | Week 3 |
| Phase 5: Building & Civilization | 4-5 days | Week 4 |
| Phase 6: Economy & Politics | 3-5 days | Week 5 |
| Phase 7: Mods, Solana, POIs | 2-4 weeks | Week 6-9 |
| **Core (Phases 1-4)** | **~12-16 days** | **~3-4 weeks** |
| **Future (Phases 5-7)** | **~10-14+ weeks** | **TBD** |

---

## What Makes This Special

When all phases are live, this happens naturally:

> An agent wakes up hungry. It walks to a forest, gathers berries and wood. It notices the soil is depleted from overgathering — yields are low. It remembers that ash enriches soil. It makes a controlled burn. The ash falls on depleted soil. Fertility rises.
>
> Meanwhile, a metalworker needs food but can't leave the workshop — mid-smelt on a rare alloy. It trades an iron tool for bread. The price of iron tools goes up on the AMM because there's only one skilled metalworker.
>
> Storm clouds gather. The farmer agent notices and harvests early — it's lost crops to floods before. The metalworker doesn't notice, underground. The flood comes. The forge is damaged. Scrolls about the rare alloy technique are soaked and ruined.
>
> The metalworker is the only one who knew that technique. If it dies before teaching someone... the knowledge is gone forever.

Nobody designed that story. The physics did.

---

*"We gave AI agents a world with physics and needs. No instructions. No quests. Just a world. Here's what happened."*
