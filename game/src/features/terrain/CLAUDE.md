# `features/terrain/` — the world's bounding terrain, collision + edge

The non-playable terrain that bounds the world — Phase 1's "bowl wall" + the world-end
(`real-world-and-progression-spec.md`). The worked floor disc sits inside a continuous ridge of peaks,
with a hard black edge a little past the ridge that the rig can't cross.

What's here:

- **`mountain-mesh`** (`spawnMountainRange`) — the bowl wall's VISUAL: ONE continuous, noise-displaced
  ridge mesh (`mountain-range`, placed once at the origin) so the range reads as a connected wall with no
  object seams. It carries no collider of its own.
- **`collision-grid`** (`CollisionGrid`, `gridBlockSystem`) — the bowl wall's PHYSICS. Static world
  blocking is a painted occupancy grid (a blocked/clear raster over the disc), not primitive colliders —
  a circle can't trace the mesh's irregular silhouette (it bulges into the gaps AND falls short of the
  rock at once). The grid IS the silhouette: gaps exactly drivable, rock exactly solid. `gridBlockSystem`
  is circle-vs-cell de-penetration with the SAME feel as `drive/collision-response` (slide, keep speed),
  applied to the rig and the camp guards alike. See `docs/specs/map-editor-spec.md`.
- **`footprint-bake`** (`rasterizeFootprint`) — bakes a mesh's standing-rock footprint into a grid (the
  "accurate seed from the art" the map editor opens with); shared by the editor's Bake action.
- **`world-grid`** (`WorldGrid`, `getWorldGrid`/`setWorldGrid`) — the singleton component that carries the
  loaded grid on the World, so the scenario seeds it and `bootstrap` finds it without a global.
- **`world-bounds`** (`worldBoundsSystem`) — the world-end: clamps the rig back inside a circular boundary
  just inside the floor disc's rim, so it can't drive off into the black void beyond the map. The OUTER
  backstop; the grid only encodes the ridge, so the void past it is held here.

The committed map lives at `app/scenarios/maps/real-game.map.json`; it's authored/refined in the editor
(`app/editor`, launched by `npm run dev:editor`) and loaded by `seedStaticWorld`.

Single-owner / placement rules at the point of edit:

- **The mesh and the grid are baked from the SAME source**, so they can't drift: the grid is rasterized
  from this mesh's footprint. If the mountain art changes (`mountain_range.py` → rebuild the GLB),
  re-bake the grid in the editor and re-save the map. The camps that guard the gaps line up off the gap
  angles in `real-game` — the same gaps baked into the GLB.
- **The mountain range is scenery, not a part** — one authored `mountain-range.glb`, no tier matrix.
- **Placement is DETERMINISTIC.** Static scenery seeded in `seedStaticWorld` (New Game AND Continue), so
  it lands identically every load and carries no persisted state (the grid is re-loaded, not saved).
- **Cross-feature direction (ADR-003):** terrain depends downhill only on `@common`/`@core`.
  `@common`/`@core` never import it; the scenario (`app/`) seeds the mesh + grid, and `bootstrap`
  dispatches `gridBlockSystem` + `worldBoundsSystem` each frame.
