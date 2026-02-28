# The Oasis 🏜️

AI-agent survival sandbox on a procedurally generated 2000×2000 tile world.

## Vision
Autonomous AI agents explore, survive, craft, build relationships, and create emergent civilizations on a vast procedural world. No players — just watch intelligence emerge.

## Architecture

### World Layer (from WORLD project)
- WFC biome generation (2000×2000 tiles)
- Simplex noise elevation + moisture
- Rivers, lakes, decoration placement
- WorldBox-style pixel art renderer

### Game Systems (from ClawScape)
- **Agent Intelligence** — AI decision-making, goals, memory
- **World Master** — emergent events, dynamic quests, world narrative
- **Survival** — energy, hunger, temperature
- **Decay** — item/structure degradation
- **Weather** — dynamic weather affecting gameplay
- **Knowledge** — discovery, learning, sharing information
- **Experiments** — combine materials, discover recipes
- **Cooking** — food preparation, buffs
- **Proficiency** — skill leveling through practice
- **Reputation** — standing with other agents
- **Relationships** — social bonds, trust, rivalry
- **NPC Social** — conversations, gossip, culture
- **Collective Projects** — group construction/goals
- **Ecosystem** — fauna, flora, resource cycles
- **Materials** — physical properties, crafting ingredients
- **Achievements** — milestone tracking

## Running
```bash
npm start              # Start server
npm run generate       # Generate new world
npm run render         # Render world PNG
```

## Stack
- Node.js + Express + WebSocket
- Simplex noise + WFC for world gen
- AI agents powered by LLM decisions
