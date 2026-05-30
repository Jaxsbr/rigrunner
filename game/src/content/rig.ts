import type { World } from '../core/world';
import type { EntityId } from '../core/types';
import { Transform } from '../components/transform';
import { Engine } from '../components/engine';
import { Velocity } from '../components/velocity';
import { DriveControl } from '../components/drive-control';
import { Renderable } from '../components/renderable';

/**
 * The first composition: a minimal drivable rig — a powered, steerable drive-train. A "rig"
 * is not a class; it is this specific SET of capabilities. New entity kinds are new
 * functions like this (or, later, data), never new subclasses.
 *
 * Rendered as the `rig` GLB: a chassis with a 2×3 mounting deck and 6 wheels. The wheels are
 * separate named nodes the render layer spins by the rig's speed (see RenderView.animateWheels).
 */
export function spawnRig(world: World, x = 0, z = 0): EntityId {
  const e = world.createEntity();
  world.add(e, Transform, { x, z, rotationY: 0 });
  world.add(e, Engine, {
    accel: 16, maxSpeed: 12, reverseMax: 6, friction: 12, turnRate: 2.3, turnFullSpeed: 5,
  });
  world.add(e, Velocity, { speed: 0 });
  world.add(e, DriveControl, { throttle: 0, steer: 0 });
  world.add(e, Renderable, { shape: 'model', assetId: 'rig' });
  return e;
}
