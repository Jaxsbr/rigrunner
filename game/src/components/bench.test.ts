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
  loadRecipe,
} from './bench';

const ENGINE_SLOTS = ['casing', 'core', 'coupling', 'regulator'];
const STORAGE_SLOTS = ['shell', 'rim'];

/** A bench singleton on its own entity, loaded with the engine recipe, as main.ts wires it. */
function makeBench(world: World) {
  const e = world.createEntity();
  world.add(e, Bench, { recipeId: 'engine', slots: emptyBenchSlots(ENGINE_SLOTS) });
  return e;
}

describe('bench', () => {
  it('reaches the singleton via getBench, starting all-empty for its recipe', () => {
    const w = new World();
    makeBench(w);
    expect(getBench(w)?.recipeId).toBe('engine');
    expect(benchSlots(w)).toEqual({ casing: null, core: null, coupling: null, regulator: null });
  });

  it('returns null / empty slots before any bench exists', () => {
    const w = new World();
    expect(getBench(w)).toBeNull();
    expect(benchSlots(w)).toEqual({});
  });

  it('places a part in an empty slot', () => {
    const w = new World();
    makeBench(w);
    const part = w.createEntity();
    expect(placeOnBench(w, 'core', part)).toBe(true);
    expect(benchSlots(w).core).toBe(part);
    expect(benchSlotOf(w, part)).toBe('core');
  });

  it('refuses a slot that is not part of the active recipe', () => {
    const w = new World();
    makeBench(w); // engine recipe — no 'shell' slot
    const part = w.createEntity();
    expect(placeOnBench(w, 'shell', part)).toBe(false);
    expect(benchSlotOf(w, part)).toBeNull();
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

  it('loadRecipe reshapes the bench to a new recipe with fresh empty slots', () => {
    const w = new World();
    makeBench(w);
    placeOnBench(w, 'core', w.createEntity());
    loadRecipe(w, 'storage', STORAGE_SLOTS);
    expect(getBench(w)?.recipeId).toBe('storage');
    expect(benchSlots(w)).toEqual({ shell: null, rim: null }); // old engine slots are gone
    // The storage slots accept storage parts now.
    const shell = w.createEntity();
    expect(placeOnBench(w, 'shell', shell)).toBe(true);
    expect(benchSlotOf(w, shell)).toBe('shell');
  });
});
