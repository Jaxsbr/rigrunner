# RIGRUNNER — Milestones

Candidate milestones for the **official game**, discovered while building by exploration.

> ⚠️ **Pending & movable.** We have no committed roadmap yet (see `CLAUDE.md` → "build by
> discovery"). These are the ideas from `docs/ideas.md` that have firmed up enough to *aim at* — but
> scope, order, and inclusion can all still change. Nothing here is a promise. When a milestone is
> genuinely settled or delivered, reflect that in its status and, if it becomes core, in `CLAUDE.md`.

**Status legend:** `pending` (candidate, not started) · `active` (in progress) · `done` · `parked` ·
`superseded` (folded into a newer entry).

---

## Where we are → what's next

The game has shipped its **standalone mechanics** — collect, shop, dig, fight, heal (see *Shipped
foundations* at the bottom). The work now is **connecting them into a progression spine**: a
persistent real world you drive out into, heal, and progress through. That spine is the live roadmap,
phased in [`specs/real-world-and-progression-spec.md`](specs/real-world-and-progression-spec.md):

```
Phase 0    game/sandbox split + menu + persistence      ✅ done   (PR #67)
Phase 0.5  world shops (split UI + first rusty shop)     🟡 first slice shipped (PR #71)
──────────────────────────────────────────────────────────────── ← you are here
Phase 1    the designed cold-open (bowl · LOCKED cue · outpost)   ← NEXT
Phase 2    progression spine + restoration's purpose (region gates · balance/gating)
Phase 3    discovery surface (map · regions · harder enemies)
Phase 4    onboarding / guidance / story (deliberately last)
```

**The next 2–3 cycles, in order:**

0. **Pre-Phase-1 — lightweight collision (believability).** Make the rig physically collide with solid
   structures (piles, camps, shops, workshop, restored trees) instead of clipping through them — a small
   push-out-and-slide response layer on top of the collision detection the game already has. Small and
   self-contained, but it lands *before* the crafted cold-open, which has to read as believable. Spec:
   [`collision-spec.md`](specs/collision-spec.md).
1. **Phase 1 — the designed cold-open.** The single new bit of code is the **LOCKED-state cue**; the
   rest is the crafted bowl seed + the **outpost** (first cleared camp → forward base). A *legibility*
   phase — every verb is already built.
2. **Phase 2 — progression spine + restoration's purpose.** Mostly design + tuning (gating costs,
   region gates); closes [`observations.md`](observations.md) #17 (no balance/gating yet). Sketch its
   *design* during Phase 1 — the cold-open must teach the spine's first rung.
3. **Phase 3 — discovery surface.** Map + regions + harder enemies; cashes in
   [`render-scaling-spec.md`](specs/render-scaling-spec.md), camp **Phase 4**, and the parked
   energy/fuel system.

**Parallel tracks** (real work, off the spine's critical path): **MP Phases 3–5** (part
tiers/specials/set-bonus — identity & balance) and **camp Phase 4** (more levels + the scaling-enemy
hook, which Phase 3 consumes).

---

## How these fit together

The shipped foundations form a dependency chain: a **scrap economy** (M1) funds **purchases** (the
shop) → tools (the **Reclaimer**) **unlock scrap piles** → combat-capable rigs **clear looter camps**
→ cleared camps leave **`RestorableSite`s** the stump-healer **heals** → healed ground drives
**progression**. The spine phases are where those pieces stop being standalone and become one loop:
*drive out → gather what life needs → heal a place → the healed place + a better rig lets you reach
the next, harder place.*

The big-picture, *connective* view of how **maps, technology, restoration, and progression** interlock
lives in [`world-progression-guidance.md`](world-progression-guidance.md); the **phased plan** that
turns that vision into ordered work lives in
[`specs/real-world-and-progression-spec.md`](specs/real-world-and-progression-spec.md). This file holds
the **high-level direction** (which milestones we aim at, in what order); each entry points to its spec
for worked detail.

---

## The forward spine — phases

The live roadmap. Each entry is the high-level aim; the worked detail (scope, choreography, open
questions) lives in [`specs/real-world-and-progression-spec.md`](specs/real-world-and-progression-spec.md).

### Phase 1 — The designed cold-open · `pending` *(next)*

**What:** Craft the canonical **New Game**. A small, safe **bowl** with the workshop near the middle,
**contained by danger** (no fuel system yet — danger alone gates the edges), with an **outpost** out
in the danger as the carrot: the first cleared camp flipped into a **forward base** that hosts a world
shop. The cold-open quietly *is* the spine's first traversal — collect scrap → buy the **Reclaimer** →
work piles → buy a **weapon/armour** → survive the danger gradient → **claim the outpost**.

**The one new primitive — the LOCKED-state cue.** Every verb (collect, rummage, fight/ram, disarm,
heal) is already built; this is a **legibility** phase. Today a prompt fires only once you *own* the
tool and are aimed right, so an inert object can never teach you what it needs. The fix: an in-range-
but-you-lack-the-tool indicator (a faint dim-grey circle + a "Needs Reclaimer…" hint) — the sibling of
today's green/LIVE prompt. Teaching is by **arrangement** (placement + the LOCKED cue + the
self-describing shop), with **one** sanctioned popup (the first shop introduces itself once).

**Why:** Turns a half-state test seed into a crafted opening, and proves the spine's first rung is
learnable without narration.

**Depends on:** Phase 0 (done) + Phase 0.5's shop (shipped) — the first rusty shop is the cold-open's
first-purchase point.

### Phase 2 — Progression spine + restoration's purpose · `pending` *(the keystone)*

**What:** Commit the capability ladder (loose scrap → Reclaimer → piles → combat → camps → heal →
region gate) and decide **what restoration gives you** — decided 2026-06-10: **(a) restoring a region
unlocks the road to the next** (primary; the **world map is the progression tracker**) with **(c) a
healed patch as an immediate forward base** (sprinkled, so each heal pays off *now* and *later*).
Region gates are the new code; most of this is **design + tuning** (gating costs, drop tables,
sequencing).

**Why:** Closes [`observations.md`](observations.md) #17 — the first real **balance + gating**, and the
answer to "what's it all for."

**Absorbs the old M4 + M5:** **M4** (world-restoration vertical slice — the ancient tree) shipped its
first rung as the **stump-healer** (`features/restoration/`) and the rest is now this phase's (a)/(c)
restoration purpose; **M5** (map clearing → progression) is now this phase's region-gate plus Phase 3's
map. Both are expressed here rather than as separate goals.

**Note:** sketch the *design* alongside Phase 1 (the cold-open must teach the first rung); the
region-gate *implementation* lands with Phase 3.

### Phase 3 — The discovery surface · `pending`

**What:** Somewhere to progress *to* — a **map** (doubles as the restoration tracker from Phase 2a),
**multiple regions** gated by restoration, and **scaling / harder enemies** as the difficulty source
(the beyond-the-bowl threat the cold-open only hints at).

**Cashes in:** [`render-scaling-spec.md`](specs/render-scaling-spec.md) (spatial index + chunked
terrain, written for exactly this), **camp Phase 4** (more levels + the scaling-enemy hook), and the
parked **energy/fuel-as-signal** system (guidance §4 — fuel teaches "upgrade your energy system
first," it is not the gate).

### Phase 4 — Onboarding / guidance / story · `pending` *(deliberately last)*

**What:** The **narration** layer — speech bubbles, arrows, objective prompts, the story thread —
leading the player down the now-built spine. Phase 1 already teaches *silently by arrangement*; Phase 4
adds words on top of an opening that already works.

**Why last:** you can't guide a player down a spine that doesn't exist yet.

---

## Parallel tracks (off the spine's critical path)

### MP — Part identity: tiers, specials & engine vocabulary · `active`

**What:** A unified part-identity model on three axes — **slot** (display noun), **type**
(electric/steam, engines only), **tier** (rusty → iron → …, every part) — plus rare **"gold" part**
variants. Strips flavour names to slot nouns and diverges the two engine vocabularies; tiers are
per-sub-part, additive on a steep curve with a matched-set bonus; "specials" are rare *parts*, not
recipes.

**Why:** Pays down [`observations.md`](observations.md) #10 (workshop text-heavy/confusing) and #9
(recipe selector won't scale) — shape + colour carry identity instead of overloaded text — and lays the
rarity/material language the shop tiers, the loot table, and the future production chain share.

**Status:** Phase 0 (vocabulary), Phase 1 (tiers rusty → iron), Phase 1.5 (viewer upgrade) and
**Phase 2** (sub-part model coverage + composition via assembly sockets) are **built** — every sub-part
now ships as a real authored GLB, composed onto host frames in both the game and the viewer. **Phases
3–5 pending:** set bonus, specials (gold parts), more tiers — each earn-their-place gated, built in
order. Phase 2 (coverage) was the gate that unblocks them.

**Full spec:** [`part-identity-spec.md`](specs/part-identity-spec.md).

### Option D Phase 4 — More camp levels + the scaling-enemy hook · `pending`

Camps Phases 1–3 shipped (see *Shipped foundations*). Phase 4 is **more camp levels as data rows** plus
the **difficulty-scalar hook** on the enemy — fixed today, but stat-driven so Phase 3's **scaling
enemy** can drive it. Pairs with Phase 3 (harder regions need harder camps) and feeds the
restoration-investment that consumes the `RestorableSite`.

**Full spec:** [`looter-camps-spec.md`](specs/looter-camps-spec.md).

---

## Shipped foundations (done — kept for the dependency story)

> The standalone mechanics that proved the loop. Each was built **deliberately minimum** — worth
> playing the day it shipped, exposing interface *seams* (not connections) the spine now plugs into.
> Full detail lives in each linked spec and the dated `ideas.md` sessions / PRs; condensed to one entry
> apiece here.

### M1 — Loose scrap collection (the resource spine) · `done`
Scrap scatters across the world; driving the rig over a piece sweeps it into mounted `Storage`
(atomic, gated on a tank), with a HUD readout + visible fill (PR #2). The economy everything spends
against. Its spend destination became **Option B**; its felt cost became **Option A**.

### MW — Workshop interface + engine composition · `done`
Turned the workshop from "a second mounting grid that banks scrap" into a place you *work in*: an
openable, game-freezing overlay; a parts **inventory** + **assembly bench** (browse, inspect with a
rotatable 3D portrait, drag between inventory and bench); and **engine composition** — engines
assembled from four parts (casing · core · coupling · regulator) in two energy types (electric /
mechanical) under a **no-hybrid type-lock**. Electric = snappy scout/combat; mechanical = heavy hauler.
*Deferred (captured):* energy **source** parts + fuel/charge consumption (a built engine runs on
unlimited energy; only its type shapes feel), boost activation, the smelter/caster production chain.
**Full spec:** [`workshop-interface-spec.md`](specs/workshop-interface-spec.md).

### MD — Drivetrain rebalance: linear scaling + energy-type identity · `done`
Fixed [`observations.md`](observations.md) #11 — two damping algorithms made a 4th–6th engine a *net
loss*. Now `aggregateEngineOutput` is a straight per-attribute **sum** (two engines = twice one, six
give the most), engine output **is** performance (top speed = power, acceleration = torque), and the
electric/mechanical identity reads true with the masking gone. Weight was **parked** (the seam kept
computing) and **reattached by Option A**. The live tuning knob is the per-engine catalog
`power`/`torque`.

### Option A — Laden & Weighted (cargo has felt weight) · `done`
Cargo in mounted `Storage` contributes mass; **one effective-weight aggregation point**
(`effectiveRigWeight` = dry weight + live `cargoWeight`) feeds `rigPerformance`, so a full rig is
slower and slower to respond than an empty one — and because torque fights weight, the same cargo
barely dents a hauler but visibly slows a runner. The central felt tradeoff. **Seams left:** the
effective-weight point (any future load source — fuel, living-reward cargo — joins here) and a
**load-ratio signal** (`rigLoad`) the HUD reads now and a region/difficulty gate can read later.
*Tuning knobs:* `SCRAP_UNIT_WEIGHT`, `WEIGHT_DRAG`.

### Option B — Spend Sink (the Parts Shop) · `done` *(buying since moved to world shops)*
Closed the Build → Run → Build-better loop: a thin `buy(partId, cost)` transaction spends
`Wallet.scrap` and grants a catalog part to `Inventory` (sell-back at ~50%). **Seam left:** a generic
cost→grant transaction the production chain / workshop tiers / rare-recipe acquisition reuse. The
buying surface has since **moved out of the workshop into world shops** (Phase 0.5,
[`world-shops-spec.md`](specs/world-shops-spec.md)) — the workshop now builds/assembles/banks, it never
buys.

### Option C — Scrap Piles: the Reclaimer rummage · `done`
A world object you press-and-hold to **excavate** — gated behind owning the **Reclaimer** (a mounted,
directional articulated arm + swappable digging head) — that visibly depletes in waves, bursts
collectible scrap (drive-over-collected, reusing M1), and reveals data-driven loot when emptied. The
Reclaimer was the first **articulated** + **attached (socket)** + **composed non-engine** part; the
wrist socket *is* the restoration upgrade axis (the future tiller/seeder head is the same attach,
different head). **Seams left:** the **loot table as data** (Option D + rare-recipe scavenging reuse
it), a reusable **capability-gate** (`requires(partId)`), and a **"ground-cleared" signal** restoration
subscribes to. **Build plan:** [`option-c-build-plan.md`](specs/option-c-build-plan.md).

### Option D — Looter Camps: enemies around a structure · `done` (Phases 1–3) *· Phase 4 → parallel track*
The first **flee-or-fight** content and the first **enemy + combat** systems: a hostile structure with
simple enemies you engage or evade; clearing it drops loot (reusing Option C's table) and flips the
camp to `cleared`. Phase 2 added a real **trap arm + disarm** puzzle; Phase 3 added the environmental
mess (contamination bleeding past the camp) and the **on-clear teardown** — structures sink, a
sprouting **`RestorableSite`** rises (the restoration handoff). Plays well — [`observations.md`](observations.md)
#16. **Seams honoured:** loot-table reuse, a `cleared` signal restoration subscribes to, a
difficulty-scalar hook for the scaling enemy. **Full spec:**
[`looter-camps-spec.md`](specs/looter-camps-spec.md). (PRs #55–#57.)

---

## Longer-horizon milestones (from the guidance)

Beyond the spine phases, [`world-progression-guidance.md`](world-progression-guidance.md) carries a
list of **skeleton milestones** (title + one-line intent, all `pending` and movable) for the bigger
connective systems — **earned, upgradeable, persistent life-trails**; the **hybrid chunk-assembly
world**; **fuel as diagnostic signal**; the **scaling enemy + defensive progression**; **workshop
upgrade tiers**; **rare-recipe scavenging**; and the **energy-as-class** identity threads (both energy
types restorative · steam-not-exhaust · multiple rigs · class choice + retry replayability). The first
several have already been absorbed into the spine phases above; the rest live there (still raw) until
one firms up enough to promote into this file as its own entry — each carved into a *deliberately
minimum* first cut when it does.

**Superseded / parked** *(history in the dated `ideas.md` sessions):* the **Restoration Sanctuary** (a
separate 3D trophy area) and its **bring-from-world → apply-to-sanctuary** loop are **superseded** —
restoration lives in the persistent world, which *is* the tracker; the Sanctuary's **ecosystem-balancing
sub-game** (rats / soil-pH / crop levers) is **parked** (high intent, no current home, a depth reservoir
in-world restoration could draw on later).
