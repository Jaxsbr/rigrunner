import type { World } from '@core/world';
import { Transform } from '@common/components/transform';
import type { ZoneDisc } from '@common/render/zone-overlays';
import { ScrapPile } from './scrap-pile';

/**
 * Scrap's contribution to the shared proximity overlays (ADR-003 §4): turn each `ScrapPile` into a
 * generic ground-disc entry. `main.ts` concatenates these with the other features' entries and hands
 * them to the render-tier `ZoneOverlays`, so the feature owns "where a pile's disc sits" while the
 * render machinery stays feature-agnostic.
 *
 * The pile's "Hold E" prompt is NOT a floating world-space bubble: anchored over the heap it sits on
 * top of the scrap from some camera angles. It's the fixed bottom-centre HUD prompt instead (see
 * `scrap-prompt.ts` + `#scrap-prompt` in `index.html`), which advertises the key without obstructing.
 */

/** The proximity discs for every scrap pile (lit only once a mounted Reclaimer is aimed in range). */
export function scrapPileDiscs(world: World): ZoneDisc[] {
  const out: ZoneDisc[] = [];
  for (const e of world.query(ScrapPile, Transform)) {
    const p = world.get(e, ScrapPile)!;
    const t = world.get(e, Transform)!;
    out.push({ id: e, x: t.x, z: t.z, radius: p.radius, active: p.active });
  }
  return out;
}
