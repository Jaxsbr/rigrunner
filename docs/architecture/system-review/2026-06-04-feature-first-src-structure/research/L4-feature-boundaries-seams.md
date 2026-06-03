# L4 — Feature Boundaries and the Four Ambiguous Seams

> **Role:** Local-repo researcher — Feature Boundaries & The 4 Ambiguous Seams
> **Branch under review:** `idea/feature-first-structure-proposal`
> **Proposal:** `docs/architecture/feature-first-structure-proposal.md`
> **Reviewer verdict:** (b) ALTER — Option B is sound in structure but needs four concrete corrections
> before anything moves.

---

## 1. Complete file-to-feature mapping

Every non-test file in `game/src/` mapped to the slice it belongs in under Option B.
Files listed below the slice they belong in; files that span two slices are flagged inline.

### `core/` (unchanged — ECS engine, zero game knowledge)

| Current path | Destination |
|---|---|
| `core/world.ts` | `core/world.ts` |
| `core/types.ts` | `core/types.ts` |
| `core/component.ts` | `core/component.ts` |
| `core/geometry.ts` | `core/geometry.ts` |

No disagreement here. All four are pure ECS machinery with no game concepts.

### `common/components/`

| Current path | Destination |
|---|---|
| `components/transform.ts` | `common/components/transform.ts` |
| `components/renderable.ts` | `common/components/renderable.ts` |
| `components/collider.ts` | `common/components/collider.ts` |
| `components/part.ts` | `common/components/part.ts` |
| `components/mount.ts` | `common/components/mount.ts` |
| `components/mount-grid.ts` | `common/components/mount-grid.ts` |
| `components/mount-facing.ts` | `common/components/mount-facing.ts` |
| `components/assembly.ts` | `common/components/assembly.ts` |
| `components/weight.ts` | `common/components/weight.ts` |

These nine components are the "vocabulary most features speak." Fan-in in the
proposal's own dependency graph confirms it. No contention.

`components/assembly.ts` imports `EnergyType` from `content/parts-catalog.ts` (a
parts-catalog type). If `parts-catalog.ts` moves to `common/parts/`, this import
stays intra-common and is fine. If it were ever left in features it would create an
upward reference. This is another argument for keeping `parts-catalog` in `common/`.

### `common/parts/`

| Current path | Destination |
|---|---|
| `content/parts-catalog.ts` | `common/parts/parts-catalog.ts` |

Fan-in 12 from the proposal graph; imports from `components/engine-part.ts` only.
No contention. This is the declared "spine."

### `common/sim/`

| Current path | Destination | Notes |
|---|---|---|
| `systems/collision.ts` | `common/sim/collision.ts` | See Seam 3 below |
| `systems/weight.ts` | `common/sim/weight.ts` | No contention |

### `common/render/`

| Current path | Destination |
|---|---|
| `render/stage.ts` | `common/render/stage.ts` |
| `render/orbit-camera.ts` | `common/render/orbit-camera.ts` |
| `render/entity-views.ts` | `common/render/entity-views.ts` |
| `render/picker.ts` | `common/render/picker.ts` |
| `render/articulation.ts` | `common/render/articulation.ts` (see Seam 4) |
| `render/view.ts` | `common/render/view.ts` (see Seam 4) |

### `common/input/`

| Current path | Destination |
|---|---|
| `input/drive-input.ts` | `common/input/drive-input.ts` |
| `input/camera-input.ts` | `common/input/camera-input.ts` |

### `features/drive/`

| Current path | Destination | Notes |
|---|---|---|
| `components/drive-control.ts` | `features/drive/drive-control.ts` | |
| `components/drivetrain.ts` | `features/drive/drivetrain.ts` | |
| `components/velocity.ts` | `features/drive/velocity.ts` | |
| `systems/drive.ts` | `features/drive/drive.ts` | **cross-feature: calls `engine.aggregateEngineOutput`** |
| `systems/movement.ts` | `features/drive/movement.ts` | calls `drive.rigPerformance` |

`systems/drive.ts` is the real cross-feature issue for this slice.
`rigPerformance` calls `aggregateEngineOutput` from `systems/engine.ts`. Under
Option B, `features/drive/drive.ts` would import from `features/engine/engine.ts`.
This is an explicit DAG edge shown in the proposal (`drive → engine`), so it is
allowed and not ambiguous — but it needs to be spelled out.

### `features/engine/`

| Current path | Destination |
|---|---|
| `components/engine-part.ts` | `features/engine/engine-part.ts` (see Seam 1) |
| `components/engine-spec.ts` | `features/engine/engine-spec.ts` |
| `content/engines.ts` | `features/engine/engines.ts` |
| `systems/engine.ts` | `features/engine/engine.ts` |

### `features/mounting/`

| Current path | Destination | Notes |
|---|---|---|
| `systems/mounting.ts` | `features/mounting/mounting.ts` | canonical grid snap owner |
| `build/build-controller.ts` | `features/mounting/build-controller.ts` | |
| `render/build-affordances.ts` | `features/mounting/build-affordances.ts` | |
| `content/rig.ts` | `features/mounting/rig.ts` | See cross-cut note below |

`render/build-affordances.ts` imports only `core/geometry.ts` (CellPose) and Three.js.
It belongs with `mounting/` because it is purely the visual affordance for the
grab/drop interaction that `build-controller.ts` drives.

`content/rig.ts` spawns the chassis. It touches `drive-control`, `drivetrain`,
`velocity` (all `features/drive/`), `mount-grid`, `weight`, `collider`, `renderable`
(all `common/`). It has no single-feature owner — it is the composition of drive +
mounting. The proposal parks it in `mounting/` (as "rig.ts" in that slice), which is
defensible since the rig entity's distinguishing property is the `MountGrid`. This is
correct but should be documented explicitly.

### `features/scrap/`

| Current path | Destination |
|---|---|
| `components/collectible.ts` | `features/scrap/collectible.ts` |
| `components/scrap-pile.ts` | `features/scrap/scrap-pile.ts` |
| `components/digging.ts` | `features/scrap/digging.ts` |
| `components/loot-drop.ts` | `features/scrap/loot-drop.ts` |
| `components/cleared-ground.ts` | `features/scrap/cleared-ground.ts` |
| `systems/scrap-pile.ts` | `features/scrap/scrap-pile-system.ts` |
| `systems/scrap-collection.ts` | `features/scrap/scrap-collection.ts` |
| `content/scrap.ts` | `features/scrap/scrap.ts` |
| `content/loot-table.ts` | `features/scrap/loot-table.ts` |
| `render/scrap-stains.ts` | `features/scrap/scrap-stains.ts` |
| `ui/loot-overlay.ts` | `features/scrap/loot-overlay.ts` |

The proposal marks this slice as "the most self-contained." That is accurate with
one important exception: `systems/scrap-collection.ts` exports `mountedStorages`,
which `systems/workshop-drain.ts` imports. See Seam 2 below.

### `features/storage/`

| Current path | Destination |
|---|---|
| `components/storage.ts` | `features/storage/storage.ts` |
| `content/containers.ts` | `features/storage/containers.ts` |

Deliberately thin. `Storage` is consumed by `assembly.ts` (attaches capability), by
`scrap-collection.ts` (deposits into it), and by `workshop-drain.ts` (drains it). All
three importers live in `common/` or other features, so `storage.ts` itself is clean.
`containers.ts` exports `CONTAINER_CAPACITY`, imported by `systems/assembly.ts`.

### `features/workshop/`

| Current path | Destination | Notes |
|---|---|---|
| `components/workshop-zone.ts` | `features/workshop/workshop-zone.ts` | |
| `components/workshop-drain.ts` | `features/workshop/workshop-drain.ts` | |
| `components/bench.ts` | `features/workshop/bench.ts` | |
| `systems/workshop-zone.ts` | `features/workshop/workshop-zone-system.ts` | |
| `systems/workshop-drain.ts` | `features/workshop/workshop-drain-system.ts` | |
| `systems/assembly.ts` | `features/workshop/assembly.ts` | |
| `systems/shop.ts` | `features/workshop/shop.ts` | |
| `systems/staging.ts` | `features/workshop/staging.ts` | See Seam 2 below |
| `content/workshop.ts` | `features/workshop/workshop.ts` | |
| `content/recipes.ts` | `features/workshop/recipes.ts` | |
| `content/part-shop.ts` | `features/workshop/part-shop.ts` | |
| `content/part-costs.ts` | `features/workshop/part-costs.ts` | |
| `content/product-visual.ts` | `features/workshop/product-visual.ts` | |
| `render/zone-overlays.ts` | `features/workshop/zone-overlays.ts` | See zone-overlay seam below |
| `render/interaction-hints.ts` | `features/workshop/interaction-hints.ts` | See zone-overlay seam below |
| `ui/workshop-overlay.ts` | `features/workshop/workshop-overlay.ts` | |
| `ui/deck-view.ts` | `features/workshop/deck-view.ts` | |

`zone-overlays.ts` and `interaction-hints.ts` both render proximity zones for
**both** `WorkshopZone` and `ScrapPile`. A single file owned by `workshop/` would
import `ScrapPile` from `features/scrap/`, creating a cross-feature render layer
import. Options are discussed in Seam 2 below.

### `features/economy/`

| Current path | Destination |
|---|---|
| `components/wallet.ts` | `features/economy/wallet.ts` |
| `components/inventory.ts` | `features/economy/inventory.ts` |
| `ui/wallet-hud.ts` | `features/economy/wallet-hud.ts` |

Clean. `wallet.ts` is only consumed by `workshop-drain.ts` and `shop.ts` (both in
`workshop/`) and `ui/wallet-hud.ts`. `inventory.ts` is consumed by `assembly.ts`
and `workshop-overlay.ts` (both in `workshop/`). The DAG edge is `workshop →
economy`, which is downhill and correct.

### `features/hud/`

| Current path | Destination |
|---|---|
| `ui/stats-hud.ts` | `features/hud/stats-hud.ts` |

`stats-hud.ts` imports `systems/engine.mountedEngines` and `systems/drive.rigPerformance`.
Under Option B it would import from `features/engine/` and `features/drive/`. This
is a legitimate two-feature cross-cut (reading engine + drive to report rig capability).
It earns a `hud/` home because it is a readout aggregating two features, not belonging
to either. See stats-hud analysis below.

---

## 2. Files claimed by two features (contention points)

| File | Feature A claim | Feature B claim | Resolution |
|---|---|---|---|
| `systems/staging.ts` | `mounting/` — reuses mounting seams | `workshop/` — bridges inventory ↔ deck | Assign to `workshop/` — see Seam 2 |
| `systems/scrap-collection.ts` (`mountedStorages` export) | `scrap/` — owns collection | `workshop/` — drain imports `mountedStorages` | Export stays in `scrap/`; drain imports cross-feature — see Seam 2 |
| `render/zone-overlays.ts` | `workshop/` — zone rendering | `scrap/` — also renders `ScrapPile` zones | Single file; owned by `common/render/` or split — see below |
| `render/interaction-hints.ts` | `workshop/` — "Press E" hint | `scrap/` — "Hold E" hint | Same situation as `zone-overlays.ts` |
| `systems/drive.ts` | `drive/` — drive physics | (imported by) `features/hud/stats-hud.ts` | DAG edge is fine; `drive → drive` is not contention |
| `content/rig.ts` | `mounting/` | `drive/` | Assign to `mounting/`; document it |
| `systems/assembly.ts` | `workshop/` | (imports `engine-part`, `parts-catalog`, `containers`) | All three are in `common/` or `common/parts/` under B — no contention |

---

## 3. Seam-by-seam stress test

### Seam 1: `engine-part` leaks to `shop`, `assembly`, and `workshop-overlay`

**What the code actually does:**

- `components/engine-part.ts` — the component that marks a loose sub-part entity. It
  carries only `{ id: string }`, a catalog reference.
- `systems/assembly.ts` imports `EnginePart` to dereference the catalog id via
  `partDef(ep.id)`. It also calls `spawnEnginePart` from `content/parts-catalog.ts`.
- `systems/shop.ts` imports `EnginePart` to check if an inventory item is a loose part
  (not a product) before selling it.
- `ui/workshop-overlay.ts` imports `EnginePart` to project items into `ItemView`
  and to read parts for the shop sell list.
- `ui/loot-overlay.ts` imports `spawnEnginePart` from `content/parts-catalog.ts`
  to grant loot finds.

**Key observation:** `EnginePart` is NOT an engine-specific concept in the sense of
"what drives the rig." It is the generic sub-part vessel — the catalog-reference
component that any assembled recipe's parts carry. Storage recipe parts also use
`spawnEnginePart` (the name is misleading). The Reclaimer arm and bucket are spawned
via `spawnEnginePart` too (see `main.ts` lines 69–72 and `loot-overlay.ts` line 87).

This means `EnginePart` / `spawnEnginePart` is not engine-specific at all. Placing
it in `features/engine/` would mean `features/workshop/assembly.ts` and
`features/scrap/loot-overlay.ts` both import from a sibling feature, violating the
DAG (features should not import freely from other features unless an explicit downhill
edge is declared).

**Recommendation: promote `engine-part.ts` to `common/parts/` alongside `parts-catalog.ts`.**

Rename `spawnEnginePart` to `spawnCatalogPart` to reflect that it spawns any
catalog part, not just engine parts. This is a two-line rename plus a migration
across callers. It dissolves the leak entirely and is semantically more accurate.
The name `EnginePart` for the component can be left as-is (it is an established
component key and renaming it is a bigger churn) or renamed to `CatalogPart` in a
follow-up. The priority fix is the location and the spawn-function name.

If the board prefers to keep `engine-part.ts` in `features/engine/` and accept the
cross-feature imports, the explicit DAG edges needed are:
- `workshop → engine` (already shown in the proposal diagram for assembly/shop)
- `scrap → engine` (via `loot-overlay.ts` — NOT shown in the diagram; this is a gap)

The `scrap → engine` edge is the argument against leaving it in `features/engine/`.
Scrap collecting a loot part has no engine-domain reason to import from `engine/`;
the dependency is on the generic catalog mechanism, not on engine behaviour.

---

### Seam 2: `staging` shared by `mounting` and `workshop`; the `mountedStorages` export; zone-overlay files

**2a. `systems/staging.ts`**

`staging.ts` imports:
- `systems/mounting.ts` — `partAtCell`, `mountPart`, `unmountPart`
- `systems/assembly.ts` — `placeProductInWorld`, `removeFromWorld`
- `components/inventory.ts` — `addToInventory`
- `components/workshop-zone.ts` — `WorkshopZone` (via `workshopEntity` query)

The proposal says: "put in `workshop/`; it depends downhill on mounting." Confirmed.
`staging.ts` is the bridge the workshop interface's staging tab uses. Its primary
consumer is `ui/workshop-overlay.ts`. It uses mounting as a mechanism (reuses the
same mount/unmount seam) but the concept — moving a product between inventory and a
deck for the workshop UI — is a workshop concern, not a mounting concern.

**Verdict: `staging.ts` belongs in `features/workshop/`. The proposal is correct.
Document this explicitly: "staging reuses mounting as a mechanism; it is a workshop concept."**

**2b. `mountedStorages` export in `systems/scrap-collection.ts`**

`systems/scrap-collection.ts` owns scrap collection AND exports `mountedStorages`:

```typescript
// game/src/systems/scrap-collection.ts, line 38
export function mountedStorages(world: World, rig: EntityId): EntityId[] { ... }
```

`systems/workshop-drain.ts` imports `mountedStorages` from `scrap-collection.ts`
for the "same order scrap fills them" invariant. The comment at line 38 of
`scrap-collection.ts` says explicitly: "Exported so the workshop drain empties them
in the SAME order scrap fills them — one definition of 'which container is first'
shared by collection and draining."

Under Option B, `features/workshop/workshop-drain-system.ts` would import
`mountedStorages` from `features/scrap/scrap-collection.ts`. That is a `workshop →
scrap` edge. The proposal diagram does NOT show this edge (it shows `workshop →
{mounting, engine, storage, economy}` but not `workshop → scrap`).

This is not fatal — the DAG is still acyclic — but it is an undeclared dependency.
The right fix depends on where `mountedStorages` conceptually lives:

- `mountedStorages` queries `Storage` + `Mount` — it belongs to the storage domain,
  not the scrap domain.
- The ordering rule it encodes ("front-to-back, left-to-right") is the deposit order
  invariant shared by collection and draining.

**Recommendation: extract `mountedStorages` from `scrap-collection.ts` and place it
in `features/storage/` (or promote it to `common/` if a third consumer appears).
Both `scrap/` and `workshop/` then import it from one place in `storage/`.** The
`workshop → storage` and `scrap → storage` edges are both already in the proposal's
DAG, so this resolves the undeclared edge without adding new ones.

The extraction is a small refactor: `mountedStorages` has no scrap-specific logic;
it queries `Storage` and `Mount`, both of which are in `common/components/`. Moving
it to `features/storage/storage-queries.ts` or similar keeps the ordering invariant
in the feature that owns the component.

**2c. `zone-overlays.ts` and `interaction-hints.ts`**

Both files iterate `WorkshopZone` AND `ScrapPile` in the same loop. Under Option B:

- Owned by `workshop/` → imports `ScrapPile` from `features/scrap/`. A `workshop →
  scrap` edge (undeclared in the proposal, and semantically odd: why does workshop
  know about scrap piles?).
- Owned by `scrap/` → imports `WorkshopZone` from `features/workshop/`. A `scrap →
  workshop` edge (also undeclared, and weirder: why does scrap own workshop zones?).
- Owned by `common/render/` → neither feature imports cross. Clean, but these files
  draw game-specific proximity indicators; they are not "pure render infrastructure."

The cleanest resolution is to recognise that both `WorkshopZone` and `ScrapPile`
implement the same concept: a **proximity gate** with an `active` boolean and a
radius. The render code only cares about that concept, not about which feature owns it.

**Recommendation: introduce a minimal `ProximityZone` read-interface (or a shared
query helper returning `{id, radius, active, transform}`) in `common/`, and have
both files live in `common/render/`. Alternatively, split each file into two
feature-local pieces:**
- `features/workshop/` owns the "workshop disc" + "Press E" hint.
- `features/scrap/` owns the "scrap pile disc" + "Hold E" hint.
- `common/render/view.ts` calls both.

The split-into-features approach avoids the `common/render/` files importing game
concepts, at the cost of slightly more files. Given that the proximity disc logic is
identical (10 lines in `zone-overlays.ts`), and both features already own their zone
components, the split is the tidier long-term choice. It also aligns with the
principle that only genuinely cross-feature code earns a place in `common/`.

---

### Seam 3: `collision` and `weight` placement in `common/sim`

**`systems/collision.ts`**

The proposal says: "*Lean: promote both as kernel primitives. Stricter alternative:
start `collision` in `scrap/` and promote when a second consumer appears.*"

From the code: `systems/collision.ts` exports `CollisionPair` and
`collisionSystem`. Its only import is `Transform` and `Collider` (both
`common/components/`). It has no domain knowledge whatsoever — no scrap, no engine,
no mounting. Its only current consumer is `scrap-collection.ts`.

However, future roadmap items (docs/milestones.md + docs/ideas.md) explicitly list
combat (Option D, looter camps) as a pending feature area. Combat means projectiles
or melee hits, which need collision. Placing `collision.ts` in `features/scrap/` now
would require promoting it the moment combat lands — a churn that could have been
avoided.

The **"build by discovery" principle** argues for starting in `scrap/` (don't
generalise until needed). The **"complexity earns its place"** principle argues the
opposite: the collision system IS already general (it is a pure pair-list with no
scrap logic), and the cost of promoting later is one extra PR. The code comment in
`collision.ts` itself says: "what a collision *means* is decided entirely by the
consumer (scrap collection today, projectile damage later), and the same call serves
both." The author already designed it for the second consumer.

**Recommendation: place `collision.ts` in `common/sim/` immediately. The code is
already written as a generic primitive; holding it in `scrap/` until combat lands
is extra work with no benefit.** If the board prefers the strict "no premature
promotion" reading, `scrap/` is defensible, but the team should expect a promotion
PR as soon as the first combat mechanic appears.

**`systems/weight.ts`**

Only 20 lines. Imports `Part`, `Mount`, `Weight` — all `common/`. Single function
`totalRigWeight`. No scrap, no engine, no other feature. It IS a sim primitive
(the central tradeoff axis), and `systems/drive.ts` already calls it (drive → weight
is a kernel dependency, not a feature-to-feature edge).

**Verdict: `weight.ts` belongs in `common/sim/`. No ambiguity.**

---

### Seam 4: `render/animators.ts` must split

The proposal calls this "the one real refactor." Confirmed. The four functions in
`animators.ts` read components from four different features:

| Function | Component read | Feature |
|---|---|---|
| `animateWheels` | `Velocity` | `features/drive/` |
| `animateStorageFill` | `Storage` | `features/storage/` |
| `animateReclaimer` | `Digging`, `ReclaimerRig` | `features/scrap/` and `features/mounting/` |
| `animateScrapPile` | `ScrapPile` | `features/scrap/` |

After splitting, each animator moves into its feature's render layer. The proposal
then says: "*`common/render/view.ts` calls them*." This is the dependency-direction
problem the proposal flags but does not fully resolve.

**The problem: if `common/render/view.ts` calls animators in `features/`, then
`common/` depends on `features/`. This inverts the tier hierarchy.**

`render/view.ts` is currently the render façade — it owns the per-frame call to each
animator. If it stays in `common/render/` and calls feature-resident animators, the
common tier reaches into features.

**Two concrete resolutions:**

**Option 4A (recommended): move `view.ts` to `main.ts`'s responsibility.**
`RenderView` becomes a pure infrastructure class in `common/render/` that exposes
the `EntityViews`, `Stage`, `OrbitCamera`, `Picker`, and affordance methods but does
NOT call animators directly. `main.ts` (the composition root) calls each feature's
animator with the shared `EntityViews` and `World` it passes in. This is consistent
with `main.ts` already being "the only cross-feature importer."

After this change, `common/render/view.ts` has no feature imports. The four
per-frame animator calls in `main.ts` become:
```typescript
driveAnimators.animateWheels(views, world, dt);
storageAnimators.animateStorageFill(views, world, dt);
mountingAnimators.animateReclaimer(views, world, dt);
scrapAnimators.animateScrapPile(views, world, dt);
```

This makes `main.ts` slightly larger (it absorbs 4 more lines), but `main.ts` is
already 245 lines and is explicitly allowed to be the cross-feature orchestrator. The
total conceptual complexity does not increase; it is correctly located.

**Option 4B: keep `view.ts` in `common/render/` and accept that it calls features.**
This violates the tiering stated in the proposal, but the violation is bounded:
`view.ts` is the declared façade; calling feature animators through an interface or
callback registry would keep the import direction correct. A callback registry in
`view.ts` where features register their animator at startup is idiomatic (an event
bus), but adds a new abstraction not warranted at this scale (~5 animators today).

**Verdict: Option 4A. `view.ts` strips the animator calls; `main.ts` calls them
directly, passing `EntityViews` and `World`. This is the smallest change that
correctly locates the cross-feature orchestration.**

`render/articulation.ts` is different: it contains the `ReclaimerRig` class and
`attachStaticHead`. Both are consumed by `entity-views.ts` (in `common/render/`).
`entity-views.ts` imports `isArticulated`, `ReclaimerRig`, and `BUCKET_ASSET` from
`articulation.ts`. If `articulation.ts` moves to `features/mounting/`, then
`common/render/entity-views.ts` would import from a feature — the same inversion
problem.

**Recommendation: `articulation.ts` stays in `common/render/`. The Reclaimer
articulation contract (joint names, the rig driver) is render infrastructure that the
common render layer needs to animate any articulated GLB. The Reclaimer being the
ONLY articulated asset today does not change the layer it belongs in — it is
authored as a general articulation seam (the `isArticulated` gate accepts any
future articulated asset id, not only the Reclaimer).**

---

## 4. Cross-cutting files: `rig.ts` and `stats-hud.ts`

### `content/rig.ts`

Imports from: `drive-control`, `drivetrain`, `velocity` (all `drive/`), `mount-grid`,
`weight`, `collider`, `renderable` (all `common/`).

The rig spawner is the composition of the drive and mounting features at entity level.
It has no single natural home. The proposal parks it in `features/mounting/`. This is
correct: the rig's identity is defined by its `MountGrid` (it is a deck that can be
driven, not a drive train that happens to have a deck). The drive attributes — `Drivetrain`,
`Velocity`, `DriveControl` — are added here but they do not define what a rig IS.

However, `rig.ts` is not the same kind of file as `mounting.ts` (the grid-snap owner).
It is a composition / factory file, and it will eventually be generalised to multiple
chassis types. A `features/mounting/rig.ts` is slightly misleading — a reader opening
`mounting/` expects mounting mechanics, not a chassis spawner.

**Recommendation: place `rig.ts` in `features/mounting/` (per the proposal), but name it
`features/mounting/chassis.ts` or `features/mounting/chassis-spawner.ts` to signal
that it is a factory, not a system. Update `CLAUDE.md`'s directory map to reflect this.**

### `ui/stats-hud.ts`

Imports `mountedEngines` from `systems/engine.ts` and `rigPerformance` from
`systems/drive.ts`. Both are in `features/engine/` and `features/drive/`
respectively under Option B.

`StatsHud` reports the rig's combined capability: type of engine + weight + torque +
acceleration + top speed + reverse. It genuinely depends on both features and cannot
be split without duplicating logic.

The proposal places it in `features/hud/`. This is correct. A thin `hud/` slice
containing only `stats-hud.ts` has a fan-in from both `engine/` and `drive/`, which is
fine: the DAG shows `hud` as an aggregating leaf, not a shared kernel. It does not
feed back to either feature.

**Verdict: `features/hud/stats-hud.ts` is the right location. The slice being thin
(one file today) is acceptable — its purpose is to insulate the cross-feature
readout from either owning feature.**

Future `hud/` residents: a storage-fill readout, a mission/task HUD, a compass.
These would all be aggregating readouts with no loop-back into features.

---

## 5. Cohesion assessment — are the slices genuinely cohesive?

| Feature | Assessment |
|---|---|
| `drive/` | Cohesive. Drive-control, drivetrain, velocity, movement, performance. Single tradeoff axis (speed vs weight). One declared dependency: `drive → engine`. |
| `engine/` | Cohesive IF `engine-part.ts` is promoted to `common/parts/`. Without that, three external features import from here for non-engine-specific reasons. |
| `mounting/` | Cohesive. Grid snap, cell geometry, build controller, affordances, rig spawner. ADR-001 is preserved (single owner of closest-cell scan). |
| `scrap/` | Cohesive. Pile, collection, loot, stains, overlay. **One undeclared dependency leaks out: `mountedStorages` is exported and consumed by `workshop/`.** Fix by moving `mountedStorages` to `features/storage/`. |
| `storage/` | Cohesive but thin (2 files today). Will grow when storage upgrades or container tiers land. |
| `workshop/` | The largest and most complex feature. Cohesive in purpose (the hub), but it has undeclared edges to `scrap/` via `zone-overlays.ts` and `mountedStorages`. Both are resolvable. |
| `economy/` | Cohesive and small. Clean DAG edge from `workshop → economy`. |
| `hud/` | Thin by design (one aggregating readout). Correct location for cross-feature readouts. |

**No feature is so entangled that the split is artificial.** The four seams identified
in the proposal are real boundary tensions, but all four have concrete resolutions
(see above). After applying the corrections, each slice passes the "open one folder,
see the whole mechanic" test.

---

## 6. Roadmap absorption check

Pending milestones and ideas (from `docs/milestones.md` + `docs/ideas.md`) tested
against the proposed structure:

| Incoming feature | Where it lands |
|---|---|
| Laden-weight seam (weight aggregation) | `common/sim/weight.ts` already the right home. No structural change. |
| Part identity tiers / gold specials | `features/engine/engine-spec.ts` and `common/parts/parts-catalog.ts` get new fields. `features/workshop/` (assembly + shop) interprets them. Clean. |
| Option D: looter camps + combat | A new `features/combat/` slice. `common/sim/collision.ts` becomes its backbone (the second consumer). No existing slice changes. |
| M4/M5: world restoration / Restoration Sanctuary | A new `features/restoration/` slice (consumes `ClearedGround` from `features/scrap/`). Clean DAG edge: `restoration → scrap`. |
| Workshop UX pass (recipe selector scaling, dense UI) | All in `features/workshop/workshop-overlay.ts`. No cross-feature impact. |
| Scene / game-mode architecture (deferred) | `main.ts` would split into a scene manager. Feature slices stay intact; only the composition root changes. The decision to defer is confirmed by `ideas.md 2026-06-01` and is correct — Option B does not need to pre-empt it. |

The structure absorbs all pending roadmap items without structural change to existing slices.

---

## 7. Summary of corrections required before migration

The corrections are ordered by impact. Each is a boundary decision, not a code rewrite.

| # | Correction | Type | Impact |
|---|---|---|---|
| 1 | Promote `engine-part.ts` and `spawnEnginePart` to `common/parts/`. Rename `spawnEnginePart` to `spawnCatalogPart`. | Location + rename | Resolves Seam 1 entirely. Removes undeclared `scrap → engine` edge. |
| 2 | Extract `mountedStorages` from `scrap-collection.ts` into `features/storage/`. | Small extraction | Resolves the undeclared `workshop → scrap` dependency for drain. |
| 3 | Strip animator calls from `common/render/view.ts`; move them to `main.ts` as direct feature calls, passing `EntityViews`. | Refactor (already the "one real refactor") | Keeps `common/` tier-clean. `view.ts` becomes pure infra. |
| 4 | Split `zone-overlays.ts` and `interaction-hints.ts` into feature-local pieces (`workshop/` + `scrap/`). Each calls its own zone component only. | Split | Removes two undeclared cross-feature render imports. |
| 5 | Keep `articulation.ts` in `common/render/`. | Placement decision | Prevents `entity-views.ts` from reaching into `features/`. |
| 6 | Rename `content/rig.ts` destination to `features/mounting/chassis.ts`. | Naming only | Readability; signals factory vs system. |
| 7 | Document the `scrap → storage` edge (`scrap-collection.ts` deposits into `Storage`). | Documentation | The edge is already in the proposal DAG (`scrap → {mounting,storage}`). Calling it out confirms it is intentional. |

---

## 8. Board recommendation

**Verdict: (b) ALTER.**

Option B is the correct organizing axis. The three-tier structure (core / common /
features) accurately reflects the codebase's real dependency graph. The feature
slices are genuinely cohesive and absorb the roadmap gracefully.

Four corrections are required before migration begins:

1. `engine-part` / `spawnEnginePart` promoted to `common/parts/` and renamed.
2. `mountedStorages` extracted to `features/storage/`.
3. Animator calls moved from `view.ts` to `main.ts` (already the intended refactor;
   just needs the dependency-direction framing made explicit in the plan).
4. `zone-overlays.ts` and `interaction-hints.ts` split into feature-local files.

None of these corrections change the shape of Option B; they sharpen the seams the
proposal itself identified as open. After applying them, the four ambiguous boundaries
become clean, the DAG declared in the proposal matches the actual import graph, and the
"open one folder, see the whole mechanic" property holds without hidden cross-feature
edges.

**Suggested first migration: `scrap/` (confirmed most self-contained, once `mountedStorages`
is extracted).** Follow with `economy/` (the thinnest), then `storage/`, then `engine/`
(after the `engine-part` promotion), then `drive/`, `mounting/`, `workshop/`, and `hud/`.
