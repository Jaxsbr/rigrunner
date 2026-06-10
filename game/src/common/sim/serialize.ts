import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Assembly } from '@common/components/assembly';
import { EnginePart } from '@common/parts/engine-part';
import { partDef, spawnCatalogPart } from '@common/parts/parts-catalog';
import { recipeById } from '@common/parts/recipes';
import { buildProduct, isProduct } from '@common/sim/assembly';
import type { TierId } from '@common/parts/tiers';

/**
 * The semantic (de)serialiser for parts and products — the reusable kernel the save layer rebuilds the
 * player's rig and inventory through. The persistence model is a **semantic snapshot**: the save
 * describes things in the game's OWN vocabulary (a recipe + its sub-parts at their tiers), not the
 * engine's (raw component blobs + entity ids). The payoff is that a product is rebuilt through exactly
 * the same `buildProduct` path the workshop bench and the world-seed build through — so there is no
 * parallel deserialiser to drift out of sync, no entity-id remapping, and no risk of persisting
 * runtime/derived state (gate flags, timers): only facts go in, and the real constructors put them back.
 *
 * Lives in `@common/sim` because two consumers compose from it with no feature-specific semantics: the
 * rig (its chassis + each mounted product) and the inventory (each owned item).
 */

/** A single catalog part at a tier — the atom a product is made of, and an inventory's loose item. */
export interface PartRef {
  id: string;
  tier: TierId;
}

/** A composed product, described by its recipe and the sub-parts (each at its own tier) it was built from. */
export interface ProductDescriptor {
  recipeId: string;
  parts: PartRef[];
}

/** An owned inventory item: either a composed `product` or a single `loose` catalog part. */
export interface ItemDescriptor {
  product?: ProductDescriptor;
  loose?: PartRef;
}

/** Describe a composed product (an engine/container/Reclaimer/chassis) by its recipe + tiered sub-parts. */
export function describeProduct(world: World, product: EntityId): ProductDescriptor {
  const asm = world.get(product, Assembly);
  if (!asm) throw new Error('describeProduct: entity carries no Assembly (not a composed product)');
  const parts: PartRef[] = [];
  for (const e of asm.parts) {
    const ep = world.get(e, EnginePart);
    if (ep) parts.push({ id: ep.id, tier: ep.tier });
  }
  return { recipeId: asm.recipeId, parts };
}

/**
 * Rebuild a composed product from its descriptor — spawn a fresh part for each tiered sub-part, then
 * run the same `buildProduct` the bench/seed use. Per-sub-part tiers come back exactly (each part is
 * spawned at its own grade). An unknown recipe or part is the only way this fails: the recipe throws
 * (a corrupt save the caller should have version-gated), an unknown part id is skipped.
 */
export function rebuildProduct(world: World, desc: ProductDescriptor): EntityId {
  const recipe = recipeById(desc.recipeId);
  if (!recipe) throw new Error(`rebuildProduct: unknown recipe '${desc.recipeId}'`);
  const parts = desc.parts
    .map((r) => {
      const def = partDef(r.id);
      return def ? spawnCatalogPart(world, def, r.tier) : null;
    })
    .filter((e): e is EntityId => e !== null);
  return buildProduct(world, recipe, parts);
}

/** Describe an owned inventory entity — a composed product, or a single loose catalog part. */
export function describeItem(world: World, entity: EntityId): ItemDescriptor {
  if (isProduct(world, entity)) return { product: describeProduct(world, entity) };
  const ep = world.get(entity, EnginePart);
  if (!ep) throw new Error('describeItem: entity is neither a product nor a catalog part');
  return { loose: { id: ep.id, tier: ep.tier } };
}

/** Rebuild an owned inventory entity from its descriptor (a product is composed, a loose part spawned). */
export function rebuildItem(world: World, desc: ItemDescriptor): EntityId {
  if (desc.product) return rebuildProduct(world, desc.product);
  const r = desc.loose!;
  const def = partDef(r.id);
  if (!def) throw new Error(`rebuildItem: unknown part '${r.id}'`);
  return spawnCatalogPart(world, def, r.tier);
}
