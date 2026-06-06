import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Mount } from '@common/components/mount';
import { MountGrid } from '@common/components/mount-grid';
import { mountedEngines } from '@features/engine/engine';

/**
 * Where the rig turns AROUND — its steering pivot — is set by where the engines sit along the deck.
 * This is the build-bay lever for handling: slide the drive toward the back and the rig pivots about
 * its rear (the nose sweeps a wide arc, like a rear-wheel-drive car); slide it forward and it pivots
 * about its front (the tail kicks out); keep it centred and it turns in place. Same throttle, same
 * steer — a different *feel*, decided by where you bolted the engine.
 *
 * The deck runs front→back along local Z: row 0 is the FRONT (toward −Z, the way the rig drives) and
 * the highest row is the BACK (toward +Z) — the convention `MountGrid` fixes. So an engine's drive
 * "end" is read straight off its row: rows below the deck's mid-line are front, above are rear, on it
 * are middle. We classify by position rather than the engine's grid index, so the same rule reads
 * correctly on both decks (the 1×3 scout and the 3×5 hauler) regardless of cell numbering.
 *
 * This is a drive/handling quantity, not cell placement, so it reads `Mount.row` + `MountGrid`
 * directly (both shared kernel) and never the mounting feature — keeping the drive→mounting edge from
 * closing into a cycle.
 */

/** Which end the rig's engines drive from — the handling character their placement produces. */
export type DriveBias = 'rear' | 'middle' | 'front';

/**
 * The pivot sits this fraction of the way from the deck centre toward the driven end (0 = centre,
 * 1 = the extreme front/back cell). Tunable to feel. Because it scales the deck's half-length, the
 * longer 3×5 hauler shifts its pivot twice as far in metres as the short 1×3 scout — so engine
 * placement gives the big chassis a more pronounced steering character, which is the right emergent
 * shape (a longer wheelbase feels the drive end more).
 */
const PIVOT_REACH = 0.7;

/**
 * The rig's drive bias from where its engines sit. One engine reports its own end; several vote by
 * majority — the end with the most engines wins, and an even spread (a tie, or engines split across
 * ends) resolves to 'middle'. The 1×3 accepts a single engine so it can only be one clean end; the
 * 3×5 is where mixed layouts actually arise. No engine (or no deck) → 'middle'.
 */
export function engineDriveBias(world: World, rig: EntityId): DriveBias {
  const grid = world.get(rig, MountGrid);
  if (!grid) return 'middle';
  const mid = (grid.rows - 1) / 2; // the deck's longitudinal centre line, in row units

  let rear = 0;
  let front = 0;
  let middle = 0;
  for (const e of mountedEngines(world, rig)) {
    const row = world.get(e, Mount)!.row;
    if (row > mid) rear++;
    else if (row < mid) front++;
    else middle++;
  }

  if (rear > front && rear > middle) return 'rear';
  if (front > rear && front > middle) return 'front';
  return 'middle';
}

/**
 * The steering pivot as a local-Z offset from the rig origin (the metric `movementSystem` rotates the
 * rig in): positive = toward the back (+Z), negative = toward the front (−Z), 0 = the origin. A
 * 'middle' bias (and a rig with no deck) gives 0, so the rig turns about its own centre exactly as it
 * did before engine placement mattered.
 */
export function steeringPivotLz(world: World, rig: EntityId): number {
  const grid = world.get(rig, MountGrid);
  if (!grid) return 0;
  const bias = engineDriveBias(world, rig);
  if (bias === 'middle') return 0;
  const halfLen = ((grid.rows - 1) / 2) * grid.cellSize; // local Z of the extreme front/back cell
  const lz = halfLen * PIVOT_REACH;
  return bias === 'rear' ? lz : -lz;
}
