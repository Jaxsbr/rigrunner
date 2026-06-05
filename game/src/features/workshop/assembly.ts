import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Part } from '@common/components/part';
import { Assembly } from '@common/components/assembly';
import { Transform } from '@common/components/transform';
import { Renderable } from '@common/components/renderable';
import { Collider } from '@common/components/collider';
import { MountFacing } from '@common/components/mount-facing';
import type { PartDef, EnergyType } from '@common/parts/parts-catalog';
import type { Recipe } from '@common/parts/recipes';
import { defOf, resolveEnergyType, buildProduct } from '@common/sim/assembly';
import { productRenderSpec } from './product-visual';
import { getBench, benchSlots, clearBenchSlot } from './bench';
import { addToInventory, removeFromInventory } from '@features/economy/inventory';

/**
 * Workshop assembly — the bench / inventory / world-presence half of assembly (ADR-003
 * `features/workshop`). It drives the workshop bench: validating a build, consuming the parts on the
 * bench into a product, and bridging a product into and out of the drivable world. The pure,
 * recipe-generic compute (stat summing, type resolution, product stamping) lives in
 * `@common/sim/assembly` and is called down into here — so a bench-assembled product and a directly
 * seeded one are built identically.
 *
 * Conservation is the invariant: a part is always in exactly one place. Assembling moves the bench
 * parts INTO the product (kept alive on `Assembly.parts`, off the bench, never in inventory in
 * between); dismantling hands those same entities back to inventory and destroys the product. No
 * part is ever cloned or destroyed.
 */

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

/**
 * The size-match rule for a chassis build: a chassis recipe accepts a chassis sub-part only when
 * their sizes agree (1×3 parts build a 1×3 chassis, never a 3×5) — the size counterpart to the
 * no-hybrid energy rule. Non-chassis recipes, and non-chassis parts (already gated by slot role),
 * are unconstrained, so this is a no-op for the engine/container/Reclaimer benches.
 */
export function acceptsChassisPart(recipe: Recipe, def: PartDef): boolean {
  if (!recipe.chassis) return true;
  if (def.category !== 'chassis') return true;
  return def.chassisSize === recipe.chassis.size;
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
  // Chassis builds are size-locked the way engine builds are type-locked: every sub-part must match
  // the recipe's size. The drop guard (`acceptsChassisPart`) keeps mismatches off the bench, so this
  // is a belt-and-braces backstop for any other path that fills the slots.
  if (recipe.chassis && benchPartDefs(world).some((d) => !acceptsChassisPart(recipe, d))) {
    return { ok: false, reason: `Parts must all be ${recipe.chassis.size.replace('x', '×')} size` };
  }
  return { ok: true, reason: '' };
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
 * the ground, the GLB that draws its kind, a collider, and — for a DIRECTIONAL product (an engine or
 * the Reclaimer) — the outward MountFacing so its front (the intake / the arm) points off the rig.
 * Taking a product into the world means it leaves the inventory (conservation: a product is in
 * exactly one place), so it's dropped from there here.
 *
 * The bridge the workshop's "Move to World" action and the startup pre-assembled engine both use to
 * get a product out of the abstract inventory and into the drivable world. (A loose sub-part stays
 * inventory-only — only whole products mount.)
 */
export function placeProductInWorld(world: World, product: EntityId, x: number, z: number): void {
  const part = world.get(product, Part);
  if (!part) return;
  // One resolver decides how the product draws (`productRenderSpec`): an engine/container COMPOSES from
  // its sub-parts through the shared assembler — each piece at its own tier, the SAME path the viewer
  // renders by — while the chassis/Reclaimer draw as a single whole-product GLB (uniform-tier finish,
  // the Reclaimer's bucket its own grade).
  const spec = productRenderSpec(world, product);
  world.add(product, Transform, { x, z, y: 0, rotationY: 0 });
  world.add(product, Renderable, spec.compose
    ? { shape: 'assembly', groupId: spec.groupId, tiers: spec.tiers }
    : {
        shape: 'model',
        assetId: spec.assetId,
        ...(spec.tint !== undefined ? { tint: spec.tint } : {}),
        ...(spec.headTint !== undefined ? { headTint: spec.headTint } : {}),
      });
  world.add(product, Collider, { radius: 0.5 });
  if (part.kind === 'engine' || part.kind === 'reclaimer') {
    world.add(product, MountFacing, { kind: 'specific', rule: 'outward' });
  }
  removeFromInventory(world, product);
}

/**
 * Strip a product's world PRESENCE — the inverse of `placeProductInWorld`. Removes the Transform,
 * Renderable, Collider and (engine) MountFacing it gained when it entered the world, leaving the
 * abstract product entity (Part + Weight + capability + Assembly) intact so it can go back into the
 * inventory. Does NOT touch inventory or any Mount — the caller unmounts first and stores it after
 * (see `unstageProduct` in staging.ts). Safe to call on a product with no presence (no-op).
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
