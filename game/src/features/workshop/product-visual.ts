import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Part, type PartKind } from '@common/components/part';
import { Assembly } from '@common/components/assembly';
import { EnginePart } from '@common/parts/engine-part';
import type { EnergyType } from '@common/parts/parts-catalog';
import { tierOf, DEFAULT_TIER, type TierId } from '@common/parts/tiers';
import { partIdentity, productComposition } from '@shared/part-identity';
import { assetTier, chassisTier } from '@common/sim/assembly';
import { isArticulated, BUCKET_ASSET } from '@common/render/articulation';

/**
 * The single whole-product GLB for a product that draws as ONE model — the chassis and the Reclaimer.
 * Engines and containers no longer come through here: they COMPOSE from their sub-parts via the shared
 * assembler (`productRenderSpec` → `shape: 'assembly'`), so a build reads as its located, per-tier pieces
 * (§2b). This stays the resolver for the single-GLB kinds, and a fallback for any product without a
 * composition descriptor.
 *
 * The Reclaimer renders its articulated ARM GLB (the render layer parents the bucket head onto its wrist
 * socket — see render/articulation.ts). A chassis product is the packed `chassis-kit` crate — how a built
 * chassis shows in inventory, on the workshop deck, and while carried; `chassisToRig` swaps in the
 * unfolded `chassis-1x3`/`-3x5` GLB the moment the kit is hauled out and becomes a rig. An engine/storage
 * id reaching here (only via the fallback) resolves to the legacy whole-product GLB by energy type / recipe
 * id; unregistered ids fall back to a tinted placeholder downstream.
 */
const ENGINE_PREVIEW_ASSET: Record<EnergyType, string> = {
  electric: 'engine-mk2',
  steam: 'engine-mk1',
};

export function productAssetId(kind: PartKind, recipeId: string, type?: EnergyType): string {
  if (kind === 'engine' && type) return ENGINE_PREVIEW_ASSET[type];
  if (kind === 'reclaimer') return 'reclaimer-arm';
  if (kind === 'chassis') return 'chassis-kit';
  return recipeId;
}

/** The tier finish each rendered piece of a product wears (`docs/part-identity-spec.md` §3). */
export interface ProductTints {
  /** Wash for the base model. */
  tint?: number;
  /** Wash for an articulated asset's socket head (the Reclaimer's bucket). */
  headTint?: number;
}

/**
 * The finishes a composed product's render wears — the companion to `productAssetId`, kept here so the
 * ONE place that maps a product to its asset also says how each piece is graded. The base model is
 * washed by the tier of the sub-part whose asset it is (or the product's uniform tier for a one-GLB
 * product), and an articulated arm's head is washed by its own sub-part's tier — so an iron-arm +
 * rusty-bucket Reclaimer shows each piece's real grade instead of collapsing to one finish or none.
 */
export function productTints(world: World, product: EntityId, assetId: string): ProductTints {
  const tints: ProductTints = {};
  const base = assetTier(world, product, assetId);
  if (base) tints.tint = tierOf(base).finishColor;
  if (isArticulated(assetId)) {
    const head = assetTier(world, product, BUCKET_ASSET);
    if (head) tints.headTint = tierOf(head).finishColor;
  }
  return tints;
}

/**
 * The tier each sub-part of a product wears, keyed by its sub-part (catalog) id — the input the shared
 * assembler composes from (`@shared/assembler`). Empty for a product with no `Assembly` (a directly-
 * spawned one supplies its own defaults).
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
 * How a product is drawn, resolved in ONE place so every surface agrees: the world entity, the workshop
 * deck preview, and the inspect portrait. A product either COMPOSES through the shared assembler — engine
 * and storage, the SAME path the viewer renders by, so a build reads identically in both (§2b) — or it
 * draws as a single whole-product GLB (the chassis's functional rig, the Reclaimer's articulated arm).
 *
 * For a composed product `assetId` is the HOST GLB (the piece a single-GLB surface loads and then
 * composes the rest onto) and `tint` is the host sub-part's grade; `groupId` + `tiers` drive the
 * assembler. For a single-GLB product it's the whole-product asset + its uniform-tier finishes, exactly
 * as `productAssetId`/`productTints` give them.
 */
export type ProductRenderSpec =
  | { compose: true; groupId: string; tiers: Record<string, TierId>; assetId: string; tint: number }
  | { compose: false; assetId: string; tint?: number; headTint?: number };

export function productRenderSpec(world: World, product: EntityId): ProductRenderSpec {
  const asm = world.get(product, Assembly);
  const comp = asm ? productComposition(asm.recipeId) : undefined;
  if (asm && comp) {
    const tiers = productSubPartTiers(world, product);
    const hostTier = tiers[comp.host] ?? DEFAULT_TIER;
    return {
      compose: true,
      groupId: asm.recipeId,
      tiers,
      assetId: partIdentity(comp.host)!.assetId,
      tint: tierOf(hostTier).finishColor,
    };
  }
  const kind = world.get(product, Part)?.kind ?? 'engine';
  const assetId = productAssetId(kind, asm?.recipeId ?? '', asm?.type);
  // A chassis is one whole GLB (composition deferred) — it wears its Frame's grade, so it always reads as
  // a graded chassis (never the untinted blue GLB), even with mixed sub-part tiers.
  if (kind === 'chassis') {
    const ct = chassisTier(world, product);
    return { compose: false, assetId, ...(ct ? { tint: tierOf(ct).finishColor } : {}) };
  }
  const { tint, headTint } = productTints(world, product, assetId);
  return { compose: false, assetId, ...(tint !== undefined ? { tint } : {}), ...(headTint !== undefined ? { headTint } : {}) };
}
