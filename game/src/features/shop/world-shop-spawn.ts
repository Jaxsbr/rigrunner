import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { Renderable } from '@common/components/renderable';
import { Collider } from '@common/components/collider';
import { Solid } from '@common/components/solid';
import { DEFAULT_TIER, type TierId } from '@common/parts/tiers';
import { WorldShop } from './world-shop';
import { spawnShopYard } from './shop-yard';

/** Metres from the shop centre the rig must reach to open it — matches the workshop's reach. */
const ZONE_RADIUS = 3.5;
// One round footprint over the ≈3.2×2.4 m shopfront box, so the rig can't drive through the building
// (the yard props around it stay drive-through). Comfortably inside the zone, so the rig still reaches
// the counter to open the shop. Tunable.
const SOLID_RADIUS = 1.5;

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
 * Place a world shop: a structure the rig drives to that opens the shop interface, selling the full priced
 * catalogue at its `tier`. Mirrors `spawnWorkshop` — a pure entity builder (Transform + Renderable + the
 * gating component + a Solid footprint so the rig can't drive through it), no special state. Defaults to the
 * rusty grade (the first bowl shop); pass a tier for the tier-themed shops that follow (a rusty shop sells
 * rusty parts, an iron shop iron, etc.).
 *
 * Facing defaults to **SE** (`SHOP_FRONT_SE`) so the open front catches the fixed light and reads; pass
 * `rotationY` to pin a different diagonal.
 *
 * Spawning a shop also scatters its goods **yard** — the props that wrap it (`spawnShopYard`) — so a shop
 * is never a bare container in the middle of nowhere. The yard is decoration entities, oriented to this
 * shop's facing; the returned id is the shop building (the gated entity), as callers expect.
 */
export function spawnWorldShop(
  world: World,
  x: number,
  z: number,
  tier: TierId = DEFAULT_TIER,
  rotationY: number = SHOP_FRONT_SE,
): EntityId {
  const e = world.createEntity();
  world.add(e, Transform, { x, z, rotationY });
  world.add(e, WorldShop, { tier, radius: ZONE_RADIUS, active: false });
  world.add(e, Renderable, { shape: 'model', assetId: 'shop' });
  world.add(e, Collider, { radius: SOLID_RADIUS });
  world.add(e, Solid, true);
  spawnShopYard(world, x, z, rotationY);
  return e;
}
