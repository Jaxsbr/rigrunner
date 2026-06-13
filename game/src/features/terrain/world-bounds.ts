import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { WORLD_RADIUS } from '@common/render/stage';

/**
 * The world-end: a hard circular boundary just inside the floor disc's edge. The map is a finite,
 * hand-authored disc with a black void beyond it (see `stage.ts`), so the rig must not be able to
 * drive off into the void — `worldBoundsSystem` clamps it back to the boundary each frame.
 *
 * The mountain ring (with its gaps) is the IN-WORLD wall; this is the absolute backstop a few metres
 * past the floor's rim, reached only by driving out through a gap and across the outer band. Position
 * is clamped (not the velocity), so holding into the edge just parks the rig against it.
 */
const WORLD_END_RADIUS = WORLD_RADIUS - 3;

/** Hold the rig inside the world-end: if it's past the boundary, pull it back onto the rim. */
export function worldBoundsSystem(world: World, rig: EntityId): void {
  const t = world.get(rig, Transform);
  if (!t) return;
  const r = Math.hypot(t.x, t.z);
  if (r > WORLD_END_RADIUS) {
    const k = WORLD_END_RADIUS / r;
    t.x *= k;
    t.z *= k;
  }
}
