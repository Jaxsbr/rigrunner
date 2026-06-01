import { describe, it, expect } from 'vitest';
import {
  PARTS_CATALOG,
  partDef,
  type EnginePartSlot,
  type EnergyType,
} from './parts-catalog';

const SLOTS: EnginePartSlot[] = ['casing', 'core', 'coupling', 'regulator'];
const TYPES: EnergyType[] = ['electric', 'mechanical'];

describe('parts catalog', () => {
  it('has exactly 8 parts with unique ids', () => {
    expect(PARTS_CATALOG).toHaveLength(8);
    const ids = PARTS_CATALOG.map((p) => p.id);
    expect(new Set(ids).size).toBe(8);
  });

  it('covers every slot once per type — one casing/core/coupling/regulator each', () => {
    for (const type of TYPES) {
      const slots = PARTS_CATALOG.filter((p) => p.type === type).map((p) => p.slot).sort();
      expect(slots).toEqual([...SLOTS].sort());
    }
  });

  it('splits 4 electric / 4 mechanical', () => {
    expect(PARTS_CATALOG.filter((p) => p.type === 'electric')).toHaveLength(4);
    expect(PARTS_CATALOG.filter((p) => p.type === 'mechanical')).toHaveLength(4);
  });

  // The attribute numbers are distributed to sum to the spec's suggested engine profiles. Guarding
  // the totals means tuning a single part can't silently drift the assembled engine off-profile.
  it('sums electric parts to the snappy/light profile (power 13 / torque 8 / weight 4)', () => {
    const sum = (key: 'power' | 'torque' | 'weight') =>
      PARTS_CATALOG.filter((p) => p.type === 'electric').reduce((n, p) => n + p.attributes[key], 0);
    expect(sum('power')).toBe(13);
    expect(sum('torque')).toBe(8);
    expect(sum('weight')).toBe(4);
  });

  it('sums mechanical parts to the torquey/heavy profile (power 8 / torque 19 / weight 8)', () => {
    const sum = (key: 'power' | 'torque' | 'weight') =>
      PARTS_CATALOG.filter((p) => p.type === 'mechanical').reduce((n, p) => n + p.attributes[key], 0);
    expect(sum('power')).toBe(8);
    expect(sum('torque')).toBe(19);
    expect(sum('weight')).toBe(8);
  });

  it('resolves a known id and returns undefined for an unknown one', () => {
    expect(partDef('e-core')?.displayName).toBe('Motor Coil');
    expect(partDef('nope')).toBeUndefined();
  });
});
