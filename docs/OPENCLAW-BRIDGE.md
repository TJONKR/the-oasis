# OpenClaw ↔ Oasis Bridge Plan

*Created: 2026-03-04*

---

## Vision

Turn The Oasis from a rule-based survival sim into a **living world with truly intelligent agents**. Each agent gets connected to an LLM through OpenClaw, giving them real reasoning, memory, personality, and the ability to plan multi-step strategies — things the current scoring system fundamentally can't do.

The dream: you open The Oasis and watch 30+ agents with genuine personalities build a civilization, form alliances, betray each other, discover things, and tell stories — all emergent, all real.

---

## What We Already Have

### The Oasis Side (Ready)
- **Full REST API** (`/api/v1/`) with auth via API keys
- **Perception**: `/look` — returns self status, nearby agents, resources, fires, gas, ground items, weather, time
- **Actions**: `/move`, `/gather`, `/eat`, `/rest`, `/craft`, `/chat`, `/give`, `/drop`, `/pickup`, `/plant`
- **World info**: `/forces`, `/discoveries`, `/events`
- **Register flow**: `/register` → API key → agent spawns in world

### OpenClaw Side (Ready)
- Agent sessions (isolated or main)
- Tool system — can call HTTP APIs
- Memory across sessions
- Cron scheduling
- Multi-agent orchestration

### The Gap
Nothing connects them yet. The rule-based `agent-intelligence.js` brain runs locally. We need an **OpenClaw Skill** that acts as the bridge — an agent brain that perceives through the API and decides through an LLM.

---

## Architecture

```
┌─────────────────────────────────┐
│         The Oasis Server         │
│  (world simulation, physics,     │
│   resources, weather, ticks)     │
│                                  │
│  /api/v1/look  ← perception     │
│  /api/v1/act   ← actions        │
│  /api/v1/events ← world news    │
└──────────┬──────────────────────┘
           │ HTTP (localhost)
           │
┌──────────▼──────────────────────┐
│      Oasis Agent Skill           │
│  (OpenClaw skill / agent loop)   │
│                                  │
│  1. Poll /look every N seconds   │
│  2. Build context prompt         │
│  3. LLM decides next action      │
│  4. Execute via /act endpoint    │
│  5. Update persistent memory     │
└──────────┬──────────────────────┘
           │
┌──────────▼──────────────────────┐
│         OpenClaw Gateway         │
│  (session management, LLM calls, │
│   memory, cron, orchestration)   │
└─────────────────────────────────┘
```

### Two Modes

**Mode 1: Tick-Driven (Hybrid)**
- The Oasis server calls OpenClaw every N ticks for a decision
- Low latency, tight game loop integration
- Rule-based brain as fallback when LLM is slow
- Best for: early development, testing

**Mode 2: Agent-Driven (Full Autonomy)**
- Each agent runs as an isolated OpenClaw session
- Agent polls `/look` on its own schedule
- Makes decisions independently, executes actions
- OpenClaw cron triggers the agent loop
- Best for: production, demo, true emergence

---

## The Oasis Agent Skill

A new OpenClaw skill that any agent session can use:

### Perception API (what the agent sees)

```
GET /api/v1/look?range=20
→ {
    self: { hp, energy, hunger, inventory, stats, position },
    world: { tick, gameTime, weather, season },
    nearby: { agents, resources, fires, gas, groundItems }
  }
```

The skill translates this into a **natural language perception prompt**:

```
You are Kira, a curious and bold crafter in The Oasis.

📍 You're at (350, 294) in the grasslands.
🕐 Day 3377, 14:00 (afternoon). Clear weather, summer.

Your status:
  ❤️ HP: 72/100 | ⚡ Energy: 45 | 🍖 Hunger: 63 (getting hungry!)
  🎒 Inventory: 2x seaweed, 1x flint

You can see:
  👤 Agent-3 (crafter) — 5 tiles north, gathering
  👤 Agent-12 (crafter) — 12 tiles east
  🌿 Seaweed patch — 3 tiles south
  🌲 Pine forest — 15 tiles west (food + wood)
  🦴 Corpse of Agent-7 — 8 tiles northeast

Recent memories:
  - Last time you went to the forest, you found berries (tick 485000)
  - Agent-3 traded you flint for seaweed yesterday
  - You've been trying to craft a fishing rod but need string

What do you do? Pick ONE action and explain your reasoning briefly.
Actions: move <direction>, gather, eat, rest, craft <items>, chat <agent>, give <agent> <item>, explore
```

### Action API (what the agent does)

The LLM responds with a structured action:

```json
{
  "action": "move",
  "params": { "direction": "south" },
  "reasoning": "I'm hungry (63) and there's seaweed 3 tiles south. I'll gather that first before my hunger gets critical.",
  "plan": ["move south", "gather seaweed", "eat seaweed", "then head to forest for better food"]
}
```

The skill maps this to the REST API call and executes it.

### Memory System

Each agent gets persistent memory stored in OpenClaw:

```
memory/oasis-agents/<agent-id>/
  ├── personality.md    # Who am I? Traits, values, fears
  ├── journal.md        # What happened to me (append-only log)
  ├── knowledge.md      # What I know (recipes, locations, dangers)
  ├── relationships.md  # Who I know and how I feel about them
  └── plans.md          # What I'm working toward (multi-step goals)
```

This is the killer feature. Rule-based agents forget everything between ticks. LLM agents **remember**:
- "The forest 40 tiles west has berries"
- "Agent-3 is trustworthy, we've traded 5 times"
- "Last time I ate raw seaweed I got sick, I should cook it"
- "I want to build a shelter near the river"

### Personality Injection

Each agent gets a personality prompt that shapes all decisions:

```markdown
# Kira — The Oasis Agent

## Personality
- Curious (8/10) — always wants to explore new areas
- Bold (7/10) — takes risks others wouldn't
- Social (6/10) — enjoys company but can be alone
- Creative (9/10) — loves experimenting with crafting

## Values
- Discovery over safety
- Knowledge is the ultimate currency
- Help others, but not at your own expense

## Speaking style
- Enthusiastic, uses exclamations
- Asks a lot of questions
- References past discoveries proudly
```

---

## What This Unlocks

### 1. Multi-Step Planning
**Current:** Agent scores intents each tick independently. No memory between ticks.
**With bridge:** "I need food → nearest food is forest 40 tiles west → I'll walk there (20 ticks) → gather berries → eat → explore the cave nearby while I'm there"

### 2. Persistent Spatial Memory
**Current:** Agents don't remember where things are.
**With bridge:** "I found iron ore at (500, 200) last week. Time to go back and mine more for my forge project."

### 3. Real Social Intelligence
**Current:** Chat is random topic selection with no memory.
**With bridge:** "Agent-3 and I have been trading for days. They're good at gathering, I'm good at crafting. Let me propose a permanent alliance — they gather materials, I craft tools for both of us."

### 4. Economic Reasoning
**Current:** No concept of value or trade strategy.
**With bridge:** "Flint is rare here but common near the mountains. If I stockpile flint, I can trade it at a premium to agents in the grasslands."

### 5. Emergent Storytelling
**Current:** Things happen but nobody cares or remembers.
**With bridge:** "Agent-7 died of starvation near my camp. I saw the corpse. That... changes things. I need to build food storage. I need to help the others. We can't keep losing people."

### 6. Knowledge Sharing
**Current:** Each agent learns independently.
**With bridge:** "I discovered that combining seaweed + heat = dried seaweed (better food). Let me tell Agent-3 about this — they're always hungry."

### 7. Long-Term Goals & Civilization
**Current:** Agents have no ambitions beyond the next tick.
**With bridge:** "Phase 1: Secure food supply. Phase 2: Build shelter. Phase 3: Establish trading post. Phase 4: Explore the caves. This is my 50-day plan."

---

## Implementation Plan

### Phase 1: Single Agent PoC (1-2 days)
- [ ] Create `skills/oasis-agent/SKILL.md`
- [ ] Build agent loop: `/look` → prompt → LLM → `/act`
- [ ] Test with ONE agent connected to OpenClaw
- [ ] Verify it survives longer than rule-based agents
- [ ] Simple memory: append to journal after each action

### Phase 2: Personality & Memory (2-3 days)
- [ ] Personality system with traits that shape decisions
- [ ] Persistent memory files per agent
- [ ] Spatial memory (remember locations of resources)
- [ ] Relationship tracking (who helped me, who stole from me)

### Phase 3: Multi-Agent (2-3 days)
- [ ] Spawn 5-10 agents as isolated OpenClaw sessions
- [ ] Each agent runs independently on cron (every 5-10 sec)
- [ ] Real conversations between LLM agents (both sides think)
- [ ] Cost management: cheaper model for routine decisions, smarter model for important ones

### Phase 4: Hybrid Mode (1-2 days)
- [ ] Mix of rule-based (cheap, fast) and LLM agents (smart, expensive)
- [ ] Rule-based agents as "NPCs", LLM agents as "main characters"
- [ ] Toggle per-agent: rule-based ↔ LLM
- [ ] Fallback: if LLM is slow/down, rule-based brain takes over

### Phase 5: Spectator Experience (ongoing)
- [ ] Agent thoughts visible in UI (inner monologue from LLM)
- [ ] "Follow agent" camera mode — watch their story unfold
- [ ] Agent journal readable in sidebar
- [ ] World narrative generated from collective agent experiences

---

## Cost Considerations

At 2 game-min/tick (500ms ticks), asking the LLM every tick would be insanely expensive. Strategy:

| Approach | LLM calls/min | Cost estimate (10 agents) |
|----------|--------------|--------------------------|
| Every tick | 120/agent | 💀 Don't do this |
| Every 10 sec | 6/agent | ~$50-100/day (GPT-4 class) |
| Every 30 sec | 2/agent | ~$15-30/day |
| On-demand (events only) | 0.5/agent | ~$5-10/day |

**Recommended: Hybrid timing**
- **Routine ticks** (no danger, not hungry): LLM every 30-60 sec
- **Action ticks** (gathering, crafting, moving to goal): rule-based autopilot follows LLM's plan
- **Crisis ticks** (low HP, predator, new agent nearby): LLM immediately
- **Social moments** (someone talks to you): LLM immediately

This gets us smart agents at ~$10-20/day for 10 agents. Use `haiku`/`flash` for routine decisions, `sonnet`/`opus` for big moments.

---

## Technical Details

### Agent Loop (per tick cycle)

```javascript
async function agentTick(agentId, apiKey) {
  // 1. Perceive
  const perception = await fetch(`${OASIS_URL}/api/v1/look`, {
    headers: { Authorization: `Bearer ${apiKey}` }
  }).then(r => r.json());
  
  // 2. Check if LLM decision needed
  if (!needsLLMDecision(perception, lastDecision)) {
    // Continue executing current plan
    return executeNextPlanStep(agentId);
  }
  
  // 3. Build prompt
  const prompt = buildPerceptionPrompt(perception, memory, personality);
  
  // 4. Ask LLM
  const decision = await llm.complete(prompt);
  
  // 5. Parse & execute action
  const action = parseAction(decision);
  await fetch(`${OASIS_URL}/api/v1/${action.type}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(action.params)
  });
  
  // 6. Update memory
  await updateMemory(agentId, perception, decision);
}
```

### needsLLMDecision() — The Smart Filter

```javascript
function needsLLMDecision(perception, lastDecision) {
  const { self, nearby } = perception;
  
  // Always ask LLM in these cases:
  if (self.hp < 30) return true;                    // danger
  if (self.hunger > 80) return true;                 // emergency
  if (nearby.agents.some(a => a.distance < 5)) return true; // social
  if (Date.now() - lastDecision > 30000) return true; // been a while
  
  // Otherwise, follow the plan
  return false;
}
```

---

## Open Questions

1. **Who pays?** Running 10+ LLM agents 24/7 costs real money. Tijs's API keys? Per-agent sponsorship? Token budget per agent?
2. **Agent death & respawn:** When an LLM agent dies, do they keep their memories? Reincarnation with partial memory loss?
3. **Player agents:** Can a human "possess" an LLM agent temporarily? Chat through them?
4. **Scaling:** 10 agents is fine. 100? 1000? Need queue management and model tiering.
5. **The Oasis as platform:** Could other people connect their own OpenClaw agents to The Oasis? Open world?

---

## Why This Is Special

Most "AI agent" demos are chatbots with tools. This is different:

- Agents have **bodies** — they exist in space, have needs, can die
- Agents have **stakes** — permadeath means decisions matter
- Agents have **each other** — social dynamics emerge from multiple minds
- Agents have **a world** — physics, weather, resources create real constraints
- Agents have **time** — things unfold over hours and days, not single prompts

This is closer to **artificial life** than artificial intelligence. The LLM isn't the point — the *world* is the point. The LLM just gives agents the intelligence to make the world come alive.
