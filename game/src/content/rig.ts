import type { World } from '../core/world';
import type { EntityId } from '../core/types';
import { Transform } from '../components/transform';
import { Engine } from '../components/engine';
import { Velocity } from '../components/velocity';
import { DriveControl } from '../components/drive-control';
import { Renderable } from '../components/renderable';

/**
 * The first composition: a minimal drivable rig — a powered, steerable box. A "rig" is
 * not a class; it is this specific SET of capabilities. New entity kinds are new
 * functions like this (or, later, data), never new subclasses.
 */
export function spawnRig(world: World, x = 0, z = 0): EntityId {
  const e = world.createEntity();
  world.add(e, Transform, { x, z, rotationY: 0 });
  world.add(e, Engine, {
    accel: 16, maxSpeed: 12, reverseMax: 6, friction: 12, turnRate: 2.3, turnFullSpeed: 5,
  });
  world.add(e, Velocity, { speed: 0 });
  world.add(e, DriveControl, { throttle: 0, steer: 0 });
  world.add(e, Renderable, { shape: 'box', size: { x: 2, y: 0.8, z: 3 }, color: 0x88aa88 });
  return e;
}
