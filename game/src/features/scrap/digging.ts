import { defineComponent } from '@core/component';

/**
 * Present on a mounted Reclaimer part WHILE it is actively working a scrap pile (the player holding
 * the work key with the gate met). It is the one-bit bridge from the rummage system (sim truth) to
 * the render layer: animateReclaimer reads it to swap the arm from its stowed idle to the dig cycle,
 * smoothly deploying while it's present and retracting when it's removed. Pure marker — the `since`
 * field is reserved for any future "warm-up" timing and is not read yet.
 *
 * The rummage system adds it the frame work begins and removes it the frame work stops (key released,
 * driven away, pile emptied), so the arm follows the interaction with no extra wiring.
 */
export interface Digging {
  since: number;
}

export const Digging = defineComponent<Digging>('Digging');
