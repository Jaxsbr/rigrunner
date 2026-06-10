import { describe, it, expect } from 'vitest';
import { World } from '@core/world';
import { seedStaticWorld, seedNewGameContent } from './scenarios/real-game';
import { captureSnapshot, restoreSnapshot, SNAPSHOT_VERSION } from './snapshot';
import { getWallet } from '@features/economy/wallet';
import { getActiveRig, ownedChassis, setActiveRig } from '@features/chassis/ownership';
import { mountedPartsOn } from '@features/mounting/mounting';
import { deployChassis } from '@features/mounting/rig';
import { chassisParts } from '@features/chassis/chassis';
import { spawnStumpFromSave } from '@features/restoration/restoration-persistence';
import { ScrapPile } from '@features/scrap/scrap-pile';
import { Camp } from '@features/camps/camp';
import { Healable } from '@features/restoration/healable';
import { RestorableSite } from '@common/components/restorable-site';
import { Storage } from '@common/components/storage';
import { workshopEntity, stagedProducts, stageProduct } from '@features/workshop/staging';
import { getBench, loadRecipe, placeOnBench } from '@features/workshop/bench';
import { composeProduct } from '@common/sim/assembly';
import { STORAGE_RECIPE, chassisRecipeForSize } from '@common/parts/recipes';
import { partDef, spawnCatalogPart } from '@common/parts/parts-catalog';

/**
 * The semantic-snapshot save round-trip (Phase 0). The localStorage layer no-ops headless, so these
 * exercise the capture/restore seam directly — proving that banked + unbanked scrap, the rig and its
 * mounted loadout, the standing world, and a healed stump all survive a capture → rebuild. That is what
 * makes Continue mean "the world remembers what I did", not just "my scrap total".
 */
function seedRealGame(): World {
  const w = new World();
  seedStaticWorld(w);
  seedNewGameContent(w);
  return w;
}

function continueFrom(snap: ReturnType<typeof captureSnapshot>): World {
  const w = new World();
  seedStaticWorld(w);
  restoreSnapshot(w, snap);
  return w;
}

describe('game snapshot round-trip', () => {
  it('restores the wallet and the active rig with its mounted loadout', () => {
    const a = seedRealGame();
    getWallet(a)!.scrap = 250;

    const snap = captureSnapshot(a);
    expect(snap.version).toBe(SNAPSHOT_VERSION);

    const b = continueFrom(snap);
    expect(getWallet(b)!.scrap).toBe(250);
    expect(ownedChassis(b).length).toBe(1);
    const rig = getActiveRig(b);
    expect(rig).not.toBeNull();
    expect(mountedPartsOn(b, rig!).length).toBe(2); // the starter's engine + storage
  });

  it('restores unbanked container scrap, a partly-dug pile, the camp, and stump growth', () => {
    const a = seedRealGame();

    // Dig one pile down, bank some scrap into the mounted container, and grow a stump halfway.
    const firstPile = a.query(ScrapPile)[0]!;
    a.get(firstPile, ScrapPile)!.remaining = 3;
    const storageMount = mountedPartsOn(a, getActiveRig(a)!).find((m) => a.get(m.part, Storage));
    a.get(storageMount!.part, Storage)!.amount = 2;
    spawnStumpFromSave(a, { x: 5, z: 5, rotationY: 0, kind: 'scrap', sourceLevel: 0, growth: 0.5 });

    const b = continueFrom(captureSnapshot(a));

    // The world content: three piles still standing (one dug to 3), the camp, and the healed stump.
    expect(b.query(ScrapPile).length).toBe(3);
    expect(b.query(ScrapPile).map((p) => b.get(p, ScrapPile)!.remaining)).toContain(3);
    expect(b.query(Camp).length).toBe(1);

    const stumps = b.query(RestorableSite);
    expect(stumps.length).toBe(1);
    expect(b.get(stumps[0]!, Healable)?.growth).toBe(0.5);

    // Unbanked scrap sitting in the mounted container survives the reload.
    const storageB = mountedPartsOn(b, getActiveRig(b)!).map((m) => b.get(m.part, Storage)).find(Boolean);
    expect(storageB!.amount).toBe(2);
  });

  it('restores a container staged on the workshop deck mid-drain (with its scrap)', () => {
    const a = seedRealGame();
    // Stage a half-full container on the workshop deck — the state the workshop drain banks from, and
    // the one a refresh-then-Continue used to drop (it's mounted on the workshop, not an owned chassis).
    const workshopA = workshopEntity(a)!;
    const container = composeProduct(a, STORAGE_RECIPE, ['container-shell', 'container-rim'].map((id) => partDef(id)!));
    stageProduct(a, container, workshopA, 0, 0);
    a.get(container, Storage)!.amount = 3;

    const b = continueFrom(captureSnapshot(a));

    const staged = stagedProducts(b, workshopEntity(b)!);
    expect(staged.length).toBe(1);
    expect(b.get(staged[0]!, Storage)?.amount).toBe(3);
  });

  it('restores parts left mid-assembly in bench slots', () => {
    const a = seedRealGame();
    // A part dropped into a bench slot mid-build — owned, but in neither rig, deck, nor inventory.
    const shell = spawnCatalogPart(a, partDef('container-shell')!);
    loadRecipe(a, STORAGE_RECIPE.id, STORAGE_RECIPE.slots.map((s) => s.slot));
    placeOnBench(a, partDef('container-shell')!.slot, shell);

    const b = continueFrom(captureSnapshot(a));

    const bench = getBench(b)!;
    expect(bench.recipeId).toBe(STORAGE_RECIPE.id);
    expect(bench.slots[partDef('container-shell')!.slot]).not.toBeNull();
  });

  it('restores multiple owned rigs, each loadout, and which one was active', () => {
    const a = seedRealGame(); // 1 owned rig (the starter, engine + storage), active
    // Deploy a second, bare chassis and switch control to it.
    const kit = composeProduct(a, chassisRecipeForSize('1x3'), chassisParts('1x3'));
    deployChassis(a, kit, 20, 5);
    setActiveRig(a, ownedChassis(a)[1]!);

    const b = continueFrom(captureSnapshot(a));

    const owned = ownedChassis(b);
    expect(owned.length).toBe(2);
    expect(getActiveRig(b)).toBe(owned[1]); // the active selection round-trips
    // Loadouts are per-rig: the starter keeps its engine + storage, the deployed one stays bare.
    expect(mountedPartsOn(b, owned[0]).length).toBe(2);
    expect(mountedPartsOn(b, owned[1]).length).toBe(0);
  });
});
