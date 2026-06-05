import type * as THREE from 'three';
import type { World } from '@core/world';
import type { EntityViews } from '@common/render/entity-views';
import { Deploying, DEPLOY_DURATION } from './deploying';

/**
 * The chassis deploy's sim-driven render: the authored UNFOLD a hauled-out kit plays as it becomes a
 * rig. It READS the `Deploying` marker (added by `deployChassis`, retired by `advanceDeploying` once
 * the unfold has run its course) and poses the freshly-composed chassis from a packed crouch out to its
 * deployed stance — a low, narrow block whose deck RISES (un-squashes upward) while the wheels SPLAY OUT
 * from the centreline to their track, spinning up as they go.
 *
 * The composed rig's own nodes ARE the articulation (`chassisToRig` builds it through the shared
 * assembler): the per-corner `socket_axle_*`/`socket_susp_*` stations fan the running gear out from the
 * centreline, the instanced `wheel*` units (the same nodes `animateWheels` spins) spin up, and the
 * `rig-body` deck un-squashes. Nothing is baked into the GLBs — the motion lives here in code. The
 * splay moves the SOCKETS (the wheels sit at their station's origin, so the track offset lives on the
 * socket), and the deck rise is a Y-scale of `rig-body` (a sibling of the sockets, so scaling it never
 * moves them; its origin is base-centre, so it grows from the ground UP, never sinking through the
 * floor). Dispatched from `main.ts` so the shared render tier never imports a feature (ADR-003 §4);
 * owns no truth (the timeline is `Deploying.since`, sim).
 */

// folded → deployed pose, expressed relative to each node's authored (rest) values.
const WHEEL_TUCK = 0.55;        // folded station X as a fraction of rest x (running gear pulled toward centre)
const WHEEL_ROLL = Math.PI * 2; // a full turn over the unfold, so the wheels visibly spin up as they emerge
const BODY_SQUASH = 0.4;        // folded deck height as a fraction of rest — it rises to full over the unfold

/** The composed rig's deployed (rest) node poses, captured once so the unfold can interpolate from a
 *  computed packed pose back to them. */
interface DeployRig {
  /** The corner stations (`socket_axle_*`/`socket_susp_*`) that fan their running gear out from the
   *  centreline — each remembers its rest X so the splay lerps back to it. */
  splay: Array<{ obj: THREE.Object3D; rx: number }>;
  /** The instanced wheel units (`animateWheels` spins these too) — they spin up over the unfold. */
  wheels: THREE.Object3D[];
  /** The deck (`rig-body`), Y-scaled from squashed to full as the rig rises. */
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

/** Capture the composed rig's rest (deployed) node poses, or null until the composition has loaded
 *  (the wheels appear only once the assembler resolves and entity-views populates `userData['wheels']`). */
function captureDeployRig(obj: THREE.Object3D): DeployRig | null {
  const wheels = obj.userData['wheels'] as THREE.Object3D[] | undefined;
  if (!wheels || wheels.length === 0) return null;
  const splay: Array<{ obj: THREE.Object3D; rx: number }> = [];
  obj.traverse((o) => {
    if (o.name.startsWith('socket_axle') || o.name.startsWith('socket_susp')) splay.push({ obj: o, rx: o.position.x });
  });
  const bodyObj = obj.getObjectByName('rig-body') ?? null;
  return {
    splay,
    wheels,
    body: bodyObj ? { obj: bodyObj, scaleY: bodyObj.scale.y } : null,
  };
}

/** Pose the rig at unfold progress `p` (0 = packed crouch, 1 = deployed rest). */
function poseDeploy(rig: DeployRig, p: number): void {
  // Fan the corner stations out from the centreline to their track (the running gear rides them).
  for (const s of rig.splay) s.obj.position.x = lerp(s.rx * WHEEL_TUCK, s.rx, p);
  // Wheels spin up, unwinding to 0 as they reach their station (then animateWheels takes over).
  for (const w of rig.wheels) w.rotation.x = (1 - p) * WHEEL_ROLL;
  // Deck rises by un-squashing its Y back to full (grows up from the base, never below the floor).
  if (rig.body) rig.body.obj.scale.y = lerp(rig.body.scaleY * BODY_SQUASH, rig.body.scaleY, p);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}
