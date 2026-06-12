import { describe, it, expect } from 'vitest';
import { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { Collider } from '@common/components/collider';
import { Drivetrain } from '@features/drive/drivetrain';
import { Velocity } from '@features/drive/velocity';
import { DriveControl } from '@features/drive/drive-control';
import { Part } from '@common/components/part';
import { Mount } from '@common/components/mount';
import { EngineSpec } from '@common/components/engine-spec';
import { movementSystem } from '@features/drive/movement';
import { collisionResponseSystem } from '@features/drive/collision-response';
import { spawnWorkshop } from '@features/workshop/workshop';
import { spawnWorldShop } from '@features/shop/world-shop-spawn';
import { spawnScrapPile } from '@features/scrap/scrap';

/**
 * Feature-level proof of the collision response against the ACTUAL world structures and the ACTUAL frame
 * order (movement → response, as app/bootstrap wires it): a rig driving head-on into a real structure stops
 * at its surface, never clips through, and settles to rest. The unit tests cover the response math in
 * isolation; this guards that the real spawners actually carry the Solid footprint and that the radii leave
 * the rig stopping cleanly at the surface.
 */

/** A driven rig with an engine mounted, matching the real chassis collider (r ≈ 1.0). Faces -z by default. */
function drivableRig(world: World, x: number, z: number, rotationY = 0): EntityId {
  const e = world.createEntity();
  world.add(e, Transform, { x, z, rotationY });
  world.add(e, Drivetrain, { friction: 8, turnRadius: 4, reverseFactor: 0.5 });
  world.add(e, Velocity, { speed: 0 });
  world.add(e, DriveControl, { throttle: 0, steer: 0 });
  world.add(e, Collider, { radius: 1.0 });
  const engine = world.createEntity();
  world.add(engine, Part, { kind: 'engine' });
  world.add(engine, Mount, { rig: e, col: 0, row: 0, yaw: 0 });
  world.add(engine, EngineSpec, { power: 12, torque: 10 });
  return e;
}

/** Advance the real sim order — movement integrates, then the response de-penetrates — for `n` frames. */
function drive(world: World, rig: EntityId, n: number, throttle: number, steer = 0, dt = 1 / 60): void {
  const ctl = world.get(rig, DriveControl)!;
  ctl.throttle = throttle;
  ctl.steer = steer;
  for (let i = 0; i < n; i++) {
    movementSystem(world, dt);
    collisionResponseSystem(world);
  }
}

const dist = (world: World, a: EntityId, b: EntityId): number => {
  const ta = world.get(a, Transform)!;
  const tb = world.get(b, Transform)!;
  return Math.hypot(ta.x - tb.x, ta.z - tb.z);
};

// Each real structure spawner, placed 8 m directly ahead of the rig (at -z).
const STRUCTURES: ReadonlyArray<[string, (w: World) => EntityId]> = [
  ['workshop', (w) => spawnWorkshop(w, 0, -8)],
  ['world shop', (w) => spawnWorldShop(w, 0, -8)],
  ['scrap pile', (w) => spawnScrapPile(w, 0, -8)],
];

describe('collision response vs. real world structures', () => {
  for (const [name, spawn] of STRUCTURES) {
    it(`stops a rig head-on at the ${name} surface without clipping through`, () => {
      const world = new World();
      const structure = spawn(world);
      const solidR = world.get(structure, Collider)!.radius; // proves the spawner gave it a footprint
      const rig = drivableRig(world, 0, 0);
      const surface = solidR + world.get(rig, Collider)!.radius; // centres' distance when the circles touch

      drive(world, rig, 600, 1); // ~10s of holding forward into it

      const d = dist(world, rig, structure);
      expect(d).toBeGreaterThanOrEqual(surface - 1e-2); // never clipped through
      expect(d).toBeLessThan(surface + 0.5);            // held right against the surface
    });
  }

  it('lets the rig steer off a structure after a head-on hit — no full reverse needed', () => {
    const world = new World();
    const workshop = spawnWorkshop(world, 0, -8);
    const solidR = world.get(workshop, Collider)!.radius;
    const rig = drivableRig(world, 0, 0);
    const surface = solidR + world.get(rig, Collider)!.radius;

    drive(world, rig, 180, 1); // pin head-on against the workshop
    expect(dist(world, rig, workshop)).toBeLessThan(surface + 0.1); // genuinely pinned at the surface

    // Hold a full turn, still FORWARD throttle (never reverse): the rig should pivot off and drive away.
    drive(world, rig, 360, 1, 1);
    expect(dist(world, rig, workshop)).toBeGreaterThan(surface + 2); // peeled off and drove clear
    expect(world.get(rig, Velocity)!.speed).toBeGreaterThan(0);      // forward throughout — no reverse required
  });
});
