import { defineComponent } from '@core/component';

/**
 * Present on a mounted Reclaimer part WHILE its arm is actively working — rummaging a scrap pile (the
 * bucket head) or healing a stump into a tree (the stump-healer head). It is the one-bit bridge from a
 * work system (sim truth) to the render layer: `animateReclaimer` reads it to swap the arm from its
 * stowed idle to the dig cycle, smoothly deploying while it's present and retracting when it's removed.
 * Pure marker — the `since` field is reserved for any future "warm-up" timing and is not read yet.
 *
 * Shared because two features drive the same arm motion off it: scrap's rummage and restoration's heal.
 * Each owns a DISTINCT head (a reclaimer has one head, so the two interactions are mutually exclusive on
 * any given arm), so only one system ever sets it for a given reclaimer — no contention. The work system
 * adds it the frame work begins and removes it the frame work stops (key released, driven away, the job
 * finished), so the arm follows the interaction with no extra wiring.
 */
export interface ReclaimerWorking {
  since: number;
}

export const ReclaimerWorking = defineComponent<ReclaimerWorking>('ReclaimerWorking');
