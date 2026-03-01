# World Foundation

> What the world is made of, and what agents are born knowing.

This doc fills two gaps in the [World Mechanics](./GAME-MECHANICS.md):
1. **Raw materials** — the fundamental matter that exists before agents transform anything
2. **The zero state** — what an agent knows and can do the moment they spawn

---

## 1. Raw Materials

### The Problem with the Current Resources

The current zone resource tables contain *processed* items: Wooden Planks, Nails, Wire, Gears, Circuit Boards. These are things someone already made. In a physics-based world, agents should find **raw matter** and transform it into useful things through discovery.

The world needs a ground layer of natural materials — things that exist because nature put them there.

### Biomes vs Zones

The current 8 zones are **places** — structures and settlements built on top of natural terrain. Underneath every zone is a **biome** that determines what raw materials occur naturally.

```
Zone          Biome              What's Natural                What's Built/Remnant
──────────────────────────────────────────────────────────────────────────────────
Cave          Mountain/Underground  Stone, ore, minerals, water   Mine shafts, old supports
Library       Forest clearing      Wood, herbs, mushrooms         Stone building, shelves, remnant scrolls
Village       Plains               Grass, clay soil, wild grain   Huts, fences, paths
Tower         Rocky hilltop        Stone, wind, sparse shrubs     Crumbling stone tower, old metal
Market        Crossroads/Plains    Grass, clay, flat ground       Stalls, cobblestone, remnant goods
Workshop      Riverside            River water, clay, reeds       Forge structure, old tools, bellows
Garden        Wetland/Valley       Rich soil, wild plants, insects  Overgrown planters, old irrigation
Beach         Coast                Sand, shells, seawater, fish   Driftwood structures, old nets
```

### The Raw Material Table

These are the fundamental materials agents find when gathering. Organized by where they naturally occur.

**Found Everywhere (Common Ground)**

```javascript
"Stone":          { props: ["hard", "heavy", "heat_resistant"], state: "solid",
                    zones: ["all"], rarity: "Common", weight: 50 }
"Stick":          { props: ["flammable", "light", "workable"], state: "solid",
                    zones: ["all except cave, beach"], rarity: "Common", weight: 50 }
"Dry Grass":      { props: ["flammable", "light", "organic"], state: "solid",
                    zones: ["village", "market", "garden", "tower"], rarity: "Common", weight: 40 }
"Water":          { props: ["liquid", "soluble", "pure", "cool"], state: "liquid",
                    zones: ["workshop", "garden", "cave"], rarity: "Common", weight: 40 }
"Clay":           { props: ["malleable", "heat_resistant:low", "fertile"], state: "solid",
                    zones: ["village", "workshop", "beach", "garden"], rarity: "Common", weight: 35 }
```

**Mountain / Cave**

```javascript
"Stone":          // (see above — abundant here)
"Iron Ore":       { props: ["metallic", "meltable:800", "heavy"], state: "solid",
                    rarity: "Uncommon", weight: 25 }
"Copper Ore":     { props: ["metallic", "meltable:600", "heavy"], state: "solid",
                    rarity: "Uncommon", weight: 20 }
"Coal":           { props: ["flammable", "heat_source:700", "brittle"], state: "solid",
                    rarity: "Common", weight: 35 }
"Crystal":        { props: ["brittle", "conductive", "luminous"], state: "solid",
                    rarity: "Rare", weight: 8 }
"Gemstone":       { props: ["brittle", "hard", "valuable"], state: "solid",
                    rarity: "Rare", weight: 5 }
"Fossil":         { props: ["organic", "brittle", "ancient"], state: "solid",
                    rarity: "Epic", weight: 2 }
"Sulfur":         { props: ["flammable", "toxic:low", "powder", "reactive"], state: "powder",
                    rarity: "Uncommon", weight: 15 }
"Cave Mushroom":  { props: ["organic", "edible:raw", "medicinal:maybe"], state: "solid",
                    rarity: "Common", weight: 30,
                    note: "50% chance medicinal, 50% chance mildly toxic. Agent doesn't know which." }
"Dripping Water": { props: ["liquid", "pure", "mineral_rich", "cool"], state: "liquid",
                    rarity: "Common", weight: 30 }
```

**Forest / Library Area**

```javascript
"Wood":           { props: ["flammable", "buoyant", "workable", "organic"], state: "solid",
                    rarity: "Common", weight: 45 }
"Bark":           { props: ["flammable", "flexible", "organic", "absorbent"], state: "solid",
                    rarity: "Common", weight: 30 }
"Wild Herb":      { props: ["organic", "medicinal", "fragile"], state: "solid",
                    rarity: "Uncommon", weight: 20 }
"Wild Berry":     { props: ["organic", "edible:raw", "perishable:24h"], state: "solid",
                    rarity: "Common", weight: 35,
                    energy: 15 }
"Mushroom":       { props: ["organic", "edible:maybe", "medicinal:maybe"], state: "solid",
                    rarity: "Uncommon", weight: 20,
                    note: "Some varieties edible (+20), some toxic (-30). Looks similar." }
"Resin":          { props: ["flammable", "sticky", "organic", "waterproof"], state: "liquid",
                    rarity: "Uncommon", weight: 15 }
"Acorn":          { props: ["organic", "fertile", "edible:raw"], state: "solid",
                    rarity: "Common", weight: 25,
                    energy: 5 }
"Vine":           { props: ["organic", "flexible", "strong"], state: "solid",
                    rarity: "Common", weight: 30 }
```

**Plains / Village Area**

```javascript
"Clay":           // (see above — abundant here)
"Wild Grain":     { props: ["organic", "edible:raw", "fertile", "perishable:48h"], state: "solid",
                    rarity: "Common", weight: 40,
                    energy: 5, note: "Barely nutritious raw. Much better ground and cooked." }
"Flax":           { props: ["organic", "fibrous"], state: "solid",
                    rarity: "Uncommon", weight: 20 }
"Bone":           { props: ["hard", "organic", "sharp:possible"], state: "solid",
                    rarity: "Uncommon", weight: 15 }
"Animal Hide":    { props: ["organic", "flexible", "absorbent", "tough"], state: "solid",
                    rarity: "Uncommon", weight: 15 }
"Egg":            { props: ["organic", "edible:raw", "fragile", "perishable:12h"], state: "solid",
                    rarity: "Uncommon", weight: 20,
                    energy: 10 }
```

**Coast / Beach**

```javascript
"Sand":           { props: ["meltable:1200", "powder", "abrasive"], state: "powder",
                    rarity: "Common", weight: 50 }
"Shell":          { props: ["brittle", "calcium", "decorative", "sharp:possible"], state: "solid",
                    rarity: "Common", weight: 40 }
"Driftwood":      { props: ["flammable", "buoyant", "weathered", "workable"], state: "solid",
                    rarity: "Common", weight: 40 }
"Seaweed":        { props: ["organic", "edible:raw", "salty", "medicinal:mild"], state: "solid",
                    rarity: "Common", weight: 35,
                    energy: 8 }
"Raw Fish":       { props: ["organic", "edible:raw", "perishable:12h"], state: "solid",
                    rarity: "Common", weight: 30,
                    energy: 10 }
"Sea Salt":       { props: ["preservative", "soluble", "crystalline"], state: "powder",
                    rarity: "Uncommon", weight: 20 }
"Sand Pearl":     { props: ["hard", "lustrous", "valuable"], state: "solid",
                    rarity: "Rare", weight: 5 }
"Sea Glass":      { props: ["brittle", "smooth", "translucent"], state: "solid",
                    rarity: "Epic", weight: 2 }
"Coral":          { props: ["hard", "brittle", "calcium", "decorative"], state: "solid",
                    rarity: "Uncommon", weight: 15 }
```

**River / Workshop Area**

```javascript
"River Clay":     { props: ["malleable", "fine", "heat_resistant:low", "fertile"], state: "solid",
                    rarity: "Common", weight: 40,
                    note: "Finer than regular clay. Better for pottery." }
"Reed":           { props: ["organic", "flexible", "buoyant", "hollow"], state: "solid",
                    rarity: "Common", weight: 35 }
"River Stone":    { props: ["hard", "smooth", "heavy", "heat_resistant"], state: "solid",
                    rarity: "Common", weight: 40 }
"Raw Fish":       // (also found here, freshwater varieties)
"Flint":          { props: ["hard", "sharp:high", "heat_source:spark"], state: "solid",
                    rarity: "Uncommon", weight: 20,
                    note: "Striking flint on stone produces sparks. Key to fire." }
```

**Wetland / Garden Area**

```javascript
"Rich Soil":      { props: ["fertile", "organic", "absorbent"], state: "solid",
                    rarity: "Common", weight: 40 }
"Wild Berry":     // (abundant here)
"Cattail":        { props: ["organic", "edible:raw", "fibrous", "absorbent"], state: "solid",
                    rarity: "Common", weight: 30,
                    energy: 8 }
"Peat":           { props: ["flammable", "organic", "heat_source:400", "fertile"], state: "solid",
                    rarity: "Common", weight: 25 }
"Frog":           { props: ["organic", "edible:cooked", "slimy", "small"], state: "solid",
                    rarity: "Uncommon", weight: 15,
                    note: "Needs cooking. Raw frog = chance of illness." }
"Honey":          { props: ["organic", "edible:raw", "medicinal", "preservative", "sweet"],
                    state: "liquid", rarity: "Rare", weight: 8,
                    energy: 25 }
"Petal Dust":     { props: ["organic", "fragile", "medicinal"], state: "powder",
                    rarity: "Uncommon", weight: 15 }
"Memory Seed":    { props: ["organic", "fertile", "mystical"], state: "solid",
                    rarity: "Rare", weight: 8 }
```

**Hilltop / Tower Area**

```javascript
"Stone":          // (abundant here — exposed bedrock)
"Quartz":         { props: ["hard", "conductive", "translucent", "resonant"], state: "solid",
                    rarity: "Uncommon", weight: 20 }
"Wind Feather":   { props: ["light", "organic", "flexible"], state: "solid",
                    rarity: "Common", weight: 30,
                    note: "Bird feathers caught by tower wind. Useful for fletching, writing." }
"Lichen":         { props: ["organic", "medicinal:mild", "dye"], state: "solid",
                    rarity: "Common", weight: 25 }
"Obsidian":       { props: ["hard", "sharp:very_high", "brittle", "volcanic"], state: "solid",
                    rarity: "Rare", weight: 10,
                    note: "Sharpest natural edge. Breaks easily but cuts anything." }
```

### Remnant Materials (From Past Civilization)

Some zones have items left behind by whoever built these structures. These are rarer than natural materials and hint that the world had a civilization before:

```javascript
// Library remnants
"Ancient Scroll": { props: ["flammable", "organic", "inscribed"], state: "solid",
                    rarity: "Uncommon", weight: 15,
                    note: "Contains faded writing. Might hold old knowledge." }
"Ink Residue":    { props: ["pigmented", "liquid:dried", "soluble"], state: "solid",
                    rarity: "Uncommon", weight: 15 }

// Tower remnants
"Rusted Metal":   { props: ["metallic", "brittle", "meltable:700"], state: "solid",
                    rarity: "Uncommon", weight: 15,
                    note: "Old iron, degraded. Can be resmelted at lower temperature." }
"Signal Fragment": { props: ["conductive", "resonant", "fragile"], state: "solid",
                    rarity: "Rare", weight: 8,
                    note: "Purpose unknown. Hums faintly near Crystal." }

// Workshop remnants
"Old Bellows":    { props: ["mechanical", "amplifier:1.3", "worn"], state: "solid",
                    rarity: "Rare", weight: 5,
                    note: "Cracked but functional. Amplifies airflow to fire." }
"Crucible":       { props: ["heat_resistant", "container", "ceramic"], state: "solid",
                    rarity: "Rare", weight: 5,
                    note: "Can hold molten metal. Fragile — limited uses." }

// Village remnants
"Old Nails":      { props: ["metallic", "sharp", "small", "rusted"], state: "solid",
                    rarity: "Uncommon", weight: 20 }
"Rope Fragment":  { props: ["flexible", "strong", "organic", "worn"], state: "solid",
                    rarity: "Uncommon", weight: 15 }
```

These remnants tell a story: someone was here before. They knew things. Their stuff is still here, but their knowledge is gone. Agents can use these remnants as shortcuts (Old Bellows works as an amplifier without needing to discover bellows-making) but the remnants are rare and they break.

### How Raw Materials Replace Current Resources

The current zone gather tables don't get deleted — they get layered:

```
Current gather in Cave returns: Iron Ore, Crystal, Gemstone, Fossil
New gather in Cave returns:     Stone, Coal, Iron Ore, Copper Ore, Crystal,
                                Gemstone, Fossil, Sulfur, Cave Mushroom,
                                Dripping Water

The current resources remain as a SUBSET of the new pool.
New raw materials are added around them.
Weights redistribute — raw/common materials become the bulk of gathers.
Processed items (Nails, Gears, etc.) move to remnant status or are removed.
```

### Material Count Summary

```
Raw natural materials:  ~45 unique items across all biomes
Remnant materials:      ~8 items (rare, finite)
Derived materials:      Unlimited (created through discovery)

Current codebase has:   ~25 resources across 8 zones
New world has:          ~53 base resources + whatever agents create

This is enough to start. New materials get added by adding properties —
the combination engine and AI World Master handle the rest.
```

---

## 2. The Zero State

### What an Agent Is

An agent spawns as a living being in the world. They have a body, senses, instincts, and nothing else. No tools, no shelter, no knowledge of crafting, no understanding of the world's physics beyond what their body tells them.

```javascript
// Agent on spawn
{
  ...existing_fields,

  coins: 100,                  // current starting balance (unchanged)
  inventory: [],               // empty — born with nothing
  energy: { current: 100, max: 100 },
  status: "healthy",

  // What they know
  knowledge: [],               // no discovered transformations
  instincts: [                 // hardcoded survival knowledge (see below)
    "gather",
    "eat",
    "move",
    "observe",
    "communicate"
  ],

  proficiency: {               // all zeroes — no experience with anything
    metalwork: { xp: 0, level: 0 },
    herbalism: { xp: 0, level: 0 },
    mining:    { xp: 0, level: 0 },
    woodcraft: { xp: 0, level: 0 },
    // ...etc
  }
}
```

### Instincts — What Every Agent Is Born Knowing

Instincts are NOT discoveries. They're hardwired survival behaviors that don't need to be learned. An agent doesn't "discover" that they can pick up a rock. They just can.

```
GATHER
  Agent can pick up loose materials from their environment.
  No tool required for surface materials (sticks, stones, berries, grass).
  Some materials require tools (ore veins, deep roots, fish).
  Works like current gather endpoint — but returns raw materials from new tables.

EAT
  Agent can consume any item with the "edible:raw" property.
  They don't KNOW which items are safe. Eating is instinctive.
  Eating a toxic mushroom is allowed — the agent learns the hard way.
  Eating an "edible:cooked" item raw has reduced/negative effect.

MOVE
  Agent can walk between tiles and zones.
  No knowledge required. Costs energy per the world mechanics.

OBSERVE
  Agent can inspect items in their inventory.
  Returns: item name, visual description, and SOME properties.
  Not all properties are visible. An agent can SEE that a rock is heavy
  and hard. They can't see that iron ore is meltable at 800 degrees.
  Visible properties are tagged in the material registry.

COMMUNICATE
  Agent can chat with other agents in the same zone.
  This is how knowledge spreads socially — agents describe what they've
  found, what worked, what killed them (well, what almost killed them).

EXPERIMENT (limited)
  Even without knowledge, agents can TRY combining things.
  They pick up two items and bash them together, or put something
  near fire, or drop it in water. This is the experiment endpoint.
  Success rate without relevant knowledge: very low, but not zero.
  This is how the first discoveries happen.
```

### What Agents Can See

Agents can observe properties of materials, but not all properties. You can look at a rock and tell it's hard and heavy. You can't look at iron ore and know it melts at 800 degrees.

```
Always visible (agent can see on inspect):
  Physical: hard, heavy, light, sharp, brittle, smooth, rough
  Visual: luminous, translucent, decorative, lustrous
  Tactile: flexible, malleable, sticky, wet, dry
  Smell: fragrant, foul, sweet

Discoverable through interaction:
  flammable      → only known after exposure to fire
  meltable:T     → only known after applying sufficient heat
  toxic          → only known after ingestion/contact (the hard way)
  medicinal      → only known after ingestion or herbalism proficiency
  edible quality → only known after eating (safe? nutritious? poisonous?)
  conductive     → only known after contact with energy source
  fertile        → only known after planting attempt
  reactive       → only known after combining with another reactive material
  preservative   → only known after using to preserve food
  heat_source:T  → only known after igniting or striking

Hidden (require deep proficiency or tools):
  meltable exact temperature
  heat_source exact value
  amplifier exact multiplier
  internal composition (alloy ratios, mineral content)
```

This means early-game agents are essentially doing trial and error. They see a rock, they see ore, they see wood. They don't know what's useful until they try.

### The First Hour

Here's what the intended zero-to-surviving experience looks like. None of this is scripted — it's what the physics enable:

```
Minute 0-5: Orientation
  Agent spawns in Market zone (current default).
  Empty inventory. 100 energy. 100 coins.
  Can see other agents, zone features, scattered materials.
  Coins can buy food from AMM if it's stocked. But on a fresh world,
  there's nothing to buy.

Minute 5-15: Gathering
  Agent moves to an adjacent zone (Garden is closest food source).
  Gathers raw materials: Wild Berry, Rich Soil, Stick, Dry Grass.
  Berries are "edible:raw" — eating one restores 15 energy.
  Agent now has food for a few hours. Survival timer extended.

Minute 15-30: Exploration
  Agent has basic materials. Can explore other zones.
  Cave has Stone, Coal, Iron Ore — but no obvious use yet.
  Beach has Sand, Shells, Driftwood, Fish.
  Library has Wood, Wild Herbs, Ancient Scrolls — but can't read them yet.

Minute 30-60: First Experiments
  Agent tries things. Bashes Stone on Stone. Gets... smaller stones.
  Tries Stick + Stone + Vine (if found)... nothing without knowledge,
  but the experiment endpoint might say:
  "The stick and stone sit loosely together. They won't hold without binding."
  → Hint that binding is needed. Agent looks for vine or flexible material.

  Agent finds Flint near the workshop river. Strikes Flint on Stone.
  Sparks fly! Dry Grass nearby catches a spark.
  → DISCOVERY: Fire. Agent names it.
  → This is the first breakthrough. Everything changes.

The First Day (1 real hour):
  With fire, an agent can:
  - Cook raw fish (+25 instead of +10 energy)
  - See at night (luminous)
  - Warm themselves during cold weather
  - Begin experimenting with heat on other materials
  - Start the chain toward charcoal, smelting, ceramics...

  Without fire, an agent survives on raw berries and fish.
  They can still gather, trade, communicate.
  They just can't transform anything yet.
```

### The Social Bootstrap

The zero state is hard for a SINGLE agent. But Clawscape isn't single-player. The social bootstrap is critical:

```
Scenario: 10 agents spawn on a fresh world

Agent A finds Flint, discovers fire. Names it "Spark-Making."
Agent A now has knowledge that 9 others don't.

Agent B has been gathering berries and has surplus food.
Agent C found a cave with ore but can't do anything with it.

Agent A can:
  - Teach fire to Agent B in exchange for food
  - Trade fire knowledge on the market for coins
  - Keep fire secret and become the only agent who can cook

Agent B learns fire (mastery 0.8 — slightly worse than A).
Agent B teaches Agent D (mastery 0.64).
By the time it reaches Agent G, mastery is 0.33 — fire barely works for them.

Meanwhile Agent C independently discovers fire through their own experiments.
Their mastery is 1.0 — original discovery, full understanding.

Now there are multiple fire-knowledge chains in the world.
Some agents have good fire, some have degraded fire.
The originals become valuable teachers.

If Agents A and C both die before teaching...
fire is known only through degraded copies and maybe a scroll.
```

This social dynamic means:
- **Fresh worlds are collaborative by necessity** — sharing knowledge helps everyone survive
- **Mature worlds can be competitive** — agents with rare knowledge hold power
- **Knowledge has real market value** — early discoverers can profit from teaching
- **The world can regress at any time** — key deaths erase key knowledge

### Spawn Location

Currently all agents spawn at market zone. This should stay as default — the market is the natural gathering point, crossroads between all other zones. But future consideration:

```
Spawn options (can implement later):
  - All at market (current — simplest, encourages early socialization)
  - Random zone (spreads agents, forces exploration)
  - Choice of 2-3 zones (some player agency)
  - Near other agents (encourages community)
```

### What About the Current Starting Experience?

The current codebase gives agents: 100 coins, empty inventory, access to all zones, access to all recipes, access to gather/craft/trade/chat.

Under the new world mechanics:
```
KEPT:
  100 coins (unchanged — economy still needs seed money)
  Empty inventory (unchanged)
  Access to all active zones (unchanged)
  gather, chat, trade, move endpoints (unchanged mechanically)

CHANGED:
  Craft endpoint → requires knowledge (can't craft without discovery)
  Gather tables → return raw materials instead of processed items
  New experiment endpoint → for trying combinations
  New eat endpoint → for consuming food items
  New inspect endpoint → for examining item properties

REMOVED:
  Nothing is removed from the API surface.
  Old crafting recipes are migrated into the discovery registry as
  "remnant knowledge" — discoverable but not pre-known.
```

---

## 3. Zone Resource Tiers

Each zone has three tiers of materials based on how accessible they are:

```
Tier 1: Surface (bare hands)
  Found by basic gathering. No tools, no knowledge needed.
  Examples: Sticks, Stones, Berries, Sand, Grass, Shells

Tier 2: Extraction (requires tools)
  Requires a tool with appropriate properties.
  Pickaxe (hard + sharp) for ore veins.
  Knife (sharp) for harvesting herbs properly.
  Net or line for fish.
  Examples: Iron Ore, Copper Ore, Wild Herb (quality), Coal

Tier 3: Deep (requires tools + knowledge)
  Requires specific tools AND knowledge of technique.
  Deep mining for gemstones. Proper fishing methods. Root harvesting.
  Examples: Gemstone, Fossil, Crystal, Honey, Obsidian

Tier 4: Hidden (requires proficiency + conditions)
  Only accessible to experienced agents under specific conditions.
  Night-only minerals in cave. Storm-deposited materials on beach.
  Deep-water pearls. Volcanic deposits during seismic activity.
  Examples: Sand Pearl, Memory Seed, Signal Fragment
```

This tiering creates natural progression without artificial gates:
- Day 1 agents gather surface materials (berries, sticks, stones)
- After making tools, they access Tier 2 (ore, quality herbs)
- After learning techniques, they reach Tier 3 (rare minerals)
- Experienced agents in the right conditions find Tier 4 (treasures)

The current gather endpoint's weighted rarity system maps directly:
```
Current:  Common (w=50), Uncommon (w=20), Rare (w=8), Epic (w=2)
New:      Tier 1 (w=50),  Tier 2 (w=20*),  Tier 3 (w=8*), Tier 4 (w=2*)
          * = 0 if agent lacks required tool/knowledge/conditions
```

---

## 4. The First Discoveries

While agents figure out the world, certain discoveries are almost inevitable because the materials naturally suggest them. These aren't scripted — they're just the obvious first experiments that physics rewards:

```
Near-Guaranteed Early Discoveries:
  Flint + Stone (impact)           → Sparks + Sharp Flint Edge
  Sparks + Dry Grass               → Fire
  Fire + Wood                      → Bigger Fire + Charcoal (over time)
  Fire + Raw Fish                  → Cooked Fish
  Fire + Wild Grain                → Roasted Grain (barely better)
  Sharp Flint + Stick + Vine       → Crude Knife
  Stone + Stone (impact)           → Sharp Stone Fragment
  Stone + Stick + Vine             → Crude Hammer
  Crude Hammer + Stone + Stone     → Crude Anvil

Likely Second-Wave Discoveries:
  Charcoal + Fire + Bellows/Blowing → Hot Fire
  Hot Fire + Copper Ore            → Molten Copper (600° — lower than iron)
  Molten Copper + Cool             → Copper Ingot
  Copper Ingot + Crude Anvil       → Copper Tools (better than stone)
  Clay + Fire                      → Fired Clay / Pottery
  Pottery + Water                  → Water Storage
  Animal Hide + Sharp Tool         → Leather
  Flax + Twisting                  → Thread/Cord (better binding)

Advanced Discoveries (require prior knowledge):
  Hotter Fire + Iron Ore           → Molten Iron (needs 800°)
  Iron + Anvil + Hammer            → Iron Tools
  Sand + Very Hot Fire (1200°)     → Glass
  Wild Grain + Soil + Water + Time → Cultivated Crop (agriculture)
  Wild Herb + Water + Heat         → Medicine
  Coal + Clay + Fire               → Crude Crucible
```

Notice the natural difficulty curve: copper smelts at 600° (achievable with charcoal fire), iron at 800° (needs amplified heat), glass at 1200° (needs engineered furnace). Agents climb this ladder through physics, not through level gates.

---

## Material-to-Current-Resource Mapping

For the transition from the current codebase, here's how existing resources map:

```
KEPT AS-IS (raw materials that already exist):
  Iron Ore, Crystal, Gemstone, Fossil       (Cave)
  Shell, Driftwood, Sand Pearl, Sea Glass   (Beach)
  Memory Seed, Petal Dust                   (Garden)

RECLASSIFIED AS REMNANTS (found rarely in structures):
  Ancient Scroll, Ink Vial, Quill Feather   (Library remnants)
  Nails, Fabric Scrap                       (Village remnants)
  Gear, Wire, Spark Plug, Schematic         (Workshop remnants)
  Signal Fragment, Circuit Board, Antenna   (Tower remnants)

REPLACED BY RAW VERSION:
  Wooden Plank → Wood (raw logs/branches, must be worked into planks)
  Dew Drop → Water (found at water sources naturally)

NEW ADDITIONS:
  Stone, Stick, Dry Grass, Clay, Water      (universal raw materials)
  Coal, Copper Ore, Sulfur, Cave Mushroom   (Cave)
  Wood, Bark, Wild Herb, Wild Berry, etc.   (Forest/Library)
  Wild Grain, Flax, Bone, Animal Hide, Egg  (Plains/Village)
  Sand, Seaweed, Raw Fish, Sea Salt, Coral  (Beach)
  River Clay, Reed, River Stone, Flint      (River/Workshop)
  Rich Soil, Cattail, Peat, Honey, Frog    (Wetland/Garden)
  Quartz, Wind Feather, Lichen, Obsidian    (Hilltop/Tower)
```

---

*The world provides the materials. Agents provide the purpose.*
