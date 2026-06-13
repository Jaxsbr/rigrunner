import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { Collider } from '@common/components/collider';
import { Solid } from '@common/components/solid';
import { Part } from '@common/components/part';
import { Mount } from '@common/components/mount';
import { RestorableSite } from '@common/components/restorable-site';
import { ReclaimerWorking } from '@common/components/reclaimer-working';
import { reclaimerHeadPartId } from '@common/sim/assembly';
import { facingWithinFov } from '@common/sim/fov';
import { Healable } from './healable';

/**
 * The restoration interaction: the capability-gated, hold-to-grow heal that turns a cleared-site stump
 * into a young tree. Scrap's rummage sibling, the same grammar — only the tool, the target, and the
 * payoff differ. Two responsibilities, run each frame:
 *   - ensure every `RestorableSite` (a cleared pile's or camp's stump) carries a `Healable`, then
 *     recompute each one's `active` gate: the rig in reach AND carrying a Reclaimer whose head is the
 *     STUMP-HEALER aimed at the stump within an FOV AND the stump not yet fully grown.
 *   - turn "the work key held over an active stump" into the felt beat: mark the healer Reclaimer
 *     `ReclaimerWorking` (the arm deploys + animates, exactly like digging) and advance the stump's
 *     `growth` toward 1, where the tree-grower poses a tree rising out of it.
 *
 * Pure over the World apart from the mutations it IS (adding `Healable`; the gate flag; the growth;
 * `ReclaimerWorking`), so it runs and tests headless. The bucket↔healer head swap keeps this and scrap's
 * rummage mutually exclusive on any one arm (a Reclaimer has a single head), so only one ever drives the
 * shared `ReclaimerWorking` marker — no contention.
 */

/** Metres the rig must reach to heal (circle-vs-circle, like the scrap pile). Exported so the proximity
 *  ring (`overlays.healDiscs`) draws at exactly the gate's reach — one source, so the ring can't lie. */
export const HEAL_RADIUS = 4.0;
const HEAL_FOV = (120 * Math.PI) / 180;   // the arm must have the stump within this cone (full angle)
const GROW_DURATION = 6.0;                // seconds of holding to grow a stump fully — a weighty "I grew a tree"
// The grown tree's solid footprint (trunk + a little): once grown you can't drive through the very thing
// you restored. Tunable.
const TREE_SOLID_RADIUS = 0.8;

/** The HEALING Reclaimer mounted on `rig` (a Reclaimer whose head is the stump-healer), or null. */
export function mountedHealer(world: World, rig: EntityId): EntityId | null {
  for (const p of world.query(Part, Mount, Transform)) {
    if (world.get(p, Mount)!.rig === rig && world.get(p, Part)!.kind === 'reclaimer'
        && reclaimerHeadPartId(world, p) === 'stump-healer') return p;
  }
  return null;
}

/**
 * Recompute every healable stump's gate and run the hold-to-grow beat. `working` is the work key held this
 * frame; `dt` advances the growth. Returns the stump being grown this frame (for tests/feedback), or null.
 */
export function restorationSystem(world: World, rig: EntityId, working: boolean, dt: number): EntityId | null {
  // Every cleared site becomes healable. Tagging one that is still rising out of the soil is fine: the
  // growing tree is parented under the stump's render object, so it rides the same rise — stump and tree
  // emerge together, never a tree floating above a half-buried stump.
  for (const s of world.query(RestorableSite, Transform)) {
    if (!world.has(s, Healable)) world.add(s, Healable, { growth: 0, active: false });
  }

  // A fully-grown stump is a tree the rig can no longer drive through — it gains the same Solid footprint
  // the other structures carry, once. Driven by `growth >= 1` (not a one-frame transition), so it covers
  // both finishing a grow this frame AND a save reloaded already-grown (growth restored to 1) — both pick
  // up their Solid on the first tick.
  for (const s of world.query(Healable)) {
    if (world.get(s, Healable)!.growth >= 1 && !world.has(s, Solid)) {
      if (!world.has(s, Collider)) world.add(s, Collider, { radius: TREE_SOLID_RADIUS });
      world.add(s, Solid, true);
    }
  }

  const rigT = world.get(rig, Transform);
  const rigR = world.get(rig, Collider)?.radius ?? 0;
  const healer = rigT ? mountedHealer(world, rig) : null;
  const armT = healer ? world.get(healer, Transform)! : null;

  // The gate per stump: in reach + the healer arm aimed at it + not yet fully grown.
  for (const s of world.query(Healable, Transform)) {
    const h = world.get(s, Healable)!;
    if (!rigT || !armT || h.growth >= 1) {
      h.active = false;
      continue;
    }
    const st = world.get(s, Transform)!;
    const inRange = Math.hypot(st.x - rigT.x, st.z - rigT.z) <= HEAL_RADIUS + rigR;
    h.active = inRange && facingWithinFov(armT.x, armT.z, armT.rotationY, st.x, st.z, HEAL_FOV);
  }

  // The stump being worked: the first active one (zones don't overlap, so at most one is in play).
  let target: EntityId | null = null;
  for (const s of world.query(Healable)) {
    if (world.get(s, Healable)!.active) { target = s; break; }
  }

  const healing = working && target !== null;

  // Drive the arm's work state through the healer Reclaimer (the render layer reads ReclaimerWorking).
  if (healer !== null) {
    if (healing && !world.has(healer, ReclaimerWorking)) world.add(healer, ReclaimerWorking, { since: 0 });
    else if (!healing && world.has(healer, ReclaimerWorking)) world.remove(healer, ReclaimerWorking);
  }

  if (healing && target !== null) {
    const h = world.get(target, Healable)!;
    h.growth = Math.min(1, h.growth + dt / GROW_DURATION);
    if (h.growth >= 1) {
      // Fully grown this frame: drop the gate (prompt/disc off) and stop the arm at once, the way the
      // rummage stops the dig on an emptied pile — there's nothing left to work.
      h.active = false;
      if (healer !== null && world.has(healer, ReclaimerWorking)) world.remove(healer, ReclaimerWorking);
    }
    return target;
  }
  return null;
}
