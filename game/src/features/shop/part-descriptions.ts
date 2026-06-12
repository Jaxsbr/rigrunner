/**
 * One-line, functional "what it does" blurbs per catalog part — the shop's **self-describing entries**.
 * Browsing a shop is meant to teach the possibility space: a card reads "Reclaimer arm — assemble with
 * a bucket to dig scrap piles," so a player learns what a tool is *for* before they own it.
 *
 * Shops sell sub-parts (you assemble the product at the workshop), so each blurb is written at the
 * sub-part level but points at the **product** it builds toward — that's the bit that teaches.
 *
 * Lives in `features/shop/` because the shop is the only consumer today; promote it to `common/` only
 * if a second feature (e.g. a LOCKED-state "Needs X…" hint) starts reading it (Rule of Three).
 */
const PART_DESCRIPTIONS: Record<string, string> = {
  // 📦 Storage container.
  'container-shell': 'Storage shell — assembles with a rim into a cargo container that fills as you drive over scrap.',
  'container-rim': 'Storage rim — the collar that completes a cargo container.',

  // ⚡ Electric engine.
  'e-casing': 'Electric casing — the open frame that holds an electric engine together.',
  'e-core': 'Electric core — turns charge into drive; the heart of an electric engine.',
  'e-coupling': 'Electric coupling — passes the core’s output through to the wheels.',
  'e-regulator': 'Electric regulator — meters an electric engine’s power delivery.',

  // ♨ Steam engine.
  's-boiler': 'Steam boiler — the open frame that holds a steam engine together.',
  's-piston': 'Steam piston — turns pressure into drive; the heart of a steam engine.',
  's-driveshaft': 'Steam driveshaft — passes the piston’s stroke through to the wheels.',
  's-throttle': 'Steam throttle — meters a steam engine’s power delivery.',

  // 🦾 Reclaimer + restoration head.
  'reclaimer-arm': 'Reclaimer arm — assemble with a bucket to dig scrap piles for loot.',
  'reclaimer-bucket': 'Reclaimer bucket — the digging head; fits a reclaimer arm to work scrap piles.',
  'stump-healer': 'Stump-healer head — swaps onto a reclaimer arm to grow cleared sites back to life.',

  // 🔫 Weapon.
  'weapon-mount': 'Weapon mount — assemble with a barrel into an auto-firing gun for clearing camps.',
  'weapon-barrel': 'Weapon barrel — the firing head; fits a weapon mount.',

  // 🧰 Trap arm.
  'trap-boom': 'Trap boom — assemble with a disarm head into the arm that disarms camp traps.',
  'disarm-head': 'Disarm head — the probing tip; fits a trap boom to safely disarm traps.',

  // 🛞 Chassis sub-parts (built into a kit on the bench, then hauled out as a new rig).
  'wheel-axle-1x3': 'Scout wheels & axle — running gear for a 1×3 chassis; more grip brakes tighter.',
  'suspension-steering-1x3': 'Scout suspension & steering — sharper cornering for a 1×3 chassis.',
  'frame-1x3': 'Scout frame — the mounting deck a 1×3 chassis is built on; sets its carry weight.',
  'wheel-axle-3x5': 'Hauler wheels & axle — running gear for a 3×5 chassis; more grip brakes tighter.',
  'suspension-steering-3x5': 'Hauler suspension & steering — sharper cornering for a 3×5 chassis.',
  'frame-3x5': 'Hauler frame — the mounting deck a 3×5 chassis is built on; sets its carry weight.',
};

/** The functional blurb for a catalog part, or undefined if it has none. */
export function partDescription(partId: string): string | undefined {
  return PART_DESCRIPTIONS[partId];
}
