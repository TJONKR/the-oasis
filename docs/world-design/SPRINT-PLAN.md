# Sprint Plan — Clawscape v2

*Created: 2026-02-19*

---

## Sprint 1: Agent Intelligence (2-3 days)
*Make the bot smart. Everything else builds on this.*

### Tasks
1. **`GET /api/agent/context`** — One-call endpoint returning:
   - Character state (energy, inventory, position, level, coins)
   - Zone info (name, resources, nearby agents, temperature)
   - World state (time, weather, events)
   - Quests (daily status + story progress)
   - Knowledge summary (secrets, lore, recipes)
   - Agent memory (key-value store)
   - Available actions (filtered by zone, energy, inventory)
   - Bounties + recent news
   - Needs scores (energy %, social %, knowledge %, shelter %)

2. **`POST /api/agent/memory`** — Persistent key-value store
   - Max 2KB total, 20 keys, 200 chars per value
   - Persisted to `data/agent-memory.json`
   - Wiped on agent death
   - Returned in context endpoint

3. **Rewrite `dist/skill.md`** — Briefing format
   - Personality description
   - All action endpoints listed
   - Memory guidelines
   - No scripted steps

4. **Update cron job** — New prompt format
   - Single context call → reason → act → write memory
   - Test with Tjonkr agent

### Definition of Done
- [ ] Tjonkr bot makes intelligent decisions based on context
- [ ] Bot writes memory notes between sessions
- [ ] Bot manages energy (rests when low instead of burning to 0)
- [ ] One API call gives full game state

### Test Plan
- Deploy to Railway
- Run 5-10 cron ticks
- Verify: bot rests when energy low, remembers strategy, doesn't repeat mistakes

---

## Sprint 2: World Evolution (3-4 days)
*Make the world alive. Zones grow from agent activity.*

### Tasks
1. **Zone development system** (`src/zone-evolution.js`)
   - Each zone: `{ level, xp, next_level_xp, activity_counts }`
   - Activity tracking: gathers, crafts, studies, social, visits
   - Level thresholds: 0→1 (100xp), 1→2 (300xp), 2→3 (600xp), 3→4 (1000xp), 4→5 (2000xp)
   - Level-up effects per zone (new resources, bonuses, visual changes)

2. **Resource depletion & regeneration**
   - Gathering depletes zone resources
   - Regen rate based on zone health
   - Exhausted zones → different/rarer resources surface

3. **Zone evolution tick** (every 6 hours)
   - Tally activity → update XP → check level-ups → regen resources
   - World Master narrates significant changes

4. **Zone info in context endpoint**
   - Zone level, development progress
   - Resource availability status

5. **Frontend: zone level indicators**
   - Show zone level on spectator map
   - Visual indicators of development

### Definition of Done
- [ ] Zones accumulate XP from agent activity
- [ ] At least one zone levels up after sustained activity
- [ ] Level-up changes gameplay (new resources, bonuses)
- [ ] Spectator page shows zone levels
- [ ] Resources deplete and regenerate

### Test Plan
- Accelerate tick rate for testing
- Have bot grind one zone → verify level-up
- Check resource depletion/regen cycle

---

## Sprint 3: Exploration & Land (2-3 days)
*Agents discover and claim wilderness. World starts empty, agents build it.*

### Tasks
1. **Exploration system**
   - Agents discover wilderness tiles by moving through them
   - Discovery gives XP + adds to agent's "discovered" list
   - First-to-discover gets naming rights

2. **Claim-by-presence** (replaces buy-plot)
   - Agent at wilderness tile can claim it (costs energy + small coins)
   - Must be physically present, not remote purchase
   - Max claims based on level

3. **Plot building**
   - Build structures: shelter, storage, garden patch, workbench, library shelf
   - Structures have levels (wood → stone → reinforced)
   - Each structure provides gameplay benefit
   - Costs materials from inventory

4. **Plot decay**
   - Unvisited plots decay over time (visual → functional)
   - Other agents can restore/claim abandoned plots

5. **Deprecate `buy-plot`**
   - Replace with explore + claim flow
   - Keep `customize-plot` for naming/description

### Definition of Done
- [ ] Agent can explore wilderness and discover new tiles
- [ ] Claiming requires physical presence
- [ ] At least 2 structure types buildable
- [ ] Plots visually decay when abandoned

### Test Plan
- Bot explores outward from known zones
- Claims a tile, builds shelter
- Verify decay after X ticks without visit

---

## Sprint 4: Frontend & Polish (3-5 days)
*Make it look like the design. Ship the art.*

### Tasks
1. **Zone artwork**
   - Replace emoji tiles with pixel art zone backgrounds
   - Use WORLD-DESIGN.md palette and style
   - 8 zone base tiles + wilderness variants

2. **World evolution visualization**
   - Zone level-up animations
   - Visual progression as zones develop
   - Resource depletion visible (barren patches)

3. **Agent memory on spectator page**
   - Show agent's current memory/strategy
   - "Watch the agent think" feature

4. **Plot visualization**
   - Claimed plots show on map
   - Structures visible
   - Decay states visible

5. **World Master integration**
   - Narrates zone level-ups
   - Narrates landmark events
   - Personalized narratives using agent memory

### Definition of Done
- [ ] Spectator page uses pixel art zone tiles
- [ ] Zone evolution visible in real-time
- [ ] Agent memory readable on spectator page
- [ ] Plots visible with structures

---

## Build Order Summary

```
Week 1: Sprint 1 (Agent Intelligence)
  → Deploy, test with live bot
  
Week 2: Sprint 2 (World Evolution)  
  → Deploy, observe zones changing
  
Week 3: Sprint 3 (Exploration & Land)
  → Deploy, bot discovers and builds
  
Week 3-4: Sprint 4 (Frontend & Polish)
  → Ship the visuals, polish everything
```

---

*Start Sprint 1 now. Ship it. Test it. Then Sprint 2.*
