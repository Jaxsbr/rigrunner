import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { EnginePart } from '@common/parts/engine-part';
import { Assembly } from '@common/components/assembly';
import { Part } from '@common/components/part';
import { Weight } from '@common/components/weight';
import { EngineSpec } from '@common/components/engine-spec';
import { Storage, CONTAINER_CAPACITY } from '@common/components/storage';
import { Chassis, CHASSIS_KIT_FOOTPRINT } from '@common/components/chassis';
import { MountGrid } from '@common/components/mount-grid';
import {
  partDef,
  spawnCatalogPart,
  type PartDef,
  type EnergyType,
  type PartAttributes,
} from '@common/parts/parts-catalog';
import { tierOf, type TierId } from '@common/parts/tiers';
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

const ZERO_STATS: ProductStats = {
  power: 0, torque: 0, weight: 0, durability: 0, burst: 0,
  topSpeed: 0, turning: 0, loadCapacity: 0, capacity: 0,
};

/** Resolve a part entity to its catalog definition, or null if it isn't a known catalog part. */
export function defOf(world: World, entity: EntityId): PartDef | null {
  const ep = world.get(entity, EnginePart);
  return ep ? (partDef(ep.id) ?? null) : null;
}

/**
 * The RESOLVED stats of one part instance — its catalog BASE attributes scaled by the multiplier of
 * the tier its instance carries (`docs/part-identity-spec.md` §4a/b). This is the single seam the
 * whole tier axis pivots on: a rusty (tier-1) part resolves to exactly its base (mult 1, an
 * identity), while an iron part resolves to ~2.2× — so two parts sharing one `PartDef` differ purely
 * by the tier on their instance. Each field is rounded to a whole number so capacity stays an integer
 * (the scrap-fill gate counts whole pieces) and stats read clean. Null for a non-catalog entity.
 */
export function resolvePartStats(world: World, entity: EntityId): PartAttributes | null {
  const ep = world.get(entity, EnginePart);
  if (!ep) return null;
  const def = partDef(ep.id);
  if (!def) return null;
  const mult = tierOf(ep.tier).mult;
  const scale = (n: number | undefined): number => Math.round((n ?? 0) * mult);
  return {
    power: scale(def.attributes.power),
    torque: scale(def.attributes.torque),
    weight: scale(def.attributes.weight),
    durability: scale(def.attributes.durability),
    burst: scale(def.attributes.burst),
    topSpeed: scale(def.attributes.topSpeed),
    turning: scale(def.attributes.turning),
    loadCapacity: scale(def.attributes.loadCapacity),
    capacity: scale(def.attributes.capacity),
  };
}

/**
 * Sum the resolved (tier-scaled) attribute contributions of a set of part entities — unresolved parts
 * contribute nothing. Because each part resolves through its own tier before being summed, per-part
 * additive tiers fall out for free: a rusty-shell + iron-rim container is a valid mid-value between an
 * all-rusty and an all-iron one, with no special blending logic (§2c/§4b).
 */
export function sumPartStats(world: World, parts: readonly EntityId[]): ProductStats {
  const acc: ProductStats = { ...ZERO_STATS };
  for (const e of parts) {
    const s = resolvePartStats(world, e);
    if (!s) continue;
    acc.power += s.power;
    acc.torque += s.torque;
    acc.weight += s.weight;
    acc.durability += s.durability;
    acc.burst += s.burst;
    // The optional contributions are ≡ 0 on parts that don't carry them, so coalesce them in.
    acc.topSpeed = (acc.topSpeed ?? 0) + (s.topSpeed ?? 0);
    acc.turning = (acc.turning ?? 0) + (s.turning ?? 0);
    acc.loadCapacity = (acc.loadCapacity ?? 0) + (s.loadCapacity ?? 0);
    acc.capacity = (acc.capacity ?? 0) + (s.capacity ?? 0);
  }
  return acc;
}

/**
 * The single tier shared by a set of part entities, or null when they're mixed (or none carry one).
 * Drives the uniform finish tint a built product shows in the world/portrait — a mixed-tier product
 * has no one material finish. (The matched-set-bonus phase keys off this same uniformity.)
 */
export function productTier(world: World, parts: readonly EntityId[]): TierId | null {
  const tiers = new Set<TierId>();
  for (const e of parts) {
    const ep = world.get(e, EnginePart);
    if (ep) tiers.add(ep.tier);
  }
  return tiers.size === 1 ? [...tiers][0]! : null;
}

/**
 * The tier a specific sub-ASSET of a product should wear — so a product that renders as a composition
 * of several GLBs shows each piece at its own sub-part's grade (an iron-arm + rusty-bucket Reclaimer
 * reads iron arm, rusty bucket). It is the tier of the sub-part whose OWN asset is `assetId`; failing
 * that — a single-asset product whose one GLB stands for all its parts, e.g. an engine or container
 * with no per-sub-part assets yet — it falls back to the product's uniform tier (null when mixed, so
 * that lone GLB shows no one grade). This generalises cleanly: as more parts gain their own assets and
 * a product composes them, each sub-asset starts matching a sub-part and wears that part's grade.
 */
export function assetTier(world: World, product: EntityId, assetId: string): TierId | null {
  const asm = world.get(product, Assembly);
  if (!asm) return null;
  for (const e of asm.parts) {
    const ep = world.get(e, EnginePart);
    if (ep && partDef(ep.id)?.assetId === assetId) return ep.tier;
  }
  return productTier(world, asm.parts);
}

/**
 * The tier a single-GLB **chassis** wears — its **Frame** sub-part's grade. The chassis renders as one
 * whole GLB (its sub-part composition is the deferred follow-up — `docs/part-identity-spec.md` §2b), so it
 * takes ONE finish; the Frame is its structural host, so its grade represents the whole. Using the Frame's
 * tier (rather than the uniform tier) means a MIXED-tier chassis still reads as a graded chassis instead
 * of reverting to the untinted GLB. Falls back to the product's uniform tier, then null, if there's no
 * Frame part.
 */
export function chassisTier(world: World, product: EntityId): TierId | null {
  const asm = world.get(product, Assembly);
  if (!asm) return null;
  for (const e of asm.parts) {
    const ep = world.get(e, EnginePart);
    if (ep && partDef(ep.id)?.slot === 'frame') return ep.tier;
  }
  return productTier(world, asm.parts);
}

/**
 * The tier each sub-part of a product wears, keyed by its sub-part (catalog) id — the input the shared
 * assembler (`@shared/assembler`) composes from. Empty for a product with no `Assembly` (a directly-
 * spawned one supplies its own defaults). Lives here in the shared sim core because two features read it:
 * the workshop's `productRenderSpec` (the deck preview + inspect portrait) and the rig's `chassisToRig`
 * (the deployed chassis composes from these tiers) — and `features/mounting` must not import
 * `features/workshop`, so the function neither feature owns belongs in `@common/sim`.
 */
export function productSubPartTiers(world: World, product: EntityId): Record<string, TierId> {
  const asm = world.get(product, Assembly);
  const tiers: Record<string, TierId> = {};
  if (!asm) return tiers;
  for (const e of asm.parts) {
    const ep = world.get(e, EnginePart);
    if (ep) tiers[ep.id] = ep.tier;
  }
  return tiers;
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
      // Capacity is the tier-scaled sum of the Shell + Rim — the felt "iron container holds more"
      // payoff. A rusty (tier-1) container sums to exactly CONTAINER_CAPACITY, so a directly-spawned
      // container and a bench-built rusty one hold the same; the fallback only guards a storage
      // recipe that somehow carried no capacity-bearing part.
      world.add(product, Storage, { amount: 0, capacity: stats.capacity ?? CONTAINER_CAPACITY });
      break;
    case 'reclaimer':
      // The Reclaimer's capability is intrinsic to BEING MOUNTED — there's nothing to compute at
      // assembly. PR4's pile gate reads `Part.kind === 'reclaimer'` + a `Mount` on the rig directly,
      // so no capability component is attached here yet. (Weight is added by the shared path above.)
      break;
    case 'chassis': {
      // A chassis carries two intrinsics: the summed-from-sub-parts `Chassis` spec, and the deck
      // `MountGrid` other parts mount onto. Both the deck dimensions and the engine envelope are
      // size-fixed (from the recipe), not summed; the rest is the summed stats. spawnRig adds the
      // drive/world components around this to make it a drivable rig.
      const c = recipe.chassis!;
      world.add(product, Chassis, {
        size: c.size,
        engineMin: c.engineMin,
        engineMax: c.engineMax,
        topSpeed: stats.topSpeed ?? 0,
        turning: stats.turning ?? 0,
        loadCapacity: stats.loadCapacity ?? 0,
      });
      world.add(product, MountGrid, { cols: c.cols, rows: c.rows, cellSize: 1, deckY: c.deckY });
      // A chassis is built as a packed 2×2 kit: it stages and is carried as a 2×2 block until it's
      // hauled out and assembles into a rig (whose deck is the 1×3 / 3×5 above, not this footprint).
      world.get(product, Part)!.footprint = { ...CHASSIS_KIT_FOOTPRINT };
      break;
    }
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
