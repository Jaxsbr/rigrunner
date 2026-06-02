import type { World } from '../core/world';
import type { EntityId } from '../core/types';
import { Transform } from '../components/transform';
import { Renderable } from '../components/renderable';

/**
 * The Reclaimer, staged in the world (Option C / PR2). A single entity carrying the articulated
 * `reclaimer-arm` model — the render layer parents its `reclaimer-bucket` head onto the wrist
 * socket and drives the joints (see render/articulation.ts), so the head needs no entity of its
 * own. The arm GLB stands on its own base at the ground (base-centre origin), so it sits on the
 * staging deck with no platform.
 *
 * Deliberately NOT a part yet: it has no Part / Mount / Collider — it's a stationary prop that
 * proves the in-game articulation runtime. PR3 turns it into a buildable, mountable, directional
 * part; PR4 wires the dig to a pile.
 */
export function spawnReclaimer(world: World, x: number, z: number, rotationY = 0): EntityId {
  const e = world.createEntity();
  world.add(e, Transform, { x, z, rotationY });
  world.add(e, Renderable, { shape: 'model', assetId: 'reclaimer-arm' });
  return e;
}
