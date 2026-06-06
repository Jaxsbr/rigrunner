/**
 * The camp difficulty table — a `level` scalar → the data a camp is built from. A new level is a new
 * ROW here, no new code: the spawner reads enemy roster + tuning, the AI reads detection/leash, the
 * clear payout reads `lootId`. Phase 1 ships only level 1; later levels are added as rows (each visually
 * distinct, since level reads visually — no HUD label). Numbers are the "Tactical" feel preset, tuned to
 * the ~7 u/s rig world so enemy fire is dodgeable and a 2-grunt fight is survivable but punishing.
 */
export interface CampLevel {
  /** How many guards ring the camp. */
  enemyCount: number;
  /** Per-enemy hit points (cleared one at a time). */
  enemyHealth: number;
  /** Damage one enemy shot deals to the rig. */
  enemyDamage: number;
  /** Seconds between one enemy's shots. */
  enemyFireInterval: number;
  /** Enemy projectile speed (u/s) — below the rig's top speed band so it can be out-driven. */
  enemyProjectileSpeed: number;
  /** Enemy pursuit speed (u/s) — below the rig's top speed so you can kite/flee. */
  enemyMoveSpeed: number;
  /** Detection radius: the rig within this of a guard wakes it (range ≈ line of sight, no occlusion). */
  detection: number;
  /** Leash distance measured FROM THE CAMP — a guard past this breaks off and returns to post. */
  leash: number;
  /** Which `CAMP_LOOT` table a cleared camp of this level rolls. */
  lootId: string;
}

export const CAMP_LEVELS: Record<number, CampLevel> = {
  1: {
    enemyCount: 2,
    enemyHealth: 30,
    enemyDamage: 6,
    enemyFireInterval: 1.5,
    enemyProjectileSpeed: 10,
    enemyMoveSpeed: 4,
    detection: 16,
    leash: 28,
    lootId: 'level-1',
  },
};

/** Resolve a level scalar to its row, falling back to level 1 for an unknown level. */
export function campLevel(level: number): CampLevel {
  return CAMP_LEVELS[level] ?? CAMP_LEVELS[1]!;
}
