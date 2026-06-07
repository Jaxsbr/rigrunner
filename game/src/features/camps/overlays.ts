import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import type { ZoneDisc } from '@common/render/zone-overlays';
import { Camp } from './camp';
import { DISARM } from './disarm';
import { mountedTrapArmHeadTier } from './disarm-gate';

/**
 * Camps' contribution to the shared proximity overlays (ADR-003 §4): a ground disc under each
 * DISARMABLE camp — one appears only once a camp's guards are cleared, and it LIGHTS while the rig is
 * parked in disarm range carrying a trap arm (the same gate the "Press E to disarm" prompt reads, so
 * the lit ring and the prompt appear in lockstep). `main.ts` concatenates these with the other
 * features' entries and hands them to the render-tier `ZoneOverlays`.
 *
 * No disc while a camp is GUARDED (you can't disarm a defended camp) or CLEARED (it's done) — the disc
 * is purely the "this camp is ready to disarm, you're in reach" cue. The disc radius IS `DISARM.range`,
 * so its edge marks the exact proximity boundary the gate opens at.
 */
export function campDiscs(world: World, rig: EntityId): ZoneDisc[] {
  const out: ZoneDisc[] = [];
  const hasTrapArm = mountedTrapArmHeadTier(world, rig) !== null;
  const rigT = world.get(rig, Transform);
  for (const c of world.query(Camp, Transform)) {
    if (world.get(c, Camp)!.state !== 'disarmable') continue;
    const ct = world.get(c, Transform)!;
    const inRange =
      hasTrapArm && rigT !== undefined && Math.hypot(ct.x - rigT.x, ct.z - rigT.z) <= DISARM.range;
    out.push({ id: c as EntityId, x: ct.x, z: ct.z, radius: DISARM.range, active: inRange });
  }
  return out;
}
