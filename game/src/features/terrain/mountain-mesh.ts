import type { World } from '@core/world';
import { Transform } from '@common/components/transform';
import { Renderable } from '@common/components/renderable';

/**
 * The bounding mountain range — the bowl wall, as ONE continuous, noise-displaced ridge mesh placed once
 * at the origin (so it reads as a connected wall, not a row of tiled props). PURELY VISUAL: the physical
 * wall is the painted collision grid (`collision-grid` + the committed map), baked from this mesh's own
 * footprint, so it traces the irregular silhouette exactly — the gaps are exactly drivable and the rock
 * exactly solid, which a ring of primitive colliders could never be (it bulged into the gaps and fell
 * short of the rock at once).
 *
 * GEOMETRY NOTE: the mesh is authored at world scale in `tools/blender/assets/mountain_range.py`, with
 * the exit gaps baked into the GLB. The grid is baked from THIS mesh in the editor, so the two cannot
 * drift; the camps that guard the gaps line up off the same gap angles (see `real-game`).
 */

/** The ridge centreline radius (≡ `R_WALL` in `mountain_range.py`) — a placement reference for callers. */
export const MOUNTAIN_RANGE_RADIUS = 95;

/** Place the continuous ridge mesh once at the origin. Static scenery: deterministic, no persisted state. */
export function spawnMountainRange(world: World): void {
  const mesh = world.createEntity();
  world.add(mesh, Transform, { x: 0, z: 0, rotationY: 0 });
  world.add(mesh, Renderable, { shape: 'model', assetId: 'mountain-range' });
}
