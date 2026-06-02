import * as THREE from 'three';

/**
 * The Reclaimer motion rig — drives the articulated `reclaimer-arm` GLB and parents the
 * `reclaimer-bucket` head onto its wrist socket, then plays a looping dig cycle.
 *
 * The node names below are the CONTRACT authored in tools/blender/assets/reclaimer_arm.py:
 * the arm exports a parented chain of `joint_*` handles + a `socket_*` attach point, and any
 * consumer (this viewer now; the game later) animates by rotating those named nodes. Nothing
 * is baked into the GLB — the motion lives in code, so the same arm can idle, dig, or aim.
 */

const ARM_ASSET = 'reclaimer-arm';
const SOCKET = 'socket_wrist';
const WRIST_FALLBACK = 'joint_wrist';

type Axis = 'x' | 'y' | 'z';

/** A joint that interpolates between an idle `rest` pose and the deepest `dig` pose (radians). */
interface DigJoint {
  node: string;
  axis: Axis;
  rest: number;
  dig: number;
}

// Eyeball-tuned in the viewer — generous amplitudes so the articulation reads clearly.
// joint_boom +x raises the tip, −x dips it down to the ground; joint_wrist curls the scoop.
const DIG_JOINTS: DigJoint[] = [
  { node: 'joint_boom', axis: 'x', rest: 0.12, dig: -0.62 },
  { node: 'joint_wrist', axis: 'x', rest: 0.0, dig: 0.85 },
];

const YAW_NODE = 'joint_yaw';
const YAW_SWEEP = 0.18; // rad — the idle turntable search, independent of the dig cycle
const DIG_PERIOD = 2.6; // seconds per full down-and-up dig

/** Returns true if a loaded asset is the articulated arm we know how to drive. */
export function isArticulated(assetId: string): boolean {
  return assetId === ARM_ASSET;
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export class ReclaimerRig {
  private readonly yaw: THREE.Object3D | null;
  private readonly joints: Array<{ obj: THREE.Object3D; axis: Axis; rest: number; dig: number }>;

  /**
   * @param arm    the cloned `reclaimer-arm` scene (already added to the view).
   * @param bucket the cloned `reclaimer-bucket` scene; parented onto the wrist socket here so it
   *               inherits the arm's yaw + boom + curl and moves as one unit.
   */
  constructor(arm: THREE.Object3D, bucket: THREE.Object3D) {
    const socket = arm.getObjectByName(SOCKET) ?? arm.getObjectByName(WRIST_FALLBACK);
    if (socket) socket.add(bucket);
    else arm.add(bucket); // last resort: still show the head even if the socket node is missing

    this.yaw = arm.getObjectByName(YAW_NODE) ?? null;
    this.joints = DIG_JOINTS.map((j) => {
      const obj = arm.getObjectByName(j.node);
      if (!obj) console.warn(`ReclaimerRig: joint '${j.node}' not found in the GLB`);
      return { obj: obj ?? new THREE.Object3D(), axis: j.axis, rest: j.rest, dig: j.dig };
    });
  }

  /** Advance the dig cycle. `elapsed` is seconds since the rig started playing. */
  update(elapsed: number): void {
    // dig: 0 (idle/up) → 1 (deepest scoop) → 0, smoothly, once per DIG_PERIOD.
    const dig = (1 - Math.cos((elapsed / DIG_PERIOD) * Math.PI * 2)) / 2;
    for (const j of this.joints) j.obj.rotation[j.axis] = lerp(j.rest, j.dig, dig);
    if (this.yaw) this.yaw.rotation.y = Math.sin(elapsed * 0.9) * YAW_SWEEP;
  }

  /** Reset every joint to its idle rest pose (used when pausing). */
  rest(): void {
    for (const j of this.joints) j.obj.rotation[j.axis] = j.rest;
    if (this.yaw) this.yaw.rotation.y = 0;
  }
}
