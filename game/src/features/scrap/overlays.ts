import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { Collider } from '@common/components/collider';
import type { ZoneDisc } from '@common/render/zone-overlays';
import { ScrapPile } from './scrap-pile';
import { Dissolving } from './dissolving';
import { mountedReclaimer } from './scrap-pile-system';

/**
 * Scrap's contribution to the shared proximity overlays (ADR-003 §4): turn each `ScrapPile` into a
 * generic ground-disc entry, in one of the three legibility states. `main.ts` concatenates these with
 * the other features' entries and hands them to the render-tier `ZoneOverlays`, so the feature owns
 * "where a pile's disc sits + what it needs" while the render machinery stays feature-agnostic.
 *
 *   - LIVE (`active`, green): a mounted Reclaimer is aimed at the pile in range — "Hold E to dig".
 *   - LOCKED (`locked`, dim grey): in reach but no digging Reclaimer mounted — "Needs Reclaimer". The
 *     range test here IGNORES facing, so the cue teaches as you drive past, before you own the tool.
 *   - INERT: out of range (or mid-reclaim) — no disc.
 *
 * The pile's "Hold E" prompt and the "Needs Reclaimer" hint are fixed bottom-centre HUD elements (see
 * `scrap-prompt.ts` / the shared `locked-prompt.ts`); this file only feeds the ground disc.
 */

/** The proximity discs for every scrap pile — LIVE when a Reclaimer is aimed in range, LOCKED when in reach without one. */
export function scrapPileDiscs(world: World, rig: EntityId): ZoneDisc[] {
  const rigT = world.get(rig, Transform);
  const rigR = world.get(rig, Collider)?.radius ?? 0;
  const hasReclaimer = rigT !== undefined && mountedReclaimer(world, rig) !== null;
  const out: ZoneDisc[] = [];
  for (const e of world.query(ScrapPile, Transform)) {
    const p = world.get(e, ScrapPile)!;
    const t = world.get(e, Transform)!;
    const inReach = rigT !== undefined && !world.has(e, Dissolving)
      && Math.hypot(t.x - rigT.x, t.z - rigT.z) <= p.radius + rigR;
    const locked = inReach && !hasReclaimer && !p.active;
    out.push({ id: e, x: t.x, z: t.z, radius: p.radius, active: p.active, locked, lockedLabel: 'Needs Reclaimer' });
  }
  return out;
}
