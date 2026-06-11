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
 * A shop's open front is authored facing −Z (north — the rig's forward) at yaw 0. We turn it to a
 * **diagonal** — never a cardinal — so it never sits flat-on to an axis and reads as deliberately
 * placed. The four diagonals are yaw = π/4 + k·(π/2), validated against the −Z-is-north convention
 * in-game (a shop at yaw π/4 reads NW): NW = π/4, SW = 3π/4, **SE = 5π/4**, NE = 7π/4.
 *
 * Default = **SE**. The world's light is currently FIXED, casting shadows to the north-west — i.e. the
 * light comes from the south-east — so a front turned into the NW half sits in shadow and reads dark.
 * Facing SE puts the open counter in the light, so the entrance is legible. Per-shop variety (a random
 * diagonal) is the natural follow-up once a **day-night cycle** lifts the fixed-light constraint and
 * every facing gets its turn in the light; until then, every shop faces the light. Pass `rotationY` for
 * a one-off override.
 */
const SHOP_FRONT_SE = (5 * Math.PI) / 4;

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
 * Facing defaults to **SE** (`SHOP_FRONT_SE`) so the open front catches the fixed light and reads; pass
 * `rotationY` to pin a different diagonal.
 */
export function spawnWorldShop(
  world: World,
  x: number,
  z: number,
  tier: TierId = DEFAULT_TIER,
  stock: string[] = allStockedPartIds(),
  rotationY: number = SHOP_FRONT_SE,
): EntityId {
  const e = world.createEntity();
  world.add(e, Transform, { x, z, rotationY });
  world.add(e, WorldShop, { tier, stock, radius: ZONE_RADIUS, active: false });
  world.add(e, Renderable, { shape: 'model', assetId: 'shop' });
  return e;
}
