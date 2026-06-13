import type * as THREE from 'three';
import type { EntityId } from '@core/types';
import type { Transform } from '@common/components/transform';
import { FloatingText, type FloatingIcon } from './floating-text';
import type { CollectionResult } from './scrap-collection';

/**
 * The scrap-collection feedback: turn each frame's `CollectionResult` into floating text. A "+N" pops
 * where each piece was swept up (the gain you can read at a glance), and a "NO SPACE" warning rides
 * above the rig when a full hold drove over scrap it had to leave — the cue that says "go dump or bolt
 * on storage". This owns the scrap-specific policy (colours, heights, the warning's debounce); the
 * camera-facing sprites themselves are the generic `FloatingText` layer.
 *
 * Spawning and ageing are both driven only while the sim runs (the composition root calls them inside
 * its unpaused block), so live pops freeze in place behind a loot popup or the workshop rather than
 * drifting away unseen, then resume when play does — matching the other sim-driven animators.
 */

const GAIN_COLOR = '#CDC6B8'; // bone_white — a pickup reads as neutral "battle text"
const WARN_COLOR = '#D9A521'; // hazard_yellow — the palette's warning colour

/**
 * A scrap chip floated beside the "+N" so a pickup reads at a glance as scrap, not just a number — a
 * little cluster of angular metal offcuts, on-palette (scrap_grey body, dark_metal + rust shards, a
 * hazard fleck). The seam the vision rides: another collectible kind ships its own `FloatingIcon`, and
 * the collection report would say which to float; today scrap is the only kind.
 */
const SCRAP_ICON: FloatingIcon = {
  key: 'scrap',
  draw(ctx, x, y, size) {
    const chips = [
      { cx: 0.42, cy: 0.40, w: 0.62, h: 0.46, rot: -0.18, fill: '#6B6B6B' }, // scrap_grey slab
      { cx: 0.62, cy: 0.58, w: 0.44, h: 0.40, rot: 0.42, fill: '#2F3133' }, //  dark_metal shard
      { cx: 0.34, cy: 0.64, w: 0.40, h: 0.30, rot: 0.12, fill: '#8A4B2F' }, //  rust offcut
      { cx: 0.60, cy: 0.32, w: 0.26, h: 0.22, rot: -0.5, fill: '#D9A521' }, //  hazard fleck
    ];
    ctx.save();
    ctx.translate(x, y);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(18,19,21,0.92)'; // same dark outline as the text, for legibility
    ctx.lineWidth = size * 0.055;
    for (const c of chips) {
      ctx.save();
      ctx.translate(c.cx * size, c.cy * size);
      ctx.rotate(c.rot);
      const w = c.w * size;
      const h = c.h * size;
      ctx.fillStyle = c.fill;
      ctx.beginPath();
      ctx.rect(-w / 2, -h / 2, w, h);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  },
};
const GAIN_Y = 1.5; // a "+N" rises clear of the rig body, where the eye is, rather than low on the ground
const WARN_Y = 1.8; // "NO SPACE" rides above the rig body, where the eye already is
const WARN_COOLDOWN = 1.5; // seconds between "NO SPACE" reminders while driving over scrap you can't take

/**
 * Should the "NO SPACE" warning fire this frame? Only when some piece is refused that we weren't
 * *already* warning about (`announced`) — so driving over fresh scrap you can't take reminds you, but a
 * rig parked on one stuck piece warns once, not every frame — and only once the cooldown has elapsed.
 */
export function shouldWarnNoSpace(
  refused: readonly EntityId[],
  announced: ReadonlySet<EntityId>,
  cooldown: number,
): boolean {
  if (cooldown > 0) return false;
  return refused.some((id) => !announced.has(id));
}

export class ScrapPops {
  private readonly text: FloatingText;
  private warnCooldown = 0; // counts down; the warning only re-pops once it reaches 0
  private announced: ReadonlySet<EntityId> = new Set(); // pieces refused (and so warned-about) last frame

  constructor(scene: THREE.Scene) {
    this.text = new FloatingText(scene);
  }

  /**
   * Emit this frame's pickup feedback: a "+N" at each collected piece, and — when the rig newly drives
   * over scrap it can't take — a single "NO SPACE" above `rig`, throttled by a cooldown and suppressed
   * for pieces it's already sitting on. Call once per (unpaused) sim frame with the active rig's transform.
   */
  emit(result: CollectionResult, rig: Transform, dt: number): void {
    this.warnCooldown = Math.max(0, this.warnCooldown - dt);

    for (const c of result.collected) {
      this.text.spawn(`+${c.value}`, GAIN_COLOR, c.x, GAIN_Y, c.z, SCRAP_ICON);
    }

    const refusedIds = result.refused.map((r) => r.id);
    if (shouldWarnNoSpace(refusedIds, this.announced, this.warnCooldown)) {
      this.text.spawn('NO SPACE', WARN_COLOR, rig.x, (rig.y ?? 0) + WARN_Y, rig.z);
      this.warnCooldown = WARN_COOLDOWN;
    }
    // Remember exactly what's refused now: a piece in contact stays "announced" so it can't re-nag,
    // while a piece that left contact is forgotten — so re-encountering it later warns again.
    this.announced = new Set(refusedIds);
  }

  /** Advance the rise/fade of live pops — ticked with the other animators while the sim runs. */
  update(dt: number): void {
    this.text.update(dt);
  }
}
