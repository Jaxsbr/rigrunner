import { describe, it, expect } from 'vitest';
import { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Drivetrain } from '@features/drive/drivetrain';
import { Part } from '@common/components/part';
import { Mount } from '@common/components/mount';
import { Chassis } from '@common/components/chassis';
import { Storage } from '@common/components/storage';
import { EngineSpec } from '@common/components/engine-spec';
import type { EngineSpec as EngineSpecData } from '@common/components/engine-spec';
import { Weight } from '@common/components/weight';
import {
  totalRigWeight,
  cargoWeight,
  effectiveRigWeight,
  rigLoad,
  SCRAP_UNIT_WEIGHT,
} from '@common/sim/weight';
import { rigPerformance } from './drive';

function rig(world: World, weight: number): EntityId {
  const e = world.createEntity();
  world.add(e, Drivetrain, { friction: 8, turnRadius: 4, reverseFactor: 0.5 });
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

/** A container mounted on `r`, holding `amount` scrap. Dry weight is separate (a `Weight` component). */
function mountStorage(world: World, r: EntityId, amount: number, dryWeight = 0): EntityId {
  const p = world.createEntity();
  world.add(p, Part, { kind: 'storage' });
  world.add(p, Mount, { rig: r, col: 0, row: 0, yaw: 0 });
  world.add(p, Storage, { amount, capacity: 4 });
  if (dryWeight > 0) world.add(p, Weight, { value: dryWeight });
  return p;
}

describe('totalRigWeight', () => {
  it('sums the chassis weight and every mounted part (dry — no cargo)', () => {
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

describe('cargoWeight', () => {
  it('converts the scrap held in mounted containers to mass, ignoring the dry shell weight', () => {
    const w = new World();
    const r = rig(w, 10);
    expect(cargoWeight(w, r)).toBe(0);
    mountStorage(w, r, 3, /* dryWeight */ 4); // 3 scrap inside, 4 dry shell
    expect(cargoWeight(w, r)).toBe(3 * SCRAP_UNIT_WEIGHT); // only the contents count here
  });

  it('sums across containers and only counts the asked-for rig', () => {
    const w = new World();
    const a = rig(w, 10);
    const b = rig(w, 10);
    mountStorage(w, a, 2);
    mountStorage(w, a, 4);
    mountStorage(w, b, 4);
    expect(cargoWeight(w, a)).toBe(6 * SCRAP_UNIT_WEIGHT);
  });
});

describe('effectiveRigWeight', () => {
  it('is dry structural weight plus live cargo', () => {
    const w = new World();
    const r = rig(w, 10);
    mountEngine(w, r, { power: 13, torque: 8 }, 4);
    mountStorage(w, r, 3, /* dryWeight */ 4);
    // dry = 10 + 4 (engine) + 4 (shell) = 18; cargo = 3 * SCRAP_UNIT_WEIGHT
    expect(effectiveRigWeight(w, r)).toBe(18 + 3 * SCRAP_UNIT_WEIGHT);
  });
});

describe('rigLoad', () => {
  it('reports load (parts + cargo, excluding the chassis frame) against rated capacity', () => {
    const w = new World();
    const r = rig(w, 11); // chassis own weight
    w.add(r, Chassis, {
      size: '1x3',
      engineMin: 1,
      engineMax: 1,
      grip: 0,
      turning: 0,
      loadCapacity: 24,
    });
    mountEngine(w, r, { power: 13, torque: 8 }, 4);
    mountStorage(w, r, 4, /* dryWeight */ 4);
    const cargo = 4 * SCRAP_UNIT_WEIGHT;
    const load = 4 + 4 + cargo; // engine dry + shell dry + cargo — the chassis's own 11 is excluded
    expect(rigLoad(w, r)).toEqual({ load, capacity: 24, ratio: load / 24 });
  });

  it('reads zero ratio when the rig has no chassis (no rated capacity)', () => {
    const w = new World();
    const r = rig(w, 10);
    mountStorage(w, r, 4);
    expect(rigLoad(w, r).capacity).toBe(0);
    expect(rigLoad(w, r).ratio).toBe(0);
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

  it('scales engine output by the weight-mobility factor', () => {
    const w = new World();
    const r = rig(w, 10); // effective weight 10 (weightless engine, no cargo)
    mountEngine(w, r, { power: 13, torque: 8 });
    const perf = rigPerformance(w, r);
    // mobility = torque / (torque + 0.7·weight) = 8 / (8 + 7) = 8/15
    expect(perf.topSpeed).toBeCloseTo(13 * (8 / 15));
    expect(perf.acceleration).toBeCloseTo(8 * (8 / 15));
    expect(perf.reverse).toBeCloseTo(perf.topSpeed * 0.5);
  });

  it('weight drags performance — a heavier rig is slower than an identical lighter one', () => {
    const light = new World();
    const rl = rig(light, 10);
    mountEngine(light, rl, { power: 13, torque: 8 });

    const heavy = new World();
    const rh = rig(heavy, 100); // far heavier chassis, same engine
    mountEngine(heavy, rh, { power: 13, torque: 8 });

    expect(rigPerformance(heavy, rh).topSpeed).toBeLessThan(rigPerformance(light, rl).topSpeed);
    expect(rigPerformance(heavy, rh).acceleration).toBeLessThan(
      rigPerformance(light, rl).acceleration,
    );
  });

  it('cargo makes the SAME rig slower — collecting scrap has a felt cost', () => {
    const w = new World();
    const r = rig(w, 10);
    mountEngine(w, r, { power: 13, torque: 8 }, 4);
    const container = mountStorage(w, r, 0, /* dryWeight */ 4);
    const empty = rigPerformance(w, r);

    w.get(container, Storage)!.amount = 4; // fill it
    const full = rigPerformance(w, r);

    expect(full.topSpeed).toBeLessThan(empty.topSpeed);
    expect(full.acceleration).toBeLessThan(empty.acceleration);
  });

  it('more engines means more performance — never a detriment, even though each adds weight', () => {
    const w = new World();
    const r = rig(w, 10);
    let prevTop = 0;
    let prevAcc = 0;
    for (let n = 1; n <= 6; n++) {
      // Each engine adds its full weight too — but its torque lifts mobility enough that the linear
      // sum still nets out positive (the old diminishing-returns sum that broke this is gone).
      mountEngine(w, r, { power: 13, torque: 8 }, 4);
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
