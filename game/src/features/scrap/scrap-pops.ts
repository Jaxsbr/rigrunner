import type * as THREE from 'three';
import type { Transform } from '@common/components/transform';
import { FloatingText } from './floating-text';
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
const GAIN_Y = 0.9; // a "+N" rises from just above the piece on the ground
const WARN_Y = 1.8; // "NO SPACE" rides above the rig body, where the eye already is
const WARN_COOLDOWN = 1.5; // seconds between "NO SPACE" reminders while jammed against full storage

export class ScrapPops {
  private readonly text: FloatingText;
  private warnCooldown = 0; // counts down; the warning only re-pops once it reaches 0

  constructor(scene: THREE.Scene) {
    this.text = new FloatingText(scene);
  }

  /**
   * Emit this frame's pickup feedback: a "+N" at each collected piece, and — if any piece was refused
   * for want of room — a single "NO SPACE" above `rig`, throttled so a rig parked in a scrap field
   * reminds rather than spams. Call once per (unpaused) sim frame with the active rig's transform.
   */
  emit(result: CollectionResult, rig: Transform, dt: number): void {
    this.warnCooldown = Math.max(0, this.warnCooldown - dt);

    for (const c of result.collected) {
      this.text.spawn(`+${c.value}`, GAIN_COLOR, c.x, GAIN_Y, c.z);
    }

    if (result.refused.length > 0 && this.warnCooldown === 0) {
      this.text.spawn('NO SPACE', WARN_COLOR, rig.x, (rig.y ?? 0) + WARN_Y, rig.z);
      this.warnCooldown = WARN_COOLDOWN;
    }
  }

  /** Advance the rise/fade of live pops — ticked with the other animators while the sim runs. */
  update(dt: number): void {
    this.text.update(dt);
  }
}
