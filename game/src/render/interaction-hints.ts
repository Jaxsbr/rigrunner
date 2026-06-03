import * as THREE from 'three';
import type { World } from '../core/world';
import type { EntityId } from '../core/types';
import { Transform } from '../components/transform';
import { WorkshopZone } from '../components/workshop-zone';
import { ScrapPile } from '../components/scrap-pile';

/**
 * Floating "what key does this" hints: a small speech bubble that fades IN above a gated interaction
 * the instant its proximity disc lights up, and fades OUT when the rig leaves. Pure view polish — it
 * READS the same `active` flag the disc does (WorkshopZone / ScrapPile, owned by the sim) and owns
 * only the billboard sprites and their eased opacity. Two prompts, matching how each is operated:
 *   - workshop  → "Press E" (a tap opens the interface)
 *   - scrap pile → "Hold E" (press-and-hold rummages)
 *
 * Each bubble is a camera-facing THREE.Sprite drawn from a canvas, sitting above its object. Bubbles
 * are created lazily on first sight and dropped when their owner is gone (a pile is destroyed when
 * emptied). depthTest is off so the bubble reads clearly even against the tall scrap heap.
 */

// Bubble height (world metres) above each object's origin — clear of the ~0.7 m workshop deck and
// the ~3 m scrap heap respectively, so the tail points down at the thing it labels.
const WORKSHOP_HINT_Y = 1.8;
const PILE_HINT_Y = 4.0;
const FADE_RATE = 6; // opacity units/sec toward the target (≈0.17 s to fade in/out)

interface Hint {
  sprite: THREE.Sprite;
  opacity: number;
  active: boolean;
}

export class InteractionHints {
  private readonly hints = new Map<EntityId, Hint>();
  private readonly textures = new Map<string, THREE.Texture>(); // cached by label — only two exist

  constructor(private readonly scene: THREE.Scene) {}

  /** Fade every hint toward its owner's gate state and ride it above the object. `dt` drives the fade. */
  sync(world: World, dt: number): void {
    for (const e of world.query(WorkshopZone, Transform)) {
      this.upsert(world, e, 'Press E', WORKSHOP_HINT_Y, world.get(e, WorkshopZone)!.active, dt);
    }
    for (const e of world.query(ScrapPile, Transform)) {
      this.upsert(world, e, 'Hold E', PILE_HINT_Y, world.get(e, ScrapPile)!.active, dt);
    }

    // Drop bubbles for any owner that no longer exists.
    for (const [id, hint] of this.hints) {
      if (!world.isAlive(id)) {
        this.scene.remove(hint.sprite);
        this.hints.delete(id);
      }
    }
  }

  /** Create-or-update one bubble: position it above its object and ease its opacity toward `active`. */
  private upsert(world: World, e: EntityId, label: string, height: number, active: boolean, dt: number): void {
    let hint = this.hints.get(e);
    if (!hint) {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: this.texture(label), transparent: true, opacity: 0, depthTest: false, depthWrite: false }),
      );
      sprite.scale.set(2.3, 1.3, 1); // matches the 320×180 canvas aspect
      sprite.renderOrder = 10;       // draw over the world geometry below it
      sprite.visible = false;
      this.scene.add(sprite);
      hint = { sprite, opacity: 0, active };
      this.hints.set(e, hint);
    }

    const t = world.get(e, Transform)!;
    hint.sprite.position.set(t.x, height, t.z);

    const target = active ? 1 : 0;
    hint.opacity += Math.sign(target - hint.opacity) * Math.min(dt * FADE_RATE, Math.abs(target - hint.opacity));
    (hint.sprite.material as THREE.SpriteMaterial).opacity = hint.opacity;
    hint.sprite.visible = hint.opacity > 0.01;
  }

  /** A cached canvas texture of one bubble label (e.g. "Press E") — a panel + tail + keycap. */
  private texture(label: string): THREE.Texture {
    const cached = this.textures.get(label);
    if (cached) return cached;
    const tex = new THREE.CanvasTexture(drawBubble(label));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    this.textures.set(label, tex);
    return tex;
  }
}

/**
 * Draw a simple speech bubble onto a canvas: a dark rounded panel with a bone-white border and a
 * downward tail, holding the verb (e.g. "Press") beside a glow-green keycap for its trailing letter
 * (the "E"). The trailing single character is rendered as the keycap; the rest is the verb.
 */
function drawBubble(label: string): HTMLCanvasElement {
  const W = 320, H = 180;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  const verb = label.slice(0, -1).trim(); // "Press E" → "Press"
  const key = label.slice(-1);            // → "E"

  const PANEL = 'rgba(26,28,31,0.92)'; // dark_metal-ish panel
  const BONE = '#CDC6B8';              // bone_white border + verb
  const GREEN = '#59FF9F';             // glow_green keycap (ties to the lit disc)

  const px = 12, py = 12, pw = W - 24, ph = 120, r = 22;
  roundRect(ctx, px, py, pw, ph, r);
  ctx.fillStyle = PANEL;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = BONE;
  ctx.stroke();

  // Downward tail under the panel centre.
  ctx.beginPath();
  ctx.moveTo(W / 2 - 22, py + ph - 1);
  ctx.lineTo(W / 2, py + ph + 36);
  ctx.lineTo(W / 2 + 22, py + ph - 1);
  ctx.closePath();
  ctx.fillStyle = PANEL;
  ctx.fill();

  // Layout: verb text, a gap, then a keycap square — centred together in the panel.
  const cy = py + ph / 2;
  const cap = 62, gap = 16;
  ctx.font = 'bold 50px system-ui, -apple-system, sans-serif';
  ctx.textBaseline = 'middle';
  const verbW = ctx.measureText(verb).width;
  const total = verbW + gap + cap;
  const startX = (W - total) / 2;

  ctx.textAlign = 'left';
  ctx.fillStyle = BONE;
  ctx.fillText(verb, startX, cy);

  const kx = startX + verbW + gap, ky = cy - cap / 2;
  roundRect(ctx, kx, ky, cap, cap, 12);
  ctx.fillStyle = '#101214';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = GREEN;
  ctx.stroke();
  ctx.fillStyle = GREEN;
  ctx.textAlign = 'center';
  ctx.fillText(key, kx + cap / 2, cy + 1);

  return canvas;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
