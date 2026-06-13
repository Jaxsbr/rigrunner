import * as THREE from 'three';

/**
 * Floating "battle text" — short labels that pop at a world point, drift upward, and fade out. A
 * camera-facing `THREE.Sprite` carries each one, so it needs no screen-projection: it lives in the
 * scene, recedes naturally as the camera moves on, and always faces the viewer. Pure view polish in
 * the spirit of the stains/tracks layers — it owns only its live sprites and reads nothing from the
 * sim; destroy it and the game is unaffected.
 *
 * Generic by construction: a caller supplies the text, colour, spot, and an optional icon, so it
 * carries no scrap semantics of its own (the "+N" / "NO SPACE" policy and the scrap chip live in
 * `scrap-pops.ts`). It sits in the scrap slice because that's its only consumer today; the day combat
 * wants damage numbers it becomes the second, and this moves up to `@common/render` (ADR-003 — earn
 * the promotion, don't pre-build it).
 */

/**
 * A small picture to float beside the text — a chip of the thing being collected, so a pickup reads at
 * a glance ("+1" with a scrap chip). The caller paints it into a square box, so icon and text share ONE
 * sprite and drift in unison. `key` identifies the icon for the label-texture cache (the icon set is
 * small and reused). Generic: any collectible supplies its own chip via this seam.
 */
export interface FloatingIcon {
  key: string;
  /** Paint the icon filling the square `(x, y, size)` box on the label canvas. */
  draw(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void;
}

/** How long a label lives, in seconds — long enough to clock the pickup before it drifts off and fades. */
const LIFE = 2.5;
/** How far it climbs over its life, in world units — a clear upward drift away from the pickup. */
const RISE = 1.2;
/** Fraction of the life spent fully opaque before it starts fading — holds, then dissolves. */
const FADE_FROM = 0.4;
/** On-screen height of a label, in world units (its width follows the glyph's aspect). */
const WORLD_HEIGHT = 0.55;
/** A burst could spawn many at once; cap the live count so it can't grow without bound (oldest dropped). */
const MAX_FLOATERS = 48;

interface Floater {
  sprite: THREE.Sprite;
  age: number;
  baseY: number;
}

/** A rendered label: its texture plus the canvas aspect, so a sprite can be sized without squashing the text. */
interface Glyph {
  texture: THREE.Texture;
  aspect: number;
}

export class FloatingText {
  private readonly floaters: Floater[] = []; // FIFO: creation order == age order (all share one LIFE)
  private readonly glyphs = new Map<string, Glyph>(); // text|colour -> rendered label, built once and shared

  constructor(private readonly scene: THREE.Scene) {}

  /**
   * Pop a label reading `text` (in `color`) at world `(x, y, z)`; it rises and fades on its own. An
   * optional `icon` floats to its left on the same sprite (e.g. a chip of the collected item).
   */
  spawn(text: string, color: string, x: number, y: number, z: number, icon?: FloatingIcon): void {
    const glyph = this.glyph(text, color, icon);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glyph.texture,
        transparent: true,
        depthTest: false, // battle text floats over the world, never hidden behind the rig or a heap
        depthWrite: false,
      }),
    );
    sprite.scale.set(WORLD_HEIGHT * glyph.aspect, WORLD_HEIGHT, 1);
    sprite.position.set(x, y, z);
    sprite.renderOrder = 10;
    this.scene.add(sprite);
    this.floaters.push({ sprite, age: 0, baseY: y });
    if (this.floaters.length > MAX_FLOATERS) this.dispose(this.floaters.shift()!);
  }

  /** Age every label by `dt`: climb, then fade past the hold; dispose the front ones that are spent. */
  update(dt: number): void {
    for (const f of this.floaters) {
      f.age += dt;
      const p = Math.min(1, f.age / LIFE);
      f.sprite.position.y = f.baseY + RISE * p;
      const fade = p < FADE_FROM ? 1 : 1 - (p - FADE_FROM) / (1 - FADE_FROM);
      (f.sprite.material as THREE.SpriteMaterial).opacity = Math.max(0, fade);
    }
    while (this.floaters.length > 0 && this.floaters[0]!.age >= LIFE) {
      this.dispose(this.floaters.shift()!);
    }
  }

  private dispose(f: Floater): void {
    this.scene.remove(f.sprite);
    (f.sprite.material as THREE.Material).dispose(); // glyph textures are cached + shared, not freed here
  }

  /** The texture for a label (icon + `text` + `color`), drawn once and cached (the variant set is tiny). */
  private glyph(text: string, color: string, icon?: FloatingIcon): Glyph {
    const key = `${icon?.key ?? '-'}|${text}|${color}`;
    const cached = this.glyphs.get(key);
    if (cached) return cached;
    const canvas = drawLabel(text, color, icon);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    const glyph: Glyph = { texture, aspect: canvas.width / canvas.height };
    this.glyphs.set(key, glyph);
    return glyph;
  }
}

/**
 * Render an optional `icon` followed by `text` onto a tightly-sized canvas: a heavy dark outline under a
 * `color` text fill, so the label stays legible over the bright ground or a dark rig alike. The icon
 * sits within the text's line height to its left, and the canvas is sized to both so the sprite's aspect
 * comes out right.
 */
function drawLabel(text: string, color: string, icon?: FloatingIcon): HTMLCanvasElement {
  const FONT_PX = 96;
  const PAD = 24;
  const GAP = 18; // space between the icon and the text
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const font = `bold ${FONT_PX}px sans-serif`;

  ctx.font = font;
  const textW = Math.ceil(ctx.measureText(text).width);
  const iconSize = icon ? FONT_PX : 0; // the icon fills the text line height
  const iconGap = icon ? GAP : 0;
  canvas.width = PAD + iconSize + iconGap + textW + PAD;
  canvas.height = FONT_PX + PAD * 2;

  // Sizing the canvas clears it — restore the font, then draw icon (left) and text after it.
  ctx.font = font;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  const cy = canvas.height / 2;

  if (icon) icon.draw(ctx, PAD, cy - iconSize / 2, iconSize);

  const textX = PAD + iconSize + iconGap;
  ctx.lineWidth = FONT_PX * 0.18;
  ctx.strokeStyle = 'rgba(18,19,21,0.92)'; // dark_metal-ish outline for contrast on any background
  ctx.strokeText(text, textX, cy);
  ctx.fillStyle = color;
  ctx.fillText(text, textX, cy);

  return canvas;
}
