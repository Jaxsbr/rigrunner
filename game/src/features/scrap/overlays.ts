import type { World } from '@core/world';
import { Transform } from '@common/components/transform';
import type { ZoneDisc } from '@common/render/zone-overlays';
import type { HintSpec } from '@common/render/interaction-hints';
import { ScrapPile } from './scrap-pile';

/**
 * Scrap's contribution to the shared proximity overlays (ADR-003 §4): turn each `ScrapPile` into a
 * generic disc / hint entry. `main.ts` concatenates these with the other features' entries and hands
 * them to the render-tier `ZoneOverlays` / `InteractionHints`, so the feature owns "what a pile's
 * prompt says and how high it floats" while the render machinery stays feature-agnostic.
 */

// Bubble height (world metres) above the pile's origin — clear of the ~3 m scrap heap so the tail
// points down at it.
const PILE_HINT_Y = 4.0;

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

/** The "Hold E" hints for every scrap pile (press-and-hold rummages). */
export function scrapPileHints(world: World): HintSpec[] {
  const out: HintSpec[] = [];
  for (const e of world.query(ScrapPile, Transform)) {
    const t = world.get(e, Transform)!;
    out.push({ id: e, x: t.x, y: PILE_HINT_Y, z: t.z, label: 'Hold E', active: world.get(e, ScrapPile)!.active });
  }
  return out;
}
