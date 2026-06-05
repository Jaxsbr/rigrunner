# RIGRUNNER — Milestones

Candidate milestones for the **official game**, discovered while building by exploration.

> ⚠️ **Pending & movable.** We have no committed roadmap yet (see `CLAUDE.md` → "build by
> discovery"). These are the ideas from `docs/ideas.md` that have firmed up enough to *aim at* — but
> scope, order, and inclusion can all still change. Nothing here is a promise. When a milestone is
> genuinely settled or delivered, reflect that in its status and, if it becomes core, in `CLAUDE.md`.

**Status legend:** `pending` (candidate, not started) · `active` (in progress) · `done` · `parked`.

---

## How these fit together

They form a rough dependency chain rather than a flat list: a **scrap economy** funds upgrades →
upgrades (tools) **unlock scrap piles** → combat-capable rigs **clear looter camps** → cleared camps
enable **world restoration** (the tree) → restoring a whole map drives **progression**. The "heal the
world / bring nature back" vision (in `ideas.md`) is the through-line they all serve.

The big-picture, *connective* view of how **maps, technology, restoration, and progression** interlock
now lives in [`world-progression-guidance.md`](world-progression-guidance.md). The near-term
**Options A–D** below are the **deliberately minimum** first cuts those larger systems will later
attach to — small, independent pieces, not the cross-system integration itself.

---

## M1 — Loose scrap collection (the resource spine) · `active`

**What:** Scrap pieces scattered across the world, blending into the terrain; **driving over them
collects them**. A low-importance, high-volume currency — you need a lot, you can't get it all at
once, it's a continuous little target while exploring. Spends on upgrades/parts. Needs a HUD readout.

**Why first:** It's the economy everything else spends against, and it's the simplest standalone
loop ("drive, collect, see the number grow").

**Status:** The *collection* half is in (PR #2, `cc356d6`) — scrap scatters in a ring, driving the
rig (chassis or any mounted part) over a piece sweeps it into mounted `Storage`, atomic per-piece and
gated on having a tank bolted on, with a HUD readout and a visible fill fraction. The economy
destination is now also in via **Option B (Spend Sink)** / the Parts Shop. **Still open before M1 is
`done`:** **Option A (Laden & Weighted)** — now **`parked` pending MD** (drivetrain rebalance first) —
plus minor deferred polish (collect FX, a run lifecycle/reset frame).

---

## MW — Workshop interface, parts inventory & engine composition · `active`

**What:** Two phases. **Phase 1** — an **openable workshop interface** (a tab appears in the workshop
zone; clicking it opens a game-freezing overlay) + a **generic parts inventory** on the player and an
**assembly bench**: browse owned parts, inspect them (details + rotatable 3D portrait, reusing the
viewer's display), and drag parts freely between **inventory** and **bench**. **Phase 2** — **engine
composition**: engines are **assembled from four parts** (casing · converter core · energy coupling ·
regulator) in **two energy types** (electric / mechanical) — 8 parts total — and **mounted on a
chassis** under a **no-hybrid type-lock** (a rig is locked to one energy type; a conflicting engine
won't snap until you remove the incumbent). The placeholder Mk1/Mk2 engines are retired in favour of
the two composed types.

**Why:** Turns the workshop from "a second mounting grid that banks scrap" into a place you *work in*.
Engine composition replaces the single Mk1→Mk2 choice with two distinct build identities (electric =
snappy/scout/combat; mechanical = heavy hauler) that keep weight central and serve the **physical
composition** pillar — success and *incompatibility* are both felt as parts snapping (or refusing to).

**Decided (2026-06-01):** the four-slot grammar, the two types, and the no-hybrid type-lock. The lock
will later extend to other components (energy weapons → electric chassis; some mechanical weapons →
mechanical chassis) — near-future, not MW.

**Deferred for MW (scope cut):** the energy **source** components (battery cell, fuel reservoir) and
all **fuel/charge consumption** — a completed engine runs on **unlimited** energy; only its *type*
shapes behaviour. The boost/overdrive special-ability *activation*, casing materials, and the
production chain (smelter/caster) are also deferred. (All captured in `ideas.md`, 2026-06-01.)

**Done when (verify in-game):** with the 8 engine parts acquired into inventory, build **both** a
complete electric and a complete mechanical engine on the bench, store them, **mount one and drive**
with type-correct feel, and confirm the **cross-type mount is blocked** until the first engine is
removed.

**Spans many PRs** (deliberately — see the spec). Ship Phase 1 first, feel it, then build Phase 2.

**Status:** Phase 1's shell, inventory browser, portrait, bench, deck staging, assembly, and
type-locked mounting are in across the MW PR series. The earlier P2 dev grant has been removed:
loose storage and engine sub-parts now come from **Option B's Parts Shop**, while the rig still starts
with one complete mounted electric engine so the player can drive immediately.

**Depends on:** the existing workshop zone + mounting (done). Basic part acquisition now uses the
Parts Shop spend sink; a future production chain can supersede that same cost/grant seam.

**Full spec:** [`workshop-interface-spec.md`](workshop-interface-spec.md) — known-parts list, engine
types, the type-lock rule, per-PR scope/files, and manual-test checklists.

---

## MD — Drivetrain rebalance: linear engine scaling + energy-type identity · `done`

**What:** Rip out the two algorithms that made adding engines *backfire*, and let engine output drive
performance directly — so more engines = more performance (top speed + acceleration), with the
electric/mechanical split finally legible. **Felt cargo weight (Option A) is parked behind this:** the
drivetrain had to be sane before weight could layer on without making the rig feel immobile.

**Why:** `observations.md` #11. With *zero* cargo, a 4th–6th engine of either type was a **net loss**:
`aggregateEngineOutput`'s `0.4ⁿ` falloff capped combined output at ~1.67× a single engine, while every
engine's own full weight dragged `rigPerformance`'s `mobility` down — so output plateaued as weight
climbed, and past ~3 engines each one *subtracted*. The detriment couldn't even be read as weight
(there wasn't any); it read as broken. It also masked the type differentiation the engine profiles
already encode.

**Done (2026-06-04):**
- **Linear engine sum** — `aggregateEngineOutput` is a straight per-attribute sum; `diminishingSum` /
  `ADDED_ENGINE_FALLOFF` deleted. Two engines are exactly twice one; six give the most.
- **Engine output IS performance** — `rigPerformance`: top speed = power, acceleration = torque,
  reverse = top speed × `reverseFactor`. The `mobility` / `WEIGHT_DRAG` tug-of-war is gone.
- **Weight parked, seam kept** — `totalRigWeight` still computes mass but nothing consumes it; it is
  the one-line seam Option A reattaches to (drive no longer imports it).
- **Energy-type identity — emergent, no new mechanic.** With the masking gone the existing profiles
  read true: **⚡ electric** (power 13 / torque 8) tops out faster — the *Runner*, rewards driving and
  fleeing; **⛽ mechanical** (power 8 / torque 19) accelerates harder — the *Hauler*, whose torque
  advantage becomes the weight-fighting/hauling advantage the moment Option A lands.
- HUD drops the now-parked weight line and the redundant torque line (top speed = power and
  acceleration = torque are 1:1); tests rewritten to lock in linear scaling, no-detriment-over-six,
  parked weight, and the type contrast.

**Known follow-up (tuning, not blocking):** removing the old mobility (~0.5×) raised absolute speeds —
single-engine baseline is faster than before, six engines markedly so. Per-engine catalog
`power`/`torque` are the live tuning knob; tune to feel.

**Deliberately NOT in scope:** felt cargo weight (→ Option A, parked), boost/overdrive specials,
per-type qualitative abilities, top-speed hard caps (superseded by "more engines = more"), and
speed-proportional coast deceleration (raised, deferred to keep this tight).

---

## The four near-term options (deliberately minimum)

These four are the strongest near-term candidates, mapped against
[`world-progression-guidance.md`](world-progression-guidance.md). They share one governing constraint:

> **Be deliberately minimum.** Build **small systems that stand on their own**, *not* large
> integrations that wire existing systems together. The guidance describes big connective systems (the
> Restoration Sanctuary, the production chain, the scaling enemy, region gating); these options are the
> small, independent pieces those will *later* attach to — built now without that wiring.

Each option must:

- **Do one thing, playably, by itself** — worth playing the moment it ships, even if nothing else changes.
- **Expose interface *seams*, not connections** — name the hook (an aggregation point, an event, a
  data table, a capability gate) that *lets* a future system plug in later, but **don't build that
  wiring now**.
- **Stay cheap to change** — minimal scope so it can be reshaped or reordered as discovery continues.

The sizing test: *could this ship as the only new thing this week and still be worth playing?* If yes,
it's sized right. If it only makes sense once three other systems exist, it's too big — cut it down.

---

## Option A — Laden & Weighted (cargo has felt weight) · `parked`

*(Promoted from M1's deferred "laden weight" item.)*

**Status (2026-06-04):** **Parked pending MD.** Layering felt weight onto the *old* drivetrain would
have made a loaded rig feel immobile — and the drivetrain was already mis-tuned (engines backfired
past ~3; see `observations.md` #11). MD fixes that first. The seam is held open: `totalRigWeight` is
kept live but unconsumed, so un-parking is the one-line re-wire in `features/drive/drive.ts` MD calls
out. Un-park once MD's higher absolute speeds are tuned to feel.

**Essence:** Scrap you're carrying makes the rig physically heavier — collecting has a felt cost.

**Minimum system (build this):** Cargo sitting in mounted `Storage` contributes to the rig's effective
weight, which `rigPerformance` then consumes (the seam `totalRigWeight` feeds — MD parked its
consumption but kept it computing) — so a full rig is slower and slower to respond than an empty one. A
single additive read (`Storage.amount` → a weight contribution) plus re-wiring weight back into
`rigPerformance`; no new downstream maths.

**Stands alone:** Immediately playable with only what's shipped (M1 collection + MW engines). It turns
"drive over scrap" from consequence-free into the central felt tradeoff, and produces the name-the-upgrade
thought the whole game runs on: *"I'm a slug when full → stronger engine, or less storage."*

**Interface seams (architect for, don't build):**
- **One effective-weight aggregation point** any *future* load source can contribute to — fuel weight,
  living-reward cargo (guidance §3b) — without re-plumbing the drive feel.
- **A load-ratio signal** (current/capacity) the HUD reads now, that region/gating difficulty
  (guidance §1) and the fuel signal (guidance §4) can later read to gate or teach.

**Guidance fit:** the **Load capacity** axis (§2) and the central weight tradeoff that powers
region/gating difficulty (§1) — "acquiring a capability costs weight." The smallest possible down-payment
on that whole tension.

**Deliberately NOT in scope:** fuel weight, centre-of-mass / balance, the gating system itself.

---

## Option B — Spend Sink (scrap buys something) · `done`

*(Promoted from M1's deferred "spend sink" item.)*

**Essence:** Collected scrap finally has a destination — you spend it to get a part.

**Minimum system (build this):** One thin transaction at the workshop — **spend N scrap (from `Wallet`)
→ receive a basic part into `Inventory`** — replacing, for at least one part, the MW **dev grant** that
currently fabricates parts for free. One buy action, one cost, one grant.

**Stands alone:** Closes the Build → Run → Build-better loop with only systems already shipped
(collection, `Wallet`, `Inventory`, the workshop overlay): drive → collect → **spend** → build a better
rig. Today scrap is a number with nowhere to go; this gives it a sink.

**Interface seams (architect for, don't build):**
- **A generic "transaction" seam** (cost in scrap → grant an owned thing) that the future **production
  chain** (guidance §2: smelter/caster that *make* parts), **workshop-upgrade tiers**, and **rare-recipe
  acquisition** can all reuse. Keep it a thin `buy(partId, cost)` so the production chain can later
  supersede it exactly as it supersedes the dev grant — no rework.

**Guidance fit:** the **technology-progression** spine (§2) — the dev grant is explicitly a stand-in for
a scrap-fed production chain, and this is its first real rung; also the **cheap, per-outing gains** tap in
the progression model (§4), distinct from durable structural gains.

**Deliberately NOT in scope:** the smelter/caster production chain, alloy processing, workshop tiers,
recipe rarity. Just one scrap→part transaction and the seam.

**Status (2026-06-02):** Delivered as a **Parts Shop** tab in the workshop overlay. A thin
`buy(partId, cost)` transaction spends `Wallet.scrap`, spawns the catalog part, and grants it to
`Inventory`; loose inventory parts can be sold back for 50% of their stock price, rounded to the
nearest whole scrap. A dedicated part-cost list drives the shop stock: it sells the storage shell/rim
plus all electric and mechanical engine sub-parts, with engine parts priced above storage parts. The
loose-part dev grant is removed, the player starts with only a complete mounted electric engine and 5
scrap for the first storage container, and the world scatters enough loose scrap to buy additional
storage.

---

## Option C — Scrap Piles: the Reclaimer rummage · `done`

*(Formerly **M2** — same intent, framed minimum-first. Reclaimer concept firmed 2026-06-02.
**Delivered 2026-06-03.**)*

**Essence:** A distinct world object you press-and-hold to *excavate* — gated behind owning the
**Reclaimer** — that visibly depletes as you work, bursting collectible scrap out around the rig and
revealing hidden non-scrap loot from a data-driven loot table.

**Status (2026-06-03):** **DONE.** All five PRs in the build plan are merged: the articulated
arm+bucket assets (PR1), the game-side articulation runtime (PR2), the Reclaimer as an assembled /
mountable / purchasable part (PR3), the capability-gated hold-to-work rummage (PR4, + a proximity
"Hold E" hint in PR4.5), and the data-driven loot table with its reveal-and-grant UI and the
ground-cleared seam (PR5). The build→run gate it set out to prove ("locked until you build the right
tool, then point it") is in and playable.

**Build plan:** the full PR-by-PR record lives in
[`option-c-build-plan.md`](option-c-build-plan.md) — now a historical staircase, all steps `done`.

### The gating tool — the Reclaimer

A **mounted, directional manipulator arm with a swappable digging head** (the **unearthing bucket**,
for now). It is the capability that unlocks pile interaction.

- **Why this part.** A pile bursts scrap *outward* (you then drive-over-collect it, reusing M1), so the
  tool's job is to **break/disturb**, not gather inward — which rules out a "scrap magnet." An arm is
  **directional and physical** (pillar 3): you must *face* the pile to reach it, and placement matters.
- **Why the name.** "Reclaim" bridges **scrap-salvage** *and* **area-reclamation** — the leaning
  progression *gate* (guidance §4). One part name carries the through-line: **reclaim scrap now, reclaim
  land later, with the same instrument.**
- **The restoration future is a head swap, not a bolt-on.** Excavating a pile *clears that patch of
  ground.* Later the **same arm** takes a **tiller/seeder head** that breaks dead ground and lays soil
  (**life-trails** §3a, **camp-to-restored-ground** §3). The **arm is the durable structural part; the
  head is the upgrade axis.** Same verb (disturb earth → expose clean soil), two targets.

### The rummage — hold-to-work

Press-and-hold near a pile (facing it): the **pile visibly depletes** in waves (**tactile
transformation**, pillar 4 — like resource nodes), spitting **scrap** out around the rig as you work.
That scrap is **drive-over-collected reusing M1**, and is **gated on storage space** (no room → it
can't be swept up). When the pile is **emptied**, its **hidden loot** (the non-scrap finds) is rolled
from a **data-driven loot table** and shown in a **loot UI**; those parts are **granted to `Inventory`
when the UI is closed.**

**Loot tiers (data-driven):** ordinary **scrap** (100%, the scattered burst), **sub-parts** (common),
**full parts** (rare), **unique recipes** (epic — *future*, the slot exists in the table now but the
recipe system isn't built).

### The Reclaimer is three "firsts" (the real build cost lives here)

The concept above is cheap; the Reclaimer is the **first part that breaks several single-static-GLB
assumptions** at once. Naming these now so the work isn't a surprise:

- **First *articulated* asset (animation).** Every shipped part is one static GLB through the
  `Renderable {shape:'model'}` seam. The arm is a **hierarchy of separately-moving pieces**
  (base/yaw → boom → bucket). **Decided: procedural, game-driven joints** — the GLB ships a **rigged
  hierarchy of named nodes with correctly-placed pivots**, and the **game rotates the joints each frame**
  to run a **hold-to-work dig loop that aims at the actual pile** (no baked Blender clips). This needs:
  a joint **naming/pivot convention in `asset-style.md`**, articulated-GLB support in the `blender-asset`
  skill / `rr_style.py` kit (which build static GLBs today), a **loader path that exposes named sub-nodes**
  (the current loader returns one opaque model), and ideally **viewer** support to watch it move.
- **First *attached* asset (the socket).** The unearthing bucket is **not part of the arm mesh** — it
  **attaches at a named wrist socket and inherits the wrist transform** during animation. That socket
  **is** the restoration upgrade axis: the future tiller/seeder head is *the same attach, a different
  head.* Build the socket correctly now and the swappable-head future is essentially free.
- **First *composed non-engine* part (assembly).** **Decided: the Reclaimer is assembled from two
  parts** — the **arm** (articulated frame + wrist socket) and the **unearthing bucket** (head) —
  **on MW's existing assembly bench**, then **mounted on the chassis** (directional). Reuses MW's
  assembly + mounting; the new work is a small **non-engine socket grammar** (a head-socket alongside
  the engine's four-slot grammar).

### Parts & costs (the two line items)

Both parts go in **Option B's part-cost list** (the Parts Shop), so the Reclaimer is **acquired by
buying the arm and the bucket**:

- **Reclaimer arm** — the durable structural part (articulated frame + wrist socket). Higher cost.
- **Unearthing bucket** — the digging head that slots into the wrist socket. Lower cost.

**The hard economy constraint — bootstrapping.** Piles are gated behind *owning* the Reclaimer, so its
total cost must be **affordable from loose scrap alone (M1)** — you can't rummage your way to the tool
that lets you rummage. It's a **save-up goal funded by drive-over loose scrap**, priced above storage.
Exact numbers are build-time tuning. Future heads (tiller/seeder) are just **more entries on the same
socket** in that cost list, later.

### Stands alone

Self-contained against the current parts/inventory systems. Adds the first *interaction-gated* reward
("locked until you build the right thing"), the satisfying excavate-and-deplete beat, and reuses M1's
scatter-collect — with no dependency on enemies or restoration.

### Interface seams (architect for, don't build)

- **The loot table as data** — a roll-on-a-table seam that **Option D** (enemy drops) and **rare-recipe
  scavenging** (guidance §2) reuse unchanged.
- **A reusable capability-gate** (`requires(partId)` to interact) that region/gating difficulty
  (guidance §1) and other gated interactions can later reuse. No tool → the interaction is visibly locked.
- **A "ground-cleared" signal** the pile emits when emptied — the hook **restoration**
  (camp-to-restored-ground §3) subscribes to *later* to heal that patch, **without Option C knowing
  anything about restoration.** The pile just publishes "I'm cleared," nothing more.

**Guidance fit:** feeds **rare-recipe scavenging** (§2 — piles are a natural place rare recipes drop),
reinforces the "I know exactly what to change" tool-gating loop (§2), and plants the Reclaimer as the
first rung of the **reclaim-scrap → reclaim-land** through-line (§3/§4). Its loot table becomes the
shared currency of every drop in the game.

**Deliberately NOT in scope:** the **tiller/restoration head** itself, enemies, the full recipe-rarity
system, **multiple tool types**, and any **energy-type flavour** of the Reclaimer. One gated pile + one
Reclaimer + one data table.

**Decided this session (2026-06-02):** the unearthing-bucket head (over "salvage claw"); **procedural
game-driven joints** for the arm; **assembled from arm + slottable bucket** on MW's bench; and
**acquired by buying both parts** in Option B's Parts Shop.

**Resolved sub-questions (decided at build time):**
- **Loot-roll shape** — ✅ **independent per-tier rolls** (a pile can yield from several tiers, or
  none), in `content/loot-table.ts`.
- **Inventory-full handling** — ✅ **n/a for now**: `Inventory` is an uncapped list, so the grant is
  unconditional. Revisit (drop / block / overflow) only when inventory gains a capacity.
- **Reclaimer cost numbers** — ✅ arm **24** + bucket **12** = **36** scrap (above a container's 5,
  ≈ a whole engine), reachable from loose scrap alone; weight 8. Tunable in `content/part-costs.ts`.
- **Articulation detail** — ✅ a 3-joint arm (yaw → boom → wrist) driving a procedural dig loop that
  blends stow↔dig, with the bucket on the wrist socket (tuned against the viewer).

**Held for tuning, not blocking:** the sub-part drop **chance is 50%** (raised from 25% while we test
the loot loop) — one value in the loot table, easy to bring down for feel later.

**Depends on:** the parts/inventory system (shipped) to own the Reclaimer and receive loot; M1's
scatter-collect (shipped) for the scrap burst; pairs naturally with **Option B** (a way to acquire the
Reclaimer).

---

## MP — Part identity: tiers, specials & engine vocabulary · `pending`

**What:** A unified part-identity model on three orthogonal axes — **slot** (the display noun), **type**
(electric/steam, engines only), and **tier** (rusty → iron → …, every part) — plus rare **"gold" part**
variants. Strips the confusing flavour names to slot nouns; **diverges** the two engine vocabularies so
no noun is shared (electric: Casing/Core/Coupling/Regulator · steam: Boiler/Piston/Driveshaft/Throttle);
makes tiers **per-sub-part + additive on a steep curve with a matched-set bonus**; and reworks "specials"
from rare *recipes* into rare *parts* (a proportional, carried-forward buff).

**Why:** Directly pays down `observations.md` #10 (the workshop is text-heavy / confusing) and #9
(recipe selector won't scale) — shape and colour carry identity instead of overloaded text — and lays
the rarity/material language the loot table (Option C), the shop, and the future production chain all
share. Tiers give the deferred smelter/caster its reason to exist.

**Decided (2026-06-03):** the engine vocabulary split + flavour-name strip (Phase 0); the additive
per-part tier model with set bonus; specials as gold parts, not recipes. The mechanic phases (set
bonus, specials, more tiers) are **earn-their-place gated** — built in order, felt before the next.

**Status (2026-06-05):** Phase 0 (vocabulary) and Phase 1 (tiers, rusty → iron) are **built** — Phase 0
merged, Phase 1 in review. The committed next step is **Phase 2 — sub-part asset completeness**: every
sub-part the game has today gets its own 3D model and is fully visible/usable in the UI. It **gates**
the remaining mechanic phases (now Phases 3–5: set bonus, specials, more tiers) — no new tier, special,
or set bonus until every current part is modelled. See the spec's §5 for the sub-part coverage map.

**Full spec + phased plan:** [`part-identity-spec.md`](part-identity-spec.md) — the three-axis model,
data-model changes against the current seams, the PR-by-PR phases, and the open forks.

**Depends on:** the parts/recipe/assembly system (shipped — and friendlier than expected: `sumPartStats`
is already additive, recipes are data-driven on arbitrary slots, `dismantle` already powers the
upgrade/swap loop). Pairs with the workshop-UX pass (`observations.md` #10) and Option C's loot table.

---

## Option D — Looter Camps: enemies around a structure · `pending`

*(Formerly **M3** — same intent, framed minimum-first.)*

**Essence:** A hostile structure with simple enemies — the first real flee-or-fight, and the first thing
whose *clearing* the world can later react to.

**Minimum system (build this):** A camp (a structure + a few simple enemies that can hurt you); engage or
evade; **clearing it drops loot** and flips the camp to a **`cleared` state**. Start with a single fixed
enemy type and the simplest combat that proves flee-or-fight — no scaling, no vehicle AI.

**Stands alone:** Activates the **flee-or-fight** pillar against a real threat with the current rig, and
makes offense/defense parts matter. Combat is its own small system (enemy + projectile + damage), valuable
the day it ships.

**Interface seams (architect for, don't build):**
- **Drops reuse Option C's loot table** — no new drop system.
- **A `cleared` signal** the camp emits on defeat — a flag/event that **restoration** (guidance §3
  camp-to-restored-ground; §3b the Sanctuary) can *later* subscribe to, so clearing a camp can heal the
  ground around an old stump **without Option D knowing anything about restoration**. The key seam: the
  camp publishes "I'm cleared," nothing more.
- **A difficulty-scalar hook** on the enemy — fixed for now, but stat-driven so the **scaling enemy /
  defensive progression** system (guidance §4) can later drive it.

**Guidance fit:** the seam into **restoration** (§3 camp-to-restored-ground), the anchor for the **scaling
enemy + defensive progression** difficulty source (§4), and the **offense/defense** axes (§2). Ships
*before* any of those — it just leaves the doors open.

**Deliberately NOT in scope:** enemy scaling, vehicle enemies / advanced AI, restoration wiring, multi-camp
world placement. One small, clearable camp that drops loot and announces it's cleared.

**Depends on:** the rig's weapon/defense parts; reuses the loot-table seam from **Option C**.

---

## M4 — World restoration vertical slice: the ancient tree · `pending`

**What:** Some camps sit around an **ancient tree** the bandits pollute, preventing its growth.
Clear the camp — possibly plus a **small quest** to provide what the tree needs — and the tree
**grows**, visibly **restoring that patch of world**. The first concrete proof of the "heal the
world" pillar: clear corruption → nurture nature → the world heals.

**Why:** This is the heart of the game's identity (restoration over endless scrapping). Worth a
deliberate vertical slice to find out whether the restoration fantasy actually lands.

**Guidance:** [`world-progression-guidance.md`](world-progression-guidance.md) §3 massively expands this
beyond a single tree — life-trails, the separate **Restoration Sanctuary**, and an ecosystem-balancing
sub-game. M4 stays the *minimum* first proof; the sanctuary work is the longer-horizon set (see end).

**Depends on:** **Option D** (clearing a camp). Introduces quests and persistent world-state change.

---

## M5 — Map clearing → progression · `pending`

**What:** Clearing an entire map's obstacles/challenges/corruption **unlocks progression** to a new
level / new map. Restoration is the through-line of progression, not just side content.

**Why:** Turns the per-area restoration beats into a game-length arc and answers "what's it all for."

**Guidance:** [`world-progression-guidance.md`](world-progression-guidance.md) §4 reframes the progression
*gate* toward **area reclamation tracked in the Sanctuary** (with fuel as a *teaching signal*, not the
gate) — a richer answer to "what's it all for" than map-clearing alone.

**Depends on:** enough of M1–M4 to make "a map" meaningfully clearable.

---

## Longer-horizon milestones (from the guidance)

Beyond these near-term options and M4/M5, [`world-progression-guidance.md`](world-progression-guidance.md)
carries a list of **skeleton milestones** (title + one-line intent, all `pending` and movable) for the
bigger connective systems — the **Restoration Sanctuary**, the **bring-from-world → apply-to-sanctuary**
meta-loop, **life-trails**, **hybrid chunk-assembly world**, **fuel as signal**, the **scaling enemy**,
**workshop upgrade tiers**, **rare-recipe scavenging**, and the **energy-as-class** identity threads.
They live there (still raw) until one firms up enough to promote into this file as its own entry — and,
true to the principle above, each should be carved into a *deliberately minimum* first cut when it does.
