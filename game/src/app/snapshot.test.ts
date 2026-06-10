import { describe, it, expect } from 'vitest';
import { World } from '@core/world';
import { seedStaticWorld, seedNewGameContent } from './scenarios/real-game';
import { captureSnapshot, restoreSnapshot, SNAPSHOT_VERSION } from './snapshot';
import { getWallet } from '@features/economy/wallet';
import { getActiveRig, ownedChassis } from '@features/chassis/ownership';
import { mountedPartsOn } from '@features/mounting/mounting';
import { spawnStumpFromSave } from '@features/restoration/restoration-persistence';
import { ScrapPile } from '@features/scrap/scrap-pile';
import { Camp } from '@features/camps/camp';
import { Healable } from '@features/restoration/healable';
import { RestorableSite } from '@common/components/restorable-site';
import { Storage } from '@common/components/storage';

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
});
