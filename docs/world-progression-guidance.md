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

**Two layers (sharpened 2026-06-02):**

- **The world you drive in** — the hostile ground you operate in. Leans **persistent** (you green it
  with earned, persistent life-trails — §3a) but could also be a regenerating roguelike field; the
  roguelike loop is just a *means*, not the mission, so this can stay loose.
- **The Restoration Sanctuary** — a **separate, persistent, menu-visited** place (NOT rendered inside
  a run) where restoration accumulates and is displayed (§3b). This is where "what you've healed stays
  healed," cleanly decoupled from whatever the world layer does.

Pulling restoration out into its own place is what lets the world layer regenerate (or not) **without
ever threatening the healing** — see §3.

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
**The shape that now feels right (2026-06-02): split restoration into two places.** The world you
drive in *and* a **separate, persistent restoration place you visit from a menu.** Doing this resolves
most of the regeneration-vs-restoration tension — because restoration no longer lives inside the part
of the game that might regenerate.

> **The reframe that drives this:** *the roguelike loop is not the mission — it's a means to an end.*
> The mission is bringing life back. So restoration should not be hostage to run structure. (It may
> not even need to be a hard roguelike: an alternative is a **long-term persistent world** where being
> "out in the field" carries some penalty that resolves back at the **workshop**, rather than a
> restart-and-rebuild death. Undecided — but either way, restoration sits *outside* it.)

### (a) Life-trails in the world — earned, upgradeable, persistent
Driving leaves **life** behind you (soil, grass, blooms). Important shifts from the earlier riff:

- **Not a default ability — earned.** Leaving life-trails is a **special mechanism gained through
  progression**, not something the rig does from the start. It's a reward you unlock.
- **Upgradeable, in tiers.** The trail the rig lays improves as you invest, e.g.:
  - improve **soil quality** (darker, richer ground),
  - leave **grass**,
  - force **blooms and shrubs** to grow randomly.
  The more you have, the **better the world looks** — coverage is its own satisfaction.
- **Persistent — trails don't vanish.** The earlier "drive back over it and you ruin it unless you
  have a gentle drivetrain" idea is **superseded-leaning**: the appeal is now *covering the world in
  life that stays*, so the player can keep trying to green everything. (The destructible-trail /
  gentle-drivetrain idea is parked, not deleted.)
- **The world reacts.** Greenery **lures life, including hostile life**; restored ground around former
  **enemy camps** (cleared once or repeatedly) can surround old **tree stumps** with rich soil; trails
  can **grow** — trees that **drop fruit**, **flowers**, and **lure new animal types**.

This makes the *playfield itself* visibly come back to life as a reward for effort — separate from,
and feeding into, the sanctuary below.

### (b) The Restoration Sanctuary — a separate, persistent ecosystem *(the progress tracker)*
A **dedicated restoration area, visited from a menu** — *not* rendered inside a run/session. This is
where the **ancient tree** lives and where your restoration **accumulates and is displayed**.

- **Separate & persistent.** It lives **outside the roguelike world**, so there's **no re-applying**
  anything and nothing a regeneration can wipe. You go there to *see* what you've built.
- **3D and beautiful, evolving over time.** Ideally rendered with real 3D art of life that
  **gradually evolves and improves** — the long, slow, gorgeous payoff.
- **You feed it with rewards earned in the main game.** Special parts, mechanisms, and **living
  rewards** won out in the world are **brought into the sanctuary**. Example: enough world-restoration
  earns **bunnies**, which you **move into the sanctuary** to bring a new form of life to the ancient
  tree. (One small example of a much larger intended system.)
- **It's almost a sub-game / mini-game.** The main game *generates* rewards; the sanctuary is where
  you *spend* them — and **that is how progression is tracked.** Bring-from-main → apply-to-sanctuary
  is the core meta-loop.

### (b.1) Ecosystem-balancing — the sanctuary's depth *(high-intent, exploratory)*
Jaco wants to **pour intent into this**: the sanctuary isn't a static trophy shelf, it's a **living
ecosystem you solve.** Life invites **imbalance**, and rebalancing is the puzzle:

- **Problems signal life-but-imbalance.** Moles, rats, etc. show the area is alive but **out of
  balance** — and you must introduce things to restore balance.
- **Interlocking systems, not single fixes.** e.g. the right **crops/plants** improve **soil / pH** →
  richer soil grows **thicker plants** → thicker growth means **rats target the tree less**. A web of
  cause-and-effect to untangle — *complex ecosystem solving.*
- The earlier ancient-tree quest steps (**restore water → fertilizer → protection against invaders
  drawn by the restoration**) fold in here as **ecosystem levers**, rather than as in-run quests.

### Where this leaves the old forks
- **Regeneration vs. restoration:** largely **resolved-leaning** by separation — the run world can
  regenerate (or be a persistent long-term world) without touching the sanctuary.
- **Greenery trail cosmetic vs. mechanic:** reframed — trails are **earned + upgradeable + persistent**
  in the world (a real reward system), while the **sanctuary** is the deeper mechanical sub-game. The
  destructible-trail variant is parked.
- **One ancient tree vs. many:** still open, but the sanctuary framing makes **one grand focal tree**
  (with a rich ecosystem) very natural; multiple sanctuaries remain possible.

---

## 4) Progression — what carries you forward

**The progression gate (what unlocks the next chapter) is leaning toward AREA RECLAMATION, tracked in
the Sanctuary — not far-travel/fuel.** The exciting gate is **growing the Restoration Sanctuary**
(§3b): you earn rewards in the world and **bring them home to apply to the sanctuary**, and *that
applied progress is the tracker* of how far you've come. "Drive far + manage fuel" is, on its own, an
*unexciting* gate. (One grand focal tree, or X of several sanctuaries — still open.)

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

## 5) Energy identity: electric vs. mechanical — both restorative *(candidate)*

Builds on the **already-decided** engine duality (MW milestone: two energy types under a **no-hybrid
type-lock** — electric = snappy/scout/combat, mechanical = heavy hauler). New thinking layered on top
(candidate, not committed):

### Both energy types are restorative — neither is "the dirty one"
The two paths should **both heal the world**; the choice is identity/feel, **not** good-vs-evil.

- **Electric** — clean and **environmentally safe**.
- **Mechanical** — keeps **high torque / more power**, but must **avoid modern fossil-fuel / air-
  pollution / exhaust connotations**. Lean **steam power** (water vapour, clean) rather than petrol or
  exhaust. *(Aligns with the captured "fuel is an abstract reaction charge, **not** petrol" —
  `ideas.md` 2026-06-01. Caveat to reconcile: the current **future-look** for mechanical leans
  "grimy / fumes" in `workshop-interface-spec.md`; this reframe nudges that toward **steam, not
  exhaust** — a thread to reconcile, not a decision.)*
- Keep the felt tradeoff (electric snappy & clean vs. mechanical heavy & torquey) **without moral
  stigma**.

### Energy type as a build identity (a "class")
The energy choice could define a whole playthrough's identity — like a **class / build type**. Two
ways to express it, **and they're not mutually exclusive** *(open fork)*:

- **(A) Multiple rigs.** The player can own both and **swap rigs for different purposes** — a genuinely
  good experience. **But a second rig should be *very hard* to acquire** vs. the first (a major, late,
  expensive unlock), so for most of the game you're committed to one.
- **(B) Start-of-game class choice.** Pick **mechanical (steam)** *or* **electric** up front; that
  choice **gates everything after** — every unlock/progression *and* the rewards in the
  restoration / "heart" system (the Sanctuary, §3b) are **specific to that energy type**. A true
  build commitment.

### Replayability
- Under **(B)**: finishing a playthrough on one energy type lets you **retry with the other** — a clean
  replayability engine (new unlocks, new energy-specific Sanctuary rewards).
- Under **(A)**: replayability comes from **chasing the hard-won second rig** within a playthrough.

### How it threads restoration
Energy-type-specific rewards in the Sanctuary mean the **restoration sub-game itself could look and
feel different per path** — a distinct restorative flavour for electric vs. steam — reinforcing the
class identity and giving each replay its own texture.

---

## How it all fits (one paragraph)

You drive a **rig** out into a **hostile world**, scavenging scrap, **rare recipes**, special
mechanisms, and **living rewards**. **Fuel** teaches you to keep your energy system ahead of your
ambitions; **load, offense, and defense** each earn their own investment against a **scaling enemy**.
As you progress you unlock **life-trails** — earned, upgradeable, *persistent* greening (richer soil →
grass → blooms) — and the satisfaction of **covering the world in life that stays**, clearing camps
into restored ground around old stumps that grow into fruiting, flowering, animal-luring life. You
bring your haul home, **upgrade the workshop** (the hard-won gateway to advanced alloys and complex
parts), and then step into the **Restoration Sanctuary** — a separate, persistent, beautifully 3D
place you visit from a menu — to **apply your rewards** (move the **bunnies** in) and tend a **living
ecosystem you solve**: water, fertilizer, soil/pH, predators and pests all in balance around the
**ancient tree**. That applied, accumulating sanctuary *is* your progression — untouched by whatever
the world layer does. The rig is always the tool; the world coming back to life is always the point.

---

## Candidate skeleton milestones this guidance implies

> Stubs only — **title + one-line intent**, all `pending` and **movable**. Not ordered, not scoped,
> no success criteria yet. Promote into `milestones.md` only when one firms up.

- **Restoration Sanctuary (separate 3D area)** · `pending` — a persistent, menu-visited place,
  outside the run, where restoration accumulates and is displayed; the progression tracker.
- **Sanctuary ecosystem-balancing sub-game** · `pending` — moles/rats = imbalance; introduce
  crops/water/soil-pH levers to rebalance; interlocking cause-and-effect around the ancient tree.
- **Bring-from-world → apply-to-sanctuary loop** · `pending` — earn living rewards in the world (e.g.
  bunnies) and move them into the sanctuary; the core meta-progression loop.
- **Earned, upgradeable, persistent life-trails** · `pending` — driving lays life (soil → grass →
  blooms); unlocked, tiered, and permanent; satisfaction of greening the whole world.
- **Camp-to-restored-ground** · `pending` — cleared enemy camps leave restored soil around old stumps
  that grow into fruiting/flowering/animal-luring life.
- **Hybrid chunk-assembly world** · `pending` — author small socketed chunks; assemble the drivable
  world from them (per-outing or persistent).
- **World structure: persistent vs. roguelike field** · `pending` — decide whether the world layer is
  a long-term persistent place (out-of-field penalty resolved at the workshop) or a regenerating run.
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
- **Both energy types restorative (steam, not exhaust)** · `pending` — reframe mechanical away from
  fossil-fuel connotations while keeping high torque; both paths heal the world.
- **Energy type as build identity / class** · `pending` — energy choice defines a playthrough; gates
  unlocks + energy-specific Sanctuary rewards.
- **Multiple rigs (hard-won)** · `pending` — own/swap both energy types; a second rig is a major, late
  unlock.
- **Energy class choice + retry replayability** · `pending` — commit to one energy path; retry with
  the other for a fresh playthrough.

---

## Open forks (explicitly undecided)

- **World structure** — long-term *persistent* world (out-of-field penalty resolved at the workshop)
  vs. a regenerating roguelike field. The roguelike loop is a *means, not the mission*, so this stays
  loose. *(Was "regeneration vs. restoration" — largely defused by moving restoration into the
  separate Sanctuary, §3.)*
- **Fuel's role** — confirmed-leaning as *signal not gate*, but the exact economy is open.
- **One ancient tree vs. many** — single grand focal sanctuary vs. several (reclaim-X-of-many).
- **How deep the ecosystem sub-game goes** — from a few balance levers to genuinely "complex ecosystem
  solving" (high intent here; scope risk to watch).
- **Energy identity model** — multiple rigs (A) vs. start-of-game class choice (B); not mutually
  exclusive (could start with a class choice *and* allow a hard-won second rig later).
- **Steam vs. exhaust aesthetic** for mechanical — reconcile the future "grimy / fumes" look with the
  "both restorative / steam-not-exhaust" reframe.
- **Parked, not deleted** — the *destructible* life-trail + **gentle/preventive drivetrain** idea
  (trails now lean persistent); revisit if a tension/upkeep mechanic is ever wanted.
