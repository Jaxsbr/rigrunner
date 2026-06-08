import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { Collider } from '@common/components/collider';
import { Part } from '@common/components/part';
import { Mount } from '@common/components/mount';
import { Renderable } from '@common/components/renderable';
import { ScrapPile } from '@features/scrap/scrap-pile';
import { Digging } from '@features/scrap/digging';
import { LootDrop } from '@common/components/loot-drop';
import { RestorableSite } from '@common/components/restorable-site';
import { Dissolving, DISSOLVE_DURATION } from '@features/scrap/dissolving';
import { scatterScrapAround } from '@features/scrap/scrap';
import { rollLoot, rollScrapBurst } from '@features/scrap/loot-table';
import { facingWithinFov } from '@common/sim/fov';

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
    if (world.has(p, Dissolving)) {
      pile.active = false; // a reclaimed pile mid-dissolve is no longer workable
      continue;
    }
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
 * When a pile empties it pays out PR5's loot and begins its reclaim dissolve: the burst it scattered
 * wave-by-wave was the scrap, and an empty-roll of the loot table (`rollLoot`) adds any hidden finds —
 * both queued on a single `LootDrop` (always created — the popup always reports the scrap haul) for the
 * loot UI to reveal and grant. Rather than vanishing, the pile gains a `Dissolving` clock and spawns a
 * stump (`spawnPileStump`) that rises as the heap sinks; `pileClearSystem` finishes the handoff. `rng`
 * is injected so the burst counts + roll are testable; it defaults to `Math.random`.
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
    if (pile.remaining <= 0 && !world.has(p, Dissolving)) {
      // Emptied: stop the dig (nothing left to work) and pay out the loot, then begin the reclaim
      // DISSOLVE instead of vanishing — the heap sinks + shrinks while a stump rises in its place
      // (`pileClearSystem` advances the clock; the clear animator poses both). The pile entity lingers
      // until the dissolve completes, so its pollution stain holds through the sink and the gate skips it.
      if (reclaimer !== null && world.has(reclaimer, Digging)) world.remove(reclaimer, Digging);
      const pt = world.get(p, Transform)!;
      // Empty-roll the loot table and queue a LootDrop for the loot UI. ALWAYS created: a pile always
      // gave scrap (the burst), so the popup always reports the haul; `finds` carries any non-scrap
      // bonus (empty about half the time at the 50% sub-part chance) for the UI to reveal + grant.
      const drop = world.createEntity();
      world.add(drop, LootDrop, { scrap: pile.scrapScattered, finds: rollLoot(rng) });
      world.add(p, Dissolving, { elapsed: 0 });
      spawnPileStump(world, pt.x, pt.z, rng);
    }
  }

  return spawned;
}

/**
 * Advance the reclaim dissolve on every `Dissolving` entity — the emptied heap and its rising stump,
 * which share one clock. When the clock completes, the heap (a `ScrapPile`) is DESTROYED (fully sunk —
 * gone) and the stump (a `RestorableSite`) SHEDS `Dissolving` so it holds at its risen rest. Runs with
 * the sim (frozen behind the loot popup); the clear animator poses each off `elapsed` every frame.
 */
export function pileClearSystem(world: World, dt: number): void {
  for (const e of [...world.query(Dissolving)]) {
    const d = world.get(e, Dissolving)!;
    d.elapsed += dt;
    if (d.elapsed < DISSOLVE_DURATION) continue;
    if (world.has(e, ScrapPile)) world.destroyEntity(e); // the heap has fully sunk — gone
    else world.remove(e, Dissolving);                    // the stump has fully risen — holds at rest
  }
}

// The lasting scar a reclaimed pile leaves: a stump-with-branch-and-leaves (the `camp-sprout` model) that
// rises out of the soil on the dissolve clock. It carries `RestorableSite{kind:'scrap'}` — the SAME marker
// a cleared camp emits — so a future world-restoration treats cleared piles and camps through one seam.
const STUMP_ASSET = 'camp-sprout';

/** Spawn the reclaim stump at (x,z): a `RestorableSite` prop sharing the heap's dissolve clock so the
 *  clear animator rises it from underground as the heap sinks. `rng` only picks its resting yaw. */
function spawnPileStump(world: World, x: number, z: number, rng: () => number): EntityId {
  const e = world.createEntity();
  world.add(e, Transform, { x, z, y: 0, rotationY: rng() * Math.PI * 2 });
  world.add(e, Renderable, { shape: 'model', assetId: STUMP_ASSET });
  world.add(e, RestorableSite, { x, z, kind: 'scrap', sourceLevel: 0 });
  world.add(e, Dissolving, { elapsed: 0 });
  return e;
}
