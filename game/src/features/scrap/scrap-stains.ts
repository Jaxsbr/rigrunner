import * as THREE from 'three';
import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { Collectible } from '@features/scrap/collectible';

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
 * Decals track `Collectible` (which today *is* loose scrap; see components/collectible.ts). Each
 * stain is deliberately *uneven* — it picks one of a small pool of distinct blotch textures and a
 * random size, ovalness + orientation, and darkness — so the field reads as organic seepage rather
 * than stamped copies of one disc.
 */

// Lay the decal a hair above the ground/grid (both at y=0) so it composites over them without
// z-fighting, while sitting below the scrap model itself.
const STAIN_Y = 0.02;

// Per-piece footprint (plane half-extent, world metres). A wide range — some pieces barely mark the
// ground, others bleed a big puddle past the scrap's 0.4 m pickup radius.
const STAIN_MIN_R = 0.45;
const STAIN_MAX_R = 1.3;

// Ovalness: the minor axis as a fraction of the major. 1.0 = round; lower = a stretched oval. Each
// stain is then spun to a random orientation, so ovals point every which way.
const STAIN_MIN_ASPECT = 0.55;

// Darkness varies per piece: full progress maps somewhere in this opacity band, so some stains read
// as deep oily pools and others as lighter seepage. The band sits high so even the lightest stain
// reads clearly against the dusty ground; never fully opaque — a dark smudge, not a hole.
const STAIN_MIN_OPACITY = 0.5;
const STAIN_MAX_OPACITY = 0.85;

// Distinct blotch-pattern textures, built once and shared; each stain picks one at random.
const TEXTURE_VARIANTS = 6;

// Eased fades (exp-lerp per second, the same easing animateStorageFill / animateScrapPile use), kept
// very slow on purpose: the pollution takes its time seeping IN (~8 s), and the land takes even
// longer to clean OUT (~14 s) — a gradual creep you barely catch happening, never a pop.
const FADE_IN_EASE = 0.35;
const FADE_OUT_EASE = 0.2;

interface Stain {
  mesh: THREE.Mesh;
  progress: number;    // 0..1 fade state; material opacity = progress * maxOpacity
  maxOpacity: number;  // this stain's own darkness ceiling (varies per piece)
}

export class ScrapStains {
  private readonly stains = new Map<EntityId, Stain>();
  private readonly textures: THREE.Texture[] = []; // a pool of distinct blotch textures, built lazily

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

  /** Create a flat ground decal for a piece of loose scrap — random size/ovalness/darkness/pattern. */
  private spawn(e: EntityId, world: World): Stain {
    const r = STAIN_MIN_R + Math.random() * (STAIN_MAX_R - STAIN_MIN_R);
    const aspect = STAIN_MIN_ASPECT + Math.random() * (1 - STAIN_MIN_ASPECT); // 1 ≈ round, lower = oval
    const maxOpacity = STAIN_MIN_OPACITY + Math.random() * (STAIN_MAX_OPACITY - STAIN_MIN_OPACITY);
    const variant = Math.floor(Math.random() * TEXTURE_VARIANTS);

    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(r * 2, r * 2 * aspect), // unequal sides → an oval; aspect 1 ≈ round
      new THREE.MeshBasicMaterial({
        map: this.blobTexture(variant),
        transparent: true,
        opacity: 0,
        depthWrite: false, // a decal: blends over the ground, never occludes the scrap above it
      }),
    );
    // Lay the plane flat (rotate about X) and spin it about its own normal (Z, applied first under the
    // default XYZ Euler order) so the oval's long axis points in a random ground-plane direction.
    mesh.rotation.set(-Math.PI / 2, 0, Math.random() * Math.PI);
    mesh.renderOrder = 1; // draw above the proximity-zone disc so a stain is never hidden inside it
    mesh.visible = false;
    const t = world.get(e, Transform)!;
    mesh.position.set(t.x, STAIN_Y, t.z);
    this.scene.add(mesh);

    const stain: Stain = { mesh, progress: 0, maxOpacity };
    this.stains.set(e, stain);
    return stain;
  }

  /** Ease a stain's progress toward `target` and project it onto the material opacity/visibility. */
  private ease(stain: Stain, target: number, k: number): void {
    let p = stain.progress + (target - stain.progress) * Math.min(1, k);
    if (Math.abs(target - p) < 0.001) p = target; // snap to settle
    stain.progress = p;
    (stain.mesh.material as THREE.MeshBasicMaterial).opacity = p * stain.maxOpacity;
    stain.mesh.visible = p > 0.001;
  }

  private dispose(id: EntityId, stain: Stain): void {
    this.scene.remove(stain.mesh);
    stain.mesh.geometry.dispose();
    (stain.mesh.material as THREE.Material).dispose(); // the shared texture pool is reused — not disposed
    this.stains.delete(id);
  }

  /** One of the shared seepage-blob textures, drawn once onto a canvas and cached by variant index. */
  private blobTexture(variant: number): THREE.Texture {
    const cached = this.textures[variant];
    if (cached) return cached;
    const tex = new THREE.CanvasTexture(drawStainBlob());
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    this.textures[variant] = tex;
    return tex;
  }
}

/**
 * Draw a soft oily seepage blob: a dark radial core fading to fully transparent at the rim (so it
 * dissolves into the dusty ground with no hard edge), with a random scatter of off-centre darker
 * pools. Core darkness, the falloff, and the count/position/size/depth of the pools all vary per
 * call, so each generated variant carries a visibly distinct pattern rather than the same disc.
 */
function drawStainBlob(): HTMLCanvasElement {
  const S = 128;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d')!;
  const cx = S / 2, cy = S / 2;

  // Main seepage: dark oily core → rusty mid → clean fade to nothing at the rim. Core darkness and
  // the mid-stop drift a little so the variants don't share one tone/falloff.
  const coreA = 0.82 + Math.random() * 0.14;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, S / 2);
  g.addColorStop(0.0, `rgba(38,32,26,${coreA})`);           // dark oily core
  g.addColorStop(0.42 + Math.random() * 0.12, 'rgba(46,40,30,0.5)'); // rusty mid
  g.addColorStop(0.8, 'rgba(46,40,30,0.16)');
  g.addColorStop(1.0, 'rgba(46,40,30,0.0)');                // dissolve into the ground
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, S / 2, 0, Math.PI * 2);
  ctx.fill();

  // A random scatter of darker pools breaks the disc into an uneven, organic puddle.
  const pools = 3 + Math.floor(Math.random() * 4); // 3..6 pools
  for (let i = 0; i < pools; i++) {
    const ang = Math.random() * Math.PI * 2;
    const dist = Math.random() * S * 0.32;
    const ox = Math.cos(ang) * dist, oy = Math.sin(ang) * dist;
    const rr = 7 + Math.random() * 15;
    const a = 0.3 + Math.random() * 0.3;
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
