import type * as THREE from 'three';
import type { World } from '@core/world';
import type { EntityViews } from '@common/render/entity-views';
import { Velocity } from './velocity';

/**
 * Drive's sim-driven render: spin each model's wheels at the owning entity's speed. It READS a sim
 * component (Velocity) every frame and drives a view-owned mesh, owning no game truth — it iterates
 * the EntityViews cache and quietly no-ops for any object whose entity lacks the component it cares
 * about. Dispatched from the composition root (`main.ts`) so the shared render tier never imports a
 * feature (ADR-003 §4).
 */

/** Hub radius the rig's wheels were authored at (rig.py WHEEL_R) — converts m/s → rad/s. */
const WHEEL_RADIUS = 0.33;

/**
 * Code-driven wheel spin: roll each model's wheels about their axle (local X) at the owning
 * entity's speed. Deliberately not a baked glTF animation — tying it to Velocity keeps the
 * spin locked to the felt tradeoff, so a heavier, slower rig visibly turns its wheels slower.
 */
export function animateWheels(views: EntityViews, world: World, dt: number): void {
  for (const [id, obj] of views.objects) {
    const wheels = obj.userData['wheels'] as THREE.Object3D[] | undefined;
    if (!wheels || wheels.length === 0) continue;
    const vel = world.isAlive(id) ? world.get(id, Velocity) : undefined;
    if (!vel) continue;
    // Roll without slipping: v = ω·r about the axle (local X). Forward is −Z (movement.ts),
    // so a positive speed needs a negative dθ for the wheel tops to track the direction of travel.
    const dTheta = -(vel.speed * dt) / WHEEL_RADIUS;
    for (const w of wheels) w.rotation.x += dTheta;
  }
}
