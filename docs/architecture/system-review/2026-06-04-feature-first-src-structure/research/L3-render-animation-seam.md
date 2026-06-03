# L3 — Render / Animation Seam ("the one real refactor")

**Reviewer role:** Local-repo researcher — render / animation seam  
**Branch investigated:** `idea/feature-first-structure`  
**Files read:** `game/src/render/animators.ts`, `render/view.ts`, `render/entity-views.ts`,
`render/articulation.ts`, `render/stage.ts`, `render/orbit-camera.ts`, `render/picker.ts`,
`render/build-affordances.ts`, `render/zone-overlays.ts`, `render/interaction-hints.ts`,
`render/scrap-stains.ts`, `game/src/main.ts`, `shared/three-canvas.ts`, `shared/model-portrait.ts`,
`shared/model-loader.ts`

---

## 1. What the render layer looks like TODAY

The twelve files in `game/src/render/` break into five distinct concerns:

| File(s) | Concern | Feature affiliation |
|---|---|---|
| `stage.ts` | Scene + renderer + light rig + ground | Truly common (no feature knowledge) |
| `orbit-camera.ts` | Follow-cam, spherical orbit | Truly common (reads `Transform` only) |
| `entity-views.ts` | Entity ↔ `Object3D` reconciler | Common render infra (reads `Transform`, `Renderable`) |
| `picker.ts` | Raycast cursor → entity | Common render infra (reads `EntityViews`) |
| `build-affordances.ts` | Snap-target cell highlight + carry shadow | `mounting/` feature render |
| `animators.ts` | 4-function grab-bag (see §2) | **Mixed** — the problem |
| `articulation.ts` | `ReclaimerRig` class + `attachStaticHead` | `mounting/` or `scrap/` feature render |
| `zone-overlays.ts` | Proximity discs for workshop + pile | `workshop/` + `scrap/` feature render |
| `interaction-hints.ts` | "Press E / Hold E" bubbles | `workshop/` + `scrap/` feature render |
| `scrap-stains.ts` | Seepage decals under loose scrap | `scrap/` feature render |
| `view.ts` | Façade delegating to all the above | `common/render/` composition root |

### How `main.ts` drives them (the actual call chain)

`main.ts` holds one `RenderView` instance and calls it in the render block each frame:

```
view.follow(world.get(player, Transform)!, cameraInput.poll(), dt);   // orbit-camera
view.sync(world);                                                       // entity-views
view.syncWorkshopZones(world);                                          // zone-overlays
view.syncInteractionHints(world, dt);                                   // interaction-hints
view.syncScrapStains(world, dt);                                        // scrap-stains
// (paused gate)
view.animateWheels(world, dt);      // animators.ts → Velocity
view.animateStorageFill(world, dt); // animators.ts → Storage
view.animateReclaimer(world, dt);   // animators.ts → Digging + articulation.ts
view.animateScrapPile(world, dt);   // animators.ts → ScrapPile
view.render();                       // stage
```

`view.ts` is the thin façade: every one of these is a single-line delegation to a collaborator.

---

## 2. The `animators.ts` grab-bag — exact dependency map

`animators.ts` exports four functions. Each is a pure frame-driven projection: it iterates
`EntityViews.objects`, reads one sim component per entity, and drives view-only mesh state
stored in `Object3D.userData`. No game truth is owned or mutated.

| Exported function | Sim component read | Feature |
|---|---|---|
| `animateWheels` | `Velocity` (from `components/velocity.ts`) | `drive/` |
| `animateStorageFill` | `Storage` (from `components/storage.ts`) | `storage/` |
| `animateReclaimer` | `Digging` (from `components/digging.ts`) + `ReclaimerRig` (from `articulation.ts`) | `mounting/` (arm) + `scrap/` (dig trigger) |
| `animateScrapPile` | `ScrapPile` (from `components/scrap-pile.ts`) | `scrap/` |

`animators.ts` has zero internal coupling — the four functions share the file but share no
state and have no calls to each other. The grab-bag is purely an organisational artefact,
not a structural requirement.

`view.ts` imports all four by name and exposes one thin delegation wrapper per animator.
`main.ts` calls them per-frame through `view`. Nothing else in the codebase calls the
individual animator functions directly; the import graph is strictly linear:

```
main.ts → view.ts → animators.ts → {Velocity, Storage, Digging, ScrapPile}
                                  → articulation.ts
```

---

## 3. The dependency-direction problem the proposal raises — and the correct resolution

The proposal says: "Under B each animation moves into its feature and `common/render/view.ts`
calls them." It then correctly flags the problem: **if `view.ts` lives in `common/` and
imports from `features/drive/`, `features/storage/`, etc., a shared-tier file imports from
feature-tier files — the dependency arrow points uphill.**

This is real, but it is solvable, and the correct solution is already implied by the code:
**`view.ts` does not belong in `common/`.**

Here is why. `view.ts` is a **composition root for the render layer** — it holds collaborators
from many features and delegates to them. It is already doing what `main.ts` does for the
simulation: it's the "glue" layer that assembles feature render pieces into a unified surface.
Moving it to `common/` would be the wrong placement regardless of animator splitting, because
`common/` is the domain kernel (things every feature can safely depend on); a file that imports
from every feature is the opposite of a kernel.

The right placement for `view.ts` under Option B is **`main.ts` itself** (or a peer file in
the same composition root position), not `common/`. Concretely:

### Option B.1 — Inline the four animators into `main.ts`

The four animator functions are already tiny (32–43 lines each), stateless, and called only
from `main.ts`. They could live in a `main-animators.ts` peer or be called inline. The import
arrows all stay pointing downhill: `main.ts` imports from features, which import from `common/`.

```
main.ts  (or main-animators.ts) → features/drive/   → common/ → core/
                                 → features/storage/
                                 → features/scrap/
                                 → features/mounting/
         → common/render/view.ts                     → common/ → core/
```

`common/render/view.ts` is then stripped of the four `animateX` delegates — it no longer
imports from animators at all — and the façade shrinks to the truly common render operations
(`sync`, `follow`, `syncWorkshopZones`, `syncInteractionHints`, `syncScrapStains`, `render`).

### Option B.2 — Animator registry hook

An alternative is to give `common/render/view.ts` an `addAnimator(fn: AnimatorFn)` hook that
features call at startup to register themselves. `main.ts` wires the registrations; `view.ts`
calls them each frame without knowing which feature they come from.

```
interface AnimatorFn { (views: EntityViews, world: World, dt: number): void; }

// In main.ts (composition root):
view.addAnimator((views, world, dt) => animateWheels(views, world, dt));
view.addAnimator((views, world, dt) => animateStorageFill(views, world, dt));
// etc.
```

This keeps `view.ts` in `common/` free of any feature imports while still delegating through
it. The downside: it requires a small extension to `RenderView` and makes the call chain less
obvious than the direct approach (a reader of `view.ts` can no longer see which animators run).
Given that `main.ts` is already the designated composition root and "the ONLY file that imports
broadly across areas," **Option B.1 (move animators to main.ts / its peer) is simpler and
more honest** — the composition belongs at the composition root.

### The cleaner split (recommended)

In Option B, the four animators become:

| Animator function | New home (Option B) |
|---|---|
| `animateWheels` | `features/drive/drive-render.ts` (or `drive-animator.ts`) |
| `animateStorageFill` | `features/storage/storage-render.ts` |
| `animateReclaimer` | `features/mounting/reclaimer-animator.ts` (reads `Digging` from `scrap/`? — see §4) |
| `animateScrapPile` | `features/scrap/scrap-pile-animator.ts` |

`common/render/view.ts` keeps `sync`, `follow`, `syncWorkshopZones`, `syncInteractionHints`,
`syncScrapStains`, and `render`. The `animateX` façade methods are removed from `view.ts`
entirely. `main.ts` imports the four feature animators directly and calls them in the frame
loop, replacing the `view.animateX` calls with direct calls.

**This introduces zero new architectural risk** — `main.ts` already imports from every feature
area. It is a move, not a rewrite, for three of the four functions.

---

## 4. The `animateReclaimer` subtlety — a real cross-feature dependency

`animateReclaimer` reads `Digging` (from `components/digging.ts`), which belongs to the `scrap/`
feature (the rummage system sets and clears it). The `ReclaimerRig` class (articulation) belongs
to `mounting/`. So `animateReclaimer` straddles `mounting/` (the arm) and `scrap/` (the
`Digging` marker that triggers the dig pose).

Under Option B this is a legitimate cross-feature dependency. It cannot be avoided — the
physical fact is that the Reclaimer arm (a mounting feature) deploys when the rummage system
(a scrap feature) is active. The dependency direction is fine: `mounting/` or `scrap/` can
import `Digging` from `scrap/` without creating a cycle, because the DAG in the proposal is
already `scrap → mounting` (scrap depends on mounting). Placing `animateReclaimer` in
`features/mounting/` and importing `Digging` from `features/scrap/` keeps the arrow consistent.

Alternatively, `Digging` is a one-bit marker that could live in `common/components/` (its
fan-in is drive-sys: rummage writes it, reclaimer-animator reads it — exactly the "more than
one consumer across features" pattern). The proposal already notes this kind of promotion
decision as a judgement call; `Digging` is a candidate. Either resolution is clean.

---

## 5. Where the other render files land under Option B

The remaining render files are straightforward moves, not rewrites:

| Current file | Option B location | Imports from features? |
|---|---|---|
| `render/stage.ts` | `common/render/stage.ts` | No (no feature imports) |
| `render/orbit-camera.ts` | `common/render/orbit-camera.ts` | No (reads `Transform` only) |
| `render/entity-views.ts` | `common/render/entity-views.ts` | No (reads `Transform`, `Renderable` — both common) |
| `render/picker.ts` | `common/render/picker.ts` | No (reads `EntityViews` only) |
| `render/view.ts` | `common/render/view.ts` | No (after removing `animateX` methods) |
| `render/build-affordances.ts` | `features/mounting/build-affordances.ts` | No (reads `CellPose` from `core/geometry`) |
| `render/articulation.ts` | `features/mounting/articulation.ts` | No (takes `ModelLoader` as param) |
| `render/zone-overlays.ts` | **Split** or `common/render/zone-overlays.ts` | Yes: `WorkshopZone` + `ScrapPile` |
| `render/interaction-hints.ts` | **Split** or `common/render/interaction-hints.ts` | Yes: `WorkshopZone` + `ScrapPile` |
| `render/scrap-stains.ts` | `features/scrap/scrap-stains.ts` | No (reads `Collectible`, a scrap component) |

### The `zone-overlays.ts` / `interaction-hints.ts` ambiguity

Both `zone-overlays.ts` and `interaction-hints.ts` import two feature components each:
`WorkshopZone` (workshop feature) and `ScrapPile` (scrap feature). They have the same
two-feature coupling as `animators.ts`. The same three options apply:

1. **Split into two files** — `features/workshop/workshop-zone-overlay.ts` +
   `features/scrap/scrap-pile-overlay.ts` and `features/workshop/workshop-hint.ts` +
   `features/scrap/scrap-pile-hint.ts`. These are small files so the split is mechanical.
2. **Keep in `common/render/`** — promote `WorkshopZone` and `ScrapPile` to `common/`
   (both have non-trivial fan-in, and they're gateway components that many systems touch).
3. **Inline into `main.ts`** — same composition-root argument as animators; the two calls
   (`view.syncWorkshopZones`, `view.syncInteractionHints`) are already pass-throughs.

Option 1 or 2 is preferable to 3 here because these are class-based collaborators held by
`RenderView`, not ad-hoc closures. Splitting is the most consistent with Option B's ethos.

---

## 6. ADR-002 and `shared/` — no fragmentation risk

**ADR-002** mandates a single shared `three-canvas.ts` host (no hand-rolled second renderer).
Under Option B this is unaffected because `shared/three-canvas.ts` lives at the **repo root
`shared/`**, not inside `game/src/`. Option B renames the in-game kernel to `common/` and
explicitly avoids clashing with repo-root `shared/`. The two kinds of sharing remain distinct:

- **`shared/`** (repo root) — cross-app: used by both `game/` and `viewer/`. Files:
  `three-canvas.ts`, `model-portrait.ts`, `model-loader.ts`, `assets.ts`, `palette.json`.
- **`common/`** (inside `game/src/`) — in-game kernel: shared across features within the game only.

The `game/src/ui/` files that use `shared/three-canvas.ts` (`deck-view.ts`) and
`shared/model-portrait.ts` (`workshop-overlay.ts`) do so via the three-level relative path
`'../../../shared/...'`. After the restructure they would move to e.g.
`features/workshop/deck-view.ts` and need a path like `'../../../../shared/...'`. This is a
mechanical path update, not a structural problem. **No second canvas host is created;
ADR-002 is respected.**

`shared/model-portrait.ts` accepts a `decorate` hook for caller-injected composition (the
articulated head). The game's `workshop-overlay.ts` passes `attachStaticHead` from
`render/articulation.ts` as that hook. Under Option B, `articulation.ts` moves to
`features/mounting/articulation.ts` and `workshop-overlay.ts` moves to
`features/workshop/workshop-overlay.ts`. Both are in `features/`; the import of the one by the
other is a `features/workshop/` importing `features/mounting/` (downhill per the proposal's
DAG). The `shared/model-portrait.ts` interface is asset-agnostic and unchanged.

**Summary:** the ADR-002 single-owner is safe. The `shared/` vs `common/` naming is clear so
long as `CLAUDE.md`'s directory map is updated to call out both.

---

## 7. The actual migration cost for the render seam

No path aliases exist anywhere in the project (`moduleResolution: "bundler"`, all imports
relative). Every file move rewrites all `import` statements that touch it. For the render
seam specifically:

| Move | Files whose imports change |
|---|---|
| `render/animators.ts` → split to 4 feature files | `render/view.ts` (loses 4 imports), `main.ts` (gains 4 direct imports) |
| `render/view.ts` → `common/render/view.ts` | `main.ts`, `build/build-controller.ts` (2 files) |
| `render/entity-views.ts` → `common/render/entity-views.ts` | `render/picker.ts`, `render/animators.ts`, `render/view.ts` (3 files, already moving) |
| `render/articulation.ts` → `features/mounting/articulation.ts` | `render/entity-views.ts`, `ui/deck-view.ts`, `ui/workshop-overlay.ts` (3 files) |
| `render/scrap-stains.ts` → `features/scrap/scrap-stains.ts` | `render/view.ts` (1 file, already moving) |
| `render/build-affordances.ts` → `features/mounting/build-affordances.ts` | `render/view.ts` (1 file, already moving) |

The four animator functions themselves contain no imports from each other and no imports from
`render/` peers (they import only `components/` and `articulation.ts`). The split is
therefore pure file creation + import path fixups with no logic changes.

**The proposal is correct that this is "the one real refactor."** Every other render file is a
pure move. The animators require splitting into four files, which is about 20 minutes of
mechanical work. The absence of path aliases means each new file needs its own set of relative
import paths recalculated, but a grep-and-replace by filename is reliable here.

---

## 8. Verdict: (b) ALTER — one targeted clarification before proceeding

The proposal is structurally sound for the render seam. The one clarification needed is:

> **`view.ts` must not import from `features/` — and the way to guarantee that is to strip
> the four `animateX` methods from `RenderView` and call the feature animators directly from
> `main.ts`.** This keeps `common/render/view.ts` a clean common-tier file (no feature
> imports) and correctly places the multi-feature composition at the composition root where it
> already lives.

This is not a blocking change to the Option B structure — it is a clarification of where one
seam sits. The proposal gestures at it ("common/render/view.ts calls them") but does not
resolve the dependency-direction question. Resolving it before migration prevents the
common/render/view.ts file from importing features/ and violating the tier contract on day one.

The rest of the render restructure (stage, orbit-camera, entity-views, picker → `common/render/`;
build-affordances, articulation → `features/mounting/`; scrap-stains → `features/scrap/`;
zone-overlays + interaction-hints → split by feature) is unambiguous and carries no
dependency-direction risk.

**Recommend: (b) ALTER** — add one sentence to the proposal specifying that the
`animateX`-method delegation is removed from `RenderView` and the four animators are called
directly from `main.ts`, keeping `common/render/view.ts` feature-import-free.

---

## Appendix: Complete render-file dependency table (today → Option B)

```
File                       Today imports from              Option B location          Imports from (after move)
─────────────────────────  ──────────────────────────────  ────────────────────────  ──────────────────────────────
render/stage.ts            (Three.js only)                 common/render/stage.ts    (Three.js only)
render/orbit-camera.ts     components/transform, input/    common/render/orbit-cam   common/components/, common/input/
render/entity-views.ts     core/, components/, shared/     common/render/entity-v    core/, common/components/, shared/
render/picker.ts           core/types, entity-views        common/render/picker      core/, common/render/entity-v
render/view.ts             core/, components/, input/,     common/render/view        core/, common/components/,
                           stage, orbit-cam, entity-v,                               common/input/, common/render/*
                           picker, affordances, zones,                               (NO feature imports after split)
                           hints, stains, animators
render/build-affordances   core/geometry                   features/mounting/        core/geometry
render/articulation.ts     shared/model-loader             features/mounting/        shared/model-loader
render/animators.ts        components/velocity,storage,    SPLIT INTO:
  animateWheels            digging,scrap-pile              features/drive/           common/components/ (Velocity)
  animateStorageFill       entity-views, articulation      features/storage/         common/components/ (Storage)
  animateReclaimer                                         features/mounting/        features/scrap/ (Digging),
                                                                                     common/render/entity-v,
                                                                                     features/mounting/articulation
  animateScrapPile                                         features/scrap/           common/components/ (ScrapPile*)
render/zone-overlays.ts    components/workshop-zone,       features/workshop/ +      each feature's own components
                           scrap-pile, Transform           features/scrap/ (split)
render/interaction-hints   components/workshop-zone,       features/workshop/ +      each feature's own components
                           scrap-pile, Transform           features/scrap/ (split)
render/scrap-stains.ts     components/collectible,         features/scrap/           features/scrap/collectible
                           Transform                                                  common/components/ (Transform)
```

*ScrapPile is a candidate for promotion to `common/components/` given its multi-consumer
 cross-feature nature (scrap-pile system, zone-overlays, interaction-hints, animators all read it).
