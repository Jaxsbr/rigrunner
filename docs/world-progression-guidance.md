# RIGRUNNER — World & Progression Guidance

**What this is:** a *connective overview* of how four systems fit together —
**maps**, **progression**, **restoration of the world**, and **technology progression**. It exists to
give the loose ideas a shared shape so we can carve **skeleton milestones** out of it (stubs at the
bottom) and so the per-feature specs have a vision to attach to.

> ⚠️ **Guidance, still movable — but firming.** This is not a line-by-line spec. As of the **2026-06-10**
> session ([`ideas.md`](ideas.md)) several long-open threads here **hardened into a leaning direction** —
> a **persistent world**, restoration living **in** that world (no separate Sanctuary), and a decided
> **restoration purpose** (gate + territory). Those are written below as the current shape, not as
> committed mechanics; `CLAUDE.md` remains the source of truth for anything fully committed, and the
> phased plan they imply lives in
> [`specs/real-world-and-progression-spec.md`](specs/real-world-and-progression-spec.md). Read alongside
> `ideas.md` (the raw threads + the dated history of how this shifted) and `milestones.md` (candidates
> already firming up).

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
| **Maps / world** | The *stage* you drive out into. Hostile and varied — and **persistent**: the changes you make to it stay made (see §1). |
| **Technology progression** | The *tool*. The rig + workshop + recipes are how you reach farther, carry more, fight, and heal. |
| **Restoration** | The *point*. Turning ruined places into living ones — the thing that visibly, permanently accretes **in the world itself**. |
| **Progression** | The *spine itself*. What carries you (and your gains) from one outing and one healed place to the next. |

---

## 1) Maps / world structure

**Decided-leaning (2026-06-10): the world is PERSISTENT.** The long-open "persistent vs regenerating
roguelike field" fork resolves toward **persistent** — the place you drive in **remembers what you did
to it**: cleared piles stay cleared, fallen camps stay fallen, healed ground stays healed. This is what
lets restoration live in the world (§3) instead of needing a separate place to be safe from a reset. The
roguelike loop was only ever a *means*; persistence serves the mission (bringing life back) more directly.

**A real-world vs test/sandbox split is the foundation this rides on.** Because the world is persistent
and authored, we keep a **separate sandbox world** for free-for-all testing (grant any part, drop scrap,
spawn a camp), so the real world's crafted state is never vandalized to make a new mechanic testable.
That split — plus **save persistence** and a **front-door menu** (New Game / Continue / Sandbox) — is one
foundation, specced in [`specs/real-world-and-progression-spec.md`](specs/real-world-and-progression-spec.md)
(Phase 0).

**Hybrid chunk-assembly, inside the persistent frame.** Small **hand-authored chunks** (a resource node,
an ambush, a hazard, a landmark, an ancient-tree site) carry entrance/exit road "sockets" and are
**assembled into a layout** — authored set-pieces keep places *memorable and tunable*; assembly keeps the
world *varied*. The randomness is in **which** authored chunk appears where, not in generating raw
geometry. In a persistent world this is layout-at-worldgen (or per-region reveal), not re-rolled every
outing. The render work this needs is mapped in
[`specs/render-scaling-spec.md`](specs/render-scaling-spec.md).

**Difficulty lives in the map by region/gating.** Harder ground demands a specific capability to enter or
survive (a tougher drivetrain, more defense, a heating/filter-type part) — and *acquiring that capability
costs weight*, the central tradeoff. The **primary** gate, though, is **restoration**, not distance/fuel
(see §4).

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
  upper tech tree, so upgrading it is a major, deliberate, rare achievement.
- **Rare / unique recipes** — common/basic recipes arrive through **normal progression**; **rare
  recipes are scavenged** across the progression phases and are kept. (Connects to the recipe-rarity
  thread in `ideas.md` 2026-06-01: basic vs special recipes, where special is rare and a *big* jump.)

The shape this implies: **moment-to-moment gains** (scrap, basic parts, fuel) are cheap/consumable per
outing, while **structural gains** (workshop tier, rare recipes, and the **restoration you've accreted into
the world**) are the durable spine that makes each new outing start from a higher floor.

---

## 3) Restoration of the world

This is the heart (the "heal the world" vision in `ideas.md` 2026-05-30; M4/M5 in `milestones.md`).
**The shape that now feels right (2026-06-10): restoration lives IN the persistent world.** Because the
world remembers (§1), the place you heal *is* the place that stays healed — there is no separate area to
protect from a reset, and no separate screen to go admire it on. **The world is the tracker.**

> **Why this replaced the earlier "separate Sanctuary" idea:** that idea existed to keep restoration safe
> from a regenerating world. Once the world is persistent, that job disappears — healed ground accretes
> right where you earned it. A persistent **trophy screen with a tree on it** had no demonstrated *pull*
> (you'd build something without knowing why a player wants to visit it); a healed, drivable world that
> **gates your progress and gives you bases** has obvious pull. (The dated `ideas.md` 2026-06-02 and
> 2026-06-10 sessions hold the full history of this shift.)

### What restoration GIVES the player — (a) the gate, with (c) territory sprinkled in
**Decided (2026-06-10):** restoration's purpose pays at **two timescales**, which is what makes the player
*want* to do it rather than treat it as a chore:

- **(a) Restoration is the gate — the long arc.** You restore enough of a region to **unlock the road to
  the next, harder region.** This is the answer to "what's it all for," and the **world map is the
  progression tracker** (§4).
- **(c) Territory / forward-bases — the moment-to-moment.** A healed patch becomes **immediately useful**:
  a safe haven to park and re-fit, a **forward base** that shortens the drive out to the frontier, a
  renewable resource spot. Persistence is what makes a base **stay yours** between sessions.

Pure-(a) alone risks feeling like a **chore tax** ("green X% before you may pass"); (c) makes each
individual heal independently worthwhile, so the gate just **accumulates from acts already worth doing**.
*(A third axis — **(b) restoration as a renewable economy**, healed ground yielding living rewards like
fruit/animals as crafting inputs or income — is the natural later layer on top of a+c, not chosen now.)*

### (a) Life-trails in the world — earned, upgradeable, persistent
Driving leaves **life** behind you (soil, grass, blooms). The shape:

- **Not a default ability — earned.** Leaving life-trails is a **special mechanism gained through
  progression**, a reward you unlock — not something the rig does from the start.
- **Upgradeable, in tiers.** The trail improves as you invest: better **soil quality** (darker, richer
  ground) → **grass** → **blooms and shrubs**. The more you have, the **better the world looks** —
  coverage is its own satisfaction, and it visibly accretes toward the region gate.
- **Persistent — trails don't vanish.** The appeal is *covering the world in life that stays*. (The earlier
  destructible-trail / gentle-drivetrain idea is **parked, not deleted** — revisit only if a tension/upkeep
  mechanic is ever wanted.)
- **The world reacts.** Greenery **lures life, including hostile life**; restored ground around former
  **enemy camps** can surround old **tree stumps** with rich soil; trails can **grow** — trees that **drop
  fruit**, **flowers**, and **lure new animal types**. (This luring is one engine of the scaling enemy, §4.)

The stump-healer mechanic already shipped (`features/restoration/`) is the first concrete rung of this:
clearing a pile or camp leaves a `RestorableSite`, and a stump-healer head grows it back into a young tree.

### (b) Depth, if in-world restoration ever wants it — *parked, high-intent*
The earlier **ecosystem-balancing sub-game** — moles/rats signalling *life-but-imbalance*; introducing
crops/water/soil-pH levers that interlock (right plants → better soil/pH → thicker growth → rats target the
tree less); the ancient-tree quest steps (water → fertilizer → protection against invaders drawn by the
restoration) as **ecosystem levers** — was conceived as the *Sanctuary's* depth. With the Sanctuary
dissolved it currently **has no home**, so it is **parked, not deleted**: a reservoir of depth that
in-world restoration could draw on later if "grow life back" wants to become "solve a living ecosystem."
Jaco has high intent here; it is explicitly **not** the near plan (scope risk to watch).

---

## 4) Progression — what carries you forward

**The progression gate is RESTORATION (area reclamation), tracked on the world map — decided-leaning
(2026-06-10).** You earn the means in the world and **spend them healing it**, and *that healed, persistent
ground is the tracker* of how far you've come (§3a). "Drive far + manage fuel" is, on its own, an
*unexciting* gate; **reclaiming the world** is the exciting one, and it doubles as immediate **territory**
(§3c). (One grand focal region, or X of several — still open; see forks.)

**Fuel still matters — as a teacher, not the gate.** Repeatedly running out of fuel is a clear
**diagnostic signal**: invest in the **energy system first**, before load/offense/defense. So:

> **Fuel = a mechanical-progression *signal* (a dial that teaches what to upgrade next). Area reclamation =
> the *gate* (the thing that unlocks the next chapter).** Different jobs — fuel shapes *how you build*,
> reclamation shapes *what you're working toward*.

**Difficulty rises from three coexisting sources** (so progression always has counter-pressure):

1. **Rig progression** — the player gets stronger (pushes difficulty *down*).
2. **World / environment escalation** — later/harder regions are simply harsher (pushes *up*).
3. **A scaling enemy** — escalates with you and specifically forces **defensive** upgrading, not just
   offense (pushes *up*). Restoration *luring* hostiles (§3a) is one engine for this.

The felt result: getting stronger never trivializes the game, because the world and its enemies scale to
meet you — and the answer is always a *specific* upgrade the player can name.

---

## 5) Energy identity: electric vs. mechanical — both restorative *(candidate)*

Builds on the **already-decided** engine duality (MW milestone: two energy types under a **no-hybrid
type-lock** — electric = snappy/scout/combat, mechanical = heavy hauler). New thinking layered on top
(candidate, not committed):

### Both energy types are restorative — neither is "the dirty one"
The two paths should **both heal the world**; the choice is identity/feel, **not** good-vs-evil.

- **Electric** — clean and **environmentally safe**.
- **Mechanical** — keeps **high torque / more power**, but **avoids modern fossil-fuel / air-pollution /
  exhaust connotations**. Lean **steam power** (water vapour, clean) rather than petrol or exhaust.
  *(Aligns with "fuel is an abstract reaction charge, **not** petrol" — `ideas.md` 2026-06-01. Caveat to
  reconcile: the current **future-look** for mechanical leans "grimy / fumes" in
  `workshop-interface-spec.md`; this reframe nudges that toward **steam, not exhaust**.)*
- Keep the felt tradeoff (electric snappy & clean vs. mechanical heavy & torquey) **without moral stigma**.

### Energy type as a build identity (a "class")
The energy choice could define a whole playthrough's identity — like a **class / build type**. Two ways to
express it, **not mutually exclusive** *(open fork)*:

- **(A) Multiple rigs.** Own both and **swap rigs for different purposes**. But a second rig should be
  *very hard* to acquire (a major, late, expensive unlock), so for most of the game you're committed to one.
- **(B) Start-of-game class choice.** Pick **mechanical (steam)** *or* **electric** up front; that choice
  **gates everything after** — unlocks/progression *and* the restorative rewards are **specific to that
  energy type**. A true build commitment.

### Replayability
- Under **(B)**: finishing on one energy type lets you **retry with the other** — a clean replayability
  engine (new unlocks, new energy-specific restorative texture).
- Under **(A)**: replayability comes from **chasing the hard-won second rig** within a playthrough.

### How it threads restoration
Energy-type-specific rewards mean the **restoration could look and feel different per path** — a distinct
restorative flavour for electric vs. steam — reinforcing the class identity and giving each replay its own
texture.

---

## How it all fits (one paragraph)

You drive a **rig** out into a **hostile, persistent world**, scavenging scrap, **rare recipes**, special
mechanisms, and **living rewards**. **Fuel** teaches you to keep your energy system ahead of your
ambitions; **load, offense, and defense** each earn their own investment against a **scaling enemy**. You
unlock **life-trails** — earned, upgradeable, *persistent* greening (richer soil → grass → blooms) — and
heal the ground where you clear piles and camps, growing old stumps into fruiting, flowering, animal-luring
life. Each heal **pays twice**: that patch becomes a **forward base / safe resource zone you use right
away**, and it **accretes toward reclaiming the region** — and reclaiming a region **opens the road to the
next, harder one**. That healed, persistent world *is* your progression tracker; there is no separate place
to visit, because the place you healed is the place that stays. You bring your haul home, **upgrade the
workshop** (the hard-won gateway to advanced alloys and complex parts), and head back out farther. The rig
is always the tool; the world coming back to life is always the point.

---

## Candidate skeleton milestones this guidance implies

> Stubs — **title + one-line intent**, `pending` and **movable** unless marked. Promote into `milestones.md`
> when one firms up. The first few now have a home in
> [`specs/real-world-and-progression-spec.md`](specs/real-world-and-progression-spec.md).

- **Persistent real world + sandbox split + persistence + menu** · `pending` *(specced — Phase 0)* — a
  game/save vs test-sandbox boundary, a front-door menu, and a save that remembers world-content state.
- **Restoration-as-region-gate (+ healed ground as forward base)** · `pending` *(specced — Phase 2)* —
  reclaiming a region unlocks the next; a healed patch is also an immediate base/resource zone.
- **The progression spine** · `pending` *(specced — Phase 2)* — the capability ladder from loose scrap →
  Reclaimer → piles → combat → camps → heal → region gate.
- **Earned, upgradeable, persistent life-trails** · `pending` — driving lays life (soil → grass → blooms);
  unlocked, tiered, permanent; greening the world *is* progress toward the gate.
- **Camp-to-restored-ground** · `pending` — cleared camps leave restored soil around old stumps that grow
  into fruiting/flowering/animal-luring life. *(First rung shipped: stump-healer.)*
- **Hybrid chunk-assembly world** · `pending` — author small socketed chunks; assemble the (persistent)
  drivable world from them.
- **Region/gating difficulty** · `pending` — harder ground demands a specific weight-costing capability to
  enter or survive.
- **Fuel as diagnostic signal** · `pending` — energy economy that teaches "upgrade your energy system first"
  without being the primary gate.
- **Scaling enemy + defensive progression** · `pending` — an enemy that escalates with the player and forces
  defense as its own investment.
- **Workshop upgrade tier(s)** · `pending` — hard-won workshop advancement unlocking advanced alloy
  processing and complex part manufacturing; a prime carry-over.
- **Rare recipe scavenging & carry-over** · `pending` — rare/unique recipes found across phases and kept.
- **Both energy types restorative (steam, not exhaust)** · `pending` — reframe mechanical away from
  fossil-fuel connotations while keeping high torque; both paths heal the world.
- **Energy type as build identity / class** · `pending` — energy choice defines a playthrough; gates
  unlocks + energy-specific restorative rewards.
- **Multiple rigs (hard-won)** · `pending` — own/swap both energy types; a second rig is a major, late unlock.
- **Energy class choice + retry replayability** · `pending` — commit to one energy path; retry with the other.
- **Onboarding / guidance / story** · `pending` *(specced — Phase 4)* — lead the player down the progression
  spine; deliberately last, once the spine exists.

**Superseded / parked** *(kept for the record; history in the dated `ideas.md` sessions):*

- ~~**Restoration Sanctuary (separate 3D area)**~~ · **superseded** — dissolved into the persistent world;
  the world map is the tracker, no separate menu-visited place.
- ~~**Bring-from-world → apply-to-sanctuary loop**~~ · **superseded** — the apply-target is now the world
  itself (healed ground / forward bases), not a separate sanctuary.
- **Sanctuary ecosystem-balancing sub-game** · `parked` — high-intent depth (rats/soil-pH/crop levers) that
  lost its home with the Sanctuary; a reservoir in-world restoration could draw on later, not the near plan.

---

## Open forks (explicitly undecided)

- **One focal region vs. many** — single grand reclaimable region vs. several (reclaim-X-of-many) as the
  gate's shape.
- **Fuel's role** — confirmed-leaning as *signal not gate*; the exact economy (capacity, burn, refuel) is open.
- **How deep in-world restoration goes** — from "grow life back" (the shipped direction) to the genuinely
  "complex ecosystem solving" parked in §3b (high intent; scope risk).
- **Energy identity model** — multiple rigs (A) vs. start-of-game class choice (B); not mutually exclusive.
- **Steam vs. exhaust aesthetic** for mechanical — reconcile the future "grimy / fumes" look with the
  "both restorative / steam-not-exhaust" reframe.
- **Parked, not deleted** — the *destructible* life-trail + **gentle/preventive drivetrain** idea (trails now
  lean persistent); revisit if a tension/upkeep mechanic is ever wanted.

**Resolved this rework (2026-06-10):** ~~world structure: persistent vs roguelike field~~ → **persistent**;
~~regeneration vs. restoration~~ → defused (persistent world, restoration lives in it); ~~separate Sanctuary
vs. in-world restoration~~ → **in-world** (Sanctuary dissolved).
