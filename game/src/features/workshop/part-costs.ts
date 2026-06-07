/**
 * Single tuning surface for shop part prices. Edit buyCost here to rebalance the Parts Shop.
 *
 * These are the BASE (rusty, tier-1) prices. Higher tiers are priced up from them by the tier
 * multiplier in `part-shop.ts` (`tieredCost`), so an iron part costs ~2.2× its rusty price without a
 * second list to maintain. The shop stock and resale both derive from this list, so buy/sell
 * economics cannot drift apart.
 */
export interface PartCost {
  partId: string;
  buyCost: number;
}

export const PART_COSTS: readonly PartCost[] = [
  // Storage container.
  { partId: 'container-shell', buyCost: 3 },
  { partId: 'container-rim', buyCost: 2 },

  // Electric engine.
  { partId: 'e-casing', buyCost: 6 },
  { partId: 'e-core', buyCost: 10 },
  { partId: 'e-coupling', buyCost: 6 },
  { partId: 'e-regulator', buyCost: 8 },

  // Steam engine.
  { partId: 's-boiler', buyCost: 8 },
  { partId: 's-piston', buyCost: 12 },
  { partId: 's-driveshaft', buyCost: 7 },
  { partId: 's-throttle', buyCost: 9 },

  // Reclaimer (Option C) — the rummage tool. Bootstrapping constraint: piles are gated behind OWNING
  // it, so it must be affordable from loose scrap ALONE (no pile needed to earn it). It's also the
  // priciest single goal — arm + bucket ≈ 36, about a whole engine and well above a storage container
  // (5) — a deliberate save-up. Tune here against feel (this is the single price surface).
  { partId: 'reclaimer-arm', buyCost: 24 },
  { partId: 'reclaimer-bucket', buyCost: 12 },

  // Weapon (looter camps) — the auto-fire gun: Mount + Barrel. Same bootstrap rule as the Reclaimer:
  // you can't loot your way to the tool that lets you loot, so the pair must be affordable from loose
  // scrap + pile finds BEFORE your first camp. Together ≈ a Reclaimer (a real save-up); the two-part
  // split also lets a future barrel be bought separately onto the same mount.
  { partId: 'weapon-mount', buyCost: 14 },
  { partId: 'weapon-barrel', buyCost: 16 },

  // Trap arm (looter camps Phase 2) — the disarm tool: Boom + Disarm Head. Priced on a par with the
  // Reclaimer (Boom 16 + Head 20 ≈ 36), the spec's "higher save-up goal" alongside the weapon. The
  // Head is the dearer, tier-bearing sub-part: buying an iron Head (the meaningful disarm upgrade) is a
  // deliberate, costly choice the shop scales up the tier ladder. A shop save-up, not a camp drop (trap
  // parts aren't in the lootable SUB_PART_POOL).
  { partId: 'trap-boom', buyCost: 16 },
  { partId: 'disarm-head', buyCost: 20 },

  // Chassis sub-parts — built into a chassis-kit on the bench, then hauled out of the workshop to
  // assemble into a new rig. The 1×3 scout set (~30 total) is an early save-up, on a par with an
  // engine; the 3×5 hauler set (~68) is a major goal. Strawman numbers — tune here against feel.
  { partId: 'wheel-axle-1x3', buyCost: 10 },
  { partId: 'suspension-steering-1x3', buyCost: 8 },
  { partId: 'frame-1x3', buyCost: 12 },
  { partId: 'wheel-axle-3x5', buyCost: 22 },
  { partId: 'suspension-steering-3x5', buyCost: 18 },
  { partId: 'frame-3x5', buyCost: 28 },
];
