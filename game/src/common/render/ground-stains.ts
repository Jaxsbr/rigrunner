import * as THREE from 'three';

/**
 * Shared ground-contamination decal engine. Builds a cluster of soft, flat canvas blotches scattered
 * under a world feature so the earth reads as polluted — dark oil pools, rust discolouration, charred
 * scorch, whatever palette the caller supplies. Pure view machinery: it owns the meshes, the per-cluster
 * eased opacity, and a shared canvas-texture pool; it reads no game state and mutates none.
 *
 * The reusable part is the MECHANICS (draw a blotch, build/ease/dispose a cluster, cache textures). Each
 * caller owns its own CONFIG — the per-kind colours (`StainPalette`), the layered `mix` (how many of each
 * kind, at what reach/size/opacity), and the lifecycle (which entities get a cluster, and when it fades).
 * Two consumers today: the looter camp's standing-mess contamination and the scrap pile's pollution.
 */

const STAIN_Y = 0.02;          // a hair above the ground (y=0) so a decal composites without z-fighting
const LAYER_STAGGER = 0.0012;  // tiny per-blotch Y step so overlapped, coplanar pools never z-fight
const BLOTCH_MIN_ASPECT = 0.6; // minor axis as a fraction of major: 1 ≈ round, lower = a stretched oval
const TEXTURE_VARIANTS = 3;    // distinct generated patterns per kind, built lazily + shared by all clusters

/** The canvas rgba tones for one contamination kind (NOT the GLB palette): `[core, mid, pool]` are the
 *  gradient core, the mid-ring, and the darker scatter pools; `sheen` adds a wet cool highlight (oil). */
export interface StainColour {
  core: string;
  mid: string;
  pool: string;
  sheen: boolean;
}

/** The per-kind colour table for a consumer's contamination (e.g. `{ oil, rust }`). */
export type StainPalette<K extends string> = Record<K, StainColour>;

/** One layer of a contamination mix: `count` blotches of `kind`, scattered to `spread` metres from the
 *  centre, each sized in `[minR,maxR]` (plane half-extent) at an opacity ceiling in `[minOp,maxOp]`. */
export interface BlotchLayer<K extends string> {
  kind: K;
  count: number;
  spread: number;
  minR: number;
  maxR: number;
  minOp: number;
  maxOp: number;
}

/** A built cluster of decal meshes sharing one eased fade `progress` (0..1). */
export interface StainCluster {
  blotches: { mesh: THREE.Mesh; maxOpacity: number }[];
  progress: number;
}

/**
 * Owns the scene handle, the caller's colour palette, and the shared canvas-texture pool. One field per
 * consumer (camp / pile); the consumer keeps its own `Map<EntityId, StainCluster>` and drives when each
 * cluster fades in/out.
 */
export class GroundStainField<K extends string> {
  private readonly textures = new Map<string, THREE.Texture>(); // pooled, keyed by `${kind}:${variant}`

  constructor(
    private readonly scene: THREE.Scene,
    private readonly palette: StainPalette<K>,
  ) {}

  /**
   * Build a contamination cluster centred on `(centre.x, centre.z)` from a layered `mix`. Each blotch is
   * a flat oval decal at a random size/ovalness/orientation/darkness, scattered off the centre to its
   * layer's reach (denser toward the middle — `sqrt` keeps the spread even). Starts invisible; the caller
   * eases it in. The meshes are added to the scene immediately.
   */
  build(centre: { x: number; z: number }, mix: BlotchLayer<K>[]): StainCluster {
    const blotches: { mesh: THREE.Mesh; maxOpacity: number }[] = [];
    let layer = 0;
    for (const m of mix) {
      for (let i = 0; i < m.count; i++) {
        const r = m.minR + Math.random() * (m.maxR - m.minR);
        const aspect = BLOTCH_MIN_ASPECT + Math.random() * (1 - BLOTCH_MIN_ASPECT);
        const maxOpacity = m.minOp + Math.random() * (m.maxOp - m.minOp);
        const variant = Math.floor(Math.random() * TEXTURE_VARIANTS);
        const mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(r * 2, r * 2 * aspect), // unequal sides → an oval; aspect 1 ≈ round
          new THREE.MeshBasicMaterial({ map: this.texture(m.kind, variant), transparent: true, opacity: 0, depthWrite: false }),
        );
        // Lay flat (rotate about X) and spin about its own normal (Z) so the oval points any which way.
        mesh.rotation.set(-Math.PI / 2, 0, Math.random() * Math.PI);
        const ang = Math.random() * Math.PI * 2;
        const dist = Math.sqrt(Math.random()) * m.spread;
        mesh.position.set(centre.x + Math.cos(ang) * dist, STAIN_Y + layer * LAYER_STAGGER, centre.z + Math.sin(ang) * dist);
        mesh.renderOrder = 1; // draw above the proximity-ring disc so a pool is never hidden inside it
        mesh.visible = false;
        this.scene.add(mesh);
        blotches.push({ mesh, maxOpacity });
        layer++;
      }
    }
    return { blotches, progress: 0 };
  }

  /** Ease a cluster's shared `progress` toward `target` (rate `k`) and project it onto every blotch's
   *  opacity/visibility. Snaps to the target once within ε so a fade settles cleanly. */
  ease(cluster: StainCluster, target: number, k: number): void {
    let p = cluster.progress + (target - cluster.progress) * Math.min(1, k);
    if (Math.abs(target - p) < 0.001) p = target;
    cluster.progress = p;
    for (const b of cluster.blotches) {
      (b.mesh.material as THREE.MeshBasicMaterial).opacity = p * b.maxOpacity;
      b.mesh.visible = p > 0.001;
    }
  }

  /** Remove a cluster's meshes from the scene and free their geometry/materials. The shared texture pool
   *  is reused across clusters, so it is NOT disposed here. */
  dispose(cluster: StainCluster): void {
    for (const b of cluster.blotches) {
      this.scene.remove(b.mesh);
      b.mesh.geometry.dispose();
      (b.mesh.material as THREE.Material).dispose();
    }
  }

  /** A pooled blotch texture for `(kind, variant)`, drawn once onto a canvas and cached. */
  private texture(kind: K, variant: number): THREE.Texture {
    const cacheKey = `${kind}:${variant}`;
    const cached = this.textures.get(cacheKey);
    if (cached) return cached;
    const tex = new THREE.CanvasTexture(drawStainBlob(this.palette[kind]));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    this.textures.set(cacheKey, tex);
    return tex;
  }
}

/**
 * Draw a soft contamination blotch: a dark core fading to fully transparent at the rim (so it dissolves
 * into the ground with no hard edge), with a random scatter of off-centre darker pools that break the disc
 * into an organic puddle. A `sheen` kind (oil) also gets a small off-centre cool highlight so it reads as a
 * wet slick. Core alpha, falloff, and pool layout all vary per call, so each generated variant is distinct.
 */
function drawStainBlob(col: StainColour): HTMLCanvasElement {
  const S = 128;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d')!;
  const cx = S / 2, cy = S / 2;

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

  // A sheen kind (oil) catches the light: a small off-centre cool highlight so the slick reads as wet.
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
