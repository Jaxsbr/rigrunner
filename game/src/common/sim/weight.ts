import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Part } from '@common/components/part';
import { Mount } from '@common/components/mount';
import { Weight } from '@common/components/weight';
import { Storage } from '@common/components/storage';
import { Chassis } from '@common/components/chassis';

/**
 * How much one unit of carried scrap weighs. A container's own shell/rim weight is fixed (it counts
 * in `totalRigWeight` like any part), but the scrap *inside* it is dynamic — this converts that
 * count into mass. At 2, a full tier-1 container (4 scrap) carries 8 of cargo on top of its 4 dry
 * weight, so a full tank weighs ~3× an empty one — collecting scrap is felt as the rig getting
 * heavier. This is the primary "how much does cargo bite" tuning knob; expect to tune it to feel
 * alongside `WEIGHT_DRAG` in `features/drive/drive.ts`.
 */
export const SCRAP_UNIT_WEIGHT = 2;

/**
 * The rig's DRY mass: the chassis's own weight plus every weighted part mounted on it. Engines are
 * parts too, so their weight is counted here automatically — as is any other weighted part (a gun, a
 * container's empty shell). This is the structural mass that doesn't change during a run.
 *
 * Cargo is NOT counted here — the contents of a container live in `Storage.amount`, not a `Weight`
 * component, and are added on top by `effectiveRigWeight`. Keep this one structural so the dry and
 * dynamic halves of mass stay separable.
 */
export function totalRigWeight(world: World, rig: EntityId): number {
  let total = world.get(rig, Weight)?.value ?? 0;
  for (const p of world.query(Part, Mount, Weight)) {
    if (world.get(p, Mount)!.rig === rig) total += world.get(p, Weight)!.value;
  }
  return total;
}

/**
 * The live mass of everything sitting inside the rig's mounted containers: each container's
 * `Storage.amount` (scrap pieces) converted to mass by `SCRAP_UNIT_WEIGHT`. This is the dynamic half
 * of the rig's weight — it climbs as you drive over scrap and falls when you dump or spend it, which
 * is what gives collecting a felt cost.
 */
export function cargoWeight(world: World, rig: EntityId): number {
  let total = 0;
  for (const e of world.query(Storage, Mount)) {
    if (world.get(e, Mount)!.rig === rig) total += world.get(e, Storage)!.amount * SCRAP_UNIT_WEIGHT;
  }
  return total;
}

/**
 * The total mass the rig's engines must move: dry structural weight plus live cargo. This is THE
 * single effective-weight aggregation point — the drive consumes this one value (see
 * `features/drive/drive.ts → rigPerformance`), so every future load source (fuel weight, a
 * living-reward cargo) joins the drive feel by contributing here, with no change to the drive itself.
 */
export function effectiveRigWeight(world: World, rig: EntityId): number {
  return totalRigWeight(world, rig) + cargoWeight(world, rig);
}

/**
 * What the chassis is carrying vs what it's rated to carry — the load-ratio signal. `load` is
 * everything ON the chassis (mounted parts + cargo) excluding the chassis's own frame; `capacity` is
 * the chassis's rated carry weight; `ratio` is the two divided. The HUD reads `load`/`capacity` for
 * the readout, and `ratio` is the seam a future region/difficulty gate (or a fuel-pressure teaching
 * signal) reads to decide "too heavy to proceed" — none of which exists yet. Nothing refuses an
 * overload today; this only reports.
 */
export interface RigLoad {
  load: number;
  capacity: number;
  ratio: number;
}

export function rigLoad(world: World, rig: EntityId): RigLoad {
  const capacity = world.get(rig, Chassis)?.loadCapacity ?? 0;
  const ownWeight = world.get(rig, Weight)?.value ?? 0;
  const load = effectiveRigWeight(world, rig) - ownWeight;
  return { load, capacity, ratio: capacity > 0 ? load / capacity : 0 };
}
