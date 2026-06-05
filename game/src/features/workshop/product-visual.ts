import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import type { PartKind } from '@common/components/part';
import type { EnergyType } from '@common/parts/parts-catalog';
import { tierOf } from '@common/parts/tiers';
import { assetTier } from '@common/sim/assembly';
import { isArticulated, BUCKET_ASSET } from '@common/render/articulation';

/**
 * Which GLB previews/renders a composed product — the ONE place that maps a product to its asset, so
 * the workshop portrait, the inventory chip, and the model placed in the world all agree.
 *
 * There are no bespoke composed-engine assets yet, so an engine reuses the two existing engine
 * models by energy type: mk2 (the brighter, more-illuminated build) stands in for the clean/glowing
 * ELECTRIC engine, mk1 (the plainer starter) for the grimier STEAM one. Swap these for
 * dedicated assets when they land. The Reclaimer renders its articulated ARM GLB (the render layer
 * parents the bucket head onto its wrist socket — see render/articulation.ts), so its `reclaimer`
 * recipe id maps to `reclaimer-arm`. Any other product previews via its recipe id — the storage
 * container's `storage` recipe id already resolves to the container GLB. Unregistered ids fall back
 * to a tinted placeholder downstream.
 *
 * A chassis product is the packed `chassis-kit` crate — how a built chassis shows in inventory, on
 * the workshop deck, and while carried. `chassisToRig` swaps in the unfolded `chassis-1x3`/`-3x5`
 * GLB the moment the kit is hauled out and becomes a rig, so the kit→rig transformation is visible.
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
