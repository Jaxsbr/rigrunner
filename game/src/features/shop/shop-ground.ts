import * as THREE from 'three';
import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { WorldShop } from './world-shop';

/**
 * The shop's worn ground: a textured decal laid UNDER the goods yard so the earth itself reads as worked —
 * trampled, compacted, cracked, scuffed by dragged deliveries, with a beaten path and a few salvaged
 * pavers at the entrance. Without it the props look dropped onto pristine desert; with it the whole area
 * reads as a place people have walked and staged things for a long time.
 *
 * It is a flat, transparent plane carrying a procedurally-drawn canvas (the same idiom as the wasteland
 * floor and the stain decals), laid a hair above the ground (under the grime stains, which sit higher) and
 * oriented to the shop so the heaviest wear — the path + the pavers — falls in FRONT of the counter where
 * the rig drives up. Unlit + depth-write-off like the stains, so it darkens/discolours the floor beneath
 * (and the floor's received shadows) rather than repainting it. Pure view polish: it owns only the mesh +
 * texture, reads the sim only to know where each shop is, and never writes it.
 *
 * The pattern is seeded off the shop's position, so a shop's worn ground is identical every load yet
 * differs shop to shop (it matches the position-seeded yard scatter).
 */

const PLANE = 15;       // metres square — covers the building + the whole prop scatter, fading to desert
const PAD_Y = 0.012;    // just above the ground plane (y=0), just below the grime stains (y=0.02)
const TEX_PX = 1024;
const C = TEX_PX / 2;
const FRONT = C - 80;   // the worn area's centre, nudged toward the entrance (canvas TOP = the shop's front)

// On-palette worn-dirt tones (literals, like the rest of the render layer), keyed to the ground texture's
// own dirt palette so the pad reads as the SAME earth, only compacted + worked.
const PACKED = '120,100,66';   // trodden, compacted dirt — darker/greyer than loose sand
const TRODDEN = '92,74,50';    // the heavily-walked core + drag marks
const CRACK = '48,38,26';      // dried-mud cracks
const SCUFF = '156,134,94';    // a polished, lighter scuff — the beaten footpath
const PAVER = '138,129,116';   // a salvaged stone slab
const BOARD = '110,92,62';     // a salvaged timber board
const GAP = '40,30,18';        // the dark gap/edge around a paver

function rngFor(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A soft radial blot fading to transparent at its rim. */
function blot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rgb: string, a: number): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** Walk a thin branching crack from (x,y), drifting and occasionally forking. */
function crack(ctx: CanvasRenderingContext2D, rng: () => number, x: number, y: number, ang: number, len: number, depth: number): void {
  let cx = x, cy = y, a = ang;
  const steps = Math.max(2, Math.floor(len / 14));
  ctx.lineWidth = 1 + rng() * 1.6;
  ctx.strokeStyle = `rgba(${CRACK},${0.32 + rng() * 0.22})`;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  for (let i = 0; i < steps; i++) {
    a += (rng() - 0.5) * 0.7;
    cx += Math.cos(a) * 14;
    cy += Math.sin(a) * 14;
    ctx.lineTo(cx, cy);
    if (depth > 0 && rng() < 0.18) crack(ctx, rng, cx, cy, a + (rng() - 0.5) * 1.6, len * 0.5, depth - 1);
  }
  ctx.stroke();
}

/** A weathered, slightly-rotated salvaged slab (stone paver or timber board) with a dark gap around it. */
function slab(ctx: CanvasRenderingContext2D, rng: () => number, x: number, y: number): void {
  const w = 46 + rng() * 60, h = 34 + rng() * 46;
  const rot = (rng() - 0.5) * 0.6;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = `rgba(${GAP},0.5)`;
  ctx.fillRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6); // the gap/shadow it sits in
  ctx.fillStyle = `rgba(${rng() < 0.55 ? PAVER : BOARD},${0.4 + rng() * 0.25})`;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  // A crack or two across the slab so it reads as broken/old.
  ctx.strokeStyle = `rgba(${GAP},0.4)`;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-w / 2 + rng() * w, -h / 2);
  ctx.lineTo(-w / 2 + rng() * w, h / 2);
  ctx.stroke();
  ctx.restore();
}

function drawWornYard(seed: number): HTMLCanvasElement {
  const rng = rngFor(seed);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = TEX_PX;
  const ctx = canvas.getContext('2d')!;

  // 1) The trampled area: a lumpy mound of compacted-dirt discolouration, denser in the middle and frayed
  //    at the edges (overlapping soft blots → an organic blob, not a disc), nudged toward the front.
  for (let i = 0; i < 30; i++) {
    const ang = rng() * Math.PI * 2;
    const d = Math.pow(rng(), 0.7) * 360;       // denser toward the centre
    const r = 130 + rng() * 230;
    blot(ctx, C + Math.cos(ang) * d, FRONT + Math.sin(ang) * d, r, PACKED, 0.1 + rng() * 0.12);
  }

  // 2) The heavily-walked core + a beaten path running from the front edge in to the counter.
  for (let i = 0; i < 7; i++) {
    blot(ctx, C + (rng() - 0.5) * 200, FRONT + (rng() - 0.5) * 160, 120 + rng() * 120, TRODDEN, 0.12 + rng() * 0.12);
  }
  for (let i = 0; i < 9; i++) {
    const t = i / 8;                            // 0 = front edge (top), 1 = the counter
    blot(ctx, C + (rng() - 0.5) * 90, t * (C - 40) + 30, 70 + rng() * 50, SCUFF, 0.06 + rng() * 0.06);
  }

  // 3) Dried-mud cracks across the compacted ground — more through the worked core.
  for (let i = 0; i < 16; i++) {
    const ang = rng() * Math.PI * 2;
    const d = Math.pow(rng(), 0.6) * 330;
    crack(ctx, rng, C + Math.cos(ang) * d, FRONT + Math.sin(ang) * d, rng() * Math.PI * 2, 70 + rng() * 130, 2);
  }

  // 4) Drag/scuff arcs — curved sweeps where crates get hauled around.
  for (let i = 0; i < 10; i++) {
    ctx.strokeStyle = `rgba(${rng() < 0.5 ? TRODDEN : SCUFF},${0.1 + rng() * 0.12})`;
    ctx.lineWidth = 4 + rng() * 7;
    const ax = C + (rng() - 0.5) * 520, ay = FRONT + (rng() - 0.5) * 480;
    ctx.beginPath();
    ctx.arc(ax, ay, 50 + rng() * 130, rng() * Math.PI * 2, rng() * Math.PI + 0.6);
    ctx.stroke();
  }

  // 5) A rough hardstanding of salvaged pavers/boards clustered at the entrance (the front apron).
  const slabs = 7 + Math.floor(rng() * 4);
  for (let i = 0; i < slabs; i++) {
    slab(ctx, rng, C + (rng() - 0.5) * 360, 90 + rng() * 240); // upper canvas = front of the shop
  }

  // 6) Fine grit so the surface holds texture under a low camera.
  for (let i = 0; i < 900; i++) {
    const s = 1 + rng() * 1.8;
    ctx.fillStyle = `rgba(${rng() < 0.6 ? CRACK : SCUFF},${0.05 + rng() * 0.08})`;
    const ang = rng() * Math.PI * 2;
    const d = Math.pow(rng(), 0.5) * 430;
    ctx.fillRect(C + Math.cos(ang) * d, FRONT + Math.sin(ang) * d, s, s);
  }

  return canvas;
}

/** Hash a world position into a 32-bit seed (offset from the yard's so the two patterns aren't twinned). */
function seedFor(x: number, z: number): number {
  return (Math.imul(Math.round(x * 100) + 7, 40503701) ^ Math.imul(Math.round(z * 100) + 13, 22943803)) >>> 0;
}

export class ShopGround {
  private readonly pads = new Map<EntityId, THREE.Mesh>();

  constructor(private readonly scene: THREE.Scene) {}

  /** Lay a worn-ground pad under every live shop (built once each); drop one whose shop is gone. */
  sync(world: World): void {
    for (const s of world.query(WorldShop, Transform)) {
      if (this.pads.has(s)) continue;
      const t = world.get(s, Transform)!;
      const tex = new THREE.CanvasTexture(drawWornYard(seedFor(t.x, t.z)));
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(PLANE, PLANE),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
      );
      mesh.rotation.x = -Math.PI / 2;          // lay flat; canvas TOP → the group's local front (−Z)
      const group = new THREE.Group();
      group.position.set(t.x, PAD_Y, t.z);
      group.rotation.y = t.rotationY;          // so the apron/path falls in front of the entrance
      group.add(mesh);
      this.scene.add(group);
      this.pads.set(s, group as unknown as THREE.Mesh);
    }
    for (const [id, group] of this.pads) {
      if (world.isAlive(id) && world.has(id, WorldShop)) continue;
      this.scene.remove(group);
      group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.geometry.dispose();
          const mat = m.material as THREE.MeshBasicMaterial;
          mat.map?.dispose();
          mat.dispose();
        }
      });
      this.pads.delete(id);
    }
  }
}
