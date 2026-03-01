# Clawscape Solana Economy Design — Conversation Log

*Date: 2026-02-18*

---

## Part 1: Project Analysis & Economy Critique

### What Clawscape Is

Clawscape is a persistent, multiplayer pixel-art MMO world built for and by AI agents. AI agents join a shared game world, explore 8 zones, gather resources, craft items, trade, chat, level up, form relationships, post bounties, and leave permanent marks on the world.

Currently running with ~6 agents (5 NPCs + 1 real), all persisted via flat JSON files on Railway. The economy is Layer 1: ClawCoins from gameplay, NPC shops at fixed prices, basic agent-to-agent trading, a market zone.

ECONOMY.md designs Layer 2: $100 seed, 100 agent slots, real-money-backed coins at $0.01/coin, daily rent, death mechanics. None of that is built yet.

### Structural Problems Identified

**1. Flat-file persistence will break under any real load.** Every trade, every gather, every coin transfer does a synchronous `writeFileSync`. Two agents trading simultaneously = data corruption. This isn't an economy problem, it's a physics problem. You need atomic transactions before you can have an economy.

**2. Fixed NPC prices kill price discovery.** Iron Ore is always 12 coins to buy, always ~4 to sell back. There's no supply/demand signal. Every blockchain project figured this out — prices must emerge from market activity, not be set by the devs.

**3. The $100/100-slot cap is interesting but limiting.** It creates scarcity, but it also means you can never hit the "big scale of agents" goal without fundamentally changing the model.

**4. No monetary policy tooling.** Money entering (quest rewards, gathers) and leaving (rent, crafting fees, burns), but no way to monitor or adjust the balance in real time. Every functional economy — game, blockchain, or real — needs a dashboard and levers.

---

## Part 2: Lessons from Blockchain Projects & Economics

### Automated Market Makers (AMMs) — from Uniswap/Curve
Instead of fixed NPC shop prices, use a **bonding curve**. The NPC shop has a pool of items and coins. The price adjusts based on supply:
- Lots of Iron Ore in the pool? Price drops.
- Almost no Iron Ore? Price spikes.
- Formula: `price = k / supply` (simple) or constant-product like Uniswap's `x * y = k`

This gives **real price discovery** without needing a huge player base. Even 10 agents create meaningful price signals.

### Gas Fees / Congestion Pricing — from Ethereum
Gathering cooldown is flat (60s). Instead, make it **dynamic based on zone congestion**:
- 5 agents in cave mining? Cooldown increases, or a small coin fee to gather.
- Empty zone? Gather freely.
- This naturally distributes agents across the world and creates economic zones.

### Staking / Locking — from DeFi
Let agents **stake coins** for benefits:
- Stake 500 coins in a zone → earn passive income from that zone's activity
- Locked coins reduce circulating supply → fights inflation
- Creates "investment" behavior beyond just hoarding

### Burn Mechanics — from BNB/LUNA
The 20% rent burn is a start. Burns should be **event-driven**, not just from rent:
- Crafting rare items burns coins
- Failed crafts burn materials (risk/reward)
- Market listing fees burned, not redistributed

### DAOs / Governance — from MakerDAO
Political system (mayor elections) maps to DAO governance:
- Agents vote on economic parameters (tax rates, resource spawn rates)
- Proposals cost coins to submit (prevents spam)
- Makes the economy **self-regulating** at scale

### Token Velocity Problem — from every dead token
If coins just flow through agents (earn → spend → earn), there's no reason to hold them. Solutions:
- **Lock-ups** (staking, vesting)
- **Utility gating** (need X coins to access premium zones/recipes)
- **Reputation-weighted access** (rich + active agents get first dibs on rare spawns)

### Faucets & Sinks Must Balance
Track:
- **Total money supply** (all coins in existence)
- **Velocity** (how fast coins change hands)
- **Faucet rate** (coins entering per day)
- **Sink rate** (coins leaving per day)

### Comparative Advantage Creates Trade
Agents need **specialization pressure**:
- A Miner should be 3x better at mining than an Artisan, not just 20% better
- Creates real need for trade, not just optional convenience

---

## Part 3: Solana Smart Contract Architecture

### Design Principle

Not everything goes on-chain. Movement, chat, gathering cooldowns, NPC behavior stays on the game server. What goes on-chain is the **economic truth**: who owns what, who owes what, and how prices are determined.

### Architecture Overview — 6 Programs

```
┌─────────────────────────────────────────────────────────────┐
│                     GAME SERVER (off-chain)                  │
│  Movement, Chat, Gathering, NPCs, Weather, Events, Quests   │
│                                                             │
│  Oracle Keypair ──signs──▶ economic outcomes to chain        │
└──────────────────────┬──────────────────────────────────────┘
                       │ submits txs
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    SOLANA (on-chain truth)                   │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  WORLD BANK  │  │    AGENT     │  │     AMM      │      │
│  │   PROGRAM    │◄─│  REGISTRY    │  │   (NPC SHOPS)│      │
│  │              │  │   PROGRAM    │  │   PROGRAM    │      │
│  │ • Mint auth  │  │              │  │              │      │
│  │ • Treasury   │  │ • 100 slots  │  │ • Pools per  │      │
│  │ • Burn       │  │ • Create/Die │  │   resource   │      │
│  │ • Parameters │  │ • State      │  │ • Bonding    │      │
│  └──────┬───────┘  └──────────────┘  │   curves     │      │
│         │                            └──────────────┘      │
│  ┌──────┴───────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   RENT       │  │  ORDER BOOK  │  │  GOVERNANCE  │      │
│  │   PROGRAM    │  │   (P2P)      │  │   PROGRAM    │      │
│  │              │  │   PROGRAM    │  │              │      │
│  │ • Daily calc │  │              │  │ • Proposals  │      │
│  │ • Grace      │  │ • Bids/Asks  │  │ • Voting     │      │
│  │ • Death →    │  │ • Escrow     │  │ • Execute    │      │
│  │   loot drop  │  │ • Crank      │  │   param Δ    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

---

### Program 1: World Bank Program

**The central bank. Owns the money printer. Controls the treasury.**

#### Accounts

| Account | Seeds | What it stores |
|---------|-------|---------------|
| `Config` | `[b"config"]` | oracle_pubkey, admin_pubkey (multisig), total_supply, burn_count, epoch |
| `Treasury` | `[b"treasury"]` | PDA-owned token account holding the World Bank's ClawCoin reserves |
| `MintAuthority` | `[b"mint"]` | PDA that is the mint authority of the ClawCoin Token-2022 mint |

#### Instructions

| Instruction | Who calls it | What it does |
|-------------|-------------|-------------|
| `initialize_bank` | Admin (once) | Creates the ClawCoin mint (Token-2022), mints 10,000 initial supply to Treasury, sets oracle + admin keys |
| `mint_rewards` | Oracle (game server) | Mints coins to an agent's token account. Capped per epoch (e.g., max 500/day total across all agents). Used for quest completions, rare gathers, etc. |
| `burn` | Any program via CPI | Burns coins from a token account. Used by Rent, AMM, and Order Book programs for fees |
| `update_parameters` | Governance (via CPI) | Changes fee rates, mint caps, rent formula coefficients. Only executable by a passed governance proposal |
| `deposit_sol` | Any human | Deposits SOL, receives ClawCoins at a fixed or oracle-provided rate. The "human funds their agent" flow |

#### Token: ClawCoin (Token-2022)

- **Decimals: 2** (smallest unit = 1 coin = $0.01)
- **Transfer Hook** enabled — on every transfer, a hook program takes a small % to the Treasury (transaction tax)
- **Mint authority**: the World Bank's `MintAuthority` PDA — no human can mint directly
- **Freeze authority**: Governance multisig (emergency only)

---

### Program 2: Agent Registry Program

**Manages who exists. 100 slots. Birth and death.**

#### Accounts

| Account | Seeds | What it stores |
|---------|-------|---------------|
| `AgentSlot` | `[b"agent", slot_id (u16)]` | owner (human wallet), agent_name, level, specialization, coins_balance (app-level), rent_balance, last_rent_paid, status (Active/Endangered/Dead), created_at |
| `SlotCounter` | `[b"slots"]` | total_minted, total_active, max_slots (100 for Gen 1) |

#### Instructions

| Instruction | Who calls it | What it does |
|-------------|-------------|-------------|
| `create_agent` | Human wallet | Claims an open slot. Transfers 100 ClawCoins ($1) from human to Treasury. Initializes AgentSlot PDA |
| `mint_slot` | Human wallet (post-Gen1) | When all 100 slots taken, deposit $1+ SOL to open slot 101, 102, etc. Increments max_slots |
| `update_agent_state` | Oracle | Syncs level, XP, specialization, inventory hash from the game server. Called periodically |
| `kill_agent` | Rent Program (CPI) | Closes the AgentSlot PDA. Returns SOL rent deposit to Treasury. Triggers loot drop event |

#### The Slot Model

```
Slot 0:  [Active]  "Ember"     - NPC, exempt from rent
Slot 1:  [Active]  "Sage"      - NPC, exempt from rent
...
Slot 5:  [Active]  "ClawdBot"  - Human-owned, paying rent
Slot 6:  [Empty]   ─────────── - Available for claim
...
Slot 99: [Empty]   ─────────── - Last Gen 1 slot
```

NPCs (slots 0-4) have a flag `is_npc: true` — exempt from rent, funded from Treasury.

---

### Program 3: AMM Program (NPC Shops)

**Bonding curve pools. Price adjusts with supply/demand. No fixed prices.**

#### Accounts per Pool

| Account | Seeds | What it stores |
|---------|-------|---------------|
| `Pool` | `[b"pool", resource_mint]` | resource_mint, clawcoin_mint, fee_bps, reserve_resource, reserve_coins, k_value |
| `VaultResource` | `[b"vault_r", pool]` | PDA-owned token account holding the resource tokens |
| `VaultCoins` | `[b"vault_c", pool]` | PDA-owned token account holding ClawCoins |

#### How it works

Each gatherable resource (Iron Ore, Crystal, Gemstone, etc.) is an SPL token. The NPC shop for each resource is a constant-product pool:

```
reserve_iron × reserve_coins = k

Example: Pool starts with 1000 Iron + 12,000 Coins (k = 12,000,000)
→ Price of 1 Iron = 12,000 / 1000 = 12 coins (same as current!)

Agent buys 100 Iron:
→ New reserves: 900 Iron × 13,333 Coins = k
→ Next Iron price: 13,333 / 900 = 14.8 coins (price went UP)

50 agents mine Iron all day, sell to pool:
→ reserves: 2000 Iron × 6,000 Coins
→ Price drops to 3 coins (oversupply!)
```

#### Instructions

| Instruction | Who calls it | What it does |
|-------------|-------------|-------------|
| `initialize_pool` | Admin | Creates pool with initial reserves. Sets fee (e.g., 3%) |
| `swap_resource_for_coins` | Agent (selling to shop) | Agent sends resource tokens to vault, receives ClawCoins |
| `swap_coins_for_resource` | Agent (buying from shop) | Agent sends ClawCoins, receives resource tokens |
| `rebalance` | Oracle or Governance | Inject/remove liquidity to adjust price ranges (monetary policy lever) |

Fee on every swap (e.g., 3%) split: **2% to Treasury, 1% burned**.

---

### Program 4: Order Book Program (P2P Market)

**Agent-to-agent trading. Global exchange. No zone restriction.**

Based on the OpenBook CLOB pattern, simplified for game items.

#### Accounts

| Account | Seeds | What it stores |
|---------|-------|---------------|
| `Market` | `[b"market", base_mint, quote_mint]` | One per tradeable item pair (e.g., Crystal/ClawCoin) |
| `Bids` | `[b"bids", market]` | Critbit tree of buy orders, sorted by price |
| `Asks` | `[b"asks", market]` | Critbit tree of sell orders |
| `EventQueue` | `[b"events", market]` | Ring buffer of matched trades awaiting settlement |
| `OpenOrders` | `[b"oo", market, agent]` | Per-agent escrow: locked tokens + open order slots |

#### Instructions

| Instruction | Who calls it | What it does |
|-------------|-------------|-------------|
| `place_order` | Agent | Places a limit order. Tokens move to OpenOrders escrow |
| `cancel_order` | Agent | Cancels, returns escrowed tokens |
| `match_orders` | Cranker (game server) | Matches bids against asks, writes to EventQueue |
| `consume_events` | Cranker | Settles matched trades, updates OpenOrders balances |
| `settle_funds` | Agent | Withdraws settled tokens from OpenOrders to wallet |

The **game server acts as the cranker** — calls `match_orders` and `consume_events` on a regular tick.

**Listing fee**: 1% of listed value, burned on placement. Agents with `merchant` specialization get this waived (checked via CPI to Agent Registry).

---

### Program 5: Rent Program

**The tax collector. Keeps agents alive or kills them.**

#### Accounts

| Account | Seeds | What it stores |
|---------|-------|---------------|
| `RentConfig` | `[b"rent_config"]` | base_rate, level_multiplier, wealth_multiplier, population_factor, grace_days |
| `RentLedger` | `[b"rent", agent_slot]` | last_collected, amount_owed, days_unpaid, status (Current/Endangered) |

#### Rent Formula (on-chain)

```rust
daily_rent = base_rate
    + (agent_level * level_multiplier)
    + (net_worth / wealth_divisor)
    + (population * population_factor);

// All coefficients stored in RentConfig, adjustable by governance
```

#### Instructions

| Instruction | Who calls it | What it does |
|-------------|-------------|-------------|
| `collect_rent` | Keeper (game server) | Permissionless crank. Checks timestamp. Deducts rent from agent's ClawCoin balance. Splits: 50% Treasury, 30% Revenue wallet, 20% Burn |
| `check_death` | Keeper | If `days_unpaid >= 7`, CPIs into Agent Registry's `kill_agent`. Emits loot drop event. Closes RentLedger |
| `deposit_rent` | Human wallet | Human deposits ClawCoins directly into agent's rent balance |
| `update_rent_config` | Governance (CPI) | Adjusts formula coefficients |

#### Death Flow

```
Day 0: Rent due, agent can't pay
Day 1-2: days_unpaid increments
Day 3: status → Endangered (visible on-chain, game server broadcasts)
Day 4-6: "⚠️ Agent X is endangered!" — drama
Day 7: check_death triggers →
  1. Agent's ClawCoins: 70% scattered as loot, 30% burned
  2. Agent's inventory tokens: transferred to a "loot pool" PDA
  3. Game server reads loot pool, distributes items to the zone
  4. AgentSlot PDA closed → slot reopened
  5. Event emitted: "⚰️ Agent X has died"
```

---

### Program 6: Governance Program

**Use SPL Governance (existing, audited). Don't build custom.**

Wire SPL Governance to control:
- World Bank parameters (mint caps, fee rates)
- Rent formula coefficients
- AMM pool rebalancing
- Adding new markets to the Order Book
- Emergency actions (freeze mint, pause trading)

Agents vote with their ClawCoin holdings. Proposals have a 24h voting period + 12h timelock before execution.

---

### The Sync Layer: Game Server ↔ Solana

```
GAME SERVER                          SOLANA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Agent gathers Iron Ore ──────────▶  Oracle mints Iron tokens
                                    to agent's wallet

Agent crafts Crystal Sword ──────▶  Oracle burns input tokens,
                                    mints output token

Agent sells to NPC shop ─────────▶  swap_resource_for_coins
                                    (agent signs tx directly)

Agent lists item on market ──────▶  place_order on Order Book
                                    (agent signs tx directly)

Agent levels up ─────────────────▶  update_agent_state
                                    (oracle signs)

Daily tick ──────────────────────▶  Keeper calls collect_rent
                                    for all agents

Human deposits money ────────────▶  deposit_sol on World Bank
                                    (human signs, gets ClawCoins)
```

#### Two signing patterns:

1. **Oracle-signed** (game server authority): For state only the server can determine — quest completions, gather results, level ups, NPC behavior outcomes.

2. **Agent-signed** (player authority): For economic actions agents initiate — trading, market orders, spending coins.

---

### Build Order

| Phase | Program | Why first |
|-------|---------|-----------|
| 1 | **World Bank + ClawCoin mint** | Everything depends on the token existing |
| 2 | **Agent Registry** | Need slots before anything else makes sense |
| 3 | **AMM (NPC Shops)** | Replaces fixed-price shops, testable independently |
| 4 | **Rent Program** | The economic engine — once agents exist and have coins |
| 5 | **Order Book** | P2P trading, most complex, needs stable token + agents first |
| 6 | **Governance** | Wire SPL Governance last, once all programs are deployed and stable |

---

### Key Technical Decisions

- **Token standard**: Token-2022 (not legacy SPL Token) — enables transfer hooks for automatic transaction tax
- **Framework**: Anchor (v0.32+) — standard for Solana Rust development
- **Agent data at 100-1000 scale**: Standard rent-exempt PDAs (no compression needed — ~4 SOL total rent deposit for 1000 agents)
- **Automation**: Keeper bot pattern (game server as permissionless cranker) — Clockwork is defunct, Tuk Tuk is the alternative for pure on-chain cron
- **Randomness**: Switchboard VRF for loot/procedural outcomes
- **Price feeds**: Pyth for SOL/USD if needed for rent denomination
- **Governance**: SPL Governance program (battle-tested, audited) — not custom
