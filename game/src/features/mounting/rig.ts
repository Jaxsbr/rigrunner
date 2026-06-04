import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { Drivetrain } from '@features/drive/drivetrain';
import { Velocity } from '@features/drive/velocity';
import { DriveControl } from '@features/drive/drive-control';
import { Collider } from '@common/components/collider';
import { Renderable } from '@common/components/renderable';
import { Part } from '@common/components/part';
import { Mount } from '@common/components/mount';
import { Chassis, type ChassisSize } from '@common/components/chassis';
import { chassisRecipeForSize } from '@common/parts/recipes';
import { composeProduct } from '@common/sim/assembly';
import { chassisParts } from '@features/chassis/chassis';

/**
 * A rig is not a class; it is a SET of capabilities a chassis carries once it's drivable. New entity
 * kinds are new functions like this (or, later, data), never new subclasses.
 *
 * The two halves are split at the seam the chassis-kit flow needs:
 *   - `composeProduct(chassisRecipeForSize, chassisParts)` builds a chassis PRODUCT — Part(chassis) +
 *     Weight + Chassis (the spec) + the deck MountGrid + the 2×2 packed-kit footprint. This is what
 *     the workshop bench assembles into a kit.
 *   - `chassisToRig` turns any such chassis product into a drivable rig by bolting on the drive/world
 *     components — so the kit hauled out of the workshop becomes a rig through the SAME path the
 *     starting rig is seeded through.
 *
 * The deck (`MountGrid`), rated load (`Chassis.loadCapacity`), engine envelope
 * (`Chassis.engineMin`..`engineMax`) and the rig's own mass (`Weight`) all come from the chassis,
 * not hard-coded here. Handling is the same constant `Drivetrain` for both sizes for now — the
 * chassis's own `topSpeed`/`turning` are summed but don't yet feed driving (the laden-weight
 * milestone wires that seam); with no engine mounted the rig still can't move (propulsion is the
 * engines').
 */
export function chassisToRig(world: World, chassis: EntityId, x = 0, z = 0): EntityId {
  const size = world.get(chassis, Chassis)!.size;
  // A staged kit already has a Transform (it had world presence on the deck) — reseat it on the
  // ground; a freshly-composed chassis (the starting rig) gets one. Either way y=0: a rig rolls on
  // the ground, it isn't hovering on a deck.
  const t = world.get(chassis, Transform);
  if (t) { t.x = x; t.z = z; t.y = 0; }
  else world.add(chassis, Transform, { x, z, y: 0, rotationY: 0 });
  world.remove(chassis, Mount); // it's a rig now, not a product staged on a workshop deck
  world.add(chassis, Drivetrain, { friction: 12, turnRate: 2.3, turnFullSpeed: 5, reverseFactor: 0.5 });
  world.add(chassis, Velocity, { speed: 0 });
  world.add(chassis, DriveControl, { throttle: 0, steer: 0 });
  // The chassis's own collision footprint (a circle over the body). Each mounted part adds its own
  // Collider, so the rig's true collision area is the union of these circles — it grows with the
  // build. Sized to the size's central body; the 3×5 hauler is wider so its disc is larger.
  world.add(chassis, Collider, { radius: size === '1x3' ? 1.0 : 1.9 });
  world.add(chassis, Renderable, { shape: 'model', assetId: size === '1x3' ? 'chassis-1x3' : 'chassis-3x5' });
  // A rig stands on the ground and is never mounted on a grid, so the packed-kit footprint no longer
  // applies — drop it so nothing treats the rig as a 2×2 occupant.
  const part = world.get(chassis, Part);
  if (part?.footprint) delete part.footprint;
  return chassis;
}

/** Compose a fresh chassis of `size` and make it a drivable rig — the starting-rig seed. */
export function spawnRig(world: World, x = 0, z = 0, size: ChassisSize = '1x3'): EntityId {
  return chassisToRig(world, composeProduct(world, chassisRecipeForSize(size), chassisParts(size)), x, z);
}
