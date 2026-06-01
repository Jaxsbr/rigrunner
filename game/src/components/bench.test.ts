import { describe, it, expect } from 'vitest';
import { World } from '../core/world';
import {
  Bench,
  emptyBenchSlots,
  getBench,
  benchSlots,
  placeOnBench,
  clearBenchSlot,
  benchSlotOf,
} from './bench';

/** A bench singleton on its own entity, as main.ts wires it. */
function makeBench(world: World) {
  const e = world.createEntity();
  world.add(e, Bench, { slots: emptyBenchSlots() });
  return e;
}

describe('bench', () => {
  it('reaches the singleton via getBench, starting all-empty', () => {
    const w = new World();
    makeBench(w);
    expect(getBench(w)).not.toBeNull();
    expect(benchSlots(w)).toEqual({ casing: null, core: null, coupling: null, regulator: null });
  });

  it('returns null / empty slots before any bench exists', () => {
    const w = new World();
    expect(getBench(w)).toBeNull();
    expect(benchSlots(w)).toEqual({ casing: null, core: null, coupling: null, regulator: null });
  });

  it('places a part in an empty slot', () => {
    const w = new World();
    makeBench(w);
    const part = w.createEntity();
    expect(placeOnBench(w, 'core', part)).toBe(true);
    expect(benchSlots(w).core).toBe(part);
    expect(benchSlotOf(w, part)).toBe('core');
  });

  it('refuses to overwrite an occupied slot (no silent drop)', () => {
    const w = new World();
    makeBench(w);
    const a = w.createEntity();
    const b = w.createEntity();
    expect(placeOnBench(w, 'casing', a)).toBe(true);
    expect(placeOnBench(w, 'casing', b)).toBe(false);
    expect(benchSlots(w).casing).toBe(a); // the incumbent stays
  });

  it('clears a slot and hands the part back (conserved, not destroyed)', () => {
    const w = new World();
    makeBench(w);
    const part = w.createEntity();
    placeOnBench(w, 'regulator', part);
    expect(clearBenchSlot(w, 'regulator')).toBe(part);
    expect(benchSlots(w).regulator).toBeNull();
    expect(benchSlotOf(w, part)).toBeNull();
    expect(w.isAlive(part)).toBe(true); // the entity lives on (it moved back to inventory)
  });

  it('clearing an empty slot is a no-op returning null', () => {
    const w = new World();
    makeBench(w);
    expect(clearBenchSlot(w, 'coupling')).toBeNull();
  });

  it('benchSlots returns a snapshot copy that does not mutate the live slots', () => {
    const w = new World();
    makeBench(w);
    const part = w.createEntity();
    placeOnBench(w, 'core', part);
    const snap = benchSlots(w);
    snap.core = w.createEntity();
    expect(benchSlots(w).core).toBe(part); // live slots untouched
  });

  it('benchSlotOf returns null for a part that is not on the bench', () => {
    const w = new World();
    makeBench(w);
    const stray = w.createEntity();
    expect(benchSlotOf(w, stray)).toBeNull();
  });
});
