import { defineComponent } from '@core/component';

/**
 * Present on the single part the player is currently holding in the build interaction. While
 * carried, the part is neither loose nor mounted — the build controller drives its Transform to
 * follow the cursor and lifts it into the air. `liftT` (0→1) eases that rise so a grabbed part
 * floats up smoothly rather than snapping to carry height.
 */
export interface Carried {
  liftT: number;
}

export const Carried = defineComponent<Carried>('Carried');
