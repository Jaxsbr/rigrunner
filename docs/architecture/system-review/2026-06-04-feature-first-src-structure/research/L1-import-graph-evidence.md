# L1 — Import-Graph Evidence Reality-Check

> **Role:** Local-repo researcher — Import graph & evidence verification
> **Date:** 2026-06-04
> **Scope:** Verifies quantitative claims in `docs/architecture/feature-first-structure-proposal.md`
> against the real `game/src/` codebase at HEAD.

---

## 1. Methodology

All counts derived from `grep` over `/Users/jacobusbrink/Jaxs/projects/rigrunner/game/src` on the
`idea/feature-first-structure` branch. "Fan-in" = number of **unique non-test source files** that
contain at least one `from '...<module>'` import statement, matching the proposal's own counting
methodology. Counts including test files are noted separately where they differ materially.

---

## 2. Fan-in table: proposal vs verified actual

The proposal's table (§2) lists the internal-import fan-in as evidence that "three tiers, not two"
exist. **Every number verified against live code.**

| Module | Proposed | Actual (non-test unique importers) | Match? |
|---|---|---|---|
| `world` | 33 | 33 | ✓ exact |
| `types` | 32 | 32 | ✓ exact |
| `component` | 27 | 27 | ✓ exact |
| `transform` | 19 | 19 | ✓ exact |
| `parts-catalog` | 12 | 12 | ✓ exact |
| `part` | 12 | 11 | ~ off-by-one |
| `mount-grid` | 8 | 8 | ✓ exact |
| `mount` | 8 | 8 | ✓ exact |
| `assembly` | 8 | 6 | delta of 2 |
| `renderable` | 7 | 7 | ✓ exact |
| `collider` | 7 | 7 | ✓ exact |
| `weight` | 5 | 5 | ✓ exact |
| `wallet` | 5 | 5 | ✓ exact |
| `storage` | 5 | 5 | ✓ exact |
| `velocity` | 3 | 3 | ✓ exact |
| `drivetrain` | 3 | 3 | ✓ exact |
| `collectible` | 3 | 3 | ✓ exact |
| `geometry` | 3 | 3 | ✓ exact |
| `workshop-zone` | 8 (diagram) | 7 | ~ off-by-one |

**Discrepancies are trivial.** The `assembly` delta (8 vs 6) likely reflects test files being
counted in the proposal's pass; with tests included the actual is 9 — the `assembly` component is
used by `systems/assembly.ts` (self), `systems/mounting.ts`, `systems/staging.ts`,
`ui/workshop-overlay.ts`, `ui/stats-hud.ts`, and `main.ts`. The two-file gap does not change any
architectural conclusion. The `part` off-by-one and `workshop-zone` off-by-one are within noise.

**Verdict: the proposal's fan-in table is accurate. The "three tiers, not two" claim is
supported by the numbers.**

The tier split is unambiguous:

- **Tier 1 (engine):** `world` (33), `types` (32), `component` (27), `geometry` (3) — pure ECS
  primitives with no game knowledge.
- **Tier 2 (kernel):** `transform` (19), `part` (11), `parts-catalog` (12), `mount` (8),
  `mount-grid` (8), `assembly` (6), `renderable` (7), `collider` (7), `weight` (5) — the domain
  vocabulary *most features speak*.
- **Tier 3 (feature-local):** everything else — fan-in 1–3, single or dual consumer.

---

## 3. "Features form a clean DAG — no cycles" — verified

Cross-feature edges traced directly from import statements:

| From (feature) | Import | To (feature) | Direction |
|---|---|---|---|
| `systems/drive.ts` | `aggregateEngineOutput` | `systems/engine.ts` | drive → engine |
| `systems/drive.ts` | `totalRigWeight` | `systems/weight.ts` | drive → weight |
| `systems/movement.ts` | `rigPerformance` | `systems/drive.ts` | movement → drive |
| `systems/staging.ts` | `partAtCell, mountPart, unmountPart` | `systems/mounting.ts` | staging → mounting |
| `systems/staging.ts` | `placeProductInWorld, removeFromWorld` | `systems/assembly.ts` | staging → mounting's assembly |
| `systems/workshop-drain.ts` | `mountedStorages` | `systems/scrap-collection.ts` | workshop → scrap |
| `ui/stats-hud.ts` | `mountedEngines` | `systems/engine.ts` | hud → engine |
| `ui/stats-hud.ts` | `rigPerformance` | `systems/drive.ts` | hud → drive |
| `ui/workshop-overlay.ts` | `closestFreeCellLocal` | `systems/mounting.ts` | workshop → mounting |
| `ui/workshop-overlay.ts` | `buyPart, sellPart` | `systems/shop.ts` | workshop → shop |

**No cycle detected.** Every cross-feature edge points in a consistent direction:

```
hud → engine ← drive ← movement
          ↑      ↑
         weight  weight

workshop → mounting
workshop → shop (economy)
workshop → scrap (via mountedStorages in workshop-drain)

scrap → (no feature imports)
```

Reversed-edges checked: `engine.ts` imports only `core/world`, `core/types`, `components/part`,
`components/mount`, `components/engine-spec` — no drive, no weight, no scrap. `scrap-collection.ts`
imports only `core/*`, `components/*`, and `systems/collision.ts` — no workshop, no drive. The DAG
claim is **verified as correct.**

---

## 4. The "three tiers" boundary question — evidence for which modules actually cross

The proposal's tier diagram places `render/*` and `input/*` inside `common/`. The real code
surfaces three files that would violate this if left there:

### 4a. `render/interaction-hints.ts` imports `components/scrap-pile`
```
import { ScrapPile } from '../components/scrap-pile';
```
Under Option B, `scrap-pile` is a features/scrap component. A `common/render/` file importing
a `features/scrap/` component makes the shared tier depend on a feature — an inversion.

### 4b. `render/zone-overlays.ts` imports `components/scrap-pile`
```
import { ScrapPile } from '../components/scrap-pile';
```
Same inversion as 4a.

### 4c. `render/animators.ts` imports `components/digging` and `components/scrap-pile`
```
import { Digging } from '../components/digging';
import { ScrapPile } from '../components/scrap-pile';
```
The proposal identifies `animators.ts` as "the one real refactor" and says each animator moves
into its feature's render, with `common/render/view.ts` calling them. But `view.ts` assembles the
render facade and imports all four animators. If the animators live in `features/`, `view.ts`
in `common/render/` would import from four separate feature directories — the same inversion
problem repeated four times.

**The proposal's animators resolution is incomplete.** Saying "common/render/view.ts calls
them" names the caller but doesn't resolve the dependency direction. Three concrete options exist,
each with a cost:

1. **view.ts moves out of common/ into a new composition layer** alongside `main.ts` — reflects
   that `view.ts` is already cross-feature (it composes scrap-stains, zone-overlays, interaction-
   hints, animators, all of which reference feature-specific data). This is architecturally clean
   but requires deciding where this layer lives.

2. **ScrapPile and Digging promote to `common/components/`** — keeps `view.ts` in common/ but
   acknowledges that two "scrap-specific" components have render-tier consumers that aren't scrap.
   Weakens the strictness of common/.

3. **Features register render-side callbacks via `view.ts`** — full inversion-of-control; view.ts
   provides registration hooks that features call at startup. Correctly separates tiers but adds
   indirection and complexity that the current codebase doesn't warrant.

**Assessment for the board:** Options 1 and 2 are pragmatic. Option 1 is architecturally
correct — `view.ts` is already acting as a composition-root peer, importing broadly across what
would become feature dirs. Treating `view.ts` as part of the composition layer (beside `main.ts`)
rather than as `common/render/` infrastructure is the cleanest resolution.

### 4d. `systems/workshop-drain.ts` imports `mountedStorages` from `systems/scrap-collection`

This is a confirmed cross-feature import: `workshop` (a feature) uses a function from `scrap`
(a feature). The comment in `scrap-collection.ts` makes the intent explicit:

> *"Exported so the workshop drain empties them in the SAME order scrap fills them — one definition
> of 'which container is first' shared by collection and draining."*

The function `mountedStorages` is **not scrap-specific in semantics** — it queries `Storage` and
`Mount` components only, with no Collectible or ScrapPile awareness. It is a storage-slot query that
happens to live in `scrap-collection.ts` because that is where it was first needed. Under Option B
this function belongs in `common/` (e.g., `common/sim/` alongside `weight.ts`) or in
`features/storage/` as a shared query both consumers import. If it stays in `features/scrap/`,
`features/workshop/` will have a horizontal feature dependency — which is allowed by the proposal
(the DAG is directed, not forbidden), but it is worth naming explicitly.

---

## 5. Relative-import migration cost: detailed estimates

**Key fact:** `game/tsconfig.json` uses `moduleResolution: "bundler"` with no path aliases.
Every import is a relative path. Moving any file rewrites every relative path that points to it
and every relative path the moved file itself contains.

### 5a. Totals

| Scope | Count |
|---|---|
| Total relative import lines across all `.ts` files (incl. tests) | 450 |
| Relative import lines in non-test source files | 314 |
| Non-test source files with at least one relative import | ~65 |

### 5b. Scrap pilot migration cost (the proposed first step)

Files to move: 11 source files + 3 test files (components: 5, systems: 2, content: 2, render: 1,
ui: 1). Note: `collision.ts` is treated as `common/sim/` per the proposal's lean position; it does
not move with scrap. If it did move, the cost below increases modestly.

| Category | Import lines affected | Files affected |
|---|---|---|
| Outgoing imports **within** moved scrap files that point outside scrap (need depth change `../x` → `../../x` or `../../common/x`) | ~23 | 6 scrap source files |
| External files that **import FROM** scrap files (need new path to `features/scrap/`) | ~10 | 6 external files |
| **Total scrap pilot** | **~33 import lines** | **~12 files** |

The 6 external files with broken imports are: `main.ts` (4 imports), `render/view.ts` (1),
`render/interaction-hints.ts` (1), `render/zone-overlays.ts` (1), `render/animators.ts` (2),
`systems/workshop-drain.ts` (1).

Of these, `interaction-hints.ts`, `zone-overlays.ts`, and `animators.ts` are **also moving** to
a new location under Option B (they cannot stay in `common/render/`), so their paths are doubly
in flux — but that churn is bounded.

**Is the scrap pilot genuinely low-risk?** Yes, with one caveat. The 33 import lines are
mechanical path rewrites with no semantic changes. TypeScript will catch any miss at compile time.
The test suite (`scrap-collection.test.ts`, `scrap-pile.test.ts`, `loot-table.test.ts`) runs
headless — no DOM, no THREE.js — so the pilot is verifiable without a browser. The caveat is
`workshop-drain.ts`'s import of `mountedStorages`: if scrap moves first and workshop has not yet
moved, `workshop-drain.ts` will carry a cross-feature import `from '../../features/scrap/...'`,
which is a visible reminder that `mountedStorages` needs to migrate to a neutral home before
workshop moves. This is a sequencing risk, not a correctness risk.

### 5c. Full Option B migration

With 314 relative import lines in non-test source, and `main.ts` alone carrying 32 imports (all
of which change since it is the composition root and nothing under it stays in the same relative
position), a full migration touches **roughly 280–310 import lines across all ~65 non-test source
files**. No file is semantically rewritten — every change is a path string. With path aliases
(e.g., `@core`, `@common`, `@features/scrap`) added before migrating, the cost drops significantly:
each moved file's imports become alias-based strings that don't change depth. The proposal does not
mention aliases; adding them is a one-line tsconfig change and a Vite resolve config entry, and
would halve the ongoing maintenance cost of the no-alias baseline.

---

## 6. The `assembly` component's upward import

`components/assembly.ts` imports `EnergyType` from `content/parts-catalog`:

```typescript
import type { EnergyType } from '../content/parts-catalog';
```

In the current flat structure this is a `components/` → `content/` edge. Under Option B both
`assembly` and `parts-catalog` move to `common/` (different subdirs: `common/components/` vs
`common/parts/`), so the import stays within common and the violation dissolves. This is
architecturally correct — the EnergyType type is kernel vocabulary.

---

## 7. Verdict on the proposal's quantitative claims

| Claim | Verdict |
|---|---|
| Fan-in table numbers (§2) | **Accurate** — 16 of 19 numbers are exact; 3 are within 1–2 |
| "Three tiers, not two" | **Supported** by the data — the gap between kernel fan-in (7–19) and feature fan-in (1–3) is unambiguous |
| "Features form a clean DAG, no cycles" | **Verified** — no cycle found; all cross-feature edges point in consistent directions |
| "animators.ts is the one real refactor" | **Partially accurate** — it IS a real refactor, but the proposal leaves the dependency-direction question unresolved. view.ts cannot sit in common/render/ and call feature animators without creating a common→feature dependency. This needs an explicit resolution before the pilot is accepted |
| "Scrap is the most self-contained slice for a pilot" | **Accurate** — scrap has no feature that imports FROM it (except hud reads nothing from scrap; the only reverse edge is workshop-drain→scrap-collection, which is a single named function, not a broad coupling) |
| Scrap pilot is low-risk | **Accurate** — ~33 import line rewrites, all mechanical, TypeScript-caught, test-coverable |

---

## 8. Board recommendation

**(b) ALTER Option B — say exactly what to change.**

Option B is correct in every architectural claim the proposal makes. The fan-in data is accurate.
The DAG is real. The tier split is unambiguous. The concerns are implementation detail, not
direction:

1. **Resolve the `view.ts` / animators dependency direction before the pilot begins.** The cleanest
   resolution is: treat `render/view.ts` as part of the composition layer (peer to `main.ts`, not
   in `common/`). It already behaves this way — it composes feature-aware render components and is
   called only from `main.ts`. This is a one-sentence addition to the ADR, not a new redesign.

2. **Decide `mountedStorages` before the scrap pilot lands.** Extract it to `common/` or
   `features/storage/` so that workshop-drain does not carry a horizontal `workshop→scrap` import
   after scrap moves. Costs: rename 2 callers.

3. **Add path aliases before migrating** (`@core`, `@common`, `@features/scrap`, etc.) to avoid
   the worst of the `../../..` chains and to make the migration itself self-documenting. This is
   not required for correctness but prevents the import strings from becoming the noisiest part of
   every PR.

None of these are blockers for accepting Option B as the organizing axis. They are scope items for
the ADR to record before the first file moves.
