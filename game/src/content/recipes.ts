import type { PartSlot } from './parts-catalog';
import type { PartKind } from '../components/part';

/**
 * An assembly RECIPE — the data the workshop bench renders from. A recipe lists the slots its
 * output needs (each a role + a human label), the name of what it produces, and the KIND of part
 * that product is. The bench is driven entirely by the active recipe, never a hardcoded slot list,
 * so adding a new buildable later (a different output with a different set of required parts) is a
 * data change here, not a UI rewrite — and assembly (P4) is recipe-generic for the same reason: it
 * sums whatever parts the recipe asked for and stamps out a product of `productKind`.
 *
 * MW ships two recipes — the engine (four parts) and the storage container (two parts). The slots
 * line up with the part roles in the catalog (`PartSlot`); future recipes can require any
 * roles/counts and produce any part kind.
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
  /** The kind of `Part` this recipe assembles — gives the product its downstream capability
   *  (engine ⇒ EngineSpec, storage ⇒ Storage). See `systems/assembly.ts`. */
  productKind: PartKind;
  /** The slots that must be filled (in display order) to complete the build. */
  slots: readonly RecipeSlot[];
}

/** The engine recipe — four same-type parts in the four-slot grammar (see the spec). */
export const ENGINE_RECIPE: Recipe = {
  id: 'engine',
  output: 'Engine',
  productKind: 'engine',
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
  productKind: 'storage',
  slots: [
    { slot: 'shell', label: 'Container Shell' },
    { slot: 'rim', label: 'Container Rim' },
  ],
};

/**
 * The Reclaimer recipe (Option C / PR3) — the first NON-engine socket grammar: a base `arm` slot
 * plus the `head` socket the bucket slots into (alongside the engine's four-slot grammar). Untyped
 * (no electric/mechanical), so it never engages the no-hybrid rule; assembly sums its parts' weight
 * and stamps out a `reclaimer`-kind product exactly as the engine and container recipes do.
 */
export const RECLAIMER_RECIPE: Recipe = {
  id: 'reclaimer',
  output: 'Reclaimer',
  productKind: 'reclaimer',
  slots: [
    { slot: 'arm', label: 'Reclaimer Arm' },
    { slot: 'head', label: 'Bucket Head' },
  ],
};

/** Every buildable recipe, in the order the bench's recipe picker shows them. */
export const RECIPES: readonly Recipe[] = [ENGINE_RECIPE, STORAGE_RECIPE, RECLAIMER_RECIPE];

/** Resolve a recipe id to its definition, or `undefined` if it isn't a known recipe. */
export function recipeById(id: string): Recipe | undefined {
  return RECIPES.find((r) => r.id === id);
}
