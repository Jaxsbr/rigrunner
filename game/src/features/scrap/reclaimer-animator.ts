import type { World } from '@core/world';
import type { EntityViews } from '@common/render/entity-views';
import type { ReclaimerRig } from '@common/render/articulation';
import { ReclaimerWorking } from '@common/components/reclaimer-working';

/**
 * The Reclaimer's sim-driven render: deploy/retract its articulated arm as the player works it. It
 * READS the shared `ReclaimerWorking` marker (set on a Reclaimer while the player rummages a pile OR
 * heals a stump) and ramps a view-side `deploy` factor toward 1 while working, 0 while idle. Lives with
 * scrap (rummaging is a scrap interaction and this began here); the marker is shared (`@common`) so
 * restoration drives the same motion, and the arm geometry is generic articulation in
 * `@common/render/articulation`. Dispatched from `main.ts` so the shared render tier never imports a
 * feature (ADR-003 §4).
 */

/** How fast the arm deploys / retracts, in deploy-units per second (≈0.4 s for the full travel). */
const DEPLOY_RATE = 2.5;

/**
 * Drive each Reclaimer's articulated arm. It advances a view-owned motion rig (built in EntityViews
 * when the arm GLB loads, stored in userData) by the frame's dt, ramping a `deploy` factor toward 1
 * while digging and 0 while idle — so the arm smoothly DEPLOYS out of its stowed scan to dig and
 * RETRACTS back when work stops. The blend lives in ReclaimerRig.drive; the ramp is the only view
 * state here.
 */
export function animateReclaimer(views: EntityViews, world: World, dt: number): void {
  for (const [id, obj] of views.objects) {
    const rig = obj.userData['reclaimer'] as ReclaimerRig | null | undefined;
    if (!rig) continue;
    const elapsed = ((obj.userData['reclaimerElapsed'] as number) ?? 0) + dt;
    obj.userData['reclaimerElapsed'] = elapsed;

    const target = world.isAlive(id) && world.has(id, ReclaimerWorking) ? 1 : 0;
    let deploy = (obj.userData['reclaimerDeploy'] as number) ?? 0;
    const step = dt * DEPLOY_RATE;
    deploy += Math.sign(target - deploy) * Math.min(step, Math.abs(target - deploy)); // linear ramp
    obj.userData['reclaimerDeploy'] = deploy;

    rig.drive(elapsed, deploy);
  }
}
