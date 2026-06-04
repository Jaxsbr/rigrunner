import { describe, it, expect } from 'vitest';
import { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Part } from '@common/components/part';
import { Mount } from '@common/components/mount';
import { EngineSpec } from '@common/components/engine-spec';
import type { EngineSpec as EngineSpecData } from '@common/components/engine-spec';
import { aggregateEngineOutput } from './engine';

const ELECTRIC: EngineSpecData = { power: 13, torque: 8 };   // high power, low torque
const MECHANICAL: EngineSpecData = { power: 8, torque: 19 };  // low power, high torque

function mount(world: World, rig: EntityId, spec: EngineSpecData): EntityId {
  const p = world.createEntity();
  world.add(p, Part, { kind: 'engine' });
  world.add(p, Mount, { rig, col: 0, row: 0, yaw: 0 });
  world.add(p, EngineSpec, spec);
  return p;
}

describe('aggregateEngineOutput', () => {
  it('is zero for a rig with no engine', () => {
    const w = new World();
    const rig = w.createEntity();
    expect(aggregateEngineOutput(w, rig)).toEqual({ power: 0, torque: 0 });
  });

  it('passes a single engine through unchanged', () => {
    const w = new World();
    const rig = w.createEntity();
    mount(w, rig, ELECTRIC);
    expect(aggregateEngineOutput(w, rig)).toEqual({ power: 13, torque: 8 });
  });

  it('sums engines linearly — two engines are exactly twice one (no diminishing returns)', () => {
    const w = new World();
    const rig = w.createEntity();
    mount(w, rig, ELECTRIC);
    mount(w, rig, ELECTRIC);
    expect(aggregateEngineOutput(w, rig)).toEqual({ power: 26, torque: 16 });
  });

  it('keeps scaling with every added engine — six give the most, never a detriment', () => {
    const w = new World();
    const rig = w.createEntity();
    let prev = 0;
    for (let n = 1; n <= 6; n++) {
      mount(w, rig, ELECTRIC);
      const out = aggregateEngineOutput(w, rig);
      expect(out.power).toBeGreaterThan(prev); // strictly more each time
      prev = out.power;
    }
    expect(aggregateEngineOutput(w, rig).power).toBe(78); // 6 × 13
  });

  it('sums each attribute independently', () => {
    const w = new World();
    const rig = w.createEntity();
    mount(w, rig, ELECTRIC);    // 13 / 8
    mount(w, rig, MECHANICAL);  // 8 / 19
    expect(aggregateEngineOutput(w, rig)).toEqual({ power: 21, torque: 27 });
  });

  it('only counts engines mounted on the asked-for rig', () => {
    const w = new World();
    const rigA = w.createEntity();
    const rigB = w.createEntity();
    mount(w, rigA, ELECTRIC);
    mount(w, rigB, MECHANICAL);
    expect(aggregateEngineOutput(w, rigA)).toEqual({ power: 13, torque: 8 });
  });
});
