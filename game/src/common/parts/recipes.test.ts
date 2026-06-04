import { describe, it, expect } from 'vitest';
import { ENGINE_RECIPE, STORAGE_RECIPE, RECLAIMER_RECIPE, RECIPES, recipeById } from './recipes';
import { PARTS_CATALOG } from './parts-catalog';

describe('recipes', () => {
  it('exposes the engine (4 parts), storage (2 parts) and reclaimer (2 parts) recipes', () => {
    expect(ENGINE_RECIPE.slots).toHaveLength(4);
    expect(STORAGE_RECIPE.slots).toHaveLength(2);
    expect(RECLAIMER_RECIPE.slots).toHaveLength(2);
    expect(RECIPES.map((r) => r.id)).toEqual(['engine', 'storage', 'reclaimer']);
  });

  it('each recipe declares the part kind it produces (drives the assembled product capability)', () => {
    expect(ENGINE_RECIPE.productKind).toBe('engine');
    expect(STORAGE_RECIPE.productKind).toBe('storage');
    expect(RECLAIMER_RECIPE.productKind).toBe('reclaimer');
  });

  it('the reclaimer recipe is the arm + head socket grammar', () => {
    expect(RECLAIMER_RECIPE.slots.map((s) => s.slot)).toEqual(['arm', 'head']);
  });

  it('resolves a recipe by id, undefined for an unknown one', () => {
    expect(recipeById('storage')).toBe(STORAGE_RECIPE);
    expect(recipeById('reclaimer')).toBe(RECLAIMER_RECIPE);
    expect(recipeById('nope')).toBeUndefined();
  });

  // A recipe's slots must be real part roles — otherwise the bench would render a slot no catalog
  // part could ever fill. Guard that every recipe slot is satisfiable by at least one catalog part.
  it('every recipe slot is fillable by some catalog part of the matching role', () => {
    for (const recipe of RECIPES) {
      for (const { slot } of recipe.slots) {
        const filler = PARTS_CATALOG.find((p) => p.slot === slot);
        expect(filler, `no catalog part fills recipe slot "${slot}"`).toBeDefined();
      }
    }
  });
});
