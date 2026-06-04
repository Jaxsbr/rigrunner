import type { World } from '@core/world';
import { Transform } from '@common/components/transform';
import type { ZoneDisc } from '@common/render/zone-overlays';
import { WorkshopZone } from './workshop-zone';

/**
 * Workshop's contribution to the shared proximity overlays (ADR-003 §4): turn each `WorkshopZone`
 * into a generic ground-disc entry. `main.ts` concatenates these with the other features' entries and
 * hands them to the render-tier `ZoneOverlays`, so the feature owns "where a workshop's disc sits"
 * while the render machinery stays feature-agnostic.
 *
 * The workshop's open-prompt itself is a fixed bottom-centre HUD button (`#workshop-tab`, see
 * `index.html` + `workshop-overlay.ts`) — it advertises the `E` key in screen space, so it never sits
 * over the parts being loaded onto the deck. This file only feeds the ground disc.
 */

/** The proximity discs for every workshop zone (lit only while the rig is parked in range). */
export function workshopZoneDiscs(world: World): ZoneDisc[] {
  const out: ZoneDisc[] = [];
  for (const e of world.query(WorkshopZone, Transform)) {
    const z = world.get(e, WorkshopZone)!;
    const t = world.get(e, Transform)!;
    out.push({ id: e, x: t.x, z: t.z, radius: z.radius, active: z.active });
  }
  return out;
}
