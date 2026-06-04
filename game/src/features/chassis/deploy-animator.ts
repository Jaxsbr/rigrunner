import type * as THREE from 'three';
import type { World } from '@core/world';
import type { EntityViews } from '@common/render/entity-views';
import { Deploying, DEPLOY_DURATION } from './deploying';

/**
 * The chassis deploy's sim-driven render: the authored UNFOLD a hauled-out kit plays as it becomes a
 * rig. It READS the `Deploying` marker (added by `deployChassis`, retired by `advanceDeploying` once
 * the unfold has run its course) and poses the freshly-swapped chassis model from a packed crouch out
 * to its deployed stance — a low, narrow block whose body RISES (un-squashes upward) while the wheels
 * SPLAY OUT from the centreline to their track, spinning up as they go.
 *
 * The chassis model's own nodes are the articulation: the `wheel_*` set the GLB keeps unjoined (the
 * same nodes `animateWheels` spins) plus the joined `rig-body`. Nothing is baked into the GLB — the
 * motion lives here in code. The body rise is a Y-scale of `rig-body` (its origin is base-centre, so
 * it grows from the ground UP, never sinking through the floor), not a translation. Dispatched from
 * `main.ts` so the shared render tier never imports a feature (ADR-003 §4); owns no truth (the
 * timeline is `Deploying.since`, sim).
 */

// folded → deployed pose, expressed relative to each node's authored (rest) values.
const WHEEL_TUCK = 0.55;        // folded lateral position as a fraction of rest x (pulled toward centre)
const WHEEL_ROLL = Math.PI * 2; // a full turn over the unfold, so the wheels visibly spin up as they emerge
const BODY_SQUASH = 0.4;        // folded body height as a fraction of rest — it rises to full over the unfold

/** The chassis model's deployed (rest) node poses, captured once so the unfold can interpolate from a
 *  computed packed pose back to them. */
interface DeployRig {
  wheels: Array<{ obj: THREE.Object3D; rx: number; rz: number }>;
  body: { obj: THREE.Object3D; scaleY: number } | null;
}

/**
 * Drive each deploying chassis's unfold. Iterates the view cache (like the other sim-driven
 * animators) and acts only on a chassis that is mid-deploy or just finished one: it captures the
 * model's rest poses on first sight, then poses it by the eased deploy progress. When the marker is
 * gone it settles the model at exactly its rest pose and stops tracking — handing the wheels back to
 * `animateWheels` at their authored stations.
 */
export function animateChassisDeploy(views: EntityViews, world: World, _dt: number): void {
  for (const [id, obj] of views.objects) {
    let rig = obj.userData['deployRig'] as DeployRig | undefined;
    const deploying = world.isAlive(id) && world.has(id, Deploying);
    if (!rig && !deploying) continue;

    if (!rig) {
      const captured = captureDeployRig(obj);
      if (!captured) continue; // the chassis GLB hasn't loaded its nodes yet — wait for it
      obj.userData['deployRig'] = captured;
      rig = captured;
    }

    if (deploying) {
      const since = world.get(id, Deploying)!.since;
      poseDeploy(rig, easeOut(Math.min(1, since / DEPLOY_DURATION)));
    } else {
      poseDeploy(rig, 1); // marker retired: settle exactly at the deployed pose, then stop tracking
      delete obj.userData['deployRig'];
    }
  }
}

/** Capture the chassis model's rest (deployed) node poses, or null until the GLB has loaded. */
function captureDeployRig(obj: THREE.Object3D): DeployRig | null {
  const wheels = obj.userData['wheels'] as THREE.Object3D[] | undefined;
  if (!wheels || wheels.length === 0) return null;
  const bodyObj = obj.getObjectByName('rig-body') ?? null;
  return {
    wheels: wheels.map((w) => ({ obj: w, rx: w.position.x, rz: w.position.z })),
    body: bodyObj ? { obj: bodyObj, scaleY: bodyObj.scale.y } : null,
  };
}

/** Pose the rig at unfold progress `p` (0 = packed crouch, 1 = deployed rest). */
function poseDeploy(rig: DeployRig, p: number): void {
  for (const w of rig.wheels) {
    w.obj.position.x = lerp(w.rx * WHEEL_TUCK, w.rx, p); // splay out from the centreline to the track
    w.obj.position.z = w.rz;
    w.obj.rotation.x = (1 - p) * WHEEL_ROLL; // spins up, unwinding to 0 as the wheel reaches its station
  }
  // Body rises by un-squashing its Y back to full (grows up from the base, never below the floor).
  if (rig.body) rig.body.obj.scale.y = lerp(rig.body.scaleY * BODY_SQUASH, rig.body.scaleY, p);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}
