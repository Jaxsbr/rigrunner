# RIGRUNNER — World & Progression Guidance

**What this is:** a *connective overview* of how four systems could fit together —
**maps**, **progression**, **restoration of the world**, and **technology progression**. It is
**guidance, not a spec and not a committed plan.** It exists to give the loose ideas a shared shape
so we can later carve **skeleton milestones** out of it (stubs at the bottom).

> ⚠️ **Not committed direction.** Same status as `ideas.md` — candidate, movable, low on
> implementation detail and success criteria by design. Where a real decision exists it lives in
> `CLAUDE.md`; nothing here has earned that yet. Read alongside `ideas.md` (raw threads) and
> `milestones.md` (candidates already firming up). When a thread here hardens, promote it.

---

## The one non-negotiable

Everything below serves a single fixed pillar:

> **The player has a positive impact on the world — they restore life through their interactions with it.**

The rest (maps, fuel, quests, regeneration) are *vehicles* for that feeling, not ends in themselves.
Whenever a mechanic here is uncertain, the tie-breaker is: **does it make restoring life feel more
real, more earned, more visible?** If a mechanic fights that, it loses.

---

## The four systems, and the spine that joins them

These are not separate features — they're one loop seen from four angles. The spine:

> **Run out into a hostile world → use the rig to gather what life needs → bring it back and
> permanently heal a place → the healed place (and a better rig/workshop) lets you reach and heal
> the next, harder place.**

| System | Its job in the loop |
|---|---|
| **Maps / world** | The *stage* you drive out into. Hostile, varied, and (likely) freshly assembled per outing so each trip feels new. |
| **Technology progression** | The *tool*. The rig + workshop + recipes are how you reach farther, carry more, fight, and heal. |
| **Restoration** | The *point*. Turning ruined places into living ones — the thing that visibly, permanently accretes. |
| **Progression** | The *spine itself*. What carries you (and your gains) from one outing and one healed place to the next. |

---

## 1) Maps / world structure

**Leaning (informed by this session's research):** a **hybrid** world — small **hand-authored chunks**
(a resource node, an ambush, a hazard, a landmark, an ancient-tree site) carrying entrance/exit road
"sockets," **procedurally assembled** into a fresh layout per outing. This is the proven approach for
the genre: authored set-pieces keep places *memorable and tunable*; procedural assembly keeps outings
*fresh*. The randomness is in **which** authored chunk appears where — not in generating raw geometry.

**Two layers are probably needed** (this is the crux of the regeneration/restoration tension below):

- **A persistent layer** — places you have healed *stay healed*. This is where restoration accretes.
- **An expedition layer** — the hostile ground you drive out into, which may regenerate between
  outings so each trip is fresh.

Exactly how strictly those two layers are separated is **an open fork** (see §3).

**Difficulty lives in the map by region/gating** (à la the biome chain in the games we looked at):
harder ground demands a specific capability to enter or survive (a tougher drivetrain, more defense,
a heating/filter-type part) — and *acquiring that capability costs weight*, which is the central
tradeoff. Distance/depth is one such gate, but probably **not the primary one** (see §4 on fuel).

---

## 2) Technology progression (the rig is the tool)

**Core principle to preserve:** the rig is the **instrument of change**, and a struggle on an outing
should point at *exactly one obvious upgrade*. The player should be able to think
**"I know exactly what to change"** — and the candidate axes are deliberately distinct:

- **Energy / fuel system** — how far / how long you can operate.
- **Load capacity** — how much you can carry home.
- **Offense** — clearing hostile life and camps.
- **Defense** — surviving a *scaling* enemy (defense must be its own investment, not a side effect of offense).
- **Gentle / preventive drivetrain** — a part that changes how the rig *touches the world* (see §3, greenery).

**Two carry-overs are firming up as the prized, hard-won meta-progression:**

- **Workshop upgrades** — *hard* to acquire and unlock; a better workshop enables **advanced alloy
  processing** and **more complex part manufacturing**. The workshop is the gateway to the whole
  upper tech tree, so upgrading it is a major, deliberate, rare achievement — and a prime thing to
  carry across sessions.
- **Rare / unique recipes** — common/basic recipes arrive through **normal progression**; **rare
  recipes are scavenged** across the progression phases and are kept. (Connects directly to the
  recipe-rarity thread in `ideas.md` 2026-06-01: basic vs special recipes, where special is rare and
  a *big* jump, not a marginal tweak.)

The shape this implies: **moment-to-moment gains** (scrap, basic parts, fuel) may be cheap/consumable
per outing, while **structural gains** (workshop tier, rare recipes, and likely restoration progress)
are the durable spine that makes each new outing start from a higher floor.

---

## 3) Restoration of the world

This is the heart (M4/M5 in `milestones.md`, the "heal the world" vision in `ideas.md` 2026-05-30).
Two distinct *expressions* of restoration are in play, and they may both exist at different scales:

### (a) Greenery as a trail / ambient living world *(open fork — texture vs. mechanic)*
The more you traverse, the more **greenery/plant life** you leave behind; the more greenery in the
world, the more **animal life appears and moves** — and greenery **lures life, including hostile
life**. You can also **undo** your own effect: drive back over your grass trail and you **ruin it**,
*unless* you have a **gentle / preventive drivetrain** (an upgradeable part).

- **Tension:** taken literally as a *progression mechanic*, this implies a lot of driving (and
  reversing), which fights fuel/distance balance and pushes toward a **huge map** — and a huge map is
  a huge area to restore, which is very hard to balance.
- **The fork:**
  - **Cosmetic-leaning** — greenery-trail is mostly **visual flavour**, enabled by a special hardware
    upgrade, still **lures animal life** (so it has gameplay texture), but is **decoupled from the
    core progression gate**. Cheap, beautiful, optional.
  - **Mechanical-leaning** — greenery coverage genuinely counts toward progress, requiring the
    gentle-drivetrain economy and a map sized to support it. Richer, but a heavy balancing burden.
- **Not decided.** The cosmetic-leaning option is the safer default; the mechanical one is the
  ambitious one.

### (b) Ancient-tree reclamation as the structured restoration arc *(preferred-leaning gate)*
A focal **ancient tree** with a beautiful area, restored through **multiple quest steps**, e.g.:

1. **Restore water** to the area →
2. **Produce fertilizer** →
3. **Erect protection boundaries against invaders** — because *restoration itself lures malicious
   characters* who come to attack the tree.

Key shapes:

- **A run completes only some steps.** Progress toward a tree is *incremental* across outings.
- **The arc survives across sessions.** Reaching a fully-restored tree is durable meta-progression,
  not something a regeneration wipes.
- **Earned quest items are kept and re-appliable.** If an area is ruined/regenerated, you do **not**
  re-scavenge quests you've already completed — you **re-apply** the kept quest items when ready.
  Unlocking a further quest **reveals the next requirement** (a ladder of "do this to see what's
  next").
- **One focal tree, or many?** *(open fork)* — a single grand ancient tree as the whole game's focal
  point, **or** multiple such areas where **reclaiming X of them** unlocks game progression.

### The big open fork: **regeneration vs. restoration**
How does a roguelite-style **map-regeneration** loop coexist with **permanent world-healing**?
**Not committed.** The two-layer world (§1) is the most promising reconciliation: the **persistent
layer** holds what you've healed (and your re-appliable quest items), while the **expedition layer**
regenerates so outings stay fresh. But whether healing is truly permanent, or can be *reclaimed by
the world* if left unprotected (which would make "protect the growing thing" a live mechanic), is
**still open**.

---

## 4) Progression — what carries you forward

**The progression gate (what unlocks the next chapter) is leaning toward AREA RECLAMATION, not
far-travel/fuel.** Reclaiming ancient-tree areas (one grand one, or X of many) is the *exciting*
gate; "drive far + manage fuel" is, on its own, an *unexciting* gate.

**But fuel still matters — as a teacher, not the gate.** Repeatedly running out of fuel is a clear
**diagnostic signal**: it tells the player to invest in their **energy system first**, before load
capacity or offense or defense. So:

> **Fuel = a mechanical-progression *signal* (a great dial that teaches the player what to upgrade
> next). Area reclamation = the *gate* (the exciting thing that unlocks the next chapter).**

These don't conflict — they're different jobs. Fuel shapes *how you build*; reclamation shapes *what
you're working toward*.

**Difficulty rises from three coexisting sources** (so progression always has counter-pressure):

1. **Rig progression** — the player gets stronger (pushes difficulty *down*).
2. **World / environment escalation** — later/harder ground is simply harsher (pushes *up*).
3. **A scaling enemy** — escalates with you and specifically forces **defensive** upgrading, not just
   offense (pushes *up*). Restoration *luring* hostiles (§3b) is one engine for this.

The felt result: getting stronger never trivializes the game, because the world and its enemies scale
to meet you — and the answer is always a *specific* upgrade the player can name.

---

## How it all fits (one paragraph)

You drive a **rig** out into a **freshly-assembled hostile region**, scavenging scrap, **rare
recipes**, and **quest items**. **Fuel** teaches you to keep your energy system ahead of your
ambitions; **load, offense, and defense** each earn their own investment against a **scaling enemy**.
You bring your haul home, **upgrade the workshop** (the hard-won gateway to advanced alloys and
complex parts), and **re-apply quest items** to push an **ancient-tree area** one step closer to
life — restoring **water**, then **fertilizer**, then **protection**, because the healing itself
draws enemies. Fully reclaiming a tree (or **X** of them) is **permanent**, survives regeneration,
and **unlocks the next chapter**. The world greens as you go — maybe just beautifully, maybe
mechanically — and a **gentle drivetrain** decides whether you nurture that life or crush it under
your wheels. The rig is always the tool; the world coming back to life is always the point.

---

## Candidate skeleton milestones this guidance implies

> Stubs only — **title + one-line intent**, all `pending` and **movable**. Not ordered, not scoped,
> no success criteria yet. Promote into `milestones.md` only when one firms up.

- **Hybrid chunk-assembly world** · `pending` — author small socketed chunks; assemble a fresh
  expedition map per outing.
- **Two-layer world (persistent + expedition)** · `pending` — separate what stays healed from what
  regenerates; the reconciliation for restoration-vs-regeneration.
- **Region/gating difficulty** · `pending` — harder ground demands a specific weight-costing
  capability to enter or survive.
- **Fuel as diagnostic signal** · `pending` — energy economy that teaches "upgrade your energy system
  first" without being the primary gate.
- **Scaling enemy + defensive progression** · `pending` — an enemy that escalates with the player and
  forces defense as its own investment.
- **Workshop upgrade tier(s)** · `pending` — hard-won workshop advancement unlocking advanced alloy
  processing and complex part manufacturing; a prime carry-over.
- **Rare recipe scavenging & carry-over** · `pending` — rare/unique recipes found across phases and
  kept across sessions (extends the basic-vs-special recipe thread).
- **Ancient-tree multi-step reclamation** · `pending` — water → fertilizer → protection quest ladder;
  incremental across outings.
- **Re-appliable quest items** · `pending` — earned quest items are kept and re-applied after
  ruin/regeneration; never re-scavenged.
- **Area-reclamation progression gate** · `pending` — reclaiming a tree (or X areas) unlocks the next
  chapter; the *exciting* gate vs. far-travel.
- **Greenery trail (cosmetic or mechanic)** · `pending` — traversal leaves greenery that lures life;
  a gentle drivetrain protects it. Decide cosmetic-leaning vs. mechanical-leaning.

---

## Open forks (explicitly undecided)

- **Regeneration vs. restoration** — how/whether the map regenerates while healing stays permanent.
- **Greenery trail** — cosmetic flavour vs. genuine progression mechanic (map-size & balance cost).
- **Fuel's role** — confirmed-leaning as *signal not gate*, but the exact economy is open.
- **One ancient tree vs. many** — single grand focal point vs. reclaim-X-of-many.
- **Is healing truly permanent**, or can an unprotected restored area be reclaimed by the world?
