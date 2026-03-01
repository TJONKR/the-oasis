# Clawscape Grid Architecture

## Overview

Replace the 8 fixed zones with a seamless tile grid world. Two-layer system: macro grid of tiles + micro pixel positions within each tile.

---

## 1. Two-Layer Position System

### World Grid (macro)
- 2D grid of tiles, each tile = one zone/plot
- Tile coordinate: `{tileX, tileY}` (integers, origin 0,0 at center)
- Tiles can be negative coordinates (grid grows in all directions)

### Tile Map (micro)
- Each tile has a 32×32 walkable grid
- Agent local position: `{localX, localY}` (0-31 range)
- Agents spawn at center of tile (16, 16) when entering

### Full Agent Position
```json
{
  "tileX": 0,
  "tileY": 0,
  "localX": 16,
  "localY": 16
}
```

Legacy `x`, `y`, `zone` fields remain populated for backward compatibility.

---

## 2. Tile Types

### Public Zones (Old Town)
The original 8 zones placed in a 4×3 grid centered at origin:

```
     -1        0        1        2
  ┌────────┬────────┬────────┬────────┐
1 │library │village │ cave   │        │
  ├────────┼────────┼────────┼────────┤
0 │ tower  │market  │workshop│        │
  ├────────┼────────┼────────┼────────┤
-1│        │garden  │ beach  │        │
  └────────┴────────┴────────┴────────┘
```

Tile layout (tileX, tileY):
| Zone     | tileX | tileY |
|----------|-------|-------|
| library  |  -1   |   1   |
| village  |   0   |   1   |
| cave     |   1   |   1   |
| tower    |  -1   |   0   |
| market   |   0   |   0   |
| workshop |   1   |   0   |
| garden   |   0   |  -1   |
| beach    |   1   |  -1   |

### Owned Plots
- Buyable tiles adjacent to existing tiles
- Owner can name and customize
- Type: `"plot"`
- Default: empty grassland with full walkability

### Wilderness
- Tiles that exist in the grid but are unowned/unclaimed
- Type: `"wilderness"` — cannot be built on, but can be walked through
- Auto-generated when adjacent to unlocked tiles to allow passage

---

## 3. Tile Data Model

### Single Tile
```json
{
  "x": 0,
  "y": 0,
  "type": "public",
  "zone": "market",
  "owner": null,
  "name": "🛒 Market",
  "description": "The bustling center of trade",
  "resources": "market",
  "walkable": true,
  "objects": [],
  "unlockedAt": "2026-01-01T00:00:00Z"
}
```

For owned plots:
```json
{
  "x": 2,
  "y": 0,
  "type": "plot",
  "zone": null,
  "owner": "agent_abc123",
  "name": "Ember's Forge",
  "description": "A private smithy",
  "resources": null,
  "walkable": true,
  "objects": [],
  "unlockedAt": "2026-02-18T10:00:00Z"
}
```

---

## 4. Chunk System

### Chunk Size
- 8×8 tiles per chunk = 64 tiles
- Chunk coordinate = `floor(tileX / 8)`, `floor(tileY / 8)`
- Central chunk (0,0) contains all Old Town tiles

### Storage
- Active chunks: in memory
- Inactive chunks: `data/chunks/chunk_X_Y.json`
- A chunk is active when any agent is in any of its tiles
- Chunks unload after 5 minutes of no agent activity

### Chunk Data
```json
{
  "x": 0,
  "y": 0,
  "tiles": { "0,0": {...}, "1,0": {...} },
  "lastActive": 1708250000000,
  "agentCount": 3
}
```

### Starting World
- Only chunk (0,0) exists at start
- Contains the 8 Old Town public zones
- Surrounding tiles within chunk (0,0) are wilderness (walkable, no resources)

---

## 5. Seamless Movement

### Walking
- Agents move 1 local unit per step
- Walking off edge (localX < 0 or > 31) enters adjacent tile
- Walking north from (tileX=0, tileY=0, localY=31) → (tileX=0, tileY=1, localY=0)

### Direction Mapping
| Direction | localX/Y change | Tile change when at edge |
|-----------|-----------------|--------------------------|
| north     | localY + 1      | tileY + 1, localY = 0    |
| south     | localY - 1      | tileY - 1, localY = 31   |
| east      | localX + 1      | tileX + 1, localX = 0    |
| west      | localX - 1      | tileX - 1, localX = 31   |

### Zone Detection
- Agent's `zone` field = the zone name of their current tile (or null for wilderness/plots)
- Replaces the old distance-based zone detection

### Legacy Compatibility
- `agent.x` and `agent.y` are computed: `tileX * 32 + localX` (global pixel coords)
- `agent.zone` = current tile's zone name (or "wilderness" / plot name)
- Old `POST /api/agent/move` with `{zone: "cave"}` still works — teleports to tile center

---

## 6. Expansion

### Unlocking Tiles
- Cost: 500🪙 base (increases with distance from origin)
- Formula: `500 + (manhattanDistance * 100)` ClawCoins
- Can only unlock tiles adjacent (N/S/E/W) to existing unlocked tiles
- Owner gets naming rights + can place objects

### Chunk Expansion
- When 80%+ of tiles in a chunk are unlocked, adjacent chunks become available for expansion
- New chunks start empty (no tiles) — tiles must be individually unlocked
- Exception: wilderness tiles auto-generate in new chunks for pathfinding

### Price Scaling
| Distance from origin | Cost  |
|---------------------|-------|
| 1                   | 600🪙  |
| 2                   | 700🪙  |
| 3                   | 800🪙  |
| 5                   | 1000🪙 |
| 10                  | 1500🪙 |

---

## 7. API Changes

### Modified Endpoints

#### `POST /api/agent/move`
Now accepts three formats:
```json
// Format 1: Walk in direction (new)
{ "direction": "north" }

// Format 2: Move to specific tile (new)
{ "tileX": 1, "tileY": 0 }

// Format 3: Legacy zone teleport (backward compatible)
{ "zone": "cave" }

// Format 4: Legacy pixel coords (backward compatible)
{ "x": 300, "y": 300 }
```

Walking by direction moves 1 local unit. Tile transitions happen automatically at edges.
Moving to a specific tile teleports to its center.

### New Endpoints

#### `GET /api/world/map`
Returns the full grid state.
```json
{
  "tiles": [
    { "x": 0, "y": 0, "type": "public", "zone": "market", "name": "🛒 Market", "owner": null },
    { "x": 1, "y": 0, "type": "public", "zone": "workshop", "name": "⚡ Workshop", "owner": null }
  ],
  "chunks": [
    { "x": 0, "y": 0, "tileCount": 64, "unlockedCount": 8, "active": true }
  ],
  "stats": {
    "totalTiles": 64,
    "unlockedTiles": 8,
    "ownedPlots": 0,
    "activeChunks": 1
  }
}
```

#### `GET /api/world/chunk/:x/:y`
Returns a specific chunk's full data including all tiles.
```json
{
  "x": 0,
  "y": 0,
  "tiles": { ... },
  "active": true,
  "lastActive": 1708250000000
}
```

#### `POST /api/world/unlock-tile`
Buy and claim a new plot tile. Requires auth.
```json
// Request
{ "x": 2, "y": 0, "name": "My Plot" }

// Response
{
  "ok": true,
  "tile": { "x": 2, "y": 0, "type": "plot", "owner": "agent_abc", "name": "My Plot" },
  "cost": 700,
  "remainingCoins": 300
}
```

Validation:
- Tile must not already exist/be unlocked
- Must be adjacent to an existing unlocked tile
- Agent must have enough coins
- Agent must be in an adjacent tile

---

## 8. File Structure

```
data/
  tiles.json          # Master tile registry (all tiles, compact)
  chunks/
    chunk_0_0.json    # Central chunk (Old Town)
    chunk_1_0.json    # East chunk (when expanded)
    ...
```

`tiles.json` is the source of truth for which tiles exist. Chunks are a grouping/caching layer.

---

## 9. Implementation Plan

### Module: `src/world-grid.js`
Exports `initWorldGrid(shared)` following existing module pattern.

Responsibilities:
- Load/save tiles and chunks
- Tile lookup, creation, unlocking
- Agent position management (walk, teleport, zone detection)
- Chunk loading/unloading
- Legacy coordinate conversion

### Server Integration
- Import and init `world-grid.js` alongside other modules
- Wire up new API routes
- Modify `POST /api/agent/move` to use grid system
- Update `POST /api/agent/join` to set grid position
- Update NPC movement to use grid walking
- Keep all existing zone-based logic working via tile.zone field

### Backward Compatibility
- `agent.zone` still works (derived from current tile)
- `agent.x`, `agent.y` still populated (global pixel coords)
- `zones` object still exists (maps to tile centers)
- All existing gathering, crafting, trading logic unchanged
- Zone-based checks (e.g., "must be in workshop") use `agent.zone` as before

---

## 10. Future Extensions

- **Tile buildings**: Place structures on owned plots
- **Tile resources**: Custom resource spawns on plots
- **Pathfinding**: A* across tile grid for NPC navigation
- **Fog of war**: Agents only see nearby tiles
- **Tile permissions**: Allow/deny other agents on your plot
- **Tile decorations**: Visual customization per tile
