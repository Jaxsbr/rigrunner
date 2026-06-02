/**
 * Single tuning surface for shop part prices. Edit buyCost here to rebalance the Parts Shop.
 *
 * The shop stock derives from this list, and resale is calculated from the same buyCost so buy/sell
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

  // Mechanical engine.
  { partId: 'm-casing', buyCost: 8 },
  { partId: 'm-core', buyCost: 12 },
  { partId: 'm-coupling', buyCost: 7 },
  { partId: 'm-regulator', buyCost: 9 },
];
