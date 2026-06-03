import * as THREE from 'three';
import type { ModelLoader } from '../../../shared/model-loader';

/**
 * The Reclaimer motion rig, game-side — drives the articulated `reclaimer-arm` GLB and parents
 * the `reclaimer-bucket` head onto its wrist socket. This is the runtime the build plan's PR2
 * promised: the game owning the articulation contract instead of the viewer.
 *
 * The node names below are the CONTRACT authored in tools/blender/assets/reclaimer_arm.py
 * (`joint_*` handles to rotate, `socket_*` the attach point). The viewer's
 * `viewer/src/articulation.ts` is the reference driver against the same names; this is a fresh
 * re-implementation living in the game's render seam (apps never reach into each other). Nothing
 * is baked into the GLB — the motion lives here in code, so one arm can idle, dig, or aim.
 */

const ARM_ASSET = 'reclaimer-arm';
export const BUCKET_ASSET = 'reclaimer-bucket';
const SOCKET = 'socket_wrist';
const WRIST_FALLBACK = 'joint_wrist';

type Axis = 'x' | 'y' | 'z';

/**
 * A driven joint with its key poses (radians):
 *  - `rest` idle pose at the top of the dig cycle,
 *  - `dig`  deepest scoop (the dig cycle swings between rest and dig),
 *  - `stow` the static "not in operation" pose — boom raised diagonally up, bucket tucked.
 *
 * Values match the viewer's eyeball-tuned set so the same GLB reads identically in both apps:
 * joint_boom +x raises the tip, −x dips it to the ground; joint_wrist curls the scoop; stow
 * raises the boom to ~57° (more vertical than horizontal) with the bucket folded back.
 */
interface DigJoint {
  node: string;
  axis: Axis;
  rest: number;
  dig: number;
  stow: number;
}

const DIG_JOINTS: DigJoint[] = [
  { node: 'joint_boom', axis: 'x', rest: 0.12, dig: -0.62, stow: 1.0 },
  { node: 'joint_wrist', axis: 'x', rest: 0.0, dig: 0.85, stow: -0.45 },
];

const YAW_NODE = 'joint_yaw';
const DIG_PERIOD = 2.6; // seconds per full down-and-up dig (PR4 drives this)
// The idle "powered but not working" sway: the stowed arm scans slowly left/right. Gentler and
// slower than a working sweep — it reads as "ready", and it is what proves the game DRIVES the
// joints each frame rather than just rendering a static GLB.
const IDLE_YAW_SWEEP = 0.12; // rad
const IDLE_YAW_SPEED = 0.5; // rad/s phase rate

/** Returns true if a loaded asset is the articulated arm this rig knows how to drive. */
export function isArticulated(assetId: string): boolean {
  return assetId === ARM_ASSET;
}

/**
 * Compose the Reclaimer's bucket head onto a freshly-loaded ARM model and hold the static stow pose
 * — the non-animated form the workshop previews (the Workshop Deck view and the inspect portrait)
 * show, so a staged/selected Reclaimer reads as the whole tool instead of a headless arm. A no-op
 * for any non-articulated asset, so callers can apply it blindly to every model they load. Mirrors
 * the live in-world path (render/entity-views): the bucket is loaded (cached) via the same loader
 * and cloned onto the wrist socket. Those live views animate the rig per frame; these don't, so a
 * single resting `stow()` is enough here.
 */
export async function attachStaticHead(
  assetId: string,
  arm: THREE.Object3D,
  loader: ModelLoader,
): Promise<void> {
  if (!isArticulated(assetId)) return;
  const bucket = (await loader.load(BUCKET_ASSET)).clone(true);
  new ReclaimerRig(arm, bucket).stow();
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export class ReclaimerRig {
  private readonly yaw: THREE.Object3D | null;
  private readonly joints: Array<{ obj: THREE.Object3D; axis: Axis; rest: number; dig: number; stow: number }>;

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
      return { obj: obj ?? new THREE.Object3D(), axis: j.axis, rest: j.rest, dig: j.dig, stow: j.stow };
    });
  }

  /**
   * The in-game idle: the static stow pose (boom raised, bucket folded) with a slow yaw scan.
   * `elapsed` is seconds since the rig started idling. This is the pose the staged Reclaimer
   * holds in PR2; PR4 swaps to `dig` while the player works a pile, then back to idle.
   */
  idle(elapsed: number): void {
    for (const j of this.joints) j.obj.rotation[j.axis] = j.stow;
    if (this.yaw) this.yaw.rotation.y = Math.sin(elapsed * IDLE_YAW_SPEED) * IDLE_YAW_SWEEP;
  }

  /** The looping dig cycle: boom/wrist swing between rest and deepest scoop. Reserved for PR4. */
  dig(elapsed: number): void {
    // dig: 0 (up) → 1 (deepest scoop) → 0, smoothly, once per DIG_PERIOD.
    const t = (1 - Math.cos((elapsed / DIG_PERIOD) * Math.PI * 2)) / 2;
    for (const j of this.joints) j.obj.rotation[j.axis] = lerp(j.rest, j.dig, t);
    if (this.yaw) this.yaw.rotation.y = 0;
  }

  /** Snap every joint to the static stow pose with no yaw offset (no per-frame drive). */
  stow(): void {
    for (const j of this.joints) j.obj.rotation[j.axis] = j.stow;
    if (this.yaw) this.yaw.rotation.y = 0;
  }
}
