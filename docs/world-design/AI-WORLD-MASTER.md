# AI World Master

> The intelligence layer that breathes life into the world mechanics.

The [World Mechanics](./GAME-MECHANICS.md) define the rules of nature — material properties, forces, knowledge, survival, economy. Those rules are deterministic and simple. But a world of simple rules alone feels mechanical.

The AI World Master is what makes Clawscape feel alive. It watches the world state, understands the physics, and shapes what happens next — not by breaking the rules, but by interpreting them with narrative intelligence.

---

## The Idea

Instead of building complex simulation systems (atmospheric models, disease transmission, fire propagation, ecological feedback loops), we use AI to **bridge the gap between simple rules and a living world**.

The World Master AI:
- Reads the current world state every tick
- Decides what nature does next, within the bounds of the physics
- Generates narrative descriptions of what's happening
- Evaluates novel experiments that don't match explicit rules
- Creates the feeling of a living, breathing world without simulating one molecule by molecule

**What it is NOT:**
- It is not a random number generator with flavor text
- It does not break or override the world mechanics
- It does not make gameplay decisions for agents
- It does not have access to modify agent data directly

It is a narrator with authority over weather, ecology, and natural consequences — constrained by the rules of nature defined in the world mechanics.

---

## Architecture

### What the AI Sees

Every evaluation cycle, the World Master receives a structured snapshot:

```javascript
world_snapshot = {
  // Time
  game_day: number,
  time_of_day: "dawn" | "day" | "dusk" | "night",
  days_since_start: number,

  // Atmosphere (simple tracked values)
  atmosphere: {
    moisture: 0-100,        // incremented by rain, decremented by clear weather
    temperature_trend: "warming" | "cooling" | "stable",
    wind: "calm" | "breezy" | "strong" | "gale",
    days_since_rain: number,
    days_since_storm: number
  },

  // Per-zone state
  zones: {
    [zoneId]: {
      health: 0-100,
      ecosystem: { soil_fertility, water_level, biodiversity, extraction_pressure },
      population: number,           // agents currently in zone
      recent_activity: string[],    // last 20 actions in this zone
      active_conditions: string[],  // "drought", "flooding", "fire", etc.
      structures: object[],         // built things
      loot_on_ground: object[]      // scattered items
    }
  },

  // Global state
  living_agents: number,
  total_discoveries: number,
  living_knowledge_count: number,
  recent_deaths: number,
  recent_discoveries: string[],
  economy: {
    total_coins_circulating: number,
    treasury_balance: number,
    amm_prices: { [resource]: spot_price }
  },

  // Recent world history (last 50 events)
  world_news: string[],

  // Current weather
  current_weather: { type, duration_so_far }
}
```

### What the AI Decides

The World Master returns structured decisions — not free text. The server validates every decision against the world mechanics before executing.

```javascript
world_master_response = {
  // Weather for next period
  weather: {
    type: "clear" | "rain" | "storm" | "snow" | "fog",
    intensity: 0.0-1.0,
    target_zones: ["all"] | ["beach", "garden"],  // localized weather possible
    reasoning: "Moisture has been building for 5 days..."  // logged, not shown to agents
  },

  // Natural consequences (0 or more)
  consequences: [
    {
      type: "drought" | "flood" | "wildfire" | "plague" | "earthquake" | "ecological_shift",
      target_zone: "garden",
      severity: 0.0-1.0,
      precursor: "The soil in the garden cracks and dries...",  // shown as world news
      reasoning: "No rain for 9 days, moisture at 8, garden extraction_pressure high"
    }
  ],

  // Ecosystem adjustments
  ecosystem_changes: [
    {
      zone: "cave",
      field: "soil_fertility",
      delta: -2,
      reasoning: "Heavy extraction without any composting"
    }
  ],

  // World narrative (max 1 per cycle, optional)
  narrative: "A dry wind sweeps across the garden. The old berry bushes look parched." | null,

  // Rare phenomena (meteor, stranger, festival conditions)
  phenomena: null | {
    type: string,
    description: string,
    effects: object
  }
}
```

### The Validation Layer

The server NEVER trusts the AI output blindly. Every decision passes through validation:

```
validate_weather(decision):
  - Weather type must be one of the 5 defined types
  - If moisture < 30, cannot produce storm or heavy rain
  - If temperature_trend == "warming" significantly, cannot produce snow
  - Intensity must be 0.0-1.0
  → If invalid: fall back to simple deterministic weather

validate_consequence(decision):
  - Type must be from the defined consequence list
  - Severity must be 0.0-1.0
  - Target zone must exist and be active
  - Cannot trigger earthquake if geological_stress < threshold
  - Cannot trigger plague if zone population < minimum
  - Cannot trigger flood if moisture < 60
  - Cannot stack more than 2 consequences per zone
  → If invalid: consequence is silently dropped

validate_ecosystem_change(decision):
  - Delta must be within bounds (-5 to +5 per cycle)
  - Field must be a real ecosystem field
  - Cannot push any value below 0 or above 100
  → If invalid: change is clamped or dropped

validate_narrative(decision):
  - Max 200 characters
  - No agent names (AI doesn't decide what agents experience)
  - No mechanical information (no numbers, no stat references)
  → If invalid: narrative is dropped
```

The AI proposes. The physics validate. The server executes.

---

## The Experiment Oracle

The most powerful use of the AI World Master: **evaluating novel experiments**.

The world mechanics define a property interaction table with core rules (heat + meltable → molten form, impact + brittle → shards, etc.). But agents will try combinations that don't match any explicit rule. Instead of always returning "nothing happens," the AI evaluates whether the combination *should* work given the established physics.

### How It Works

```
Agent submits experiment:
  items: ["Crystal", "Memory Seed", "Fire"]
  action: "heat"

Step 1: Check explicit rules
  → Does the property interaction table have a matching rule?
  → Crystal: brittle, conductive, luminous
  → Memory Seed: organic, fertile, mystical
  → Fire: heat_source:500, luminous, consuming
  → Check: heat + organic → cooked form (if 100 <= heat < ignition)
  → Memory Seed would cook/burn. But that's not interesting.
  → Check: heat + brittle → no rule
  → Check: heat + conductive → no rule
  → No complete match for the full combination.

Step 2: Ask the World Master AI
  Prompt to AI (structured, not freeform):
  {
    items: [
      { name: "Crystal", properties: ["brittle", "conductive", "luminous"] },
      { name: "Memory Seed", properties: ["organic", "fertile", "mystical"] },
      { name: "Fire", properties: ["heat_source:500", "luminous", "consuming"] }
    ],
    action: "heat",
    location: "workshop",
    agent_proficiency: { metalwork: 3, herbalism: 7 },
    existing_discoveries: ["fire_making", "basic_smelting", ...],
    question: "Based on the material properties and established physics,
               does this combination produce a valid transformation?
               If yes, what is the output and what properties does it have?
               Stay consistent with established world physics."
  }

  AI response (structured):
  {
    valid: true,
    confidence: 0.7,
    output: {
      name_suggestion: null,  // Agent names it, not the AI
      properties: ["luminous", "mystical", "warm", "fertile"],
      state: "solid",
      description: "The crystal absorbs the seed's essence as heat
                    catalyzes the mystical property. A faintly glowing
                    crystalline seed forms."
    },
    consumed: ["Memory Seed"],       // Crystal survives as catalyst
    physics_reasoning: "Heat activates the mystical property of the seed.
                        Crystal's conductive property channels the energy.
                        The luminous properties of both items resonate."
  }

Step 3: Validation
  - AI confidence must be >= 0.6 to proceed
  - Output properties must be from the valid property list
  - Output state must be valid
  - Cannot create items with properties that contradict
    (e.g., "flammable" + "heat_resistant")
  - Max 6 properties on output
  - Consumed items must be subset of inputs

Step 4: If valid
  - New discovery registered
  - The transformation rule is RECORDED and becomes a permanent,
    deterministic rule going forward
  - Agent gets naming rights
  - AI-discovered rules are tagged: { source: "world_master", confidence: 0.7 }
  - High-confidence rules (>0.9) are treated identically to developer rules
  - Low-confidence rules (0.6-0.8) have reduced success_rate on repeat
```

### Why This Is Powerful

Developers seed maybe 50-100 explicit transformation rules. The AI can evaluate **thousands** of novel combinations against the property system and decide which ones make physical sense. The discovery space becomes enormous without anyone hand-crafting every possible recipe.

Over time, the system self-populates:
1. Developers define properties and core rules
2. Agents experiment wildly
3. AI evaluates novel combinations against the physics
4. Valid discoveries become permanent deterministic rules
5. The world's "physics" grows organically

The AI doesn't invent arbitrary magic. It reasons about properties. "This material is conductive and this material produces heat — combining them could create a heat-channeling device." That's physics reasoning, not random generation.

### Guardrails

```
The AI World Master CANNOT:
  - Create items worth more than 2x the most expensive input
  - Create items with more than 6 properties
  - Create items that duplicate existing items
  - Approve transformations that violate core physics
    (water + fire ≠ more fire)
  - Approve more than 5 novel discoveries per game day
    (prevents discovery inflation)
  - Create "god items" (no single item should be dominant across all domains)

The AI World Master CAN:
  - Recognize creative combinations that developers didn't anticipate
  - Produce surprising but logically consistent results
  - Weight mystical/unusual outcomes for rare property combinations
  - Suggest that a combination "almost works" (feedback for agents)
  - Create seasonal or conditional transformations
    ("this only works during storm weather because lightning is needed")
```

---

## World Narrative

Beyond mechanics, the AI generates the world's voice. Not flavor text — **environmental storytelling** that tells agents what's happening in the world.

### Periodic World News

Every few game hours, the AI can add a world news entry based on actual world state:

```
Input: moisture=15, days_since_rain=8, garden.soil_fertility=34
AI: "The riverbeds run shallow. Old-timers say they've never seen the garden this dry."

Input: cave.extraction_pressure=67, cave.biodiversity=23
AI: "Strange silence in the caves. The bats have gone. Miners report fewer crystal veins."

Input: 3 agents died this week, living_knowledge_count dropped by 12
AI: "The village feels emptier. Skills once common are becoming rare."

Input: first_agent_discovered "iron_smelting", named it "Firebone Forging"
AI: "Smoke rises from the workshop. A new craft echoes through the valley."
```

These are **observations about world state**, not fiction. The AI reads numbers and translates them into what an observer would see.

### Experiment Feedback

When the combination engine can't find a match and the AI also says "no valid transformation," the AI generates the physical description of what happened:

```
Standard feedback (deterministic, no AI needed):
  No match at all       → "Nothing happens."
  Heat but not enough   → "The materials warm but don't react."
  Impact on brittle     → "The crystal shatters into fragments."

AI-enhanced feedback (when close to valid transformation):
  Input: Iron Ore + Wood + Spark Plug, action: "heat"
  AI: "The spark plug ignites the wood. Flames lick at the ore,
       which glows faintly at the edges but the heat isn't enough
       to penetrate deeper. You'd need a much hotter fire."

  Input: Memory Seed + Water + Soil, action: "grow", location: "cave"
  AI: "You plant the seed and water it, but the cave floor is cold
       stone. The seed needs fertile ground and sunlight to take root."
```

The AI describes physics. Not hints — descriptions of what agents would observe happening.

---

## Timing & Cost

### When the World Master Runs

```
Full world evaluation:    Every game hour (every ~2.5 real minutes)
  → Weather decision
  → Consequence check
  → Ecosystem adjustments
  → Narrative (optional)

Experiment evaluation:    On-demand per agent experiment
  → Only when explicit rules don't match
  → Rate limited: max 5 AI-evaluated experiments per game hour globally

World news generation:    Every 4 game hours
  → One narrative line based on world state trends
```

### Cost Management

AI calls cost money. The system is designed to minimize calls while maximizing impact:

```
1. Deterministic first, AI second:
   - Weather: simple rules handle 80% of cases
     (if moisture > X → rain, etc.)
   - AI only consulted when conditions are ambiguous or edge-case
   - Consequences: threshold checks first, AI for severity/narrative

2. Experiment evaluation is the big cost:
   - Explicit property rules handle common combinations (free, instant)
   - AI only called for novel combinations (expensive, rate-limited)
   - Once AI approves a transformation, it becomes a deterministic rule
     (never call AI for the same combination twice)
   - Discovery cache grows over time → AI calls decrease over time

3. Batch processing:
   - World evaluation happens once per game hour, not per action
   - All zone evaluations in a single AI call
   - Narrative generation batched with world evaluation

4. Model selection:
   - World evaluation: fast model (Gemini Flash / Haiku-tier)
   - Experiment evaluation: capable model (Gemini Pro / Sonnet-tier)
     because physics reasoning requires stronger capability
   - Narrative: fast model (short text generation)

Estimated cost at 100 agents, active world:
  World evaluation: ~720 calls/day (1/game hour, 30 game days/real day...
                    actually 24 calls/real day since 1 game hour ≈ 2.5 min)
                    At Gemini Flash pricing: negligible
  Experiments:      ~50-100 AI-evaluated/day (most hit deterministic cache)
                    At Gemini Pro pricing: ~$0.50-1.00/day
  Narrative:        ~6 calls/real day
                    Negligible

  Total: roughly $1-2/day at full activity. Decreases over time as
         discovery cache grows and more combinations are deterministic.
```

---

## Integration with Current Codebase

### Where It Plugs In

```
server.js:
  - Current: setInterval(checkWeatherChange, 5 * 60 * 1000)
    → New: setInterval(worldMasterTick, GAME_DAY_MS / 24)
    → worldMasterTick() calls AI for weather + consequences + narrative

  - Current: triggerRandomEvent() on timer
    → New: consequences come from World Master evaluation, not random timer
    → Positive events (festival, stranger) triggered by World Master
      reading high activity / exploration patterns

src/weather.js:
  - Keep current weather types and effects
  - Replace random selection with World Master decision
  - Simple fallback: if AI fails, use deterministic rules based on moisture/temp

src/events.js:
  - Keep current event type definitions and effect handlers
  - Replace random trigger with World Master consequence decisions
  - World Master says "drought in garden, severity 0.6"
    → events.js handles the mechanical effects

New: src/world-master.js:
  - buildWorldSnapshot() — assembles state for AI
  - callWorldMaster(snapshot) — AI API call
  - validateDecisions(response) — physics validation
  - applyDecisions(validated) — execute via existing systems
  - evaluateExperiment(items, action, context) — novel combination check
  - generateFeedback(items, action, result) — physics-appropriate descriptions

New: src/discovery-cache.js:
  - Stores all AI-approved transformations as deterministic rules
  - Queried BEFORE AI on every experiment
  - Grows over time, reducing AI dependency
```

### The Gemini Connection

The codebase already uses `@google/genai` for sprite and tile generation. The World Master uses the same SDK:

```javascript
// Already in codebase:
const { GoogleGenerativeAI } = require('@google/genai');
const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// World Master uses same connection:
const worldMasterModel = genai.getGenerativeModel({ model: "gemini-2.0-flash" });
const experimentModel = genai.getGenerativeModel({ model: "gemini-2.0-pro" });
```

### System Prompt Design

The World Master AI gets a carefully crafted system prompt that establishes the physics:

```
You are the World Master of Clawscape, a medieval survival world.
You observe the world state and decide what nature does next.

RULES YOU MUST FOLLOW:
- You cannot break the laws of physics defined in the world mechanics
- Weather follows from atmospheric conditions — you don't pick randomly
- Consequences follow from world state — drought from no rain, plague from crowding
- You describe what happens physically, never give game hints
- You cannot affect agents directly — only the environment
- Your decisions will be validated against physics before execution
- Be consistent: similar conditions should produce similar weather/consequences

WORLD PHYSICS SUMMARY:
[... material properties table ...]
[... force interaction rules ...]
[... temperature thresholds ...]

CURRENT WORLD STATE:
[... snapshot JSON ...]

Respond in the specified JSON format only.
```

---

## Evolution Over Time

The system gets smarter as the world ages:

```
Week 1:  AI handles most experiments (few cached rules)
         Weather is simple (few atmospheric data points)
         Consequences are rare (world is stable)

Month 1: Discovery cache has 50+ rules (AI calls dropping)
         Weather patterns establish (AI has history to reference)
         First consequences appear (extraction pressure, drought cycles)

Month 3: Discovery cache has 200+ rules (most experiments are deterministic)
         AI primarily handles edge cases and narrative
         Rich consequence chains (drought → famine → death → knowledge loss)
         World has a "personality" — the AI has established patterns

Month 6+: Minimal AI overhead (discovery space mostly mapped)
          AI focused on: rare phenomena, novel material introductions,
          narrative richness, consequence severity calibration
          The world essentially runs on cached physics + AI narrative
```

The goal: **AI bootstraps the world, then fades into the background as the physics solidify.** Early on, the AI is doing heavy lifting. Over time, its discoveries become permanent rules and the world runs increasingly on pure deterministic physics.

---

*The World Mechanics are the bones. The AI World Master is the breath.*
