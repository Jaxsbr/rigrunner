import type { World } from '@core/world';
import { Transform } from '@common/components/transform';
import { Collider } from '@common/components/collider';
import { Solid } from '@common/components/solid';
import { Drivetrain } from './drivetrain';
import { Velocity } from './velocity';

/**
 * Collision RESPONSE: after movement has integrated this frame's positions, push every driven mover back
 * out of any Solid it overlaps, so the rig physically collides with world structures instead of clipping
 * through them. The shared collision detection (`@common/sim/collision`) only REPORTS overlaps; this is the
 * half that resolves them — it runs as the rig's own motion correction, so it lives beside `movement.ts`.
 *
 * The model is de-penetration, not stop or bounce:
 *  - Push-out along the contact normal (Solid centre → mover centre) by the penetration depth, so after
 *    the correction the circles are exactly touching — clipping is gone every frame. Head-on, the push-out
 *    almost exactly cancels that frame's forward over-step, so the mover sits flush against the surface
 *    frame after frame: a clamp to the surface, not an impulse that overshoots, so there is nothing to
 *    oscillate. With no velocity reflection there is also no bounce.
 *  - Slide falls out for free: only the into-the-surface part of the motion is undone, the tangential part
 *    survives, so a rig hitting at an angle scrapes along the surface and deflects off rather than sticking.
 *  - The into-the-surface fraction (heading · −normal, clamped: 1 = dead-on … 0 = glancing) also bleeds the
 *    mover's speed toward 0, so a head-on rig visibly comes to rest against the wall (its wheels stop) while
 *    a glancing one keeps its speed and the slide carries on.
 *  - Concentric case (mover exactly on a Solid's centre, no defined normal): push out along the mover's
 *    reverse heading so the correction stays deterministic instead of dividing by zero.
 *
 * Movers are driven rigs (Transform + Drivetrain + Velocity + Collider) — the player rig today, and any
 * enemy built as a real rig is blocked automatically by the same query. Only the chassis circle blocks (not
 * the per-part union — one circle to resolve); per-part blocking is a later refinement. Solids are a sparse
 * static set, so a single resolve pass over movers × solids is enough (a second pass is the cheap fix if a
 * corner-wedge between two solids ever wobbles).
 *
 * Pure over the World (state in, state out), so it runs and is unit-tested headless like the rest of the
 * sim. Dispatched from `app/bootstrap` right after `movementSystem`, before mounted parts ride to their
 * cells, so the parts follow the corrected position.
 */
export function collisionResponseSystem(world: World): void {
  const solids = world.query(Transform, Collider, Solid);
  if (solids.length === 0) return;

  for (const mover of world.query(Transform, Drivetrain, Velocity, Collider)) {
    const t = world.get(mover, Transform)!;
    const r = world.get(mover, Collider)!.radius;
    const heading = { x: -Math.sin(t.rotationY), z: -Math.cos(t.rotationY) };

    for (const s of solids) {
      const st = world.get(s, Transform)!;
      const reach = r + world.get(s, Collider)!.radius;
      const dx = t.x - st.x;
      const dz = t.z - st.z;
      const d2 = dx * dx + dz * dz;
      if (d2 >= reach * reach) continue; // clear of this solid

      // Contact normal (solid → mover); concentric → push out along the mover's reverse heading.
      const dist = Math.sqrt(d2);
      const nx = dist > 1e-4 ? dx / dist : heading.x;
      const nz = dist > 1e-4 ? dz / dist : heading.z;

      // De-penetrate to exactly touching.
      const pen = reach - dist;
      t.x += nx * pen;
      t.z += nz * pen;

      // Head-on bleeds speed to rest against the wall; a glance keeps its speed so the slide continues.
      const intoSurface = Math.max(0, -(heading.x * nx + heading.z * nz));
      world.get(mover, Velocity)!.speed *= 1 - intoSurface;
    }
  }
}
