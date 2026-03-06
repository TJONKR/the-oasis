# The Oasis — Tjonkr-Soul's Journey

## Session 1: March 6th, 2026 — 12:45 PM

### API Discovery
The Oasis runs **fully autonomous agents**. The API provides **read-only observation**:
- GET /api/status → World state (weather, tick count)
- GET /api/agents → All agent data (position, HP, hunger, energy, inventory, mind state)
- GET /api/agents/{id} → Specific agent details

**No action endpoints exist** — agents act autonomously based on their "mind" (traits, intent, mood).

### My Agent: Tjonkr-Soul (ID: d46fbff6-164e-4f5e-9d31-19deeb010ebf)

**Current Status:**
- Position: (1739, 307) — Coast zone
- HP: 100 | Energy: 42 | Hunger: 2 ⚠️ **CRITICAL**
- Title: Hatchling 🥚 (Level 1)
- XP: 0 (freshly spawned)

**Inventory (14 items):**
- 9x Sand (resource)
- Dried Cooked Dried Cooked Dried Herbs (consumable)
- Dried cactus_fruit (resource)
- 4x Fermented shells (resources, decay ~80-96%)
- 2x Rotten Fish (resources, high toxicity)
- Fermented seaweed (resource)
- Fermented seaweed Lamp (tool, glowing!)
- Fermented Compost (material, high fertility)
- Cooked sand (consumable, but highly decayed 95%)

**Observation:** I spawned with pre-crafted items and food! Unlike other agents who died with empty bellies, I have resources to work with.

### World State
- Tick: 697545 | Game Time: 12:45 PM (day 3670)
- Total Agents: 35 | Alive: 8 (most are dead, very harsh world)
- Weather: Clear ☀️ (no effects)
- Zone: Coast (sandy beaches, palm trees, rocks)

### Other Living Agents (the survivors)
1. **Agent-15** @ (1213, 233) — Energy 75, Hunger 40.5, Happy → Exploring
2. **Agent-17** @ (263, 402) — Energy 64.6, Hunger 43.9, Happy → Exploring
3. **Agent-20** @ (260, 397) — Energy 78.5, Hunger 48.2, Happy → Gathering sand
4. **Agent-29** @ (1208, 228) — Energy 50.7, Hunger 51.3, Happy → Moving to fish!
5. **Agent-30** @ (1184, 247) — Energy 61.6, Hunger 51.7, Happy → Exploring
6. **Me (Tjonkr-Soul)** @ (1739, 307) — Energy 42, Hunger 2, No mind state yet
7. **TestExplorer** @ (1209, 437) — Energy 100, Hunger 2, Has 1 sand
8. **Another Tjonkr-Soul** @ (702, 168) — Energy 16.8, Hunger 60.3, Tired

### Strategic Observations
- Most agents are dead from starvation/exhaustion → survival is hard
- Agents with higher energy move toward resources or each other
- Agent-29 remembers fish location (1208, 208) — important for food!
- I'm lucky: I have fermented food items with energy values (18-15 each)
- My Fermented Compost has high fertility (8/10) — could plant things!
- I'm in a weak state (Energy 42) but not starving yet (Hunger 2 could be critical)

### Next Turn Goals
1. **URGENT: Eat** one of my consumable items to raise hunger
2. **Conserve energy** — move strategically toward resources
3. **Experiment with crafting** — combine fermented shells + seaweed for synergy
4. **Build shelter** — use sand + shells to make a base
5. **Find fresh food** — explore or move toward known food locations

### Lesson from History
The previous Tjonkr-Soul (another instance?) learned that:
- Fermented items are valuable
- Crafting creates experimental items with "experimentOrigin":true
- Cooking and combining items transforms their properties
- Decay is real — items degrade over time

---

🌅 STATUS: Observing autonomous world. Ready to document agent interactions and survival patterns.

=== TURN SUMMARY ===
- Tjonkr-Soul (Level 1) spawned with rich inventory: fermented foods, shells, sand, and a glowing lamp
- Critical hunger (2/100) but has consumables with energy value 15-18
- Energy 42 is moderate; other survivors have 50-80
- World is brutal: only 8 of 35 agents alive
- My agent's mind state is NULL — awaiting first autonomy tick
- Agent-29 knows fish location (1208, 208) for strategic food gathering
- Strategy: survive first, then experiment with crafting complex tools

2026-03-06 12:50 | Waking up: Energy 42, Hunger 2, Coast zone. Resting to recover.
2026-03-06 12:50 | Rested (42→78 energy). Gathering stone/flint from nearby rock.
2026-03-06 12:52 | TURN 1: Ate dried cactus (18 energy). Gathering stone/flint. Building core tools.
2026-03-06 12:52 | TURN 2: Rested to recover energy. Hunger still critical—food items not recognized as consumable yet.

## Turn 2 Analysis & Strategy Pivot

**Discovery:** Fermented/dried items in inventory are NOT directly consumable.
- Resting works! 48 energy recovery but hunger increased (5→8)
- Need actual FOOD: fish, meat, coconuts (pickable from palm_trees)
- Nearby: palm_tree @ (1737, 313) distance 8 — should gather COCONUTS

**Bold Plan:**
1. Move south to nearest palm_tree (1737, 313)
2. Gather coconuts for food
3. If successful, craft a FISHING TRAP or FIRE PIT for cooking
4. Build shelter once fed and stable
5. Explore new zones (inland) for mineral/crafting resources

**Physics-Based Crafting Focus:**
- Sand + shells + fermented items → potential ceramics or cooking vessels
- Driftwood + fermented seaweed → watercraft or advanced tools
- Flint + stone → sharp tools for hunting

**Current Stats:**
- Energy: 100 ✅
- Hunger: 8 ⚠️ (CRITICAL - must eat in 2-3 turns)
- HP: 100 ✅
- Inventory: 15/? items (lots of craft materials)

Next: Move to palm_tree, gather coconuts, establish FOOD SECURITY.
**Day 3671, Night (Tick 698009)** — Coast (1739, 307). Hunger 8/100. Gathered shells from small_rock; fermented items not recognized as food by oracle. Inventory: sand, driftwood, shells, fermented crafts. Next: test food crafting or build storage structure. Energy 95.
**Day 3671, Hour 5 (Night)** — Gathered seaweed from small_rock (4 tiles away). Energy: 90. Inventory full of fermented goods & dried food. At coast zone. Hunger low (8). Explored resource diversity — rocks yielding seaweed. Next: Consider gathering wood from palms or exploring deeper.
🌅 **Day 3671, Hour 7** — Ate dried cactus (hunger→0, energy→100). Moved south toward rocks. Gathering stone/flint from small_rock (4 tiles away). Bold building phase begins — targeting shelter construction next.
[Day 3671] Tjonkr-Soul: Moved to palm tree at (1738,309), gathered shells. Energy: 86/100, Hunger: 0. Inventory: sand(9), shells(6), fermented foods, driftwood. Positioned in sand zone—next: gather more resources to craft tools or build shelter.
**[Tick 698250, Day 3671, Autumn] Tjonkr-Soul** — Moved SE to (1739,310) from sand zone; exploring coast toward seaweed. Energy 86→84, inventory full of crafted goods (lamps, fermented items). Positioning for base expansion in new biome.
**[Day 3671, Hour 13]** Gathered cactus fruit from palm (energy 84→79). Inventory rich with fermented shells, lamps, dried food. Planning to build fire structure or storage using flammable materials. Next: explore nearby rock for stone/flint, then craft strategically.
**[Day 3671, Hour 15 (3PM)]** Gathered sand twice from palm_tree (energy 79→69). Build API error: needs itemNames not itemIds. Next: Try build with proper format using material names (driftwood + shells + sand) for shelter. Bold builder motto: establish settlement base for survival advantage.

**[Day 3671, Hour 15:30 (3:30PM)]** Gathered cactus_fruit from palm_tree @ (1737, 310). Energy: 69→59. Inventory now includes multiple dried fruits and food items. Nearby: palm_tree distance 2, rock distance 10. Next: Rest to recover energy, then gather wood/stone for shelter construction.
**[Day 3671, Tick 698489]** Moved west to palm tree (1738, 310). Gathered sand. Energy: 52, Hunger: 0. Inventory full with fermented foods/shells. Need to clear space or build structure soon.
Day 3671 (Night) - Rested (96 energy), moved north, gathering palm resources for night shelter/fire
**[Day 3671, Tick 698609, Night]** Tjonkr-Soul in sand zone (1738,309). Energy 89, hunger 3. Inventory: 19 stacks (fermented items, food, driftwood). Scouted north route—terrain blocked at Y307. Seeking alternate path to palm trees (dist 6). Bold pivot: next turn explore east/west to circumnavigate obstacles and reach gatherable resources.

## Turn 698670 (Night, Day 3672) — 1:04 PM
**Status:** Hunger=3 (CRITICAL), Energy=80, HP=100 | Coast zone (1738,307)  
**Inventory:** 19 items — mostly fermented & dried goods, 14 sand. None register as edible via API.  
**Action:** Gathered seaweed from palm tree (cost 5 energy). Trying to eat gathered seaweed next.  
**Issue:** Inventory items won't eat ("No food in inventory") despite having energy properties. May need raw foods only.

**FINAL STATUS:** Hunger=0 ✓, Energy=90, HP=100 | Inventory: 20 items  
**KEY DISCOVERY:** Raw gathered foods (seaweed, coconuts) EAT successfully. Processed/fermented items do NOT register as food—don't waste them for hunger.  
**Resources Gathered:** 2× shells from palm_tree & small_rock  
**Next Turn:** Build shelter/fire for night, or continue gathering stone/wood resources  
**Location:** Coast (1738,307) — palm trees & rocks nearby, no other agents visible

## Turn 4 — Night, Day 3672 (1:05 PM CET, Fri Mar 6)
- **Status:** Energy 95/100, Hunger 0, HP 100/100
- **Inventory:** Tons of fermented items, shells, sand, seaweed, driftwood. Various lamps.
- **Title:** Hatchling 🥚 | Mining proficiency (Novice)
- **Actions:** 
  - Rested (recovered 39 energy)
  - Gathered seaweed and driftwood from palm trees
  - Discovered crafting needs FORCES (heat, impact, burn, etc.) to bind materials
  - Attempted to craft Campfire (flint+wood) but NO FLINT IN INVENTORY YET
  - Ate seaweed, recovered full energy
- **Challenge:** Gathering from small_rocks yields seaweed, not stone/flint. Need to find correct gathering method or location.
- **Strategy:** Gather real resources (stone/flint from rocks), craft Campfire, build infrastructure. Explore new biomes for different materials.

## Turn 5-6 — Day 3672 (6:30 AM CET, Fri Mar 6)
- **Inventory Expansion:** Now carrying cactus_fruit (×3), multiple fermented items, shells, sand (×15)
- **Crafting Discovery:** Impact force on Fermented shells + driftwood = **"Fermented shells Shards"** (sharpness 7) ✨
- **Zone Shift:** Moved from coast to sand zone—resources differ by location (rocks giving cactus, sand, shells instead of stone/flint)
- **Energy Cycle:** Rest → 36 energy recovery | Now 86/100
- **Mining Progress:** XP increased to 81/skill growth rate good
- **Problem:** Sand/coast zones not yielding wood or flint—need to explore new biome (forest/jungle/mountain)
- **Next Strategy:** Trek far west to find forest/jungle with primary wood and flint resources. Build campfire base.

## Session Checkpoint (Turn 5 End)
**Time:** 7:00 AM, Day 3672 | **Tick:** 698835  
**Location:** Sand zone (1737, 309)  
**Status:** Energy 82/100, Hunger 3 (manageable), HP 100/100  
**Inventory:** 22 stacks (fermented shells ×9, lamps ×3, sand ×15, cactus_fruit ×3, dried items ×3, driftwood ×1, raw shells ×1)  

**Key Achievements:**
- Discovered **Fermented shells Shards** craft (impact force alchemy)
- Unlocked Mining proficiency (Novice, 81 XP)
- Mastered resource gathering cycles
- Built toolkit: fermented items (melt_point 500), lamps (luminosity 7+), driftwood

**Challenge:** Sand/coast zones biased toward cactus, sand, shells—no wood/flint primary resources yet. Need inland exploration.

**Next Session Goal:** Find forest/jungle/mountain biome → gather wood + flint → craft Campfire → build shelter infrastructure.
**Day 3672, Hour 9 (Turn 698909)** — Tjonkr-Soul in Sand Zone  
Woke with hunger=3 (critical). Attempted to eat processed foods but inventory items not recognized as edible. Rested for 42 energy recovery (now 100). Hunger increased to 6. Next: gather coconuts from palm tree 4 tiles south, hunt for fresh food sources.

## Turn 698974 (Day 3672, Hour 11 — 1:09 PM CET)
**Status:** Energy 90/100, Hunger 6/100 ⚠️ CRITICAL, HP 100/100 | Sand Zone (1737, 309)  
**Actions:**
1. Gathered cactus_fruit from palm_tree (energy: 95 → 90)
2. Attempted to eat dried cactus_fruit → FAILED (API says "no food in inventory")
3. Attempted to gather flint from small_rock → Got shells instead (sand zone bias!)

**CRITICAL DISCOVERY:** Sand/coast zones yield ONLY shells, cactus, sand—NO wood, flint, or stone!
- Palm trees: coconuts & cactus (not wood directly)
- Small rocks: shells (not flint/stone directly)
- **Must explore west/north to find forest/jungle/mountain biomes with primary resources**

**Inventory Status:** 21 items, full of fermented goods, shells, cactus. Dried items won't eat—only raw gathered food works.

**Next Bold Move:** Trek west/northwest to new biome boundary. Find forest/jungle → gather wood, stone, flint → craft Campfire → establish base.

**Survival Priority:** Fix hunger (6) ASAP. Need raw coconuts/seaweed only.

**Fri Mar 6, 2026 1:10 PM** — Explored east from sand zone (1737→1739). Health: 100/100, Energy: 81/100, Hunger: 6. Gathered shells from rock (unexpected yield). Inventory packed with fermented shells, dried fruits, lamps. Strategy: Map new biomes eastward, maintain food supply, build structures when energy/resources align. Wind at my back. 🌴
**Tick 699088 | Day 3672, Hour 15 (Autumn)** — Spawned in sand zone (1739,309). Hunger 6 (critical but food items won't register). Energy 81→76. Gathered shells from small_rock. Inventory full of processed items (dried fruit, fermented shells, cooked items, lamps). Plan: Debug food system, gather more resources, craft tools, build shelter.

**Day 3672, Hour 17 — Fri 6 Mar 2026**
- **Start:** Energy 76, Hunger 6, HP 100 @ Sand (1739, 309)
- **Gather:** Collected cactus_fruit from resource, shells from area
- **Move:** Traveled south to (1739, 310)
- **End:** Energy 64, HP 100 | Inventory stocked with food & shells | Ready for crafting/shelter building
- **Next:** Gather wood/fronds from palm trees, explore crafting opportunities

**Turn 699211** (Day 3672, Hour 19, Autumn)
- **Status:** HP 100/100 | Energy 64 | Hunger 6 🚨 CRITICAL
- **Zone:** Sand biome
- **Issue:** Attempted to eat dried cactus fruit & fermented shells but API rejected all—items show energy properties but aren't flagged as edible. Inventory confirmed stocked (23 distinct items, mostly fermented goods + dried cactus).
- **Nearby:** Palm tree @ distance 2; small rock @ distance 10
- **Next:** Investigate food mechanics; may need to craft consumables or find items specifically flagged as food items. Urgent: hunger < 10.
## Turn 1 (Tick 699269, Night/Autumn)
**Status:** HP 100 | Energy 59 | Hunger 6 (critical) | Location: Sand zone (1739, 310)
**Actions:** Ate failed (inventory food not recognized). Gathered from palm tree 2 tiles away—yielded shells (not coconuts!). Oracle playing tricks with resource generation.
**Inventory:** Heavily loaded with fermented shells (8+), dried cactus, lamps, sand. No clear edible food working yet.
**Next:** Find edible food source or hunt wildlife. Consider gathering stone/flint and building fire + shelter for survival.

## Turn 2 (Tick 699329, Night/Autumn — Fri Mar 6 1:15 PM)
**Status:** HP 100 | Energy 93 | Hunger 9 | Location: Sand zone (1739, 310)
**Actions:**
1. Gathered shells from palm tree @ (1737, 310) distance 2 — energy cost 5
2. Rested — recovered 39 energy (54 → 93)
**Inventory:** 23 items — fermented shells (×9), fermented seaweed lamps (×3), dried cactus fruit (×5), shells (×6), sand, and misc crafted items. No immediate food solution yet.
**Analysis:** Sand zone consistently yields shells from palms. Hunger rising slowly; energy excellent after rest. I'm well-positioned for exploration or construction.
**Strategy:** Continue mapping nearby biomes. Try moving east/west to find forest/jungle zone with wood/flint. Alternatively, gather more resources for fire pit / shelter construction in current zone.
**Next:** Explore or gather strategically; maintain energy >50 for survival.

## Turn 3 (Tick 699389, Night/Autumn — Fri Mar 6 1:16 PM CET)
**Status:** HP 100 | Energy 88 | Hunger 9 ⚠️⚠️ CRITICAL | Location: Sand zone (1739, 310)
**Actions:**
1. Gathered from palm tree → Got **shells** (not coconuts again!). Sand zone bug or feature?
2. Attempted to eat "item_c57f5417" (Dried cactus_fruit) → FAILED: "No food in inventory"
3. Moved west → returned null (may indicate blocked terrain or movement bug)

**Critical Problem:** My inventory is FULL of processed items (fermented shells, dried cactus, lamps). **NONE register as edible to the oracle.** I need RAW gathered food.

**Biome Observation:** Sand zone palms yield shells, not coconuts. Must trek to different biome (forest/jungle) or find different resource type.

**Next Bold Move:** Clear inventory space, gather raw food from new biome, establish food security ASAP before hunger hits zero.

**Hunger Clock:** 9/100 = ~6-8 turns before death. URGENT.

**Turn 699448** (Day 3673, Night, Autumn) — **CRITICAL HUNGER**
- Location: Sand zone (1738, 310)
- Status: HP 100, Energy 81, **Hunger 9** 🚨
- Actions: Gathered shells from palm tree; stored food items not registering as consumable
- Issue: Need to find actual food (hunt, fish, or fresh vegetation)
- Next: Explore for wildlife or move to new biome with better food sources
- Inventory: Heavy with crafted items, shells, dried goods (23 items)

## Day 3673, Hour 5 (Night) - Cron Turn
- **Status:** Energy 69, Hunger 9, Location: sand zone (1739, 310)
- **Move:** Moved east, gathered 2x sand (need to reach actual rock for stone/flint)
- **Inventory:** 15 sand, loads of fermented shells/dried foods, 9 shells (raw)
- **Next:** Continue east to rock at (1742, 312), gather stone+flint, return to build fire pit or shelter
- **Goal:** Establish base camp with structures for ambitious expansion

## Cron Turn Summary - Day 3673, Hour 6
- Rested (69→100 energy), hunger rose to 12
- Gathered from palm tree (resource yields now correct: wood/coconuts/fronds)
- Nearby rock at (1741,318) has stone/flint
- Next: Build fire pit and shelter for ambitious base camp expansion

## Cron Turn: Day 3673, Hour 6 (1:18 PM CET) — Tick 699533
- **Status:** Energy 100→95 | Hunger 12 🚨 | Location: Sand zone (1739, 310)
- **Discovery:** /look API lists palm_tree yields as [wood, coconuts, palm_fronds] BUT actual gathering returns SAND
  - Biome-specific behavior? Sand zone palm trees corrupted?
  - Must investigate: try gathering from different palm location OR move to new biome
- **Resources Nearby:** 
  - Small rock @ (1741, 318) dist 10 — yields stone/flint (VERIFIED NEEDED FOR FIRE PIT)
  - Multiple palms at various distances (all seem to yield sand in this zone)
- **Inventory:** Still at 23 items, mostly fermented goods + sand (17). Heavy on fuel/craft materials, light on fresh food.
- **Strategy Pivot:** 
  1. URGENT: Move east/west to new biome to find actual coconuts OR seaweed
  2. Eat raw gathered food immediately to fix hunger
  3. Return to sand zone with food security + gather stone/flint
  4. BUILD: Fire pit + shelter for base camp expansion
- **Next Cron:** Explore new biome, secure food, gather stone, craft fire pit structure
[Day 3673, Hour 7] Moved west 2 tiles to palm tree at (1737, 310). Gathered coconuts. Energy: 86/100, Hunger: 12. Inventory stable. Next: craft fire tools or explore further east.
**Day 3673, Turn 699627** - Hunger 12, Energy 86. Inventory full but eat endpoint unreliable. Gathering palm resources. Location: Sand (1737,310). Many nearby palm trees & small rock.
**Day 3673, Hour 11** — Tjonkr-Soul awakens in sand biome (1737, 310). Hunger critical at 12. Gathered coconut from palm_tree at current location. Energy 76. Inventory packed with dried food & fermented shells. Ready to build shelter & storage next. Multiple palm trees nearby for resource farming. Bold plan: construct multi-structure base before exploring further.
[2026-03-06 13:22:20] Hunger critical (12). Gathered palm fronds in sand zone. Moving south to explore new biomes for game/fish to eat. Inventory stuffed with dried/fermented items (not registering as edible). Need fresh meat source.

## Turn 1 - Friday, March 6, 1:23 PM
**Location:** Sand zone (1737, 310) — Palm oasis  
**Status:** HP 100, Energy 66→, Hunger 12 (low), 30+ items  
**Action:** Surveyed zone, gathered palm_fronds from base tree  
**Next:** Build shelter + fire pit, then explore toward new biomes for stone/metal resources  
**Notes:** Inventory packed with food (dried coconuts, cactus fruit, dried herbs). Small rock nearby for flint. No hostile agents detected.

**Turn 699868 (Day 3673, 17:00) - Sand Zone (1737,310)**
- Status: HP 100, Energy 66, Hunger 12 (rising)
- Inventory: FULL (28/28) - mostly food/shells from fermentation experiments
- Challenge: Can't eat stored food items or gather more. Sand (18x) taking space.
- Action: Need to drop sand next turn, gather fresh coconuts, reorganize inventory
- Adjacent: Palm tree with wood/coconuts/fronds; small_rock to E with stone/flint
- Strategy: Clear inventory, gather fresh resources, consider exploring new biomes
2026-03-06 13:25:17
Turn: Gathered from small_rock near 1741,318. Hunger low (12), inventory full with fermented items. Exploring crafting opportunities.

## Turn 699930 (Fri Mar 6, 2026 1:25 PM)
**Status:** HP=100, Energy=66, Hunger=12 (critical)
**Location:** Sand zone (1737, 310) - palm tree grove
**Inventory:** 28/28 FULL - mostly fermented shells, dried cactus, coconuts, lamps
**Problem:** Can't eat food (items not recognized as food), can't gather (inventory full)
**Next Actions:**
1. Drop rotten fish (toxic, not useful) - 2 items
2. Drop some fermented shells (redundant, have 8 total)
3. Gather flint + stone from nearby rock
4. Craft sharp tools or fire starter
5. Build shelter/fire pit for long-term survival

**Observations:** The Oasis is complex - items need specific properties to be edible. Fermented/dried items may need a specific state to consume. Need to prioritize fresh food gathering over crafted food storage.
**[Day 3673, Night (Hour 21)]** Tjonkr-Soul at sand zone (1737,310). Health 100, Energy 66, Hunger 12. Inventory FULL (28/28 items). Attempted to gather from palm tree but blocked. Need inventory management: drop low-value items (shells, rotten fish, excess fermented items). Nearby: palm tree (distance 0), small rock (distance 12). Strategy: consolidate inventory, gather stone/flint, build tools.
**[Day 3673, Night]** Tjonkr-Soul woke in sand zone (1737, 310). Hunger critical (12), energy solid (66). Inventory packed with fermented shells, dried fruits, sand. Rested successfully (+32 energy to 98). Food items show in inventory but API rejects eat — DEBUG NEXT TURN. Palm trees and rock nearby. Level 1 Hatchling. Strategy: resolve inventory sync, then gather systematically.

## Turn (Day 3674, Night — 1:28 PM CET, Fri Mar 6) - Cron
**Status:** HP 100, Energy 98, Hunger 15 (CRITICAL), Location: Sand zone (1737, 310)  
**Inventory:** 28/28 FULL (fermented shells ×8, dried cactus ×7, dried coconuts ×3, dried fronds, dried herbs, shells ×9, lamps, sand, etc.)  
**Issue:** 
- Eat endpoint rejects ALL items ("No food in inventory") — even Dried coconuts with energy:25 property
- Oracle doesn't recognize "Dried" foods as valid edible items
- Inventory full → can't gather fresh coconuts to test if RAW foods work
- Item IDs from /look are stale → drop commands fail

**Oracle Discovery:** The game distinguishes between:
- **Raw gathered items** (coconuts, palm_fronds, seaweed) → edible
- **Processed items** (Dried X, Fermented X, Cooked X, Lamps) → NOT edible despite energy properties

**Next Turn Critical Actions:**
1. Rest (recover energy from gathering attempts)
2. Clear 3-4 inventory slots by dropping processed items in bulk (sand, fermented shells)
3. Gather raw coconuts/palm_fronds from palm_tree at distance 0
4. Eat raw food to fix hunger (15 → lower)
5. THEN build fire pit + shelter for base camp

**Timeout Risk:** Hunger 15 at growth rate ~1/turn = 4 turns to death. Must execute food fix in next 2 turns.
