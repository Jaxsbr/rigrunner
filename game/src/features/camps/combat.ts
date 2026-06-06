/**
 * Combat tuning — the rig-side numbers for the looter-camp fight (the "Tactical" feel preset from the
 * 2026-06-07 build grill). Enemy-side numbers are per-level data in `camp-levels.ts`. All of these are
 * build-time tuning, dialled against feel — scaled to the ~7 u/s rig world so shots are dodgeable by
 * driving. (Per-tier weapon scaling is a later seam: a bought weapon's grade changes its finish, cost
 * and weight today, not its combat numbers.)
 */

/** The mounted auto-fire weapon. Fires any enemy inside its forward cone + range; no ammo, no button. */
export const WEAPON = {
  damage: 10,
  cooldown: 0.5, // seconds between shots (≈ 1.5 s to kill a 30-HP grunt with sustained fire)
  range: 18,
  cone: (50 * Math.PI) / 180, // full FOV; placement still matters — the cone is the part's mount facing
  projectileSpeed: 18, // faster than enemy fire (10) so your shots connect while theirs can be dodged
} as const;

/** Free repair while parked in a workshop zone (home base = safety + repair). HP restored per second. */
export const WORKSHOP_REPAIR_RATE = 20; // ≈ 5 s for a full 100-HP heal

/** Projectile presentation — readable tracers, tinted by team (rig = hazard yellow, enemy = danger red). */
export const PROJECTILE = {
  radius: 0.25, // collision radius — generous so fast shots don't tunnel through a target between frames
  rigColor: 0xffcf3a,
  enemyColor: 0xe0432a,
} as const;
