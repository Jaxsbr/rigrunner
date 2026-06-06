import { describe, it, expect } from 'vitest';
import {
  ELECTRIC_ENGINE_RECIPE,
  STEAM_ENGINE_RECIPE,
  STORAGE_RECIPE,
  RECLAIMER_RECIPE,
  WEAPON_RECIPE,
  CHASSIS_1X3_RECIPE,
  CHASSIS_3X5_RECIPE,
  RECIPES,
  recipeById,
} from './recipes';
import { PARTS_CATALOG } from './parts-catalog';

describe('recipes', () => {
  it('the bench picker lists every buildable: two engines, storage, reclaimer, weapon, and the two chassis kits', () => {
    expect(ELECTRIC_ENGINE_RECIPE.slots).toHaveLength(4);
    expect(STEAM_ENGINE_RECIPE.slots).toHaveLength(4);
    expect(STORAGE_RECIPE.slots).toHaveLength(2);
    expect(RECLAIMER_RECIPE.slots).toHaveLength(2);
    expect(WEAPON_RECIPE.slots).toHaveLength(1);
    expect(RECIPES.map((r) => r.id)).toEqual([
      'electric-engine', 'steam-engine', 'storage', 'reclaimer', 'weapon', 'chassis-1x3', 'chassis-3x5',
    ]);
  });

  it('the two engine recipes use disjoint slot vocabularies (the self-enforcing no-hybrid rule)', () => {
    const electric = ELECTRIC_ENGINE_RECIPE.slots.map((s) => s.slot);
    const steam = STEAM_ENGINE_RECIPE.slots.map((s) => s.slot);
    expect(electric).toEqual(['casing', 'core', 'coupling', 'regulator']);
    expect(steam).toEqual(['boiler', 'piston', 'driveshaft', 'throttle']);
    expect(electric.some((s) => steam.includes(s))).toBe(false);
  });

  it('each chassis recipe is the 3-slot grammar carrying its size-fixed structure', () => {
    expect(CHASSIS_1X3_RECIPE.slots.map((s) => s.slot)).toEqual(['wheel-axle', 'suspension-steering', 'frame']);
    expect(CHASSIS_1X3_RECIPE.chassis).toMatchObject({ size: '1x3', cols: 1, rows: 3 });
    expect(CHASSIS_3X5_RECIPE.chassis).toMatchObject({ size: '3x5', cols: 3, rows: 5 });
  });

  it('each recipe declares the part kind it produces (drives the assembled product capability)', () => {
    expect(ELECTRIC_ENGINE_RECIPE.productKind).toBe('engine');
    expect(STEAM_ENGINE_RECIPE.productKind).toBe('engine');
    expect(STORAGE_RECIPE.productKind).toBe('storage');
    expect(RECLAIMER_RECIPE.productKind).toBe('reclaimer');
    expect(WEAPON_RECIPE.productKind).toBe('weapon');
  });

  it('the reclaimer recipe is the arm + head socket grammar', () => {
    expect(RECLAIMER_RECIPE.slots.map((s) => s.slot)).toEqual(['arm', 'head']);
  });

  it('resolves a recipe by id, undefined for an unknown one', () => {
    expect(recipeById('electric-engine')).toBe(ELECTRIC_ENGINE_RECIPE);
    expect(recipeById('steam-engine')).toBe(STEAM_ENGINE_RECIPE);
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
