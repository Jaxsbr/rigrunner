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
 * Unlike scrap piles, the workshop does NOT emit a floating world-space "Press E" bubble: any bubble
 * anchored over the deck centre sits on top of the parts being loaded from some camera angles. The
 * workshop's open-prompt is the fixed bottom-centre HUD button (`#workshop-tab`, see `index.html` +
 * `workshop-overlay.ts`), which advertises the `E` key without ever touching the play area.
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
