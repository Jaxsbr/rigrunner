import * as THREE from 'three';

/**
 * The wasteland floor texture: generated once onto a canvas, then tiled across the ground plane.
 * It reads as packed, weathered dirt — soft tonal swells, faint grime/rust, and a fine grit
 * speckle — but stays deliberately low-contrast so it gives the eye motion cues as the rig drives
 * without fighting the scrap, stains and tread marks that sit on top of it. Built procedurally so
 * there is no image asset to source or ship, matching the CanvasTexture approach already used for
 * scrap/camp stains and tread marks.
 */

// One tile is repeated REPEAT times across the 80-unit ground plane, so a tile spans 80 / REPEAT
// world units (~10). TILE_PX is its resolution.
const TILE_PX = 512;
const REPEAT = 8;

// On-palette dirt tones, carried as literals like the rest of the render layer. BASE is a warm
// sun-baked sandy tan (so loose scrap still reads against it); the others mottle around it —
// DARK/GRIME for warm shadowed dust, LIGHT for sun-bleached sand, RUST for the odd iron stain.
const BASE = '#a78a5f';
const DARK = '#7a6042';
const GRIME = '#5f4a32';
const LIGHT = '#c9ad81';
const RUST = '#9a4f2c';

/** Build a fresh, anisotropy-tuned tiling ground texture. */
export function createGroundTexture(maxAnisotropy = 1): THREE.Texture {
  const tex = new THREE.CanvasTexture(drawWastelandFloor());
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(REPEAT, REPEAT);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function drawWastelandFloor(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = TILE_PX;
  canvas.height = TILE_PX;
  const ctx = canvas.getContext('2d')!;

  // Packed-dirt base.
  ctx.fillStyle = BASE;
  ctx.fillRect(0, 0, TILE_PX, TILE_PX);

  // Large tonal swells — slow lighter/darker patches that break up the flat fill.
  for (let i = 0; i < 14; i++) {
    const color = Math.random() < 0.5 ? LIGHT : DARK;
    const r = TILE_PX * (0.18 + Math.random() * 0.22);
    const alpha = 0.1 + Math.random() * 0.06;
    const x = Math.random() * TILE_PX;
    const y = Math.random() * TILE_PX;
    wrap(x, y, r, (dx, dy) => softPatch(ctx, dx, dy, r, color, alpha));
  }

  // Grime and the occasional rust bloom — smaller, a touch stronger.
  for (let i = 0; i < 22; i++) {
    const roll = Math.random();
    const color = roll < 0.2 ? RUST : roll < 0.6 ? GRIME : DARK;
    const r = TILE_PX * (0.04 + Math.random() * 0.1);
    const alpha = 0.06 + Math.random() * 0.07;
    const x = Math.random() * TILE_PX;
    const y = Math.random() * TILE_PX;
    wrap(x, y, r, (dx, dy) => softPatch(ctx, dx, dy, r, color, alpha));
  }

  // Fine grit — close-up texture so the floor doesn't smear when the camera is low.
  for (let i = 0; i < 1400; i++) {
    const s = 1 + Math.random() * 1.6;
    ctx.fillStyle = rgba(Math.random() < 0.6 ? DARK : LIGHT, 0.04 + Math.random() * 0.08);
    const x = Math.random() * TILE_PX;
    const y = Math.random() * TILE_PX;
    wrap(x, y, s, (dx, dy) => ctx.fillRect(dx - s / 2, dy - s / 2, s, s));
  }

  return canvas;
}

/** A soft-edged radial blot of `color` (an `'r,g,b'` string) that fades to fully transparent at its rim.
 *  Reused by the shop's worn-ground decal, which draws the same "the same idiom as the wasteland floor". */
export function softPatch(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  alpha: number,
): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Draw a feature at (x, y) and at every tile-edge offset it overlaps, so the pattern stays seamless
 * once the texture is tiled with RepeatWrapping. A feature far from all edges is drawn once.
 */
function wrap(x: number, y: number, r: number, draw: (dx: number, dy: number) => void): void {
  for (const ox of [-TILE_PX, 0, TILE_PX]) {
    if (ox !== 0 && Math.min(x, TILE_PX - x) > r) continue;
    for (const oy of [-TILE_PX, 0, TILE_PX]) {
      if (oy !== 0 && Math.min(y, TILE_PX - y) > r) continue;
      draw(x + ox, y + oy);
    }
  }
}

/** `#rrggbb` + alpha → an `rgba(...)` string for canvas fills. */
function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
