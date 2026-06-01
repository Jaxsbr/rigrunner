import type { PartKind } from '../components/part';
import type { EnergyType } from './parts-catalog';

/**
 * Which GLB previews/renders a composed product — the ONE place that maps a product to its asset, so
 * the workshop portrait, the inventory chip, and the model placed in the world all agree.
 *
 * There are no bespoke composed-engine assets yet, so an engine reuses the two existing engine
 * models by energy type: mk2 (the brighter, more-illuminated build) stands in for the clean/glowing
 * ELECTRIC engine, mk1 (the plainer starter) for the grimier MECHANICAL one. Swap these for
 * dedicated assets when they land. Any other product previews via its recipe id — the storage
 * container's `storage` recipe id already resolves to the container GLB. Unregistered ids fall back
 * to a tinted placeholder downstream.
 */
const ENGINE_PREVIEW_ASSET: Record<EnergyType, string> = {
  electric: 'engine-mk2',
  mechanical: 'engine-mk1',
};

export function productAssetId(kind: PartKind, recipeId: string, type?: EnergyType): string {
  if (kind === 'engine' && type) return ENGINE_PREVIEW_ASSET[type];
  return recipeId;
}
