import type { World } from '@core/world';
import type { ZoneDisc } from '@common/render/zone-overlays';
import { proximityDiscs } from '@common/sim/proximity-gate';
import { WorldShop } from './world-shop';

/**
 * The shop's contribution to the shared proximity overlays (ADR-003 §4): turn each `WorldShop` into a
 * generic ground-disc entry (via the shared `proximityDiscs`). `bootstrap.ts` concatenates these with the
 * other features' discs and hands them to the render-tier `ZoneOverlays`, so the feature owns "where a
 * shop's disc sits" while the render machinery stays feature-agnostic.
 *
 * The shop's open-prompt itself is a fixed bottom-centre HUD button (`#shop-tab`, see `index.html` +
 * `shop-overlay.ts`) — it advertises the `E` key in screen space, so it never sits over the shopfront.
 * This file only feeds the ground disc.
 */
export function shopZoneDiscs(world: World): ZoneDisc[] {
  return proximityDiscs(world, WorldShop);
}
