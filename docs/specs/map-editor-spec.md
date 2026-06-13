# RIGRUNNER — Map editor & authored collision (spec)

**What this is:** the design + plan for an in-game **map editor** in which the world's **static
collision is authored as vector shapes** (smooth spline paths you draw and bend) that **compile into a
collision grid** — rather than approximated by primitive colliders — plus the **decoration placement**
that the same editor grows into. It replaces the circle-collider ring that walls the Phase 1 bowl — a
smooth primitive can't trace the authored mountain silhouette, so it's wrong in both directions at once
(see "Why this exists"). The compiled grid *is* the silhouette, so the gaps are exactly drivable and the
rock is exactly solid, and the same query blocks the rig **and** enemies uniformly.

> **Status:** 🟡 **Specced, not built** — the committed follow-up to PR #76 (Phase 1 cold-open). Phase 1
> lands with the interim circle-collider ring documented as a known limitation
> (`features/terrain/CLAUDE.md`); **this spec retires it.** Captured from the **2026-06-13** play session:
> Jaco hit the circle ring's faults on camera (gaps partly walled, mesh bulges drive-through, enemies
> pass through) and chose the **painted-collision editor** over more circle-tuning, explicitly so he can
> *also* start hand-placing decorations around the shops. Phased: **Phase A** (grid collision + paint
> editor) retires circles and fixes all three faults; **Phase B** (decoration placement) is the payoff.
> Candidate/movable per "build by discovery" — cut each phase into a deliberately-minimum slice when
> picked up.

---

## Why this exists (the problem it solves)

The Phase 1 bowl is walled by a **continuous, noise-displaced mountain mesh** — its irregular silhouette
is exactly what makes it read as natural wasteland cliff, not a glued row of boxes. But its **collision**
is a ring of 44 fixed-radius circles on a clean concentric ring. A smooth primitive cannot trace a jagged
edge, so the approximation is **wrong in both directions simultaneously**:

- **Circles bulge into the gaps** → a drivable exit gets partly walled off (you can't get through a gap
  you can plainly see).
- **Circles fall short of the mesh's outward bulges** → where the rock juts past the ring, you drive
  *into* the mountain.
- **Enemies ignore it entirely** → camp guards never consult `Solid`; only the player rig runs the
  collision-response pass, so guards walk through the wall.

No amount of count/radius tuning fixes the first two together — tightening to clear the gaps opens
drive-through holes, and vice-versa. Jaco's call: **stop approximating authored geometry with
primitives.** Paint the collision to match the art, in an editor that doubles as the tool for placing
decoration around the shops.

This is a deliberate split from [`collision-spec.md`](collision-spec.md), which stays as-is for
**dynamic entity-vs-entity** contact (rig ↔ camp body, scrap-pickup reach, structure footprints you
drive *up to*). That model is right for round things that move. This spec governs only **static world
blocking** — the hand-authored map silhouette (mountains now; walls, shop footings, canyon edges later)
— which is large, irregular, and fixed. See "Relationship to the existing collision layer".

---

## The decision (committed direction)

1. **Static world collision is an occupancy grid at runtime**, not primitive colliders. A 2D raster over
   the world disc; each cell is *blocked* or *clear*. Movement = "you may not enter a blocked cell."
2. **The grid is authored as VECTOR shapes in an in-game editor** — a launch mode of the game itself, not
   a separate app (it rides the real game world: stage, camera, asset registry). You draw smooth spline
   paths (open walls / closed regions, add / carve) and bend them by dragging points; they **compile into
   the grid**. Authoring is resolution-independent; the grid is just the compiled result.
3. **The same grid blocks the rig and enemies**, via one query in their shared movement path — so
   "enemies pass through" dissolves for free.
4. **The editor grows into a decoration tool** (Phase B): the same place-and-serialize machinery, with an
   asset palette instead of a paint bucket, to stamp props around the shops.

---

## The data model

### The map file
A single **versioned, hand-authored map document**, loaded by the real-game scenario at seed time and
written by the editor. JSON, committed to the repo (it's authored content, like an asset). It carries:

- the **compiled collision raster** (`blocked`) — what the GAME loads (Phase A), and
- an editable **`source`** — what the EDITOR re-opens: the `bakedFromMesh` base flag + the **vector
  shapes** drawn on top. The game ignores it; on save the editor recompiles `blocked` from the source
  (mesh-baked base, then the shapes). A map never opened in the editor simply has no `source`, and the
  editor then treats its loaded grid as the base.
- a **decoration instance list** (Phase B).

Location: `game/src/app/scenarios/maps/<name>.map.json` (next to the scenario that loads it). One map
per world for now (`real-game`); the format is multi-map-ready but we don't speculate a second yet.

### The collision raster
A 2-D occupancy grid covering the playable disc:

- **Extent:** a square that bounds the world disc — `[-WORLD_RADIUS, +WORLD_RADIUS]` on x and z
  (`WORLD_RADIUS = 145`, from `stage.ts`).
- **Cell size:** a build-time dial, **0.5 world units/cell** → a 580×580 grid (~336k cells). Fine enough
  to hand-trace detail and smooth, thin collision lines (a coarser ~2-u grid only paints blocky 2-unit
  squares — too chunky to draw with); still cheap to paint and query.
- **Storage:** in memory a flat `Uint8Array` (1 = blocked, one byte/cell, fast to read + paint). On the
  wire **BIT-PACKED** (8 cells/byte) and base64'd — so even the fine grid is ~55 kB, not ~450 kB — with
  `width`, `height`, `cellSize`, `originX/originZ` alongside so the loader needs no magic constants.
- **World ↔ cell mapping** (the only math): `col = floor((x - originX) / cellSize)`,
  `row = floor((z - originZ) / cellSize)`; a cell's centre maps back the same way. Out-of-grid = blocked
  (that subsumes the world-end clamp — see below).

### The decoration instances (Phase B)
An array of `{ assetId, x, z, rotationY, scale }`, drawn from `shared/assets.ts`. Loaded as static
`Renderable` entities at seed time (scenery: deterministic, no persisted state — same rule the mountain
ring already follows).

---

## The in-game collision system (Phase A)

A new `features/terrain` (or `features/map`) system replaces the mountain collider ring:

- **`buildCollisionGrid(map)`** → an immutable grid object with an O(1) `isBlocked(x, z)` query.
- **`gridBlockSystem(world, mover, grid)`** — run in the movement path for **every** entity that should
  be walled (the active rig; each camp guard). After the mover integrates its position, sample the grid:
  if the destination cell is blocked, **resolve position only** (don't kill speed) — the same
  position-only push-out the existing collision-response uses, so a held turn pivots the rig off a wall
  (the lesson from `collision-spec.md` §3: speed-bleed makes walls sticky). Sampling a **small ring of
  points at the mover's collision radius** (not just the centre) keeps a wide rig from corner-clipping.
- **The mountain mesh stays a pure visual.** `spawnMountainRing` keeps spawning the one `mountain-range`
  GLB; it **drops the collider ring** entirely. Blocking now comes from the painted grid, which is what
  makes the gaps exactly drivable and the rock exactly solid.
- **`worldBoundsSystem` folds in / stays.** Out-of-grid reads as blocked, so the painted rim *is* the
  world-end; keep `worldBoundsSystem` only if a cheap hard circular clamp is still wanted as a backstop.

### Relationship to the existing collision layer
[`collision-spec.md`](collision-spec.md) is **unchanged** and still owns:

- **dynamic entity-vs-entity** — rig ↔ camp body, rig ↔ structure footprint you drive up to, projectile
  hits, scrap-pickup reach. Round, moving, small → circles are right.

This spec owns **static world geometry only** — the authored, irregular, fixed silhouette. The two
coexist: a frame resolves dynamic circle contacts *and* samples the static grid. We do **not** migrate
scrap piles / shops / camps off their circle colliders — only the mountains (and future hand-authored
walls/edges) move to the grid.

---

## The editor mode

- **Launch:** a game launch mode, e.g. `npm run dev:editor` (a `main.ts` mode beside `dev:sandbox`), or a
  `?editor` flag. It must reuse the game's stage, camera, world, and asset registry — so it lives in the
  **game** (`features/map` + an `app/` editor bootstrap), **not** a sibling app (reaching across apps
  would break the clean-separation rule; the editor needs full game context).
- **View:** a top-down ORTHOGRAPHIC camera over the map (a `T` tilt toggle swings oblique to read the
  art's relief), with the real ground + mountain mesh visible underneath so you author *against the art*.
- **Authoring is VECTOR, not raster.** You draw collision as **spline paths** — drop control points
  (Draw mode), then **drag any point to bend the curve** (Edit mode); the path renders as a smooth
  Catmull-Rom curve through the points. A path is **open** (a wall of adjustable thickness) or **closed**
  (a filled region), and each either **adds** collision or **carves** it (to refine the baked mountain).
  Resolution-independent — you draw real curves, not stamp cells. Painting cells directly was tried and
  rejected: even fine cells can't make a smooth curve and pixel-perfecting a whole map is untenable.
- **Compile + preview:** the shapes compile into the grid live (the same `compileCollision`: mesh-baked
  base, then each shape filled/stroked/carved); a translucent **red wash** shows the compiled collision
  under the crisp shape lines + draggable handles.
- **Save/load — the one real design question.** A browser can't write the repo directly. Options, in
  preference order:
  1. **Dev-server write endpoint** (recommended): a small Vite dev-middleware plugin that accepts a
     `POST` of the map JSON and writes it to `…/maps/<name>.map.json`. Dev-only; one "Save" button, no
     manual file shuffling. Cleanest authoring loop.
  2. **Download + commit:** the editor offers the JSON as a file download; Jaco drops it into the repo.
     Zero server code, clunkier loop.
  3. **localStorage for iteration + an Export button** for the canonical save. Good for fast trial; still
     needs (1) or (2) to land.
  The painted map then becomes the seed the **real game** loads.

---

## Phase B — decoration placement (the payoff)

Once paint-and-serialize exists, decoration is the same machinery one layer up:

- an **asset palette** from `shared/assets.ts`;
- **click-to-place**, then move / rotate (`rotationY`) / scale a selected instance;
- **serialize** the instance list into the same map file;
- the game **loads + renders** them as static `Renderable` scenery at seed time.

This is the "I could start decorating around the shops" goal. It is **out of scope for Phase A** —
ship grid collision first (it's what unblocks playable Phase 1), then build placement on the proven
serialize/load spine.

---

## What changes in the current code (when Phase A lands)

- **`features/terrain/mountain-ring.ts`** — keep the visual mesh spawn; **delete the collider ring**
  (`COLLIDER_*`, the per-angle Solid loop). The `MountainGap` data moves to "documentation of where the
  painted gaps should be," or is dropped (the paint is now the source of truth for the gaps).
- **`features/camps/…` movement** — route guard movement through `gridBlockSystem` so guards respect the
  wall.
- **`app/scenarios/real-game.ts`** — load `…/maps/real-game.map.json` and build the grid at seed time;
  pass the grid to the systems that need it via `bootstrap`.
- **`features/terrain/terrain.test.ts`** — the ring tests retire; new tests cover world↔cell mapping,
  `isBlocked` at gap vs wall, and `gridBlockSystem` pushing a mover out of a blocked cell while leaving a
  clear-cell mover untouched.
- **`features/terrain/CLAUDE.md`** — drop the "known limitation" note; document the grid as the static
  blocker.

---

## Non-goals (keep the scope honest)

- **Not** a general 3-D level editor — it paints a **2-D, top-down blocking mask** + flat-placed props,
  which is all the top-down driving game needs.
- **Not** a physics engine — still no rigid bodies, still position-only resolution.
- **Not** runtime/player-facing — it's a **dev authoring tool**; the player loads a baked map.
- **Not** a migration of dynamic colliders — scrap/shop/camp circle colliders stay (see "Relationship").

## Open questions / dials

- **Cell size** (0.5 u): finer hand-drawing vs paint/redraw cost + bytes. 0.5 draws smoothly; going
  finer (0.25) quadruples the cells — re-bake the committed map if it changes.
- **Mover sampling** — how many points around the collision radius to sample per step (centre-only
  corner-clips a wide rig; an 8-point ring is safe and still cheap).
- **Save mechanism** — endpoint vs download vs localStorage (above); pick when Phase A starts.
- **One grid vs layered grids** — a single blocked/clear grid now; a future "surface type" layer (sand
  vs rock affecting handling) is a *captured idea*, not committed.
