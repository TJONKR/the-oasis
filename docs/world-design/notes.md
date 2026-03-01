What's Built vs What's Needed                                                                                                                                                                                                    
                                                                                                                                                                                                                                   
  Here's the picture after going through everything:                                                                                                                                                                               
                                                                                                                                                                                                                                   
  Already Solid                                                                                                                                                                                                                    
                                                                                                                                                                                                                                   
  ┌─────────────────────────────────────────────┬──────────┐
  │                   System                    │  Status  │                                                                                                                                                                       
  ├─────────────────────────────────────────────┼──────────┤
  │ World Grid (13x13 tiles)                    │ Complete │
  ├─────────────────────────────────────────────┼──────────┤
  │ Weather (physics-based atmosphere)          │ Complete │
  ├─────────────────────────────────────────────┼──────────┤
  │ Survival (energy, food, temperature)        │ Complete │
  ├─────────────────────────────────────────────┼──────────┤
  │ Zone Evolution (8 zones, 5 levels each)     │ Complete │
  ├─────────────────────────────────────────────┼──────────┤
  │ World Master (LLM narrative + consequences) │ Complete │
  ├─────────────────────────────────────────────┼──────────┤
  │ Exploration (discover/claim/build)          │ Complete │
  ├─────────────────────────────────────────────┼──────────┤
  │ Ecosystem (soil/water/biodiversity)         │ Complete │
  ├─────────────────────────────────────────────┼──────────┤
  │ World Events (meteors, festivals, etc.)     │ Complete │
  └─────────────────────────────────────────────┴──────────┘

  What's Missing for Real Exploration & Survival

  The design docs paint a much richer picture than what's actually wired up. Here are the gaps:

  1. Material Properties & Combination Engine — The big one. The design describes ~53 raw materials with 12 physical properties (hardness, flammability, toxicity...) and a combination engine where agents apply forces (heat,
  impact, cut, dissolve...) to discover transformations. First discoverer gets naming rights. This is the core discovery loop and it's not implemented.

  2. Tool Tier Gating — Design says gathering is tiered: bare hands (sticks, berries) → stone tools (ore, herbs) → metal tools (gems, rare minerals) → proficiency + conditions (pearls, obsidian). Currently gathering doesn't
  enforce tool requirements.

  3. Temperature/Fire Model — 300° wood ignition, 700° charcoal fire for copper, 800° iron smelting, 1200° glass. This progression from campfire → forge → master furnace gates all crafting. Not implemented.

  4. Knowledge Mortality — Design says knowledge lives ONLY in agent minds, teaching degrades 20% per generation, scrolls are flammable physical items. If the last expert dies and scrolls burn, that knowledge is permanently
  lost. The current knowledge system exists but doesn't enforce the mortality/fragility layer.

  5. Food Spoilage — Design specifies decay timers (berries 24h, fish 12h, bread 72h). Basic eating exists but spoilage isn't enforced.

  6. Ecosystem → Resource Integration — Ecosystem tracks soil/water/biodiversity per zone, but this doesn't actually influence what spawns when agents gather. The multiplier exists in code but isn't wired into the resource
  spawn loop.

  7. Biome-Specific Mechanics — Discovered tiles have biomes (forest, plains, swamp...) stored in data, but biome type doesn't affect what you find or what grows there.

  8. NPC Action Execution — World Master issues directives to NPCs (move, gather, teach) but they're never actually executed. NPCs sit idle.

  9. Danger Encounters — World Master can flag zones as dangerous, but there's no encounter/consequence system beyond a flat energy cost.

  10. Travel Mechanics — Movement exists (walk N/S/E/W) but there's no travel time, distance cost, or route-based exploration (caravans, ferries, paths vs wilderness).

  Priority Order for Exploration + Survival

  If the goal is making exploration and survival feel real, I'd build in this order:

  1. Material Properties + Combination Engine — This IS the game. Without it, agents just gather generic items and trade coins. With it, they discover smelting, create tools, unlock new tiers.
  2. Tool Tier Gating — Makes exploration progression meaningful. Can't mine deep resources without crafted tools.
  3. Temperature/Fire Model — Gates technology progression naturally. Agents must figure out how to make fire → charcoal → forge.
  4. Food Spoilage + Cooking — Creates urgency and specialization. Some agents become cooks, others forage.
  5. Ecosystem ↔ Resource Wiring — Over-gathering has real consequences. Zones die. Agents must steward resources or starve.
  6. Knowledge Mortality — Makes every discovery precious. Creates emergent teaching economy and scroll-preservation culture.

  Want me to plan out the implementation of any of these? The combination engine + material properties would be the biggest lift but also the highest impact.