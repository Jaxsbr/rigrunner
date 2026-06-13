import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { Collider } from '@common/components/collider';
import type { ZoneDisc } from '@common/render/zone-overlays';
import { Healable } from './healable';
import { HEAL_RADIUS, mountedHealer } from './restoration-system';

/**
 * The proximity discs for healable stumps — one per stump not yet fully grown, in its legibility state.
 * The restoration feature's adapter into the shared `ZoneOverlays` (ADR-003 §4): `main.ts` concatenates
 * these with the workshop/scrap/camp discs. A fully-grown stump drops out of the list (its ring retires).
 *
 *   - LIVE (`active`, green): a stump-healer Reclaimer is aimed at the stump in range — "Hold E to grow".
 *   - LOCKED (`locked`, dim grey): in reach but no stump-healer mounted — "Needs Stump-Healer" (range
 *     ignores facing, so it teaches as you pass).
 */
export function healDiscs(world: World, rig: EntityId): ZoneDisc[] {
  const rigT = world.get(rig, Transform);
  const rigR = world.get(rig, Collider)?.radius ?? 0;
  const hasHealer = rigT !== undefined && mountedHealer(world, rig) !== null;
  const out: ZoneDisc[] = [];
  for (const e of world.query(Healable, Transform)) {
    const h = world.get(e, Healable)!;
    if (h.growth >= 1) continue; // grown — no longer a heal target
    const t = world.get(e, Transform)!;
    const inReach = rigT !== undefined && Math.hypot(t.x - rigT.x, t.z - rigT.z) <= HEAL_RADIUS + rigR;
    const locked = inReach && !hasHealer && !h.active;
    out.push({ id: e, x: t.x, z: t.z, radius: HEAL_RADIUS, active: h.active, locked, lockedLabel: 'Needs Stump-Healer' });
  }
  return out;
}
