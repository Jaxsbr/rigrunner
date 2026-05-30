import * as THREE from 'three';
import type { World } from '../core/world';
import type { EntityId } from '../core/types';
import { Transform } from '../components/transform';
import { Renderable } from '../components/renderable';
import { Velocity } from '../components/velocity';
import { ModelLoader } from '../../../shared/model-loader';
import type { CameraIntent } from '../input/camera-input';

/** Hub radius the rig's wheels were authored at (rig.py WHEEL_R) — converts m/s → rad/s. */
const WHEEL_RADIUS = 0.33;

/**
 * The view layer. It is a *projection* of the simulation: it reads Transform/Renderable
 * from the World and draws objects, but owns no game truth. The object cache below is view
 * state only — destroy the renderer and the simulation is unaffected.
 */
export class RenderView {
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly objects = new Map<EntityId, THREE.Object3D>();

  // Orbit camera. The starting offset (9, 11, 13) seeds the default distance and bearing; the
  // pitch is fixed near-overhead (no tilt control). Zoom moves the radius in/out, rotate spins
  // the yaw freely around the rig. Radius and yaw ease toward a *target* so motion stays smooth.
  private readonly camRadius0: number;
  private readonly camPitch: number;
  private readonly camRadiusMin: number;
  private readonly camRadiusMax: number;
  private camRadius: number;
  private camRadiusTarget: number;
  private camYaw: number;
  private camYawTarget: number;

  private readonly models = new ModelLoader();

  constructor(canvas: HTMLCanvasElement) {
    this.scene.background = new THREE.Color(0x1a1a1a);

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

    this.camera = new THREE.PerspectiveCamera(50, this.aspect(), 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.resize();

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.position.set(5, 10, 7);
    this.scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshStandardMaterial({ color: 0x2b2b2b }),
    );
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);
    this.scene.add(new THREE.GridHelper(80, 80, 0x444444, 0x333333));

    window.addEventListener('resize', () => this.resize());
  }

  /** Reconcile objects with the current set of renderable entities, then update them. */
  sync(world: World): void {
    for (const e of world.query(Transform, Renderable)) {
      let obj = this.objects.get(e);
      if (!obj) {
        obj = this.createObject(world.get(e, Renderable)!);
        this.scene.add(obj);
        this.objects.set(e, obj);
      }
      const t = world.get(e, Transform)!;
      obj.position.set(t.x, (obj.userData['restY'] as number) ?? 0, t.z);
      obj.rotation.y = t.rotationY;
    }

    for (const [id, obj] of this.objects) {
      if (!world.isAlive(id)) {
        this.scene.remove(obj);
        this.objects.delete(id);
      }
    }
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

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private createObject(r: Renderable): THREE.Object3D {
    return r.shape === 'model' ? this.createModel(r.assetId) : this.createBox(r);
  }

  private createBox(r: Extract<Renderable, { shape: 'box' }>): THREE.Mesh {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(r.size.x, r.size.y, r.size.z),
      new THREE.MeshStandardMaterial({ color: r.color }),
    );
    mesh.userData['restY'] = r.size.y / 2; // sit the box on the ground
    return mesh;
  }

  /**
   * A model entity gets a stable Group immediately (so the cache/positioning logic never
   * waits on I/O). A placeholder fills it until the GLB loads; on success the real model
   * swaps in. Origin convention: base-centre → restY 0 (the model sits on the ground).
   */
  private createModel(assetId: string): THREE.Object3D {
    const group = new THREE.Group();
    group.userData['restY'] = 0;
    group.userData['wheels'] = []; // populated on load; animateWheels reads it (safe when empty)

    const placeholder = this.placeholderMesh();
    group.add(placeholder);

    this.models
      .load(assetId)
      .then((template) => {
        group.remove(placeholder);
        const instance = template.clone(true);
        group.add(instance);
        // Collect spin-able parts: any node named `wheel*` (rig.py keeps them unjoined so they
        // survive as addressable nodes). Empty for assets without wheels — animateWheels no-ops.
        const wheels: THREE.Object3D[] = [];
        instance.traverse((o) => {
          if (o.name.startsWith('wheel')) wheels.push(o);
        });
        group.userData['wheels'] = wheels;
      })
      .catch((err: unknown) => {
        console.warn(`[assets] could not load model '${assetId}', showing placeholder:`, err);
      });

    return group;
  }

  /**
   * Code-driven wheel spin: roll each model's wheels about their axle (local X) at the owning
   * entity's speed. Deliberately not a baked glTF animation — tying it to Velocity keeps the
   * spin locked to the felt tradeoff, so a heavier, slower rig visibly turns its wheels slower.
   */
  animateWheels(world: World, dt: number): void {
    for (const [id, obj] of this.objects) {
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

  /** Magenta wireframe cube = "asset loading or missing" — an obvious dev signal. */
  private placeholderMesh(): THREE.Mesh {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0xff00ff, wireframe: true }),
    );
    mesh.position.y = 0.5;
    return mesh;
  }

  private aspect(): number {
    return window.innerWidth / window.innerHeight;
  }

  private resize(): void {
    this.camera.aspect = this.aspect();
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
