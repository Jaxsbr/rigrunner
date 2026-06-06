import { defineComponent } from '@core/component';

/**
 * The current drive intent acting on an entity. The input layer writes it (via the
 * composition root); the movement system reads it. This component IS the seam between
 * input and simulation — neither side references the other.
 */
export interface DriveControl {
  throttle: number;      // -1 reverse … 0 … 1 forward
  steer: number;         // -1 right … 0 … 1 left — the raw input target
  appliedSteer?: number; // ramped steer the movement system eases toward `steer` (sim-managed; input never sets it)
}

export const DriveControl = defineComponent<DriveControl>('DriveControl');
