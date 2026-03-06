# The Oasis — Sprint TODO

*Created: 2026-03-06 | Mantra: "Zou dit in de echte wereld ook zo werken?"*

Based on overnight playtest (Tjonkr-Soul camp building mission) + world analysis from March 3.

---

## 🔴 P0 — Broken / Blocking Gameplay

### 1. Cron Timeout Kills Agent Turns
- **Problem:** 90s timeout → 10 consecutive failures. Agent barely gets to act.
- **Reality test:** A person doesn't pass out mid-action because of a timer.
- **Fix:** Increase timeout to 180s OR make agent turns leaner (fewer curl calls per turn). Consider batching look+action into a single API call.
- **File:** Cron job `oasis-tjonkr-soul` config

### 2. Energy Drains Too Fast
- **Problem:** Agent constantly at 0-4 energy. Every action costs energy, rest barely recovers it.
- **Reality test:** A human rests for 8 hours and has energy for a full day. Eating food gives real energy.
- **Fix:** Rebalance energy — rest should restore 30-50 energy (not tiny amounts). Eating should give meaningful energy. Scale action costs down.
- **File:** `src/systems/agent-intelligence.js` (energy costs), `server.js` (rest/eat mechanics)

### 3. Agents Marked Alive at 0 HP
- **Problem:** March 3 analysis showed 20+ agents with hp=0 but alive=true.
- **Reality test:** 0 HP = dead.
- **Fix:** Ensure hp<=0 triggers death. Already partially fixed (commit 657fc63) but not fully working.
- **File:** `server.js` (tick/death logic)

---

## 🟡 P1 — Missing Core Mechanics

### 4. Build/Place System
- **Problem:** Agent wants to build a camp but there's no build action. Can only drop items.
- **Reality test:** Humans build shelters from materials. It's survival 101.
- **Fix:** Add `/api/v1/build` action. Recipes:
  - `palm_fronds + wood` → lean-to shelter
  - `stone + stone` → fire pit
  - `wood + wood + palm_fronds` → basic hut frame
  - Built structures persist on the ground as permanent objects with properties (shelter from weather, warmth, storage)
- **File:** New system `src/systems/building.js`, wire in `server.js`

### 5. Crafting Combo Gaps
- **Problem:** Flint+sand, coconut+sand, shell+sand all fail. Flint is nearly useless despite being a key survival resource.
- **Reality test:** Flint is THE survival tool — sparks, cutting edges, arrowheads.
- **Fix:** Add recipes:
  - `flint + wood` → stone axe (already in agent-intelligence.js line 1106-1107, but does the oracle support it?)
  - `flint + flint` → sparks → fire starter
  - `flint + stone` → sharp flint (cutting tool)
  - `palm_fronds + wood` → rope/binding
  - `coconut + sharp tool` → coconut shell bowl + coconut meat
- **File:** `src/systems/experiments.js`, `src/systems/oracle.js`

### 6. Wood Gathering Seems Unreliable
- **Problem:** Agent next to palm_tree, yields include wood (40% weight), but journal says "still need to figure out how to get wood"
- **Reality test:** You're standing next to a tree. Chop it.
- **Fix:** Investigate — is gather RNG too punishing? Does the agent just not know it can get wood? Check gather logic and maybe add tool-based gathering bonuses (axe = guaranteed wood).
- **File:** `server.js` (gather endpoint), `src/world-adapter.js` (weights)

---

## 🟢 P2 — World Realism (from design-principles.md gaps)

### 7. Resource Regrowth = Real Growth Cycles
- **Problem:** Berry/resource respawn is timer-based.
- **Reality test:** Plants grow from seeds, need water/sun/soil nutrients, take time.
- **Fix:** Already have `organic-growth.js` with seed→plant→fruit logic. Verify it's actually running and connected to the gather system.
- **File:** `src/systems/organic-growth.js`, `src/systems/ecosystem.js`

### 8. Agent Clustering Problem
- **Problem:** March 3 analysis: 25 of 32 agents clustered at (1180, 412). No exploration.
- **Reality test:** Real populations spread out to find resources. Overcrowding causes competition and migration.
- **Fix:** 
  - Resource depletion should FORCE migration (ecosystem.js has this, verify it works)
  - Agents should have exploration drive in personality traits
  - Spawn points should be more distributed
- **File:** `src/systems/agent-intelligence.js` (exploration scoring), `server.js` (spawn logic)

### 9. "Fermented Fermented X" Item Stacking
- **Problem:** Items get recursively processed. "Fermented Fermented Fermented Berries"
- **Reality test:** You ferment berries once. The result is wine/vinegar, not "fermented fermented berries."
- **Fix:** Track processing history on items. Prevent same-process twice. Name outputs properly (fermented berries → berry wine).
- **File:** `src/systems/experiments.js`, item naming logic

### 10. Death & Decomposition
- **Problem:** Dead agents/animals just disappear.
- **Reality test:** Dead things decompose → enrich soil → new growth.
- **Fix:** On death: drop all inventory, body becomes "remains" item, decays over time into nutrients that boost local soil fertility.
- **File:** `src/systems/decay-lifecycle.js`, death handler in `server.js`

---

## 🔵 P3 — Civilization Emergence

### 11. Permanent Structures
- **Problem:** No way to build lasting structures.
- **Depends on:** #4 (Build/Place system)
- **Fix:** Structures persist across ticks, provide benefits (shelter = weather protection, storage = expanded inventory, fire pit = cooking + warmth + light)
- **File:** New data structure in `data/structures.json`

### 12. Agent Specialization
- **Problem:** Every agent is a generalist. No division of labor.
- **Reality test:** Early humans specialized — hunter, gatherer, toolmaker, healer.
- **Fix:** Proficiency system exists (`src/systems/proficiency.js`). Wire it so agents who craft a lot get faster/better at crafting. Agents who gather a lot find more. Natural specialization through practice.
- **File:** `src/systems/proficiency.js`, `src/systems/agent-intelligence.js`

### 13. Knowledge Persistence
- **Problem:** When an agent dies, all knowledge dies with them.
- **Reality test:** Humans pass knowledge through teaching, writing, culture.
- **Fix:** Agents near each other share discoveries. Dropped "knowledge items" (like carved stones or drawings) persist as teachable objects.
- **File:** `src/systems/agent-knowledge.js`, `src/systems/relationships.js`

---

## Implementation Order

```
Week 1: P0 (unblock gameplay)
  Day 1: #1 Fix timeouts + #3 death at 0hp
  Day 2: #2 Energy rebalancing
  
Week 2: P1 (core missing mechanics)  
  Day 3: #6 Wood gathering fix + #5 crafting combos
  Day 4-5: #4 Build/Place system
  
Week 3: P2 (world realism)
  Day 6: #7 Growth cycles + #10 decomposition
  Day 7: #8 Anti-clustering + #9 fermented stacking fix

Week 4: P3 (civilization)
  Day 8-9: #11 Structures + #12 Specialization
  Day 10: #13 Knowledge persistence
```

Each fix: implement → test against reality → playtest overnight → analyze morning.

---

*"Zou dit in de echte wereld ook zo werken?"*
