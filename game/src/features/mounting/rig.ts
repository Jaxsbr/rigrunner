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
import { Chassis, CHASSIS_KIT_FOOTPRINT, type ChassisSize } from '@common/components/chassis';
import { chassisRecipeForSize } from '@common/parts/recipes';
import { composeProduct } from '@common/sim/assembly';
import { hasMountedParts } from '@features/mounting/mounting';
import { chassisParts } from '@features/chassis/chassis';
import {
  markOwned,
  ownedCount,
  ownedChassis,
  setActiveRig,
  PlayerChassis,
  ActiveRig,
  MAX_OWNED,
} from '@features/chassis/ownership';
import { Deploying } from '@features/chassis/deploying';

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

/**
 * Fold a drivable rig back into a packed chassis-kit crate — the exact inverse of `chassisToRig`. It
 * strips the drive/world components a rig wears, restores the 2×2 packed `Part.footprint`, and swaps
 * the Renderable back to the `chassis-kit` crate, while leaving the chassis spec, deck `MountGrid`,
 * mass and `Assembly` untouched — so the crate deploys again as the same chassis it was. The crate
 * stays at the rig's position (loose in the world, y still on the ground), a plain grabbable chassis
 * Part ready to be hauled onto the workshop deck like any kit.
 *
 * Pairs with `chassisToRig`: deploy bolts the rig on, pack-up takes it off. The build controller keys
 * "grabbable chassis" off the ABSENCE of `DriveControl` (you can't lift a rig off itself), so removing
 * it here is exactly what makes the packed kit liftable again.
 */
export function chassisToKit(world: World, chassis: EntityId): EntityId {
  world.remove(chassis, Drivetrain);
  world.remove(chassis, Velocity);
  world.remove(chassis, DriveControl);
  world.remove(chassis, Collider);
  world.remove(chassis, Deploying); // a settled rig isn't mid-unfold, but never leave a stale marker
  world.add(chassis, Renderable, { shape: 'model', assetId: 'chassis-kit' });
  // Restore the 2×2 packed footprint a rig sheds — mounting reserves the whole region when the kit is
  // staged back onto the workshop deck.
  world.get(chassis, Part)!.footprint = { ...CHASSIS_KIT_FOOTPRINT };
  return chassis;
}

/** Compose a fresh chassis of `size` and make it a drivable rig — the starting-rig seed. */
export function spawnRig(world: World, x = 0, z = 0, size: ChassisSize = '1x3'): EntityId {
  return chassisToRig(world, composeProduct(world, chassisRecipeForSize(size), chassisParts(size)), x, z);
}

/**
 * Deploy a hauled-out chassis kit: turn it into a drivable rig at (x, z) and register it as one of
 * the player's owned chassis. Refused — returns false, nothing changes — when the player is already
 * at `MAX_OWNED` (the cap the build interaction enforces at drop). Control is NOT switched: the new
 * chassis is owned and parked, switchable from the chassis bar. The convert+own pair lives here
 * (with `chassisToRig`) so the one-way `mounting → chassis` import stays acyclic.
 *
 * The new rig is marked `Deploying`, kicking off the authored unfold: it converts to a drivable rig
 * up front (this seam is unchanged) but the deploy animator poses its model from a packed crouch out
 * to its deployed stance over `DEPLOY_DURATION`, retired by `advanceDeploying`. Control staying on
 * the current rig means the unfold plays in full before the player ever drives the new chassis.
 */
export function deployChassis(world: World, chassis: EntityId, x = 0, z = 0): boolean {
  if (ownedCount(world) >= MAX_OWNED) return false;
  chassisToRig(world, chassis, x, z);
  markOwned(world, chassis);
  world.add(chassis, Deploying, { since: 0 });
  return true;
}

/**
 * Whether the controlled `chassis` can fold back into a kit right now — the pack-up gate. True only
 * when it is an owned (fielded) chassis carrying NO mounted parts (packing a loaded chassis would
 * orphan its parts — strip it first) AND the player owns another chassis to hand control to (we never
 * pack the last rig, which would leave nothing to drive). Where the prompt is allowed to show — off
 * the workshop, off a pile — is the composition root's placement call, not part of this rule.
 */
export function canPackUp(world: World, chassis: EntityId): boolean {
  if (!world.has(chassis, PlayerChassis)) return false;
  if (hasMountedParts(world, chassis)) return false;
  return ownedChassis(world).some((c) => c !== chassis);
}

/**
 * Pack up the chassis the player is controlling: fold it back into a kit crate and hand control to a
 * remaining owned chassis — the inverse of `deployChassis`. Refused (returns false, nothing changes)
 * unless `canPackUp` holds.
 *
 * On success the chassis stops being fielded — `PlayerChassis`/`ActiveRig` come off, which frees a
 * slot under the `MAX_OWNED` cap so a different chassis can deploy in its place — and control snaps to
 * the backup (the camera eases over via `main.ts`'s active-rig change). The crate it leaves behind is
 * a plain chassis Part again, hauled onto the workshop deck like any kit.
 */
export function packUpChassis(world: World, chassis: EntityId): boolean {
  if (!canPackUp(world, chassis)) return false;
  const backup = ownedChassis(world).find((c) => c !== chassis)!; // canPackUp guarantees one exists
  chassisToKit(world, chassis);
  world.remove(chassis, PlayerChassis);
  world.remove(chassis, ActiveRig);
  setActiveRig(world, backup);
  return true;
}
