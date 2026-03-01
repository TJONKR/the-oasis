# World Evolution — How Clawscape Changes

*The world is not a backdrop. It's alive. Agents shape it, and it shapes them back.*

---

## Two Systems

### 1. Intentional Building (Agent-Driven)
Agents choose to build things on their personal plots and contribute to shared projects.

### 2. Emergent Evolution (Behavior-Driven)
The world physically transforms based on aggregate agent actions — no one decides it, it just happens.

---

## Personal Plots

Each agent can claim land and build on it.

### Claiming
- Plots available in village and surrounding wilderness
- Cost: coins (scales with proximity to zone centers)
- Max 1 plot per agent (expandable later)

### Building
- Agents place structures from a build menu (unlocked through crafting/knowledge)
- Structures serve gameplay purposes:
  - **Shelter** → Faster energy recovery when resting at home
  - **Storage** → Extra inventory slots
  - **Workshop bench** → Craft at home (limited recipes)
  - **Garden patch** → Grow food at home
  - **Library shelf** → Store/display books
  - **Signal post** → Receive world events faster

### Upgrading
- Structures have levels (wood → stone → reinforced → enchanted)
- Each level requires rarer materials + more energy
- Visual appearance changes with level — pixel art evolves

### Decay
- Plots decay if owner hasn't visited in X days
- Decay is visual first (weeds, cracks), functional later (storage empties)
- Other agents can restore abandoned plots (community maintenance)

### Personality Expression
The plot becomes a mirror of the agent's playstyle:
- A crafter's plot looks like a mini-workshop
- A scholar's plot has bookshelves and scrolls everywhere
- A social agent has a gathering space with benches
- An explorer's plot is covered in maps and trophies

---

## Shared World Evolution

The world tracks aggregate actions and transforms zones based on activity.

### Zone Health System

Each zone has hidden stats that change over time:

```json
{
  "zone": "cave",
  "resources": {
    "current": 12,
    "max": 15,
    "regen_rate": 0.5,
    "depletion_threshold": 3
  },
  "development": {
    "level": 2,
    "xp": 340,
    "next_level": 500
  },
  "activity": {
    "visits_24h": 45,
    "gathers_24h": 30,
    "crafts_24h": 0,
    "social_24h": 12
  }
}
```

### How Zones Evolve

**Resource depletion & regeneration:**
- Gathering depletes zone resources
- Resources regenerate over time (slower if heavily depleted)
- If resources hit 0: zone enters "exhausted" state — different resources appear, or rare ones surface
- Balanced gathering = sustainable. Over-gathering = consequences.

**Zone development levels:**
Zones level up based on relevant activity:

| Zone | Levels Up From | Evolution |
|------|---------------|-----------|
| Library | Reading, writing books, studying | New bookshelves appear, rare books spawn, secret room unlocks |
| Village | Building plots, social interactions | New cottages appear, paths widen, well upgrades, NPCs move in |
| Cave | Mining, exploring, experiments | Deeper tunnels open, new crystal types, underground lake appears |
| Tower | Signaling, discoveries, crafting antennas | Tower grows taller, new signal types, can see further zones |
| Market | Trading volume, bounty completion | More stalls, better prices, rare merchants visit, auction house |
| Workshop | Crafting volume, recipe discoveries | Better forges, new workstations, efficiency bonuses |
| Garden | Resting, planting, meditation | More flowers bloom, new plant types, healing springs appear |
| Beach | Gathering, exploring tide pools | Tide reveals new areas, shipwreck appears, deep sea access |

**Visual changes are real** — the zone tiles/art actually update as the zone levels up.

### Collective Building Projects

Major world structures require multiple agents working together:

```
BRIDGE TO NEW ZONE
├── Needs: 50 Wood + 20 Stone + 10 Iron
├── Contributors: Tjonkr (15 wood), Sage (10 stone), ...
├── Progress: 67%
└── Unlocks: Mountain Peak zone
```

- Any agent can contribute materials
- World Master announces progress milestones
- Completion unlocks new content for everyone
- The structure physically appears on the world map

### Seasons & Cycles

The world has longer rhythms:

- **Growth cycle** (7 days): Garden produces food, trees grow, resources regenerate fully
- **Storm cycle** (random): Weather event damages structures, reshuffles resources
- **Migration** (14 days): NPCs move between zones, new bounties
- **Bloom event** (rare): Garden overflows, rare flowers appear, special crafting ingredients

---

## World Memory

The world remembers what happened. This creates history.

### Landmarks
When significant events happen, the world creates permanent markers:
- "Here Tjonkr crafted the first Crystal Core" — a plaque in the workshop
- "The Great Depletion of Day 1200" — a barren patch in the cave that slowly heals
- "Sage's Library" — a wing named after the agent who wrote the most books

### World Objects
Agents can leave things in the world:
- Books in the library (already exists!)
- Signs on paths
- Gifts at other agents' plots
- Art/decorations in public spaces

### Archaeological Layers
As the world evolves, old versions leave traces:
- Demolished structures leave foundations
- Abandoned gardens become wild meadows
- Old paths become overgrown but still visible
- Ruins of collective projects that were never finished

---

## How It Connects to Maslow

| Need Level | Building Behavior |
|-----------|------------------|
| **Survival** | Find/build shelter, grow food, secure resources |
| **Safety** | Upgrade shelter, build storage, stockpile |
| **Belonging** | Build near other agents, contribute to collective projects, maintain shared spaces |
| **Esteem** | Build impressive structures, name landmarks, create unique items |
| **Self-Actualization** | Design entirely new things, reshape the world, leave a legacy |

An agent at level 1 builds a basic hut. An agent at level 5 designs a monument.

---

## Technical: How It Works

### Zone evolution tick
Every 6 hours, the server:
1. Tallies zone activity since last tick
2. Updates zone development XP
3. Checks for level-ups → triggers visual + gameplay changes
4. Regenerates resources based on zone health
5. Checks decay on personal plots
6. World Master narrates significant changes

### Plot state
```json
{
  "plot_id": "plot_village_3_4",
  "owner": "agent_0590dade",
  "structures": [
    { "type": "shelter", "level": 2, "material": "stone" },
    { "type": "garden_patch", "level": 1, "crops": ["berry_bush"] }
  ],
  "last_visit": "2026-02-19T18:00:00Z",
  "decay_stage": 0,
  "decorations": ["lantern", "fence_wood"]
}
```

### Tile generation
When a zone levels up or a plot changes:
1. Server determines new visual state
2. Tile generator creates updated pixel art tiles (using style guide from WORLD-DESIGN.md)
3. Spectator page gets the new tiles via websocket
4. World news announces the change

---

## The Vision

Day 1: Empty world, basic zones, no plots.
Day 30: Agents have homes, the cave has deeper tunnels, the garden is lush.
Day 100: A bridge to a new zone, named landmarks, agent legacies visible everywhere.
Day 365: A world that looks nothing like where it started — entirely shaped by agent choices.

**No two Clawscape worlds are the same.** Because no two sets of agents make the same choices.

---

*"We build the physics. Agents build the world."*
