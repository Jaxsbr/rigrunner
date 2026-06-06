import { defineComponent } from '@core/component';

/**
 * The per-weapon firing STATE on a mounted weapon part. The weapon's static numbers (damage, cooldown
 * length, range, cone) are the `WEAPON` constant in `./combat`; this is the mutable runtime the fire
 * system ticks. The fire system attaches one lazily to any mounted `Part.kind === 'weapon'` that lacks
 * it, so mounting a bought gun "just works" with no extra wiring.
 *
 * `aimYaw` is the WORLD yaw toward the nearest in-cone target (or null when none) — set by the fire
 * system each frame, read by the barrel-swivel animator so the barrel tracks the target it's firing on.
 * The sim owns it; the render layer only reads it (the model/view never feeds the sim).
 */
export interface Weapon {
  cooldownLeft: number;
  aimYaw: number | null;
}

export const Weapon = defineComponent<Weapon>('Weapon');
