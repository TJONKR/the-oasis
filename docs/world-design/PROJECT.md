# Clawscape 🌍

A Phaser 3 pixel-art adventure world with real-time Clawdbot integration.

## Status: Phase 1 Complete ✅

### What We Built
- **Phaser 3 game** with Vite + Express server
- **Custom character**: Builder Dino Bot (fusion of Luffy + Robot + Dino)
- **Animated sprites**: Walk cycles (4 directions) + action poses (idle, hammer, wave, sit)
- **World map**: Cozy pixel-art village with zones
- **Real-time sync**: WebSocket connection to Clawdbot
- **Zone detection**: Auto-updates when player moves between areas

### Character: Builder Dino Bot 🤖🦖
- Orange hard hat
- Teal visor eyes  
- Red bandana
- Dino legs with straw hat on back
- Sprite: `assets/sprites/fusion-v2.png`
- Walk sheet: `assets/sprites/fusion-v2-walk.png`
- Actions sheet: `assets/sprites/fusion-v2-actions.png`

### Current Zones
- 🏠 Home (north-west)
- ⚡ Workshop (north-east)
- 📡 Tower (south-west)
- 🌸 Memory Garden (south-east)

### New Large World Map Generated
`assets/world-map-large.png` (4800x3584px) includes:
- 📚 Library (northwest) - beautiful stained glass
- 🏔️ Cave/Mine (northeast) - with minecart!
- 🛒 Market Square (center) - colorful stalls + fountain
- 🏖️ Beach + Dock (southeast) - ocean waves
- 🌳 Glowing Memory Tree (south-center)
- 📡 Radio Tower (west)
- River flowing through with bridges

## Roadmap

### Phase 2: Expand the World 🗺️
- [ ] Integrate large world map
- [ ] Add new zones to WorldScene
- [ ] Implement camera scrolling for larger map
- [ ] Add zone transitions/loading screens

### Phase 3: Multiplayer 👥
- [ ] Deploy to Vercel/Railway
- [ ] Add WebSocket room system
- [ ] Player state sync (position, animation)
- [ ] Generate unique avatars per player
- [ ] Chat bubbles above characters
- [ ] Room links: `?room=tijs-adventure`

### Phase 4: Polish ✨
- [ ] Fix sprite transparency (remove checkerboard)
- [ ] Add collision detection
- [ ] NPCs with dialogue
- [ ] Inventory system
- [ ] Day/night cycle animations
- [ ] Sound effects + music

## Tech Stack
- **Frontend**: Phaser 3, Vite
- **Backend**: Express + WebSocket (ws)
- **Assets**: AI-generated via Gemini (nano-banana-pro)
- **Hosting**: TBD (Vercel recommended)

## Run Locally
```bash
cd projects/clawscape
npm install
npm run dev   # Dev mode
npm run build && node server.js  # Production
```
Server: http://localhost:3456

## Clawdbot Integration
```bash
# Move character to zone
curl -X POST http://localhost:3456/api/state \
  -H "Content-Type: application/json" \
  -d '{"zone":"workshop"}'
```

Hook at `hooks/clawscape/hook.js` auto-syncs Clawdbot state.
