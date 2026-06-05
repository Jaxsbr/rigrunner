import type { PartKind } from '@common/components/part';
import type { EnergyType } from '@common/parts/parts-catalog';

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
