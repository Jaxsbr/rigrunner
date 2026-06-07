import type { TierId } from '@common/parts/tiers';

/**
 * Disarm tuning + the pure outcome maths for the trap-arm timing puzzle (looter camps Phase 2). The
 * puzzle is a timing sweet-spot: a marker sweeps a bar, the player strikes to land it in a lit zone,
 * for N rounds. The trap arm's HEAD tier sets the difficulty (zone width + round count) — a rusty head
 * is many narrow rounds, an iron head one wide round (effectively automatic). All build-time tuning.
 *
 * This module is deliberately PURE (no World, no DOM): the difficulty table, the grade rule, and the
 * damage roll are all plain functions over numbers, so the whole outcome model is unit-testable. The
 * overlay UI (`disarm-overlay.ts`) and the sim payout (`resolveDisarm` in `camp-system.ts`) call into it.
 */

/** The three disarm outcomes (spec §5). All three CLEAR the camp; only the loot + rig damage differ. */
export type DisarmGrade = 'success' | 'partial' | 'fail';

/** What a tier makes the puzzle: how many rounds to land, and how wide the target zone is (0..1 of the bar). */
export interface DisarmDifficulty {
  rounds: number;
  /** Target-zone width as a fraction of the bar — wider is easier to land. */
  zoneWidth: number;
}

/**
 * Tier → puzzle difficulty. Rusty is the hard, default head (3 narrow rounds); iron is the easy upgrade
 * (one wide round ≈ automatic). With two tiers today this is the whole ladder; a new tier added to
 * `TIERS` must add its row here (the exhaustive `Record` makes that a compile-time nudge).
 */
export const DISARM_DIFFICULTY: Record<TierId, DisarmDifficulty> = {
  rusty: { rounds: 3, zoneWidth: 0.16 },
  iron: { rounds: 1, zoneWidth: 0.34 },
};

/** The shared, non-per-tier disarm tuning. */
export const DISARM = {
  /** How close (world units) to the camp centre the rig must be for the disarm gate to open. Doubles as
   *  the proximity-disc radius, so the lit ring's edge IS the gate boundary (disc + prompt in lockstep). */
  range: 6,
  /** Seconds for the marker to sweep the bar once; it bounces back and forth at this constant pace. */
  crossSeconds: 0.9,
  /** A botched-but-not-failed disarm has this CHANCE of nicking the rig… */
  partialChance: 0.5,
  /** …for this much damage when it does. */
  partialDamage: 15,
  /** A failed disarm always springs the trap for this much damage. */
  failDamage: 30,
} as const;

/** The puzzle difficulty for a head tier, falling back to the hard rusty default for an unknown tier. */
export function difficultyFor(tier: TierId): DisarmDifficulty {
  return DISARM_DIFFICULTY[tier] ?? DISARM_DIFFICULTY.rusty;
}

/**
 * Grade a finished disarm by how many of the N rounds the player landed (spec §5, "play all N, tally"):
 * all landed → success, none landed → fail, anything between → partial. For a one-round (iron) puzzle
 * this is binary success/fail; for three rounds (rusty) landing even one salvages a partial.
 */
export function gradeDisarm(hits: number, rounds: number): DisarmGrade {
  if (hits >= rounds) return 'success';
  if (hits <= 0) return 'fail';
  return 'partial';
}

/**
 * The rig damage a disarm outcome deals: fail always springs the trap; partial has a chance to nick you;
 * success is clean. `rng` is drawn ONLY on the partial branch (success/fail are deterministic), so the
 * caller's seeded sequence stays predictable.
 */
export function disarmDamage(grade: DisarmGrade, rng: () => number): number {
  if (grade === 'fail') return DISARM.failDamage;
  if (grade === 'partial') return rng() < DISARM.partialChance ? DISARM.partialDamage : 0;
  return 0;
}
