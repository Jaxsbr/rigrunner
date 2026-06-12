import type { World } from '@core/world';
import type { ZoneDisc } from '@common/render/zone-overlays';
import { proximityDiscs } from '@common/sim/proximity-gate';
import { WorkshopZone } from './workshop-zone';

/**
 * Workshop's contribution to the shared proximity overlays (ADR-003 §4): turn each `WorkshopZone`
 * into a generic ground-disc entry (via the shared `proximityDiscs`). `main.ts` concatenates these with
 * the other features' entries and hands them to the render-tier `ZoneOverlays`, so the feature owns
 * "where a workshop's disc sits" while the render machinery stays feature-agnostic.
 *
 * The workshop's open-prompt itself is a fixed bottom-centre HUD button (`#workshop-tab`, see
 * `index.html` + `workshop-overlay.ts`) — it advertises the `E` key in screen space, so it never sits
 * over the parts being loaded onto the deck. This file only feeds the ground disc.
 */

/** The proximity discs for every workshop zone (lit only while the rig is parked in range). */
export function workshopZoneDiscs(world: World): ZoneDisc[] {
  return proximityDiscs(world, WorkshopZone);
}
