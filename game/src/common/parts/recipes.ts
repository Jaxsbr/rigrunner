import type { PartSlot } from './parts-catalog';
import type { PartKind } from '@common/components/part';
import type { ChassisSize } from '@common/components/chassis';

/**
 * An assembly RECIPE — the data the workshop bench renders from. A recipe lists the slots its
 * output needs (each a role + a human label), the name of what it produces, and the KIND of part
 * that product is. The bench is driven entirely by the active recipe, never a hardcoded slot list,
 * so adding a new buildable later (a different output with a different set of required parts) is a
 * data change here, not a UI rewrite — and assembly (P4) is recipe-generic for the same reason: it
 * sums whatever parts the recipe asked for and stamps out a product of `productKind`.
 *
 * The slots line up with the part roles in the catalog (`PartSlot`); recipes can require any
 * roles/counts and produce any part kind. The two engine types build through SEPARATE recipes with
 * disjoint slot vocabularies (electric vs steam) — the divergence that makes the no-hybrid rule a
 * fact of the parts (`docs/part-identity-spec.md` §2a), since no part fits the other type's slots.
 */
export interface RecipeSlot {
  /** The part role this slot accepts — matched against a part's catalog `slot`. */
  slot: PartSlot;
  /** Label shown above the slot on the bench. */
  label: string;
}

/**
 * Size-fixed structure a chassis recipe carries — the part of a chassis NOT summed from its
 * sub-parts but determined by which size you're building. Assembly stamps it onto the product's
 * `Chassis` + `MountGrid` (see `systems/assembly.ts`). Present only on chassis recipes.
 */
export interface ChassisRecipeMeta {
  size: ChassisSize;
  cols: number;       // deck cells across (local X)
  rows: number;       // deck cells along the length (local Z)
  deckY: number;      // deck surface height — matches the GLB's deck top
  engineMin: number;  // fewest engines this deck is meant to run (HUD warns below it)
  engineMax: number;  // most engines this deck accepts (mounting refuses beyond it)
}

export interface Recipe {
  /** Stable id for the recipe. */
  id: string;
  /** Display name of what the recipe builds (shown in the bench header). */
  output: string;
  /** The kind of `Part` this recipe assembles — gives the product its downstream capability
   *  (engine ⇒ EngineSpec, storage ⇒ Storage, chassis ⇒ Chassis + MountGrid). See `systems/assembly.ts`. */
  productKind: PartKind;
  /** The slots that must be filled (in display order) to complete the build. */
  slots: readonly RecipeSlot[];
  /** Size-fixed structure — chassis recipes only. */
  chassis?: ChassisRecipeMeta;
}

/** The ⚡ electric engine recipe — its four clean/abstract slots. */
export const ELECTRIC_ENGINE_RECIPE: Recipe = {
  id: 'electric-engine',
  output: 'Electric Engine',
  productKind: 'engine',
  slots: [
    { slot: 'casing', label: 'Casing' },
    { slot: 'core', label: 'Core' },
    { slot: 'coupling', label: 'Coupling' },
    { slot: 'regulator', label: 'Regulator' },
  ],
};

/** The ♨ steam engine recipe — its four industrial slots, disjoint from electric's. */
export const STEAM_ENGINE_RECIPE: Recipe = {
  id: 'steam-engine',
  output: 'Steam Engine',
  productKind: 'engine',
  slots: [
    { slot: 'boiler', label: 'Boiler' },
    { slot: 'piston', label: 'Piston' },
    { slot: 'driveshaft', label: 'Driveshaft' },
    { slot: 'throttle', label: 'Throttle' },
  ],
};

/** The storage-container recipe — two parts (a second buildable that proves the bench is generic). */
export const STORAGE_RECIPE: Recipe = {
  id: 'storage',
  output: 'Storage Container',
  productKind: 'storage',
  slots: [
    { slot: 'shell', label: 'Shell' },
    { slot: 'rim', label: 'Rim' },
  ],
};

/**
 * The Reclaimer recipe (Option C / PR3) — the first NON-engine socket grammar: a base `arm` slot
 * plus the `head` socket the bucket slots into (alongside the engine's four-slot grammar). Untyped
 * (no electric/steam), so it never engages the no-hybrid rule; assembly sums its parts' weight
 * and stamps out a `reclaimer`-kind product exactly as the engine and container recipes do.
 */
export const RECLAIMER_RECIPE: Recipe = {
  id: 'reclaimer',
  output: 'Reclaimer',
  productKind: 'reclaimer',
  slots: [
    { slot: 'arm', label: 'Arm' },
    { slot: 'head', label: 'Bucket' },
  ],
};

/**
 * The two chassis recipes — same three-slot grammar, differing only in the size-fixed structure they
 * stamp (deck dimensions + engine envelope). The 1×3 is the light scout (1–2 engines); the 3×5 the
 * hauler (3–6). `chassisParts(size)` (in `@features/chassis`) supplies the size-matched sub-parts.
 *
 * The deck surface sits at the same height (0.84) for both, matching each size's GLB deck top — which
 * rides clear above the wheels (so the deck never z-fights the tucked-under wheels) — so the
 * build-interaction's carry-clearance math is unchanged across sizes.
 */
const CHASSIS_SLOTS: readonly RecipeSlot[] = [
  { slot: 'wheel-axle', label: 'Wheel & Axle Set' },
  { slot: 'suspension-steering', label: 'Suspension & Steering Set' },
  { slot: 'frame', label: 'Chassis Frame' },
];

export const CHASSIS_1X3_RECIPE: Recipe = {
  id: 'chassis-1x3',
  output: 'Chassis (1×3)',
  productKind: 'chassis',
  slots: CHASSIS_SLOTS,
  chassis: { size: '1x3', cols: 1, rows: 3, deckY: 0.84, engineMin: 1, engineMax: 2 },
};

export const CHASSIS_3X5_RECIPE: Recipe = {
  id: 'chassis-3x5',
  output: 'Chassis (3×5)',
  productKind: 'chassis',
  slots: CHASSIS_SLOTS,
  chassis: { size: '3x5', cols: 3, rows: 5, deckY: 0.84, engineMin: 3, engineMax: 6 },
};

/** The chassis recipe for a size — the seam `spawnRig` composes its foundation through. */
export function chassisRecipeForSize(size: ChassisSize): Recipe {
  return size === '1x3' ? CHASSIS_1X3_RECIPE : CHASSIS_3X5_RECIPE;
}

/**
 * Every buildable recipe the workshop bench's recipe picker shows, in order. The two engine recipes
 * (electric, steam) lead; the two chassis recipes sit alongside the container/Reclaimer ones: a
 * chassis is built on the bench like the others, then hauled out of the workshop as a kit to
 * assemble into a rig. The size-match guard (`acceptsChassisPart` in `@features/workshop/assembly`)
 * keeps a chassis build to one size, the way disjoint vocabularies keep an engine to one type.
 */
export const RECIPES: readonly Recipe[] = [
  ELECTRIC_ENGINE_RECIPE,
  STEAM_ENGINE_RECIPE,
  STORAGE_RECIPE,
  RECLAIMER_RECIPE,
  CHASSIS_1X3_RECIPE,
  CHASSIS_3X5_RECIPE,
];

/** Resolve a recipe id to its definition, or `undefined` if it isn't a known recipe. */
export function recipeById(id: string): Recipe | undefined {
  return RECIPES.find((r) => r.id === id);
}
