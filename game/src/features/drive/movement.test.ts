import { describe, it, expect } from 'vitest';
import { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { Drivetrain } from '@features/drive/drivetrain';
import { Velocity } from '@features/drive/velocity';
import { DriveControl } from '@features/drive/drive-control';
import { Part } from '@common/components/part';
import { Mount } from '@common/components/mount';
import { MountGrid } from '@common/components/mount-grid';
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

function mountEngine(world: World, rig: EntityId, spec: EngineSpecData, row = 0): EntityId {
  const p = world.createEntity();
  world.add(p, Part, { kind: 'engine' });
  world.add(p, Mount, { rig, col: 0, row, yaw: 0 });
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

describe('movementSystem — engine-set steering pivot', () => {
  /** A drivable rig with a 1×3 deck, moving forward at a clear yaw this step, one engine at `row`. */
  function steerable(world: World, engineRow: number): EntityId {
    const e = world.createEntity();
    world.add(e, Transform, { x: 0, z: 0, rotationY: 0 });
    world.add(e, Drivetrain, { friction: 8, turnRadius: 4, reverseFactor: 0.5 });
    world.add(e, Velocity, { speed: 10 }); // moving fast → a clear yaw this step (radius model)
    world.add(e, DriveControl, { throttle: 1, steer: 1 });
    world.add(e, MountGrid, { cols: 1, rows: 3, cellSize: 1, deckY: 0 });
    mountEngine(world, e, { power: 12, torque: 10 }, engineRow);
    return e;
  }

  it('rear- and front-mounted engines turn to the same heading but trace different arcs', () => {
    const w = new World();
    const rear = steerable(w, 2); // engine at the back (+Z)
    const front = steerable(w, 0); // engine at the front (−Z)
    movementSystem(w, 0.1);

    const r = w.get(rear, Transform)!;
    const f = w.get(front, Transform)!;
    // Same chassis, same steer/speed → identical yaw; only the pivot — hence the position — differs.
    expect(r.rotationY).toBeCloseTo(f.rotationY);
    // Rear pivot plants the back and swings the nose: the body tracks differently from a front pivot.
    expect(r.x).toBeLessThan(f.x);
    expect(r.z).toBeGreaterThan(f.z);
  });

  it('a centre-mounted engine turns about the origin, exactly like a deckless rig', () => {
    const w = new World();
    const centre = steerable(w, 1); // engine on the deck mid-line → pivot 0
    const plain = w.createEntity(); // no MountGrid → pivot 0 by the same fallback
    w.add(plain, Transform, { x: 0, z: 0, rotationY: 0 });
    w.add(plain, Drivetrain, { friction: 8, turnRadius: 4, reverseFactor: 0.5 });
    w.add(plain, Velocity, { speed: 10 });
    w.add(plain, DriveControl, { throttle: 1, steer: 1 });
    mountEngine(w, plain, { power: 12, torque: 10 });
    movementSystem(w, 0.1);

    const c = w.get(centre, Transform)!;
    const p = w.get(plain, Transform)!;
    expect(c.x).toBeCloseTo(p.x);
    expect(c.z).toBeCloseTo(p.z);
    expect(c.rotationY).toBeCloseTo(p.rotationY);
  });

  it('holds the rear pivot point fixed through the turn (the back stays planted)', () => {
    const w = new World();
    const rig = steerable(w, 2); // rear drive → pivot toward +Z
    const t0 = w.get(rig, Transform)!;
    // The pivot in world space, before the step: origin + the local-Z offset rotated by yaw (yaw 0).
    const pivotZ = 0.7 * 1; // PIVOT_REACH × deck half-length (rows 3, cellSize 1) — see steering.ts
    const before = { x: t0.x, z: t0.z + pivotZ };

    // Steer in place: speed present for authority, but the forward advance removed so we isolate the
    // rotation. (We can't zero speed — authority needs it — so subtract the heading advance after.)
    movementSystem(w, 0.1);
    const t1 = w.get(rig, Transform)!;
    const advance = w.get(rig, Velocity)!.speed * 0.1;
    const originAfter = {
      x: t1.x + Math.sin(t1.rotationY) * advance,
      z: t1.z + Math.cos(t1.rotationY) * advance,
    };
    // Recompute the pivot from the post-rotation origin + yaw; it should not have moved.
    const after = {
      x: originAfter.x + pivotZ * Math.sin(t1.rotationY),
      z: originAfter.z + pivotZ * Math.cos(t1.rotationY),
    };
    expect(after.x).toBeCloseTo(before.x);
    expect(after.z).toBeCloseTo(before.z);
  });
});
