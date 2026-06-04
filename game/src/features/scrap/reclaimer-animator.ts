import type { World } from '@core/world';
import type { EntityViews } from '@common/render/entity-views';
import type { ReclaimerRig } from '@common/render/articulation';
import { Digging } from './digging';

/**
 * The Reclaimer's sim-driven render: deploy/retract its articulated arm as the player rummages. It
 * READS the sim's `Digging` marker (set on a Reclaimer by `scrapRummageSystem` while the player works
 * a pile) and ramps a view-side `deploy` factor toward 1 while digging, 0 while idle. Lives with
 * scrap (it reads scrap's `Digging` marker, and rummaging IS a scrap interaction); the arm geometry
 * itself is generic articulation in `@common/render/articulation`. Dispatched from `main.ts` so the
 * shared render tier never imports a feature (ADR-003 §4).
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

    const target = world.isAlive(id) && world.has(id, Digging) ? 1 : 0;
    let deploy = (obj.userData['reclaimerDeploy'] as number) ?? 0;
    const step = dt * DEPLOY_RATE;
    deploy += Math.sign(target - deploy) * Math.min(step, Math.abs(target - deploy)); // linear ramp
    obj.userData['reclaimerDeploy'] = deploy;

    rig.drive(elapsed, deploy);
  }
}
