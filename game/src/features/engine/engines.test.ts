import { describe, it, expect } from 'vitest';
import { engineParts, engineRecipeForType } from './engines';
import { ELECTRIC_ENGINE_RECIPE, STEAM_ENGINE_RECIPE } from '@common/parts/recipes';

describe('engineParts — the catalog parts that compose an engine', () => {
  it('returns the four electric parts in the electric recipe\'s slot order', () => {
    const parts = engineParts('electric');
    expect(parts.map((p) => p.id)).toEqual(['e-casing', 'e-core', 'e-coupling', 'e-regulator']);
    expect(parts.map((p) => p.slot)).toEqual(ELECTRIC_ENGINE_RECIPE.slots.map((s) => s.slot));
    expect(parts.every((p) => p.type === 'electric')).toBe(true);
  });

  it('returns the four steam parts in the steam recipe\'s slot order', () => {
    const parts = engineParts('steam');
    expect(parts.map((p) => p.id)).toEqual(['s-boiler', 's-piston', 's-driveshaft', 's-throttle']);
    expect(parts.map((p) => p.slot)).toEqual(STEAM_ENGINE_RECIPE.slots.map((s) => s.slot));
    expect(parts.every((p) => p.type === 'steam')).toBe(true);
  });

  it('picks the recipe by type and returns one part per slot, all of the requested type', () => {
    for (const type of ['electric', 'steam'] as const) {
      const recipe = engineRecipeForType(type);
      expect(engineParts(type)).toHaveLength(recipe.slots.length);
    }
  });
});
