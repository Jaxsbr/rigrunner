import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Part, type PartKind } from '@common/components/part';
import { Assembly } from '@common/components/assembly';
import type { EnergyType } from '@common/parts/parts-catalog';
import { tierOf, DEFAULT_TIER, type TierId } from '@common/parts/tiers';
import { partIdentity, productComposition } from '@shared/part-identity';
import { assetTier, chassisTier, productSubPartTiers, reclaimerHeadPartId } from '@common/sim/assembly';
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
 * chassis shows in inventory, on the workshop deck, and while carried; once hauled out it COMPOSES into a
 * drivable rig from its sub-parts (`chassisToRig` emits a `shape: 'assembly'` Renderable). An
 * engine/storage id reaching here (only via the fallback) resolves to the legacy whole-product GLB by
 * energy type / recipe id; unregistered ids fall back to a tinted placeholder downstream.
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
  /** Wash for an articulated asset's socket head (the Reclaimer's head). */
  headTint?: number;
  /** Which head GLB rides the wrist socket (the swappable head — bucket or stump-healer); omitted ⇒ bucket. */
  headAssetId?: string;
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
    // Grade the head that is ACTUALLY composed onto the arm, not always the bucket — so a stump-healer
    // head (or an iron one) reads at its own grade. The GLB to attach is named here too, for the render.
    const headPartId = reclaimerHeadPartId(world, product);
    const headAssetId = (headPartId ? partIdentity(headPartId)?.assetId : undefined) ?? BUCKET_ASSET;
    if (headAssetId !== BUCKET_ASSET) tints.headAssetId = headAssetId;
    const head = assetTier(world, product, headAssetId);
    if (head) tints.headTint = tierOf(head).finishColor;
  }
  return tints;
}

/**
 * How a product is drawn, resolved in ONE place so every surface agrees: the world entity, the workshop
 * deck preview, and the inspect portrait. A product either COMPOSES through the shared assembler — engine
 * and storage, the SAME path the viewer renders by, so a build reads identically in both (§2b) — or it
 * draws as a single whole-product GLB (a staged chassis's packed kit crate, the Reclaimer's articulated
 * arm). The chassis composes too, but only once DEPLOYED (`chassisToRig`), not while staged here.
 *
 * For a composed product `assetId` is the HOST GLB (the piece a single-GLB surface loads and then
 * composes the rest onto) and `tint` is the host sub-part's grade; `groupId` + `tiers` drive the
 * assembler. For a single-GLB product it's the whole-product asset + its uniform-tier finishes, exactly
 * as `productAssetId`/`productTints` give them.
 */
export type ProductRenderSpec =
  | { compose: true; groupId: string; tiers: Record<string, TierId>; assetId: string; tint: number }
  | { compose: false; assetId: string; tint?: number; headTint?: number; headAssetId?: string };

export function productRenderSpec(world: World, product: EntityId): ProductRenderSpec {
  const asm = world.get(product, Assembly);
  const kind = world.get(product, Part)?.kind ?? 'engine';
  const comp = asm ? productComposition(asm.recipeId) : undefined;
  // The chassis is the one composing product that does NOT take this generic path: a built chassis stages
  // (and is carried/inspected) as the packed KIT crate, and only composes when it's hauled out and
  // deployed (that seam is `chassisToRig`, which emits the `assembly` Renderable). So it falls through to
  // the kit-crate branch below despite having a composition descriptor.
  if (asm && comp && kind !== 'chassis') {
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
  const assetId = productAssetId(kind, asm?.recipeId ?? '', asm?.type);
  // A staged chassis is the packed kit crate — one whole GLB wearing its Frame's grade, so it always reads
  // as a graded chassis (never the untinted crate), even with mixed sub-part tiers.
  if (kind === 'chassis') {
    const ct = chassisTier(world, product);
    return { compose: false, assetId, ...(ct ? { tint: tierOf(ct).finishColor } : {}) };
  }
  const { tint, headTint, headAssetId } = productTints(world, product, assetId);
  return {
    compose: false,
    assetId,
    ...(tint !== undefined ? { tint } : {}),
    ...(headTint !== undefined ? { headTint } : {}),
    ...(headAssetId !== undefined ? { headAssetId } : {}),
  };
}
