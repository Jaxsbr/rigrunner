import * as THREE from 'three';
import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { WorldShop } from './world-shop';

/**
 * The shop's worn ground: a textured decal laid UNDER the goods yard so the earth itself reads as worked —
 * not pristine desert the props were dropped onto. The look is a TRODDEN GRAVEL PATH: dirt compacted and
 * studded with small stones walked over again and again until they read as a rough cobbled surface, with
 * drag-scuffs where crates get hauled and the heaviest wear running in FRONT of the counter where the rig
 * drives up.
 *
 * It is a flat, transparent plane carrying a procedurally-drawn canvas (the same idiom as the wasteland
 * floor and the stain decals), laid a hair above the ground (under the grime stains, which sit higher) and
 * oriented to the shop so the path concentrates at the entrance. Unlit + depth-write-off like the stains,
 * so it discolours the floor beneath (and the floor's received shadows) rather than repainting it. Pure
 * view polish: it owns only the mesh + texture, reads the sim only to know where each shop is, never
 * writing it.
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
const CRACK = '48,38,26';      // dried-mud seams between the stones
const SCUFF = '156,134,94';    // a polished, lighter scuff — the beaten footpath

// The gravel/cobble mix — a worn blend of greys and warm browns: the rocks that pack a trodden path.
const STONES = ['176,168,146', '146,136,116', '120,110,90', '98,88,72', '130,114,86', '76,68,54'];
const STONE_SHADOW = '36,29,19'; // the contact shadow a stone casts into the dirt
const STONE_HILITE = '212,202,178'; // a sun-catch on a stone's crown

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

/** Walk a thin seam between the stones from (x,y), drifting and occasionally forking. */
function crack(ctx: CanvasRenderingContext2D, rng: () => number, x: number, y: number, ang: number, len: number, depth: number): void {
  let cx = x, cy = y, a = ang;
  const steps = Math.max(2, Math.floor(len / 14));
  ctx.lineWidth = 1 + rng() * 1.4;
  ctx.strokeStyle = `rgba(${CRACK},${0.26 + rng() * 0.18})`;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  for (let i = 0; i < steps; i++) {
    a += (rng() - 0.5) * 0.7;
    cx += Math.cos(a) * 14;
    cy += Math.sin(a) * 14;
    ctx.lineTo(cx, cy);
    if (depth > 0 && rng() < 0.16) crack(ctx, rng, cx, cy, a + (rng() - 0.5) * 1.6, len * 0.5, depth - 1);
  }
  ctx.stroke();
}

/** One embedded stone: a contact shadow, a rounded body in a random rock tone, and an occasional crown
 *  highlight — so packed densely they read as gravel/cobble rather than noise. */
function pebble(ctx: CanvasRenderingContext2D, rng: () => number, x: number, y: number): void {
  const big = rng() < 0.13;
  const r = (2.3 + rng() * 4.4) * (big ? 1.9 : 1);
  const tone = STONES[(rng() * STONES.length) | 0]!;
  ctx.fillStyle = `rgba(${STONE_SHADOW},${0.14 + rng() * 0.12})`;
  ctx.beginPath();
  ctx.ellipse(x + 1.2, y + 1.6, r * 1.08, r * 0.82, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(${tone},${0.52 + rng() * 0.34})`;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * (0.72 + rng() * 0.18), rng() * Math.PI, 0, Math.PI * 2);
  ctx.fill();
  if (rng() < 0.55) {
    ctx.fillStyle = `rgba(${STONE_HILITE},${0.1 + rng() * 0.13})`;
    ctx.beginPath();
    ctx.ellipse(x - r * 0.22, y - r * 0.28, r * 0.42, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawWornYard(seed: number): HTMLCanvasElement {
  const rng = rngFor(seed);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = TEX_PX;
  const ctx = canvas.getContext('2d')!;

  // 1) The trampled area: a lumpy mound of compacted-dirt discolouration, denser in the middle and frayed
  //    at the edges (overlapping soft blots → an organic blob, not a disc), nudged toward the front. This
  //    is the BED the gravel beds into.
  for (let i = 0; i < 30; i++) {
    const ang = rng() * Math.PI * 2;
    const d = Math.pow(rng(), 0.7) * 360;       // denser toward the centre
    const r = 130 + rng() * 230;
    blot(ctx, C + Math.cos(ang) * d, FRONT + Math.sin(ang) * d, r, PACKED, 0.1 + rng() * 0.12);
  }
  for (let i = 0; i < 7; i++) {
    blot(ctx, C + (rng() - 0.5) * 200, FRONT + (rng() - 0.5) * 160, 120 + rng() * 120, TRODDEN, 0.1 + rng() * 0.1);
  }

  // 2) The compacted GRAVEL/COBBLE — small stones walked into the dirt. A broad field across the worked
  //    area (denser toward the centre), plus a heavier lane down the front approach so it reads as a PATH
  //    leading to the counter.
  for (let i = 0; i < 2400; i++) {
    const ang = rng() * Math.PI * 2;
    const d = Math.pow(rng(), 0.72) * 380;
    pebble(ctx, rng, C + Math.cos(ang) * d, FRONT + Math.sin(ang) * d);
  }
  for (let i = 0; i < 1000; i++) {
    const t = rng();                            // 0 = front edge (top), 1 = the counter
    const y = t * (C - 30) + 20;
    const x = C + (rng() - 0.5) * 150 * (0.55 + t); // the lane widens a touch toward the building
    pebble(ctx, rng, x, y);
  }

  // 3) A beaten, polished footpath sheen drawn over the front approach (lighter, where feet smooth it).
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    blot(ctx, C + (rng() - 0.5) * 90, t * (C - 40) + 30, 60 + rng() * 50, SCUFF, 0.05 + rng() * 0.05);
  }

  // 4) Dried seams threading between the stones — more through the worked core.
  for (let i = 0; i < 12; i++) {
    const ang = rng() * Math.PI * 2;
    const d = Math.pow(rng(), 0.6) * 320;
    crack(ctx, rng, C + Math.cos(ang) * d, FRONT + Math.sin(ang) * d, rng() * Math.PI * 2, 60 + rng() * 120, 2);
  }

  // 5) Drag/scuff arcs — curved sweeps where crates get hauled around (the marks that read well already).
  for (let i = 0; i < 10; i++) {
    ctx.strokeStyle = `rgba(${rng() < 0.5 ? TRODDEN : SCUFF},${0.1 + rng() * 0.12})`;
    ctx.lineWidth = 4 + rng() * 7;
    const ax = C + (rng() - 0.5) * 520, ay = FRONT + (rng() - 0.5) * 480;
    ctx.beginPath();
    ctx.arc(ax, ay, 50 + rng() * 130, rng() * Math.PI * 2, rng() * Math.PI + 0.6);
    ctx.stroke();
  }

  return canvas;
}

/** Hash a world position into a 32-bit seed (offset from the yard's so the two patterns aren't twinned). */
function seedFor(x: number, z: number): number {
  return (Math.imul(Math.round(x * 100) + 7, 40503701) ^ Math.imul(Math.round(z * 100) + 13, 22943803)) >>> 0;
}

export class ShopGround {
  private readonly pads = new Map<EntityId, THREE.Group>();

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
      group.rotation.y = t.rotationY;          // so the path falls in front of the entrance
      group.add(mesh);
      this.scene.add(group);
      this.pads.set(s, group);
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
