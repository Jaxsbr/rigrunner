import { describe, it, expect } from 'vitest';
import { engineParts } from './engines';
import { ENGINE_RECIPE } from './recipes';

describe('engineParts — the catalog parts that compose an engine', () => {
  it('returns the four electric parts in the engine recipe\'s slot order', () => {
    const parts = engineParts('electric');
    expect(parts.map((p) => p.id)).toEqual(['e-casing', 'e-core', 'e-coupling', 'e-regulator']);
    expect(parts.map((p) => p.slot)).toEqual(ENGINE_RECIPE.slots.map((s) => s.slot));
    expect(parts.every((p) => p.type === 'electric')).toBe(true);
  });

  it('returns the four mechanical parts in slot order', () => {
    const parts = engineParts('mechanical');
    expect(parts.map((p) => p.id)).toEqual(['m-casing', 'm-core', 'm-coupling', 'm-regulator']);
    expect(parts.every((p) => p.type === 'mechanical')).toBe(true);
  });

  it('returns one part per recipe slot, all of the requested type', () => {
    for (const type of ['electric', 'mechanical'] as const) {
      expect(engineParts(type)).toHaveLength(ENGINE_RECIPE.slots.length);
    }
  });
});
