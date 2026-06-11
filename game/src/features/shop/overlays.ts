import type { World } from '@core/world';
import { Transform } from '@common/components/transform';
import type { ZoneDisc } from '@common/render/zone-overlays';
import { WorldShop } from './world-shop';

/**
 * The shop's contribution to the shared proximity overlays (ADR-003 §4): turn each `WorldShop` into a
 * generic ground-disc entry. `bootstrap.ts` concatenates these with the other features' discs and hands
 * them to the render-tier `ZoneOverlays`, so the feature owns "where a shop's disc sits" while the
 * render machinery stays feature-agnostic.
 *
 * The shop's open-prompt itself is a fixed bottom-centre HUD button (`#shop-tab`, see `index.html` +
 * `shop-overlay.ts`) — it advertises the `E` key in screen space, so it never sits over the shopfront.
 * This file only feeds the ground disc.
 */
export function shopZoneDiscs(world: World): ZoneDisc[] {
  const out: ZoneDisc[] = [];
  for (const e of world.query(WorldShop, Transform)) {
    const s = world.get(e, WorldShop)!;
    const t = world.get(e, Transform)!;
    out.push({ id: e, x: t.x, z: t.z, radius: s.radius, active: s.active });
  }
  return out;
}
