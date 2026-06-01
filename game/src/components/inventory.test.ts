import { describe, it, expect } from 'vitest';
import { World } from '../core/world';
import { Wallet } from './wallet';
import {
  Inventory,
  getInventory,
  addToInventory,
  removeFromInventory,
  inventoryItems,
} from './inventory';

/** A player store singleton — Inventory (and Wallet, as in main.ts) on one entity. */
function makeStore(world: World) {
  const e = world.createEntity();
  world.add(e, Wallet, { scrap: 0 });
  world.add(e, Inventory, { items: [] });
  return e;
}

describe('inventory', () => {
  it('reaches the singleton via getInventory', () => {
    const w = new World();
    makeStore(w);
    expect(getInventory(w)).not.toBeNull();
    expect(inventoryItems(w)).toEqual([]);
  });

  it('returns null / empty before any inventory exists', () => {
    const w = new World();
    expect(getInventory(w)).toBeNull();
    expect(inventoryItems(w)).toEqual([]);
  });

  it('adds items in insertion order', () => {
    const w = new World();
    makeStore(w);
    const a = w.createEntity();
    const b = w.createEntity();
    addToInventory(w, a);
    addToInventory(w, b);
    expect(inventoryItems(w)).toEqual([a, b]);
  });

  it('never duplicates an item (idempotent add)', () => {
    const w = new World();
    makeStore(w);
    const a = w.createEntity();
    addToInventory(w, a);
    addToInventory(w, a);
    expect(inventoryItems(w)).toEqual([a]);
  });

  it('removes without destroying the entity (conserved move-out)', () => {
    const w = new World();
    makeStore(w);
    const a = w.createEntity();
    const b = w.createEntity();
    addToInventory(w, a);
    addToInventory(w, b);
    removeFromInventory(w, a);
    expect(inventoryItems(w)).toEqual([b]);
    // The entity still lives — it merely left the owned-unplaced list (it moved onto a bench/rig).
    expect(w.isAlive(a)).toBe(true);
  });

  it('is a no-op to remove an item not held', () => {
    const w = new World();
    makeStore(w);
    const a = w.createEntity();
    const ghost = w.createEntity();
    addToInventory(w, a);
    removeFromInventory(w, ghost);
    expect(inventoryItems(w)).toEqual([a]);
  });

  it('returns a snapshot copy that does not mutate the live list', () => {
    const w = new World();
    makeStore(w);
    const a = w.createEntity();
    addToInventory(w, a);
    const snap = inventoryItems(w);
    snap.push(w.createEntity());
    expect(inventoryItems(w)).toEqual([a]); // live list untouched
  });
});
