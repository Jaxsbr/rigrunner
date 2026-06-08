import * as THREE from 'three';
import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { TrackEmitter } from '@common/components/track-emitter';
import { planStamps, TRACK_STEP } from './track-stamp';

/**
 * Tread trails pressed into the ground by everything that drives — the rig and the camp guards (any
 * `TrackEmitter`). As a mover travels, soft dark tread-band decals are stamped along its path and slowly
 * fade out, so a run leaves a fading ribbon that curves through every turn. Pure view polish: it owns
 * only the decals + their ages, reads the sim purely for positions, and never touches game truth —
 * destroy the whole layer and the sim is unaffected, like the seepage stains and the animators.
 *
 * Marks are laid off POSITION-DELTA (planStamps), not any reported heading: a mover stamps only while it
 * actually moves, the trail bends with the real path, and a guard backing away marks correctly even
 * though it faces the rig. Dispatched from the composition root (`main.ts`) so the shared render tier
 * never imports a feature (ADR-003 §4).
 */

// Sit a hair above the ground, well under the seepage/camp stains (which draw at renderOrder 1) so a
// stain always composites OVER the tracks — pollution on top of tyre marks. A small per-stamp Y stagger
// (cycled, so it stays flat) keeps freshly-overlapping segments from z-fighting each other.
const TRACK_Y = 0.012;
const Y_LEVELS = 48;
const Y_STEP = 0.0002;

// Each mark is a little longer than the stamp spacing so consecutive marks overlap into one ribbon.
const SEGMENT_LENGTH = TRACK_STEP * 2.2;

// Lifetime: hold full for a stretch (the trail reads solid near the mover), then ease to nothing — so
// the FAR, older end of the trail fades while the fresh end stays crisp. Tunable to feel.
const LIFE = 6;
const HOLD_FRAC = 0.4;

// Subtle dark-on-tan; varied a touch per mark so a straightaway doesn't read as identical stamps.
const BASE_OPACITY = 0.5;
const OPACITY_VAR = 0.08;

// A long drive emits continuously; cap the live marks (oldest, most-faded dropped first) so it can't
// grow without bound. Each mark is one transparent quad sharing a texture — cheap at this count.
const MAX_SEGMENTS = 640;

interface Segment {
  mesh: THREE.Mesh;
  age: number;
  maxOpacity: number;
}

export class TrackMarks {
  private readonly segments: Segment[] = []; // FIFO: oldest first (creation order == age order)
  private readonly anchors = new Map<EntityId, { x: number; z: number }>(); // last stamp pos per emitter
  private readonly geometries = new Map<number, THREE.PlaneGeometry>(); // shared per gauge width
  private texture?: THREE.Texture; // the one shared tread texture, built lazily
  private stampCount = 0; // drives the Y stagger cycle

  constructor(private readonly scene: THREE.Scene) {}

  /** Stamp new marks behind each mover that has travelled, then advance every mark's fade by `dt`. */
  sync(world: World, dt: number): void {
    for (const e of world.query(TrackEmitter, Transform)) {
      const t = world.get(e, Transform)!;
      const anchor = this.anchors.get(e);
      if (!anchor) {
        // First sight: seed the anchor where it stands; don't streak a mark from the origin to here.
        this.anchors.set(e, { x: t.x, z: t.z });
        continue;
      }
      const width = world.get(e, TrackEmitter)!.width;
      const plan = planStamps(anchor.x, anchor.z, t.x, t.z);
      for (const s of plan.stamps) this.stamp(s.x, s.z, s.yaw, width);
      anchor.x = plan.nextX;
      anchor.z = plan.nextZ;
    }

    // Drop anchors for movers that are gone (a guard killed) so the map doesn't accumulate dead ids.
    for (const id of this.anchors.keys()) {
      if (!world.isAlive(id) || !world.has(id, TrackEmitter)) this.anchors.delete(id);
    }

    this.advance(dt);
  }

  /** Press one tread mark at (x,z) aligned to `yaw`, sized to the mover's gauge `width`. */
  private stamp(x: number, z: number, yaw: number, width: number): void {
    const mesh = new THREE.Mesh(
      this.geometry(width),
      new THREE.MeshBasicMaterial({
        map: this.treadTexture(),
        transparent: true,
        opacity: 0,
        depthWrite: false, // a decal: blends over the ground, never occludes anything above it
      }),
    );
    // Lay flat (rotate about X) and spin about its own normal (Z, applied first under the default XYZ
    // Euler order) so the mark's LENGTH points along travel: local +Y maps to world (−sin yaw, −cos yaw).
    mesh.rotation.set(-Math.PI / 2, 0, yaw);
    mesh.position.set(x, TRACK_Y + (this.stampCount % Y_LEVELS) * Y_STEP, z);
    mesh.renderOrder = -1; // below the seepage/camp stains so they sit on top of the tyre marks
    this.stampCount++;

    const maxOpacity = BASE_OPACITY + (Math.random() * 2 - 1) * OPACITY_VAR;
    this.scene.add(mesh);
    this.segments.push({ mesh, age: 0, maxOpacity });

    if (this.segments.length > MAX_SEGMENTS) this.dispose(this.segments.shift()!); // drop the oldest
  }

  /** Age every mark; fade past the hold; dispose the front ones that have fully faded. */
  private advance(dt: number): void {
    const holdFor = LIFE * HOLD_FRAC;
    for (const seg of this.segments) {
      seg.age += dt;
      const p = seg.age <= holdFor ? 1 : Math.max(0, 1 - (seg.age - holdFor) / (LIFE - holdFor));
      (seg.mesh.material as THREE.MeshBasicMaterial).opacity = p * seg.maxOpacity;
    }
    while (this.segments.length > 0 && this.segments[0]!.age >= LIFE) {
      this.dispose(this.segments.shift()!);
    }
  }

  private dispose(seg: Segment): void {
    this.scene.remove(seg.mesh);
    (seg.mesh.material as THREE.Material).dispose(); // shared geometry + texture are reused, not disposed
  }

  /** A flat quad sized to the gauge `width` × the fixed segment length, cached and shared per width. */
  private geometry(width: number): THREE.PlaneGeometry {
    const cached = this.geometries.get(width);
    if (cached) return cached;
    const geo = new THREE.PlaneGeometry(width, SEGMENT_LENGTH);
    this.geometries.set(width, geo);
    return geo;
  }

  /** The shared tread texture: two soft dark bands (the wheel/track lines) broken into lugs. */
  private treadTexture(): THREE.Texture {
    if (this.texture) return this.texture;
    const tex = new THREE.CanvasTexture(drawTread());
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    this.texture = tex;
    return tex;
  }
}

/**
 * Draw a top-down tread mark: two soft vertical bands (U = across the gauge, V = along travel), each a
 * dark line with feathered side edges, then carved into lugs by erasing periodic cross-gaps from both at
 * once. Reads as two parallel tyre/track lines with a faint rung pattern — subtle against the tan ground.
 */
function drawTread(): HTMLCanvasElement {
  const W = 64; // across the gauge (U)
  const H = 96; // along travel (V)
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Two bands, feathered across their width so the sides dissolve into the ground (no hard edge).
  const bandHalf = W * 0.09;
  for (const centre of [W * 0.28, W * 0.72]) {
    const g = ctx.createLinearGradient(centre - bandHalf, 0, centre + bandHalf, 0);
    g.addColorStop(0.0, 'rgba(44,37,29,0)');
    g.addColorStop(0.5, 'rgba(44,37,29,0.95)'); // dark warm core
    g.addColorStop(1.0, 'rgba(44,37,29,0)');
    ctx.fillStyle = g;
    ctx.fillRect(centre - bandHalf, 0, bandHalf * 2, H);
  }

  // Carve lug separations: erase a fraction of the alpha in periodic cross-gaps. Subtracting (not
  // painting) keeps the feathered side edges intact while breaking the lines into rungs.
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  const pitch = 12;
  for (let y = 0; y < H; y += pitch) ctx.fillRect(0, y, W, pitch * 0.42);
  ctx.globalCompositeOperation = 'source-over';

  return canvas;
}
