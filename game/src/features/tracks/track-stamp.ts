/**
 * The pure geometry of laying a tread trail: decide WHERE to press marks as a mover travels from one
 * point to the next. Position-delta is the source of truth — no component need report a heading, and a
 * stationary mover stamps nothing for free. This stays free of THREE / the DOM so it is unit-tested
 * headless; `track-marks.ts` owns turning these stamps into decals.
 *
 * Even spacing comes from an ANCHOR that only advances by whole steps: a frame that travels less than a
 * step leaves the anchor put and accumulates into the next, so spacing is consistent regardless of frame
 * rate or speed (curves included — each stamp simply takes the travel direction at that point).
 */

/** A single mark to press: a ground position and the yaw its length aligns to (along travel). */
export interface Stamp {
  x: number;
  z: number;
  yaw: number;
}

/** The stamps to lay this frame plus the advanced anchor to carry forward (sub-step remainder kept). */
export interface StampPlan {
  stamps: Stamp[];
  nextX: number;
  nextZ: number;
}

/** Ground distance between consecutive marks. Small enough that turns read as smooth arcs. */
export const TRACK_STEP = 0.32;

/** A single-frame jump farther than this isn't driving — a deploy/pack reseat or a respawn of the same
 *  entity — so it must NOT draw a streak across the map. Real movers travel a fraction of this per frame. */
export const TRACK_TELEPORT = 3;

/** Backstop so a near-teleport delta can't queue an unbounded run of marks in one call. */
const MAX_STAMPS_PER_CALL = 12;

/**
 * Plan the marks for a move from (fromX,fromZ) to (toX,toZ). Returns no stamps (anchor unchanged) until
 * at least one `step` has been travelled; no stamps (anchor snapped to the destination) for a teleport.
 */
export function planStamps(
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  step: number = TRACK_STEP,
  teleport: number = TRACK_TELEPORT,
): StampPlan {
  const dx = toX - fromX;
  const dz = toZ - fromZ;
  const dist = Math.hypot(dx, dz);

  if (dist > teleport) return { stamps: [], nextX: toX, nextZ: toZ };
  if (dist < step) return { stamps: [], nextX: fromX, nextZ: fromZ };

  const ux = dx / dist;
  const uz = dz / dist;
  // Tread marks are axis-symmetric, so only the travel AXIS matters; matching the sim's movement yaw
  // (forward = −z, so direction = (−sin, −cos); see Transform) keeps the convention consistent.
  const yaw = Math.atan2(-dx, -dz);

  const stamps: Stamp[] = [];
  for (let d = step; d <= dist + 1e-6 && stamps.length < MAX_STAMPS_PER_CALL; d += step) {
    stamps.push({ x: fromX + ux * d, z: fromZ + uz * d, yaw });
  }
  const last = stamps[stamps.length - 1]!; // dist ≥ step guarantees at least one
  return { stamps, nextX: last.x, nextZ: last.z };
}
