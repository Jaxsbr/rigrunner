import * as THREE from 'three';
import type { Transform } from '@common/components/transform';
import type { CameraIntent } from '@common/input/camera-input';

/**
 * The orbit camera: a perspective camera that stays trained on a followed transform (the rig),
 * orbiting it at an eased radius/yaw with a fixed near-overhead pitch. It owns only camera state —
 * no scene, no entities — and exposes `camera` for the stage to draw with and the picker to ray
 * from. Zoom clamps to an in/out range; rotate orbits freely.
 */
export class OrbitCamera {
  readonly camera: THREE.PerspectiveCamera;

  // The starting offset (9, 11, 13) seeds the default distance and bearing; the pitch is fixed
  // near-overhead (no tilt control). Radius and yaw ease toward a *target* so motion stays smooth.
  private readonly camRadius0: number;
  private readonly camPitch: number;
  private readonly camRadiusMin: number;
  private readonly camRadiusMax: number;
  private camRadius: number;
  private camRadiusTarget: number;
  private camYaw: number;
  private camYawTarget: number;
  // The point on the ground the camera is trained on. It tracks the followed rig exactly while
  // driving, but on a `1`/`2` chassis switch the follow target teleports across the field — so
  // instead of snapping, the focus EASES from the old rig to the new one for a smooth pan.
  private focusX = 0;
  private focusZ = 0;
  private focusSeeded = false;
  private panning = false;

  constructor() {
    // Derive the spherical camera params from the authored offset: radius = its length,
    // yaw = its bearing. Pitch is fixed at the near-overhead end of the old tilt range
    // (base elevation + 0.42) for a more top-down default view.
    const off = new THREE.Vector3(9, 11, 13);
    this.camRadius0 = off.length();
    this.camPitch = Math.asin(off.y / this.camRadius0) + 0.42;
    this.camRadiusMin = this.camRadius0 * 0.6; // zoom in: get a bit closer than default
    this.camRadiusMax = this.camRadius0 * 1.8; // zoom out cap
    this.camRadius = this.camRadiusTarget = this.camRadius0;
    this.camYaw = this.camYawTarget = Math.atan2(off.z, off.x);

    this.camera = new THREE.PerspectiveCamera(50, aspect(), 0.1, 1000);
  }

  /**
   * Keep the camera trained on the followed transform, folding in this frame's camera intent.
   * Zoom is clamped between a closer-than-default floor and an out cap; rotate orbits freely
   * (no clamp — full 360° around the rig). Both ease toward their targets so input feels
   * smooth rather than instant. Pitch is fixed (no tilt control).
   *
   * `retarget` is set the frame the followed rig changes (a `1`/`2` switch). It begins an eased pan
   * of the focus point to the new rig instead of teleporting; until then the focus stays glued to the
   * followed transform, so normal driving keeps the rig dead-centre.
   */
  follow(t: Transform, intent: CameraIntent, dt: number, retarget = false): void {
    this.camRadiusTarget = clamp(
      this.camRadiusTarget + intent.zoom * 0.02, this.camRadiusMin, this.camRadiusMax,
    );
    this.camYawTarget += intent.rotate * 0.005; // drag right → orbit; unbounded

    const k = Math.min(1, dt * 8); // eased smoothing toward targets
    this.camRadius += (this.camRadiusTarget - this.camRadius) * k;
    this.camYaw += (this.camYawTarget - this.camYaw) * k;

    if (retarget) this.panning = true;
    if (!this.focusSeeded) {
      this.focusX = t.x; this.focusZ = t.z; this.focusSeeded = true; // first follow: no pan from origin
    } else if (this.panning) {
      const fk = Math.min(1, dt * FOCUS_EASE);
      this.focusX += (t.x - this.focusX) * fk;
      this.focusZ += (t.z - this.focusZ) * fk;
      if (Math.hypot(t.x - this.focusX, t.z - this.focusZ) < FOCUS_SNAP) {
        this.focusX = t.x; this.focusZ = t.z; this.panning = false; // arrived — glue to the rig again
      }
    } else {
      this.focusX = t.x; this.focusZ = t.z; // glued to the rig during normal driving
    }

    const cp = Math.cos(this.camPitch), sp = Math.sin(this.camPitch);
    const cy = Math.cos(this.camYaw), sy = Math.sin(this.camYaw);
    this.camera.position.set(
      this.focusX + cy * cp * this.camRadius,
      sp * this.camRadius,
      this.focusZ + sy * cp * this.camRadius,
    );
    this.camera.lookAt(this.focusX, 0, this.focusZ);
  }

  resize(): void {
    this.camera.aspect = aspect();
    this.camera.updateProjectionMatrix();
  }
}

// Focus-pan tuning for a chassis switch: ease rate (per second) and the distance at which the pan
// snaps shut and the focus re-glues to the rig.
const FOCUS_EASE = 6;
const FOCUS_SNAP = 0.05;

function aspect(): number {
  return window.innerWidth / window.innerHeight;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
