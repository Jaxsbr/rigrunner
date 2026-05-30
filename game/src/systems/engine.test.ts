import { describe, it, expect } from 'vitest';
import { World } from '../core/world';
import type { EntityId } from '../core/types';
import { Part } from '../components/part';
import { Mount } from '../components/mount';
import { EngineSpec } from '../components/engine-spec';
import type { EngineSpec as EngineSpecData } from '../components/engine-spec';
import { aggregateEngineOutput } from './engine';

const MK1: EngineSpecData = { power: 8, torque: 11 };
const MK2: EngineSpecData = { power: 13, torque: 19 };

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
    mount(w, rig, MK2);
    expect(aggregateEngineOutput(w, rig)).toEqual({ power: 13, torque: 19 });
  });

  it('adds a second engine with diminishing returns, not a full sum', () => {
    const w = new World();
    const rig = w.createEntity();
    mount(w, rig, MK2);
    mount(w, rig, MK2);
    const out = aggregateEngineOutput(w, rig);
    // Strongest at full weight + the next at the 0.4 falloff: 13 + 13*0.4 = 18.2.
    expect(out.power).toBeCloseTo(18.2);
    expect(out.torque).toBeCloseTo(26.6); // 19 + 19*0.4
    // Better than one, but far short of doubling.
    expect(out.power).toBeGreaterThan(13);
    expect(out.power).toBeLessThan(26);
  });

  it('lets the strongest engine count fully regardless of mount order', () => {
    const a = new World();
    const ra = a.createEntity();
    mount(a, ra, MK1);
    mount(a, ra, MK2);

    const b = new World();
    const rb = b.createEntity();
    mount(b, rb, MK2);
    mount(b, rb, MK1);

    // Order-independent: MK2 (stronger) takes full weight either way → 13 + 8*0.4 = 16.2.
    expect(aggregateEngineOutput(a, ra).power).toBeCloseTo(16.2);
    expect(aggregateEngineOutput(b, rb)).toEqual(aggregateEngineOutput(a, ra));
  });

  it('Mk1+Mk2 beats Mk2 alone, but not dramatically', () => {
    const both = new World();
    const r1 = both.createEntity();
    mount(both, r1, MK1);
    mount(both, r1, MK2);

    const solo = new World();
    const r2 = solo.createEntity();
    mount(solo, r2, MK2);

    const combined = aggregateEngineOutput(both, r1);
    const single = aggregateEngineOutput(solo, r2);
    expect(combined.power).toBeGreaterThan(single.power);
    expect(combined.power).toBeLessThan(single.power * 1.5); // modest gain, not a doubling
  });

  it('only counts engines mounted on the asked-for rig', () => {
    const w = new World();
    const rigA = w.createEntity();
    const rigB = w.createEntity();
    mount(w, rigA, MK2);
    mount(w, rigB, MK1);
    expect(aggregateEngineOutput(w, rigA)).toEqual({ power: 13, torque: 19 });
  });
});
