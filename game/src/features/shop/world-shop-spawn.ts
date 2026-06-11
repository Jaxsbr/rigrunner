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
 * The four **diagonal** facings (NW, SW, SE, NE) as a yaw about +Y. The shop's authored front (the open
 * counter) faces −Z at yaw 0; these turn it to a diagonal. We use ONLY diagonals — never a cardinal —
 * for two reasons:
 *  - **Legibility:** square-on to an axis, the open front can sit dead-away from the camera; a diagonal
 *    always leaves a camera angle that sees into the counter (paired with the open-top asset).
 *  - **Naturalness:** a world of grid-aligned, identically-facing buildings looks artificial. Varied
 *    diagonals read as deliberately, individually placed.
 */
const DIAGONAL_YAWS = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4];

/**
 * Pick a shop's diagonal facing from its position — varied across shops, but **stable** for a given
 * spot. A shop is static scaffolding rebuilt every load (it isn't in the save), so a position-derived
 * pick keeps it from spinning to a new facing on each reload the way a fresh `Math.random()` would:
 * same place → same facing, session after session, while different shops still face different ways.
 */
function diagonalFacingFor(x: number, z: number): number {
  const h = Math.imul(Math.round(x * 1000) | 0, 374761393) ^ Math.imul(Math.round(z * 1000) | 0, 668265263);
  return DIAGONAL_YAWS[((h % 4) + 4) % 4]!;
}

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
 *
 * Facing defaults to a position-derived **diagonal** (`diagonalFacingFor`) so shops vary naturally and
 * the open front is always reachable by some camera angle; pass `rotationY` to pin a specific facing.
 */
export function spawnWorldShop(
  world: World,
  x: number,
  z: number,
  tier: TierId = DEFAULT_TIER,
  stock: string[] = allStockedPartIds(),
  rotationY: number = diagonalFacingFor(x, z),
): EntityId {
  const e = world.createEntity();
  world.add(e, Transform, { x, z, rotationY });
  world.add(e, WorldShop, { tier, stock, radius: ZONE_RADIUS, active: false });
  world.add(e, Renderable, { shape: 'model', assetId: 'shop' });
  return e;
}
