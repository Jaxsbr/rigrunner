import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Part } from '@common/components/part';
import { Mount } from '@common/components/mount';
import { EngineSpec } from '@common/components/engine-spec';

/**
 * Aggregating engine power. A rig can carry more than one engine, so the drive system asks here for
 * the *combined* output of everything mounted on it — and the answer is a plain per-attribute sum.
 *
 * Linear scaling, on purpose: every engine contributes its full power and torque, so two engines are
 * twice one and six give the most. An earlier build damped each extra engine on a falloff curve;
 * combined with each engine's own weight dragging on mobility (see drive.ts history), that made the
 * 4th–6th engine a net *loss* — bolting on more drive made you slower. That whole algorithm is gone:
 * more engines are now strictly more performance, never a detriment.
 *
 * With the masking removed, the only thing distinguishing a build is the engines' own profiles —
 * electric (high power / low torque) tops out faster, steam (the reverse) accelerates harder.
 *
 * The sum is per-attribute, so an engine that's strong in torque but weak in power lends its torque
 * in full regardless of what else is mounted.
 */

export interface EngineOutput {
  power: number;  // combined top-speed contribution (units/s); 0 means no engine → can't drive
  torque: number; // combined acceleration contribution (units/s^2)
}

/** Every engine part currently mounted on `rig`. The shared basis for output + the stat readout. */
export function mountedEngines(world: World, rig: EntityId): EntityId[] {
  const engines: EntityId[] = [];
  for (const p of world.query(Part, Mount, EngineSpec)) {
    if (world.get(p, Mount)!.rig === rig && world.get(p, Part)!.kind === 'engine') engines.push(p);
  }
  return engines;
}

/** Combined output of every engine mounted on `rig` — a straight per-attribute sum. Zero if none. */
export function aggregateEngineOutput(world: World, rig: EntityId): EngineOutput {
  const specs = mountedEngines(world, rig).map((e) => world.get(e, EngineSpec)!);
  return {
    power: specs.reduce((sum, s) => sum + s.power, 0),
    torque: specs.reduce((sum, s) => sum + s.torque, 0),
  };
}
