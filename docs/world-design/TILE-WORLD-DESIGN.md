# Tile World Design — Composable Element System

> From painted backdrops to a living, buildable world.
> Every tile means something. Every element connects to a mechanic.

## The Concept

Replace the current system (one 256x256 painting per world cell) with a **composable sub-tile grid**. The world is built from small, reusable elements — the same grass tile under the village is the same grass tile in the meadow. A house isn't one image; it's walls + roof + door + floor tiles composed on top of grass. Zones evolve by gaining and losing elements, not by swapping a single picture.

---

## Grid Architecture

### Logical Grid (Game Mechanics)
- **13x13 cells** — unchanged
- Each cell is a zone or wilderness terrain
- Agents move between cells, gather, craft, trade — all stays the same

### Visual Sub-Grid (Rendering)
- Each cell subdivides into **4x4 sub-tiles**
- Total visual grid: **52x52 sub-tiles**
- Sub-tile size: **64x64 pixels** (rendered at 256x256 per cell)
- Each sub-tile holds one ground element + optional overlay elements

### Scale Reference
| Thing | Sub-tiles | Pixels |
|-------|-----------|--------|
| Single grass patch | 1x1 | 64x64 |
| Small bush or rock | 1x1 | 64x64 |
| Tree canopy | 1x1 to 2x2 | 64-128px |
| Market stall | 1x2 | 64x128 |
| Small house | 2x2 | 128x128 |
| Large building | 2x3 or 3x3 | 128-192px |
| Lighthouse / Clock tower | 2x3 | 128x192 |
| Full zone cell | 4x4 | 256x256 |

---

## Layer System

Each sub-tile position renders in 4 layers, bottom to top:

### Layer 0 — Ground
The base terrain. Every position has exactly one ground tile.
Grass, dirt, sand, stone, water, snow, cave floor, wood floor.

### Layer 1 — Nature & Terrain Features
Natural elements placed on top of ground. Trees, rocks, flowers, mushrooms, crystal formations, water features. Can be empty.

### Layer 2 — Structures & Objects
Built things. Walls, roofs, furniture, crafting stations, market stalls, fences, paths. Can be empty.

### Layer 3 — Effects & Overlays
Weather particles, time-of-day lighting, glowing effects, smoke, sparkles. Applied dynamically, never baked into tiles.

---

## Complete Element Catalog

### GROUND TILES (21 elements)

The foundation. Every sub-tile has exactly one ground type. These tile seamlessly — multiple variants per type prevent repetition.

| # | Element | Variants | Mechanics | Description |
|---|---------|----------|-----------|-------------|
| G01 | **Grass — light** | 3 | Default ground, most zones | Bright green meadow grass with small wildflowers |
| G02 | **Grass — medium** | 3 | Forest/village areas | Deeper green, slightly longer blades |
| G03 | **Grass — dark/lush** | 2 | Garden, fertile areas | Rich dark green, thick growth, indicates high soil fertility |
| G04 | **Dirt — dry** | 3 | Paths, cleared land | Packed brown earth, building foundation |
| G05 | **Dirt — muddy** | 2 | Rain-affected areas | Wet brown with puddles, appears during rain weather |
| G06 | **Sand — dry** | 3 | Beach, desert edges | Warm golden sand with subtle wind ripples |
| G07 | **Sand — wet** | 2 | Shoreline, tide zone | Darker sand near water, reflective surface |
| G08 | **Stone — rough** | 3 | Cave, mountain, ruins | Natural gray stone surface, unworked |
| G09 | **Stone — cobble** | 2 | Village paths, market plaza | Hand-laid cobblestones, warm gray-brown |
| G10 | **Stone — ornate** | 2 | Library, tower, high-level zones | Carved/tiled stone floor, patterns |
| G11 | **Water — shallow** | 2 | Ponds, streams, tide pools | Translucent blue-green, rocks visible underneath |
| G12 | **Water — deep** | 2 | Ocean, underground lakes | Dark teal-blue, no bottom visible |
| G13 | **Water — flowing** | 2 | Rivers, streams | Animated directional flow lines, white highlights |
| G14 | **Snow — fresh** | 2 | Winter weather, mountain tops | White with blue shadows, soft drifts |
| G15 | **Snow — packed** | 2 | Trampled areas in winter | Compressed, slightly gray, footprint hints |
| G16 | **Cave floor — dark** | 3 | Cave interior | Very dark gray-brown stone, damp sheen |
| G17 | **Cave floor — crystal-veined** | 2 | Cave interior (deep) | Dark stone with glowing purple/blue crystal veins |
| G18 | **Wood floor — rough** | 2 | Workshop, basic buildings | Raw wood planks, knots visible, gaps between boards |
| G19 | **Wood floor — polished** | 2 | Library, high-level buildings | Dark polished wood, smooth grain, reflective |
| G20 | **Marsh/swamp** | 2 | Between water and land | Dark green-brown, standing water patches, reeds |
| G21 | **Scorched earth** | 2 | Wildfire aftermath, forge area | Blackened ground, ash, ember remnants |

**Total ground tiles: ~48 images** (21 types x ~2.3 avg variants)

---

### TRANSITION TILES (16 masks)

Instead of unique art per terrain pair, use **alpha masks** that composite one terrain over another. One set works for ALL terrain pairs.

The 16-tile bitmask system: check 4 cardinal neighbors, generate a 4-bit index (0-15). Each index maps to a mask shape.

| # | Mask | Shape | Usage |
|---|------|-------|-------|
| T01 | **Isolated** | Full rounded square | Terrain surrounded by different type |
| T02 | **North edge** | Open top, rounded bottom | Terrain continues north only |
| T03 | **East edge** | Open right, rounded left | Terrain continues east only |
| T04 | **North+East corner** | Open top-right corner | Terrain continues N and E |
| T05 | **South edge** | Open bottom, rounded top | Terrain continues south only |
| T06 | **North+South corridor** | Vertical strip | Terrain continues N and S |
| T07 | **East+South corner** | Open bottom-right | Terrain continues E and S |
| T08 | **North+East+South** | Open right side | Terrain continues N, E, S |
| T09 | **West edge** | Open left, rounded right | Terrain continues west only |
| T10 | **North+West corner** | Open top-left | Terrain continues N and W |
| T11 | **East+West corridor** | Horizontal strip | Terrain continues E and W |
| T12 | **North+East+West** | Open top | Terrain continues N, E, W |
| T13 | **South+West corner** | Open bottom-left | Terrain continues S and W |
| T14 | **North+South+West** | Open left side | Terrain continues N, S, W |
| T15 | **East+South+West** | Open bottom | Terrain continues E, S, W |
| T16 | **All sides** | Full fill, no rounding | Terrain continues all directions |

**Total transition masks: 16 images** (reused for every terrain pair)

**Precedence order** (higher overlays on lower):
```
water < marsh < sand < dirt < grass < snow < stone < cave floor < wood floor
```

---

### NATURE ELEMENTS (30 elements)

Organic, living things placed on Layer 1. Each connects to gameplay.

| # | Element | Size | Mechanics | Zones |
|---|---------|------|-----------|-------|
| N01 | **Oak tree** | 1x1 | Woodcraft gathering, shade | Village, wilderness |
| N02 | **Pine tree** | 1x1 | Woodcraft gathering | Mountain areas, forest |
| N03 | **Willow tree** | 1x2 | Resting spot (+energy regen) | Garden, pond edges |
| N04 | **Cherry blossom** | 1x1 | Garden beauty, petal dust source | Garden |
| N05 | **Palm tree** | 1x1 | Beach atmosphere, driftwood source | Beach |
| N06 | **Dead tree** | 1x1 | Ecosystem degradation indicator | Anywhere (low health) |
| N07 | **Tree stump** | 1x1 | Previous woodcraft, regrowth possible | Anywhere |
| N08 | **Green bush** | 1x1 | Filler vegetation, exploration cover | Everywhere |
| N09 | **Berry bush** | 1x1 | Herbalism gathering — food source | Garden, village, wilderness |
| N10 | **Wildflower patch** | 1x1 | Biodiversity indicator, herbalism | Meadows, garden |
| N11 | **Rose garden** | 1x1 | Petal Dust gathering (garden lvl 2+) | Garden |
| N12 | **Tall grass / reeds** | 1x1 | Exploration cover, marsh edges | Marsh, pond edges |
| N13 | **Mushroom cluster** | 1x1 | Herbalism gathering, cooking ingredient | Forest, cave entrance |
| N14 | **Glowing mushroom** | 1x1 | Night light source, cave atmosphere | Cave |
| N15 | **Herb patch** | 1x1 | Herbalism gathering, cooking ingredient | Garden, forest |
| N16 | **Vine / ivy** | 1x1 | Wall covering, overgrowth | Old buildings, ruins |
| N17 | **Lily pad** | 1x1 | Water decoration, pond marker | Ponds, garden water |
| N18 | **Seaweed / kelp** | 1x1 | Shallow water decoration | Beach, coast |
| N19 | **Coral formation** | 1x1 | Beach ecosystem, sea glass source | Beach (underwater) |
| N20 | **Small rock** | 1x1 | Mining (low-level), filler | Everywhere |
| N21 | **Boulder** | 1x1 | Mining, path blocker | Mountain, cave entrance |
| N22 | **Crystal formation** | 1x1 | Crystal gathering, luminous at night | Cave |
| N23 | **Ore vein** | 1x1 | Iron Ore gathering (mining) | Cave walls |
| N24 | **Gemstone deposit** | 1x1 | Gemstone gathering (rare, mining) | Deep cave |
| N25 | **Fossil in rock** | 1x1 | Fossil gathering (epic, mining) | Cave |
| N26 | **Moss-covered stone** | 1x1 | Age indicator, atmosphere | Forest, ruins |
| N27 | **Fallen log** | 1x1 | Woodcraft, sitting spot | Forest |
| N28 | **Memory seed sprout** | 1x1 | Memory Seed gathering (garden) | Garden |
| N29 | **Dew-drop flower** | 1x1 | Dew Drop gathering (rare, garden) | Garden (dawn) |
| N30 | **Shell bed** | 1x1 | Shell gathering (beach) | Beach |

**Total nature tiles: ~45 images** (30 types, some with 2 variants)

---

### STRUCTURE ELEMENTS — BUILDINGS (22 elements)

Walls, roofs, doors — the pieces that compose buildings. A small cottage = 4 wall tiles + 4 roof tiles + 1 door. A larger building uses more.

| # | Element | Size | Description |
|---|---------|------|-------------|
| S01 | **Wood wall — horizontal** | 1x1 | Timber plank wall, horizontal grain |
| S02 | **Wood wall — vertical** | 1x1 | Timber plank wall, vertical grain |
| S03 | **Wood wall — corner** | 1x1 | Corner joint piece, 90-degree angle |
| S04 | **Stone wall — horizontal** | 1x1 | Cut stone blocks, mortared |
| S05 | **Stone wall — vertical** | 1x1 | Cut stone blocks, vertical face |
| S06 | **Stone wall — corner** | 1x1 | Stone corner piece |
| S07 | **Brick wall** | 1x1 | Red-brown brickwork (high-level buildings) |
| S08 | **Thatched roof** | 1x1 | Straw/reed roof, basic buildings (lvl 0-2) |
| S09 | **Tile roof — terracotta** | 1x1 | Clay tile roof, mid-level buildings (lvl 2-4) |
| S10 | **Slate roof** | 1x1 | Dark stone roof, high-level buildings (lvl 4-5) |
| S11 | **Roof peak** | 1x1 | Ridge line / apex of roof |
| S12 | **Wood door** | 1x1 | Simple wooden door, closed |
| S13 | **Stone archway** | 1x1 | Arched entrance, grand buildings |
| S14 | **Window — shuttered** | 1x1 | Wood shutters, basic |
| S15 | **Window — glass** | 1x1 | Glass panes, warm light glow at night |
| S16 | **Window — stained glass** | 1x1 | Colored glass, library/tower |
| S17 | **Chimney** | 1x1 | Stone chimney, smoke particles when active |
| S18 | **Balcony / overhang** | 1x1 | Upper floor extending out |
| S19 | **Tower segment** | 1x1 | Circular stone tower wall section |
| S20 | **Tower top / battlement** | 1x1 | Crenellated tower top |
| S21 | **Greenhouse glass** | 1x1 | Transparent greenhouse panel (garden) |
| S22 | **Dock / pier plank** | 1x1 | Wooden pier section over water (beach) |

**Total structure tiles: ~26 images** (22 types, some with variants)

---

### FUNCTIONAL OBJECTS (32 elements)

Interactive objects that connect directly to game mechanics. Layer 2.

#### Crafting & Production

| # | Element | Size | Mechanics | Zone |
|---|---------|------|-----------|------|
| F01 | **Forge / furnace** | 1x1 | Crafting station — metalwork. Animated fire when active | Workshop |
| F02 | **Anvil** | 1x1 | Crafting station — metalwork tools | Workshop |
| F03 | **Workbench** | 1x1 | General crafting surface | Workshop |
| F04 | **Loom** | 1x1 | Fabric crafting (Fabric Scrap → items) | Workshop, village |
| F05 | **Cauldron** | 1x1 | Cooking station. Bubbles when active | Workshop, village |
| F06 | **Alchemy table** | 1x1 | Experiment station — property discovery | Workshop, tower |
| F07 | **Woodworking bench** | 1x1 | Woodcraft station | Workshop, village |
| F08 | **Kiln** | 1x1 | Heat source for cooking, pottery | Workshop |

#### Knowledge & Learning

| # | Element | Size | Mechanics | Zone |
|---|---------|------|-----------|------|
| F09 | **Bookshelf — tall** | 1x1 | Knowledge storage, scholarship XP | Library |
| F10 | **Bookshelf — small** | 1x1 | Fewer books, lower-level library | Library |
| F11 | **Reading desk** | 1x1 | Study spot — read books, learn properties | Library |
| F12 | **Scroll rack** | 1x1 | Scroll storage and inscription spot | Library |
| F13 | **Lectern / podium** | 1x1 | Teaching spot — knowledge transfer | Library |
| F14 | **Globe** | 1x1 | Exploration knowledge, zone discovery hints | Library (lvl 3+) |

#### Commerce & Trade

| # | Element | Size | Mechanics | Zone |
|---|---------|------|-----------|------|
| F15 | **Market stall** | 1x2 | Trading interface — buy/sell items | Market |
| F16 | **Auction podium** | 1x1 | Player-to-player market listings | Market (lvl 3+) |
| F17 | **Weighing scale** | 1x1 | Commerce atmosphere, price checking | Market |
| F18 | **Treasure display** | 1x1 | Shows rare items for sale | Market (lvl 4+) |
| F19 | **Coin chest** | 1x1 | Economy indicator, bank spot | Market |

#### Storage & Resources

| # | Element | Size | Mechanics | Zone |
|---|---------|------|-----------|------|
| F20 | **Chest — wooden** | 1x1 | Personal storage | Any building |
| F21 | **Chest — reinforced** | 1x1 | Shared storage (granary project) | Village |
| F22 | **Barrel** | 1x1 | Liquid/food storage, decoration | Village, market |
| F23 | **Crate** | 1x1 | Goods storage, stacking decoration | Market, workshop |
| F24 | **Sack / grain bag** | 1x1 | Food storage, granary indicator | Village |

#### Utility & Special

| # | Element | Size | Mechanics | Zone |
|---|---------|------|-----------|------|
| F25 | **Well** | 1x1 | Water source, ecosystem water replenishment | Village |
| F26 | **Fountain** | 1x1 | Water feature, beauty, zone evolution indicator | Market, garden (lvl 3+) |
| F27 | **Mining cart** | 1x1 | Mining infrastructure, ore transport | Cave |
| F28 | **Mine rail** | 1x1 | Cart track, cave infrastructure | Cave |
| F29 | **Telescope** | 1x1 | Observation, signal detection | Tower |
| F30 | **Antenna array** | 1x1 | Signal Fragment gathering, communication | Tower |
| F31 | **Lightning rod** | 1x1 | Storm energy capture, tower power | Tower |
| F32 | **Enchantment circle** | 1x1 | Magical crafting, resonance experiments | Tower (lvl 3+) |

**Total functional object tiles: ~35 images** (32 types, some with active/inactive states)

---

### INFRASTRUCTURE (18 elements)

Paths, fences, bridges, lighting — the connective tissue of the world.

| # | Element | Size | Mechanics | Description |
|---|---------|------|-----------|-------------|
| I01 | **Dirt path** | 1x1 | Basic movement route | Worn earth trail, auto-tiles with neighbors |
| I02 | **Cobblestone path** | 1x1 | Improved path (village lvl 2+) | Laid stone, faster movement hint |
| I03 | **Stone path — ornate** | 1x1 | High-level path (lvl 4+) | Carved stone with border patterns |
| I04 | **Wood bridge** | 1x1 | Crosses water/gap (collective project) | Planks over water |
| I05 | **Stone bridge** | 1x1 | Permanent crossing (high-level) | Arched stone bridge section |
| I06 | **Wood fence** | 1x1 | Property boundary, garden border | Picket/rail fence, auto-tiles |
| I07 | **Stone wall — low** | 1x1 | Stronger boundary, field border | Half-height stone wall |
| I08 | **Iron fence** | 1x1 | High-level boundary (lvl 4+) | Wrought iron, ornate |
| I09 | **Gate — wood** | 1x1 | Entrance to fenced area | Hinged wooden gate |
| I10 | **Gate — iron** | 1x1 | Grand entrance (lvl 4+) | Ornate iron gate |
| I11 | **Lamp post** | 1x1 | Night light source, village/market | Warm glow radius at night |
| I12 | **Wall torch** | 1x1 | Interior/cave lighting | Flickering flame on bracket |
| I13 | **Hanging lantern** | 1x1 | Market/village string lights | Colorful paper/glass lanterns |
| I14 | **Signpost** | 1x1 | Zone direction indicator | Wooden arrow signs |
| I15 | **Ladder** | 1x1 | Vertical access, cave levels | Wood/rope ladder |
| I16 | **Stone stairs** | 1x1 | Level change, tower interior | Carved stone steps |
| I17 | **Rope bridge** | 1x2 | Cave chasm crossing | Swaying rope and plank bridge |
| I18 | **Mine cart rail** | 1x1 | Cave transport system | Iron rails on stone floor |

**Total infrastructure tiles: ~22 images** (18 types, paths/fences need auto-tile variants)

---

### DECORATIVE & AMBIENT (20 elements)

Atmosphere and character. These tell the story of the world.

| # | Element | Size | Mechanics | Description |
|---|---------|------|-----------|-------------|
| D01 | **Stone statue** | 1x1 | Monument project result, lore | Carved figure on pedestal |
| D02 | **Obelisk / monument** | 1x1 | Achievement marker, XP bonus zone | Tall stone pillar with runes |
| D03 | **Wooden bench** | 1x1 | Resting spot (+energy regen) | Sitting place, social gathering |
| D04 | **Campfire** | 1x1 | Heat source for cooking, light, warmth | Crackling fire with stone ring |
| D05 | **Banner — red** | 1x1 | Zone pride, market decoration | Fabric banner on pole |
| D06 | **Banner — blue** | 1x1 | Zone pride, tower/library | Fabric banner on pole |
| D07 | **Banner — green** | 1x1 | Zone pride, garden/village | Fabric banner on pole |
| D08 | **Clothesline** | 1x2 | Village life indicator | Hanging laundry between poles |
| D09 | **Weathervane** | 1x1 | Wind direction indicator (actual weather data) | Spinning arrow on rooftop |
| D10 | **Sundial** | 1x1 | Time display (actual game time) | Stone pedestal with gnomon |
| D11 | **Memorial stone** | 1x1 | Dead agent marker, lore | Engraved stone with name |
| D12 | **Bird bath** | 1x1 | Biodiversity indicator, garden beauty | Stone basin with water |
| D13 | **Beehive** | 1x1 | Ecosystem health indicator, garden | Straw hive on stand |
| D14 | **Scarecrow** | 1x1 | Garden/village protection charm | Straw figure on pole |
| D15 | **Fishing net** | 1x1 | Beach atmosphere, drying rack | Draped net on poles |
| D16 | **Rowboat** | 1x2 | Beach transport, decoration | Small wooden boat beached/docked |
| D17 | **Anchor** | 1x1 | Beach/harbor decoration | Iron anchor on ground |
| D18 | **Hay bale** | 1x1 | Village/farm atmosphere | Stacked golden hay |
| D19 | **Cart / wagon** | 1x2 | Village/market transport | Wooden cart with wheels |
| D20 | **Exotic carpet** | 1x1 | Market decoration, trade goods display | Colorful woven rug |

**Total decorative tiles: ~24 images** (20 types, banners are variants)

---

### COLLECTIVE PROJECT STRUCTURES (6 elements)

These appear when agents complete collective building projects. Larger than normal tiles.

| # | Element | Size | Mechanics | Description |
|---|---------|------|-----------|-------------|
| P01 | **Completed bridge** | 1x3 | Free movement between zones | Sturdy wood-and-stone bridge with railings |
| P02 | **Monument** | 2x2 | +25% XP bonus in zone | Grand stone monument with glowing runes |
| P03 | **Granary** | 2x2 | 10-slot shared community storage | Large wooden storehouse with grain silo |
| P04 | **Workshop upgrade** | 2x2 | -25% crafting cost | Enhanced forge with bellows and extra stations |
| P05 | **Library expansion** | 2x2 | +5 book capacity | New wing with tall shelves and reading nooks |
| P06 | **Watchtower** | 1x2 | Reveals adjacent zone info | Tall wooden tower with lookout platform |

**Total project tiles: ~6 images**

---

### WEATHER & TIME OVERLAYS (12 effects)

Layer 3 — applied dynamically, never baked into tiles.

| # | Effect | Type | Trigger |
|---|--------|------|---------|
| W01 | **Rain drops** | Particle overlay | Rain weather state |
| W02 | **Heavy rain** | Particle + darkening | Storm weather state |
| W03 | **Snow falling** | Particle overlay | Snow weather state |
| W04 | **Fog** | Semi-transparent white layer | Fog weather state |
| W05 | **Heat shimmer** | Wavy distortion effect | Heat wave consequence |
| W06 | **Night darkening** | Blue-tinted dark overlay | Night time (hours 21-4) |
| W07 | **Dawn/dusk glow** | Warm amber tint | Dawn (5-7) / Dusk (18-20) |
| W08 | **Firelight glow** | Warm radius around fire sources | Near torches, forges, campfires |
| W09 | **Crystal glow** | Purple/blue pulse radius | Near crystal formations |
| W10 | **Wildfire** | Orange-red flickering overlay | Wildfire consequence |
| W11 | **Plague miasma** | Green-tinted particle cloud | Plague consequence |
| W12 | **Earthquake cracks** | Overlay cracks on ground | Earthquake consequence |

**Total: procedural/CSS — no tile images needed**

---

### ECOSYSTEM STATE INDICATORS (6 elements)

Visual feedback for the ecosystem health system. These modify existing tiles.

| # | Indicator | Visual Effect | Trigger |
|---|-----------|--------------|---------|
| E01 | **Thriving** | Flowers bloom, colors saturated, butterflies | Health > 80 |
| E02 | **Healthy** | Normal appearance | Health 50-80 |
| E03 | **Stressed** | Slightly desaturated, fewer flowers | Health 30-50 |
| E04 | **Degraded** | Brown patches on grass, wilting plants | Health 10-30 |
| E05 | **Destroyed** | Dead plants, cracked ground, no resources | Health 0-10 |
| E06 | **Recovering** | New sprouts appearing, gradual color return | Health rising |

**Total: shader/filter effects — no tile images needed**

---

## Zone Composition Templates

Each zone occupies **2 cells = 8x4 or 4x8 sub-tiles** in the world grid. Here's what composes each zone at each evolution level.

### Library (Scholarship, Knowledge)

**Level 0 — Abandoned Room**
```
[stone-rough] [stone-rough] [stone-rough] [stone-rough]
[stone-rough] [reading-desk] [stone-rough] [stone-rough]
[stone-rough] [stone-rough] [bookshelf-sm][stone-rough]
[stone-rough] [stone-rough] [stone-rough] [stone-rough]
```
One dusty desk, one half-empty bookshelf. Cobwebs (overlay). Dim.

**Level 3 — Well-Stocked Library**
```
[wood-polish] [bookshelf]   [bookshelf]   [wood-polish]
[wood-polish] [reading-desk] [scroll-rack] [bookshelf]
[wood-polish] [lectern]     [globe]       [bookshelf]
[stone-ornate][lamp-post]   [stone-ornate][wood-door]
```
Multiple bookshelves, lectern for teaching, globe, warm lamp light. Carpeted center.

**Level 5 — Celestial Grand Library**
```
[stone-ornate][bookshelf]   [bookshelf]   [stained-glass]
[wood-polish] [enchant-circ][reading-desk] [bookshelf]
[wood-polish] [bookshelf]   [scroll-rack] [bookshelf]
[stone-ornate][statue]      [lectern]     [stone-archway]
```
Enchantment circle, stained glass, statue, grand archway entrance. Floating book particles.

---

### Village (Community, Building)

**Level 0 — Empty Clearing**
```
[dirt-dry]    [dirt-dry]    [grass-light] [grass-light]
[dirt-dry]    [signpost]    [grass-light] [small-rock]
[grass-light] [grass-light] [grass-light] [grass-light]
[grass-light] [grass-light] [dead-tree]   [grass-light]
```

**Level 3 — Bustling Village**
```
[tile-roof]   [tile-roof]   [cobble-path] [grass-light]
[wood-wall]   [wood-door]   [cobble-path] [well]
[wood-fence]  [garden-plot] [cobble-path] [cobble-path]
[grass-light] [hay-bale]    [lamp-post]   [bench]
```
Houses with terracotta roofs, cobblestone paths, well, gardens, lamp posts.

**Level 5 — Thriving Center**
```
[slate-roof]  [slate-roof]  [ornate-path] [fountain]
[brick-wall]  [glass-window][ornate-path] [ornate-path]
[iron-fence]  [rose-garden] [ornate-path] [banner-green]
[clock-tower] [clock-tower] [lamp-post]   [stone-archway]
```
Brick buildings, clock tower (2x2), fountain, iron fences, stained glass.

---

### Cave (Mining, Exploration)

**Level 0 — Dark Entrance**
```
[cave-dark]   [cave-dark]   [cave-dark]   [boulder]
[cave-dark]   [cave-dark]   [cave-dark]   [cave-dark]
[cave-dark]   [small-rock]  [cave-dark]   [cave-dark]
[stone-rough] [stone-rough] [cave-dark]   [cave-dark]
```

**Level 3 — Expansive Cavern**
```
[cave-crystal][crystal-form] [cave-dark]  [ore-vein]
[cave-dark]   [mine-rail]   [mine-rail]  [mine-cart]
[cave-dark]   [rope-bridge] [rope-bridge][gemstone-dep]
[cave-dark]   [glow-mushroom][water-shlw] [fossil]
```
Crystal veins glowing, mine cart track, rope bridge over underground water.

---

### Tower (Signals, Discovery)

**Level 0 — Crumbling Base**
```
[stone-rough] [stone-rough] [stone-rough] [grass-medium]
[stone-rough] [rubble]      [stone-rough] [grass-medium]
[stone-rough] [stone-rough] [vine]        [grass-medium]
[grass-medium][dirt-dry]     [grass-medium][grass-medium]
```

**Level 4 — Grand Sorcerer Spire**
```
[tower-top]   [tower-top]   [stone-ornate][telescope]
[tower-seg]   [tower-seg]   [enchant-circ][antenna]
[tower-seg]   [tower-seg]   [stone-ornate][lightning-rod]
[stone-ornate][stone-stairs] [stone-ornate][lamp-post]
```

---

### Market (Commerce, Trade)

**Level 0 — Empty Ground**
```
[dirt-dry]    [dirt-dry]    [dirt-dry]    [dirt-dry]
[dirt-dry]    [crate]       [dirt-dry]    [dirt-dry]
[dirt-dry]    [dirt-dry]    [dirt-dry]    [dirt-dry]
[dirt-dry]    [dirt-dry]    [dirt-dry]    [signpost]
```

**Level 3 — Prosperous Marketplace**
```
[cobble-path] [market-stall][market-stall][cobble-path]
[cobble-path] [cobble-path] [cobble-path] [scale]
[cobble-path] [market-stall][market-stall][cobble-path]
[cobble-path] [hang-lantern][auction-pod] [cobble-path]
```

---

### Workshop (Crafting, Production)

**Level 0 — Bare Floor**
```
[stone-rough] [stone-rough] [stone-rough] [stone-rough]
[stone-rough] [workbench]   [stone-rough] [stone-rough]
[stone-rough] [stone-rough] [stone-rough] [stone-rough]
[stone-rough] [stone-rough] [stone-rough] [stone-rough]
```

**Level 3 — Advanced Workshop**
```
[wood-floor]  [forge]       [anvil]       [stone-rough]
[wood-floor]  [workbench]   [alchemy-tbl] [wood-floor]
[wood-floor]  [loom]        [cauldron]    [wood-floor]
[wood-floor]  [barrel]      [crate]       [wood-door]
```

---

### Garden (Herbalism, Rest)

**Level 0 — Barren Soil**
```
[dirt-dry]    [dirt-dry]    [dirt-dry]    [dirt-dry]
[dirt-dry]    [dirt-dry]    [dirt-dry]    [dead-tree]
[dirt-dry]    [grass-light] [dirt-dry]    [dirt-dry]
[dirt-dry]    [dirt-dry]    [dirt-dry]    [small-rock]
```

**Level 4 — Magnificent Garden**
```
[grass-lush]  [cherry-tree] [rose-garden] [greenhouse]
[grass-lush]  [herb-patch]  [fountain]    [greenhouse]
[stone-path]  [memory-seed] [lily-pad]    [water-shlw]
[grass-lush]  [beehive]     [bench]       [bird-bath]
```

---

### Beach (Exploration, Treasure)

**Level 0 — Bare Shore**
```
[sand-dry]    [sand-dry]    [sand-dry]    [sand-dry]
[sand-dry]    [driftwood]   [sand-dry]    [shell-bed]
[sand-wet]    [sand-wet]    [sand-wet]    [sand-wet]
[water-shlw]  [water-shlw]  [water-deep]  [water-deep]
```

**Level 4 — Grand Seaside Port**
```
[sand-dry]    [market-stall][cobble-path] [lighthouse]
[sand-dry]    [fishing-net] [cobble-path] [lighthouse]
[dock-plank]  [dock-plank]  [dock-plank]  [anchor]
[water-shlw]  [rowboat]     [water-shlw]  [coral]
```

---

## How Mechanics Connect to Tiles

### Gathering → Resource Nodes Appear/Disappear
When a zone's resource pool spawns items, **resource node tiles appear** on the map (ore veins glow brighter, herb patches bloom, shell beds fill). When gathered, they visually deplete. When ecosystem health drops, nodes thin out.

### Crafting → Station Animations
When an agent crafts at a forge, the forge tile shows fire animation. Cauldron bubbles. Workbench shows sparks. The activity is visible to spectators.

### Ecosystem Health → Ground & Nature Changes
- **High health**: Lush grass (G03), wildflowers (N10), butterflies
- **Low health**: Grass fades to G01, dead trees (N06) replace living ones, flowers vanish
- **Destroyed**: Scorched earth (G21), no nature tiles, dust particles

### Weather → Layer 3 Effects
Rain adds W01 particles + mud ground tiles (G05) temporarily. Snow adds W03 + snow ground (G14). Fog adds W04 translucent overlay. Storm adds W02 + lightning near tower antenna.

### Zone Evolution → Tile Composition Changes
Level up = add structures, upgrade materials, add decoration. The composition template defines what's present at each level. Transitions are granular — when a zone hits level 3, specific tiles swap/add (e.g., dirt paths become cobblestone, a new bookshelf appears).

### Day/Night → Lighting Layer
Night: W06 darkens everything. Light sources (lamp posts, torches, crystal formations, forge fires) create warm radius glows (W08). Glowing mushrooms illuminate cave. Library candles cast amber light. The world feels alive at night.

### Collective Projects → New Structures Appear
When agents complete a bridge project, P01 tiles physically appear connecting two zones. Monument project places a P02 2x2 structure in the zone. Granary adds P03. These are real, visible changes.

### Agent Presence → Visible on Map
Agents appear as sprites on their current sub-tile. NPCs have fixed patterns (Sage near bookshelves, Ember near forge, Flint at market stalls). When agents gather, craft, or teach — the nearby functional tile animates.

---

## Tile Art Specification

### Style
- **SNES RPG pixel art** — Secret of Mana / Chrono Trigger aesthetic
- **Top-down with slight 3/4 overhead angle**
- **64x64 pixels** per sub-tile
- `image-rendering: pixelated` — no anti-aliasing

### Color Palette
Warm, earthy, autumnal — consistent across all tiles:
- Grass: #8BAC5A (light) → #6B8C3A (dark)
- Dirt: #C4985A → #9A7040
- Sand: #D4C090 → #B8A070
- Wood: #B07840 → #7A5230
- Stone: #808890 → #606068
- Water: #4AA8C0 → #3080A0
- Roof: #C05030 (terracotta)
- Crystal: #8060C0 → #A080E0 (glow)
- No pure black (min #1A1A2E) or pure white (max #F0E8D8)

### Lighting
- Light from upper-left
- Shadows fall lower-right
- 2-3 value shading per material
- Dark outlines on objects only, NOT on ground tiles

### Seamless Edges
Ground tiles MUST tile seamlessly in all directions. Edges match. No visible seams when the same tile type repeats.

---

## Element Count Summary

| Category | Types | Images (w/ variants) |
|----------|-------|---------------------|
| Ground tiles | 21 | ~48 |
| Transition masks | 16 | 16 |
| Nature elements | 30 | ~45 |
| Structure — building | 22 | ~26 |
| Functional objects | 32 | ~35 |
| Infrastructure | 18 | ~22 |
| Decorative / ambient | 20 | ~24 |
| Collective projects | 6 | ~6 |
| **TOTAL** | **165 types** | **~222 images** |

Plus weather/ecosystem effects done via CSS/Canvas — no images.

---

## Generation Strategy

### Phase 1 — Ground Tiles First
Generate all 21 ground types with variants. These are the foundation. Must tile seamlessly. Test tiling before proceeding.

### Phase 2 — Transition Masks
Generate or procedurally create the 16 bitmask transition shapes. Test with all ground pairs.

### Phase 3 — Nature Elements
Generate trees, plants, rocks, crystals. These overlay on ground — must have transparent backgrounds.

### Phase 4 — Structures & Objects
Generate building pieces, functional objects, infrastructure. Transparent backgrounds. Consistent perspective.

### Phase 5 — Decorative & Projects
Generate atmosphere tiles. These complete the visual vocabulary.

### Phase 6 — Compose the World
Define zone templates at each evolution level. Wire up the sub-tile renderer. Replace the old single-image system.

### Generation Approach
Each tile generated individually via Gemini as a separate image. Style consistency enforced through:
1. Shared color palette in every prompt
2. Reference tiles sent as multimodal context (first few tiles guide the rest)
3. Same art direction prompt prefix for every tile
4. Post-generation visual QA pass

---

## What Stays the Same

- **13x13 logical grid** — all game mechanics unchanged
- **Server.js** — no backend changes needed
- **Zone system** — zones still have levels, resources, activities
- **Ecosystem** — health still affects visuals (now through tile swapping)
- **Weather** — still atmospheric, now shown through layer 3 effects
- **Agent actions** — gather, craft, trade, teach — all unchanged

## What Changes

- **Tile renderer** — rewritten for sub-tile grid + layers
- **World grid data** — each cell gets a 4x4 sub-tile composition
- **Zone evolution** — composition templates replace single images
- **Asset pipeline** — ~222 small tiles replace ~78 large paintings
- **Minimap** — renders from sub-tile data instead of cell colors
- **Transitions** — bitmask system replaces CSS gradient blending
