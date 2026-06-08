import type * as THREE from 'three';
import type { World } from '@core/world';
import type { EntityViews } from '@common/render/entity-views';
import { Camp } from './camp';
import { CampDecor } from './camp-decor';
import { RestorableSite } from '@common/components/restorable-site';

/**
 * The camp's "world reacts" beat, sim-driven: as a cleared camp's `tornDown` clock advances
 * (`camp-system`), its structures + debris SINK and SHRINK into the ground while the restorable sprout
 * RISES out of the soil in their place. Both read the SAME `Camp.tornDown` progress (off each piece's
 * `CampDecor` link), so the dissolve stays co-timed — and frozen together when the sim pauses.
 *
 * Owns no truth — it only re-poses meshes the reconciler already placed (the reconciler resets each
 * object's position to its Transform every frame, so this runs AFTER `view.sync` and wins for the frame).
 * Dispatched from `main.ts` (the shared render tier never imports a feature, ADR-003 §4), and run ALWAYS
 * — even paused — so a mid-teardown pose holds behind an overlay instead of snapping back to rest.
 */

const SINK_DEPTH = 2.6; // how far a structure/debris piece sinks below the ground before it despawns
const SPROUT_DROP = 1.1; // how far underground the sprout starts before it rises to its resting height

export function animateCampTeardown(views: EntityViews, world: World): void {
  for (const [id, obj] of views.objects) {
    if (!world.isAlive(id) || !world.has(id, CampDecor)) continue;
    const camp = world.get(world.get(id, CampDecor)!.camp, Camp);
    const p = camp?.tornDown ?? 0;

    if (world.has(id, RestorableSite)) {
      // The lasting sprout: rises from underground to its resting height as the camp dissolves, then holds.
      obj.position.y = -SPROUT_DROP * (1 - easeOut(p));
    } else {
      // Transient structure/debris: sinks + shrinks into the ground (it's despawned once p reaches 1).
      const base = captureScale(obj);
      const e = easeIn(p);
      obj.position.y = -SINK_DEPTH * e;
      obj.scale.setScalar(base * (1 - e));
    }
  }
}

/** Remember a piece's authored (rest) uniform scale once, so the shrink lerps from it — not from a value
 *  this animator already squashed on a previous frame. Captured on first sight, while the camp still
 *  stands (p = 0), so it always records the true rest scale. */
function captureScale(obj: THREE.Object3D): number {
  const cached = obj.userData['teardownScale'] as number | undefined;
  if (cached !== undefined) return cached;
  const s = obj.scale.x;
  obj.userData['teardownScale'] = s;
  return s;
}

function easeIn(t: number): number {
  return t * t;
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}
