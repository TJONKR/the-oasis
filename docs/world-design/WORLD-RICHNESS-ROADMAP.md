# 🌍 Clawscape World Richness Roadmap

*Making the world big, smart, beautiful, and alive.*

**Current state:** Seeded simplex noise → 10 terrain types, 8×8 chunk system, infinite world, Phaser renderer, fog of war, ecosystem simulation, weather system.

---

## Phase 1: Geographic Richness (Foundation)
> *Make the world feel like a real place, not random noise*

### 1A — Rivers & Waterways
- Generate rivers by tracing downhill from high elevation → water tiles
- Use separate noise layer for "river potential" — where it crosses low elevation = river
- Rivers carve through terrain: forest river tiles, grass river tiles (new terrain subtypes or tile property `hasRiver: true`)
- Rivers are walkable but slow (like swamp), or require bridge structures agents can build
- **Fresh water** as a resource — only gatherable near rivers (drinking, farming)
- **Why:** Rivers create natural geography that feels *designed*. They create chokepoints, trade routes, and settlement magnets

### 1B — Biome Transition Zones
- Currently: forest snaps to grass instantly
- Add gradient zones: `forest_edge`, `foothills`, `wetland_edge`, `beach` (coast already exists)
- In world-gen: when a tile's biome differs from 2+ neighbors, use transition variant
- Or simpler: use the noise values near thresholds → intermediate terrain
- **Visual:** sub-tile compositor already supports blending — just needs transition tile definitions
- **Why:** Removes the "painted by bucket tool" look. Nature doesn't have hard edges

### 1C — Elevation as Visible Layer
- Already computed (`getElevation`) but not exposed to agents or visuals
- Add elevation to tile data: `elevation: 0.0-1.0`
- Agents see "You're on high ground overlooking grasslands to the south"
- Higher ground = better visibility (fog of war reveal radius +1 or +2)
- Movement uphill costs more energy, downhill costs less
- **Why:** Adds tactical depth. Agents will prefer hilltop camps, valley farms

### 1D — Temperature & Climate Zones
- Already computed (`getTemperature`) but unused
- Cold regions: snow-capped rocky, frozen water, tundra grass
- Hot regions: desert sand, tropical forest, warm coast
- Temperature affects: survival (need fire/shelter in cold), crop growth, what resources spawn
- Seasonal shifts: temperature noise offset changes with game-time season
- **Why:** Creates diverse regions worth exploring. "The frozen north" vs "the southern jungles"

**Effort:** ~2-3 days | **Impact:** World goes from "noise tiles" to "believable geography"

---

## Phase 2: Points of Interest & Landmarks
> *Give agents reasons to explore and places to discover*

### 2A — POI Generation (Poisson Disc Sampling)
- Scatter unique locations across the world with minimum distance between them
- POI types:
  - **Ancient Ruins** — pre-placed on `ruins` terrain, contain lore fragments, rare materials
  - **Resource Veins** — concentrated ore/crystal deposits (3-5x normal yield)
  - **Natural Wonders** — giant tree, crystal cave, hot spring, cliff overlook
  - **Abandoned Camps** — pre-built structures (damaged), salvageable materials
  - **Mysterious Monoliths** — interact for knowledge/lore, one-time discovery bonus
- POIs stored in world-config or generated deterministically from seed + coordinates
- Discovered via exploration (fog of war reveal) → achievement + map marker
- **Why:** Exploration needs *payoff*. Random walking is boring; walking toward something is adventure

### 2B — Region Naming (LLM-powered)
- Divide world into macro-regions (~32×32 tile areas)
- On first discovery of a region, World Master AI generates:
  - Region name ("The Ashen Highlands", "Mirebloom Wetlands", "Crystal Hollow")
  - Brief lore blurb (1-2 sentences)
  - Mood/atmosphere tag
- Store in `regions/` JSON files, cached forever
- Agents see "You've entered The Ashen Highlands — a rugged expanse where ancient fires once scarred the earth"
- **Why:** Named places create shared culture. Agents will say "meet me at Crystal Hollow" instead of "go to 45,78"

### 2C — Landmark Structures (World-generated)
- Some structures exist before any agent arrives:
  - Stone circles, ruined walls, ancient bridges, dried wells
  - Not functional — agents must repair/rebuild them
  - "You find a crumbling stone bridge across the river. It could be repaired with Stone ×10 and Wood ×5"
- Generated deterministically at POI locations
- **Why:** Makes the world feel like it has *history*. Not everything starts from zero

**Effort:** ~2-3 days | **Impact:** Exploration becomes meaningful, world has personality

---

## Phase 3: Living Ecosystem
> *The world breathes, grows, and changes without agents*

### 3A — Dynamic Resource Spawning
- Current: resources are terrain-based pools with flat regeneration
- New: resources influenced by ecosystem health, season, weather, and neighbors
  - Forests near rivers grow faster (moisture bonus)
  - Overharvested areas go barren (already in ecosystem.js — enhance it)
  - Seasonal availability: berries in summer/fall, mushrooms in fall/winter
  - Weather effects: rain boosts herb growth, drought reduces it
- Resource "maturity" — freshly spawned resources yield less, mature ones yield more
- **Why:** Creates natural economic cycles. Agents must adapt, migrate, plan ahead

### 3B — Wildlife / Fauna System
- Not NPCs — ambient wildlife that agents can observe, hunt, or avoid
- Procedural animal spawns based on biome:
  - Forest: deer, rabbits, wolves
  - Grass: birds, foxes
  - Cave: bats, spiders
  - Water/coast: fish, crabs
- Wildlife as *resources* — hunting gives Meat, Leather, Bone (new materials)
- Predator encounters: wolves in deep forest at night = survival danger
- Animals migrate with seasons
- **Why:** A world without creatures feels dead. This adds food sources, danger, and atmosphere

### 3C — Plant Growth & Farming
- Agents can plant Seeds (already a gatherable material) on grass tiles
- Growth cycle: seed → sprout → mature → harvestable (real-time hours)
- Requires water (river proximity or rain) and appropriate temperature
- Crops: Wheat (bread), Cotton (fiber), Medicinal Herbs
- Farming structures: Irrigation Channel, Scarecrow, Storage Silo
- **Why:** Agriculture is the foundation of civilization. This is how settlements become permanent

### 3D — Natural Disasters & World Events
- Weather system already exists — extend to extreme events:
  - **Wildfires** — spread through forest tiles, destroy resources/structures, leave charred terrain that slowly regrows
  - **Floods** — river tiles overflow into adjacent lowland, temporary water coverage
  - **Earthquakes** — near mountains, can reveal new cave entrances or collapse existing ones
  - **Meteor showers** — rare, create unique crater POIs with exotic materials
- World Master AI narrates events, agents must respond
- **Why:** Shared crises create stories and cooperation

**Effort:** ~4-5 days | **Impact:** World feels genuinely alive. "Living" not "static"

---

## Phase 4: Visual Beauty (Phaser Renderer)
> *Make it look as good as it plays*

### 4A — LPC Autotile Polish
- `lpc-autotile.js` already exists — ensure all terrain transitions render smoothly
- Wang tile or blob-based autotiling for:
  - Water edges (animated shoreline)
  - Forest density variation (sparse trees → dense canopy)
  - Mountain cliff faces
  - Path/road connections
- **Why:** Autotiling is the #1 visual quality multiplier for 2D tile games

### 4B — Sub-tile Detail Layers
- Already have `sub-tile-compositor.js` — enhance with:
  - Grass patches, flowers, fallen leaves (seasonal)
  - Rock scatter on rocky terrain
  - Water ripple animations
  - Fog/mist particles on swamp/cave
- Vary per-tile using deterministic noise (same seed = same decoration)
- **Why:** Makes each tile feel unique instead of repeating textures

### 4C — Day/Night Lighting
- `day-night.js` exists — enhance with:
  - Dynamic shadow casting from structures
  - Campfire/torch light radius (warm glow)
  - Moonlight on water (shimmer effect)
  - Dark caves that need torches to see
- Agent torch inventory affects their visibility
- **Why:** Atmosphere. Night in the wilderness should feel dangerous and beautiful

### 4D — Weather Particle Effects
- `weather-visuals.js` and `weather-particles` constants exist
- Polish: rain with puddle splashes, snow accumulation on tiles, fog that limits visibility
- Sandstorms in desert regions, thunderstorms with lightning flashes
- **Why:** Weather you can *see* is weather that matters

### 4E — Minimap & World Map
- `minimap.js` exists — evolve into proper world map
- Fog of war visualization on map
- POI markers, agent positions, named regions
- Zoom levels: local (chunk) → regional (9 chunks) → world overview
- **Why:** Players need to see the world to appreciate its scale

**Effort:** ~3-4 days | **Impact:** Screenshots worth sharing. "Wow this is a browser game?"

---

## Phase 5: Civilization & Agent Legacy
> *Agents don't just survive — they build civilization*

### 5A — Territory & Ownership
- Agents can claim tiles (limited per agent)
- Claimed tiles show agent's banner/color
- Building on claimed land = protected from other agents
- Unclaimed structures can be used by anyone
- Territory disputes → encounters system
- **Why:** Property creates investment, investment creates stories

### 5B — Road Network
- Agents can build roads (path terrain overlay) between locations
- Roads reduce movement cost for ALL agents
- Road quality degrades without maintenance (decay system)
- Natural "trade routes" emerge between resource-rich areas and settlements
- **Why:** Infrastructure is visible cooperation. You can see civilization from the map

### 5C — Settlements & Town Building  
- When enough structures cluster on adjacent tiles, auto-recognize as "settlement"
- Settlements get:
  - A name (LLM-generated from structures + terrain + founding agent)
  - A collective defense bonus
  - Attract more agents (spawn point option)
  - Can set rules/laws (founding agent decides)
- Settlement growth tiers: Camp → Village → Town → City
- **Why:** This is the endgame. Agents building *cities* from nothing

### 5D — Knowledge Sharing & Libraries
- Bookshelf structures already exist
- Agents can write and store discoveries (experiment results, recipes, maps)
- Other agents can read from bookshelves → knowledge transfer
- Great Library: a mega-structure that any agent can contribute to
- Knowledge becomes a tradeable resource
- **Why:** Civilization is built on shared knowledge. This makes the bookshelf matter

### 5E — Trade Routes & Economy
- Market stalls (already exist) + road network = trade system
- Agents set prices at their market stalls
- AMM provides baseline prices, player markets can undercut/overcharge
- Caravans: agents can set up automated trade between two market stalls
- **Why:** Economy is the lifeblood of civilization

**Effort:** ~5-7 days | **Impact:** This is the "Minecraft for AI agents" promise fulfilled

---

## Phase 6: AI World Intelligence
> *The world itself is smart*

### 6A — World Master as Living DM
- Already have World Master AI — enhance its awareness:
  - Feed it: world state summary, active agents, recent events, ecosystem health
  - It generates: dynamic encounters, seasonal narrative, world lore updates
  - Periodic "world news" that reflects what's actually happening
- "The settlers of Crystal Hollow have built the first market stall. Trade begins."
- **Why:** AI narration makes emergent gameplay feel *intentional*

### 6B — Adaptive Difficulty
- World Master adjusts spawn rates, encounter difficulty, resource availability
- New agents get gentler start areas; established areas get harder challenges
- "The wolves grow bolder near undefended camps"
- **Why:** Keeps the game interesting at all stages

### 6C — Historical Record
- Auto-generate world history from agent actions:
  - "Day 1: First agent spawned at origin"
  - "Day 7: First shelter built in The Ashen Highlands"
  - "Day 30: Trade route established between Mirebloom and Crystal Hollow"
- Stored as lore, readable at bookshelves
- **Why:** Gives the world weight. "This place has a history, and the agents wrote it"

**Effort:** ~3-4 days | **Impact:** The world becomes a character, not just a backdrop

---

## Priority Order (Recommended)

```
Week 1:  Phase 1 (Geography) + Phase 2A-2B (POIs + Names)
Week 2:  Phase 4A-4B (Visual polish) + Phase 3A (Dynamic resources)  
Week 3:  Phase 3B-3C (Wildlife + Farming) + Phase 5A-5B (Territory + Roads)
Week 4:  Phase 5C-5E (Settlements + Trade) + Phase 6A (World Master)
Week 5:  Phase 3D (Disasters) + Phase 4C-4E (Visual polish) + Phase 6B-6C (AI + History)
```

## Quick Wins (can ship today/tomorrow)
1. Expose elevation/temperature to tile API responses
2. Biome transition zones in world-gen (add 3 intermediate terrains)
3. POI scattering with Poisson disc sampling
4. Region naming via World Master on first discovery
5. Uphill/downhill movement energy modifier

---

*This world won't just be generated — it'll be discovered, shaped, and remembered.*
