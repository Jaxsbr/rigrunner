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

function mountEngine(world: World, r: EntityId, spec: EngineSpecData, weight = 0): EntityId {
  const p = world.createEntity();
  world.add(p, Part, { kind: 'engine' });
  world.add(p, Mount, { rig: r, col: 0, row: 0, yaw: 0 });
  world.add(p, EngineSpec, spec);
  world.add(p, Weight, { value: weight });
  return p;
}

// Weight is parked (not consumed by drive yet) but still computed — this is the seam the felt-weight
// feature (Option A) reattaches to. Keep it correct so that re-wiring stays a one-line change.
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
    expect(perf.topSpeed).toBe(0);
    expect(perf.acceleration).toBe(0);
    expect(perf.reverse).toBe(0);
  });

  it('top speed and acceleration are the engine output directly', () => {
    const w = new World();
    const r = rig(w, 10);
    mountEngine(w, r, { power: 13, torque: 8 });
    const perf = rigPerformance(w, r);
    expect(perf.topSpeed).toBe(13); // = power
    expect(perf.acceleration).toBe(8); // = torque
    expect(perf.reverse).toBe(6.5); // 13 × reverseFactor 0.5
  });

  it('weight does not drag performance (parked) — a heavy and a light rig perform identically', () => {
    const light = new World();
    const rl = rig(light, 10);
    mountEngine(light, rl, { power: 13, torque: 8 }, 4);

    const heavy = new World();
    const rh = rig(heavy, 400); // vastly heavier chassis
    mountEngine(heavy, rh, { power: 13, torque: 8 }, 4);

    expect(rigPerformance(heavy, rh).topSpeed).toBe(rigPerformance(light, rl).topSpeed);
    expect(rigPerformance(heavy, rh).acceleration).toBe(rigPerformance(light, rl).acceleration);
  });

  it('more engines means more performance — never a detriment, even though each adds weight', () => {
    const w = new World();
    const r = rig(w, 10);
    let prevTop = 0;
    let prevAcc = 0;
    for (let n = 1; n <= 6; n++) {
      mountEngine(w, r, { power: 13, torque: 8 }, 4); // each adds full weight, but weight is parked
      const perf = rigPerformance(w, r);
      expect(perf.topSpeed).toBeGreaterThan(prevTop);
      expect(perf.acceleration).toBeGreaterThan(prevAcc);
      prevTop = perf.topSpeed;
      prevAcc = perf.acceleration;
    }
  });

  it('the two energy-type profiles give distinct character at equal engine counts', () => {
    const elec = new World();
    const re = rig(elec, 10);
    mountEngine(elec, re, { power: 13, torque: 8 }); // electric profile

    const steamW = new World();
    const rs = rig(steamW, 10);
    mountEngine(steamW, rs, { power: 8, torque: 19 }); // steam profile

    // Electric out-tops steam; steam out-accelerates electric.
    expect(rigPerformance(elec, re).topSpeed).toBeGreaterThan(rigPerformance(steamW, rs).topSpeed);
    expect(rigPerformance(steamW, rs).acceleration).toBeGreaterThan(
      rigPerformance(elec, re).acceleration,
    );
  });
});
