import type { World } from '../core/world';
import type { EntityId } from '../core/types';
import { Part } from '../components/part';
import { Mount } from '../components/mount';
import { EngineSpec } from '../components/engine-spec';

/**
 * Aggregating engine power. A rig can carry more than one engine, so the drive system asks here
 * for the *combined* output of everything mounted on it — and the answer is deliberately NOT a
 * plain sum.
 *
 * Diminishing returns: bolting on a second engine must not double your output. We sort each
 * attribute's contributions high→low and weight them 1, f, f², … (f = ADDED_ENGINE_FALLOFF). So
 * the strongest engine always counts in full and each extra one adds a shrinking slice — a stand-in
 * for the physical reality that you can't usefully stack power without limit. It still respects
 * what each engine brings: a bigger engine contributes more, wherever it sits in the order.
 *
 * The aggregation is per-attribute, so an engine that's strong in torque but weak in power lends
 * its torque at full weight even if another engine outranks it on power.
 */

export interface EngineOutput {
  power: number;  // combined top-speed contribution (units/s); 0 means no engine → can't drive
  torque: number; // combined acceleration contribution (units/s^2)
}

/** Each engine beyond the strongest contributes this fraction of the previous one's weight. */
const ADDED_ENGINE_FALLOFF = 0.4;

/** Every engine part currently mounted on `rig`. The shared basis for output + the stat readout. */
export function mountedEngines(world: World, rig: EntityId): EntityId[] {
  const engines: EntityId[] = [];
  for (const p of world.query(Part, Mount, EngineSpec)) {
    if (world.get(p, Mount)!.rig === rig && world.get(p, Part)!.kind === 'engine') engines.push(p);
  }
  return engines;
}

/** Combined output of every engine mounted on `rig`, with diminishing returns. Zero if none. */
export function aggregateEngineOutput(world: World, rig: EntityId): EngineOutput {
  const specs = mountedEngines(world, rig).map((e) => world.get(e, EngineSpec)!);
  return {
    power: diminishingSum(specs.map((s) => s.power)),
    torque: diminishingSum(specs.map((s) => s.torque)),
  };
}

/** Sum values with the strongest at full weight and each next one scaled by the falloff. */
function diminishingSum(values: number[]): number {
  const sorted = [...values].sort((a, b) => b - a);
  let total = 0;
  let weight = 1;
  for (const v of sorted) {
    total += v * weight;
    weight *= ADDED_ENGINE_FALLOFF;
  }
  return total;
}
