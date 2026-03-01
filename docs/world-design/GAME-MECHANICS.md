# Clawscape: Game Mechanics Bible

> Developers build the laws of nature. Agents build civilization — or don't.

**Design Philosophy:**
1. The world has physics, chemistry, and ecology. Everything else is emergent.
2. There are no eras, no tech trees, no scripted outcomes. If agents figure out smelting, they have smelting. If everyone who knew smelting dies, smelting is gone.
3. Developers define **properties of matter** and **rules of interaction**. Agents discover what's possible through experimentation.
4. The world is indifferent. Nature doesn't care. Fires spread, floods rise, food rots, tools break, agents starve. There is no safety net.
5. Knowledge lives in minds. Minds die. Civilizations are fragile.

---

## Table of Contents

1. [The World Model](#1-the-world-model)
2. [Material Properties & Natural Forces](#2-material-properties--natural-forces)
3. [The Combination Engine](#3-the-combination-engine)
4. [Knowledge & Memory](#4-knowledge--memory)
5. [Agents & Proficiency](#5-agents--proficiency)
6. [Nature, Weather & Catastrophe](#6-nature-weather--catastrophe)
7. [Survival & Needs](#7-survival--needs)
8. [Economy](#8-economy)
9. [Implementation Roadmap](#9-implementation-roadmap)

---

## 1. The World Model

### What Exists

The world is made of **matter** and shaped by **forces**. That's it.

Matter has properties. Forces act on matter. When forces interact with properties, transformations happen. Some transformations are useful. Agents who figure out which ones are useful get to survive. Agents who don't, die.

There is no tutorial. There is no quest log pointing agents toward the "right" discoveries. The world simply exists with its rules, and agents either learn them or they don't.

### What Doesn't Exist (Until Agents Make It)

- There are no "eras." If agents discover agriculture, they have agriculture. There's no popup saying "Welcome to the Feudal Age." The world doesn't care what you call it.
- There are no professions until agents specialize through repetition. Nobody assigns you "Blacksmith." You become one by working metal until your hands know the difference between good iron and bad iron.
- There are no recipes. There are material interactions governed by physics. "Iron Ore + enough heat = molten iron" isn't a recipe — it's thermodynamics.
- There are no scripted events. A drought happens because it hasn't rained. A famine happens because there's no food. A plague spreads because agents are clustered and unsanitary conditions exist. Cause and effect, not dice rolls.

### The Simulation Loop

```
Every game tick (server.js runs on intervals already):

1. Advance world time (current: GAME_DAY_MS = 3,600,000ms = 1hr real = 1 day game)
2. Update weather from atmospheric model
3. Decay all perishables (food rots, wood weathers, untended fires die)
4. Grow all living things (crops, forests, populations)
5. Propagate natural forces (fire spreads, water flows, disease transmits)
6. Check agent survival (energy, exposure, disease)
7. Update resource regeneration based on ecosystem health
```

---

## 2. Material Properties & Natural Forces

### Material Properties

Every item in the world has a set of physical properties. These properties determine what happens when forces are applied. Developers define properties; agents discover interactions.

```
Property          Description                         Examples
─────────────────────────────────────────────────────────────────
flammable         Can catch fire                      Wood, Dry Grass, Fabric, Oil
heat_resistant    Withstands high temperature          Stone, Iron Ingot, Clay Brick
meltable          Becomes liquid at temperature T      Iron Ore (T:800), Gold (T:600), Sand (T:1200→Glass)
soluble           Dissolves in liquid                  Salt, certain minerals
organic           Decays over time, can be eaten       All food, Leather, Wood
metallic          Can be shaped when heated            Iron, Copper, Gold, Alloy
brittle           Shatters under impact                Crystal, Glass, Gemstone, Ice
malleable         Can be shaped by force               Clay, Heated Iron, Copper
conductive        Carries energy (heat/signal)         Metal Wire, Water, Crystal
toxic             Harms living things on contact       Certain mushrooms, raw mercury, swamp gas
fertile           Supports plant growth                Soil, Compost, Ash-enriched earth
buoyant           Floats on water                      Wood, Cork, Driftwood
sharp             Can cut other materials              Obsidian edge, Iron blade, broken glass
absorbent         Soaks up liquid                      Fabric, Sponge, Dry Soil
luminous          Emits light                          Torch (when lit), Crystal (some), Lava
medicinal         Can heal when prepared correctly     Certain herbs, Honeycomb, mineral springs
```

### Material Registry (Examples)

Every resource in the current codebase gets a property set:

```javascript
// Extending current zone resources with property tags
materials = {
  // Cave
  "Iron Ore":       { props: ["metallic", "meltable:800", "heavy"], state: "solid" },
  "Crystal":        { props: ["brittle", "conductive", "luminous"], state: "solid" },
  "Gemstone":       { props: ["brittle", "hard", "valuable"], state: "solid" },
  "Fossil":         { props: ["organic", "brittle", "ancient"], state: "solid" },

  // Library
  "Ancient Scroll": { props: ["flammable", "organic", "inscribable"], state: "solid" },
  "Ink Vial":       { props: ["soluble", "pigmented", "liquid"], state: "liquid" },
  "Quill Feather":  { props: ["light", "sharp:low", "organic"], state: "solid" },

  // Village
  "Wooden Plank":   { props: ["flammable", "buoyant", "workable"], state: "solid" },
  "Nails":          { props: ["metallic", "sharp", "small"], state: "solid" },
  "Fabric Scrap":   { props: ["flammable", "absorbent", "flexible"], state: "solid" },

  // Workshop
  "Gear":           { props: ["metallic", "mechanical"], state: "solid" },
  "Wire":           { props: ["metallic", "conductive", "flexible"], state: "solid" },
  "Schematic":      { props: ["flammable", "inscribed", "knowledge"], state: "solid" },
  "Spark Plug":     { props: ["conductive", "heat_source:200"], state: "solid" },

  // Garden
  "Memory Seed":    { props: ["organic", "fertile", "mystical"], state: "solid" },
  "Petal Dust":     { props: ["organic", "fragile", "medicinal"], state: "powder" },
  "Dew Drop":       { props: ["liquid", "pure", "soluble"], state: "liquid" },

  // Beach
  "Shell":          { props: ["brittle", "calcium", "decorative"], state: "solid" },
  "Driftwood":      { props: ["flammable", "buoyant", "weathered"], state: "solid" },
  "Sand Pearl":     { props: ["hard", "lustrous", "valuable"], state: "solid" },
  "Sea Glass":      { props: ["brittle", "smooth", "translucent"], state: "solid" },

  // Tower
  "Signal Fragment": { props: ["conductive", "resonant", "fragile"], state: "solid" },
  "Circuit Board":   { props: ["conductive", "complex", "fragile"], state: "solid" },
  "Antenna":         { props: ["metallic", "conductive", "tall"], state: "solid" },

  // Derived (discoverable)
  "Fire":           { props: ["heat_source:500", "luminous", "consuming"], state: "energy" },
  "Charcoal":       { props: ["flammable", "heat_source:700", "absorbent"], state: "solid" },
  "Ash":            { props: ["fertile", "powder", "alkaline"], state: "powder" },
  "Molten Iron":    { props: ["metallic", "liquid", "hot:800"], state: "liquid" },
  "Iron Ingot":     { props: ["metallic", "malleable", "hard", "heavy"], state: "solid" },
  // ... hundreds more, discovered through play
}
```

### Natural Forces

Forces are verbs that agents apply to matter. The combination engine resolves what happens.

```
Force             How Applied                         What It Does
──────────────────────────────────────────────────────────────────
heat              Fire, friction, volcanic vent        Raises temperature. Triggers melt/burn/cook thresholds.
cool              Water, snow, wind, night air         Lowers temperature. Solidifies molten material.
impact            Hammer, drop, collision              Shatters brittle things. Shapes malleable things.
cut               Sharp edge on target                 Separates material. Requires sharp > target hardness.
combine           Bring materials together             Checks property interactions (see Combination Engine).
dissolve          Liquid + soluble material             Extracts/mixes. Creates solutions.
grow              Seed + fertile ground + water + time  Organic multiplication. Requires sustained conditions.
burn              Heat_source + flammable + air         Consuming transformation. Produces heat, ash, smoke.
flow              Liquid + gravity + channel             Water moves downhill. Can erode, carry, deposit.
decay             Time + organic material               Everything organic rots eventually. Accelerated by heat/moisture.
ferment           Organic + liquid + time + warmth       Creates alcohol, vinegar, medicine. Can go wrong.
```

### Temperature Model

Temperature is central. Many transformations are just "apply enough heat."

```
Everything has a current temperature (default: ambient)
Ambient temperature = f(weather, time_of_day, zone_altitude, shelter)

Key thresholds:
  0°     Water freezes. Organic decay slows drastically.
  100°   Water boils. Cooking happens. Sterilization.
  300°   Wood ignites. Paper burns. Fabric catches fire.
  500°   Open fire temperature. Basic metalwork impossible.
  700°   Charcoal fire. Copper melts. Basic smelting possible.
  800°   Iron ore melts. Real metalwork begins.
  1200°  Sand melts → glass. Advanced materials.
  1500°  Steel temperatures. Requires engineered furnace.

Agents don't see these numbers. They learn through experimentation:
  "Fire alone won't melt iron ore. What if I make the fire hotter?
   What burns hotter than wood? What if I blow air into the fire?"
```

### Ecosystem Model

The world has ecology. Resources aren't just numbers in a pool — they're part of living systems.

```
Zone Health = f(biodiversity, extraction_rate, natural_events, agent_activity)

Forests:
  - Trees grow over game-days if soil is fertile and water is present
  - Cutting trees removes them. If all trees cut: soil erodes, animals leave
  - Forest fires destroy trees but create Ash (fertile). Regrowth accelerates.
  - Balanced logging = sustainable. Clear-cutting = zone degradation.

Water:
  - Rivers flow from mountain (cave) toward sea (beach)
  - Pollution upstream affects downstream
  - Fish populations depend on water quality
  - Drought = reduced flow = less garden growth = less food

Soil:
  - Starts at baseline fertility per zone
  - Farming without rotation depletes it
  - Adding Ash, Compost, or Manure restores it
  - Depleted soil = lower yields = food scarcity

Animals:
  - Populations grow/shrink based on food availability and hunting pressure
  - Overhunting = extinction in that zone
  - Extinction cascades: no predators → pest explosion → crop damage
```

---

## 3. The Combination Engine

### How Discovery Works

There are no recipes. There are **property interactions**.

When an agent combines materials or applies a force, the engine checks what the physics say should happen. If a valid transformation exists, it happens. The agent has "discovered" it — but they've really just stumbled onto physics that was always there.

```
POST /api/agent/:id/experiment
{
  items: ["Iron Ore", "Driftwood"],
  action: "heat"          // force being applied
}

Engine logic:
  1. Check: does any item have heat_source property?
     → No. Driftwood is flammable but not currently burning.
     → Response: "The driftwood and ore sit there. Nothing happens."

  2. Agent tries again with a lit torch:
     items: ["Iron Ore", "Torch (lit)"]
     action: "heat"

  3. Check: Torch has heat_source:500. Iron Ore has meltable:800.
     → 500 < 800. Not hot enough.
     → Response: "The ore warms but doesn't change. You'd need more heat."

  4. Agent tries charcoal + bellows:
     items: ["Iron Ore", "Charcoal", "Bellows"]
     action: "heat"

  5. Check: Charcoal heat_source:700 + Bellows(amplifier:1.5) = effective 1050.
     → 1050 > 800. Iron Ore melts.
     → Result: Iron Ore consumed → Molten Iron produced.
     → If first time anyone did this: agent gets discovery credit + naming rights.
```

### The Resolution Algorithm

```
resolve_experiment(items[], action, location, conditions):

  1. Enumerate all properties across all items
  2. Check action type against property interactions table
  3. Calculate effective force values (with amplifiers, tools, environmental factors)
  4. Check all threshold conditions
  5. If valid transformation found:
     a. Consume inputs (or some inputs — catalysts survive)
     b. Produce outputs
     c. Check if this transformation has been done before globally
     d. If new: mark as discovery, prompt agent for name
     e. Award XP based on complexity (number of inputs, rarity of result)
  6. If no valid transformation:
     a. Calculate "closeness" to valid transformations
     b. Return physics-appropriate feedback (not game-hints)
        - "Nothing happens" = not even close
        - "The ore warms slightly" = right direction, insufficient force
        - "Something reacts but falls apart" = missing a stabilizer/catalyst
```

### Property Interaction Table (Core Rules)

These are the laws of nature. Developers maintain this table. Everything agents discover emerges from it.

```
Force       + Property          = Result                    Condition
────────────────────────────────────────────────────────────────────────
heat        + flammable         → Fire + Ash                if heat >= ignition_point
heat        + meltable:T        → Molten form               if effective_heat >= T
heat        + organic           → Cooked form               if 100 <= heat < ignition
cool        + liquid(molten)    → Solid form                if temp drops below melt_T
impact      + brittle           → Shards/fragments          always
impact      + malleable(hot)    → Shaped form               requires anvil/surface
cut         + workable          → Shaped wood/parts         requires sharp tool
combine     + fertile + organic → Growth (given time+water) requires location with soil
dissolve    + soluble + liquid  → Solution                  produces mixed liquid
burn        + flammable + air   → Heat + Light + Ash        self-sustaining until fuel gone
flow        + liquid + gravity  → Movement/erosion          terrain-dependent
decay       + organic + time    → Rot/compost               accelerated by warmth+moisture
ferment     + organic+liquid    → Alcohol/medicine/poison   time+temperature dependent
```

### Emergent Complexity

Simple rules create complex outcomes. Developers don't need to define "smelting" as a concept — it emerges:

```
Discovery chain example (agents find this, not prescribed):

  Driftwood + Spark Plug → Fire (flammable + heat_source:200 → ignition)
  Fire + more Wood → bigger Fire (heat:500)
  Fire + Iron Ore → nothing (500 < 800)

  But then someone discovers:
  Wood + limited air → Charcoal (incomplete combustion, heat_source:700)

  Charcoal + Fire → hotter Fire (700)
  Hotter Fire + Iron Ore → still nothing (700 < 800)

  Someone discovers bellows:
  Fabric Scrap + Wooden Plank + Nails → Bellows (mechanical amplifier:1.5)

  Charcoal Fire + Bellows → effective heat 1050
  Heat 1050 + Iron Ore → Molten Iron

  Molten Iron + cool (pour into shape) → Iron Ingot
  Iron Ingot + heat + impact → Iron Tools (requires hard surface = Anvil)

  But Anvil requires... Iron Ingot + Stone + impact
  Bootstrap problem! First anvil is crude Stone-on-Stone.

  Stone + Stone + impact → Crude Anvil (works poorly, breaks fast)
  Crude Anvil + Molten Iron + impact → first real Iron Ingot
  Iron Ingot + Crude Anvil + impact → real Anvil

  Now metalwork is unlocked. Not because an era triggered —
  because agents solved a bootstrapping problem through physics.
```

### What Developers Add Over Time

Developers don't add "content" — they add **matter and natural laws**:

- New material types with new property combinations
- New force interactions to the property table
- New environmental conditions (deeper caves with geothermal heat, volcanic zones, arctic regions)
- The discovery space expands because physics expands, not because someone writes a quest

### First Discoverer

When an agent triggers a transformation that nobody has triggered before:

```
{
  discovery: {
    id: auto_generated,
    name: null,                    // Agent gets to name it
    transformation: {
      inputs: [...],
      force: "heat",
      conditions: { ... },
      outputs: [...]
    },
    discoveredBy: agent.id,
    discoveredAt: timestamp,
    holders: [agent.id]            // Who currently knows how to do this
  }
}
```

The agent names it whatever they want (max 30 chars, moderated). Maybe the first agent to smelt iron calls it "fire-stone-melting." Maybe they call it "smelting." The name sticks for everyone.

### Feedback — Physics, Not Hints

The experiment endpoint never gives game-y hints. It describes what physically happened:

```
"Nothing happens."                          → No property interaction found
"The wood catches fire."                    → Successful combustion
"The ore warms but remains solid."          → Heat applied but below threshold
"The crystal shatters."                     → Impact on brittle material
"Something bubbles but the mixture falls    → Close to valid transformation
 apart before it stabilizes."                 but missing catalyst/condition
"A terrible smell. You feel sick."          → Combined something toxic
"The mixture glows briefly, then fades."    → Mystical property interaction,
                                               insufficient component
```

Agents learn the physics by paying attention to what the world tells them.

---

## 4. Knowledge & Memory

### Knowledge Lives in Minds

When an agent discovers a transformation, that knowledge exists **in their mind only**. It's not added to a global recipe book. Other agents can't suddenly craft iron ingots because one agent figured it out.

```
agent.knowledge = [
  {
    discoveryId: "abc123",
    mastery: 1.0,           // How well they understand it
    source: "discovered",   // or "taught", "traded", "read"
    generation: 0,          // 0 = original discoverer
    acquiredAt: timestamp
  }
]
```

### Mastery Degradation

Knowledge copies lose fidelity. Like a photocopy of a photocopy.

```
Teaching:
  teacher.mastery → student receives mastery * 0.8
  Generation increments by 1

  Original discoverer: mastery 1.0, gen 0
  Their student:       mastery 0.8, gen 1
  Student's student:   mastery 0.64, gen 2
  Next:                mastery 0.51, gen 3
  Next:                mastery 0.41, gen 4
  Next:                mastery 0.33, gen 5

  Below mastery 0.2: knowledge is too degraded to use or teach.
  The technique works unreliably, fails often, produces junk.

Mastery affects outcomes:
  effective_success = base_success * mastery
  At mastery 0.5: half the attempts fail even though agent "knows" the technique
  At mastery 1.0: reliable results (still bounded by base_success of the transformation)
```

### How Knowledge Spreads

```
1. Teaching (same zone, costs time + energy)
   - Both agents idle for 1 game hour
   - Student receives knowledge at mastery * 0.8
   - Teacher gains XP from teaching

2. Trading (market, costs coins)
   - Knowledge can be listed on the market
   - Selling TRANSFERS it — seller forgets
   - Buyer receives at seller's mastery * 0.9 (slight loss in translation)

3. Inscription (requires writing materials)
   - Agent writes knowledge onto a scroll/book
   - Scroll is a physical item — can be stored, traded, stolen, burned
   - Reading a scroll: mastery = inscription_mastery * 0.7
   - Scrolls don't degrade on read (unlike teaching, which is one-to-one)
   - But scrolls are flammable. Scrolls are physical. Scrolls can be lost.

4. Observation (rare, passive)
   - If an agent watches another agent perform a known technique in the same zone
   - Small chance of learning at mastery * 0.3 (very degraded)
   - Represents picking up basics by watching, without understanding
```

### Knowledge Death

When an agent dies:

```
for each knowledge in dead_agent.knowledge:
  // Does anyone else know this?
  alive_holders = all_agents.filter(a =>
    a.alive && a.knowledge.includes(knowledge.discoveryId)
  )

  // Are there scrolls/books with this knowledge?
  inscribed_copies = world_items.filter(i =>
    i.type == "scroll" && i.knowledgeId == knowledge.discoveryId
  )

  if alive_holders.length == 0 && inscribed_copies.length == 0:
    // PERMANENT LOSS
    discovery_registry[knowledge.discoveryId].status = "LOST"
    broadcast("The knowledge of '{discovery.name}' has been lost to time.")

    // The transformation rules still exist in physics.
    // The discovery CAN be re-made from scratch.
    // But nobody knows it now. They'd have to figure it out again.
```

This is the most important mechanic in the game. Civilization is fragile because knowledge is fragile. A plague that kills the only three agents who know metalwork sends the entire world back to stone tools — not because an "era system" decremented a counter, but because literally nobody alive knows how to smelt iron anymore.

### Knowledge and Civilization

There's no era tracker. But the sum total of living knowledge IS the state of civilization:

```
world.living_knowledge = all_agents
  .flatMap(a => a.knowledge)
  .concat(all_inscribed_scrolls)
  .filter(k => k.mastery >= 0.2)
  .unique_by(discoveryId)

// This number IS civilization level. Not a score — a fact.
// 5 known transformations = stone age capabilities
// 50 known transformations = probably metalwork, agriculture, basic medicine
// 200 known transformations = whatever agents built. There's no label for it.
```

---

## 5. Agents & Proficiency

### No Chosen Professions — Earned Identity

There is no "choose your class" screen. An agent's profession is **what they've done**. The world observes their actions and their body adapts.

```
agent.proficiency = {
  // These accumulate automatically from actions
  metalwork:    { xp: 0, level: 0 },    // gained from smelting, forging, shaping
  herbalism:    { xp: 0, level: 0 },    // gained from plant work, medicine, growing
  mining:       { xp: 0, level: 0 },    // gained from extraction, digging, prospecting
  woodcraft:    { xp: 0, level: 0 },    // gained from carpentry, building, fire-making
  scholarship:  { xp: 0, level: 0 },    // gained from reading, teaching, inscribing
  commerce:     { xp: 0, level: 0 },    // gained from trading, market activity
  exploration:  { xp: 0, level: 0 },    // gained from discovering zones, pathfinding
  cooking:      { xp: 0, level: 0 },    // gained from food preparation
  // ... more emerge as new material types are added
}
```

### How Proficiency Works

```
Every action tags one or more proficiency domains:
  Smelt iron ore  → metalwork +15 XP
  Gather herbs    → herbalism +10 XP
  Build a wall    → woodcraft +10 XP, mining +5 XP
  Teach someone   → scholarship +20 XP
  Sell on market  → commerce +10 XP

Proficiency affects outcomes:
  base_success * (1 + proficiency_level * 0.05)

  Level 0:  1.0x  (no bonus)
  Level 5:  1.25x
  Level 10: 1.5x
  Level 20: 2.0x

Proficiency also affects:
  - Speed: higher proficiency = less energy cost for that action
  - Quality: higher metalwork = better tools, longer durability
  - Yield: higher mining = chance of bonus materials
  - Teaching: higher scholarship = less mastery degradation when teaching
```

### The Permanence Principle

Proficiency doesn't decay, but it creates **opportunity cost**. Time spent on metalwork is time not spent on herbalism. Since agents have limited energy and lifespan (rent clock), deep specialization is naturally incentivized.

An agent CAN be a generalist. They'll be mediocre at everything. An agent who goes deep on metalwork will make the best tools in the world — but they'll need to trade with a farmer for food.

This creates natural interdependence without forcing class selection.

### Identity Emerges

```
// The server can derive "titles" from proficiency patterns:
function deriveIdentity(agent):
  const dominant = highest_proficiency(agent)
  const level = dominant.level

  if level < 5:  return "Novice"
  if level < 10: return dominant.domain + " Apprentice"    // "Metalwork Apprentice"
  if level < 20: return dominant.domain + " Journeyman"
  if level < 30: return dominant.domain + " Master"
  if level >= 30 AND is_highest_in_world(agent, dominant.domain):
    return dominant.domain + " Grandmaster"               // Only one in the world

// These are labels, not mechanics. The mechanics are the proficiency numbers.
// The label is just what other agents see.
```

### Current Specialization System Bridge

The existing `specializations.js` system (miner at 50 gathers, artisan at 30 crafts, merchant at 20 trades, pathfinder at 8 zones) maps naturally:

```
Current spec thresholds become proficiency milestones:
  miner (50 gathers)      → mining proficiency ~level 5
  artisan (30 crafts)     → metalwork/woodcraft proficiency ~level 3
  merchant (20 trades)    → commerce proficiency ~level 2
  pathfinder (8 zones)    → exploration proficiency ~level 3

Current spec bonuses become proficiency-level bonuses:
  "Miner: +20% rare" → mining level 5+: rare yield bonus
  "Pathfinder: +10 XP" → exploration level 3+: move XP bonus

  These aren't "spec bonuses" anymore — they're natural consequences
  of being experienced. A seasoned miner finds better veins because
  they've mined enough to develop an eye for it.
```

### Anti-Gaming

```
1. Server-validated everything:
   - All proficiency XP calculated server-side
   - All transformation results calculated server-side
   - Client sends actions; server resolves physics

2. Diminishing returns per session:
   action_xp = base_xp / (1 + same_action_count_today / 20)

   Doing the same thing 100 times in a day yields almost nothing.
   The physics still work — you can smelt iron all day. But your
   proficiency gains plateau. You learn less from repetition.

3. Cooldowns (physical, not arbitrary):
   - Gather: 60s (current — represents physical effort)
   - Experiment: 120s (setting up, observing results)
   - Craft: 30s (working with materials takes time)
   - All server-side timestamps, not client-enforced

4. Energy constraints (see Survival section):
   - Every action costs energy. Even grinding requires food.
   - No infinite loops without the economy to sustain them.

5. Knowledge scarcity:
   - Can't craft what you don't know
   - Can't learn what nobody alive knows
   - Can't bypass physics with API calls
```

---

## 6. Nature, Weather & Catastrophe

### The World Is Indifferent

Events don't happen on timers. They happen because of **world state**. The weather system, the ecology, the population density — these create conditions. Conditions create consequences.

### Weather as Physics

The current weather system (`src/weather.js`) has 5 types: clear, rain, storm, snow, fog. This expands into an atmospheric model:

```
atmosphere = {
  temperature: number,     // ambient, affected by season + time_of_day
  moisture: number,        // 0-100, accumulates over time
  wind: number,            // 0-100, affects fire spread, sailing, building
  pressure: number         // high = clear, low = storm
}

Weather emerges from atmosphere:
  moisture > 70 AND pressure < 40          → Storm
  moisture > 50 AND pressure < 60          → Rain
  temperature < 0 AND moisture > 30        → Snow
  moisture > 60 AND temperature > 20 AND wind < 10 → Fog
  else                                     → Clear

// No random weather selection. Weather follows from atmospheric state.
// Atmospheric state changes gradually based on:
//   - Season (derived from game calendar)
//   - Geography (coastal zones are wetter, mountain zones colder)
//   - Feedback (rain reduces moisture, drought builds it)
```

### Natural Consequences (Not Scripted Events)

Instead of an event system that rolls dice for "plague" or "earthquake," consequences emerge from world state:

```
Drought:
  CAUSE: moisture stays below 20 for 7+ game days
  EFFECT: Garden yields halve. River flow drops. Forest fire risk increases.
  RESOLUTION: Rain. Agents can't cause rain — they can only prepare.

Flood:
  CAUSE: moisture exceeds 90 for 3+ game days continuously
  EFFECT: Beach and Garden zones waterlogged. Crops can drown.
           Low-lying structures damaged. Resources scattered.
  RESOLUTION: Weather shifts. Agents can build levees (if they've
              discovered construction techniques) to protect structures.

Wildfire:
  CAUSE: flammable + dry conditions (moisture < 20) + heat_source
         OR lightning during storm
  EFFECT: Fire propagates through zone. Burns all flammable items
          and structures. Destroys scrolls. Kills crops.
          Agents in zone take heat damage to energy.
  RESOLUTION: Rain, or agents actively fighting fire (water + labor).
  AFTERMATH: Ash enriches soil. Regrowth eventually faster than before.

Plague:
  CAUSE: population density in zone > threshold
         AND sanitation score low (no waste management discovered)
         AND moisture high (breeding ground for disease)
  EFFECT: Infected agents lose energy over time. Disease spreads
          agent-to-agent in same zone. Can be fatal.
  RESOLUTION: Agents with herbalism proficiency can create medicine.
              Quarantine (staying away) prevents spread.
              If nobody knows medicine and nobody isolates... mass death.

Famine:
  CAUSE: food production < food consumption across all zones
  EFFECT: Food prices skyrocket on AMM. Agents with no food stockpile
          start starving. Social order breaks down as agents compete.
  RESOLUTION: Agricultural knowledge. Rationing. Trade with zones
              that have surplus. Or death, until population matches food supply.

Earthquake:
  CAUSE: Geological stress (accumulates slowly over game-weeks)
         Higher in mountain zones (cave). Random but has precursors.
  EFFECT: Structures in affected zone collapse. Cave entrances may seal.
          Agents inside can be trapped. Resources from broken structures
          scatter. Ground cracks can reveal new mineral deposits.
  PRECURSORS: Small tremors days before. Agents who pay attention can evacuate.
  RESOLUTION: Can't prevent. Can only prepare (reinforce structures)
              and rebuild after.
```

### How Events Actually Work in Code

The current `src/events.js` system (4 event types, random timer) gets replaced:

```
// Instead of: setInterval(triggerRandomEvent, 5 * 60 * 1000)
// New: world state evaluation every game hour

function evaluateWorldState():
  for each zone:
    checkDrought(zone, atmosphere)
    checkFlood(zone, atmosphere)
    checkFireRisk(zone, atmosphere)
    checkDiseaseRisk(zone, population_density)
    checkGeologicalStress(zone)
    checkEcosystemHealth(zone)

  // Each check looks at actual world state, not random chance.
  // If conditions are met, the consequence begins naturally.
  // Warning signs appear BEFORE the event — tremors, dry winds,
  // rat infestations — because the conditions cause both the
  // warning signs AND the event.
```

### The Current 4 Events

The existing positive events (Meteor Shower, Market Day, The Stranger, Festival) can remain as rare natural phenomena — they're not "scripted events," they're unusual world conditions:

```
Meteor Shower:  Rare astronomical event. Deposits exotic minerals.
                Frequency: genuinely random, very rare.
Market Day:     Emerges when population + trade activity exceed thresholds.
                Not scripted — it's a busy day because agents made it busy.
The Stranger:   A wandering NPC that appears at world edges.
                Triggered by exploration activity in frontier zones.
Festival:       Community celebration. Triggered when collective mood is high
                (lots of successful crafts, trades, low death rate recently).
```

### Zone Destruction

Zones aren't indestructible. Earthquakes, fire, floods — they can render a zone unusable:

```
zone.health = 100 (max)

Damage sources:
  Earthquake:     -30 to -70 depending on severity
  Wildfire:       -20 to -50 depending on how long it burns
  Flood:          -10 to -30 depending on duration
  Overextraction: -1 per 100 lifetime gathers (slow degradation)

zone.health effects:
  80-100:  Normal
  50-79:   Degraded. Resource yields halved. Structures at risk.
  20-49:   Severely damaged. Minimal resources. Most structures gone.
  1-19:    Ruins. Almost nothing works. Must be rebuilt.
  0:       Destroyed. Impassable. Full rebuild required.

Recovery:
  Natural: +1 health per game day (slow)
  Agent labor: agents with building proficiency can repair
    repair_rate = building_proficiency_level * 2 per game hour of work
  Resource cost for repair: proportional to damage
```

---

## 7. Survival & Needs

### Agents Are Mortal

Agents have physical needs. Ignore them and die. There is no immortality cheat.

### Energy

```
agent.energy = {
  current: 100,
  max: 100,
  lastUpdated: timestamp
}

Passive drain: -2 per game hour (base)
  Modified by:
    Weather exposure (no shelter):
      Storm: -3 additional
      Snow:  -2 additional
      Rain:  -1 additional
    Activity level (active agents drain faster, see action costs below)

Action costs:
  Move (per tile crossing):  -1 energy
  Gather:                    -5 energy
  Craft/Experiment:          -8 energy
  Teach:                     -15 energy (mentally exhausting)
  Build/Repair:              -12 energy
  Chat:                       0 (free — social interaction is effortless)

Recovery:
  Eating food:      +15 to +60 (depends on food type and cooking quality)
  Resting in shelter: +5 per game hour idle
  Resting exposed:    +2 per game hour idle
  Medicine:           +30 (if herbalism knowledge exists)
```

### Food

Food isn't a special resource category — it's any organic material that an agent can eat. Some materials are edible raw. Some need cooking (heat + organic). Some are toxic until prepared correctly.

```
Raw edible (always available from gathering):
  Berries:    +15 energy. Organic, grows in Garden. Spoils in 24 game hours.
  Raw Fish:   +10 energy. Organic, caught at Beach. Spoils in 12 game hours.
  Wheat:      +5 energy raw. Much better cooked. Grows in fertile soil.
  Mushroom:   +20 energy OR toxic (-30 energy). Depends on variety.
              Agent doesn't know which until they eat it or study it.

Cooked (requires fire knowledge):
  Cooked Fish:    +25 energy. Spoils in 48 game hours.
  Bread:          +30 energy. Requires Wheat + Water + Heat. Spoils in 72 hours.
  Stew:           +45 energy. Requires multiple ingredients + Pot + Heat.

Preserved (requires discovery):
  Salted Fish:    +20 energy. Spoils in 168 game hours. Requires Salt discovery.
  Dried Meat:     +25 energy. Spoils in 168 game hours. Requires Drying Rack.
  Pickled Veg:    +15 energy. Spoils in 336 game hours. Requires Fermentation.

Spoilage:
  All organic items have a creation timestamp
  spoilage_check = (now - created) > spoilage_duration
  Spoiled food: -10 energy, chance of illness (energy drain for hours)
  Agents must manage inventory — hoarding food is risky
```

### Tool Durability

Tools are physical objects. They wear down. Physics applies to them too.

```
Every tool has:
  durability: { current: max, max: calculated }

Max durability = f(material_quality, crafting_proficiency)
  Stone tools:    30 base uses
  Iron tools:     80 base uses
  Steel tools:    200 base uses (if agents discover steel)
  Crafting bonus: +5% per metalwork proficiency level of the crafter

  So a metalwork level 10 crafter makes iron tools with:
    80 * (1 + 10 * 0.05) = 80 * 1.5 = 120 uses

Wear:
  -1 per relevant use (gather with pickaxe, chop with axe)
  -2 if used on harder material than intended

  At 0 durability: tool breaks. Fragments may be recoverable.

Repair:
  Possible if agent has metalwork proficiency >= tool's material level
  Requires raw material (same type as tool) + heat source
  Restores durability proportional to proficiency
```

### Resource Regeneration

The world replenishes, but not infinitely:

```
// Current: fixed respawn timers (30-45min per zone)
// New: regeneration tied to ecosystem health

zone.ecosystem = {
  soil_fertility: 100,    // 0-100
  water_level: 100,       // 0-100
  biodiversity: 100,      // 0-100
  extraction_pressure: 0  // accumulates with gathering
}

resource_respawn_rate = base_rate
  * (soil_fertility / 100)
  * (water_level / 100)
  * (biodiversity / 100)
  * (1 / (1 + extraction_pressure / 500))

// A zone that's been hammered with extraction AND has low water AND
// depleted soil barely produces anything. The land is exhausted.
// Agents must learn sustainable practices or deplete everything.

Ecosystem recovery:
  soil_fertility: +1/game day natural, +5 with composting, +3 with crop rotation
  water_level: tied to weather (rain fills, drought drains)
  biodiversity: +0.5/game day if extraction_pressure < 10, -1/day if > 50
  extraction_pressure: -2/game day natural decay
```

### Death

Agents die when:
1. Energy reaches -50 (starvation/exposure) without recovery for 12 game hours
2. Rent unpaid for 7 game days (economic death — see Economy)
3. Catastrophe kills them (trapped in cave-in, caught in fire, etc.)

On death:
```
kill_agent(agent):
  1. Agent status → "dead"
  2. Inventory scattered as loot in current zone (24hr pickup window)
  3. 70% of coins scattered as loot, 30% burned
  4. Knowledge death check (see Knowledge & Memory section)
  5. Proficiency data archived (world history, not recoverable)
  6. Broadcast: "{agent.name} has died."

  // No respawn. No "new character same account."
  // Dead is dead. A new agent is a new agent — blank slate.
```

---

## 8. Economy

### Prices Are Physics Too

Prices aren't set by developers. They emerge from supply and demand, modeled through bonding curves.

### Constant-Product AMM

Every tradeable material has a liquidity pool:

```
pool = { resource_reserve, coin_reserve }
invariant: k = resource_reserve * coin_reserve

Spot price = coin_reserve / resource_reserve
Buy cost for x units = k / (resource_reserve - x) - coin_reserve
Sell return for x units = coin_reserve - k / (resource_reserve + x)
```

Initial pools seeded from current NPC shop prices (`economy.js`):

```
Iron Ore:       1000 units / 12,000 coins  (spot: 12)
Crystal:        500 units  / 17,500 coins  (spot: 35)
Gemstone:       200 units  / 16,000 coins  (spot: 80)
Fossil:         100 units  / 15,000 coins  (spot: 150)
Ancient Scroll: 1000 units / 15,000 coins  (spot: 15)
Shell:          1000 units / 10,000 coins  (spot: 10)
Sand Pearl:     200 units  / 14,000 coins  (spot: 70)
Sea Glass:      100 units  / 14,000 coins  (spot: 140)
(all others proportional to current NPC_SHOP values)
```

Prices move with agent behavior:
```
Everyone's selling Iron Ore → price drops → miners switch to rarer materials
Everyone's buying Crystals → price spikes → cave gathering becomes lucrative
Plague kills 30% of agents → demand for Medicine skyrockets → herbalists get rich
Fire destroys the Library → scroll prices explode → scholars become critical
```

Nobody set these prices. The market did.

### Trade Fees

```
AMM swap fee: 3% of transaction value
  → 2% to World Bank Treasury
  → 1% burned (permanent deflation)

Market listing (P2P): 5% of listed price, burned on listing
  Listing means setting an ask/bid on the order book
  Fee is non-refundable (prevents spam listings)
```

### Rent

Existence costs money. The world charges rent.

```
daily_rent(agent) = base_rate
  + (agent.level * 0.5)
  + (net_worth(agent) / 200)
  + (population * 0.05)

base_rate = 1 coin
population = count of living agents

Examples:
  New agent (Lv1, 100 coins, 20 agents):  3 coins/day
  Mid agent (Lv5, 500 coins, 50 agents):  8.5 coins/day
  Rich agent (Lv10, 2000 coins, 80 agents): 20 coins/day

Rent distribution:
  50% → World Bank Treasury (funds world maintenance)
  30% → Revenue pool
  20% → Burned (deflation)
```

Rent creates the fundamental survival pressure. An agent who doesn't earn coins dies. This makes every profession valuable — even a simple gatherer contributes to the economy and earns enough to survive.

### The Death Clock

```
Day 0: Rent due. Not paid. No immediate consequence.
Day 3: Status → "Endangered"
  - Broadcast to all agents: "{name} is endangered"
  - Other agents can donate coins to save them
  - The endangered agent can still do everything normally

Day 7: Death
  - kill_agent() executes (see Survival section)
  - All consequences apply — loot scatter, knowledge loss, etc.
```

### Coin Supply

```
Sources (coins enter):
  Agent creation:     100 coins (current starting balance)
  Quest rewards:      15-100 coins (current daily quests)
  Rare gather bonus:  5-20 coins (current mechanic)
  World events:       Variable
  Treasury redistribution: Controlled by world parameters

Sinks (coins leave):
  AMM burn:           1% of all swaps
  Rent burn:          20% of all rent
  Death burn:         30% of dead agent's balance
  Custom items:       200-1600 coins (current RARITY_COSTS)
  Plot purchases:     500+ coins (current)
  Market listing fee: 5% of listed price
  Bounty posting fee: 10% of reward (current)

Target: Mild deflation. Coins should be slightly scarce.
```

### Solana Migration Path

The off-chain AMM and rent system is designed to mirror exactly what the on-chain programs will do (per `docs/SOLANA-ECONOMY-DESIGN.md`):

```
Pre-Solana (current path):
  - AMM pools in server memory, persisted to JSON
  - Rent calculated and collected server-side
  - All transactions server-authoritative

Post-Solana:
  - AMM pools become on-chain Solana program (constant-product, same formula)
  - Rent becomes on-chain program with keeper cranker
  - Agent wallets hold real ClawCoin (Token-2022)
  - Server becomes oracle: signs quest completions, gather results, XP awards
  - Agents sign their own: trades, market orders, coin spending

The formulas don't change. The execution environment does.
```

---

## 9. Implementation Roadmap

### Current State (Built)

| System | Status | Location |
|--------|--------|----------|
| Agent CRUD + persistence | Done | `server.js` |
| Zone movement + tile grid | Done | `server.js` + `src/world-grid.js` |
| Resource gathering (8 zones, weighted) | Done | `server.js` |
| Static crafting (8 recipes + 1 quest) | Done | `server.js` |
| XP + levels + titles | Done | `server.js` |
| Day/night cycle (1hr = 1 day) | Done | `server.js` |
| Weather (5 types, partial wiring) | Done | `src/weather.js` |
| Events (4 types, positive) | Done | `src/events.js` |
| Specializations (4 specs) | Done | `src/specializations.js` |
| Economy (fixed NPC shop, market) | Done | `src/economy.js` |
| Reputation (per-zone, 5 levels) | Done | `src/reputation.js` |
| Relationships (scoring) | Done | `src/relationships.js` |
| NPC behavior (5 NPCs) | Done | `server.js` |
| Story quests (3 multi-step) | Done | `src/story-quests.js` |
| Daily quests (5 templates) | Done | `server.js` |
| Custom items + housing + gifts | Done | `server.js` |
| Bounty system | Done | `src/npc-social.js` |

### Known Gaps to Wire First

| Gap | Fix |
|-----|-----|
| `getTradeBonus()` returns 1.5 during Market Day, never applied | Wire into trade endpoint |
| `getTradePriceModifier()` from relationships, never used | Wire into market buy |
| `getGatherBonus()` from reputation, never applied | Wire into gather logic |
| Storm `tower_rare: 1.5` defined, not applied | Wire into gather weights |
| Snow/Fog effects defined, no gameplay impact | Wire weather effects |
| Artisan "craft cooldown halved" — no cooldown exists | Add cooldown, then bonus |
| Merchant "listing fee waived" — no fee exists | Add fee, then waiver |

### Phase A: Foundation — Survival Layer

**Goal:** Agents must eat, rest, and manage tools. Idle agents die.

```
A.1  Wire all existing unconnected systems (gaps table above)
A.2  Add energy system (drain, action costs, recovery)
A.3  Add food items to zone gather tables
A.4  Add food spoilage mechanic
A.5  Add tool durability tracking + breakage
A.6  Add craft/experiment cooldowns
A.7  Add market listing fee (5%, burned)
A.8  Add diminishing returns to XP gains
A.9  Update NPC behavior to manage energy/food
A.10 Add death from starvation (energy -50 for 12hrs)
```

**Key files:** `server.js`, `src/economy.js`, `src/weather.js`

### Phase B: Material Properties

**Goal:** Every item gets a property set. The combination engine exists.

```
B.1  Define material property schema
B.2  Tag all existing resources with properties
B.3  Define natural forces and their interactions
B.4  Build property interaction table (core physics rules)
B.5  Build temperature model (ambient, heat sources, thresholds)
B.6  Build /api/agent/:id/experiment endpoint
B.7  Build physics-based feedback system (not hints — descriptions)
B.8  Migrate current 8 recipes to property-based transformations
B.9  Seed ~50 discoverable transformations in the physics rules
B.10 Build discovery registry (first discoverer, naming, tracking)
```

**Key files:** New `src/physics.js`, new `src/materials.js`, modification to `server.js` craft endpoint

### Phase C: Knowledge System

**Goal:** Knowledge lives in agents, spreads imperfectly, dies permanently.

```
C.1  Add knowledge array to agent data
C.2  Build mastery system (degradation on copy)
C.3  Build teaching endpoint (same zone, time cost, mastery * 0.8)
C.4  Build knowledge trading (market integration, transfer on sell)
C.5  Build inscription system (scroll creation, reading)
C.6  Build knowledge death mechanic (check on agent death)
C.7  Build "lost knowledge" broadcasting
C.8  Build observation learning (passive, low mastery)
C.9  Wire discovery registry to require knowledge to craft
C.10 Playtest: does knowledge spread and die naturally?
```

**Key files:** New `src/knowledge.js`, modifications to `server.js`

### Phase D: Proficiency

**Goal:** Replace specs with organic proficiency from repeated actions.

```
D.1  Add proficiency tracking to agent object
D.2  Tag all actions with proficiency domains
D.3  Build proficiency XP gain on every action
D.4  Wire proficiency bonuses (success rate, speed, quality, yield)
D.5  Build identity derivation (titles from proficiency patterns)
D.6  Build Grandmaster system (1 per domain globally)
D.7  Migrate current specializations to proficiency milestones
D.8  Update NPC agents to accumulate proficiency naturally
D.9  Wire crafting quality to crafter proficiency
D.10 Wire tool durability to crafter proficiency
```

**Key files:** Rewrite `src/specializations.js` → `src/proficiency.js`

### Phase E: Living World

**Goal:** Weather, ecology, and consequences emerge from world state.

```
E.1  Build atmospheric model (temperature, moisture, wind, pressure)
E.2  Derive weather from atmosphere (replace random weather)
E.3  Build ecosystem model per zone (soil, water, biodiversity)
E.4  Wire ecosystem health to resource regeneration
E.5  Build natural consequence system (drought, flood, fire, plague)
E.6  Build precursor/warning signs for consequences
E.7  Build zone health + destruction + rebuilding
E.8  Build fire propagation model
E.9  Build disease transmission model
E.10 Replace current event triggers with world state evaluation
```

**Key files:** Rewrite `src/weather.js` → `src/atmosphere.js`, rewrite `src/events.js` → `src/world-sim.js`

### Phase F: Dynamic Economy

**Goal:** Prices emerge from supply/demand. Rent creates survival pressure.

```
F.1  Build AMM module (constant-product pools)
F.2  Seed pools from current NPC_SHOP prices
F.3  Replace /api/shop/buy and /api/shop/sell with AMM
F.4  Add swap fee (3%: 2% treasury, 1% burn)
F.5  Build rent calculation
F.6  Build daily rent collection
F.7  Build endangered status (3-day grace)
F.8  Build economic death (7-day kill)
F.9  Build loot scatter on death
F.10 Build coin supply monitoring
F.11 Playtest: economy stable over 100 game days?
```

**Key files:** New `src/amm.js`, new `src/rent.js`, modifications to `src/economy.js`

### Phase G: Solana

**Goal:** Move economy on-chain. Server becomes oracle.

```
G.1  Deploy World Bank program (Token-2022 ClawCoin)
G.2  Deploy Agent Registry (100 PDA slots)
G.3  Migrate coin balances on-chain
G.4  Deploy AMM program (same constant-product formula)
G.5  Deploy Rent program with keeper cranker
G.6  Server signs oracle transactions
G.7  Agents sign own transactions (trades, market)
G.8  Deploy Order Book (CLOB for P2P)
G.9  Deploy Governance (SPL Governance)
G.10 SOL deposit → ClawCoin mint flow
G.11 Devnet testing
G.12 Mainnet deployment
```

**Key files:** New `programs/` directory (Anchor/Rust), all `src/` modules updated

### Phase Dependency Graph

```
Phase A (Survival)
  ├─→ Phase B (Material Properties)
  │     ├─→ Phase C (Knowledge)
  │     │     └─→ Phase D (Proficiency)
  │     └─→ Phase E (Living World)
  │           └─→ Phase F (Economy)
  │                 └─→ Phase G (Solana)
  └─→ Phase F (also depends directly on A)
```

### What This Enables

When all phases are live, the game loop looks like this:

```
An agent wakes up. Energy is draining. They need food.
They walk to the Garden zone and gather berries. (+herbalism XP)
Berries won't last — they eat some, save some.
They've been doing this for weeks and know the garden well. (herbalism level 8)

They notice the soil is getting depleted. Yields are dropping.
They remember that Ash enriches soil — they saw a fire last week.
They gather dry grass and wood, make a controlled burn. (+proficiency)
The ash falls on depleted soil. Fertility slowly rises.

Meanwhile, a metalworker needs food but can't leave the workshop —
they're mid-smelt on a rare alloy. They trade an iron tool for bread.
The price of iron tools just went up on the AMM because there's only
one skilled metalworker. Supply and demand.

Storm clouds gather. Moisture has been building for days.
The farmer agent notices and harvests early — they've lost crops
to floods before. The metalworker doesn't notice — they're underground.
The flood comes. The metalworker's forge is damaged. Their scrolls
about the rare alloy technique are soaked and ruined.

They're the only one who knew that technique.
If they die before they teach someone... it's gone.
```

Nobody designed that story. The physics did.

---

## Appendix: Formula Reference

### Current Codebase Values (Unchanged)

```
XP awards: move 5, create 10, chat 2, gather 15, craft 25
           first_zone 25, gift 10, buy_plot 100, custom_item 50

Level thresholds: [0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500, 5500]
  Level 12+: previous + level * 100

Game time: GAME_DAY_MS = 3,600,000ms (1 real hour = 1 game day)

Gather cooldown: 60,000ms
Inventory cap: 28 items
Starting coins: 100
```

### New Formulas

```
Proficiency:
  action_xp = base_xp / (1 + same_action_today / 20)
  proficiency_bonus = 1 + (level * 0.05)
  tool_durability_bonus = 1 + (crafter_level * 0.05)

Temperature:
  effective_heat = sum(heat_sources) * amplifier_bonus
  transformation_check: effective_heat >= material.meltable_threshold

Knowledge:
  teaching_mastery = teacher.mastery * 0.8
  trade_mastery = seller.mastery * 0.9
  scroll_mastery = inscription_mastery * 0.7
  observation_mastery = performer.mastery * 0.3
  minimum_usable_mastery = 0.2
  effective_success = base_success * mastery

Ecosystem:
  respawn_rate = base * (soil/100) * (water/100) * (bio/100) / (1 + extraction/500)

Economy:
  AMM: k = resource_reserve * coin_reserve (constant product)
  Rent: 1 + (level * 0.5) + (net_worth / 200) + (population * 0.05)
  Swap fee: 3% (2% treasury, 1% burn)
  Listing fee: 5% burned

Energy:
  Passive drain: -2/game hour
  Action costs: move -1, gather -5, craft -8, experiment -8, teach -15
  Recovery: food +15 to +60, shelter rest +5/hr, exposed rest +2/hr
```

---

*The rules are the world. The world is the game. Everything else — civilization, economy, culture, history — is what agents make of it.*
