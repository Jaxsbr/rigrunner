import * as THREE from 'three';
import type { World } from '../core/world';
import type { EntityId } from '../core/types';
import { Transform } from '../components/transform';
import { Renderable } from '../components/renderable';
import { Velocity } from '../components/velocity';
import { Storage } from '../components/storage';
import { WorkshopZone } from '../components/workshop-zone';
import { ModelLoader } from '../../../shared/model-loader';
import type { CameraIntent } from '../input/camera-input';

/** Hub radius the rig's wheels were authored at (rig.py WHEEL_R) — converts m/s → rad/s. */
const WHEEL_RADIUS = 0.33;

// Storage fill block dimensions — kept in step with the tank cavity in tools/blender/assets/storage.py
// (OUTER 1.0, WALL_T 0.10, HEIGHT 0.90, CAVITY 0.80). The block sits just inside the walls, on the
// cavity floor, and stops below the raised rim collar.
const STORAGE_FLOOR_TOP = 0.10;   // interior floor (top of the carved base = WALL_T)
const STORAGE_FILL_W = 0.74;      // a touch inside the 0.80 m cavity
const STORAGE_FILL_MAX_H = 0.66;  // full-height of the fill, stopping just below the rim collar
const STORAGE_FILL_EASE = 7;      // how fast the shown level glides to the real fraction (per second)

/**
 * The view layer. It is a *projection* of the simulation: it reads Transform/Renderable
 * from the World and draws objects, but owns no game truth. The object cache below is view
 * state only — destroy the renderer and the simulation is unaffected.
 */
export class RenderView {
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly canvas: HTMLCanvasElement;
  private readonly objects = new Map<EntityId, THREE.Object3D>();

  // Picking + build affordances. The raycaster/scratch vectors are reused to avoid per-call
  // allocation. The highlight marks the cell a carried part would snap to; the shadow grounds
  // the carried part to the surface below it (both are pure view polish, owned here, not state).
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private readonly dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly hitPoint = new THREE.Vector3();
  // Target-cell highlight: a filled, glowing square that sits on the cell a carried part will snap
  // into, breathing (opacity + scale pulse) so the cell reads as eager to accept the part rather
  // than a faint outline. The group holds a fill + a bright border; the fill material and the
  // visible-since timestamp drive the pulse and a quick pop when it first appears over a cell.
  private readonly cellHighlight: THREE.Group;
  private readonly cellHighlightFill: THREE.MeshBasicMaterial;
  private readonly cellHighlightBorder: THREE.LineBasicMaterial;
  private cellHighlightShownAt = 0; // performance.now() the pad last landed on a (new) cell — drives the pop
  private cellHighlightX = 0;       // last cell centre, so a hop to a different cell replays the pop
  private cellHighlightZ = 0;
  private readonly carryShadow: THREE.Mesh;
  // Workshop proximity-zone discs, one per WorkshopZone entity (lazily created on first sight).
  // Pure view polish: a flat circle under each workshop, lit green when the rig is in range and
  // dim grey otherwise, so the "you can transfer now" state is unmistakable.
  private readonly zoneOverlays = new Map<EntityId, THREE.Mesh>();

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
    this.canvas = canvas;
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

    // A lighter, dusty wasteland ground so loose scrap (grey/rust) reads against it instead of
    // vanishing into a near-black floor.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshStandardMaterial({ color: 0x8a8275 }),
    );
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);
    // Grid lines tuned a touch darker than the new ground so they stay legible on the lighter floor.
    this.scene.add(new THREE.GridHelper(80, 80, 0x6f685c, 0x7d7669));

    // Target-cell highlight: a glow_green FILLED square + bright border, laid flat on the cell a
    // carried part would snap into — a glowing pad rather than a faint outline, so it reads as
    // eager to accept the part. depthWrite off + a renderOrder keep it from z-fighting the deck and
    // let it glow over the surface. The pulse (opacity + scale) is applied in showCellHighlight.
    this.cellHighlight = new THREE.Group();
    this.cellHighlightFill = new THREE.MeshBasicMaterial({
      color: 0x59ff9f, transparent: true, opacity: 0.4, depthWrite: false,
    });
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), this.cellHighlightFill);
    fill.renderOrder = 2;
    this.cellHighlightBorder = new THREE.LineBasicMaterial({
      color: 0x9dffc8, transparent: true, opacity: 0.95, depthWrite: false,
    });
    const border = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.PlaneGeometry(0.9, 0.9)), this.cellHighlightBorder,
    );
    border.renderOrder = 3;
    this.cellHighlight.add(fill, border);
    this.cellHighlight.rotation.x = -Math.PI / 2;
    this.cellHighlight.visible = false;
    this.scene.add(this.cellHighlight);

    // Carry shadow: a soft dark disc on the surface beneath a carried part, so the lift reads.
    this.carryShadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.45, 24),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 }),
    );
    this.carryShadow.rotation.x = -Math.PI / 2;
    this.carryShadow.visible = false;
    this.scene.add(this.carryShadow);

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
      // y is the entity's own height when it has one (a part on a deck, or lifted while carried);
      // otherwise fall back to the asset's resting height (a model sits on the ground at y=0).
      const restY = (obj.userData['restY'] as number) ?? 0;
      obj.position.set(t.x, t.y ?? restY, t.z);
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

  /**
   * Raycast the cursor against the given entities' objects and return the entity hit (nearest
   * first), or null. Walks up from the hit mesh to the registered group so a click on any child
   * mesh resolves to its owning entity. The candidate list keeps build picking from ever
   * selecting scenery — the caller passes exactly the parts that are grabbable.
   */
  pickEntity(clientX: number, clientY: number, candidates: EntityId[]): EntityId | null {
    const owner = new Map<THREE.Object3D, EntityId>();
    const objs: THREE.Object3D[] = [];
    for (const id of candidates) {
      const o = this.objects.get(id);
      if (o) {
        owner.set(o, id);
        objs.push(o);
      }
    }
    this.setRay(clientX, clientY);
    const hits = this.raycaster.intersectObjects(objs, true);
    if (hits.length === 0) return null;
    let o: THREE.Object3D | null = hits[0]!.object;
    while (o && !owner.has(o)) o = o.parent;
    return o ? owner.get(o)! : null;
  }

  /** Project the cursor onto a horizontal plane at height `planeY`; returns world x/z or null. */
  raycastPlane(clientX: number, clientY: number, planeY: number): { x: number; z: number } | null {
    this.setRay(clientX, clientY);
    this.dragPlane.constant = -planeY; // plane y = planeY, normal +Y
    if (!this.raycaster.ray.intersectPlane(this.dragPlane, this.hitPoint)) return null;
    return { x: this.hitPoint.x, z: this.hitPoint.z };
  }

  /**
   * Show the snap-target highlight on a cell at the given world pose (or hide it when null). The
   * pad breathes (opacity + scale) so the cell looks alive and eager to take the part, and pops up
   * with a quick overshoot the moment it first appears over a cell — a clear "this cell will accept
   * it" reaction, not a static marker. Both effects are pure view polish driven off the clock.
   */
  showCellHighlight(pose: { x: number; z: number; y: number; rotationY: number } | null): void {
    if (!pose) {
      if (this.cellHighlight.visible) this.cellHighlightShownAt = 0; // reset so the pop replays next time
      this.cellHighlight.visible = false;
      return;
    }
    const now = performance.now();
    // Replay the pop whenever it first appears OR hops to a different cell (cells are 1 m apart),
    // so every time the part moves over a new cell that cell visibly reacts.
    const hopped = Math.hypot(pose.x - this.cellHighlightX, pose.z - this.cellHighlightZ) > 0.5;
    if (!this.cellHighlight.visible || hopped) this.cellHighlightShownAt = now;
    this.cellHighlight.visible = true;
    this.cellHighlightX = pose.x;
    this.cellHighlightZ = pose.z;
    this.cellHighlight.position.set(pose.x, pose.y + 0.02, pose.z);

    // Steady breathing pulse (~1.1 Hz): a gentle in/out so the pad always looks active. Settled
    // scale stays at 0.94–1.0 so the 0.9 m pad never reaches the 1 m cell edge.
    const t = now / 1000;
    const breathe = 0.5 + 0.5 * Math.sin(t * 7); // 0..1
    // Appear-pop: a quick grow-IN from small over ~180 ms when it lands on a (new) cell. It scales
    // UP toward the settled size (never past it), so the cell springs to grab the part without the
    // pad ever rendering larger than the cell on arrival.
    const age = (now - this.cellHighlightShownAt) / 180;
    const growIn = age >= 1 ? 1 : 1 - Math.pow(1 - age, 3); // easeOutCubic 0..1

    const settled = 0.94 + breathe * 0.06; // 0.94–1.0
    const scale = settled * (0.7 + 0.3 * growIn); // 70%→100% of settled on arrival, max = settled
    this.cellHighlight.scale.set(scale, scale, 1);
    this.cellHighlight.rotation.set(-Math.PI / 2, 0, pose.rotationY);
    this.cellHighlightFill.opacity = (0.3 + breathe * 0.3) * (0.55 + 0.45 * growIn); // brighten as it grows in
  }

  /**
   * Show the carry shadow on the surface beneath a carried part (or hide it when null). `y` is
   * that surface's height — the rig's deck when the part hovers over it, the floor otherwise — so
   * the shadow climbs onto the blue platform instead of staying on the ground.
   *
   * Sits a touch ABOVE the cell highlight (which is at +0.02): when a part hovers over its snap
   * cell both land on the same deck, and lifting the shadow lets it composite cleanly on top of the
   * glowing pad instead of z-fighting it.
   */
  showCarryShadow(at: { x: number; z: number; y: number } | null): void {
    if (!at) {
      this.carryShadow.visible = false;
      return;
    }
    this.carryShadow.visible = true;
    this.carryShadow.position.set(at.x, at.y + 0.06, at.z);
  }

  /**
   * Draw each workshop's proximity zone as a flat disc on the ground, coloured by its gate state:
   * lit green while the rig is in range (the grid is a live drop target), dim grey otherwise (park
   * here to activate). Reads the WorkshopZone flag the sim owns — the disc is a pure projection.
   * The disc is sized to the zone radius once (radius is fixed) and reused thereafter.
   */
  syncWorkshopZones(world: World): void {
    for (const e of world.query(WorkshopZone, Transform)) {
      const zone = world.get(e, WorkshopZone)!;
      let disc = this.zoneOverlays.get(e);
      if (!disc) {
        disc = new THREE.Mesh(
          new THREE.CircleGeometry(zone.radius, 48),
          new THREE.MeshBasicMaterial({ color: 0x59ff9f, transparent: true, opacity: 0.18 }),
        );
        disc.rotation.x = -Math.PI / 2;
        this.scene.add(disc);
        this.zoneOverlays.set(e, disc);
      }
      const t = world.get(e, Transform)!;
      disc.position.set(t.x, 0.03, t.z); // just above the ground plane to avoid z-fighting
      const mat = disc.material as THREE.MeshBasicMaterial;
      mat.color.setHex(zone.active ? 0x59ff9f : 0x6f685c); // glow_green active, dim grey dormant
      mat.opacity = zone.active ? 0.28 : 0.14;
    }

    // Drop discs for any workshop that no longer exists.
    for (const [id, disc] of this.zoneOverlays) {
      if (!world.isAlive(id)) {
        this.scene.remove(disc);
        this.zoneOverlays.delete(id);
      }
    }
  }

  private setRay(clientX: number, clientY: number): void {
    const rect = this.canvas.getBoundingClientRect();
    this.ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.ndc, this.camera);
  }

  private createObject(r: Renderable): THREE.Object3D {
    return r.shape === 'model' ? this.createModel(r.assetId, r.scale ?? 1) : this.createBox(r);
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
  private createModel(assetId: string, scale = 1): THREE.Object3D {
    const group = new THREE.Group();
    group.userData['restY'] = 0;
    group.userData['wheels'] = []; // populated on load; animateWheels reads it (safe when empty)
    // Uniform resize of the authored asset (base-centre origin, so it stays grounded). Lets one GLB
    // serve at multiple sizes — e.g. the scrap-pile reused shrunk as a loose-scrap pickup.
    group.scale.setScalar(scale);

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

  /**
   * Show how full each storage container is: a scrap-coloured block rising inside the open-top
   * cube. Like animateWheels, this READS a sim component (Storage) each frame and drives a
   * view-owned mesh — the World owns the truth (amount/capacity), the block is a disposable
   * projection. The block is a child of the container group, so it rides, turns, and (for any
   * scaled container) scales along with it for free. Works whether the container is mounted or
   * dropped loose, so a container always shows the cargo it's carrying.
   *
   * The level is *eased* toward the Storage fraction rather than snapped: when a piece of scrap
   * lands, amount jumps by a whole unit, but the block glides up to the new level over a few
   * frames so the fill reads as a graceful rise (and would drain gracefully too). Purely cosmetic
   * smoothing — the displayed fraction is view state in userData, never game truth.
   */
  animateStorageFill(world: World, dt: number): void {
    for (const [id, obj] of this.objects) {
      const storage = world.isAlive(id) ? world.get(id, Storage) : undefined;
      if (!storage) continue;

      const target = Math.max(0, Math.min(1, storage.amount / storage.capacity));

      let fill = obj.userData['fill'] as THREE.Mesh | undefined;
      if (!fill) {
        // Sized to sit just inside the cube cavity authored in tools/blender/assets/storage.py
        // (0.84 m interior, floor top at 0.08 m). Created at full height; we scale Y to the fraction.
        fill = new THREE.Mesh(
          new THREE.BoxGeometry(STORAGE_FILL_W, STORAGE_FILL_MAX_H, STORAGE_FILL_W),
          new THREE.MeshStandardMaterial({ color: 0x6b6b6b }), // scrap_grey
        );
        obj.add(fill);
        obj.userData['fill'] = fill;
        obj.userData['fillFrac'] = target; // start AT the current level (no spurious rise on spawn)
      }

      // Ease the displayed level toward the real fraction; snap when within a hair to settle it.
      let shown = obj.userData['fillFrac'] as number;
      shown += (target - shown) * Math.min(1, dt * STORAGE_FILL_EASE);
      if (Math.abs(target - shown) < 0.001) shown = target;
      obj.userData['fillFrac'] = shown;

      fill.visible = shown > 0.001;
      fill.scale.y = Math.max(0.0001, shown);
      // Anchor the block's base at the container floor; its top climbs as it fills.
      fill.position.y = STORAGE_FLOOR_TOP + (STORAGE_FILL_MAX_H * shown) / 2;
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
