import type * as THREE from 'three';
import type { World } from '@core/world';
import type { EntityViews } from '@common/render/entity-views';
import { RestorableSite } from '@common/components/restorable-site';
import { ScrapPile } from './scrap-pile';
import { Dissolving, DISSOLVE_DURATION } from './dissolving';

/**
 * Scrap's "the world reacts" beat, sim-driven: as a reclaimed pile's `Dissolving` clock advances
 * (`pileClearSystem`), the emptied heap SINKS + SHRINKS into the ground while the stump RISES out of the
 * soil in its place. Both read the SAME `Dissolving.elapsed` (off each entity's own clock, started the
 * same frame), so the handoff stays co-timed — and frozen together when the sim pauses behind the loot popup.
 *
 * Owns no truth — it only re-poses meshes the reconciler already placed (the reconciler resets each
 * object's position to its Transform every frame, so this runs AFTER `view.sync` and wins for the frame).
 * Dispatched from `main.ts` (the shared render tier never imports a feature, ADR-003 §4), and run ALWAYS
 * — even paused — so a mid-dissolve pose holds behind an overlay instead of snapping back to rest. This
 * is the exact sibling of the camp's `animateCampTeardown`.
 */

const SINK_DEPTH = 2.8;   // how far the heap sinks below the ground before its entity despawns
const SPROUT_DROP = 1.1;  // how far underground the stump starts before it rises to its resting height

export function animateScrapPileClear(views: EntityViews, world: World): void {
  for (const [id, obj] of views.objects) {
    if (!world.isAlive(id) || !world.has(id, Dissolving)) continue;
    const p = Math.min(1, world.get(id, Dissolving)!.elapsed / DISSOLVE_DURATION);

    if (world.has(id, RestorableSite)) {
      // The lasting stump: rises from underground to its resting height as the heap dissolves, then holds.
      obj.position.y = -SPROUT_DROP * (1 - easeOut(p));
    } else if (world.has(id, ScrapPile)) {
      // The emptied heap: sinks + shrinks into the ground (its entity is destroyed once p reaches 1).
      const base = captureScale(obj);
      const e = easeIn(p);
      obj.position.y = -SINK_DEPTH * e;
      obj.scale.setScalar(base * (1 - e));
    }
  }
}

/** Remember the heap's scale at the dissolve's start (already worked down toward the slump floor by
 *  `animateScrapPile`), so the shrink lerps from there — not from a value this animator already squashed. */
function captureScale(obj: THREE.Object3D): number {
  const cached = obj.userData['clearScale'] as number | undefined;
  if (cached !== undefined) return cached;
  const s = obj.scale.x;
  obj.userData['clearScale'] = s;
  return s;
}

function easeIn(t: number): number {
  return t * t;
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}
