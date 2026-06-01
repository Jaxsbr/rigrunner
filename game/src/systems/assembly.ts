import type { World } from '../core/world';
import type { EntityId } from '../core/types';
import { EnginePart } from '../components/engine-part';
import { Assembly } from '../components/assembly';
import { Part } from '../components/part';
import { Weight } from '../components/weight';
import { EngineSpec } from '../components/engine-spec';
import { Storage } from '../components/storage';
import { Transform } from '../components/transform';
import { Renderable } from '../components/renderable';
import { Collider } from '../components/collider';
import { MountFacing } from '../components/mount-facing';
import {
  partDef,
  spawnEnginePart,
  type PartDef,
  type EnergyType,
  type PartAttributes,
} from '../content/parts-catalog';
import { CONTAINER_CAPACITY } from '../content/containers';
import { productAssetId } from '../content/product-visual';
import type { Recipe } from '../content/recipes';
import { getBench, benchSlots, clearBenchSlot } from '../components/bench';
import { addToInventory, removeFromInventory } from '../components/inventory';

/**
 * Assembly — turning the parts on the bench into a finished product. This is deliberately
 * RECIPE-GENERIC: nothing here is engine-specific. Given the active recipe and the parts in its
 * slots it (a) checks the build is complete and not a forbidden hybrid, (b) sums the parts'
 * attribute contributions, and (c) stamps out a product entity of the recipe's `productKind`,
 * consuming the bench parts into it. The engine is just the first recipe to use it; the storage
 * container assembles through exactly the same path, which is the proof the bench is generic.
 *
 * The one place product KINDS differ is `attachCapability` — an engine carries `EngineSpec`, a
 * container carries `Storage`. That capability IS intrinsic to the kind (an engine must produce a
 * spec the drive system reads), so a small explicit switch is the honest model; everything else —
 * completeness, the no-hybrid type rule, attribute summing, part conservation, dismantle — is shared.
 *
 * Conservation is the invariant: a part is always in exactly one place. Assembling moves the bench
 * parts INTO the product (kept alive on `Assembly.parts`, off the bench, never in inventory in
 * between); dismantling hands those same entities back to inventory and destroys the product. No
 * part is ever cloned or destroyed.
 */

/** The summed attribute contribution of a set of parts — the raw numbers a product is built from. */
export type ProductStats = PartAttributes;

const ZERO_STATS: ProductStats = { power: 0, torque: 0, weight: 0, durability: 0, burst: 0 };

/** Resolve a part entity to its catalog definition, or null if it isn't a known catalog part. */
function defOf(world: World, entity: EntityId): PartDef | null {
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

/** The part entities currently on the bench (filled slots only), in arbitrary order. */
function filledBenchParts(world: World): EntityId[] {
  return Object.values(benchSlots(world)).filter((e): e is EntityId => e !== null);
}

/** The defs of the parts currently on the bench. */
function benchPartDefs(world: World): PartDef[] {
  return filledBenchParts(world)
    .map((e) => defOf(world, e))
    .filter((d): d is PartDef => d !== null);
}

/**
 * The single energy type the bench is currently committed to, or null when it holds no typed part
 * yet. Drives the tactile no-hybrid refusal at DROP time: a typed part may only join a bench that is
 * empty of types or already that type. (An untyped part is always fine — it carries no type to clash.)
 */
export function benchEnergyType(world: World): EnergyType | null {
  return resolveEnergyType(benchPartDefs(world)).type;
}

/** Whether a part of the given type may be placed on the bench right now (no-hybrid rule). */
export function acceptsType(world: World, type: EnergyType | undefined): boolean {
  if (!type) return true; // untyped parts never clash
  const current = benchEnergyType(world);
  return current === null || current === type;
}

/** Every slot of the active recipe is filled. */
export function isBenchComplete(world: World, recipe: Recipe): boolean {
  const slots = benchSlots(world);
  return recipe.slots.every((s) => slots[s.slot] != null);
}

/**
 * Can the bench assemble the active recipe right now? Returns a verdict + a short human reason for
 * the disabled state (shown on the Assemble action). Complete AND not a hybrid ⇒ ok.
 */
export function assembleVerdict(world: World, recipe: Recipe): { ok: boolean; reason: string } {
  if (!isBenchComplete(world, recipe)) {
    return { ok: false, reason: `Fill all ${recipe.slots.length} slots to assemble` };
  }
  if (resolveEnergyType(benchPartDefs(world)).mismatch) {
    return { ok: false, reason: 'Parts don’t match — one energy type only' };
  }
  return { ok: true, reason: '' };
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
  }
}

/**
 * Build a product entity from a set of part entities, summing their stats and resolving their type.
 * The product is `Part {kind}` + `Weight` + (kind capability) + `Assembly` (its parts + resolved
 * type). It has NO world presence yet (no Transform/Renderable) and is added to no inventory — the
 * caller decides where it goes. The parts are taken to be already OWNED by this product (consumed
 * into `Assembly.parts`); they must not also live on the bench or in inventory.
 *
 * The shared core of two paths: `assemble` (parts off the bench) and `composeProduct` (fresh parts
 * spawned for seeding) — so a directly-seeded engine is built exactly like a bench-assembled one.
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
  const parts = defs.map((d) => spawnEnginePart(world, d));
  return buildProduct(world, recipe, parts);
}

/**
 * Assemble the active recipe from the parts on the bench into a single product entity, added to the
 * player's inventory. Returns the product id, or null if the bench can't assemble (incomplete or a
 * hybrid) — the caller treats null as a tactile refusal, nothing changes.
 *
 * The four/two bench parts are consumed INTO the product: cleared off the bench and owned by the
 * Assembly, never returned to inventory (the product takes their place there).
 */
export function assemble(world: World, recipe: Recipe): EntityId | null {
  if (!assembleVerdict(world, recipe).ok) return null;
  const bench = getBench(world);
  if (!bench) return null;

  // Capture the parts in recipe-slot order before clearing the slots.
  const parts = recipe.slots.map((s) => bench.slots[s.slot]!).filter((e): e is EntityId => e != null);
  const product = buildProduct(world, recipe, parts);

  // Consume the bench parts into the product (they're already off inventory — they were on the bench).
  for (const s of recipe.slots) clearBenchSlot(world, s.slot);
  addToInventory(world, product);
  return product;
}

/**
 * Give a composed product world PRESENCE so it can be carried and mounted: a Transform at (x, z) on
 * the ground, the GLB that draws its kind, a collider, and — for an engine — the outward MountFacing
 * a directly-spawned engine had. Taking a product into the world means it leaves the inventory
 * (conservation: a product is in exactly one place), so it's dropped from there here.
 *
 * The bridge the workshop's "Move to World" action and the startup pre-assembled engine both use to
 * get a product out of the abstract inventory and into the drivable world. (A loose sub-part stays
 * inventory-only — only whole products mount.)
 */
export function placeProductInWorld(world: World, product: EntityId, x: number, z: number): void {
  const part = world.get(product, Part);
  if (!part) return;
  const asm = world.get(product, Assembly);
  world.add(product, Transform, { x, z, y: 0, rotationY: 0 });
  world.add(product, Renderable, { shape: 'model', assetId: productAssetId(part.kind, asm?.recipeId ?? '', asm?.type) });
  world.add(product, Collider, { radius: 0.5 });
  if (part.kind === 'engine') world.add(product, MountFacing, { kind: 'specific', rule: 'outward' });
  removeFromInventory(world, product);
}

/**
 * Strip a product's world PRESENCE — the inverse of `placeProductInWorld`. Removes the Transform,
 * Renderable, Collider and (engine) MountFacing it gained when it entered the world, leaving the
 * abstract product entity (Part + Weight + capability + Assembly) intact so it can go back into the
 * inventory. Does NOT touch inventory or any Mount — the caller unmounts first and stores it after
 * (see `unstageProduct` in systems/staging.ts). Safe to call on a product with no presence (no-op).
 */
export function removeFromWorld(world: World, product: EntityId): void {
  world.remove(product, Transform);
  world.remove(product, Renderable);
  world.remove(product, Collider);
  world.remove(product, MountFacing);
}

/**
 * Dismantle a product: hand its parts back to inventory and destroy the product entity. Returns the
 * freed part entities (the same ones it was assembled from), or null if `product` isn't an assembly.
 * The reverse of `assemble` — fully conserved, the parts come back unchanged. The product must be
 * owned (in inventory); it's removed from there before being destroyed.
 */
export function dismantle(world: World, product: EntityId): EntityId[] | null {
  const asm = world.get(product, Assembly);
  if (!asm) return null;
  removeFromInventory(world, product);
  for (const part of asm.parts) addToInventory(world, part);
  const parts = asm.parts.slice();
  world.destroyEntity(product);
  return parts;
}

/** True if the entity is a composed product (carries an `Assembly`) rather than a loose part. */
export function isProduct(world: World, entity: EntityId): boolean {
  return world.get(entity, Assembly) !== undefined;
}
