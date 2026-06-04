import { describe, it, expect } from 'vitest';
import { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Drivetrain } from '@features/drive/drivetrain';
import { Part } from '@common/components/part';
import { Mount } from '@common/components/mount';
import { EngineSpec } from '@common/components/engine-spec';
import type { EngineSpec as EngineSpecData } from '@common/components/engine-spec';
import { Weight } from '@common/components/weight';
import { totalRigWeight } from '@common/sim/weight';
import { rigPerformance } from './drive';

function rig(world: World, weight: number): EntityId {
  const e = world.createEntity();
  world.add(e, Drivetrain, { friction: 8, turnRate: 2, turnFullSpeed: 5, reverseFactor: 0.5 });
  world.add(e, Weight, { value: weight });
  return e;
}

function mountEngine(world: World, r: EntityId, spec: EngineSpecData, weight: number): EntityId {
  const p = world.createEntity();
  world.add(p, Part, { kind: 'engine' });
  world.add(p, Mount, { rig: r, col: 0, row: 0, yaw: 0 });
  world.add(p, EngineSpec, spec);
  world.add(p, Weight, { value: weight });
  return p;
}

describe('totalRigWeight', () => {
  it('sums the chassis weight and every mounted part', () => {
    const w = new World();
    const r = rig(w, 10);
    expect(totalRigWeight(w, r)).toBe(10);
    mountEngine(w, r, { power: 8, torque: 11 }, 4);
    mountEngine(w, r, { power: 13, torque: 19 }, 7);
    expect(totalRigWeight(w, r)).toBe(21); // 10 + 4 + 7
  });

  it('only counts parts mounted on the asked-for rig', () => {
    const w = new World();
    const a = rig(w, 10);
    const b = rig(w, 10);
    mountEngine(w, b, { power: 8, torque: 11 }, 4);
    expect(totalRigWeight(w, a)).toBe(10);
  });
});

describe('rigPerformance', () => {
  it('is dead with no engine', () => {
    const w = new World();
    const r = rig(w, 10);
    const perf = rigPerformance(w, r);
    expect(perf.mobility).toBe(0);
    expect(perf.topSpeed).toBe(0);
    expect(perf.acceleration).toBe(0);
  });

  it('weight drags top speed and acceleration below the raw engine figures', () => {
    const w = new World();
    const r = rig(w, 10);
    mountEngine(w, r, { power: 13, torque: 19 }, 7);
    const perf = rigPerformance(w, r);
    expect(perf.power).toBe(13);
    expect(perf.torque).toBe(19);
    expect(perf.mobility).toBeGreaterThan(0);
    expect(perf.mobility).toBeLessThan(1);
    expect(perf.topSpeed).toBeLessThan(13); // weight bit into the raw power
    expect(perf.acceleration).toBeLessThan(19);
    expect(perf.topSpeed).toBeCloseTo(13 * perf.mobility);
  });

  it('a heavier rig is slower with the same engine', () => {
    const light = new World();
    const rl = rig(light, 10);
    mountEngine(light, rl, { power: 13, torque: 19 }, 7);

    const heavy = new World();
    const rh = rig(heavy, 40); // much heavier chassis
    mountEngine(heavy, rh, { power: 13, torque: 19 }, 7);

    expect(rigPerformance(heavy, rh).topSpeed).toBeLessThan(rigPerformance(light, rl).topSpeed);
  });

  it('more torque shrugs off the same weight (better mobility)', () => {
    const lowT = new World();
    const rlo = rig(lowT, 20);
    mountEngine(lowT, rlo, { power: 10, torque: 8 }, 0);

    const highT = new World();
    const rhi = rig(highT, 20);
    mountEngine(highT, rhi, { power: 10, torque: 24 }, 0);

    // Same weight + same power, but the high-torque rig keeps more of its top speed.
    expect(rigPerformance(highT, rhi).mobility).toBeGreaterThan(rigPerformance(lowT, rlo).mobility);
    expect(rigPerformance(highT, rhi).topSpeed).toBeGreaterThan(rigPerformance(lowT, rlo).topSpeed);
  });
});
