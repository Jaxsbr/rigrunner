# RIGRUNNER — Render scaling for a larger map (spec + plan)

**What this is:** the design + phased plan for the **render-layer work that has to land before the map
grows** — turning a fixed 80×80 hand-placed field into something that can be enlarged and (per
[`world-progression-guidance.md`](../world-progression-guidance.md) §1) **procedurally assembled from
chunks** without the per-frame cost scaling with the *whole* world instead of the *visible* part of it.
This is infrastructure that **serves** the **Hybrid chunk-assembly world** milestone (guidance §1) — it
is not a player-facing mechanic and earns no fun on its own; it's the floor that lets that mechanic exist
at size.

> **Status:** ✏️ **Specced, not started.** Triggered by the question "does the code only render what's in
> view?" The honest answer (investigated 2026-06-08, logged as `observations.md` #15): **the GPU draw side
> is already handled for free** — Three.js per-object frustum culling skips off-screen entities because each
> entity is its own scene node — **but the CPU side is not.** Every per-frame scan (the entity↔object sync,
> the picker, collision) walks **all** entities regardless of visibility, and the terrain is **one
> monolithic mesh** that can't be streamed or chunk-assembled. None of this bites at 80×80; all of it bites
> the moment the world is several times larger. **Nothing here is committed** — it's the map of the work,
> sized so it can be cut into a deliberately-minimum first slice when map-enlargement is actually picked up.

---

## 1. The honest current state (what we found)

The investigation that prompted this spec, against the live code:

| Concern | Status today | Where |
|---|---|---|
| **Per-object frustum culling (GPU draw)** | ✅ **On, for free.** Three defaults `frustumCulled = true`; the code never disables it, and **every entity is its own `Object3D`** added straight to the scene — so off-screen entities are skipped from the draw automatically. | `common/render/entity-views.ts:52-56` (each entity → own object) |
| **Per-frame entity sync (CPU)** | ❌ **Linear over all renderables.** Each frame walks `world.query(Transform, Renderable)` and writes position/rotation for **every** entity — on-screen or not. Frustum culling saves the draw, not this loop. | `common/render/entity-views.ts:38-64` |
| **Picking (CPU)** | ❌ Raycasts/iterates the whole live object cache; cost grows with total entity count, not visible count. | `entity-views.ts` `objects` cache consumers |
| **Collision (CPU)** | ❌ **O(n²)** over colliders with an early planar reject — already self-flagged for a spatial grid "if collider counts ever grow." | `common/sim/collision.ts:29-30` |
| **Terrain** | ❌ **One monolithic 80×80 `PlaneGeometry`** with a single baked procedural texture. Fine as one draw call; impossible to stream, tile, or chunk-assemble. | `common/render/stage.ts:61-71` |
| **Camera far plane** | ⚠️ Wide open at **1000** units — distance alone never culls anything; only the frustum sides do. | `common/render/orbit-camera.ts:44` |
| **LOD / occlusion culling** | ❌ None. A distant scrap pile renders at full geometry; nothing simplifies far objects or skips ones hidden behind a building. | — |
| **Decals (tracks)** | ✅ **Capped** at 640, oldest-dropped-first — bounded regardless of drive length. | `features/tracks/track-marks.ts` `MAX_SEGMENTS` |
| **Decals (stains)** | ⚠️ Scale **linearly** with live scrap/camp count — no independent cap, but tied to entity counts that the same scaling work bounds. | `features/scrap/scrap-stains.ts`, `features/camps/camp-stains.ts` |

**The one-line summary:** *the draw is culled, the bookkeeping is not, and the ground can't be cut into
pieces.* At ~150–200 objects (today's 80×80 field) none of it matters. A ~10× world makes the CPU scans
and the single ground mesh the bottleneck.

**Architectural good news:** the separate-node design is exactly what makes this cheap to add later —
nothing is merged into one giant mesh, so a spatial index can be layered **on top of** the existing seams
without restructuring how entities render. We are starting from a culling-*ready* position, just not a
culled one.

---

## 2. Scope — what this is and isn't

| In scope | Out of scope |
|---|---|
| A spatial index so the per-frame CPU scans touch only entities **near the camera / view** | The chunk-assembly **content** system itself (authoring chunks, the assembly algorithm) — guidance §1 |
| Chunked / tiled terrain that can be **streamed** as the world grows | Procedural *generation* of raw geometry (the lean is assembling authored chunks, not generating terrain) |
| Bounding the CPU cost of picking + collision the same way | A bigger map's **gameplay** (more camps, more loot, region gating) |
| Keeping decals bounded as entity counts climb | **LOD** and **occlusion culling** (deferred — §5; lower priority than the scans + terrain) |

This is a **performance floor**, not a feature. Shipped well, the player notices **nothing** — the same
game, just able to be larger. That's the bar.

---

## 3. The work, in priority order

Ordered by **what actually bites first** as the world grows — not by what's most interesting.

### 3a. A spatial index for the per-frame scans (the real bottleneck)

The load-bearing piece. A coarse **uniform grid** (bucket entities by world cell) that the per-frame
consumers query by camera region instead of walking the whole world:

- **Entity↔object sync** (`entity-views.ts:38-64`) — only sync transforms for entities in/near the view;
  far entities keep their last object state (and stay frustum-culled from the draw anyway). This is the
  scan that runs **every frame for every entity** and the first one to hurt.
- **Picking** — resolve clicks against only the visible/near set.
- **Collision** (`collision.ts:29-30`) — the file **already names this exact fix** ("swap in a spatial
  grid here without touching any caller"). Honour that seam; share the grid if the shapes allow.

**Why a uniform grid (not a quadtree/BVH):** the world is flat and roughly uniform-density; a grid is the
dumbest structure that works, is cheap to rebuild per frame or update incrementally, and matches the
chunk-assembly grain (§3b) so the two can share a coordinate notion. Don't reach for a fancier structure
until play proves the grid insufficient (Rule of Three).

### 3b. Chunked / streamable terrain

Replace the single 80×80 plane (`stage.ts:61-71`) with a **grid of terrain tiles** that can be created and
disposed as the camera moves — the same chunk grain the **Hybrid chunk-assembly world** milestone
(guidance §1) assembles authored set-pieces onto. This is the piece that **does double duty**: it's both
the render-scale enabler *and* the substrate the world-generation lean already wants. Terrain texturing
stays procedural per-tile (the current `ground-texture.ts` approach, regenerated/cached per chunk) rather
than one giant baked texture.

### 3c. Bound the decals

Tracks are already capped (640). Give **stains** the same treatment so they can't grow without bound as a
larger world holds more live scrap/camps at once — a hard cap with oldest/faintest-dropped-first, mirroring
`track-marks.ts`. Mostly falls out of §3a (fewer live distant entities ⇒ fewer live stains), but name the
cap explicitly so it isn't discovered the hard way.

---

## 4. The seams it hooks into

| Concern | File · symbol | Note |
|---|---|---|
| Per-frame entity sync | `common/render/entity-views.ts` · `sync(world)` | the linear scan to make view-relative; the **primary** target |
| Object cache (picking) | `entity-views.ts` · `objects` | picker consumes this; same spatial query |
| Collision broad-phase | `common/sim/collision.ts:29-30` | **already flagged** for a spatial grid — the comment is the spec |
| Terrain mesh | `common/render/stage.ts:61-71` · the ground `Mesh` | the monolithic plane to cut into chunks |
| Terrain texture | `common/render/ground-texture.ts` · `createGroundTexture` | per-chunk generation/caching instead of one bake |
| Camera frustum | `common/render/orbit-camera.ts:44` | far plane / frustum the grid query derives its visible region from |
| Decal caps | `features/.../*-stains.ts`, `features/tracks/track-marks.ts` · `MAX_SEGMENTS` | the cap pattern to extend to stains |
| World structure | [`world-progression-guidance.md`](../world-progression-guidance.md) §1 | the chunk grain §3b must match |

---

## 5. Deliberately NOT in scope (deferred)

- **LOD** — distance-based geometry swaps. A distant third behind the scans and terrain; the grey-box
  assets are cheap enough that simplifying them buys little until object counts are much higher. Logged so
  we add it *when* play proves it needed, not speculatively.
- **Occlusion culling** — skipping objects hidden behind others. Expensive to do well, low payoff on a
  mostly-open wasteland; out until a dense, walled map exists to justify it.
- **The chunk-assembly content system** — authoring socketed chunks and the assembly algorithm. That's the
  **Hybrid chunk-assembly world** milestone's own work (guidance §1); this spec only makes the **renderer**
  ready to draw such a world at size.
- **InstancedMesh for repeated entities** — merging identical scrap pieces/guards into instanced draws.
  Frustum culling + the spatial index handle the projected counts; revisit only if a specific entity class
  blows up in number.

---

## 6. The deliberately-minimum first slice (when this is picked up)

True to "build small systems that stand on their own": **don't build all of §3 at once.** The minimum
worth-shipping cut is **§3a alone** — the spatial index behind the entity-sync scan (and, sharing it,
collision) — proven by enlarging the *existing* flat field (just widen the plane and scatter more
entities) and measuring that the per-frame cost tracks **visible** count, not **total**. That stands on its
own and de-risks the bottleneck before any terrain-chunking or content work. Terrain chunking (§3b) is the
natural second slice, taken **with** (or just before) the chunk-assembly milestone so the grain is shared.

---

## 7. Acceptance — how we'd know it's right

- With the world enlarged several-fold and entity counts scaled up, the **per-frame CPU cost tracks the
  number of entities *in view*, not the total** — provable by parking the camera in an empty corner of a
  densely-populated map and seeing frame cost stay flat.
- **Collision** uses the spatial grid its own comment promised — same callers, faster broad-phase.
- **Terrain** is built from chunks that create/dispose with camera movement; no single mesh or texture
  grows with map size.
- **Decals stay bounded** — stains capped like tracks; a long session in a big world doesn't accumulate
  unbounded decal meshes.
- **The player notices nothing** — identical look and feel; this bought *size*, not a visible feature.
- The chunk grain **matches** what the Hybrid chunk-assembly world milestone wants to assemble onto.
