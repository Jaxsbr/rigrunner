import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { LootDrop } from '@common/components/loot-drop';
import { Health } from '@common/components/health';
import { Camp } from './camp';
import { Enemy } from './enemy';
import { RestorableSite } from './restorable-site';
import { campLevel } from './camp-levels';
import { rollCampLootForOutcome, campLootTable } from './camp-loot';
import { disarmDamage, type DisarmGrade } from './disarm';

/** Any guard still alive that points at this camp? Drives the all-cleared gate. */
function hasLivingGuards(world: World, camp: EntityId): boolean {
  for (const e of world.query(Enemy)) {
    if (world.get(e, Enemy)!.camp === camp) return true;
  }
  return false;
}

/**
 * Drive each camp's state machine (`@features/camps`):
 *   `GUARDED` → (last guard dies) → `DISARMABLE` → (player disarms the trap) → `CLEARED`.
 *
 * This system only owns the first transition — a camp becomes `DISARMABLE` the frame its last guard
 * falls — and then waits. The second transition is the player's: parking a rig with a mounted trap arm
 * in range and solving the timing puzzle (`disarm-overlay.ts`), which calls `resolveDisarm` below. There
 * is no auto-disarm: a camp with no trap arm to disarm it simply stays `DISARMABLE`.
 */
export function campSystem(world: World): void {
  for (const c of world.query(Camp)) {
    const camp = world.get(c, Camp)!;
    if (camp.state === 'guarded' && !hasLivingGuards(world, c)) {
      camp.state = 'disarmable';
    }
  }
}

/** The outcome of a resolved disarm — the grade and the rig damage it actually dealt (for the toast). */
export interface DisarmResult {
  grade: DisarmGrade;
  damage: number;
}

/**
 * Resolve a player's disarm attempt on a `DISARMABLE` camp — the second half of the camp's state
 * machine, called by the disarm overlay when the timing puzzle finishes. ALL three outcomes clear the
 * camp (the trap is dealt with either way); they differ only in loot + rig damage (spec §5):
 *   - loot is rolled `rollCampLootForOutcome` (success = full, partial = common + half scrap, fail = none)
 *     and queued as a `LootDrop` for the loot overlay to reveal + grant (skipped entirely on a fail);
 *   - the restoration handoff (`RestorableSite`) is emitted regardless — a botched disarm still clears
 *     the camp, and the world heals the site all the same;
 *   - a botched disarm damages the rig (`disarmDamage`): always on a fail, by chance on a partial.
 *
 * `rng` is injected so the payout + damage rolls are testable; it defaults to `Math.random`. Drawing
 * order is loot (scrap, tiers) then the partial damage chance. A camp that isn't `DISARMABLE` is a
 * no-op (guards against a double-resolve), returning zero damage.
 */
export function resolveDisarm(
  world: World,
  c: EntityId,
  rig: EntityId,
  grade: DisarmGrade,
  rng: () => number = Math.random,
): DisarmResult {
  const camp = world.get(c, Camp);
  if (!camp || camp.state !== 'disarmable') return { grade, damage: 0 };

  // Loot for the overlay — gated by the outcome; null (fail) queues nothing. No scattered scrap (a camp
  // isn't a heap); the wallet scrap is banked on collect.
  const roll = rollCampLootForOutcome(campLootTable(campLevel(camp.level).lootId), grade, rng);
  if (roll) {
    const drop = world.createEntity();
    world.add(drop, LootDrop, { scrap: 0, walletScrap: roll.walletScrap, finds: roll.finds });
  }

  // The restoration handoff — a site the world can later heal. Nothing consumes it yet (the seam).
  const ct = world.get(c, Transform);
  const site = world.createEntity();
  world.add(site, RestorableSite, {
    x: ct?.x ?? 0,
    z: ct?.z ?? 0,
    kind: 'camp',
    sourceLevel: camp.level,
  });

  // A botched disarm springs the trap on the rig.
  const damage = disarmDamage(grade, rng);
  if (damage > 0) {
    const hp = world.get(rig, Health);
    if (hp) hp.current = Math.max(0, hp.current - damage);
  }

  camp.state = 'cleared';
  return { grade, damage };
}
