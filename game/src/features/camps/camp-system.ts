import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { Renderable } from '@common/components/renderable';
import { LootDrop } from '@common/components/loot-drop';
import { Health } from '@common/components/health';
import { Camp } from './camp';
import { CampDecor } from './camp-decor';
import { Enemy } from './enemy';
import { RestorableSite } from './restorable-site';
import { campLevel } from './camp-levels';
import { rollCampLootForOutcome, campLootTable } from './camp-loot';
import { disarmDamage, type DisarmGrade } from './disarm';

/**
 * How long a cleared camp takes to dissolve: its structures + debris sink and shrink into the ground,
 * the restorable stump rises in their place, and the decor entities are then despawned. ~9 s, co-timed
 * with the stains' fade so the whole site cleans up together. Build-time tuning.
 */
export const TEARDOWN_DURATION = 9;

/** Any guard still alive that points at this camp? Drives the all-cleared gate. */
function hasLivingGuards(world: World, camp: EntityId): boolean {
  for (const e of world.query(Enemy)) {
    if (world.get(e, Enemy)!.camp === camp) return true;
  }
  return false;
}

/**
 * Drive each camp's state machine (`@features/camps`):
 *   `GUARDED` → (last guard dies) → `DISARMABLE` → (player disarms the trap) → `CLEARED` → (teardown).
 *
 * This system owns the first transition — a camp becomes `DISARMABLE` the frame its last guard falls —
 * and then waits. The second transition is the player's: parking a rig with a mounted trap arm in range
 * and solving the timing puzzle (`disarm-overlay.ts`), which calls `resolveDisarm` below (no auto-disarm:
 * a camp with no trap arm simply stays `DISARMABLE`). Once `CLEARED`, this also runs the teardown clock:
 * it advances `tornDown` (the view sinks the structures/debris + rises the stump off it) and despawns the
 * decor entities when the dissolve has fully played. The camp entity itself persists — the fading stains
 * and the lasting stump read off it.
 */
export function campSystem(world: World, dt: number): void {
  for (const c of world.query(Camp)) {
    const camp = world.get(c, Camp)!;
    if (camp.state === 'guarded' && !hasLivingGuards(world, c)) {
      camp.state = 'disarmable';
    } else if (camp.state === 'cleared' && camp.tornDown < 1) {
      camp.tornDown = Math.min(1, camp.tornDown + dt / TEARDOWN_DURATION);
      if (camp.tornDown >= 1) despawnDecor(world, c);
    }
  }
}

/** Drop a cleared camp's TRANSIENT decor (tent, cache, debris) once the dissolve has fully played — but
 *  spare the lasting stump (the one decor that is also a `RestorableSite`), which persists as the scar.
 *  Collected first, then destroyed, so it's safe regardless of how the query iterates. */
function despawnDecor(world: World, camp: EntityId): void {
  const doomed: EntityId[] = [];
  for (const d of world.query(CampDecor)) {
    if (world.get(d, CampDecor)!.camp === camp && !world.has(d, RestorableSite)) doomed.push(d);
  }
  for (const d of doomed) world.destroyEntity(d);
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

  // The restoration handoff — a site the world can later heal. Nothing consumes the marker yet (the
  // seam), but it is now VISIBLE: a stump on scarred soil at the camp centre that RISES out of the
  // ground as the structures sink (the teardown animator), and persists as the scar of the cleared camp.
  // Its yaw is cosmetic (Math.random, not the payout `rng`) so it never perturbs the loot/damage draws.
  const ct = world.get(c, Transform);
  const sx = ct?.x ?? 0;
  const sz = ct?.z ?? 0;
  const site = world.createEntity();
  world.add(site, RestorableSite, { x: sx, z: sz, kind: 'camp', sourceLevel: camp.level });
  world.add(site, Transform, { x: sx, z: sz, y: 0, rotationY: Math.random() * Math.PI * 2 });
  world.add(site, Renderable, { shape: 'model', assetId: 'camp-stump' });
  // Tag it with the camp so it shares the teardown clock (it RISES as the structures sink). It is spared
  // `despawnDecor` because it's also a `RestorableSite` — the one piece of decor that outlives the camp.
  world.add(site, CampDecor, { camp: c });

  // A botched disarm springs the trap on the rig.
  const damage = disarmDamage(grade, rng);
  if (damage > 0) {
    const hp = world.get(rig, Health);
    if (hp) hp.current = Math.max(0, hp.current - damage);
  }

  camp.state = 'cleared';
  return { grade, damage };
}
