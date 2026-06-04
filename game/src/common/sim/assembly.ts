import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { EnginePart } from '@common/parts/engine-part';
import { Assembly } from '@common/components/assembly';
import { Part } from '@common/components/part';
import { Weight } from '@common/components/weight';
import { EngineSpec } from '@common/components/engine-spec';
import { Storage, CONTAINER_CAPACITY } from '@common/components/storage';
import {
  partDef,
  spawnCatalogPart,
  type PartDef,
  type EnergyType,
  type PartAttributes,
} from '@common/parts/parts-catalog';
import type { Recipe } from '@common/parts/recipes';

/**
 * Assembly — the pure, recipe-generic compute core of turning parts into a finished product. This is
 * deliberately the SHARED half (ADR-003 `common/sim`): nothing here is bench- or inventory-aware, so
 * a directly-seeded product (the rig's starting engine, an `engines.ts`/`containers.ts` seed) is
 * built through exactly the same path the workshop bench uses. The bench/inventory/world-presence
 * interaction half lives in `@features/workshop/assembly.ts` and calls down into this.
 *
 * Given the active recipe and a set of part entities it (a) sums the parts' attribute contributions,
 * (b) resolves their single energy type (the no-hybrid rule), and (c) stamps out a product entity of
 * the recipe's `productKind`, consuming the parts into it.
 *
 * The one place product KINDS differ is `attachCapability` — an engine carries `EngineSpec`, a
 * container carries `Storage`. That capability IS intrinsic to the kind (an engine must produce a
 * spec the drive system reads), so a small explicit switch is the honest model; everything else —
 * attribute summing, the no-hybrid type rule, part conservation — is shared.
 */

/** The summed attribute contribution of a set of parts — the raw numbers a product is built from. */
export type ProductStats = PartAttributes;

const ZERO_STATS: ProductStats = { power: 0, torque: 0, weight: 0, durability: 0, burst: 0 };

/** Resolve a part entity to its catalog definition, or null if it isn't a known catalog part. */
export function defOf(world: World, entity: EntityId): PartDef | null {
  const ep = world.get(entity, EnginePart);
  return ep ? (partDef(ep.id) ?? null) : null;
}

/** Sum the attribute contributions of a set of part entities (unresolved parts contribute nothing). */
export function sumPartStats(world: World, parts: readonly EntityId[]): ProductStats {
  const acc: ProductStats = { ...ZERO_STATS };
  for (const e of parts) {
    const def = defOf(world, e);
    if (!def) continue;
    acc.power += def.attributes.power;
    acc.torque += def.attributes.torque;
    acc.weight += def.attributes.weight;
    acc.durability += def.attributes.durability;
    acc.burst += def.attributes.burst;
  }
  return acc;
}

/**
 * The single energy type shared by a set of part defs, with a mismatch flag — the generic no-hybrid
 * rule. Untyped parts (storage) are ignored, so:
 *   - no typed parts            → { type: null, mismatch: false }  (an untyped product, e.g. storage)
 *   - all typed parts agree     → { type, mismatch: false }
 *   - two or more types present → { type: null, mismatch: true }   (a hybrid — never assembles)
 */
export function resolveEnergyType(defs: readonly PartDef[]): { type: EnergyType | null; mismatch: boolean } {
  const types = new Set<EnergyType>();
  for (const d of defs) if (d.type) types.add(d.type);
  if (types.size > 1) return { type: null, mismatch: true };
  return { type: types.size === 1 ? [...types][0]! : null, mismatch: false };
}

/** Attach the capability intrinsic to a product kind — the ONE place kinds differ. */
function attachCapability(world: World, product: EntityId, recipe: Recipe, stats: ProductStats): void {
  switch (recipe.productKind) {
    case 'engine':
      world.add(product, EngineSpec, { power: stats.power, torque: stats.torque });
      break;
    case 'storage':
      world.add(product, Storage, { amount: 0, capacity: CONTAINER_CAPACITY });
      break;
    case 'reclaimer':
      // The Reclaimer's capability is intrinsic to BEING MOUNTED — there's nothing to compute at
      // assembly. PR4's pile gate reads `Part.kind === 'reclaimer'` + a `Mount` on the rig directly,
      // so no capability component is attached here yet. (Weight is added by the shared path above.)
      break;
  }
}

/**
 * Build a product entity from a set of part entities, summing their stats and resolving their type.
 * The product is `Part {kind}` + `Weight` + (kind capability) + `Assembly` (its parts + resolved
 * type). It has NO world presence yet (no Transform/Renderable) and is added to no inventory — the
 * caller decides where it goes. The parts are taken to be already OWNED by this product (consumed
 * into `Assembly.parts`); they must not also live on the bench or in inventory.
 *
 * The shared core of two paths: `assemble` (parts off the bench, in `@features/workshop`) and
 * `composeProduct` (fresh parts spawned for seeding) — so a directly-seeded engine is built exactly
 * like a bench-assembled one.
 */
export function buildProduct(world: World, recipe: Recipe, parts: readonly EntityId[]): EntityId {
  const stats = sumPartStats(world, parts);
  const { type } = resolveEnergyType(parts.map((e) => defOf(world, e)).filter((d): d is PartDef => d !== null));

  const product = world.createEntity();
  world.add(product, Part, { kind: recipe.productKind });
  world.add(product, Weight, { value: stats.weight });
  attachCapability(world, product, recipe, stats);
  world.add(product, Assembly, { recipeId: recipe.id, parts: [...parts], ...(type ? { type } : {}) });
  return product;
}

/**
 * Compose a product directly from a set of catalog part defs, OUTSIDE the bench: spawn a fresh part
 * entity for each def, then build the product from them. For seeding pre-assembled products (the
 * rig's starting engine) — the result is identical to what the bench would produce. Not added to
 * inventory and not placed in the world; the caller mounts or stores it.
 */
export function composeProduct(world: World, recipe: Recipe, defs: readonly PartDef[]): EntityId {
  const parts = defs.map((d) => spawnCatalogPart(world, d));
  return buildProduct(world, recipe, parts);
}

/** True if the entity is a composed product (carries an `Assembly`) rather than a loose part. */
export function isProduct(world: World, entity: EntityId): boolean {
  return world.get(entity, Assembly) !== undefined;
}
