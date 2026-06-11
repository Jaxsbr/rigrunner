import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { Renderable } from '@common/components/renderable';
import { DEFAULT_TIER, type TierId } from '@common/parts/tiers';
import { WorldShop } from './world-shop';
import { PART_COSTS } from './part-costs';

/** Metres from the shop centre the rig must reach to open it — matches the workshop's reach. */
const ZONE_RADIUS = 3.5;

/**
 * Every priced catalog part — the "carries everything" stock for the first, sole world shop, so
 * relocating the old workshop Shop tab into the world loses no capability. A partial/unique stock is
 * just a hand-picked subset of these ids, which later shops will use to spread parts across the map.
 */
export function allStockedPartIds(): string[] {
  return PART_COSTS.map((c) => c.partId);
}

/**
 * Place a world shop: a structure the rig drives to that opens the shop interface scoped to its own
 * `stock` at its `tier`. Mirrors `spawnWorkshop` — a pure entity builder (Transform + Renderable +
 * the gating component), no special state. Defaults to the rusty grade carrying everything (the first
 * bowl shop); pass a tier + a subset list for the tier-themed, partial-stock shops that follow.
 */
export function spawnWorldShop(
  world: World,
  x: number,
  z: number,
  tier: TierId = DEFAULT_TIER,
  stock: string[] = allStockedPartIds(),
): EntityId {
  const e = world.createEntity();
  world.add(e, Transform, { x, z, rotationY: 0 });
  world.add(e, WorldShop, { tier, stock, radius: ZONE_RADIUS, active: false });
  world.add(e, Renderable, { shape: 'model', assetId: 'shop' });
  return e;
}
