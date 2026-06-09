import type { World } from '@core/world';
import { Transform } from '@common/components/transform';
import type { ZoneDisc } from '@common/render/zone-overlays';
import { Healable } from './healable';

/** Metres of the heal zone's proximity ring — matches `HEAL_RADIUS` in the restoration system. */
const HEAL_RADIUS = 4.0;

/**
 * The proximity discs for healable stumps — one per stump that is not yet fully grown, lit while its gate
 * is met (the rig parked with a stump-healer aimed at it). The restoration feature's adapter into the
 * shared `ZoneOverlays` (ADR-003 §4): `main.ts` concatenates these with the workshop/scrap/camp discs.
 * A fully-grown stump drops out of the list, so its ring is retired.
 */
export function healDiscs(world: World): ZoneDisc[] {
  const out: ZoneDisc[] = [];
  for (const e of world.query(Healable, Transform)) {
    const h = world.get(e, Healable)!;
    if (h.growth >= 1) continue; // grown — no longer a heal target
    const t = world.get(e, Transform)!;
    out.push({ id: e, x: t.x, z: t.z, radius: HEAL_RADIUS, active: h.active });
  }
  return out;
}
