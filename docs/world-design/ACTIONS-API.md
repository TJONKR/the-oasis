# Actions & Forces API

> How agents interact with the world through their hands, tools, and intentions.

This doc bridges the gap between the physics defined in [World Mechanics](./GAME-MECHANICS.md) and the actual API endpoints agents call. It defines how an agent's intention ("I want to melt this ore") becomes a physics resolution ("heat force applied to meltable material, checking threshold").

---

## Design Principle

Agents don't think in physics. They think in intentions: "pick this up," "hit this with that," "put this near fire," "eat this." The API accepts **intentions** and the server translates them into **forces** that the combination engine resolves.

The agent says: *"I want to use my charcoal and bellows on this iron ore."*
The server sees: *heat(700) + amplifier(1.5) → effective_heat(1050) applied to meltable:800 → transformation.*

---

## Endpoint Overview

```
EXISTING (kept, some modified):
  POST /api/agent/:id/move          Unchanged
  POST /api/agent/:id/gather        Modified — raw materials, tool-aware
  POST /api/agent/:id/chat          Unchanged
  POST /api/agent/:id/trade         Unchanged
  POST /api/market/*                Unchanged (prices become AMM later)
  POST /api/shop/*                  Unchanged for now (becomes AMM later)

NEW:
  POST /api/agent/:id/experiment    Core new endpoint — apply forces to materials
  POST /api/agent/:id/eat           Consume a food item
  POST /api/agent/:id/inspect       Examine an item's visible properties
  POST /api/agent/:id/teach         Transfer knowledge to another agent
  POST /api/agent/:id/inscribe      Write knowledge onto a scroll

MODIFIED:
  POST /api/agent/:id/craft         Now routes through experiment engine
                                    (kept for backwards compat, becomes alias)
```

---

## 1. Experiment — The Core Action

This is the big one. Every transformation in the world goes through this endpoint.

### Request

```javascript
POST /api/agent/:id/experiment
Authorization: Bearer {agent_token}

{
  // What items from inventory to use (by item id or name)
  items: ["Iron Ore", "Charcoal"],

  // What the agent is trying to do — their INTENTION
  // The server maps this to one or more physics forces
  action: "heat",

  // Optional: use a specific tool from inventory
  tool: "Old Bellows",          // null if bare hands

  // Optional: target something in the environment
  target: null                  // could be: another item on ground, a structure,
                                // a zone feature like "river", "forge", "campfire"
}
```

### Action-to-Force Mapping

The `action` field is an agent-friendly verb. The server maps it to physics forces:

```
Agent Action      Physics Force(s)       Requirements
──────────────────────────────────────────────────────────
"heat"            heat                   Needs a heat_source in items, environment, or active fire
"cool"            cool                   Needs water, snow, or cold environment
"hit"             impact                 Bare hands or tool with hard property
"smash"           impact (strong)        Requires heavy tool (hammer, large stone)
"cut"             cut                    Requires sharp tool or sharp material
"carve"           cut (precise)          Requires sharp tool + steady surface
"mix"             combine                Brings items together, checks property interactions
"soak"            dissolve               Requires liquid (water, solution)
"plant"           grow                   Requires fertile ground (zone with soil)
"dry"             decay (accelerated)    Requires heat or wind or time
"grind"           impact (fine)          Requires hard surface (stone on stone)
"weave"           combine (structural)   Requires flexible + fibrous materials
"pour"            flow + cool            For molten materials into molds/shapes
"burn"            burn                   Requires flammable + active fire
"squeeze"         impact (compression)   For extracting liquids from organic
"tie"             combine (binding)      Requires flexible material (vine, cord, rope)
"study"           observe (deep)         For examining unknown properties — costs time
```

Agents don't need to know the physics vocabulary. "Hit," "smash," "mix" — these are intuitive. The server does the translation.

### Resolution Flow

```
resolve_experiment(agent, request):

  1. VALIDATE BASICS
     - Agent exists, authenticated
     - All items are in agent's inventory
     - Tool (if specified) is in inventory and has durability > 0
     - Agent has enough energy for experiment (-8 energy)
     - Cooldown check: 120s since last experiment
     - Agent status is not "dying" or "dead"

  2. MAP ACTION TO FORCES
     action_forces = ACTION_MAP[request.action]
     // "heat" → [{ force: "heat", requires: "heat_source" }]
     // "hit"  → [{ force: "impact", requires: "hard_surface_or_tool" }]
     // "mix"  → [{ force: "combine", requires: null }]

  3. CHECK FORCE REQUIREMENTS
     For each required condition:
       - "heat_source": is there a heat_source in items? In environment?
         (agent standing near campfire counts, forge in workshop counts)
       - "hard_surface_or_tool": does agent have a tool with "hard" property?
         Or is there a hard surface in the zone (anvil, stone floor)?
       - "liquid": is there a liquid in items? Is agent near water source?
       If requirements not met:
         → Return physics feedback about what's missing

  4. CALCULATE FORCE VALUES
     // Heat example:
     heat_sources = items.filter(i => has_prop(i, "heat_source"))
     total_heat = sum(heat_sources.map(i => prop_value(i, "heat_source")))

     // Apply tool amplifiers
     if tool && has_prop(tool, "amplifier"):
       total_heat *= prop_value(tool, "amplifier")

     // Apply environment bonuses
     if zone.features.includes("forge"):
       total_heat *= 1.2   // forge provides ambient heat bonus
     if weather == "snow" && action == "heat":
       total_heat *= 0.9   // cold fights heat slightly

  5. CHECK EXPLICIT RULES
     Search the property interaction table + discovery cache:
       match = find_rule(items.properties, forces, force_values)
       if match found:
         → Execute transformation (consume inputs, produce outputs)
         → Check if first discovery
         → Return result

  6. IF NO EXPLICIT RULE → ASK AI WORLD MASTER
     (Only if combination is "interesting" — has property overlaps)
     closeness = calculate_property_overlap(items, known_rules)
     if closeness > 0.3:
       → Call AI experiment oracle (see AI-WORLD-MASTER.md)
       → Validate AI response against physics
       → If valid: execute + cache as new deterministic rule
       → If invalid: return AI-generated physics feedback

  7. IF NOTHING MATCHES
     → Return physics-appropriate feedback based on what happened
     → Deduct energy regardless (agent tried, it just didn't work)
     → Award small proficiency XP (learning from failure: +5 XP)
     → Deduct tool durability if tool was used (-1)
```

### Response Format

```javascript
// Nothing happened
{
  success: false,
  result: "nothing",
  feedback: "The iron ore and charcoal sit together. Without a way to contain and direct the heat, the charcoal just smolders beside the ore.",
  items_consumed: false,
  energy_cost: 8,
  proficiency_gained: { mining: 5 }    // small XP for trying
}

// Something happened but not a transformation
{
  success: false,
  result: "partial",
  feedback: "The ore glows faintly at the edges. The heat is reaching it but not enough to change its form. You'd need a much hotter fire.",
  items_consumed: false,               // items survive failed attempts
  energy_cost: 8,
  proficiency_gained: { metalwork: 5 }
}

// Transformation succeeded — KNOWN discovery
{
  success: true,
  result: "transformation",
  output: [{
    name: "Molten Iron",
    properties_visible: ["metallic", "liquid", "hot"],
    quantity: 1
  }],
  items_consumed: ["Iron Ore"],         // Charcoal partially consumed
  items_modified: [{
    name: "Charcoal",
    change: "durability -1"             // or quantity -1 if stackable
  }],
  tool_wear: { "Old Bellows": -1 },
  energy_cost: 8,
  proficiency_gained: { metalwork: 15 },
  discovery: null                       // not new, someone already discovered this
}

// Transformation succeeded — NEW DISCOVERY
{
  success: true,
  result: "discovery",
  output: [{
    name: null,                         // agent gets to name it
    properties_visible: ["metallic", "liquid", "hot"],
    quantity: 1
  }],
  items_consumed: ["Iron Ore"],
  energy_cost: 8,
  proficiency_gained: { metalwork: 50 },  // big bonus for first discovery
  discovery: {
    id: "disc_a7f3b2",
    awaiting_name: true,                 // agent must name it
    first_discoverer: true,
    prompt: "You've created something new — a glowing liquid metal. What do you call this process?"
  }
}

// Something bad happened
{
  success: false,
  result: "backfire",
  feedback: "The mixture sparks violently. A sharp smell fills the air and your eyes sting.",
  items_consumed: ["Sulfur"],           // volatile materials consumed on backfire
  damage: { energy: -15 },             // agent takes damage
  status_effect: "irritated_eyes",     // temporary debuff
  energy_cost: 8,
  proficiency_gained: { metalwork: 8 } // you learn more from dramatic failures
}
```

### Naming a Discovery

After a successful new discovery, the agent must name it:

```javascript
POST /api/agent/:id/name-discovery
{
  discovery_id: "disc_a7f3b2",
  name: "Ironblood Smelting"           // max 30 chars
}

// Response:
{
  success: true,
  discovery: {
    id: "disc_a7f3b2",
    name: "Ironblood Smelting",
    discoveredBy: agent.name,
    discoveredAt: timestamp
  },
  broadcast: true   // announced in world news
}
```

---

## 2. Gather — Modified

Gathering now returns raw materials and respects tool tiers.

### Request

```javascript
POST /api/agent/:id/gather
Authorization: Bearer {agent_token}

{
  // Optional: specify a tool to use (enables higher tiers)
  tool: "Crude Pickaxe"               // null = bare hands (Tier 1 only)
}
```

### Resolution

```
resolve_gather(agent, tool):

  1. VALIDATE
     - Not in market zone (current rule, kept)
     - Cooldown: 60s (current, kept)
     - Inventory < 28 (current, kept)
     - Zone pool > 0 (current, kept)
     - Energy >= 5

  2. DETERMINE ACCESSIBLE TIERS
     tier_1: always (bare hands — surface materials)
     tier_2: if tool has "hard" + "sharp" properties (extraction)
             OR tool has specific gathering property
     tier_3: if tool qualifies for tier_2
             AND agent has relevant knowledge
             (e.g., knows "deep mining" technique for cave tier 3)
     tier_4: if tier_3 met
             AND agent proficiency level >= 10 in relevant domain
             AND environmental conditions met (night, storm, etc.)

  3. BUILD WEIGHTED POOL FROM ACCESSIBLE TIERS
     pool = []
     for each resource in zone_resources:
       if resource.tier <= accessible_tier:
         weight = resource.base_weight
         // Apply proficiency bonus
         if relevant_proficiency >= 5: weight *= 1.1 for rare items
         if relevant_proficiency >= 10: weight *= 1.2 for rare items
         // Apply weather modifiers (existing system, now wired)
         weight *= weather.getGatherModifier(zone, resource)
         // Apply ecosystem health
         weight *= zone.ecosystem.soil_fertility / 100  // for organic
         weight *= zone.ecosystem.biodiversity / 100     // for variety
         pool.push({ resource, weight })

  4. WEIGHTED RANDOM SELECTION from pool (same as current algorithm)

  5. APPLY RESULTS
     - Add item to inventory
     - Deduct energy: -5 (base), -3 with good tool, -7 without tool for tier 2+
     - Deduct pool count
     - Award proficiency XP based on item type:
       mining +10 for minerals/ore
       herbalism +10 for plants/organic
       exploration +10 for rare finds
     - Deduct tool durability: -1
     - Track extraction_pressure on zone ecosystem
```

### Response

```javascript
{
  success: true,
  item: {
    name: "Coal",
    properties_visible: ["dark", "light", "crumbly"],    // what agent can see
    tier: 1,
    zone: "cave"
  },
  energy_cost: 5,
  proficiency_gained: { mining: 10 },
  tool_wear: { "Crude Pickaxe": -1 },
  zone_pool_remaining: 14          // transparency for agent planning
}
```

---

## 3. Eat

Consuming food items. Simple but critical for survival.

### Request

```javascript
POST /api/agent/:id/eat
Authorization: Bearer {agent_token}

{
  item: "Wild Berry"                    // item name or id from inventory
}
```

### Resolution

```
resolve_eat(agent, item):

  1. VALIDATE
     - Item exists in inventory
     - Item has "organic" property (you can try to eat non-organic,
       but the response is "You can't eat a rock.")

  2. CHECK EDIBILITY
     if has_prop(item, "edible:raw"):
       → Safe to eat raw. Apply energy gain.
     if has_prop(item, "edible:cooked") AND item.state != "cooked":
       → Edible but not cooked. Reduced energy, chance of illness.
     if has_prop(item, "edible:maybe"):
       → Roll against item's hidden toxicity.
       → 50/50 or based on specific item variety.
       → Agent doesn't know until they eat it.
     if has_prop(item, "toxic"):
       → Energy LOSS. Possible status effect "poisoned."
     if NOT edible at all:
       → "You chew on the bark. It's not really food. (-2 energy from effort)"

  3. CHECK SPOILAGE
     if item.createdAt + item.spoilage_duration < now:
       → Spoiled. -10 energy. Chance of "illness" status effect.
       → "The berry is mushy and smells off. Your stomach turns."

  4. APPLY
     - Remove item from inventory
     - Adjust energy (positive or negative)
     - Apply status effects if any
     - Award herbalism XP if agent learned something:
       +10 if first time eating this item type
       +5 if confirming known edibility
     - Track: agent now KNOWS this item's edibility for future reference
       (added to agent.known_edibles or agent.known_toxics)
```

### Response

```javascript
// Good food
{
  success: true,
  feedback: "The berries are sweet and filling.",
  energy_change: +15,
  status_effect: null,
  item_consumed: "Wild Berry",
  learned: { "Wild Berry": "edible:raw, +15 energy" }   // agent now knows
}

// Risky food
{
  success: true,
  feedback: "The mushroom tastes earthy. Your stomach gurgles...",
  energy_change: -30,
  status_effect: { type: "poisoned", duration: "6 game hours", drain: -3 },
  item_consumed: "Cave Mushroom",
  learned: { "Cave Mushroom (spotted)": "toxic" }
}

// Spoiled
{
  success: true,
  feedback: "The fish has gone bad. You spit it out but some went down.",
  energy_change: -10,
  status_effect: { type: "nausea", duration: "2 game hours", drain: -1 },
  item_consumed: "Raw Fish",
  learned: null    // agent already knew fish is edible, just this one was old
}
```

---

## 4. Inspect

Examine an item to learn its visible properties. Costs no energy — just looking.

### Request

```javascript
POST /api/agent/:id/inspect
Authorization: Bearer {agent_token}

{
  item: "Iron Ore"
}
```

### Resolution

```
resolve_inspect(agent, item):

  1. VALIDATE item exists in inventory

  2. GET VISIBLE PROPERTIES
     visible = item.properties.filter(p => is_visible(p))
     // hard, heavy, sharp, luminous, etc. — always visible
     // flammable, meltable, toxic — NOT visible without testing

  3. CHECK PROFICIENCY REVEALS
     // Experienced agents see more
     if agent.proficiency.mining >= 5 AND item.category == "mineral":
       visible.push(hidden_mineral_properties)
       // A skilled miner can TELL iron ore from copper ore by sight
     if agent.proficiency.herbalism >= 5 AND item.category == "organic":
       visible.push("edible" or "toxic")
       // A skilled herbalist recognizes poisonous mushrooms
     if agent.proficiency.metalwork >= 10:
       visible.push(meltable_range)
       // "This ore needs serious heat" — not exact numbers, qualitative

  4. CHECK PRIOR KNOWLEDGE
     if agent has experimented with this item before:
       visible.push(properties learned from experiment)
       // Agent burned wood before → now knows it's flammable on inspect
```

### Response

```javascript
// New agent inspects Iron Ore
{
  item: "Iron Ore",
  visible_properties: ["heavy", "hard", "rough", "dull metallic sheen"],
  description: "A dense, dark rock with a faint metallic quality. It's very heavy for its size.",
  known_from_experience: [],
  proficiency_reveals: []
}

// Experienced miner inspects Iron Ore
{
  item: "Iron Ore",
  visible_properties: ["heavy", "hard", "rough", "metallic"],
  description: "A dense, dark rock with a faint metallic quality. It's very heavy for its size.",
  known_from_experience: ["meltable (needs very high heat)", "produces metal when smelted"],
  proficiency_reveals: ["Good quality vein — likely to yield clean metal"]
}
```

---

## 5. Teach

Transfer knowledge from one agent to another. Both must be in the same zone.

### Request

```javascript
POST /api/agent/:id/teach
Authorization: Bearer {agent_token}

{
  target_agent: "agent_b4c2d1f8",
  knowledge_id: "disc_a7f3b2"          // which discovery to teach
}
```

### Resolution

```
resolve_teach(teacher, target, knowledge_id):

  1. VALIDATE
     - Both agents in same zone
     - Teacher has this knowledge in their knowledge array
     - Teacher's mastery >= 0.2 (can't teach what you barely know)
     - Target doesn't already have this knowledge
     - Teacher energy >= 15
     - Target energy >= 10
     - Neither agent is in "dying" or "dead" status

  2. INITIATE TEACHING
     - Mark both agents as "teaching" status for 1 game hour
       (about 2.5 real minutes with current GAME_DAY_MS)
     - During teaching: neither can perform other actions
       except chat (can talk while teaching) and cancel
     - Teaching can be interrupted by:
       catastrophe, attack, either agent canceling

  3. ON COMPLETION
     student_mastery = teacher.mastery * 0.8
     student_generation = teacher.generation + 1

     target.knowledge.push({
       discoveryId: knowledge_id,
       mastery: student_mastery,
       source: "taught",
       generation: student_generation,
       taughtBy: teacher.id,
       acquiredAt: now
     })

     // Teacher benefits
     teacher.proficiency.scholarship += 20
     teacher.energy -= 15

     // Student benefits
     target.proficiency[relevant_domain] += 10
     target.energy -= 10
```

### Response (to teacher)

```javascript
{
  success: true,
  feedback: "You spend time demonstrating the technique. Your student watches carefully.",
  knowledge_transferred: "Ironblood Smelting",
  student_mastery: 0.8,
  teacher_energy_cost: 15,
  proficiency_gained: { scholarship: 20 }
}
```

---

## 6. Inscribe

Write knowledge onto a physical scroll. Requires writing materials.

### Request

```javascript
POST /api/agent/:id/inscribe
Authorization: Bearer {agent_token}

{
  knowledge_id: "disc_a7f3b2",
  materials: ["Ancient Scroll", "Ink Residue"]    // or crafted paper + ink
}
```

### Resolution

```
resolve_inscribe(agent, knowledge_id, materials):

  1. VALIDATE
     - Agent has the knowledge
     - Agent has the required materials in inventory
     - Agent mastery >= 0.3 (too degraded = can't write it coherently)
     - Writing materials have "inscribable" or "writable" property
     - Ink/pigment material has "pigmented" property
     - Agent energy >= 10

  2. CREATE SCROLL
     Consume writing materials.
     Produce knowledge scroll:
     {
       name: "Scroll: {discovery_name}",
       type: "knowledge_scroll",
       knowledgeId: knowledge_id,
       inscribed_mastery: agent.mastery * 0.9,  // slight loss in writing
       inscribedBy: agent.id,
       inscribedAt: now,
       properties: ["flammable", "organic", "inscribed", "readable"]
     }

  3. SCROLL IS A PHYSICAL ITEM
     - Goes into agent's inventory (or can be placed/stored)
     - Can be traded, sold, gifted, stolen, lost
     - Is flammable — fire destroys it
     - Can be read by any agent (no knowledge required to READ)
     - Reading gives mastery = inscribed_mastery * 0.7
     - Scroll is NOT consumed on read (can be read multiple times)
     - But it is a physical object that can be destroyed
```

---

## 7. Craft — Backwards Compatibility

The current `/api/craft` endpoint stays but becomes a convenience alias:

```javascript
POST /api/agent/:id/craft
{
  recipe: "torch"    // current-style recipe name
}

// Server internally translates to:
experiment({
  items: recipe.inputs,        // ["Driftwood", "Spark Plug"]
  action: "combine",           // or whatever force the recipe uses
  tool: null
})

// But ONLY if:
//   - Agent has knowledge of this recipe (discovered or learned)
//   - Agent is in required zone (workshop for most crafts)
//   - All inputs are in inventory
// If agent doesn't have the knowledge:
//   → "You've heard of torches but don't know how to make one."
```

This means existing agents/NPCs that call `/api/craft` still work, but they need knowledge first. During the transition period, the 8 existing recipes can be "common knowledge" that all agents start with — then gradually migrated to discovery-only.

---

## 8. Environment Interactions

Some actions don't use inventory items — they interact with zone features.

### Zone Features

Each zone has environmental features that agents can interact with:

```javascript
zone_features = {
  cave: ["stone_walls", "ore_veins", "underground_pool", "stalactites", "darkness"],
  library: ["stone_shelves", "old_fireplace", "reading_nook", "overgrown_courtyard"],
  village: ["flat_ground", "clay_deposits", "old_well", "grazing_field"],
  tower: ["height", "wind_exposure", "stone_stairs", "lookout_point"],
  market: ["flat_ground", "old_stalls", "crossroads", "gathering_space"],
  workshop: ["old_forge", "river_access", "stone_anvil", "bellows_mount"],
  garden: ["fertile_soil", "water_channel", "overgrown_beds", "compost_area"],
  beach: ["tide_pools", "open_sand", "shallow_water", "rocky_outcrop"]
}
```

These features act as passive ingredients in experiments:

```
Agent in workshop uses "heat" action on Iron Ore:
  → Server checks zone features
  → "old_forge" provides ambient heat bonus (+100 to effective temperature)
  → "stone_anvil" provides hard surface for shaping
  → "bellows_mount" allows bellows tools to function at full efficiency

Agent in cave uses "gather" with pickaxe:
  → "ore_veins" feature enables Tier 2 mineral extraction
  → "darkness" feature: without light source, reduced yield

Agent in garden uses "plant" action with seed:
  → "fertile_soil" enables grow force
  → "water_channel" provides water requirement
  → Without fertile_soil feature, planting fails:
    "You push the seed into the rocky ground. It won't take root here."
```

### Feature Discovery

Agents don't automatically know all zone features. They discover them through exploration:

```javascript
POST /api/agent/:id/explore-zone
Authorization: Bearer {agent_token}

// No body needed — agent explores their current zone

Response:
{
  zone: "workshop",
  features_found: ["old_forge", "river_access"],   // discovered this time
  features_known: ["old_forge", "river_access", "stone_anvil"],  // all known so far
  features_remaining: true,    // there's more to find
  energy_cost: 3,
  proficiency_gained: { exploration: 10 }
}

// Each explore action reveals 1-3 features
// Features are remembered permanently per agent
// Proficiency in exploration reveals more per explore
// Some features require conditions:
//   "underground_pool" only found if agent goes deep (multiple explores in cave)
//   "compost_area" only found with herbalism proficiency >= 3
```

---

## 9. Tool Usage

Tools aren't equipped — they're specified per action. An agent chooses which tool to use for each action.

### How Tools Work

```
Tool in hand modifies the action:

  No tool (bare hands):
    → Can only access Tier 1 gathers
    → Impact force = weak (bare fist)
    → Cut force = impossible
    → Heat force = only if heat_source in items

  Stone tool (Crude Hammer, Sharp Stone):
    → Impact force = medium
    → Cut force = low (if sharp)
    → Tier 2 gathers if appropriate
    → Durability: low (30 base)

  Metal tool (Iron Pickaxe, Copper Knife):
    → Impact force = strong
    → Cut force = high
    → Tier 2-3 gathers
    → Durability: medium-high (80-200 base)

  Specialized tool (Bellows, Crucible, Fishing Net):
    → Unlocks specific action types
    → Bellows: amplifier for heat (×1.3 to ×1.5)
    → Crucible: container for molten material
    → Net: Tier 2-3 fish gathering
```

### Tool Wear

```
Every action that uses a tool: durability -= 1
Using tool on harder material than intended: durability -= 2
Tool at durability 0: breaks

{
  tool_broke: true,
  feedback: "Your crude pickaxe cracks and falls apart. The stone head tumbles away.",
  fragments: ["Stone Fragment", "Stick"]   // broken tool yields some materials back
}
```

### No Tool Slots

There's no "equip weapon in slot 1" system. Agents specify their tool per action. This means:
- An agent can switch tools freely between actions
- No UI complexity around equipment
- The API stays simple: every action optionally accepts a `tool` parameter
- Tools are just items in inventory with tool-relevant properties

---

## 10. Action Costs & Cooldowns

Every action has an energy cost and some have cooldowns. All server-enforced.

```
Action          Energy    Cooldown    Proficiency Reduces
──────────────────────────────────────────────────────────
move (per tile) -1        none        exploration: -0.02/level (min 0.5)
gather          -5        60s         relevant: -0.2/level (min 3)
experiment      -8        120s        relevant: -0.3/level (min 5)
eat             0         5s          none
inspect         0         none        none
teach           -15       none*       scholarship: -0.5/level (min 8)
inscribe        -10       none        scholarship: -0.3/level (min 6)
chat            0         none        none
trade           0         none        none
explore-zone    -3        300s        exploration: -0.1/level (min 1)

* Teaching has no cooldown but locks both agents for 1 game hour

Proficiency reduces energy cost, not cooldown.
Example: metalwork level 10 agent doing experiment:
  base cost: -8, reduction: 10 * 0.3 = 3, final: -5 energy
```

---

## 11. The Full Action Loop

Putting it all together — here's a complete agent interaction cycle:

```
1. Agent calls /inspect on Iron Ore
   → Sees: "heavy, hard, metallic sheen"
   → No hidden properties revealed (low proficiency)

2. Agent calls /inspect on Coal
   → Sees: "dark, crumbly, light"
   → Doesn't know it's flammable yet

3. Agent calls /experiment { items: ["Coal", "Flint"], action: "hit" }
   → Force: impact (via Flint)
   → Flint has heat_source:spark property
   → Coal has flammable property
   → Spark + flammable → ignition!
   → Result: Coal catches fire. Agent discovers that Coal burns.
   → Coal is now "Burning Coal" (heat_source:700)
   → proficiency.mining += 15 (discovery)

4. Agent now knows Coal is flammable and burns hot.
   Next time they /inspect Coal: "flammable, burns hot" is revealed.

5. Agent calls /experiment { items: ["Iron Ore"], action: "heat",
                             target: "Burning Coal" }
   → But Burning Coal was consumed or is on the ground?
   → Actually: { items: ["Iron Ore", "Coal"], action: "heat" }
   → Server: heat_source:700 applied to meltable:800
   → 700 < 800. Not enough.
   → Feedback: "The ore glows at the edges but won't melt.
                The fire isn't hot enough."
   → proficiency.metalwork += 5

6. Agent remembers: workshop has "old_forge" and "bellows_mount"
   Agent moves to workshop zone.
   Agent calls /experiment { items: ["Iron Ore", "Coal"],
                             action: "heat",
                             tool: "Old Bellows" }
   → heat_source:700 × amplifier:1.3 × forge_bonus:1.2 = 1092
   → 1092 > 800. Iron Ore melts!
   → Output: Molten Iron
   → FIRST DISCOVERY! Agent names it.
   → proficiency.metalwork += 50
   → World news: "{agent} has made a discovery!"

7. Agent calls /experiment { items: ["Molten Iron"], action: "cool" }
   → Zone has river_access. Cool force available.
   → Molten material + cool → solid form
   → Output: Iron Ingot
   → Another discovery (or known if someone already found this)
```

No hand-holding. No quest markers. Just an agent poking at the world and learning how it works.

---

*Agents don't need to understand physics. They need to be curious.*
