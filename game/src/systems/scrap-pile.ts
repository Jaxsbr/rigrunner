import type { World } from '../core/world';
import type { EntityId } from '../core/types';
import { Transform } from '../components/transform';
import { Collider } from '../components/collider';
import { Part } from '../components/part';
import { Mount } from '../components/mount';
import { ScrapPile } from '../components/scrap-pile';
import { Digging } from '../components/digging';
import { LootDrop } from '../components/loot-drop';
import { ClearedGround } from '../components/cleared-ground';
import { scatterScrapAround } from '../content/scrap';
import { rollLoot, rollScrapBurst } from '../content/loot-table';

/**
 * The scrap-pile interaction: the capability-gated, hold-to-work rummage (Option C / PR4).
 *
 * Two pure systems run over the World each frame:
 *   - scrapPileSystem  recomputes every pile's `active` gate (the rig in range AND carrying a
 *     mounted Reclaimer AND aiming its arm at the pile within the pile's FOV).
 *   - scrapRummageSystem turns "the work key is held over an active pile" into the felt beat: it
 *     marks the Reclaimer as Digging (the render layer deploys the arm), drains the pile a WAVE at
 *     a time, and bursts loose scrap around the rig for M1's drive-over collection to sweep up.
 *
 * Both are pure over the World apart from the mutations they ARE (the gate flag; Digging; the pile's
 * remaining/worked; the spawned scrap; destroying an emptied pile), so they run and test headless.
 */

// Hold-to-work tuning. A wave is one "bite" of the heap: it drops `remaining` by one and scatters a
// random handful of scrap (the per-wave count comes from the loot table's scrap tier, so a pile's
// total scrap is random). PILE_WAVES bites at WAVE_INTERVAL each set how long a full rummage takes.
const WAVE_INTERVAL = 0.45;      // seconds of holding between waves
const BURST_MIN_R = 1.8;         // inner radius scrap scatters to around the rig (some auto-collected)
const BURST_MAX_R = 3.5;         // outer radius (these you nudge the rig over to sweep up)

/** The Reclaimer part mounted on `rig`, or null if the rig carries none. */
function mountedReclaimer(world: World, rig: EntityId): EntityId | null {
  for (const p of world.query(Part, Mount, Transform)) {
    if (world.get(p, Mount)!.rig === rig && world.get(p, Part)!.kind === 'reclaimer') return p;
  }
  return null;
}

/**
 * Does an arm facing `armRotationY` at (armX, armZ) have the point (px, pz) within its `fov`?
 * The arm's front is local −Z — direction (−sin θ, −cos θ) at yaw θ (the convention shared with
 * movement and MountFacing). We compare the angle between that front and the direction to the point
 * against half the full FOV via a dot product, so a 120° FOV admits anything up to 60° off-axis.
 */
export function facingWithinFov(
  armX: number,
  armZ: number,
  armRotationY: number,
  px: number,
  pz: number,
  fov: number,
): boolean {
  const toX = px - armX;
  const toZ = pz - armZ;
  const len = Math.hypot(toX, toZ);
  if (len === 0) return true; // standing on it — trivially "facing"
  const fwdX = -Math.sin(armRotationY);
  const fwdZ = -Math.cos(armRotationY);
  const cosTo = (fwdX * toX + fwdZ * toZ) / len; // both fwd and to/len are unit-length
  return cosTo >= Math.cos(fov / 2);
}

/**
 * Recompute each pile's `active` gate from the rig's pose and its mounted Reclaimer. A pile lights up
 * only when the rig's collider reaches the pile's zone (circle-vs-circle, like the workshop) AND a
 * Reclaimer is mounted AND its arm is aimed at the pile within the FOV. No rig / no Reclaimer →
 * dormant. Reads the Reclaimer part's own Transform (ridden to its deck cell by the mounting system)
 * for both the aim apex and the facing, so where the arm sits and points is what's tested.
 */
export function scrapPileSystem(world: World, rig: EntityId): void {
  const rigT = world.get(rig, Transform);
  const rigR = world.get(rig, Collider)?.radius ?? 0;
  const reclaimer = rigT ? mountedReclaimer(world, rig) : null;
  const armT = reclaimer ? world.get(reclaimer, Transform)! : null;

  for (const p of world.query(ScrapPile, Transform)) {
    const pile = world.get(p, ScrapPile)!;
    if (!rigT || !armT) {
      pile.active = false;
      continue;
    }
    const pt = world.get(p, Transform)!;
    const inRange = Math.hypot(pt.x - rigT.x, pt.z - rigT.z) <= pile.radius + rigR;
    pile.active = inRange && facingWithinFov(armT.x, armT.z, armT.rotationY, pt.x, pt.z, pile.fov);
  }
}

/**
 * The hold-to-work beat. With `working` true (the work key held) and a pile `active`, the rig's
 * Reclaimer is marked Digging (its arm deploys + animates) and the pile drains a wave at a time,
 * each wave bursting loose scrap around the rig. When `working` is false or no pile is active, the
 * Reclaimer stops digging and partial wave progress resets.
 *
 * When a pile empties it is destroyed (the "cleared ground"), and on the way out it pays out PR5's
 * loot: the burst it scattered wave-by-wave was the scrap, and an empty-roll of the loot table
 * (`rollLoot`) adds any hidden finds. Both are queued on a single `LootDrop` (always created — the
 * popup always reports the scrap haul) for the loot UI to reveal and grant. It also leaves a
 * `ClearedGround` marker where it stood — the restoration seam (nothing consumes it yet). `rng` is
 * injected so the burst counts + roll are testable; it defaults to `Math.random`.
 *
 * Returns the scrap ids spawned this frame (for tests / feedback).
 */
export function scrapRummageSystem(
  world: World,
  rig: EntityId,
  working: boolean,
  dt: number,
  rng: () => number = Math.random,
): EntityId[] {
  const reclaimer = mountedReclaimer(world, rig);

  // The pile being worked: the first active one (zones don't overlap, so at most one is in play).
  let target: EntityId | null = null;
  for (const p of world.query(ScrapPile)) {
    if (world.get(p, ScrapPile)!.active) { target = p; break; }
  }

  const digging = working && target !== null;

  // Drive the arm's dig state through the Reclaimer (the render layer reads Digging).
  if (reclaimer !== null) {
    if (digging && !world.has(reclaimer, Digging)) world.add(reclaimer, Digging, { since: 0 });
    else if (!digging && world.has(reclaimer, Digging)) world.remove(reclaimer, Digging);
  }

  const spawned: EntityId[] = [];
  for (const p of world.query(ScrapPile)) {
    const pile = world.get(p, ScrapPile)!;
    if (p !== target || !digging) {
      pile.worked = 0; // not being worked → drop any partial wave progress
      continue;
    }
    const rigT = world.get(rig, Transform)!;
    pile.worked += dt;
    // Bank as many whole waves as the accrued time covers (handles a long frame), each draining the
    // heap and flinging scrap, until the time runs out or the pile is empty.
    while (pile.worked >= WAVE_INTERVAL && pile.remaining > 0) {
      pile.worked -= WAVE_INTERVAL;
      pile.remaining -= 1;
      const burst = rollScrapBurst(rng); // random pieces this wave (the pile's scrap is random)
      pile.scrapScattered += burst;
      spawned.push(...scatterScrapAround(world, rigT.x, rigT.z, burst, BURST_MIN_R, BURST_MAX_R));
    }
    if (pile.remaining <= 0) {
      // Emptied: stop the dig (nothing left to work), pay out the loot, and clear the ground.
      if (reclaimer !== null && world.has(reclaimer, Digging)) world.remove(reclaimer, Digging);
      const pt = world.get(p, Transform)!;
      // Empty-roll the loot table and queue a LootDrop for the loot UI. ALWAYS created: a pile always
      // gave scrap (the burst), so the popup always reports the haul; `finds` carries any non-scrap
      // bonus (often empty at the 25% sub-part chance) for the UI to reveal + grant on collect.
      const drop = world.createEntity();
      world.add(drop, LootDrop, { scrap: pile.scrapScattered, finds: rollLoot(rng) });
      // The ground-cleared signal: a marker where the pile stood, for the future restoration seam.
      const marker = world.createEntity();
      world.add(marker, ClearedGround, { x: pt.x, z: pt.z });
      world.destroyEntity(p);
    }
  }

  return spawned;
}
