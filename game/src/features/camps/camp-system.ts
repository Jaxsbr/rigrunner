import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { LootDrop } from '@common/components/loot-drop';
import { Camp } from './camp';
import { Enemy } from './enemy';
import { RestorableSite } from './restorable-site';
import { campLevel } from './camp-levels';
import { rollCampLoot, campLootTable } from './camp-loot';

/** Any guard still alive that points at this camp? Drives the all-cleared gate. */
function hasLivingGuards(world: World, camp: EntityId): boolean {
  for (const e of world.query(Enemy)) {
    if (world.get(e, Enemy)!.camp === camp) return true;
  }
  return false;
}

/**
 * Drive each camp's state machine and pay out on clear (`@features/camps`):
 *   `GUARDED` → (last guard dies) → `DISARMABLE` → (disarm) → `CLEARED`.
 *
 * Phase 1 stubs disarm to auto-success, so a camp passes straight through `DISARMABLE` to `CLEARED` the
 * frame its last guard falls. On `CLEARED` it pays out ONCE: a `LootDrop` for the loot overlay to reveal
 * + grant (wallet scrap banked, sub-parts to inventory), and a `RestorableSite` marker the world-
 * restoration work will later subscribe to. The camp entity lives on (its stains fade, its site
 * persists). `rng` is injected so the payout roll is testable; it defaults to `Math.random`.
 */
export function campSystem(world: World, rng: () => number = Math.random): void {
  for (const c of world.query(Camp)) {
    const camp = world.get(c, Camp)!;
    if (camp.state === 'cleared') continue;

    if (camp.state === 'guarded' && !hasLivingGuards(world, c)) {
      camp.state = 'disarmable';
    }
    // Phase 1: disarm auto-succeeds the instant the camp becomes disarmable (no trap arm yet).
    if (camp.state === 'disarmable') {
      clearCamp(world, c, rng);
      camp.state = 'cleared';
    }
  }
}

/** Pay out a cleared camp once: queue its loot and emit its restorable site. */
function clearCamp(world: World, c: EntityId, rng: () => number): void {
  const camp = world.get(c, Camp)!;
  const ct = world.get(c, Transform);
  const roll = rollCampLoot(campLootTable(campLevel(camp.level).lootId), rng);

  // The payout for the loot overlay — no scattered scrap (a camp isn't a heap); scrap is banked.
  const drop = world.createEntity();
  world.add(drop, LootDrop, { scrap: 0, walletScrap: roll.walletScrap, finds: roll.finds });

  // The restoration handoff — a site the world can later heal. Nothing consumes it yet (the seam).
  const site = world.createEntity();
  world.add(site, RestorableSite, {
    x: ct?.x ?? 0,
    z: ct?.z ?? 0,
    kind: 'camp',
    sourceLevel: camp.level,
  });
}
