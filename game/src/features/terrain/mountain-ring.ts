import type { World } from '@core/world';
import { Transform } from '@common/components/transform';
import { Renderable } from '@common/components/renderable';
import { Collider } from '@common/components/collider';
import { Solid } from '@common/components/solid';

/**
 * The bounding mountain range — Phase 1's "bowl wall". The worked floor disc sits inside a continuous
 * ridge of peaks (the one `mountain-range` mesh): the rig is walled in, save the exit gaps.
 *
 * Visual and barrier are deliberately SEPARATE:
 *  - the VISUAL is ONE continuous, noise-displaced ridge mesh placed once at the origin (so the range
 *    reads as a connected wall, with no object-to-object seams — it is not a row of tiled props);
 *  - the BARRIER is an invisible ring of Solid colliders along the ridge centreline, spaced to OVERLAP
 *    into one unbroken wall, skipping only the gap arcs. Collision stays circle-based while the mesh
 *    stays continuous, so the only place the rig can pass is a real, visible gap.
 *
 * GEOMETRY CONTRACT: `MOUNTAIN_RING_RADIUS` and the caller's gap angles must match the values baked
 * into `mountain-range.glb` (`tools/blender/assets/mountain_range.py`) — the visual ridge, this
 * collider ring, and the camps that guard the gaps all line up off them.
 */

/** The ridge centreline radius — matches `R_WALL` baked into `mountain-range.glb`. */
export const MOUNTAIN_RING_RADIUS = 95;

/** A drivable exit cut into the ring: no collider sits within `halfWidth` of `angle` (radians). */
export interface MountainGap {
  /** Gap centre angle (radians; 0 = +x, increasing counter-clockwise — the same mapping camps use). */
  angle: number;
  /** Half the gap's angular width — the cleared mouth between the flanking colliders. */
  halfWidth: number;
}

// The invisible blocker ring: enough colliders that neighbours overlap into a continuous wall, each
// wide enough to seal the spacing. Tuned so the only openings are the gaps, not slots between bodies.
const COLLIDER_COUNT = 44;
const COLLIDER_RADIUS = 9;

/** Smallest absolute angular distance between two angles (radians), in [0, π]. */
function angularDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % (Math.PI * 2);
  return d > Math.PI ? Math.PI * 2 - d : d;
}

/**
 * Ring the world: place the continuous ridge mesh once at the origin, then lay the invisible Solid
 * collider ring under it, leaving the given gaps open. Static scenery — seeded in `seedStaticWorld`,
 * identical every load (fixed positions), so it carries no persisted state.
 */
export function spawnMountainRing(world: World, gaps: MountainGap[] = []): void {
  // The visual wall — one continuous mesh, no collider of its own.
  const mesh = world.createEntity();
  world.add(mesh, Transform, { x: 0, z: 0, rotationY: 0 });
  world.add(mesh, Renderable, { shape: 'model', assetId: 'mountain-range' });

  // The physical wall — an overlapping ring of invisible Solid colliders, skipping the gap arcs.
  for (let i = 0; i < COLLIDER_COUNT; i++) {
    const angle = (i / COLLIDER_COUNT) * Math.PI * 2;
    if (gaps.some((g) => angularDistance(angle, g.angle) < g.halfWidth)) continue; // a gap — leave it open
    const e = world.createEntity();
    world.add(e, Transform, {
      x: Math.cos(angle) * MOUNTAIN_RING_RADIUS,
      z: Math.sin(angle) * MOUNTAIN_RING_RADIUS,
      rotationY: 0,
    });
    world.add(e, Collider, { radius: COLLIDER_RADIUS });
    world.add(e, Solid, true);
  }
}
