import { describe, it, expect } from 'vitest';
import { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { Collider } from '@common/components/collider';
import { Solid } from '@common/components/solid';
import { Drivetrain } from './drivetrain';
import { Velocity } from './velocity';
import { collisionResponseSystem } from './collision-response';

/** A driven mover (rig): Transform + Drivetrain + Velocity + Collider. Faces -z (rotationY 0) by default. */
function mover(world: World, x: number, z: number, radius: number, speed = 0, rotationY = 0): EntityId {
  const e = world.createEntity();
  world.add(e, Transform, { x, z, rotationY });
  world.add(e, Drivetrain, { friction: 8, turnRadius: 4, reverseFactor: 0.5 });
  world.add(e, Velocity, { speed });
  world.add(e, Collider, { radius });
  return e;
}

/** A solid obstacle: Collider + Solid. */
function solid(world: World, x: number, z: number, radius: number): EntityId {
  const e = world.createEntity();
  world.add(e, Transform, { x, z, rotationY: 0 });
  world.add(e, Collider, { radius });
  world.add(e, Solid, true);
  return e;
}

describe('collisionResponseSystem', () => {
  it('pushes an overlapping mover out to exactly touching', () => {
    const w = new World();
    const m = mover(w, 0, 0, 1);
    solid(w, 0, -2, 1.5); // reach 2.5, dist 2.0 → penetrating by 0.5, straight ahead (-z)
    collisionResponseSystem(w);
    const t = w.get(m, Transform)!;
    // pushed back along +z (solid → mover) to a centre distance of exactly the combined radius.
    expect(Math.hypot(t.x - 0, t.z - -2)).toBeCloseTo(2.5);
    expect(t.x).toBeCloseTo(0);
    expect(t.z).toBeCloseTo(0.5);
  });

  it('leaves a mover clear of every solid untouched', () => {
    const w = new World();
    const m = mover(w, 0, 0, 1, 5);
    solid(w, 10, 0, 1.5);
    collisionResponseSystem(w);
    const t = w.get(m, Transform)!;
    expect(t.x).toBe(0);
    expect(t.z).toBe(0);
    expect(w.get(m, Velocity)!.speed).toBe(5); // no contact, no bleed
  });

  it('preserves speed on a head-on hit so the rig can still steer off (no sticky pin)', () => {
    const w = new World();
    const m = mover(w, 0, 0, 1, 6); // driving forward (-z) into a solid dead ahead
    solid(w, 0, -2, 1.5);
    collisionResponseSystem(w);
    const t = w.get(m, Transform)!;
    expect(Math.hypot(t.x - 0, t.z - -2)).toBeCloseTo(2.5); // de-penetrated to the surface
    expect(w.get(m, Velocity)!.speed).toBeCloseTo(6);       // ...but speed kept — yaw ∝ speed can rotate it away
  });

  it('keeps speed on a glancing hit and still de-penetrates', () => {
    const w = new World();
    const m = mover(w, 0, 0, 1, 6); // heading -z; the solid is off to the side (+x)
    solid(w, 1.6, 0, 1); // reach 2, dist 1.6 → penetrating, normal purely sideways
    collisionResponseSystem(w);
    const t = w.get(m, Transform)!;
    expect(t.x).toBeCloseTo(-0.4); // shoved out along -x to touching
    expect(t.z).toBeCloseTo(0);
    expect(w.get(m, Velocity)!.speed).toBeCloseTo(6); // tangential motion survives — the slide continues
  });

  it('pushes out along the reverse heading when concentric with a solid', () => {
    const w = new World();
    const m = mover(w, 0, 0, 1, 4); // heading -z, so reverse heading is +z... pushed to -z
    solid(w, 0, 0, 1); // same centre — no defined normal
    collisionResponseSystem(w);
    const t = w.get(m, Transform)!;
    // reverse-heading push (heading itself is -z): out by the full penetration depth (reach 2 - dist 0).
    expect(t.x).toBeCloseTo(0);
    expect(t.z).toBeCloseTo(-2);
  });

  it('does NOT block a plain Collider without Solid (loose scrap stays drive-through)', () => {
    const w = new World();
    const m = mover(w, 0, 0, 1, 5);
    const scrap = w.createEntity(); // a footprint, but not Solid
    w.add(scrap, Transform, { x: 0, z: -0.5, rotationY: 0 });
    w.add(scrap, Collider, { radius: 0.4 });
    collisionResponseSystem(w);
    const t = w.get(m, Transform)!;
    expect(t.x).toBe(0);
    expect(t.z).toBe(0); // unmoved — only Solid blocks
    expect(w.get(m, Velocity)!.speed).toBe(5);
  });

  it('does NOT move a non-rig overlapping a solid (only driven movers de-penetrate)', () => {
    const w = new World();
    const prop = w.createEntity(); // a colliding entity with no Drivetrain/Velocity
    w.add(prop, Transform, { x: 0, z: 0, rotationY: 0 });
    w.add(prop, Collider, { radius: 1 });
    solid(w, 0, -1, 1);
    collisionResponseSystem(w);
    const t = w.get(prop, Transform)!;
    expect(t.x).toBe(0);
    expect(t.z).toBe(0);
  });

  it('resolves a mover against multiple overlapping solids in one pass', () => {
    const w = new World();
    const m = mover(w, 0, 0, 1);
    // Two solids on PERPENDICULAR sides (not opposing): resolving the first leaves the second still
    // overlapping, and its push moves the mover further from the first — so one pass clears both. (A
    // mover wedged between OPPOSING solids is the corner case the system defers to a second pass.)
    solid(w, -1.5, 0, 1); // to the left
    solid(w, 0, -1.5, 1); // ahead
    collisionResponseSystem(w);
    const t = w.get(m, Transform)!;
    expect(Math.hypot(t.x - -1.5, t.z - 0)).toBeGreaterThanOrEqual(2 - 1e-3);
    expect(Math.hypot(t.x - 0, t.z - -1.5)).toBeGreaterThanOrEqual(2 - 1e-3);
  });
});
