import * as THREE from 'three';
import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { Camp } from './camp';

/**
 * The camp's environmental mess: a layered cluster of dark blotches laid flat under each camp — oily
 * seepage and burnt scorch, scattered and varied so it reads as a fought-over, occupied site rather than
 * one stamped disc. Pure view polish (it owns only the decals + their eased opacity, reading the sim to
 * know each camp's state), at camp scale. It carries the core loop's cause→effect:
 *   - a camp stands (`GUARDED`/`DISARMABLE`) → its blotches hold, marking it as a blight on the land
 *   - the camp is `CLEARED` → they fade out together = the world visibly cleans up as the camp dissolves
 *
 * Like every render layer here it's a one-way projection — destroy it and the sim is untouched. The
 * lasting scar (the stump) is a separate, persistent `RestorableSite` prop; these blotches are the
 * impermanent grime that the clean-up wipes away.
 */

const STAIN_Y = 0.02; // a hair above the ground so it composites without z-fighting
const BLOTCH_COUNT = 6; // blotches per camp — a layered puddle, not a single disc
const SPREAD = 4.6; // how far blotches scatter from the camp centre (the mess is wide)
const BLOTCH_MIN_R = 1.4;
const BLOTCH_MAX_R = 3.2;
const BLOTCH_MIN_ASPECT = 0.55; // minor axis as a fraction of major: 1 ≈ round, lower = a stretched oval
const BLOTCH_MIN_OPACITY = 0.4;
const BLOTCH_MAX_OPACITY = 0.72;
const TEXTURE_VARIANTS = 6; // indices 0–2 oily seepage, 3–5 burnt scorch — each blotch picks one
const FADE_OUT_EASE = 0.25; // slow clean-up creep once cleared (~12 s), never a pop

interface Blotch {
  mesh: THREE.Mesh;
  maxOpacity: number;
}

interface Stain {
  blotches: Blotch[];
  progress: number; // 0..1 shared fade state for the whole cluster
}

export class CampStains {
  private readonly stains = new Map<EntityId, Stain>();
  private readonly textures: THREE.Texture[] = []; // a pool of distinct blotch textures, built lazily

  constructor(private readonly scene: THREE.Scene) {}

  /** Reconcile a blotch cluster per camp; ease it out once the camp is cleared, dispose it when gone. */
  sync(world: World, dt: number): void {
    for (const c of world.query(Camp, Transform)) {
      const stain = this.stains.get(c) ?? this.spawn(c, world);
      const cleared = world.get(c, Camp)!.state === 'cleared';
      this.ease(stain, cleared ? 0 : 1, cleared ? dt * FADE_OUT_EASE : 1); // snap in, fade out
    }
    for (const [id, stain] of this.stains) {
      if (world.isAlive(id) && world.has(id, Camp)) continue;
      this.dispose(id, stain); // the camp entity itself is gone — drop its decals
    }
  }

  private spawn(c: EntityId, world: World): Stain {
    const t = world.get(c, Transform)!;
    const blotches: Blotch[] = [];
    for (let i = 0; i < BLOTCH_COUNT; i++) {
      const r = BLOTCH_MIN_R + Math.random() * (BLOTCH_MAX_R - BLOTCH_MIN_R);
      const aspect = BLOTCH_MIN_ASPECT + Math.random() * (1 - BLOTCH_MIN_ASPECT);
      const maxOpacity = BLOTCH_MIN_OPACITY + Math.random() * (BLOTCH_MAX_OPACITY - BLOTCH_MIN_OPACITY);
      const variant = Math.floor(Math.random() * TEXTURE_VARIANTS);
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(r * 2, r * 2 * aspect), // unequal sides → an oval; aspect 1 ≈ round
        new THREE.MeshBasicMaterial({ map: this.blobTexture(variant), transparent: true, opacity: 0, depthWrite: false }),
      );
      // Lay flat (rotate about X) and spin about its own normal (Z) so the oval points any which way.
      mesh.rotation.set(-Math.PI / 2, 0, Math.random() * Math.PI);
      // Scatter the blotch off the camp centre — denser toward the middle (sqrt keeps the spread even).
      const ang = Math.random() * Math.PI * 2;
      const dist = Math.sqrt(Math.random()) * SPREAD;
      mesh.position.set(t.x + Math.cos(ang) * dist, STAIN_Y, t.z + Math.sin(ang) * dist);
      mesh.visible = false;
      this.scene.add(mesh);
      blotches.push({ mesh, maxOpacity });
    }
    const stain: Stain = { blotches, progress: 0 };
    this.stains.set(c, stain);
    return stain;
  }

  private ease(stain: Stain, target: number, k: number): void {
    let p = stain.progress + (target - stain.progress) * Math.min(1, k);
    if (Math.abs(target - p) < 0.001) p = target;
    stain.progress = p;
    for (const b of stain.blotches) {
      (b.mesh.material as THREE.MeshBasicMaterial).opacity = p * b.maxOpacity;
      b.mesh.visible = p > 0.001;
    }
  }

  private dispose(id: EntityId, stain: Stain): void {
    for (const b of stain.blotches) {
      this.scene.remove(b.mesh);
      b.mesh.geometry.dispose();
      (b.mesh.material as THREE.Material).dispose(); // the shared texture pool is reused — not disposed
    }
    this.stains.delete(id);
  }

  /** One of the shared blotch textures, drawn once and cached by variant index. Variants 0–2 are oily
   *  seepage, 3–5 are burnt scorch — so a cluster mixes grime and damage. */
  private blobTexture(variant: number): THREE.Texture {
    const cached = this.textures[variant];
    if (cached) return cached;
    const tex = new THREE.CanvasTexture(drawStainBlob(variant >= 3));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    this.textures[variant] = tex;
    return tex;
  }
}

/**
 * Draw a soft blotch: a dark core fading to fully transparent at the rim (so it dissolves into the
 * ground with no hard edge), with a random scatter of off-centre darker pools that break the disc into
 * an organic puddle. `scorch` shifts the tone from oily brown to charred grey-black, so a camp's cluster
 * reads as a mix of spilled grime and burnt ground. Core darkness, falloff, and pool layout all vary per
 * call, so each variant carries a visibly distinct pattern.
 */
function drawStainBlob(scorch: boolean): HTMLCanvasElement {
  const S = 128;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d')!;
  const cx = S / 2, cy = S / 2;

  // Oily seepage is rusty brown; scorch is a colder charred grey — both dark, both dissolving to nothing.
  const core = scorch ? '26,24,22' : '40,33,26';
  const mid = scorch ? '34,32,30' : '48,40,30';
  const coreA = 0.8 + Math.random() * 0.15;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, S / 2);
  g.addColorStop(0.0, `rgba(${core},${coreA})`);
  g.addColorStop(0.42 + Math.random() * 0.12, `rgba(${mid},0.5)`);
  g.addColorStop(0.8, `rgba(${mid},0.16)`);
  g.addColorStop(1.0, `rgba(${mid},0.0)`); // dissolve into the ground
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
    b.addColorStop(0, `rgba(${scorch ? '16,15,14' : '26,22,17'},${a})`);
    b.addColorStop(1, `rgba(${scorch ? '16,15,14' : '26,22,17'},0)`);
    ctx.fillStyle = b;
    ctx.beginPath();
    ctx.arc(cx + ox, cy + oy, rr, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas;
}
