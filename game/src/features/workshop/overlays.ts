import type { World } from '@core/world';
import { Transform } from '@common/components/transform';
import type { ZoneDisc } from '@common/render/zone-overlays';
import type { HintSpec } from '@common/render/interaction-hints';
import { WorkshopZone } from './workshop-zone';

/**
 * Workshop's contribution to the shared proximity overlays (ADR-003 §4): turn each `WorkshopZone`
 * into a generic disc / hint entry. `main.ts` concatenates these with the other features' entries and
 * hands them to the render-tier `ZoneOverlays` / `InteractionHints`, so the feature owns "what a
 * workshop's prompt says and how high it floats" while the render machinery stays feature-agnostic.
 */

// Bubble height (world metres) above the workshop's origin — clear of the ~0.7 m deck so the tail
// points down at it.
const WORKSHOP_HINT_Y = 1.8;

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

/** The "Press E" hints for every workshop zone (a tap opens the interface). */
export function workshopHints(world: World): HintSpec[] {
  const out: HintSpec[] = [];
  for (const e of world.query(WorkshopZone, Transform)) {
    const t = world.get(e, Transform)!;
    out.push({ id: e, x: t.x, y: WORKSHOP_HINT_Y, z: t.z, label: 'Press E', active: world.get(e, WorkshopZone)!.active });
  }
  return out;
}
