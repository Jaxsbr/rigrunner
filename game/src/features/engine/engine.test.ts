import { describe, it, expect } from 'vitest';
import { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Part } from '@common/components/part';
import { Mount } from '@common/components/mount';
import { EngineSpec } from '@common/components/engine-spec';
import type { EngineSpec as EngineSpecData } from '@common/components/engine-spec';
import { aggregateEngineOutput } from './engine';

const ELECTRIC: EngineSpecData = { power: 13, torque: 8 };   // high power, low torque
const STEAM: EngineSpecData = { power: 8, torque: 19 };  // low power, high torque

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

  it('compounds two engines with diminishing returns — the second adds 70%, not another full 100%', () => {
    const w = new World();
    const rig = w.createEntity();
    mount(w, rig, ELECTRIC);
    mount(w, rig, ELECTRIC);
    const out = aggregateEngineOutput(w, rig);
    expect(out.power).toBeCloseTo(13 + 13 * 0.7);  // 22.1
    expect(out.torque).toBeCloseTo(8 + 8 * 0.7);   // 13.6
  });

  it('keeps every added engine a net gain, but on a shrinking marginal — diminishing, never negative', () => {
    const w = new World();
    const rig = w.createEntity();
    let prev = 0;
    let prevDelta = Infinity;
    for (let n = 1; n <= 6; n++) {
      mount(w, rig, ELECTRIC);
      const power = aggregateEngineOutput(w, rig).power;
      const delta = power - prev;
      expect(power).toBeGreaterThan(prev);                 // always more total
      expect(delta).toBeLessThanOrEqual(prevDelta + 1e-9); // ...but each step adds no more than the last
      prev = power;
      prevDelta = delta;
    }
    // weights [1, .7, .5, .5, .5, .5] sum to 3.7
    expect(aggregateEngineOutput(w, rig).power).toBeCloseTo(13 * 3.7);
  });

  it('leads each attribute with its strongest source — a mixed-type rig diminishes per attribute', () => {
    const w = new World();
    const rig = w.createEntity();
    mount(w, rig, ELECTRIC);    // 13 / 8
    mount(w, rig, STEAM);  // 8 / 19
    const out = aggregateEngineOutput(w, rig);
    // power: electric (13) leads at full, steam (8) at 0.7 → 18.6
    // torque: steam (19) leads at full, electric (8) at 0.7 → 24.6
    expect(out.power).toBeCloseTo(13 + 8 * 0.7);
    expect(out.torque).toBeCloseTo(19 + 8 * 0.7);
  });

  it('only counts engines mounted on the asked-for rig', () => {
    const w = new World();
    const rigA = w.createEntity();
    const rigB = w.createEntity();
    mount(w, rigA, ELECTRIC);
    mount(w, rigB, STEAM);
    expect(aggregateEngineOutput(w, rigA)).toEqual({ power: 13, torque: 8 });
  });
});
