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
import { composeProduct, chassisTier, productSubPartTiers } from '@common/sim/assembly';
import { tierOf } from '@common/parts/tiers';
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
 * (`Chassis.engineMin`..`engineMax`), HANDLING (`Chassis.turning`/`grip` → the `Drivetrain`, see
 * `chassisToRig`) and the rig's own mass (`Weight`) all come from the chassis, not hard-coded here —
 * so a higher-tier chassis turns sharper and decelerates faster. With no engine mounted the rig still
 * can't move (propulsion is the engines').
 */
/**
 * The single tier finish the packed kit CRATE wears — its Frame sub-part's grade (`chassisTier`). The
 * crate is one whole GLB, so it takes one finish; tinting by the Frame means it always reads as a graded
 * chassis — a rusty build's crate wears the rust finish, an iron one the iron finish — never the untinted
 * crate, even when its sub-parts are mixed. (The DEPLOYED rig instead composes, so each sub-part wears its
 * OWN grade — `chassisToRig` below.)
 */
function chassisFinish(world: World, chassis: EntityId): number | undefined {
  const t = chassisTier(world, chassis);
  return t ? tierOf(t).finishColor : undefined;
}

// Handling derives from the chassis's own (tier-scaled) sub-part stats, so upgrading the running gear
// — not just the engine — is felt. Steering is a turning-RADIUS model (see movement.ts): yaw rate =
// speed / turnRadius, so the rig arcs like a vehicle instead of pivoting on the spot. A higher-tier
// (more `turning`) chassis gets a TIGHTER radius — sharper handling — floored so it never collapses
// back into a pirouette. The 3×5 hauler turns wider (lower `turning`). Radii are a couple rig-lengths,
// so turns read as real arcs. reverseFactor isn't a tier axis yet. All tunable to feel.
//   turnRadius(1×3): rusty 8→6.4, iron 18→4.4   ·   turnRadius(3×5): rusty 5→7.0, iron 11→5.8
//   friction(1×3): rusty 14, iron 21
const TURN_RADIUS_BASE = 8;          // turning radius (units) before the chassis `turning` tightens it
const TURN_RADIUS_PER_TURNING = 0.2; // units the radius tightens per point of `turning` (tier-scaled)
const TURN_RADIUS_MIN = 3.5;         // floor — keeps even a high-turning chassis arcing, never pivoting
const BASE_BRAKE = 8;                // constant off-throttle deceleration; the chassis `grip` adds to it

export function chassisToRig(world: World, chassis: EntityId, x = 0, z = 0): EntityId {
  const chassisSpec = world.get(chassis, Chassis)!;
  const size = chassisSpec.size;
  // A staged kit already has a Transform (it had world presence on the deck) — reseat it on the
  // ground; a freshly-composed chassis (the starting rig) gets one. Either way y=0: a rig rolls on
  // the ground, it isn't hovering on a deck.
  const t = world.get(chassis, Transform);
  if (t) { t.x = x; t.z = z; t.y = 0; }
  else world.add(chassis, Transform, { x, z, y: 0, rotationY: 0 });
  world.remove(chassis, Mount); // it's a rig now, not a product staged on a workshop deck
  // Handling from the chassis: turning radius tightens with the suspension `turning`; off-throttle
  // deceleration = a constant brake + the wheel/axle `grip`. Both are tier-scaled, so an iron chassis
  // arcs tighter and brakes harder — floored so it stays an arc and rusty gear stays decent.
  const friction = BASE_BRAKE + (chassisSpec.grip ?? 0);
  const turnRadius = Math.max(
    TURN_RADIUS_MIN,
    TURN_RADIUS_BASE - (chassisSpec.turning ?? 0) * TURN_RADIUS_PER_TURNING,
  );
  world.add(chassis, Drivetrain, { friction, turnRadius, reverseFactor: 0.5 });
  world.add(chassis, Velocity, { speed: 0 });
  world.add(chassis, DriveControl, { throttle: 0, steer: 0 });
  // The chassis's own collision footprint (a circle over the body). Each mounted part adds its own
  // Collider, so the rig's true collision area is the union of these circles — it grows with the
  // build. Sized to the size's central body; the 3×5 hauler is wider so its disc is larger.
  world.add(chassis, Collider, { radius: size === '1x3' ? 1.0 : 1.9 });
  // The deployed rig renders as its COMPOSED sub-parts — the per-size Frame deck holding a Wheel +
  // Suspension unit at every corner station, each at its own grade — through the same shared assembler the
  // viewer composes by, so a build reads identically in both. The `assembly` Renderable carries the group
  // id + each sub-part's tier; the assembler (via entity-views) loads the host, instances the wheels +
  // suspension onto its station sockets, and exposes the `wheel_*` nodes the spin/deploy animators drive.
  world.add(chassis, Renderable, {
    shape: 'assembly',
    groupId: size === '1x3' ? 'chassis-1x3' : 'chassis-3x5',
    tiers: productSubPartTiers(world, chassis),
  });
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
  const kitTint = chassisFinish(world, chassis);
  world.add(chassis, Renderable, {
    shape: 'model',
    assetId: 'chassis-kit',
    ...(kitTint !== undefined ? { tint: kitTint } : {}),
  });
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
