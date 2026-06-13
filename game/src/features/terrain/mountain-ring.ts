import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { Renderable } from '@common/components/renderable';
import { Collider } from '@common/components/collider';
import { Solid } from '@common/components/solid';
import { GROUND_SIZE } from '@common/render/stage';

/**
 * The bounding mountain ring — Phase 1's "bowl wall". The worked, textured floor sits inside a circle
 * of craggy peaks (the one `mountain` massif, tiled): rotated + scaled copies ring the ground and are
 * each Solid, so they physically block the way out — except at the EXIT GAPS, the only mouths out of
 * the bowl. The danger beyond (camps guarding the gaps) is what makes leaving cost.
 *
 * The radius is the textured floor's CORNER distance (`GROUND_SIZE/2 · √2`), so the square of worked
 * ground sits inside the ring with its corners touching the peaks — the wasteland reaches a hard edge.
 *
 * Placement is DETERMINISTIC (a per-index hash, no RNG): this is static scenery seeded in
 * `seedStaticWorld`, which runs on BOTH New Game and Continue, so the ring MUST land identically every
 * load — a random ring would teleport between sessions (and could spawn a peak onto the parked rig).
 */

/** The ring radius: the corner distance of the square textured floor, so the floor inscribes the ring. */
export const MOUNTAIN_RING_RADIUS = (GROUND_SIZE / 2) * Math.SQRT2;

/** A drivable exit cut into the ring: no peak is placed within `halfWidth` of `angle` (radians). */
export interface MountainGap {
  /** Gap centre angle (radians; 0 = +x, increasing counter-clockwise — the same mapping camps use). */
  angle: number;
  /** Half the gap's angular width — the mouth spans `2·halfWidth` of clear arc. */
  halfWidth: number;
}

export interface MountainRingOpts {
  radius?: number;
  /** Peaks around the FULL ring before gaps are cut (spacing = circumference / count). */
  count?: number;
  gaps?: MountainGap[];
}

// The massif's blocking-core radius (its jagged footprint is wider) — scaled per instance. At the
// default ~22 m spacing, neighbours' cores overlap into a continuous barrier, open only at the gaps.
const BASE_COLLIDER = 10.5;

/** A deterministic pseudo-random in [0, 1) from a real seed — varies a peak's look by its index, reproducibly. */
function hash(n: number): number {
  const s = Math.sin(n) * 43758.5453;
  return s - Math.floor(s);
}

/** Smallest absolute angular distance between two angles (radians), in [0, π]. */
function angularDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % (Math.PI * 2);
  return d > Math.PI ? Math.PI * 2 - d : d;
}

/**
 * Ring the world with mountains, leaving the given gaps open. Each peak gets a reproducible yaw +
 * scale + radial nudge from its index so the copies read as a varied range, not a stamped circle.
 * Returns the spawned ids.
 */
export function spawnMountainRing(world: World, opts: MountainRingOpts = {}): EntityId[] {
  const radius = opts.radius ?? MOUNTAIN_RING_RADIUS;
  const count = opts.count ?? 30;
  const gaps = opts.gaps ?? [];
  const ids: EntityId[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    if (gaps.some((g) => angularDistance(angle, g.angle) < g.halfWidth)) continue; // a gap — leave it open
    const r = radius + (hash(i * 3.7) - 0.5) * 10; // radial nudge so the ring isn't a clean circle
    const scale = 0.8 + hash(i * 2.3) * 0.6;       // 0.8–1.4 — varied massif sizes
    const e = world.createEntity();
    world.add(e, Transform, { x: Math.cos(angle) * r, z: Math.sin(angle) * r, rotationY: hash(i * 1.1) * Math.PI * 2 });
    world.add(e, Renderable, { shape: 'model', assetId: 'mountain', scale });
    world.add(e, Collider, { radius: BASE_COLLIDER * scale });
    world.add(e, Solid, true);
    ids.push(e);
  }
  return ids;
}
