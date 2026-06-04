import { defineComponent } from '@core/component';
import type { World } from '@core/world';

/**
 * Marks a chassis mid-DEPLOY — the brief, one-shot unfold a hauled-out kit plays as it becomes a rig.
 * `deployChassis` adds it (`since` 0) the instant the kit converts; `advanceDeploying` ticks `since`
 * and retires the marker once the unfold has run its `DEPLOY_DURATION`, leaving a plain drivable rig.
 *
 * It is the one-bit bridge from that sim timeline to the render layer: `animateChassisDeploy` reads
 * `since` to pose the chassis model from its packed crouch out to its deployed stance (wheels roll
 * out, body jacks up). Pure marker + timer — the starter rig (`spawnRig`) is not deployed this way,
 * so it never carries it; only a kit hauled out into the world does.
 */
export interface Deploying {
  since: number; // seconds since the unfold began, 0..DEPLOY_DURATION
}

export const Deploying = defineComponent<Deploying>('Deploying');

/** How long the unfold takes, start to settle (seconds). The animator reads progress against it. */
export const DEPLOY_DURATION = 0.7;

/**
 * Advance every in-progress deploy by `dt` and retire the marker once its unfold has finished, so the
 * chassis settles into a plain drivable rig (the animator leaves it at exactly its deployed pose).
 * Pure over the world — state in, state out — so it runs and tests headless.
 */
export function advanceDeploying(world: World, dt: number): void {
  for (const id of world.query(Deploying)) {
    const d = world.get(id, Deploying)!;
    d.since += dt;
    if (d.since >= DEPLOY_DURATION) world.remove(id, Deploying);
  }
}
