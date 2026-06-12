import type { PartDef } from './parts-catalog';

/**
 * A part's **identity colour** — the chip dot / portrait-placeholder accent that reads as its kind, keyed
 * by energy type when it has one (engines) else by category. This colour IS the type cast
 * (`docs/part-identity-spec.md` §3): electric reads cool/clean, steam warm/copper, storage rig-blue, etc.
 *
 * It is a fact about the PART, not about any one surface, so it lives in `common/parts` and both the
 * workshop (inventory/bench chips) and the world shop (buy/sell cards + portrait fallback) read it — the
 * two were keeping divergent copies of this map (the shop had weapon/trap, the workshop didn't), which is
 * exactly the drift a single source removes.
 */
const FALLBACK = 0x6b6b6b; // scrap_grey — an unkeyed part falls back to the structural grey
const PART_COLOR_BY_KEY: Record<string, number> = {
  electric: 0x59ff9f, // glow_green — cool/clean electric cast
  steam: 0x8a4b2f, // rust — warm/copper steam cast
  storage: 0x2f6f9f, // rig_blue — the player-built signature
  reclaimer: 0xd9a521, // hazard_yellow — the rummage tool's signature
  chassis: 0x6b6b6b, // scrap_grey — the structural foundation
  weapon: 0xe0432a, // the gun's hot signature
  trap: 0xd9a521, // hazard_yellow — the disarm tool
};

/** The colour key for a part: its energy type when it has one (engines), else its category. */
export function partColorKey(def: PartDef): string {
  return def.type ?? def.category;
}

/** The identity colour for a part definition. */
export function partTint(def: PartDef): number {
  return tintForKey(partColorKey(def));
}

/** The identity colour for an already-resolved colour key (products carry no `PartDef`). */
export function tintForKey(key: string): number {
  return PART_COLOR_BY_KEY[key] ?? FALLBACK;
}

/** A colour number as a CSS `#rrggbb` string — for inline tier-finish swatches. */
export function cssHex(n: number): string {
  return '#' + n.toString(16).padStart(6, '0');
}
