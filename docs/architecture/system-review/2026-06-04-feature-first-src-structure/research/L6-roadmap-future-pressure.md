# L6 — Roadmap / Future Pressure Analysis

**Role:** Local-repo researcher — roadmap & future pressure  
**Sources read:** `docs/milestones.md`, `docs/ideas.md`, `docs/part-identity-spec.md`,
`docs/world-progression-guidance.md`, `docs/workshop-interface-spec.md`,
`docs/architecture/feature-first-structure-proposal.md`, plus full `game/src/` file tree.  
**Date:** 2026-06-04

---

## 1. Method

For each concrete upcoming work item, this review asks four questions:

1. What code does it produce (components, systems, render, UI, content)?
2. Where does each piece land under Option B's three tiers + features?
3. Is that landing natural, or does it create structural tension?
4. Does anything about this work item strain the B proposal in a way that suggests altering or
   rejecting it?

The proposal's three tiers: **core/** (ECS engine, zero game knowledge), **common/** (domain kernel:
shared components, sim, render infra, input), **features/** (vertical slices). Tests co-located.

---

## 2. Upcoming work items, one by one

### 2.1  Option A — Laden & Weighted (`pending`)

**What it adds:**

- A read of `Storage.amount` → effective weight contribution in the weight aggregation pipeline.
- A "one effective-weight aggregation point" seam (future-proofed for fuel weight, cargo load).
- A load-ratio signal on the HUD.

**Where it lands under B:**

| Piece | B location |
|---|---|
| `Storage.amount` → weight contribution | `features/storage/` — a new export, or widening of `storage.ts` |
| Weight aggregation point | `common/sim/weight.ts` — it's already flagged as a kernel primitive (the central tradeoff axis) |
| Load-ratio signal | `features/hud/stats-hud.ts` reads it |

**Assessment: clean fit.** The aggregation point is exactly the kind of cross-feature primitive that
belongs in `common/sim/`; the contribution itself is a storage concern. No new slice needed. The
seam the milestone explicitly asks for ("an aggregation point any future load source can contribute
to") maps directly onto the `common/sim/weight.ts` design.

**Strain on B: none.**

---

### 2.2  MP — Part Identity: Tiers, Specials & Engine Vocabulary (`pending`)

**What it adds** (per `docs/part-identity-spec.md`):

- Phase 0: Vocabulary divergence (`ELECTRIC_ENGINE_RECIPE` / `STEAM_ENGINE_RECIPE`), slot-noun
  rename, type badge on chips/portraits. Touches `content/recipes.ts`, `content/parts-catalog.ts`,
  `content/engines.ts`, `content/part-costs.ts`, `content/product-visual.ts`, `main.ts`, tests.
- Phase 1: `TIERS` table, instance `tier` field, `capacity` on `PartAttributes`, tier finish tint
  on chips/portraits/world models. Shop sells tier-priced parts.
- Phase 2: Uniform-tier detection → set-bonus in `buildProduct`.
- Phase 3: `special` flag, gold visual cue, loot table epic tier → `special-part`.
- Phase 4 (future): more tiers as pure data rows; production-chain hook.

**Where it lands under B:**

| Piece | B location | Notes |
|---|---|---|
| `TIERS` table + tier resolution | `common/parts/` (alongside `parts-catalog.ts`) | A catalog-level concern; all features consume it through the kernel |
| `tier` field on part instances | `common/components/engine-part.ts` (or generalised `part.ts`) | Already a common component |
| `sumPartStats` tier resolution | `common/sim/` (assembly primitives) or stays in `features/workshop/assembly.ts` | The proposal leans `assembly.ts` toward `workshop/` — tier resolve is a kernel op, tension here |
| Recipe split (electric/steam) | `common/parts/` or `features/engine/` | Two options from proposal §4 ambiguity call #1 |
| Part-costs update | `features/economy/` or `features/workshop/` | The shop is `features/economy/` |
| Visual tinting (tier finish) | `common/render/` (if a shared tint utility) or each feature's render | Probably a utility in `common/render/` consumed by `features/*/` UI |
| Gold sheen / special visual | Same as above |  |
| Loot table epic → `special-part` | `features/scrap/` (the loot table lives there) | Clean; `features/scrap/loot-table.ts` gains a new epic row |

**Key tension: where does `sumPartStats` / `buildProduct` live?**

The proposal places `assembly.ts` in `features/workshop/`. But `sumPartStats` with tier resolution
is genuinely cross-feature: scrap loot grants parts (scrap feature), the shop prices them by tier
(economy feature), and the loot overlay (scrap feature) may show stats. If `buildProduct` lives in
`features/workshop/`, then features/scrap and features/economy both import from features/workshop —
a cross-feature dependency. The cleaner option is to split: keep the *data primitives* (`sumPartStats`,
`resolveEnergyType`, `buildProduct`) in `common/sim/` as assembly primitives, and keep the *UI +
interaction logic* (`assemble`, `dismantle` with inventory effects) in `features/workshop/`. The
proposal already gestures at this but does not fully commit.

**Recommendation for MP:** Promote `sumPartStats` and `buildProduct` (the pure stat-computation
functions) to `common/sim/assembly.ts`. Leave `assemble` / `dismantle` / `benchEnergyType` in
`features/workshop/assembly.ts`. This is a refinement of B's existing `common/sim/` intent, not a
deviation.

**Strain on B: minor. The tier/special machinery naturally distributes across common/parts and
common/sim with no slice explosion. One boundary call (assembly primitives vs assembly UI) needs
sharpening before migration.**

---

### 2.3  Option D — Looter Camps / Combat (`pending`)

**What it adds (minimum system):**

- A camp structure entity with a `cleared` state (new content).
- Simple enemy entities: position, health/damage component, rudimentary movement toward the rig.
- Projectile entities: velocity, damage on collision, spawned by enemies.
- A damage system: projectile ↔ rig collisions → reduce rig health / component health.
- A new `Health` (or `Damage`) component — no current analog in the codebase.
- Enemy "AI" system: decide to shoot / move (simplest possible).
- Drop: reuses Option C's loot table on camp cleared.
- `cleared` signal: a flag the camp emits, hooking into restoration later.
- Defense parts: weapons/armor that mount on the rig (extend the parts catalog + assembly bench).

**Where it lands under B — this is the hardest case:**

| Piece | B location |
|---|---|
| Camp entity + spawner | New `features/combat/camp.ts` |
| Enemy entity + component | New `features/combat/enemy.ts` (component) |
| Enemy movement/AI system | New `features/combat/enemy-ai.ts` |
| Projectile entity + component | New `features/combat/projectile.ts` |
| Damage system | New `features/combat/damage.ts` |
| `Health` component | **Ambiguous: `common/components/` or `features/combat/`** |
| `cleared` signal/flag | `features/combat/camp.ts` emits it |
| Weapon/armor parts (defense) | `features/combat/` or a dedicated `features/defense/` |
| Loot drop on clear | Reuses `features/scrap/loot-table.ts` — clean |
| Camp render (structures, enemy meshes) | `features/combat/` render files |

**The slice-does-not-exist problem:**

Option D has **no current folder** and no current analog. Under B, adding it means creating
`features/combat/`. This is exactly what a feature-first structure is designed to accommodate
cheaply. The question is: does `features/combat/` emerge cleanly, or does it create cross-feature
tangles?

**Cross-feature dependencies to watch:**

1. `features/combat/` needs `common/components/collider.ts` for projectile collision — clean.
2. `features/combat/damage.ts` needs to know the rig's mounted parts to damage them — it queries
   the world via `mount-grid` (in `common/`). Clean.
3. Defense/weapon parts extend `features/workshop/` (assembly bench recipes) and
   `common/parts/parts-catalog.ts`. Clean; just more catalog entries + recipes.
4. The `Health` component: if only enemies have health now, it stays in `features/combat/`. If the
   rig also has health (rig damage), `Health` belongs in `common/components/` (cross-feature, both
   combat and possibly restoration/repair use it).

**The `Health` component boundary is the one live call for Option D.** The minimum system
(per milestones.md) is enemies + a camp that hurts the rig — implying rig health. If rig health
is in scope, `Health` → `common/components/`. If the minimum system is purely "enemies can end a
run but don't damage individual parts," `Health` stays in `features/combat/`. Either is fine;
decide before building Option D, not mid-migration.

**Adding the slice is cheap.** The proposal already lists `features/` as open-ended. A
`features/combat/` directory with its own components, systems, and render is exactly the intended
pattern. The slice does not need to exist today; adding it when Option D ships is the correct
moment.

**Strain on B: low.** Option D gets a clean new slice. The only call to make in advance is whether
`Health` is a common component. Do not pre-create the slice; add it when Option D ships.

---

### 2.4  M4/M5 — World Restoration + Map Clearing (`pending`)

**What it adds (minimum first cuts):**

M4: An ancient tree entity reacting to `cleared` signals from camps (Option D). Visible tree growth
(render change). Possibly a small quest system (quest state component, quest gating).

M5: Map-wide cleared-state tracking; unlocking a new map/level.

**Where it lands under B:**

| Piece | B location |
|---|---|
| Tree entity + component | New `features/restoration/` |
| Tree growth renderer | `features/restoration/` |
| Quest state (if M4 adds quests) | `features/restoration/` or a new `features/quest/` |
| Map progression / unlock | `features/restoration/` or `features/world/` |
| Camp `cleared` signal consumer | `features/restoration/` subscribes to signals from `features/combat/` |

**The key inter-feature dependency: `features/restoration/` ← `features/combat/`.**

The milestones are explicit that the camp "publishes `cleared`, nothing more." That is a clean
signal (a world component flag, an event, or a simple boolean) that `features/restoration/` reads
without Option C or Option D knowing anything about restoration. Under B, this is handled
naturally: the signal is data on a world entity (a component), and `features/restoration/` queries
it. No cross-feature import needed — both features read/write the `World`. This is the ECS
pattern's primary benefit.

**The Restoration Sanctuary (`world-progression-guidance.md` §3b):**

The Sanctuary is explicitly "a separate, persistent, menu-visited place, NOT rendered inside a
run." This has significant structural implications:

- It is not a feature that runs in the main game loop. It is a separate render context.
- Under the deferred scene architecture (ideas.md 2026-06-01), the Sanctuary might require its own
  world, its own render loop, and its own set of systems — none of which exist yet.
- The proposal (§10 of verified facts) defers scene/game-mode architecture until a second loop-mode
  appears. **The Sanctuary is exactly that second loop-mode trigger.**

When the Sanctuary ships, it will likely need: a separate `World` instance (or a persistent
sub-world), its own scene render, and its own composition root entry. Under B, this could be:
- A `features/sanctuary/` slice (for sanctuary-specific components and systems).
- A separate entry point or a `GameMode` abstraction extracted from `main.ts`.

This does not strain B's folder structure — `features/sanctuary/` is a clean slice. But it does
mean `main.ts` will need to grow (or be refactored into a mode dispatcher) when the Sanctuary
ships. That refactor is explicitly deferred and correct to defer. B accommodates it: the
composition root already is `main.ts`, and extracting `GameMode` is a `main.ts` change, not a
structural change to the feature slices.

**Strain on B: low for M4/M5 minimum cuts. The Sanctuary (longer-horizon) will trigger the
deferred scene/mode refactor, but that is a `main.ts` and not a slice-structure concern.**

---

### 2.5  Workshop-UX Pass (`observations.md` #9, #10)

**What it adds:**

- A scalable recipe selector (observations #9: current tab strip won't scale).
- Reduced text-density in the workshop UI (observations #10).
- Visual tier finishes + type badges on chips and portraits (this is shared with MP Phase 0/1).

**Where it lands under B:**

| Piece | B location |
|---|---|
| Recipe selector UX | `features/workshop/workshop-overlay.ts` |
| Inventory chip redesign | `features/workshop/` or `features/economy/` depending on who owns the inventory UI |
| Tier finish rendering | `common/render/` (shared tint utility) or within each feature's own chip render |

**Assessment: clean fit.** All workshop UI lives in `features/workshop/`. The one shared concern
is the tier-finish visual system — if it's a shared utility (likely), it belongs in `common/render/`
or alongside `common/parts/` as a visual schema. Either is consistent with B.

**Strain on B: none.**

---

## 3. Cross-cutting observations

### 3.1  The `common/sim/assembly.ts` boundary needs sharpening now

The proposal places `assembly.ts` in `features/workshop/`. With MP's tier system, `sumPartStats`
and `buildProduct` become genuinely cross-feature (loot grants tiered parts; the shop prices them;
the HUD may display stats). These pure computation functions should be in `common/sim/` before MP
ships, not after. This is a refinement of the proposal, not a rejection.

**Concrete call:** `common/sim/assembly.ts` holds `sumPartStats`, `buildProduct`,
`resolveEnergyType`. `features/workshop/assembly.ts` (or `features/workshop/bench.ts`) holds
`assemble`, `dismantle`, `isBenchComplete`, `assembleVerdict`, `benchEnergyType`. The split is:
*pure computation* → `common/sim/`, *inventory + bench interaction* → `features/workshop/`.

### 3.2  `Health` placement should be decided before Option D ships

If rig damage is in scope for Option D's minimum system (enemies can damage the rig), then
`Health` is a cross-feature component and belongs in `common/components/`. If rig damage is
deferred (enemies only "end the run"), `Health` stays in `features/combat/`. The minimum system
spec says "enemies that can hurt you" — which implies rig health is in scope. **Pre-decide:
`common/components/health.ts`.**

### 3.3  The `features/combat/` slice does not need to exist until Option D

Pre-creating `features/combat/` would be speculative. The B proposal is explicit: features are
vertical slices of existing code. Adding a new slice when new code ships is the design's natural
extension, not a violation. Do not create `features/combat/` during the migration of existing code.

### 3.4  The Restoration Sanctuary defers cleanly but has a known trigger

The Sanctuary is the game's second distinct loop-mode. When it ships it will trigger the deferred
`GameMode` extraction from `main.ts`. Under B this is clean: `features/sanctuary/` for the
slice, `main.ts` refactored to dispatch modes. The slice structure does not need to anticipate
this — it just needs to not actively prevent it (and it doesn't).

### 3.5  Life-trails and world-chunk assembly (longer-horizon)

These are skeleton milestones in `world-progression-guidance.md`. Life-trails (earned, upgradeable,
persistent visual trails behind the rig) would land in `features/drive/` (the drivetrain is the
actor) or a dedicated `features/restoration/` (the result is a restoration effect). World-chunk
assembly (hybrid procedural world) is a map/content concern that would likely live in
`features/world/` or in `main.ts`'s world-composition logic. Neither forces any slice to exist now
nor strains B's structure.

### 3.6  Energy sources (battery, fuel) — deferred cleanly

The fuel/charge economy is explicitly deferred in both `milestones.md` (MW scope cut) and
`workshop-interface-spec.md`. When it ships, it would add `features/energy/` (battery cell, fuel
reservoir, charge/refuel system) or extend `features/engine/` (since energy sources are paired
with engine type). Under B, either landing is clean. This is "complexity earns its place" operating
exactly as intended.

---

## 4. Pressure map — which work items strain B?

| Work item | Strain on B | Key call |
|---|---|---|
| Option A — Laden Weight | None | `common/sim/weight.ts` is the aggregation point |
| MP — Part Identity | Minor | Promote `sumPartStats`/`buildProduct` to `common/sim/` before MP ships |
| Option D — Combat | Low | Pre-decide `Health` component placement; add `features/combat/` when D ships |
| M4/M5 — Restoration | Low | `features/restoration/` is a clean new slice |
| Sanctuary (long-horizon) | None on structure | Triggers deferred `GameMode` extraction in `main.ts`, not a slice concern |
| Workshop-UX Pass | None | All in `features/workshop/`, tier-finish utility in `common/render/` |
| Life-trails | Low | `features/drive/` or `features/restoration/`; decide when it ships |
| Energy sources | None | `features/energy/` or `features/engine/` extension, clean either way |

**Summary: none of the upcoming work items strain Option B's structure in a way that argues against
it.** The one refinement that should be made before migration is sharpening the `common/sim/assembly`
boundary, because MP will make the current `features/workshop/assembly.ts` placement untenable
(pure computation functions used by multiple features should not live in a single feature's slice).

---

## 5. Does B need combat/world/restoration slices anticipated now?

**No.** The slices do not need to exist at migration time. Under B, a slice is created when the
code that belongs in it is written. The correct sequence:

1. Migrate existing code into the slices the proposal describes: `drive/`, `engine/`, `mounting/`,
   `scrap/`, `storage/`, `workshop/`, `economy/`, `hud/`.
2. When Option D ships, create `features/combat/` and populate it.
3. When M4 ships, create `features/restoration/` and populate it.
4. When the Sanctuary ships, create `features/sanctuary/` and refactor `main.ts` to dispatch
   game modes.

Adding empty placeholder directories is anti-pattern for a "build by discovery" project. B's
`features/` is open-ended by design — slices arrive with the mechanics.

---

## 6. Verdict for the (a)/(b)/(c) choice

The roadmap analysis supports **(b) ALTER Option B** with one targeted change:

**Sharpen the `common/sim/` boundary to include pure assembly computation (`sumPartStats`,
`buildProduct`, `resolveEnergyType`) before the MP milestone makes this necessary.** The current
proposal places `assembly.ts` in `features/workshop/`, but these functions are already consumed
(or will be with MP) by `features/scrap/` (loot grants), `features/economy/` (shop pricing), and
potentially `features/hud/`. Cross-feature imports into a single feature's slice is exactly the
problem Option B is designed to prevent.

This is a narrow, concrete alteration — one boundary call, not a structural change. The three-tier
layout, the `features/` vertical-slice model, the test co-location, and the `common/` naming are
all correct. The roadmap pressure confirms them. The only gap is that the proposal is slightly
under-specified on where the pure-computation half of `assembly.ts` lives, and that gap will be
forced open by MP.

**Everything else in the roadmap absorbs cleanly into Option B as-is.**
