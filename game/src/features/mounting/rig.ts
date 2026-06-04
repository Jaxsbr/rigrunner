import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { Drivetrain } from '@features/drive/drivetrain';
import { Velocity } from '@features/drive/velocity';
import { DriveControl } from '@features/drive/drive-control';
import { Collider } from '@common/components/collider';
import { Renderable } from '@common/components/renderable';
import type { ChassisSize } from '@common/components/chassis';
import { chassisRecipeForSize } from '@common/parts/recipes';
import { composeProduct } from '@common/sim/assembly';
import { chassisParts } from '@features/chassis/chassis';

/**
 * The first composition: a minimal drivable rig — a powered, steerable drive-train with a deck to
 * build on. A "rig" is not a class; it is this specific SET of capabilities. New entity kinds are new
 * functions like this (or, later, data), never new subclasses.
 *
 * The rig is built AROUND a chassis: `spawnRig` composes a chassis product from its three sub-parts
 * (`chassisParts`), so the deck (`MountGrid`), the rated load (`Chassis.loadCapacity`), the engine
 * envelope (`Chassis.engineMin`..`engineMax`) and the rig's own mass (`Weight`) all come from the
 * chassis — not hard-coded here. The size picks the footprint: 1×3 scout or 3×5 hauler, each with its
 * own GLB. `spawnRig` then bolts on the drive/world components that make that chassis drivable.
 *
 * It has a Drivetrain (chassis handling) but no propulsion of its own: top speed and acceleration
 * come from the engine(s) mounted on its deck (movement.ts + features/engine), so with none it can't
 * move. Handling is the same constant for both sizes for now — the chassis's own `topSpeed`/`turning`
 * stats are summed but don't yet feed driving (the laden-weight milestone wires that seam).
 */
export function spawnRig(world: World, x = 0, z = 0, size: ChassisSize = '1x3'): EntityId {
  // The chassis IS the rig entity: composing it stamps Part(chassis) + Weight + Chassis + the deck
  // MountGrid; spawnRig adds the drive/world components onto that same entity.
  const e = composeProduct(world, chassisRecipeForSize(size), chassisParts(size));
  world.add(e, Transform, { x, z, rotationY: 0 });
  world.add(e, Drivetrain, {
    friction: 12, turnRate: 2.3, turnFullSpeed: 5, reverseFactor: 0.5,
  });
  world.add(e, Velocity, { speed: 0 });
  world.add(e, DriveControl, { throttle: 0, steer: 0 });
  // The chassis's own collision footprint (a circle over the body). Each mounted part adds its own
  // Collider, so the rig's true collision area is the union of these circles — it grows with the
  // build. Sized to the size's central body; the 3×5 hauler is wider so its disc is larger.
  world.add(e, Collider, { radius: size === '1x3' ? 1.0 : 1.9 });
  world.add(e, Renderable, { shape: 'model', assetId: size === '1x3' ? 'chassis-1x3' : 'chassis-3x5' });
  return e;
}
