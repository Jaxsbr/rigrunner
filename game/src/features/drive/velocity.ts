import { defineComponent } from '@core/component';

/** Current signed forward speed (+ forward, - reverse). The Drivetrain's dynamic state. */
export interface Velocity {
  speed: number;
}

export const Velocity = defineComponent<Velocity>('Velocity');
