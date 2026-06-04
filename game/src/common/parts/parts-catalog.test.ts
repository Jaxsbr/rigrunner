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
  it('has unique ids across all parts', () => {
    const ids = PARTS_CATALOG.map((p) => p.id);
    expect(new Set(ids).size).toBe(PARTS_CATALOG.length);
  });

  it('has the 8 engine parts (4 per type) plus the 2 storage-container parts', () => {
    const engine = PARTS_CATALOG.filter((p) => p.category === 'engine');
    const storage = PARTS_CATALOG.filter((p) => p.category === 'storage');
    expect(engine).toHaveLength(8);
    expect(storage).toHaveLength(2);
    // Engine parts carry an energy type; storage parts don't.
    expect(engine.every((p) => p.type !== undefined)).toBe(true);
    expect(storage.every((p) => p.type === undefined)).toBe(true);
    expect(storage.map((p) => p.slot).sort()).toEqual(['rim', 'shell']);
  });

  it('covers every engine slot once per type — one casing/core/coupling/regulator each', () => {
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

  // The Reclaimer (Option C) — two untyped parts in the arm + head socket grammar, contributing only
  // weight (no engine work). Guard the role coverage and the total weight a built Reclaimer hauls.
  it('has the 2 reclaimer parts (arm + head), untyped, weighing 8 together', () => {
    const reclaimer = PARTS_CATALOG.filter((p) => p.category === 'reclaimer');
    expect(reclaimer).toHaveLength(2);
    expect(reclaimer.every((p) => p.type === undefined)).toBe(true);
    expect(reclaimer.map((p) => p.slot).sort()).toEqual(['arm', 'head']);
    const weight = reclaimer.reduce((n, p) => n + p.attributes.weight, 0);
    expect(weight).toBe(8);
    // It does no engine work — power/torque are zero.
    expect(reclaimer.every((p) => p.attributes.power === 0 && p.attributes.torque === 0)).toBe(true);
  });

  it('the reclaimer arm renders the articulated arm GLB and the bucket renders its head GLB', () => {
    expect(partDef('reclaimer-arm')?.assetId).toBe('reclaimer-arm');
    expect(partDef('reclaimer-bucket')?.assetId).toBe('reclaimer-bucket');
  });

  it('resolves a known id and returns undefined for an unknown one', () => {
    expect(partDef('e-core')?.displayName).toBe('Motor Coil');
    expect(partDef('nope')).toBeUndefined();
  });
});
