import { describe, it, expect } from 'vitest';
import { World } from '@core/world';
import { Transform } from '@common/components/transform';
import { Projectile, spawnProjectile } from './projectile';
import { projectileMoveSystem } from './projectile-system';

describe('spawnProjectile', () => {
  it('heads straight at the target at the given speed, living range ÷ speed seconds', () => {
    const world = new World();
    const p = spawnProjectile(world, 'rig', 0, 0, 0, -10, 20, 5, 20); // target 10u ahead (−Z), speed 20, range 20
    const proj = world.get(p, Projectile)!;
    expect(proj.team).toBe('rig');
    expect(proj.damage).toBe(5);
    expect(proj.vz).toBeCloseTo(-20); // heading −Z
    expect(proj.vx).toBeCloseTo(0);
    expect(proj.ttl).toBeCloseTo(1); // 20 / 20
  });
});

describe('projectileMoveSystem', () => {
  it('advances a projectile along its velocity', () => {
    const world = new World();
    const p = spawnProjectile(world, 'rig', 0, 0, 0, -10, 20, 5, 20);
    projectileMoveSystem(world, 0.25);
    expect(world.get(p, Transform)!.z).toBeCloseTo(-5); // 20 u/s × 0.25 s, toward −Z
  });

  it('destroys a projectile once its time-to-live runs out', () => {
    const world = new World();
    const p = spawnProjectile(world, 'enemy', 0, 0, 0, -1, 10, 3, 1); // ttl = 1 / 10 = 0.1 s
    projectileMoveSystem(world, 0.2); // overshoot the ttl
    expect(world.isAlive(p)).toBe(false);
  });
});
