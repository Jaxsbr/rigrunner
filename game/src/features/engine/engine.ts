import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Part } from '@common/components/part';
import { Mount } from '@common/components/mount';
import { EngineSpec } from '@common/components/engine-spec';

/**
 * Aggregating engine power. A rig can carry more than one engine, so the drive system asks here for
 * the *combined* output of everything mounted on it.
 *
 * Engines compound with DIMINISHING RETURNS: each added engine still helps, but less than the last.
 * Per attribute, the mounted engines' contributions are sorted high→low and scaled by a falling
 * series of marginal weights ([1, 0.7, 0.5, …]) — the strongest source runs at full weight, the next
 * at 0.7, the next at 0.5 — so two engines beat one and three beat two, but never by a full multiple.
 * The weights are chosen so each engine's gain comfortably exceeds the weight it drags on (drive.ts
 * mobility), keeping every extra engine a net gain — the marginal falls but never turns negative.
 *
 * The series is applied to power and torque INDEPENDENTLY, so a mixed-type rig leads each attribute
 * with its best source: an electric (high power) tops the power series, a steam (high torque) tops the
 * torque series — rewarding a balanced pair without any special blending.
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

/** The marginal weights for stacked engines: engine 1 runs full, engine 2 adds 70%, engine 3 adds
 *  50%. Ranks past the table hold the last weight, so a hypothetical larger deck still gains per
 *  engine. Tunable to feel — each must beat the weight its engine adds (see header). */
const MARGINAL_WEIGHTS = [1, 0.7, 0.5] as const;

/** Sum one attribute across engines with diminishing returns: sort high→low, scale each by its rank's
 *  marginal weight. Order-independent and per-attribute, so the strongest source of each attribute leads. */
function diminishingSum(values: number[]): number {
  return values
    .slice()
    .sort((a, b) => b - a)
    .reduce((sum, v, i) => sum + v * (MARGINAL_WEIGHTS[Math.min(i, MARGINAL_WEIGHTS.length - 1)] ?? 0), 0);
}

/** Combined output of every engine mounted on `rig`, compounded with diminishing returns. Zero if none. */
export function aggregateEngineOutput(world: World, rig: EntityId): EngineOutput {
  const specs = mountedEngines(world, rig).map((e) => world.get(e, EngineSpec)!);
  return {
    power: diminishingSum(specs.map((s) => s.power)),
    torque: diminishingSum(specs.map((s) => s.torque)),
  };
}
