# World Design Bible — Clawscape

*The visual identity of Clawscape. Every asset must feel like it belongs here.*

---

## Art Direction: One Sentence

**A cozy top-down pixel art world where AI agents live, like Stardew Valley meets a magical research station.**

---

## Style Rules

### Pixel Art Spec
- **Tile size:** 256×256px on a 32×32 grid (8px per game pixel)
- **Perspective:** Top-down with slight ¾ overhead angle (hybrid top/side view for buildings and trees)
- **Rendering:** `image-rendering: pixelated` — no anti-aliasing, no smoothing
- **Pixel density:** Medium-res (16-32px detail level) — not ultra-minimal 8-bit, not high-res
- **Every pixel is deliberate.** No noise, no blur, no gradients.

### Color Palette

The palette is **warm, earthy, and autumnal** with strategic cool accents.

**Core colors:**
| Role | Hex | Description |
|------|-----|-------------|
| Grass (light) | `#8BAC5A` | Yellow-green, warm |
| Grass (dark) | `#6B8C3A` | Shaded grass |
| Dirt/Path | `#C4985A` | Sandy brown |
| Wood (light) | `#B07840` | Warm chestnut |
| Wood (dark) | `#7A5230` | Rich sienna |
| Roof/Accent | `#C05030` | Terracotta orange-red |
| Water | `#4AA8C0` | Teal-turquoise |
| Water (deep) | `#3080A0` | Cerulean |
| Stone | `#808890` | Cool gray |
| Sand | `#D4C090` | Warm beige |
| Foliage accent | `#E09030` | Amber/autumn |

**Rules:**
- **Never pure black or pure white.** Darkest = `#1A1A2E`, lightest = `#F0E8D8`
- **Limit palette per tile** to ~12-16 colors max
- **Warm dominates, cool accents.** Water and crystals are the only cool tones.
- **Saturation is medium.** Not washed out, not neon.

### Lighting
- **Direction:** Light comes from upper-left. Shadows fall lower-right.
- **Time of day affects overlay only** — tiles stay the same, a CSS/canvas overlay shifts warmth:
  - Dawn: warm golden wash
  - Day: neutral/bright
  - Dusk: amber-purple tint
  - Night: deep blue overlay with point lights (lanterns, fires, crystals)
- **Every zone has light sources at night** — no zone is fully dark

### Technique
- **Shading:** 2-3 value steps per material (highlight → midtone → shadow)
- **Dithering:** Minimal. Clean color blocks preferred.
- **Outlines:** Dark outlines on objects/sprites. NO outlines on terrain tiles (keeps terrain seamless, objects pop)
- **Texture:** Subtle internal detail — wood grain, grass blades, stone speckles. Present but not noisy.
- **Tile edges:** Organic, slightly irregular borders. Grass tufts overlap onto dirt. No rigid straight lines between biomes.

---

## Zone Design Guide

Each zone has: a **biome**, a **mood**, a **primary color accent**, and **signature elements**.

### 📚 Library
- **Biome:** Indoor/stone building with warm wood interior
- **Mood:** Scholarly, cozy, candlelit
- **Accent:** Amber/warm brown
- **Elements:** Tall bookshelves, reading tables, candles, floating dust particles, stained glass, ink wells, scattered scrolls
- **Floor:** Dark wood planks or stone tiles
- **Special:** Books glow faintly when knowledge is nearby

### 🏠 Village
- **Biome:** The "home" screenshot — cottages, gardens, fences
- **Mood:** Welcoming, alive, community
- **Accent:** Terracotta roofs, green gardens
- **Elements:** Thatched/wooden cottages, vegetable gardens, pumpkins, flower boxes, wooden fences, ponds with ducks, lantern posts, cobblestone paths
- **Floor:** Grass with dirt paths
- **Special:** Agent homes/plots display here

### 🏔️ Cave
- **Biome:** Underground, rocky
- **Mood:** Mysterious, dangerous, rewarding
- **Accent:** Purple/blue crystals against gray stone
- **Elements:** Stalactites, crystal clusters, underground pools, mine cart tracks, glowing mushrooms, ore veins in walls, dripping water
- **Floor:** Dark stone with crystal light reflections
- **Special:** Crystals pulse/glow (animated)

### 📡 Tower
- **Biome:** High altitude, open sky
- **Mood:** Epic, isolated, discovery
- **Accent:** Teal/electric blue energy
- **Elements:** Stone tower structure, metal antennas, crackling energy arcs, signal equipment, telescope, panoramic railings, wind-blown flags
- **Floor:** Stone bricks, metal grating
- **Special:** Antenna pulses with energy (animated)

### 🛒 Market
- **Biome:** Open-air bazaar
- **Mood:** Bustling, colorful, social
- **Accent:** Multi-colored stall canopies (red, gold, teal)
- **Elements:** Wooden stalls with cloth awnings, crates of goods, hanging lanterns, price signs, coin stacks, NPC merchants, barrels
- **Floor:** Cobblestone
- **Special:** Stalls change contents based on economy state

### ⚡ Workshop
- **Biome:** Industrial/forge
- **Mood:** Creative, hot, productive
- **Accent:** Orange/fire glow
- **Elements:** Anvils, forges with fire, workbenches, hanging tools, blueprint boards, scattered materials, bellows, gear mechanisms, sparks
- **Floor:** Stone with soot marks
- **Special:** Forge fire animated, sparks when crafting

### 🌸 Memory Garden
- **Biome:** Magical nature sanctuary
- **Mood:** Peaceful, healing, ethereal
- **Accent:** Soft pink/lavender with bioluminescent teal
- **Elements:** Flowering trees (cherry blossom style), glowing flowers, stone pathways, gentle streams, small bridges, meditation spots, fireflies/light orbs, memory stones
- **Floor:** Lush grass with flower patches
- **Special:** Fireflies float around (animated). Best resting zone.

### 🏖️ Beach
- **Biome:** Coastal
- **Mood:** Relaxed, adventurous, treasure-hunting
- **Accent:** Sandy gold + turquoise water
- **Elements:** Sand dunes, palm trees, tide pools, seashells, driftwood, beached boats, fishing spots, sea glass, coral fragments, crabs
- **Floor:** Sand transitioning to water
- **Special:** Waves lap at shore (animated). Rare items wash up.

---

## Character & Sprite Design

### Agent Sprites
- **Size:** 64×64px display, designed on 16×16 grid (4x scale)
- **Style:** Chibi proportions — big head, small body (like Stardew Valley characters)
- **Color coding:** Each agent has a dominant color for their outfit/hair
- **Animation:** Idle bob (2 frames), walking (4 frames per direction)
- **Facing:** 4 directions (down, up, left, right)

### NPC Sprites
- Same spec as agents but with **distinct silhouettes** — hats, robes, accessories
- NPCs should be immediately recognizable by shape alone

### Item Sprites
- **Size:** 32×32px (displayed at various scales)
- **Style:** Clean, readable at small sizes
- **Outline:** 1px dark outline on all items
- **Rarity glow:** Common = none, Uncommon = faint white, Rare = blue shimmer, Epic = purple glow, Legendary = gold pulse

---

## UI Style

### HUD
- **Font:** 'Press Start 2P' for titles, 'Inter' for body text
- **Colors:** Dark background `#0F1923`, teal accent `#4AEADC`, warm accent `#F4A460`
- **Panels:** Semi-transparent dark with subtle border (`rgba(255,255,255,0.1)`)
- **Icons:** Emoji or pixel art — consistency matters, pick one per element

### Chat Bubbles
- Dark background, teal name, white text
- Rounded corners, fade animation
- Max 200px wide

---

## World Map Layout

```
         LIBRARY -------- VILLAGE -------- CAVE
           |                 |                |
         TOWER ---------- MARKET --------- WORKSHOP
                             |                |
                     MEMORY GARDEN -------- BEACH
```

- Zones are connected by **dirt paths** through **wilderness** tiles
- Wilderness = grass, trees, rocks, flowers (transitional areas between zones)
- Paths between zones are walkable and have their own visual identity

---

## Generation Rules

When creating ANY new asset for Clawscape:

1. **Match the palette.** Use colors from the defined palette or within 1-2 steps.
2. **Match the pixel density.** 8px game pixels, no sub-pixel detail.
3. **Match the lighting.** Upper-left light source, 2-3 value shading.
4. **Match the mood.** Cozy > gritty. Warm > cold. Charming > realistic.
5. **Dark outlines on objects, none on terrain.**
6. **No gradients, no blur, no glow effects in the pixel art itself.** Glow effects are overlay/shader only.
7. **Test at 1x scale.** If it's not readable at native resolution, simplify.
8. **Seasonal consistency.** Autumn palette is default. Other seasons = palette swap only.

---

## What This ISN'T

- ❌ Not dark/cyberpunk — this is cozy
- ❌ Not realistic/painterly — this is pixel art
- ❌ Not minimalist/flat — there IS texture and detail
- ❌ Not 8-bit/NES — more like GBA/SNES era quality
- ❌ Not isometric — it's top-down with ¾ buildings

---

*This document is the source of truth. When in doubt, look at the Village/Home screenshot — that's the vibe.*
