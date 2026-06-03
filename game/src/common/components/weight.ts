import { defineComponent } from '@core/component';

/**
 * How heavy a thing is. Deliberately its OWN component, not an engine attribute: the rig chassis
 * has weight, every part (engines today; guns, containers, cargo later) has weight, so the drive
 * system can sum one uniform thing — the total mass the engines must haul — across all of them.
 *
 * Heavier = harder to move: weight resists motion (see systems/drive.ts), and torque is what
 * overcomes it. That's the tension — a strong engine is also a heavy one.
 */
export interface Weight {
  value: number;
}

export const Weight = defineComponent<Weight>('Weight');
