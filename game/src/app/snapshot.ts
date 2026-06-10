import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { Storage } from '@common/components/storage';
import { Wallet, getWallet } from '@features/economy/wallet';
import { Inventory, addToInventory, inventoryItems } from '@features/economy/inventory';
import {
  describeProduct,
  rebuildProduct,
  describeItem,
  rebuildItem,
  type ProductDescriptor,
  type ItemDescriptor,
} from '@common/sim/serialize';
import { mountedPartsOn, mountPart } from '@features/mounting/mounting';
import { chassisToRig } from '@features/mounting/rig';
import { placeProductInWorld } from '@features/workshop/assembly';
import { ownedChassis, getActiveRig, markOwned, setActiveRig } from '@features/chassis/ownership';
import { describeScrapPiles, spawnScrapPileFromSave, type PileSave } from '@features/scrap/scrap';
import { describeCamps, spawnCampFromSave, type CampSave } from '@features/camps/camp-spawn';
import { describeStumps, spawnStumpFromSave, type StumpSave } from '@features/restoration/restoration-persistence';

/**
 * The game-state snapshot: capture the durable real-game world to a plain object, and rebuild it. This
 * is the orchestration layer of the **semantic snapshot** persistence model — it sits in the `app/`
 * composition-root tier because it reaches across features (economy · mounting · chassis · scrap ·
 * camps · restoration) to assemble one save, which a single feature must not do. Each feature owns the
 * description of its OWN durable state (`describeProduct`, `describeScrapPiles`, `describeCamps`,
 * `describeStumps`); this file only folds them together and replays them.
 *
 * What's durable (the save) vs reset-on-load:
 *  - **Durable:** banked scrap (wallet), the inventory, every owned chassis + its mounted loadout
 *    (cell, facing, and any unbanked scrap sitting in a mounted container), and the world's content —
 *    piles still standing (how dug-down), camps still guarded, stumps already healed (how grown).
 *  - **Reset on load (deliberately):** rig hit points + boost heat (a reload repairs you), loose
 *    ground scrap (a one-time New-Game starter, not re-laid on Continue so a reload can't farm it),
 *    and all transient/derived state (gate flags, in-flight projectiles, live enemy positions, work
 *    timers) — none of which is a *fact* worth persisting.
 *
 * Continue does NOT run this through the cold-open seed: the static world (workshop, bench) is laid
 * first by `seedStaticWorld`, then `restoreSnapshot` rebuilds the progress on top.
 */

export const SNAPSHOT_VERSION = 2;

interface MountSave {
  col: number;
  row: number;
  yaw: number;
  product: ProductDescriptor;
  /** Unbanked scrap sitting in this part, if it's a container — so a half-full container survives a reload. */
  storageAmount?: number;
}

interface RigSave {
  chassis: ProductDescriptor;
  x: number;
  z: number;
  rotationY: number;
  mounts: MountSave[];
}

type SiteSave =
  | ({ type: 'pile' } & PileSave)
  | ({ type: 'camp' } & CampSave)
  | ({ type: 'stump' } & StumpSave);

export interface GameSnapshot {
  version: number;
  wallet: { scrap: number };
  inventory: ItemDescriptor[];
  rigs: RigSave[];
  /** Index into `rigs` of the chassis the player was controlling. */
  activeRigIndex: number;
  sites: SiteSave[];
}

/** Capture the live real-game world to a serializable snapshot. */
export function captureSnapshot(world: World): GameSnapshot {
  const owned = ownedChassis(world);
  const active = getActiveRig(world);
  return {
    version: SNAPSHOT_VERSION,
    wallet: { scrap: getWallet(world)?.scrap ?? 0 },
    inventory: inventoryItems(world).map((e) => describeItem(world, e)),
    rigs: owned.map((c) => describeRig(world, c)),
    activeRigIndex: active ? Math.max(0, owned.indexOf(active)) : 0,
    sites: [
      ...describeScrapPiles(world).map((p): SiteSave => ({ type: 'pile', ...p })),
      ...describeCamps(world).map((c): SiteSave => ({ type: 'camp', ...c })),
      ...describeStumps(world).map((s): SiteSave => ({ type: 'stump', ...s })),
    ],
  };
}

function describeRig(world: World, chassis: EntityId): RigSave {
  const t = world.get(chassis, Transform);
  return {
    chassis: describeProduct(world, chassis),
    x: t?.x ?? 0,
    z: t?.z ?? 0,
    rotationY: t?.rotationY ?? 0,
    mounts: mountedPartsOn(world, chassis).map((m): MountSave => {
      const storage = world.get(m.part, Storage);
      return {
        col: m.col,
        row: m.row,
        yaw: m.yaw,
        product: describeProduct(world, m.part),
        ...(storage ? { storageAmount: storage.amount } : {}),
      };
    }),
  };
}

/**
 * Rebuild the durable world from a snapshot onto an already-static-seeded world. Order matters: the
 * player store (wallet + inventory) comes first so `addToInventory` has its singleton; then each rig is
 * rebuilt as a chassis product made drivable and re-mounted; then world content is respawned.
 */
export function restoreSnapshot(world: World, snap: GameSnapshot): void {
  // Player store — created here (not by the static seed) so the saved totals land on it.
  const store = world.createEntity();
  world.add(store, Wallet, { scrap: snap.wallet.scrap });
  world.add(store, Inventory, { items: [] });
  for (const item of snap.inventory) addToInventory(world, rebuildItem(world, item));

  // Rigs — rebuild each chassis product, bolt on the drive components, re-mount its loadout.
  const builtChassis: EntityId[] = [];
  for (const rig of snap.rigs) {
    const chassis = rebuildProduct(world, rig.chassis);
    chassisToRig(world, chassis, rig.x, rig.z);
    const t = world.get(chassis, Transform);
    if (t) t.rotationY = rig.rotationY;
    markOwned(world, chassis);
    for (const m of rig.mounts) {
      const product = rebuildProduct(world, m.product);
      placeProductInWorld(world, product, rig.x, rig.z);
      mountPart(world, product, chassis, m.col, m.row, m.yaw);
      if (m.storageAmount !== undefined) {
        const storage = world.get(product, Storage);
        if (storage) storage.amount = m.storageAmount;
      }
    }
    builtChassis.push(chassis);
  }
  if (builtChassis.length > 0) {
    setActiveRig(world, builtChassis[Math.min(snap.activeRigIndex, builtChassis.length - 1)]!);
  }

  // World content — piles still standing, camps still guarded, stumps already healed/healing.
  for (const s of snap.sites) {
    if (s.type === 'pile') spawnScrapPileFromSave(world, s);
    else if (s.type === 'camp') spawnCampFromSave(world, s);
    else spawnStumpFromSave(world, s);
  }
}
