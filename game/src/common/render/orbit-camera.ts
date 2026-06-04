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
   */
  follow(t: Transform, intent: CameraIntent, dt: number): void {
    this.camRadiusTarget = clamp(
      this.camRadiusTarget + intent.zoom * 0.02, this.camRadiusMin, this.camRadiusMax,
    );
    this.camYawTarget += intent.rotate * 0.005; // drag right → orbit; unbounded

    const k = Math.min(1, dt * 8); // eased smoothing toward targets
    this.camRadius += (this.camRadiusTarget - this.camRadius) * k;
    this.camYaw += (this.camYawTarget - this.camYaw) * k;

    const cp = Math.cos(this.camPitch), sp = Math.sin(this.camPitch);
    const cy = Math.cos(this.camYaw), sy = Math.sin(this.camYaw);
    this.camera.position.set(
      t.x + cy * cp * this.camRadius,
      sp * this.camRadius,
      t.z + sy * cp * this.camRadius,
    );
    this.camera.lookAt(t.x, 0, t.z);
  }

  resize(): void {
    this.camera.aspect = aspect();
    this.camera.updateProjectionMatrix();
  }
}

function aspect(): number {
  return window.innerWidth / window.innerHeight;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
