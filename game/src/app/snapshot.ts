import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { Storage } from '@common/components/storage';
import { LootDrop } from '@common/components/loot-drop';
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
import { workshopEntity } from '@features/workshop/staging';
import { getBench, loadRecipe, placeOnBench } from '@features/workshop/bench';
import { recipeById } from '@common/parts/recipes';
import { ownedChassis, getActiveRig, markOwned, setActiveRig } from '@features/chassis/ownership';
import {
  describeScrapPiles,
  spawnScrapPileFromSave,
  describeLooseScrap,
  spawnLooseScrapFromSave,
  type PileSave,
  type LooseScrapSave,
} from '@features/scrap/scrap';
import { describeCamps, spawnCampFromSave, type CampSave } from '@features/camps/camp-spawn';
import { describeStumps, spawnStumpFromSave, type StumpSave } from '@features/restoration/restoration-persistence';

/**
 * The game-state snapshot: capture the durable real-game world to a plain object, and rebuild it. This
 * is the orchestration layer of the **semantic snapshot** persistence model — it sits in the `app/`
 * composition-root tier because it reaches across features (economy · mounting · chassis · workshop ·
 * scrap · camps · restoration) to assemble one save, which a single feature must not do. Each feature
 * owns the description of its OWN durable state (`describeProduct`, `describeScrapPiles`,
 * `describeCamps`, `describeStumps`); this file only folds them together and replays them.
 *
 * A part the player owns can be in exactly one of four places (the conservation invariant `bench.ts` and
 * `staging.ts` spell out), and the save captures all four: mounted on an owned **chassis**, **staged on
 * the workshop deck** (where a full container drains into the wallet — `Mount.rig === workshop`), in a
 * **bench** slot (mid-assembly), or loose in the **inventory**.
 *
 * What's durable (the save) vs reset-on-load:
 *  - **Durable:** banked scrap (wallet), the inventory, every owned chassis + its mounted loadout,
 *    every product staged on the workshop deck, any unbanked scrap sitting in a container (mounted or
 *    staged), the loose-scrap pieces lying in the world (the exact remaining set — not a re-scatter, so
 *    no reload-farm), and the world's content — piles still standing (how dug-down), camps with only
 *    their SURVIVING guards (a killed guard stays dead), stumps already healed (how grown).
 *  - **Reset on load (deliberately):** rig + surviving-guard hit points and boost heat (a reload
 *    repairs/re-posts them — deaths are durable, a half-fought fight is not), products
 *    dropped loose on the ground (a part/kit not on a rig/deck/bench/in inventory), and all
 *    transient/derived state (gate flags, in-flight projectiles, live enemy positions, work timers).
 *
 * Continue does NOT run this through the cold-open seed: the static world (workshop, bench) is laid
 * first by `seedStaticWorld`, then `restoreSnapshot` rebuilds the progress on top.
 */

export const SNAPSHOT_VERSION = 6;

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
  /** Products sitting on the workshop deck (e.g. a container mid-drain) — `Mount.rig === workshop`. */
  staged: MountSave[];
  /** The assembly bench mid-build: the loaded recipe and the parts in its filled slots. */
  bench: BenchSave;
  /** Loose-scrap pieces lying in the world — the exact remaining set (not a re-scatter). */
  looseScrap: LooseScrapSave[];
  /**
   * Loot drops queued but not yet collected (the loot popup was open / pending at save). `LootDrop` is
   * pure data (`finds` are catalog refs, not entities), so it stores verbatim; on restore the loot
   * overlay re-opens it the first frame — a refresh mid-popup never eats the find.
   */
  pendingLoot: LootDrop[];
  sites: SiteSave[];
}

interface BenchSave {
  recipeId: string;
  /** Slot role → the part filling it. Only filled slots are stored; empty ones are implied. */
  slots: Record<string, ItemDescriptor>;
}

/** Describe every product mounted on a platform (a rig's deck, or the workshop deck) by cell + facing. */
function describeMounts(world: World, platform: EntityId): MountSave[] {
  return mountedPartsOn(world, platform).map((m): MountSave => {
    const storage = world.get(m.part, Storage);
    return {
      col: m.col,
      row: m.row,
      yaw: m.yaw,
      product: describeProduct(world, m.part),
      ...(storage ? { storageAmount: storage.amount } : {}),
    };
  });
}

/** Capture the live real-game world to a serializable snapshot. */
export function captureSnapshot(world: World): GameSnapshot {
  const owned = ownedChassis(world);
  const active = getActiveRig(world);
  const workshop = workshopEntity(world);
  return {
    version: SNAPSHOT_VERSION,
    wallet: { scrap: getWallet(world)?.scrap ?? 0 },
    inventory: inventoryItems(world).map((e) => describeItem(world, e)),
    rigs: owned.map((c) => describeRig(world, c)),
    activeRigIndex: active ? Math.max(0, owned.indexOf(active)) : 0,
    staged: workshop !== null ? describeMounts(world, workshop) : [],
    bench: describeBench(world),
    looseScrap: describeLooseScrap(world),
    pendingLoot: world.query(LootDrop).map((e) => {
      const d = world.get(e, LootDrop)!;
      return { scrap: d.scrap, finds: [...d.finds], ...(d.walletScrap !== undefined ? { walletScrap: d.walletScrap } : {}) };
    }),
    sites: [
      ...describeScrapPiles(world).map((p): SiteSave => ({ type: 'pile', ...p })),
      ...describeCamps(world).map((c): SiteSave => ({ type: 'camp', ...c })),
      ...describeStumps(world).map((s): SiteSave => ({ type: 'stump', ...s })),
    ],
  };
}

/** Describe the assembly bench mid-build: its loaded recipe and the parts in its filled slots. */
function describeBench(world: World): BenchSave {
  const bench = getBench(world);
  const slots: Record<string, ItemDescriptor> = {};
  if (!bench) return { recipeId: '', slots };
  for (const [slot, part] of Object.entries(bench.slots)) {
    if (part !== null) slots[slot] = describeItem(world, part);
  }
  return { recipeId: bench.recipeId, slots };
}

function describeRig(world: World, chassis: EntityId): RigSave {
  const t = world.get(chassis, Transform);
  return {
    chassis: describeProduct(world, chassis),
    x: t?.x ?? 0,
    z: t?.z ?? 0,
    rotationY: t?.rotationY ?? 0,
    mounts: describeMounts(world, chassis),
  };
}

/** Rebuild a saved product and mount it on a platform at its cell + facing, restoring any container scrap. */
function mountSavedProduct(world: World, platform: EntityId, m: MountSave, x: number, z: number): void {
  const product = rebuildProduct(world, m.product);
  placeProductInWorld(world, product, x, z);
  mountPart(world, product, platform, m.col, m.row, m.yaw);
  if (m.storageAmount !== undefined) {
    const storage = world.get(product, Storage);
    if (storage) storage.amount = m.storageAmount;
  }
}

/**
 * Rebuild the durable world from a snapshot onto an already-static-seeded world. Order matters: the
 * player store (wallet + inventory) comes first so `addToInventory` has its singleton; then each rig is
 * rebuilt as a chassis product made drivable and re-mounted; then the workshop deck and world content.
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
    for (const m of rig.mounts) mountSavedProduct(world, chassis, m, rig.x, rig.z);
    builtChassis.push(chassis);
  }
  if (builtChassis.length > 0) {
    setActiveRig(world, builtChassis[Math.min(snap.activeRigIndex, builtChassis.length - 1)]!);
  }

  // Workshop deck — re-stage any product that was on it (a container mid-drain banks again from here).
  const workshop = workshopEntity(world); // laid by seedStaticWorld before this runs
  if (workshop !== null) {
    const wt = world.get(workshop, Transform);
    for (const m of snap.staged ?? []) mountSavedProduct(world, workshop, m, wt?.x ?? 0, wt?.z ?? 0);
  }

  // Bench — reload the recipe the player was building and put the parts back in their slots. The bench
  // singleton was laid (empty, on the default recipe) by seedStaticWorld; here we reshape + refill it.
  const recipe = snap.bench ? recipeById(snap.bench.recipeId) : undefined;
  if (getBench(world) && recipe) {
    loadRecipe(world, recipe.id, recipe.slots.map((s) => s.slot));
    for (const [slot, item] of Object.entries(snap.bench.slots)) {
      placeOnBench(world, slot, rebuildItem(world, item));
    }
  }

  // World content — piles still standing, camps still guarded, stumps already healed/healing.
  for (const s of snap.sites) {
    if (s.type === 'pile') spawnScrapPileFromSave(world, s);
    else if (s.type === 'camp') spawnCampFromSave(world, s);
    else spawnStumpFromSave(world, s);
  }

  // Loose-scrap pieces — restored at their exact spots, so the ground keeps whatever you left lying.
  for (const d of snap.looseScrap ?? []) spawnLooseScrapFromSave(world, d);

  // Pending loot drops — the loot overlay re-opens them the first frame, so an uncollected find survives.
  for (const d of snap.pendingLoot ?? []) {
    const e = world.createEntity();
    world.add(e, LootDrop, { scrap: d.scrap, finds: [...d.finds], ...(d.walletScrap !== undefined ? { walletScrap: d.walletScrap } : {}) });
  }
}
