import * as THREE from 'three';
import type { World } from '../core/world';
import type { EntityId } from '../core/types';
import { Transform } from '../components/transform';
import { Collectible } from '../components/collectible';

/**
 * Seepage stains under loose scrap: a soft, dark oily smudge laid flat on the ground beneath every
 * loose-scrap piece. Pure view polish — it owns only the decals and their eased opacity, reading the
 * sim purely to know which scrap still exists. Two directions, mirroring the core loop's cause→effect:
 *   - a piece spawns (startup field OR a pile's rummage burst) → its stain **fades in** = pollution seeps in
 *   - a piece is collected (its entity destroyed) → its stain **fades out** = the land cleans up
 *
 * The fade-out is driven by *noticing the scrap is gone*, not by any signal from the collection
 * system: every frame, any decal whose owner entity is no longer a live Collectible eases toward
 * zero and is disposed when invisible. That keeps the collection/collision/loot/storage seams
 * completely untouched — this layer is a one-way projection of the world (destroy it, the sim is
 * unaffected), exactly like InteractionHints and the sim-driven animators.
 *
 * Decals track `Collectible` (which today *is* loose scrap; see components/collectible.ts). One shared
 * radial-gradient canvas texture is reused across all stains; only per-piece size varies, so the
 * field reads as organic seepage rather than stamped copies.
 */

// Lay the decal a hair above the ground/grid (both at y=0) so it composites over them without
// z-fighting, while sitting below the scrap model itself.
const STAIN_Y = 0.02;

// Stain footprint (plane half-width, world metres) — a touch larger than the scrap's 0.4 m pickup
// radius so the seepage haloes out past the junk. Randomised per piece for an uneven field.
const STAIN_MIN_R = 0.6;
const STAIN_MAX_R = 0.95;

// Eased fades (exp-lerp per second, the same easing animateStorageFill / animateScrapPile use).
// In is a gradual seep (~2 s to full); out is a slower, unhurried heal (~3 s) — the land taking its
// time to clean. Both far below the UI hints' snappy FADE_RATE of 6, on purpose.
const FADE_IN_EASE = 1.6;
const FADE_OUT_EASE = 1.0;

// A stain is a smudge, not a hole — full progress maps to this material opacity, never fully opaque.
const STAIN_MAX_OPACITY = 0.5;

interface Stain {
  mesh: THREE.Mesh;
  progress: number; // 0..1 fade state; material opacity = progress * STAIN_MAX_OPACITY
}

export class ScrapStains {
  private readonly stains = new Map<EntityId, Stain>();
  private texture?: THREE.Texture; // one shared radial-gradient blob, built lazily

  constructor(private readonly scene: THREE.Scene) {}

  /**
   * Reconcile decals with the loose scrap in the world and advance their fades by `dt`. Live pieces
   * gain a stain (if new) and fade IN; pieces that have gone fade OUT and are disposed when invisible.
   */
  sync(world: World, dt: number): void {
    // 1. Every live loose-scrap piece has a stain, fading in (pollution seeping in). Pin it to the
    //    piece's position — loose scrap doesn't move, but this is cheap and keeps them aligned.
    for (const e of world.query(Collectible, Transform)) {
      const stain = this.stains.get(e) ?? this.spawn(e, world);
      const t = world.get(e, Transform)!;
      stain.mesh.position.set(t.x, STAIN_Y, t.z);
      this.ease(stain, 1, dt * FADE_IN_EASE);
    }

    // 2. Any stain whose owner is no longer a live Collectible fades out (the land cleaning), then is
    //    disposed once invisible. Deleting the current entry mid-iteration is safe for a Map.
    for (const [id, stain] of this.stains) {
      if (world.isAlive(id) && world.has(id, Collectible)) continue; // still owned — handled above
      this.ease(stain, 0, dt * FADE_OUT_EASE);
      if (stain.progress <= 0.001) this.dispose(id, stain);
    }
  }

  /** Create a flat ground decal for a piece of loose scrap, started fully faded out. */
  private spawn(e: EntityId, world: World): Stain {
    const r = STAIN_MIN_R + Math.random() * (STAIN_MAX_R - STAIN_MIN_R);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(r * 2, r * 2),
      new THREE.MeshBasicMaterial({
        map: this.blobTexture(),
        transparent: true,
        opacity: 0,
        depthWrite: false, // a decal: blends over the ground, never occludes the scrap above it
      }),
    );
    mesh.rotation.x = -Math.PI / 2; // lay the plane flat on the ground
    mesh.visible = false;
    const t = world.get(e, Transform)!;
    mesh.position.set(t.x, STAIN_Y, t.z);
    this.scene.add(mesh);

    const stain: Stain = { mesh, progress: 0 };
    this.stains.set(e, stain);
    return stain;
  }

  /** Ease a stain's progress toward `target` and project it onto the material opacity/visibility. */
  private ease(stain: Stain, target: number, k: number): void {
    let p = stain.progress + (target - stain.progress) * Math.min(1, k);
    if (Math.abs(target - p) < 0.001) p = target; // snap to settle
    stain.progress = p;
    (stain.mesh.material as THREE.MeshBasicMaterial).opacity = p * STAIN_MAX_OPACITY;
    stain.mesh.visible = p > 0.001;
  }

  private dispose(id: EntityId, stain: Stain): void {
    this.scene.remove(stain.mesh);
    stain.mesh.geometry.dispose();
    (stain.mesh.material as THREE.Material).dispose(); // the shared texture is reused — not disposed
    this.stains.delete(id);
  }

  /** The shared soft-edged seepage blob, drawn once onto a canvas and cached. */
  private blobTexture(): THREE.Texture {
    if (this.texture) return this.texture;
    const tex = new THREE.CanvasTexture(drawStainBlob());
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    this.texture = tex;
    return tex;
  }
}

/**
 * Draw a soft oily seepage blob: a dark radial core fading to fully transparent at the rim (so it
 * dissolves into the dusty ground with no hard edge), with a few off-centre darker pools for an
 * uneven, seeped-in look rather than a clean disc.
 */
function drawStainBlob(): HTMLCanvasElement {
  const S = 128;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d')!;
  const cx = S / 2, cy = S / 2;

  // Main seepage: dark oily core → rusty mid → clean fade to nothing at the rim.
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, S / 2);
  g.addColorStop(0.0, 'rgba(38,32,26,0.95)'); // dark oily core
  g.addColorStop(0.5, 'rgba(46,40,30,0.55)'); // rusty mid
  g.addColorStop(0.8, 'rgba(46,40,30,0.18)');
  g.addColorStop(1.0, 'rgba(46,40,30,0.0)');  // dissolve into the ground
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, S / 2, 0, Math.PI * 2);
  ctx.fill();

  // A few darker pools, offset from centre, to break the symmetry into a seeped puddle.
  for (const [ox, oy, rr, a] of [[-18, -10, 16, 0.5], [20, 14, 12, 0.45], [8, -22, 9, 0.4]] as const) {
    const b = ctx.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, rr);
    b.addColorStop(0, `rgba(26,22,17,${a})`);
    b.addColorStop(1, 'rgba(26,22,17,0)');
    ctx.fillStyle = b;
    ctx.beginPath();
    ctx.arc(cx + ox, cy + oy, rr, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas;
}
