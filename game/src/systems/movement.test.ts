import { describe, it, expect } from 'vitest';
import { World } from '../core/world';
import { Transform } from '../components/transform';
import { Engine } from '../components/engine';
import { Velocity } from '../components/velocity';
import { DriveControl } from '../components/drive-control';
import { movementSystem } from './movement';

function drivable(world: World) {
  const e = world.createEntity();
  world.add(e, Transform, { x: 0, z: 0, rotationY: 0 });
  world.add(e, Engine, {
    accel: 10, maxSpeed: 12, reverseMax: 6, friction: 8, turnRate: 2, turnFullSpeed: 5,
  });
  world.add(e, Velocity, { speed: 0 });
  world.add(e, DriveControl, { throttle: 0, steer: 0 });
  return e;
}

describe('movementSystem', () => {
  it('accelerates forward under throttle', () => {
    const w = new World();
    const e = drivable(w);
    w.get(e, DriveControl)!.throttle = 1;
    movementSystem(w, 0.1);
    expect(w.get(e, Velocity)!.speed).toBeCloseTo(1); // 10 * 1 * 0.1
  });

  it('clamps to the engine top speed', () => {
    const w = new World();
    const e = drivable(w);
    w.get(e, DriveControl)!.throttle = 1;
    for (let i = 0; i < 100; i++) movementSystem(w, 0.1);
    expect(w.get(e, Velocity)!.speed).toBeCloseTo(12);
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
});
