/**
 * Material TIERS — the rarity axis every part rides on (`docs/part-identity-spec.md` §4a). A tier is
 * a material grade (rusty → iron → …) that multiplies a part's catalog BASE attributes and gives it a
 * finish colour. It is the anti-explosion guardrail: tiers are NOT separate catalog rows (which would
 * multiply the catalog and the GLBs per tier). Instead the catalog holds one base (tier-1) `PartDef`
 * per slot×type, the part INSTANCE carries its tier, and the multiplier is applied at resolve time
 * (`resolvePartStats` in `@common/sim/assembly`). Adding a tier is one data row here, nothing else.
 *
 * The ladder is deliberately STEEP (§2c): iron is worth ~2.2× a rusty part, so one high-tier part
 * outweighs several low ones. The numbers are strawmen, tuned against feel — start with two tiers and
 * add `alloy`/`elementium`/… as pure rows when play asks (§6).
 */
export type TierId = 'rusty' | 'iron';

export interface Tier {
  id: TierId;
  /** The one-word prefix composed in front of the slot noun at render time ("Iron Shell"). */
  name: string;
  /** Multiplier on a part's base attributes — tier-1 is exactly 1, so a rusty part is its base. */
  mult: number;
  /** Material finish tint (the §3 visual cue): chips, portraits, and world models read this so the
   *  tier reads by LOOKING. Palette-derived hex (the game reads colours as literals, not palette.json). */
  finishColor: number;
}

/** The tiers, low → high. Order is the ladder; index 0 is the base (tier-1) every part defaults to. */
export const TIERS: readonly Tier[] = [
  { id: 'rusty', name: 'Rusty', mult: 1, finishColor: 0x8a4b2f }, // rust — weathered, decayed metal
  { id: 'iron', name: 'Iron', mult: 2.2, finishColor: 0x9aa7b0 }, // iron-grey — cleaner forged steel
];

/** The tier every freshly-spawned part starts at (the base of the ladder). */
export const DEFAULT_TIER: TierId = TIERS[0]!.id;

/** Resolve a tier id to its definition, falling back to the base tier for an unknown id. */
export function tierOf(id: TierId): Tier {
  return TIERS.find((t) => t.id === id) ?? TIERS[0]!;
}
