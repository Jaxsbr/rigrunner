import * as THREE from 'three';
import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { Camp } from './camp';

/**
 * The camp's environmental mess: a dense, layered contamination laid flat under each camp — dark oil
 * pools (with a wet sheen), charred scorch, and rust-discoloured ground — scattered and overlapped so the
 * earth clearly reads as polluted and fought-over, not a faint smudge. Pure view polish (it owns only the
 * decals + their eased opacity, reading the sim to know each camp's state). It carries the core loop's
 * cause→effect:
 *   - a camp stands (`GUARDED`/`DISARMABLE`) → its pools hold, marking it as a blight on the land
 *   - the camp is `CLEARED` → they fade out together = the world visibly cleans up as the camp dissolves
 *
 * Like every render layer here it's a one-way projection — destroy it and the sim is untouched. The
 * lasting marker (the sprout) is a separate, persistent `RestorableSite` prop; these pools are the
 * impermanent contamination that the clean-up wipes away.
 */

const STAIN_Y = 0.02; // a hair above the ground so it composites without z-fighting
const SPREAD = 3.4; // blotches cluster this tightly around the camp centre → a dense pool, not dots
const BLOTCH_MIN_ASPECT = 0.6; // minor axis as a fraction of major: 1 ≈ round, lower = a stretched oval
const FADE_OUT_EASE = 0.25; // slow clean-up creep once cleared (~12 s), never a pop

type BlotchKind = 'oil' | 'scorch' | 'rust';

/** The mess is a MIX of pool kinds, layered for a contaminated zone. Oil reads darkest/heaviest, scorch
 *  is the charred middle, rust is the discoloured spread that contrasts the dusty ground. */
const BLOTCH_MIX: { kind: BlotchKind; count: number; minR: number; maxR: number; minOp: number; maxOp: number }[] = [
  { kind: 'oil', count: 3, minR: 1.6, maxR: 3.0, minOp: 0.82, maxOp: 0.95 },
  { kind: 'scorch', count: 3, minR: 1.4, maxR: 2.8, minOp: 0.68, maxOp: 0.88 },
  { kind: 'rust', count: 3, minR: 1.8, maxR: 3.4, minOp: 0.55, maxOp: 0.78 },
];
const TEXTURE_VARIANTS = 3; // distinct patterns per kind, built lazily + shared

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
  private readonly textures = new Map<string, THREE.Texture>(); // pool keyed by `${kind}:${variant}`

  constructor(private readonly scene: THREE.Scene) {}

  /** Reconcile a contamination cluster per camp; ease it out once the camp is cleared, dispose it when gone. */
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
    let layer = 0; // a tiny per-blotch Y stagger so the overlapped, coplanar pools never z-fight
    for (const m of BLOTCH_MIX) {
      for (let i = 0; i < m.count; i++) {
        const r = m.minR + Math.random() * (m.maxR - m.minR);
        const aspect = BLOTCH_MIN_ASPECT + Math.random() * (1 - BLOTCH_MIN_ASPECT);
        const maxOpacity = m.minOp + Math.random() * (m.maxOp - m.minOp);
        const variant = Math.floor(Math.random() * TEXTURE_VARIANTS);
        const mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(r * 2, r * 2 * aspect), // unequal sides → an oval; aspect 1 ≈ round
          new THREE.MeshBasicMaterial({ map: this.blobTexture(m.kind, variant), transparent: true, opacity: 0, depthWrite: false }),
        );
        // Lay flat (rotate about X) and spin about its own normal (Z) so the oval points any which way.
        mesh.rotation.set(-Math.PI / 2, 0, Math.random() * Math.PI);
        // Scatter off the camp centre — denser toward the middle (sqrt keeps the spread even) so the
        // pools pile up into one contaminated zone rather than scattering thin.
        const ang = Math.random() * Math.PI * 2;
        const dist = Math.sqrt(Math.random()) * SPREAD;
        mesh.position.set(t.x + Math.cos(ang) * dist, STAIN_Y + layer * 0.0012, t.z + Math.sin(ang) * dist);
        mesh.renderOrder = 1; // draw above the proximity-ring disc so a pool is never hidden inside it
        mesh.visible = false;
        this.scene.add(mesh);
        blotches.push({ mesh, maxOpacity });
        layer++;
      }
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

  /** One of the shared pool textures, drawn once and cached by `${kind}:${variant}`. */
  private blobTexture(kind: BlotchKind, variant: number): THREE.Texture {
    const key = `${kind}:${variant}`;
    const cached = this.textures.get(key);
    if (cached) return cached;
    const tex = new THREE.CanvasTexture(drawStainBlob(kind));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    this.textures.set(key, tex);
    return tex;
  }
}

/** The per-kind palette for the contamination decals (canvas rgba, not the GLB palette): oil is a near-
 *  black slick, scorch is charred warm-dark, rust is a saturated discoloured patch that pops off the
 *  dusty ground. `[core, mid, pool]` are the gradient core, the mid-ring, and the darker scatter pools. */
const KIND_COLOURS: Record<BlotchKind, { core: string; mid: string; pool: string; sheen: boolean }> = {
  oil: { core: '8,10,12', mid: '14,16,18', pool: '4,5,6', sheen: true },
  scorch: { core: '24,20,16', mid: '34,30,24', pool: '12,10,8', sheen: false },
  rust: { core: '120,62,28', mid: '92,50,26', pool: '66,34,16', sheen: false },
};

/**
 * Draw a soft contamination blotch: a dark core fading to fully transparent at the rim (so it dissolves
 * into the ground with no hard edge), with a random scatter of off-centre darker pools that break the
 * disc into an organic puddle. Oil also gets a small off-centre cool sheen highlight so it reads as a
 * wet slick. Core alpha, falloff, and pool layout all vary per call, so each variant is distinct.
 */
function drawStainBlob(kind: BlotchKind): HTMLCanvasElement {
  const S = 128;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d')!;
  const cx = S / 2, cy = S / 2;
  const col = KIND_COLOURS[kind];

  const coreA = 0.86 + Math.random() * 0.12;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, S / 2);
  g.addColorStop(0.0, `rgba(${col.core},${coreA})`);
  g.addColorStop(0.45 + Math.random() * 0.12, `rgba(${col.mid},0.62)`);
  g.addColorStop(0.82, `rgba(${col.mid},0.2)`);
  g.addColorStop(1.0, `rgba(${col.mid},0.0)`); // dissolve into the ground
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, S / 2, 0, Math.PI * 2);
  ctx.fill();

  // A random scatter of darker pools breaks the disc into an uneven, organic puddle.
  const pools = 4 + Math.floor(Math.random() * 4); // 4..7 pools
  for (let i = 0; i < pools; i++) {
    const ang = Math.random() * Math.PI * 2;
    const dist = Math.random() * S * 0.34;
    const ox = Math.cos(ang) * dist, oy = Math.sin(ang) * dist;
    const rr = 8 + Math.random() * 16;
    const a = 0.35 + Math.random() * 0.35;
    const b = ctx.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, rr);
    b.addColorStop(0, `rgba(${col.pool},${a})`);
    b.addColorStop(1, `rgba(${col.pool},0)`);
    ctx.fillStyle = b;
    ctx.beginPath();
    ctx.arc(cx + ox, cy + oy, rr, 0, Math.PI * 2);
    ctx.fill();
  }

  // Oil catches the light: a small off-centre cool highlight so the slick reads as wet, not just dark.
  if (col.sheen) {
    const ox = (Math.random() - 0.5) * S * 0.3;
    const oy = (Math.random() - 0.5) * S * 0.3;
    const rr = 10 + Math.random() * 12;
    const s = ctx.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, rr);
    s.addColorStop(0, 'rgba(70,84,96,0.45)');
    s.addColorStop(1, 'rgba(70,84,96,0)');
    ctx.fillStyle = s;
    ctx.beginPath();
    ctx.arc(cx + ox, cy + oy, rr, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas;
}
