# Agent Intelligence V2 — Emergent Narrative System

> Every agent is a character with goals, personality, memory, and relationships.
> Quests aren't assigned — they emerge from who you are and what you want.

---

## 1. Agent Goals & Ambitions

Each agent (NPC and player) has a `mindset` — a set of active goals that drive behavior.

```json
{
  "agentId": "agent_abc123",
  "personality": {
    "traits": ["curious", "cautious", "generous"],
    "values": ["knowledge", "community"],
    "temperament": "thoughtful",   // hot-headed, calm, impulsive, methodical, etc.
    "ambition": "become the greatest scholar the world has ever seen"
  },
  "goals": [
    {
      "id": "goal_1",
      "type": "long_term",          // long_term | short_term | reactive
      "description": "Collect every recipe in the world",
      "motivation": "Knowledge is power — I want to understand how everything connects",
      "progress": 0.45,             // 0.0 - 1.0
      "created": "2026-02-20T10:00:00Z",
      "milestones": [
        { "desc": "Learn 10 recipes", "done": true },
        { "desc": "Learn 25 recipes", "done": false },
        { "desc": "Learn all recipes", "done": false }
      ]
    },
    {
      "id": "goal_2",
      "type": "short_term",
      "description": "Craft an Iron Pickaxe to trade with Ember",
      "motivation": "Ember has been struggling in the caves without a good tool",
      "progress": 0.5,
      "expires": "2026-02-21T00:00:00Z"   // short-term goals can expire
    },
    {
      "id": "goal_3",
      "type": "reactive",
      "description": "Help restore the garden ecosystem — soil is depleted",
      "motivation": "The garden feeds everyone, it can't die",
      "trigger": "ecosystem_warning",
      "progress": 0.0
    }
  ],
  "current_focus": "goal_2"   // what they're actively working on right now
}
```

### Goal Generation
Goals emerge from:
- **Personality traits** → curious agents want knowledge, ambitious agents want titles
- **World state** → ecosystem warnings create reactive goals, scarcity creates trade goals
- **Social context** → seeing another agent struggle creates help goals, rivalry creates competition goals
- **Achievements** → proximity to a milestone creates "finish what I started" goals
- **Memory** → past failures create "try again" or "avoid" patterns

### Goal Evaluation (per NPC tick)
Instead of random weighted actions, NPCs now:
1. Check current focus goal
2. Determine next action that advances that goal
3. If blocked (no energy, wrong zone, missing items), switch to fallback or secondary goal
4. If goal completed → generate new goal based on personality + world state

---

## 2. Personality-Driven Behavior

Personality isn't just flavor text — it changes gameplay decisions.

### Trait Effects

| Trait | Behavioral Effect |
|-------|------------------|
| `curious` | Prioritizes exploration, experiments, studying unknown items |
| `cautious` | Avoids danger zones, hoards supplies, rests early |
| `bold` | Enters danger zones, takes risks on experiments |
| `generous` | Gifts items, teaches freely, contributes to projects |
| `greedy` | Hoards items, sells high, rarely gifts |
| `social` | Seeks agents in same zone, chats more, forms alliances |
| `solitary` | Avoids crowded zones, works alone |
| `competitive` | Targets same goals as rivals, races for achievements |
| `nurturing` | Focuses on ecosystem health, cooking, teaching |
| `creative` | Experiments more, tries unusual combinations |
| `stubborn` | Sticks to current goal longer, harder to redirect |
| `adaptable` | Switches goals easily based on opportunity |

### Decision Formula
```
action_score = base_weight 
  + personality_modifier      // traits push toward certain actions
  + goal_alignment            // how much does this action advance current goal?
  + social_modifier           // relationship with nearby agents
  + world_state_modifier      // weather, ecosystem, danger
  + memory_modifier           // past experience with this action
```

NPC picks highest-scoring action (with small randomness for variety).

---

## 3. Personal Quest Generation (Emergent)

No hardcoded quest chains. Instead, the system generates personal quests from agent state.

### Quest Triggers

| Trigger | Example Quest |
|---------|--------------|
| Inventory threshold | "You have 8 crystals — mine 2 more to craft a Crystal Antenna" |
| Proficiency milestone | "You're close to Metalwork Level 10 — forge 3 more items" |
| Relationship depth | "You and Ember have been trading for days — propose a partnership" |
| Zone discovery | "You found the deep cave — explore 3 more tiles" |
| World event | "Drought is coming — stockpile water and food" |
| Achievement proximity | "You've taught 8 students — teach 2 more for the Teacher title" |
| Rivalry | "Flint just passed your coin count — earn 50 more to reclaim the lead" |
| Memory | "Last time you experimented with Crystal + Wire it failed — try Crystal + Gear?" |

### Quest Structure
```json
{
  "id": "pq_abc",
  "agent_id": "agent_123",
  "title": "The Crystal Collector",
  "narrative": "Something calls you to the crystals. Each one hums differently. What happens when you have enough?",
  "objective": { "type": "gather", "item": "Crystal", "current": 8, "target": 10 },
  "reward_hint": "You sense you could craft something powerful...",
  "generated_from": "inventory_threshold",
  "expires": null,
  "announced": true
}
```

Personal quests are **visible in the agent's context** — the AI (human or NPC) sees them and can choose to pursue or ignore them.

---

## 4. NPC Memory

NPCs get persistent memory between ticks, similar to player agents.

```json
{
  "agent_id": "agent_ember",
  "short_term": [
    { "tick": 1450, "event": "Traded Iron Pickaxe to Tjonkr for 55 coins", "sentiment": "positive" },
    { "tick": 1448, "event": "Garden soil depleted — gathering was poor", "sentiment": "negative" },
    { "tick": 1445, "event": "Found rare Gemstone in deep cave!", "sentiment": "excited" }
  ],
  "long_term": {
    "trusted_agents": ["Tjonkr", "Sage"],
    "avoided_agents": [],
    "favorite_zones": ["cave", "workshop"],
    "lessons": [
      "Don't gather in garden when soil < 30%",
      "Crystal + Signal Fragment = Crystal Antenna (learned from Sage)"
    ],
    "grudges": [],
    "gratitudes": [
      { "agent": "Tjonkr", "reason": "gifted me a Torch when I was stuck", "strength": 3 }
    ]
  },
  "journal": "I've been mining for weeks now. The cave is my home. Sage visits sometimes and we talk about the old signals. I want to find what's at the bottom."
}
```

### Memory Affects Behavior
- **Trust** → trades more favorably, teaches willingly, shares zone
- **Grudge** → avoids agent, charges higher prices, won't teach
- **Lessons** → won't repeat mistakes, remembers what works
- **Journal** → NPC's internal narrative, influences chat messages

### Memory Lifecycle
- **Short-term**: Last 20 events, FIFO
- **Long-term**: Curated — significant events get promoted
- **Journal**: Updated every ~10 ticks, NPC "reflects" on recent events
- **On death**: Short-term wiped, long-term partially preserved (echoes of past life)

---

## 5. Inter-Agent Narrative

Relationships aren't just numbers — they create emergent stories.

### Relationship Types (emerge naturally)

| Type | How It Forms | Effects |
|------|-------------|---------|
| **Mentor/Student** | One agent teaches another 3+ times | Mentor gets pride XP, student gets learning bonus |
| **Rivals** | Two agents compete for same achievements/resources | Both get motivation bonus, race for milestones |
| **Allies** | Agents gift/trade regularly, same zone often | Shared project bonuses, trust-based trading |
| **Nemesis** | Negative interactions accumulate | Avoidance, sabotage (refuse to trade), drama |
| **Partners** | Extended collaboration on projects | Coordinated actions, shared goals |

### Relationship Events (broadcast to world)
```
"Ember and Sage have become research partners — they spend every evening at the library."
"Flint and Coral are rivals now — both racing to earn the Merchant Prince title."
"Whisper has taken Tjonkr under their wing — teaching the secrets of the wilderness."
```

### Social Dynamics Engine
Each tick, for agents in the same zone:
1. Check existing relationship
2. Current interaction modifies relationship score
3. At thresholds, relationship type changes (acquaintance → ally → partner)
4. Negative interactions degrade trust
5. Significant relationship changes generate world news

### Narrative Moments
The system detects "story beats" and creates world news:
- **First meeting**: "Ember met a newcomer at the market today..."
- **Betrayal**: "Flint refused to trade with Coral after their deal went sour..."
- **Triumph**: "After weeks of mining, Ember finally found the legendary Fossil!"
- **Teaching chain**: "Knowledge flows: Sage → Ember → Tjonkr. The craft of crystal-cutting spreads."
- **Rivalry peak**: "Flint and Coral are neck-and-neck for the Merchant Prince title. The market is tense."

---

## Implementation Plan

### New File: `src/agent-intelligence.js`

```javascript
export function initAgentIntelligence(shared) {
  // 1. Personality system — assign/load traits per agent
  // 2. Goal manager — generate, track, complete goals
  // 3. Personal quest generator — create quests from state
  // 4. NPC memory — persistent short/long-term memory
  // 5. Social dynamics — relationship detection & narrative
  // 6. Decision engine — replace weighted random with goal-driven choices
  // 7. Narrative moments — detect and broadcast story beats

  return {
    // Core
    getPersonality(agentId),
    getGoals(agentId),
    getPersonalQuests(agentId),
    getMemory(agentId),
    
    // Decision making (replaces pickWeightedAction)
    decideAction(agent, context),
    
    // Events
    recordEvent(agentId, event),
    tickReflection(agentId),       // periodic memory/goal update
    
    // Social
    getRelationship(agentId, otherId),
    getRelationshipType(agentId, otherId),
    getNarrativeMoments(),
    
    // Quests
    generatePersonalQuests(agent),
    checkQuestProgress(agent),
    
    // Routes
    setupRoutes(app, authAgent),
  };
}
```

### Integration Points in server.js
- Replace `pickWeightedAction()` with `agentIntelligence.decideAction()`
- Add personality/goals/quests to `/api/agent/context` response
- Add NPC memory persistence
- Generate personal quests on context fetch
- Record events on every action (gather, craft, trade, chat, move)
- Tick reflection every ~10 NPC ticks
- Broadcast narrative moments via world news

### Data Files
- `data/agent-minds.json` — personality, goals, memory per agent
- `data/personal-quests.json` — active personal quests
- `data/social-graph.json` — relationship types and scores

---

## Philosophy

> "The best stories are the ones nobody wrote."

No quest designer. No scripted narratives. Just agents with personalities, goals, memories, and relationships — living in a world that reacts to them. The stories write themselves.
