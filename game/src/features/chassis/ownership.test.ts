import { describe, it, expect } from 'vitest';
import { World } from '@core/world';
import {
  ActiveRig,
  MAX_OWNED,
  ownedChassis,
  ownedCount,
  markOwned,
  getActiveRig,
  setActiveRig,
} from './ownership';

/** A stand-in chassis entity — ownership only cares about identity, not the Chassis component. */
function chassis(w: World) {
  return w.createEntity();
}

describe('chassis ownership', () => {
  it('tracks owned chassis in stable (oldest-first) order', () => {
    const w = new World();
    const a = chassis(w);
    const b = chassis(w);
    expect(ownedCount(w)).toBe(0);
    markOwned(w, a);
    markOwned(w, b);
    expect(ownedChassis(w)).toEqual([a, b]);
    expect(ownedCount(w)).toBe(2);
  });

  it('markOwned is idempotent', () => {
    const w = new World();
    const a = chassis(w);
    markOwned(w, a);
    markOwned(w, a);
    expect(ownedChassis(w)).toEqual([a]);
  });

  it('caps at MAX_OWNED = 2 (one hotkey each for 1 and 2)', () => {
    expect(MAX_OWNED).toBe(2);
  });
});

describe('active rig', () => {
  it('has no active rig until one is set', () => {
    const w = new World();
    expect(getActiveRig(w)).toBeNull();
  });

  it('only an owned chassis can be made active', () => {
    const w = new World();
    const a = chassis(w);
    expect(setActiveRig(w, a)).toBe(false); // not owned → refused
    expect(getActiveRig(w)).toBeNull();
    markOwned(w, a);
    expect(setActiveRig(w, a)).toBe(true);
    expect(getActiveRig(w)).toBe(a);
  });

  it('moves the single active marker between owned chassis', () => {
    const w = new World();
    const a = chassis(w);
    const b = chassis(w);
    markOwned(w, a);
    markOwned(w, b);
    setActiveRig(w, a);
    expect(setActiveRig(w, b)).toBe(true);
    expect(getActiveRig(w)).toBe(b);
    expect(w.has(a, ActiveRig)).toBe(false); // exactly one active at a time
    expect(w.query(ActiveRig)).toEqual([b]);
  });

  it('re-selecting the active rig is a no-op', () => {
    const w = new World();
    const a = chassis(w);
    markOwned(w, a);
    setActiveRig(w, a);
    expect(setActiveRig(w, a)).toBe(false);
    expect(getActiveRig(w)).toBe(a);
  });
});
