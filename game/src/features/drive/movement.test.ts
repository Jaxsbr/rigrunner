import { describe, it, expect } from 'vitest';
import { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { Drivetrain } from '@features/drive/drivetrain';
import { Velocity } from '@features/drive/velocity';
import { DriveControl } from '@features/drive/drive-control';
import { Part } from '@common/components/part';
import { Mount } from '@common/components/mount';
import { EngineSpec } from '@common/components/engine-spec';
import type { EngineSpec as EngineSpecData } from '@common/components/engine-spec';
import { movementSystem } from './movement';

/** A rig that can be driven. By default it has an engine mounted so it has propulsion. */
function drivable(world: World, withEngine = true): EntityId {
  const e = world.createEntity();
  world.add(e, Transform, { x: 0, z: 0, rotationY: 0 });
  world.add(e, Drivetrain, { friction: 8, turnRadius: 4, reverseFactor: 0.5 });
  world.add(e, Velocity, { speed: 0 });
  world.add(e, DriveControl, { throttle: 0, steer: 0 });
  if (withEngine) mountEngine(world, e, { power: 12, torque: 10 });
  return e;
}

function mountEngine(world: World, rig: EntityId, spec: EngineSpecData): EntityId {
  const p = world.createEntity();
  world.add(p, Part, { kind: 'engine' });
  world.add(p, Mount, { rig, col: 0, row: 0, yaw: 0 });
  world.add(p, EngineSpec, spec);
  return p;
}

describe('movementSystem', () => {
  it('accelerates forward at the engine torque under throttle', () => {
    const w = new World();
    const e = drivable(w);
    w.get(e, DriveControl)!.throttle = 1;
    movementSystem(w, 0.1);
    expect(w.get(e, Velocity)!.speed).toBeCloseTo(1); // torque 10 * 1 * 0.1
  });

  it('clamps to the engine top speed (power)', () => {
    const w = new World();
    const e = drivable(w);
    w.get(e, DriveControl)!.throttle = 1;
    for (let i = 0; i < 100; i++) movementSystem(w, 0.1);
    expect(w.get(e, Velocity)!.speed).toBeCloseTo(12); // power
  });

  it('coasts to rest under friction when throttle is released', () => {
    const w = new World();
    const e = drivable(w);
    w.get(e, Velocity)!.speed = 4;
    movementSystem(w, 1); // friction 8 * 1 = 8 > 4 → fully stopped
    expect(w.get(e, Velocity)!.speed).toBe(0);
  });

  it('drives along its heading (forward = -z)', () => {
    const w = new World();
    const e = drivable(w);
    w.get(e, Velocity)!.speed = 4;
    w.get(e, DriveControl)!.throttle = 1; // keep moving so friction doesn't zero it
    movementSystem(w, 0.1);
    const t = w.get(e, Transform)!;
    expect(t.z).toBeLessThan(0);
    expect(Math.abs(t.x)).toBeLessThan(1e-9);
  });

  it('only steers while moving', () => {
    const w = new World();
    const e = drivable(w);
    w.get(e, DriveControl)!.steer = 1;

    movementSystem(w, 0.1); // parked → no turn
    expect(w.get(e, Transform)!.rotationY).toBe(0);

    w.get(e, Velocity)!.speed = 5;
    movementSystem(w, 0.1); // moving → turns
    expect(w.get(e, Transform)!.rotationY).toBeGreaterThan(0);
  });

  it('ignores throttle with no engine mounted, and coasts to rest', () => {
    const w = new World();
    const e = drivable(w, false); // no engine → no propulsion
    w.get(e, DriveControl)!.throttle = 1;
    movementSystem(w, 0.1);
    expect(w.get(e, Velocity)!.speed).toBe(0);

    w.get(e, Velocity)!.speed = 4;
    movementSystem(w, 1); // friction 8 > 4 → stopped
    expect(w.get(e, Velocity)!.speed).toBe(0);
  });

  it('a stronger engine reaches a higher top speed than a weaker one', () => {
    const top = (spec: EngineSpecData): number => {
      const w = new World();
      const e = w.createEntity();
      w.add(e, Transform, { x: 0, z: 0, rotationY: 0 });
      w.add(e, Drivetrain, { friction: 8, turnRadius: 4, reverseFactor: 0.5 });
      w.add(e, Velocity, { speed: 0 });
      w.add(e, DriveControl, { throttle: 1, steer: 0 });
      mountEngine(w, e, spec);
      for (let i = 0; i < 200; i++) movementSystem(w, 0.1);
      return w.get(e, Velocity)!.speed;
    };
    expect(top({ power: 13, torque: 19 })).toBeGreaterThan(top({ power: 8, torque: 11 }));
  });
});
