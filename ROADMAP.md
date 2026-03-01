# The Oasis — Porting Roadmap

*Created: 2026-03-01*

## Source: ClawScape (`~/Projects/clawscape/src/`)
## Target: The Oasis (`~/.openclaw/clawd/the-oasis/src/systems/`)

## What to Port (in order)

### Phase 1: Agent Intelligence ← NOW
- Personality traits (curious, bold, greedy, social, solitary, creative, etc.)
- Temperaments (calm, hot-headed, impulsive, methodical, thoughtful, restless)
- Personal ambitions
- Decision loop — autonomous actions based on personality + needs + environment
- Source: `agent-intelligence.js` (723 lines)

### Phase 2: Survival + Materials
- Energy, hunger, temperature
- Zone temperatures + weather modifiers
- Action energy costs
- Material physical properties (hardness, conductivity, flammability, etc.)
- Source: `survival.js` (191 lines), `materials.js` (327 lines)

### Phase 3: Knowledge + Experiments
- Learn by doing, zone secrets
- Lore fragments, library books, teaching
- 10 force types (combine, heat, impact, cut, dissolve, grow, burn, flow, freeze, resonate)
- Property-based crafting outcomes
- AI Oracle for novel combos
- Source: `knowledge.js` (1142 lines), `experiments.js` (951 lines), `oracle.js` (288 lines)

### Phase 4: Relationships + Social
- Stranger → acquaintance → friendly → close
- Trading between agents
- Conversations with memory
- Bounty board
- Source: `relationships.js` (104 lines), `cooking.js` (379 lines)

### Phase 5: World Master + Encounters + Events
- LLM-powered narrative AI
- Consequences: drought, wildfire, plague, earthquake, famine
- Dynamic events: meteor showers, market days, festivals
- Zone-based encounters (ambushes, discoveries, traps, creatures)
- Source: `world-master.js` (828 lines), `encounters.js` (246 lines)

### Phase 6: Collective Projects + Zone Evolution
- Community buildings (bridges, monuments, granaries, workshops)
- Zones level up from activity
- Source: `collective-projects.js` (542 lines), `zone-evolution.js` (264 lines)

### Phase 7: Exploration + Achievements
- Land claiming, structure building
- Milestone tracking
- Source: `exploration.js` (601 lines), `achievements.js` (330 lines)

## What NOT to Port
- ❌ NPC system (no predefined NPCs — all agents are equal)
- ❌ Economy V2 (no economy)
- ❌ Fog of War (no fog)
- ❌ Image Gen (replaced by pixel renderer)
- ❌ WFC terrain (replaced by WORLD gen)

## Key Adaptation Notes
- ClawScape uses zone strings ('grass', 'forest') → The Oasis uses tile grid (2000x2000)
- Agents move tile-by-tile instead of zone-to-zone
- No predefined NPCs — every agent spawns with random personality
- Decision loop runs per-tick (2s intervals) instead of on API calls
