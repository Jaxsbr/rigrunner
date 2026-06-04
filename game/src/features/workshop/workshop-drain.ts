import { defineComponent } from '@core/component';

/**
 * The drain accumulator for a workshop: time banked toward emptying the next piece of scrap out of
 * a container sitting on it. Kept in the World (not a closure) so the drain stays a pure function
 * over state and tests headless.
 *
 * `elapsed` accrues dt while a non-empty container is on the deck; each time it crosses the drain
 * interval one piece moves into the Wallet and the interval is subtracted. It resets to 0 when
 * there's nothing to drain, so banked time never dumps a full container in one frame the instant
 * one arrives.
 */
export interface WorkshopDrain {
  elapsed: number;
}

export const WorkshopDrain = defineComponent<WorkshopDrain>('WorkshopDrain');
