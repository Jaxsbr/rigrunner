# S-D — Roadmap & Game-Design Fit (Synthesis Brief, Area D)

**Synthesizer role:** Does Option B serve where RIGRUNNER is *going* — the pending roadmap, the
core build→run loop, and the "complexity earns its place" discipline?
**Proposal under review:** `docs/architecture/feature-first-structure-proposal.md` (Option B).
**Primary inputs:** research L6 (roadmap pressure), W5 (UI growth), W3 (comparable games / scene
handling), corroborated against the live code and the roadmap docs (`docs/milestones.md`,
`docs/world-progression-guidance.md`, `docs/ideas.md`, `docs/part-identity-spec.md`).
**Date:** 2026-06-04
**Verdict: (b) ALTER Option B** — one structural alteration (carve the pure-computation half of
`assembly.ts` into `common/sim/`), two pre-decisions to record before the relevant feature ships
(`Health` placement; the Sanctuary triggers a `main.ts` `GameMode` refactor, *not* a slice change).
The roadmap does **not** argue for an alternative direction, and does **not** justify front-loading
any structure the discovery-mode project doesn't yet need.

---

## 1. The question this brief answers for the three reviewers

Structure that fits today's 74 files but fights tomorrow's mechanics is a bad trade for a
build-by-discovery project. So the load-bearing question is not "is Option B clean now" (the L1–L5
researchers establish that it is) — it is: **as the roadmap lands, does code fall into Option B's
folders naturally, or does the roadmap repeatedly force cross-feature imports, premature
abstraction, or a structural rewrite?**

The answer, item by item below: the roadmap lands cleanly, with exactly **one** spot where the
proposal's current file assignment will be forced open — and that spot is forced open by the *next*
milestone (MP), and is in fact **already** strained by shipped code today. Everything else is
either a clean new slice or a `main.ts` (composition-root) concern that Option B does not block.

---

## 2. Each near-term item: where it lands under Option B, and does B absorb it cleanly?

The pending work, in roughly roadmap order. "Strain" = does it force a cross-feature import, a
premature abstraction, or a structural rewrite that Option B's shape causes or fails to prevent.

### 2.1 Option A — Laden & Weighted (`pending`) — **clean, zero strain**

The minimum system (`milestones.md` §Option A) is a single additive read: `Storage.amount` → a
weight contribution that the already-shipped `Weight → aggregateEngineOutput/rigPerformance`
pipeline consumes.

| Piece | Lands at | Note |
|---|---|---|
| `Storage.amount` → weight contribution | `features/storage/` | a new export or a widening of `storage.ts` |
| The effective-weight aggregation point | `common/sim/weight.ts` | already a declared kernel primitive — **weight is *the* proven tradeoff axis**, so it belongs in the kernel by definition |
| Load-ratio HUD signal | `features/hud/stats-hud.ts` reads it | |

This is the best possible case for Option B: the milestone *explicitly asks* for "one effective-weight
aggregation point any future load source can contribute to" (fuel weight, living-reward cargo). Option
B already names `common/sim/weight.ts` as that point. The seam the designer wants and the structure
the proposal draws are the **same line**. No new slice, no cross-feature edge.

### 2.2 MP — Part Identity: tiers, specials, engine vocabulary (`pending`) — **minor strain → the one alteration**

This is the only near-term item that strains B's *current file assignment*, and it does so because
the proposal under-specifies one boundary. Per `docs/part-identity-spec.md`, MP adds a `TIERS` table,
a per-instance `tier` field, additive-with-set-bonus stat resolution in `sumPartStats`/`buildProduct`,
and gold "special" parts that drop from Option C's loot table.

The problem is concrete and already real in the code. `systems/assembly.ts` (263 lines) mixes two
different kinds of function:

- **Pure computation** (no inventory/bench state): `sumPartStats`, `resolveEnergyType`,
  `buildProduct`, `composeProduct`.
- **Workshop interaction** (inventory + bench effects): `assemble`, `dismantle`, `isBenchComplete`,
  `assembleVerdict`, `benchEnergyType`, `acceptsType`.

The proposal (§3 structure block) places **all** of `assembly.ts` in `features/workshop/`. But the
pure half is **already** consumed outside workshop today — verified by tracing the symbols:

- `composeProduct` is imported by `content/engines.ts` and `content/containers.ts` (the seeding
  path that spawns the starting electric engine and storage shells). Under B, those files move to
  `features/engine/` and `features/storage/`. So on day one of the migration,
  **`features/engine/` and `features/storage/` would import from `features/workshop/`** — a
  sideways feature→feature edge that Option B exists to forbid.
- MP makes this strictly worse: scrap loot grants tiered parts (`features/scrap/`), the shop prices
  them by tier (`features/economy/`), and the HUD may surface stats (`features/hud/`). Each of those
  would have to reach into `features/workshop/` for `sumPartStats`/`buildProduct`.

**The alteration (the one structural change this brief asks for):** split `assembly.ts` along the
seam it already has. Pure stat computation → `common/sim/assembly.ts`
(`sumPartStats`, `resolveEnergyType`, `buildProduct`, `composeProduct`). Inventory+bench interaction
→ `features/workshop/` (`assemble`, `dismantle`, `isBenchComplete`, `assembleVerdict`,
`benchEnergyType`, `acceptsType`). The `TIERS` table sits next to `parts-catalog.ts` in
`common/parts/`; the `tier` instance field on the existing common `part`/`engine-part` component.

This is a **refinement of B's own `common/sim/` intent**, not a deviation — and it should be done at
migration time, because it is forced by code that already ships *and* by the very next milestone. (L6
§2.2/§3.1 and L4 reach the same conclusion independently; L4 also flags the twin case
`spawnEnginePart`/`engine-part.ts`, which is called by storage, Reclaimer, and loot grants and
likewise wants promotion to `common/parts/`. Both are the same lesson: catalog-level spawn/compute
primitives are kernel, not workshop.)

The visual half of MP (tier-finish tints, type badges, gold sheen on chips/portraits/world models)
is a clean fit: the tier *data* is in `common/parts/`; the tier *rendering* is a workshop-UI concern
in `features/workshop/` (chips) plus a shared tint utility in `common/render/` for the cases shared
across chips, portraits, and world models (W5 §5, L6 §2.5). No cross-feature edge.

### 2.3 Option D — Looter Camps + COMBAT (`pending`) — **low strain; the brand-new-feature test, which B passes**

This is the headline stress case: combat has **no current folder and no current analog** (verified:
the only `*damage*`/`*health*` match in `components/` is `collider.ts`; there is no `Health`
component). Under role-slicing, "where does combat go?" is a per-file decision cost —
`systems/enemy-ai.ts` into the flat 25-file `systems/` pile, `components/health.ts` into the flat
28-file `components/` pile, enemy render scattered into `render/`. Under Option B the answer is one
folder: **`features/combat/`** owns the camp entity, enemy + enemy-AI, projectiles, the damage
system, weapon/armor parts, and combat render. This is exactly what an open-ended `features/` tier is
*for* (W3 §7 calls "no folder for combat" the most important roadmap case, and B answers it with zero
ambiguity).

Cross-feature edges combat introduces, all downhill and legal:

- projectile collision → `common/components/collider.ts` + `common/sim/collision.ts` (combat becomes
  collision's **second consumer** — this is the live argument for putting `collision.ts` in
  `common/sim/` at migration time rather than parking it in `scrap/`; L4 §combat, proposal §4 call 3);
- damaging mounted parts → queries the world via `common/.../mount-grid` (clean);
- weapon/armor parts → more rows in `common/parts/parts-catalog.ts` + recipes on the existing
  `features/workshop/` bench (clean);
- loot on clear → reuses `features/scrap/loot-table.ts` unchanged (the seam Option C deliberately
  left open).

**The one pre-decision (record it before D ships, not at migration):** the `Health` component. The
minimum-system spec says "a few simple enemies that can hurt you" — which implies the rig has health,
making `Health` cross-feature (combat damages it; future restoration/repair reads it). If rig damage
is in scope, `Health` → `common/components/health.ts`. If enemies only "end the run" without damaging
individual parts, `Health` can start in `features/combat/`. Either is structurally fine; the cost of
guessing wrong is a later promotion, not a rewrite. **Do not pre-create `features/combat/`** at
migration — that would be speculative and violate "complexity earns its place" (L6 §3.3).

### 2.4 M4/M5 — World Restoration + Map Clearing (`pending`) — **low strain; the ECS signal seam does the work**

M4 (ancient tree reacts to a cleared camp; visible growth; maybe a small quest) and M5 (map-wide
cleared-state → unlock next map) land in a clean new `features/restoration/` slice. The critical
inter-feature link — restoration reacting to combat — is handled by the ECS data model, **not** an
import: the camp publishes a `cleared` flag as data on a world entity (the seam Option D explicitly
defines as "the camp publishes 'I'm cleared,' nothing more"), and `features/restoration/` queries
that flag from the `World`. No `restoration → combat` import. This is the ECS pattern operating as
intended (L6 §2.4) and is the structural reason B can keep restoration and combat as separate
slices that never reach into each other.

### 2.5 The Restoration Sanctuary (longer-horizon) — **no strain on slice structure; it triggers the deferred `main.ts` refactor (a composition-root concern)**

This is the one item that touches genuinely deferred architecture, so it deserves the most care — it
is the place a reviewer might wrongly conclude "B should anticipate scenes."

`world-progression-guidance.md` §3b is explicit: the Sanctuary is "a separate, persistent,
**menu-visited** place, **NOT rendered inside a run**" — the game's second distinct loop-mode and the
progression *tracker*. And `ideas.md` (2026-06-01, lines 201–235) deliberately defers scene/game-mode
architecture, with a named **revisit trigger**: *"When a second loop-mode appears … introduce a
`GameMode` / sim-gate concept (likely `stepSimulation()` + `renderFrame()` split, gated by a mode
enum), not Phaser-style scenes."* **The Sanctuary is precisely that trigger.**

The code confirms the trigger sits in the composition root, not the slices. `main.ts` today owns a
single `paused` flag (the boolean OR of `workshopPaused` and `lootPaused`), one `requestAnimationFrame`
loop, and one `World`. That is the "one world + modal interface mode" shape W3 §3 finds is *correct*
for a shared build↔run loop (Pacific Drive — the closest commercial analog — does the same: garage and
zone share one persisted car, mode is a modal state change, not a scene reload). When the Sanctuary
ships it will likely want its own `World`/render context and a `GameMode` dispatcher extracted from
`main.ts`'s frame loop.

**Why this is not a reason to alter B's slice structure:** extracting `GameMode` is a `main.ts`
change — the composition root is already the single cross-feature wiring point, and growing it into a
mode dispatcher does not move or reshape any feature. `features/sanctuary/` is a clean future slice
that B accommodates without anticipation. The correct posture is exactly what `ideas.md` already says:
**don't design for scenes yet**; B neither forces the scene system early nor blocks it later
(L6 §2.4/§3.4, W3 §3/§7). A reviewer should resist any "add a `modes/` tier now" temptation — that
would front-load deferred structure the project has explicitly chosen not to build.

### 2.6 Workshop-UX pass (observations #9, #10) — **no strain; B *helps* the big overlay**

See §3 (this is the per-feature-UI question and gets its own section).

### 2.7 Longer-horizon stubs — all clean, none force a slice now

Life-trails → `features/drive/` (the drivetrain lays them) or `features/restoration/` (the effect);
hybrid chunk-assembly world → a future `features/world/` or `main.ts` world-composition; energy
sources (battery/fuel — explicitly scope-cut from MW) → a future `features/energy/` or an extension
of `features/engine/`. None forces a slice to exist at migration; each is "complexity earns its
place" operating as intended (L6 §3.5/§3.6).

### Pressure map (the at-a-glance table for reviewers)

| Roadmap item | Strain on B | The call to make |
|---|---|---|
| Option A — Laden Weight | **None** | aggregation point = `common/sim/weight.ts` (already named) |
| MP — Part Identity | **Minor → the alteration** | carve pure compute out of `assembly.ts` into `common/sim/` *at migration* |
| Option D — Combat | **Low** | pre-decide `Health` placement when D ships; do **not** pre-create the slice |
| M4/M5 — Restoration | **Low** | `features/restoration/` reads camp `cleared` flag via World; no import |
| Restoration Sanctuary | **None on slices** | triggers the deferred `GameMode` extraction in `main.ts` — composition root, not slice |
| Workshop-UX pass | **None** | all in `features/workshop/`; tier-finish tint utility in `common/render/` |
| Life-trails / energy / chunk-world | **Low/None** | new slices when they ship |

---

## 3. Per-feature UI placement: does it help or fragment the big workshop overlay?

This is the sharpest design-fit question, because `ui/workshop-overlay.ts` (1,012 lines, the largest
file in the repo) is a genuine **multi-feature hub** and the workshop-UX pass + MP will both push it
to grow. The instinct "feature-first means each tab goes to its feature" would *fragment* it. The
research is unambiguous that B does the opposite — **if applied correctly** — and the proposal already
has it right implicitly. The job here is to make it explicit so an agent doesn't do the wrong thing
during the UX pass.

**Why the overlay belongs whole in `features/workshop/`.** The overlay imports from assembly (bench),
staging + mounting (deck), and economy (shop) — it is the one screen where build/assemble/stage/buy/sell
converge (W5 §2/§4). Feature-Sliced Design's downward-only rule (W5 §3.1) says a composition that
spans features is a "Widget"/hub that lives at its consuming level, **not** split into the features it
reads. Splitting the three tab-renderers into `features/economy/ShopPanel`,
`features/mounting/DeckPanel`, `features/engine/BenchPanel` would create exactly the **sideways
feature→feature arrows** B forbids — `ShopPanel` alone reaches inventory + wallet + parts-catalog +
shop systems (W5 §3.6). So all three tabs stay in `features/workshop/`.

**Why B *helps* the UX pass rather than fragmenting it.** The overlay already carries its own
decomposition as six banner-comment sections (Tabs / DOM-construction / Parts-Shop / Deck /
Drag-and-drop / helpers — W5 §1). Option B's only contribution is to give `workshop/` a **folder**
instead of a flat `ui/` file, so the natural sub-panel extraction (`bench-panel.ts`, `shop-panel.ts`,
`deck-panel.ts`, `inventory-rail.ts`, `item-chip.ts`, a scalable `recipe-selector.ts`) happens
*inside one slice* with no cross-feature boundary to cross. The coordinator (`WorkshopOverlay`) keeps
the cross-panel state (selected, tab, and especially the drag ghost, which originates in the rail and
lands in bench or deck) — the Mediator pattern (W5 §3.2/§3.4). The two pending UX cases both come out
clean: the scalable recipe selector (obs #9) → `features/workshop/recipe-selector.ts` reading
`common/parts/`; the tier/gold chip visuals (obs #10 + MP) → `features/workshop/item-chip.ts` reading
tier data from `common/parts/` (W5 §5).

**The one explicit addendum for §4 of the proposal** (W5 §8): state that the three tab-renderers
(bench, shop, deck) stay inside `features/workshop/` and are **not** split into their feature slices,
and that internal sub-panel extraction is the correct UX-pass move. This pre-empts the most likely
agent/human mistake ("move ShopPanel to economy/ because it's about money").

`stats-hud.ts` → `features/hud/` is the correct home for the cross-cutting readout (engine + drive),
analogous to FSD's Widgets layer for legitimately multi-feature display (W5 §7).

---

## 4. Does B serve the core build→run loop and "complexity earns its place"?

**The loop:** Yes, and the comparable-game evidence is direct. RIGRUNNER's build↔run is a *modal
state change on shared entity data* (one rig, one world, one wallet persist across the modal freeze) —
verified in `main.ts`'s single-`World`, single-`paused`-flag frame loop. W3 §3 finds every comparable
indie at this scale (Pacific Drive, shapez.io, the roguelites) implements build/run as a modal state
machine on one world, never a scene reload, and that a reload would needlessly destroy the shared rig
data. Option B keeps all features in one module tree reading the same `common/` components, with
`workshop/` and `drive/` as peer slices — which is exactly the shape the loop wants. The build→run
beat is *strengthened* by Option B's legibility: an agent diagnosing "the run felt too slow when
full" opens `features/storage/` + `features/drive/` + `common/sim/weight.ts` rather than scanning five
role folders (W4's agent-navigability finding; W3 §8). Feature legibility shortens the
build→diagnose→build-better cause-and-effect that the game's fun depends on.

**"Complexity earns its place":** Yes — and this is the strongest argument that B does *not*
front-load structure. Two checks:

1. **B abstracts only what is already proven shared, not what is speculatively shared.** Every tier-1
   `common/` member has fan-in ≥ 5 from real code (the proposal's fan-in table; verified ±noise by L1).
   `common/sim/weight.ts` earns its place because weight is *the one proven tradeoff axis*. The
   `common/` admission criterion the other reviewers recommend (≥2 distinct feature consumers, no
   feature-specific semantics — W4) is exactly "earn your place," made machine-auditable. The one
   alteration this brief asks for (carving pure compute into `common/sim/assembly.ts`) is itself an
   *earned* promotion — those functions already have ≥2 cross-feature consumers in shipped code
   (`content/engines.ts`, `content/containers.ts`).

2. **B does not anticipate unbuilt mechanics.** The decisive evidence: the migration creates **zero**
   speculative folders. `features/combat/`, `features/restoration/`, `features/sanctuary/`,
   `features/energy/` are all created *when the code that lives in them is written*, never before
   (L6 §5). Empty placeholder directories would be the anti-pattern for a discovery-mode project; B
   explicitly does not do that. The deferred scene/`GameMode` system stays deferred — B accommodates
   it later via `main.ts` without building it now. So the structure B locks is **only the organizing
   axis for code that already exists**, which is precisely what a build-by-discovery project can
   safely commit to.

The only thing B "front-loads" is the *decision about where future code goes* — and that is a
feature, not a cost: it converts the recurring per-file "where does this belong" entropy (the proposal
§1.2 pain, felt acutely by agents) into a one-time answer. That is the opposite of premature
complexity; it is removing an ongoing tax.

---

## 5. What this brief recommends to the board

**(b) ALTER Option B.** The roadmap and game-design lens confirm the direction is right and B absorbs
the future gracefully. The alterations are small and, except one, are pre-decisions rather than
structural changes:

1. **Structural (do at migration):** Split `systems/assembly.ts` along its existing seam — pure
   computation (`sumPartStats`, `resolveEnergyType`, `buildProduct`, `composeProduct`) →
   `common/sim/assembly.ts`; inventory+bench interaction → `features/workshop/`. This is forced by
   shipped code (`content/engines.ts`/`content/containers.ts` consume the pure half) and by MP.
   Pair it with the analogous `spawnEnginePart`→`common/parts/` promotion L4 flags.
2. **Pre-decision (record before Option D ships):** `Health` placement. Minimum-system spec implies
   rig damage → lean `common/components/health.ts`. Do **not** pre-create `features/combat/`.
3. **Pre-decision (record, don't act):** the Restoration Sanctuary is the documented second-loop-mode
   trigger; when it ships it forces the deferred `GameMode`/`stepSimulation`+`renderFrame` extraction
   in `main.ts`. That is a composition-root change, **not** a slice-structure change. B must not
   anticipate scenes or a `modes/` tier now.
4. **UI addendum (add to proposal §4):** the workshop overlay's three tab-renderers (bench, shop,
   deck) stay whole in `features/workshop/`; the UX-pass decomposition is *internal* sub-panels, not a
   cross-feature split.

None of these change the shape of Option B. The roadmap gives **no** support for (a) approve-as-is
(MP will force the `assembly.ts` split open, so leaving it unstated invites the first agent to plant
a feature→feature edge) and **no** support for (c) an alternative direction (no roadmap item wants a
different organizing axis; the only deferred system, scenes, is a `main.ts` concern B already
handles).
