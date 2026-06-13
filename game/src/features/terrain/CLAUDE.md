# `features/terrain/` — the world's bounding terrain + edge

The non-playable terrain that bounds the world — Phase 1's "bowl wall" + the world-end
(`real-world-and-progression-spec.md`). The worked floor disc sits inside a continuous ridge of peaks,
with a hard black edge a little past the ridge that the rig can't cross.

What's here:

- **`mountain-ring`** (`spawnMountainRing`) — the bowl wall. Visual and barrier are SEPARATE on purpose:
  the visual is ONE continuous, noise-displaced ridge mesh (`mountain-range`, placed once at the origin)
  so the range reads as a connected wall with no object seams; the barrier is an invisible ring of
  overlapping Solid colliders along the centreline (`MOUNTAIN_RING_RADIUS`), skipping only the gap arcs.
  Collision stays circle-based while the mesh stays continuous.
- **`world-bounds`** (`worldBoundsSystem`) — the world-end: clamps the rig back inside a circular
  boundary just inside the floor disc's rim, so it can't drive off into the black void beyond the map.

**Known limitation (interim — the collider ring is on its way out).** The barrier is a ring of circles
approximating an irregular mesh silhouette, so it's wrong in both directions at once: circles bulge into
the gaps (a visible exit is partly walled), and fall short of the mesh's outward bulges (you can drive
*into* the rock where it juts past the ring). Camp guards also ignore it (only the rig runs collision
response). A smooth primitive can't trace a jagged edge — so this ring is **replaced**, not tuned, by the
painted-collision grid in [`docs/specs/map-editor-spec.md`](../../../../docs/specs/map-editor-spec.md):
the grid *is* the silhouette (gaps exactly drivable, rock exactly solid) and one query blocks the rig and
enemies alike. Until that lands, treat the gap navigation as approximate.

Single-owner / placement rules at the point of edit:

- **GEOMETRY CONTRACT.** `MOUNTAIN_RING_RADIUS` + the gap angles MUST match the values baked into
  `mountain-range.glb` (`tools/blender/assets/mountain_range.py`), and the world-end reads `WORLD_RADIUS`
  from `stage.ts`. The visual ridge, the collider ring, the world-end, and the camps that guard the gaps
  all line up off these — change a radius and you rebuild the GLB.
- **The mountain range is scenery, not a part** — one authored `mountain-range.glb`, no tier matrix. It's
  placed once at world size (not scaled per instance), so it carries its true radius + peak heights.
- **Placement is DETERMINISTIC.** Static scenery seeded in `seedStaticWorld` (runs on New Game AND
  Continue), so it must land identically every load and carries no persisted state.
- **Cross-feature direction (ADR-003):** terrain depends downhill only on `@common`/`@core` (the
  components + `WORLD_RADIUS`). `@common`/`@core` never import it; the scenario (`app/`) seeds the ring,
  and `bootstrap` dispatches `worldBoundsSystem` each frame (passing the active rig).
