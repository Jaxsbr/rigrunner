import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { Collider } from '@common/components/collider';

/**
 * Collision detection: report every pair of entities whose circular Colliders overlap this frame.
 *
 * It is a *pure read* of the World — it returns data and mutates nothing, so what a collision
 * *means* is decided entirely by the consumer (scrap collection today, projectile damage later),
 * and the same call serves both. Returning a fresh list each frame (rather than stashing state or
 * publishing to a bus) keeps it trivially testable: feed entities, assert the pairs.
 *
 * The test is purely planar (x/z) because driving is planar — a Collider is a circle on the ground,
 * and two overlap when the distance between their centres is less than the sum of their radii.
 *
 * ── PROMOTION CANDIDATE (ADR-003) ───────────────────────────────────────────────────────────────
 * This system is GENERIC by construction (no scrap semantics) but lives in `features/scrap/` because
 * scrap is its only consumer today. When a SECOND feature needs it — combat is the expected one
 * (projectile/enemy hits) — PROMOTE this file to `@common/sim/collision` rather than adding a second
 * copy. At that point it earns the `common/` admission rule (≥2 distinct feature consumers); the path
 * aliases make the move a near-free import-string change. Do NOT duplicate collision.
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 */

/** An unordered pair of entities whose colliders overlap this frame. */
export interface CollisionPair {
  a: EntityId;
  b: EntityId;
}

/**
 * All overlapping collider pairs in the world. O(n²) over colliders with an early planar reject —
 * fine for the handful of colliders we have; if collider counts ever grow we swap in a spatial
 * grid here without touching any caller (they only see the pair list).
 */
export function collisionSystem(world: World): CollisionPair[] {
  const ids = world.query(Transform, Collider);
  const pairs: CollisionPair[] = [];

  for (let i = 0; i < ids.length; i++) {
    const a = ids[i]!;
    const ta = world.get(a, Transform)!;
    const ra = world.get(a, Collider)!.radius;
    for (let j = i + 1; j < ids.length; j++) {
      const b = ids[j]!;
      const tb = world.get(b, Transform)!;
      const rb = world.get(b, Collider)!.radius;

      const dx = ta.x - tb.x;
      const dz = ta.z - tb.z;
      const reach = ra + rb;
      if (dx * dx + dz * dz < reach * reach) pairs.push({ a, b });
    }
  }
  return pairs;
}
