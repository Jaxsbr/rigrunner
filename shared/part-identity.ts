/**
 * Part IDENTITY — the single source of truth for what a part *is*, shared by the game and the asset
 * viewer (`docs/part-identity-spec.md`). It carries the facets both apps must agree on: the material
 * TIERS ladder, and each sub-part's identity record (its slot, category, energy type, display name,
 * and the GLB `assetId` that renders it). It is deliberately PURE — no `three`, no `@core`/`@common`,
 * no ECS — so the viewer can read the exact same roster the game builds from without reaching into the
 * game's source (apps share only through `shared/`).
 *
 * What lives here vs. in the game: identity (this file) is the slot/type/name/asset of a part. The
 * game's `@common/parts/parts-catalog` takes each identity record and attaches its gameplay
 * `attributes` (power/torque/weight/…), producing the full `PartDef`. So a part is described once,
 * here, and the game layers its numbers on top.
 */

// ── Material tiers (the rarity axis) ──────────────────────────────────────────────────────────────

/**
 * The material grade every part rides on (`docs/part-identity-spec.md` §4a). A tier multiplies a
 * part's catalog BASE attributes and gives it a finish colour. It is the anti-explosion guardrail:
 * tiers are NOT separate catalog rows or GLBs (which would multiply the catalog per tier). The catalog
 * holds one base (tier-1) record per slot×type, the part INSTANCE carries its tier, and the multiplier
 * is applied at resolve time. Adding a tier is one data row here, nothing else — and the asset viewer's
 * tier pickers read this list, so they gain a row automatically (no hard-coded rusty/iron).
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
   *  tier reads by LOOKING. Palette-derived hex (colours are carried as literals, not palette.json). */
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

// ── Identity vocabulary (slots, categories, types) ────────────────────────────────────────────────

/** Electric engine slots — the clean/abstract vocabulary. */
export type ElectricEngineSlot = 'casing' | 'core' | 'coupling' | 'regulator';
/** Steam engine slots — the industrial vocabulary, disjoint from electric's (no shared noun). */
export type SteamEngineSlot = 'boiler' | 'piston' | 'driveshaft' | 'throttle';
/** Any engine sub-part role. The two type vocabularies are disjoint, so the slot alone implies the
 *  energy type — the self-enforcing no-hybrid rule (`docs/part-identity-spec.md` §2a). */
export type EnginePartSlot = ElectricEngineSlot | SteamEngineSlot;
/** A storage-container part role. */
export type StoragePartSlot = 'shell' | 'rim';
/** A Reclaimer part role — a base `arm` plus the `head` socket the bucket slots into. */
export type ReclaimerPartSlot = 'arm' | 'head';
/** A chassis part role — wheel/axle (top speed), suspension/steering (turning), frame (load). */
export type ChassisPartSlot = 'wheel-axle' | 'suspension-steering' | 'frame';
/** Any part role, across all recipes — the role a bench slot matches a part against. */
export type PartSlot = EnginePartSlot | StoragePartSlot | ReclaimerPartSlot | ChassisPartSlot;
/** An engine's energy type — the electric/steam fork that drives type-lock, feel, and visuals. */
export type EnergyType = 'electric' | 'steam';
/** What a part is for — groups the catalog and drives the chip/portrait tint when there's no energy
 *  type (storage, reclaimer and chassis parts aren't electric/steam). */
export type PartCategory = 'engine' | 'storage' | 'reclaimer' | 'chassis';

/**
 * One sub-part's identity — everything descriptive and SHARED across every instance of it, minus the
 * gameplay numbers the game attaches. The `assetId` is the GLB that renders the part everywhere it
 * shows (shop, inspect, bench, world); an `assetId` not registered in `shared/assets.ts` falls back to
 * a tinted placeholder, which is exactly what the Phase-1.5 coverage check flags as an unmodelled part.
 */
export interface PartIdentity {
  /** The catalog id (e.g. `'e-core'`) — the stable key the part instance and viewer address it by. */
  id: string;
  slot: PartSlot;
  category: PartCategory;
  /** Engine parts only — electric/steam. Omitted for the untyped categories. */
  type?: EnergyType;
  /** Chassis parts only — which chassis size this sub-part builds. */
  chassisSize?: '1x3' | '3x5';
  /** The bare slot noun shown to the player; the tier prefix is composed in front at render time. */
  displayName: string;
  /** The GLB that renders this part (registered in `shared/assets.ts`), or a yet-to-be-authored id. */
  assetId: string;
}

// ── The sub-part roster ───────────────────────────────────────────────────────────────────────────

/**
 * Every buildable sub-part the game has today, in catalog order. Six products, eighteen sub-part
 * roles (`docs/part-identity-spec.md` Phase 2 map). The game derives its `PARTS_CATALOG` from these
 * records by attaching gameplay attributes; the viewer reads them to let any sub-part be inspected at
 * any tier and composed into its product.
 */
export const PART_IDENTITIES: readonly PartIdentity[] = [
  // ⚡ Electric engine — clean/abstract vocabulary.
  { id: 'e-casing', slot: 'casing', category: 'engine', type: 'electric', displayName: 'Casing', assetId: 'e-casing' },
  { id: 'e-core', slot: 'core', category: 'engine', type: 'electric', displayName: 'Core', assetId: 'e-core' },
  { id: 'e-coupling', slot: 'coupling', category: 'engine', type: 'electric', displayName: 'Coupling', assetId: 'e-coupling' },
  { id: 'e-regulator', slot: 'regulator', category: 'engine', type: 'electric', displayName: 'Regulator', assetId: 'e-regulator' },

  // ♨ Steam engine — industrial vocabulary, disjoint from electric's.
  { id: 's-boiler', slot: 'boiler', category: 'engine', type: 'steam', displayName: 'Boiler', assetId: 's-boiler' },
  { id: 's-piston', slot: 'piston', category: 'engine', type: 'steam', displayName: 'Piston', assetId: 's-piston' },
  { id: 's-driveshaft', slot: 'driveshaft', category: 'engine', type: 'steam', displayName: 'Driveshaft', assetId: 's-driveshaft' },
  { id: 's-throttle', slot: 'throttle', category: 'engine', type: 'steam', displayName: 'Throttle', assetId: 's-throttle' },

  // 📦 Storage container.
  { id: 'container-shell', slot: 'shell', category: 'storage', displayName: 'Shell', assetId: 'container-shell' },
  { id: 'container-rim', slot: 'rim', category: 'storage', displayName: 'Rim', assetId: 'container-rim' },

  // 🦾 Reclaimer — the only product whose sub-parts are already modelled (arm + bucket head).
  { id: 'reclaimer-arm', slot: 'arm', category: 'reclaimer', displayName: 'Arm', assetId: 'reclaimer-arm' },
  { id: 'reclaimer-bucket', slot: 'head', category: 'reclaimer', displayName: 'Bucket', assetId: 'reclaimer-bucket' },

  // 🛞 Chassis 1×3 — the light scout foundation.
  { id: 'wheel-axle-1x3', slot: 'wheel-axle', category: 'chassis', chassisSize: '1x3', displayName: 'Wheel & Axle Set', assetId: 'wheel-axle' },
  { id: 'suspension-steering-1x3', slot: 'suspension-steering', category: 'chassis', chassisSize: '1x3', displayName: 'Suspension & Steering Set', assetId: 'suspension-steering' },
  { id: 'frame-1x3', slot: 'frame', category: 'chassis', chassisSize: '1x3', displayName: 'Chassis Frame', assetId: 'chassis-frame' },

  // 🛞 Chassis 3×5 — the heavy hauler foundation (shares the 1×3 sub-part asset ids).
  { id: 'wheel-axle-3x5', slot: 'wheel-axle', category: 'chassis', chassisSize: '3x5', displayName: 'Wheel & Axle Set', assetId: 'wheel-axle' },
  { id: 'suspension-steering-3x5', slot: 'suspension-steering', category: 'chassis', chassisSize: '3x5', displayName: 'Suspension & Steering Set', assetId: 'suspension-steering' },
  { id: 'frame-3x5', slot: 'frame', category: 'chassis', chassisSize: '3x5', displayName: 'Chassis Frame', assetId: 'chassis-frame' },
];

/** Resolve a sub-part id to its identity record, or `undefined` if the id isn't known. */
export function partIdentity(id: string): PartIdentity | undefined {
  return PART_IDENTITIES.find((p) => p.id === id);
}

// ── Product grouping (which sub-parts compose each buildable) ──────────────────────────────────────

/**
 * A buildable product and the sub-parts it is composed from, in display order. This is the grouping
 * the viewer's "compose a product from a tier-per-sub-part mix" surface is driven by: pick a product,
 * choose a tier per member sub-part, see the whole. The members are an exhaustive partition of
 * `PART_IDENTITIES` (every sub-part belongs to exactly one product — the coverage check enforces it).
 */
export interface ProductGroup {
  /** Stable id (mirrors the game's recipe ids so the two read the same). */
  id: string;
  label: string;
  /** A glanceable marker for the product family (also the spec's table icons). */
  emoji: string;
  /** Member sub-part ids, in the order they should be shown / composed. */
  subPartIds: readonly string[];
}

export const PRODUCT_GROUPS: readonly ProductGroup[] = [
  { id: 'electric-engine', label: 'Electric Engine', emoji: '⚡', subPartIds: ['e-casing', 'e-core', 'e-coupling', 'e-regulator'] },
  { id: 'steam-engine', label: 'Steam Engine', emoji: '♨', subPartIds: ['s-boiler', 's-piston', 's-driveshaft', 's-throttle'] },
  { id: 'storage', label: 'Storage Container', emoji: '📦', subPartIds: ['container-shell', 'container-rim'] },
  { id: 'reclaimer', label: 'Reclaimer', emoji: '🦾', subPartIds: ['reclaimer-arm', 'reclaimer-bucket'] },
  { id: 'chassis-1x3', label: 'Chassis (1×3)', emoji: '🛞', subPartIds: ['wheel-axle-1x3', 'suspension-steering-1x3', 'frame-1x3'] },
  { id: 'chassis-3x5', label: 'Chassis (3×5)', emoji: '🛞', subPartIds: ['wheel-axle-3x5', 'suspension-steering-3x5', 'frame-3x5'] },
];

/** Resolve a product group id to its definition, or `undefined` if it isn't known. */
export function productGroup(id: string): ProductGroup | undefined {
  return PRODUCT_GROUPS.find((g) => g.id === id);
}
