import type { PartSlot } from './parts-catalog';

/**
 * An assembly RECIPE — the data the workshop bench renders from. A recipe lists the slots its
 * output needs (each a role + a human label) and the name of what it produces. The bench is driven
 * entirely by the active recipe, never a hardcoded slot list, so adding a new buildable later (a
 * different output with a different set of required parts) is a data change here, not a UI rewrite.
 *
 * MW ships exactly one recipe — the engine (four parts). The four slots line up with the engine
 * part roles in the catalog (`EnginePartSlot`); future recipes can require any roles/counts.
 */
export interface RecipeSlot {
  /** The part role this slot accepts — matched against a part's catalog `slot`. */
  slot: PartSlot;
  /** Label shown above the slot on the bench. */
  label: string;
}

export interface Recipe {
  /** Stable id for the recipe. */
  id: string;
  /** Display name of what the recipe builds (shown in the bench header). */
  output: string;
  /** The slots that must be filled (in display order) to complete the build. */
  slots: readonly RecipeSlot[];
}

/** The engine recipe — four same-type parts in the four-slot grammar (see the spec). */
export const ENGINE_RECIPE: Recipe = {
  id: 'engine',
  output: 'Engine',
  slots: [
    { slot: 'casing', label: 'Casing' },
    { slot: 'core', label: 'Converter Core' },
    { slot: 'coupling', label: 'Energy Coupling' },
    { slot: 'regulator', label: 'Regulator' },
  ],
};

/** The storage-container recipe — two parts (a second buildable that proves the bench is generic). */
export const STORAGE_RECIPE: Recipe = {
  id: 'storage',
  output: 'Storage Container',
  slots: [
    { slot: 'shell', label: 'Container Shell' },
    { slot: 'rim', label: 'Container Rim' },
  ],
};

/** Every buildable recipe, in the order the bench's recipe picker shows them. */
export const RECIPES: readonly Recipe[] = [ENGINE_RECIPE, STORAGE_RECIPE];

/** Resolve a recipe id to its definition, or `undefined` if it isn't a known recipe. */
export function recipeById(id: string): Recipe | undefined {
  return RECIPES.find((r) => r.id === id);
}
