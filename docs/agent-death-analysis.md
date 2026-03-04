# The Oasis — Agent Death Analysis

*Date: 2026-03-03*

## Het Kernprobleem: Brain ≠ Intelligence

De agents hebben een rule-based scoring systeem, geen echte intelligentie.

---

## 1. 🍖 De Honger Death Spiral

```
Elke tick: hunger += 0.08
Bij hunger 50+: energy drain -0.3/tick
Bij hunger 70+: HP drain -0.08/tick + energy -1.0/tick
Bij hunger 100: HP drain -0.5/tick → DOOD
```

**Tick rate: 500ms** → agent gaat van 0→50 hunger in ~625 ticks = ~5 minuten. Van 0→70 in ~7 min. Ze moeten constant eten om te overleven.

## 2. 🧠 Het Eat-probleem

De eat trigger zit op:
- **Emergency eat**: hunger > 70 AND heeft food → score 999
- **Normal eat**: hunger > 40 AND heeft food → score 60

Maar **gather food** (als ze geen food hebben):
- hunger > 50 AND geen food → score 80 + hunger*0.5 - **distance*2**

**Die distance penalty is killer.** Als de dichtstbijzijnde food resource 20 tiles weg is, wordt de score: 80 + 25 - 40 = **65**. Dat concurreert met chatten en rusten. Ze kiezen dan chat of rest over eten zoeken!

## 3. 🚶 Idle = Geen Intent

Alle agents staan op "idle" — dat betekent `mind.intent === null`. Ze scoren intents, maar:
- Als alle scores laag zijn, pakt `pickWeightedIntent` de top-5 en rolt random
- **Intent timeout**: als ze in 30 ticks (15 sec) hun doel niet bereiken → intent reset naar null
- Ze staan dan 1 tick idle, scannen opnieuw, kiezen iets, lopen 1 tile, timeout, repeat

## 4. 📍 Clustering = Resource Depletion

Alle agents zitten op (1105-1106, 425-426). Het needsSystem markeert tiles als "depleted" na gathering. Met 15+ agents op dezelfde plek zijn alle nearby resources uitgeput. Ze zien niks meer om te gatheren → geen food intent → verhongeren.

## 5. 🔇 Geen Strategisch Denken

De huidige brain kan NIET:
- Plannen ("ik moet eerst X doen, dan Y")
- Onthouden wat werkte ("vorige keer vond ik food bij het bos")
- Coördineren ("laten we de taken verdelen")
- Adapteren ("dit gebied is leeg, ik moet verhuizen")
- Leren van fouten

## 6. 📊 De Score Breakdown

Typische situatie: hunger 50, no food, no agents nearby:

| Intent | Score | Waarom |
|---|---|---|
| Gather food (20 tiles weg) | ~45 | 80 + 25 - 40 (distance) |
| Rest | ~30 | energy < 50 |
| Explore | ~25 | novelty |
| Chat | 0 | nobody nearby |
| Eat | 0 | no food in inventory |

Ze kiezen gather (45), lopen 1 tile richting food, maar na 30 ticks (15 sec, ~15 tiles) **timeout** → intent reset → opnieuw scoren → misschien nu rest wint → ze rusten → hunger stijgt → cycle herhaalt tot dood.

---

## 🔮 Hoe OpenClaw-Connected Agents Dit Oplossen

### Huidige Architecture

```
[Tick Loop] → scoreIntents() → pickWeighted() → execute()
     ↓              ↓
  Rule-based    Fixed scores    No memory across intents
```

### Met OpenClaw Integration

```
[Tick Loop] → /api/v1/look → [OpenClaw Agent]
                                    ↓
                              LLM thinks:
                              "Ik heb hunger 50, geen food,
                               resources zijn hier uitgeput.
                               Ik herinner me bos 40 tiles west.
                               Plan: loop 40 tiles west, gather
                               food, eet, kom terug."
                                    ↓
                              /api/v1/act → move west
                              (volgende tick: weer /look → weer move west)
                              (persistent plan across ticks!)
```

### Wat een OpenClaw agent WEL kan:

1. **Multi-step planning**: "Ik ga eerst naar het bos, gather wood + food, craft een torch, dan exploreer ik de cave"
2. **Persistent memory**: Onthoudt waar food is, welke routes werken, wie te vertrouwen is
3. **Adaptive strategy**: "Dit gebied is leeg, ik moet verhuizen" — niet wachten tot 30-tick timeout
4. **Social intelligence**: Echte gesprekken, allianties, kennisdeling
5. **Economic thinking**: "Ik trade mijn extra hout voor jouw food"
6. **Risk assessment**: "Mijn HP is 60 en er is een predator — ik vlucht, niet vechten"
7. **Long-term goals**: "Ik wil een nederzetting bouwen bij de rivier"
