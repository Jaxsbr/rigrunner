import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Boost, HEAT_MAX } from '@common/components/boost';
import { Assembly } from '@common/components/assembly';
import { DriveControl } from '@features/drive/drive-control';
import { mountedEngines } from '@features/engine/engine';
import type { EnergyType } from '@shared/part-identity';

/**
 * The boost mechanic: a held-Shift overdrive on a continuous heat gauge. This feature owns the heat
 * logic and the per-engine-type delivery profiles; the surge it writes onto each rig's `Boost`
 * component is applied by the movement system (`@features/drive`). The `Boost` component itself lives
 * in `@common/components` so that one-way edge (boost → drive) carries no cycle.
 *
 * Each type's boost covers its OWN weakness rather than amplifying its strength:
 *   - steam (strong-short): a big surge that heats FAST — a violent burst that briefly smashes through
 *     steam's low (ceiling-capped) top speed, then forces a cool-down.
 *   - electric (weak-long): a mild surge that heats SLOW — a sustained push that helps light, already-
 *     fast electric hold and build speed over distance.
 * Heat-per-second scales with surge magnitude, so a stronger surge is necessarily shorter: both types
 * deliver a similar TOTAL boost per overheat cycle, differing in shape (spike vs sustain), not budget.
 */

/** A boost delivery profile — the flat surge magnitudes and how fast holding it builds heat. */
interface BoostProfile {
  surgeSpeed: number; // u/s added to the top-speed cap, above the chassis ceiling
  surgeAccel: number; // u/s² added to acceleration
  heatPerSec: number; // heat gained per second while boosting — sets the burst LENGTH before redline
}

/**
 * The per-energy-type boost profiles (flat per rig, by engine type only — never tier- or count-scaled,
 * so boost stays a bounded equaliser). Numbers are strawmen, tuned against feel: steam redlines in
 * ~1.5s, electric in ~4s, each delivering a similar total surge·time per cycle.
 */
const BOOST_PROFILES: Record<EnergyType, BoostProfile> = {
  steam: { surgeSpeed: 8, surgeAccel: 14, heatPerSec: 67 },    // strong-short
  electric: { surgeSpeed: 4, surgeAccel: 8, heatPerSec: 25 },  // weak-long
};

/** How fast heat bleeds off while not boosting (per second). A full redline cools in ~3s. */
const COOL_PER_SEC = 34;

/**
 * The boost profile for a rig — its engine type's profile, or null when the rig has no engine (no
 * power source, so no boost). A mixed-type rig takes its first mounted engine's type; both profiles
 * are valid, and homogeneous rigs are the norm.
 */
export function boostProfileFor(world: World, rig: EntityId): BoostProfile | null {
  for (const e of mountedEngines(world, rig)) {
    const type = world.get(e, Assembly)?.type;
    if (type) return BOOST_PROFILES[type];
  }
  return null;
}

/**
 * Advance every rig's boost heat for the frame and resolve whether boost is contributing. Runs BEFORE
 * the movement system, which reads the surge this writes.
 *
 * The heat gauge is continuous: holding boost (Shift, forward throttle, with an engine and not
 * overheated) fills heat; otherwise it drains. Redlining to HEAT_MAX latches `overheated`, cutting
 * boost until heat cools all the way to 0 — the "cool down before reusing" rule. Below the redline you
 * can feather it: tap for repeated short bursts, since fill only outruns drain while held.
 */
export function boostSystem(world: World, dt: number): void {
  for (const e of world.query(Boost, DriveControl)) {
    const b = world.get(e, Boost)!;
    const ctl = world.get(e, DriveControl)!;
    const profile = boostProfileFor(world, e);
    const wants = !!ctl.boost && ctl.throttle > 0 && profile !== null;

    if (b.overheated) {
      // Locked out: no boost, only cooling. Re-arm once fully cold.
      b.active = false;
      b.heat = Math.max(0, b.heat - COOL_PER_SEC * dt);
      if (b.heat <= 0) b.overheated = false;
    } else if (wants) {
      b.heat += profile!.heatPerSec * dt;
      if (b.heat >= HEAT_MAX) {
        b.heat = HEAT_MAX;
        b.overheated = true;
        b.active = false; // redline cuts boost immediately
      } else {
        b.active = true;
      }
    } else {
      b.active = false;
      b.heat = Math.max(0, b.heat - COOL_PER_SEC * dt);
    }

    b.surgeSpeed = b.active ? profile!.surgeSpeed : 0;
    b.surgeAccel = b.active ? profile!.surgeAccel : 0;
  }
}
