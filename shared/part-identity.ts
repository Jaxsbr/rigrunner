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
 * The ladder is a clear step up but no longer brutally steep: iron is worth ~1.8× a rusty part. It was
 * eased from the original 2.2× in the 2026-06-07 playtest pass — at 2.2 the starting rusty rig was so
 * far below iron that it couldn't out-pace the looter-camp guards, and lifting the engine base pace to
 * fix that would have ballooned iron (iron = base × mult). Easing the mult narrows the rusty→iron gap
 * so the floor is playable while iron stays the clear upgrade. The numbers are strawmen, tuned against
 * feel — start with two tiers and add `alloy`/`elementium`/… as pure rows when play asks (§6).
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
  { id: 'iron', name: 'Iron', mult: 1.8, finishColor: 0x9aa7b0 }, // iron-grey — cleaner forged steel (eased from 2.2)
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
/** A weapon part role — a base `gun-mount` (the directional turret) plus the `gun-barrel` that seats on
 *  it. Two parts compose the weapon, like the Reclaimer's arm + head; swapping barrels = other weapons. */
export type WeaponPartSlot = 'gun-mount' | 'gun-barrel';
/** Any part role, across all recipes — the role a bench slot matches a part against. */
export type PartSlot = EnginePartSlot | StoragePartSlot | ReclaimerPartSlot | ChassisPartSlot | WeaponPartSlot;
/** An engine's energy type — the electric/steam fork that drives type-lock, feel, and visuals. */
export type EnergyType = 'electric' | 'steam';
/** What a part is for — groups the catalog and drives the chip/portrait tint when there's no energy
 *  type (storage, reclaimer, chassis and weapon parts aren't electric/steam). */
export type PartCategory = 'engine' | 'storage' | 'reclaimer' | 'chassis' | 'weapon';

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

  // 🛞 Chassis 1×3 — the light scout foundation. Every sub-part is per-size: the scout's Frame, its
  // SMALLER Wheel (lower stance) and its scaled-down Suspension. The 1×3 and 3×5 diverged enough that
  // they no longer share a wheel/suspension — each frame instances its own (`docs/part-identity-spec.md` §2b).
  { id: 'wheel-axle-1x3', slot: 'wheel-axle', category: 'chassis', chassisSize: '1x3', displayName: 'Wheel & Axle Set', assetId: 'wheel-axle-sm' },
  { id: 'suspension-steering-1x3', slot: 'suspension-steering', category: 'chassis', chassisSize: '1x3', displayName: 'Suspension & Steering Set', assetId: 'suspension-steering-sm' },
  { id: 'frame-1x3', slot: 'frame', category: 'chassis', chassisSize: '1x3', displayName: 'Chassis Frame', assetId: 'frame-1x3' },

  // 🛞 Chassis 3×5 — the heavy hauler foundation. Its own per-size Frame (more cells, a wider track),
  // instancing the full-size Wheel + Suspension units at its own station sockets.
  { id: 'wheel-axle-3x5', slot: 'wheel-axle', category: 'chassis', chassisSize: '3x5', displayName: 'Wheel & Axle Set', assetId: 'wheel-axle' },
  { id: 'suspension-steering-3x5', slot: 'suspension-steering', category: 'chassis', chassisSize: '3x5', displayName: 'Suspension & Steering Set', assetId: 'suspension-steering' },
  { id: 'frame-3x5', slot: 'frame', category: 'chassis', chassisSize: '3x5', displayName: 'Chassis Frame', assetId: 'frame-3x5' },

  // 🔫 Weapon — the auto-fire gun (looter camps), composed from a Mount (the directional turret HOST,
  // carrying a `socket_barrel` empty the render layer swivels) + a Barrel that seats on it. Two parts
  // like the Reclaimer (arm + head); a future barrel is the same Mount, a different gun.
  { id: 'weapon-mount', slot: 'gun-mount', category: 'weapon', displayName: 'Mount', assetId: 'weapon-mount' },
  { id: 'weapon-barrel', slot: 'gun-barrel', category: 'weapon', displayName: 'Barrel', assetId: 'weapon-barrel' },
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
  { id: 'weapon', label: 'Weapon', emoji: '🔫', subPartIds: ['weapon-mount', 'weapon-barrel'] },
];

/** Resolve a product group id to its definition, or `undefined` if it isn't known. */
export function productGroup(id: string): ProductGroup | undefined {
  return PRODUCT_GROUPS.find((g) => g.id === id);
}

// ── Product composition (how the sub-parts snap into a positioned whole) ────────────────────────────

/**
 * How a product's sub-parts physically compose into one positioned whole (`docs/part-identity-spec.md`
 * §2b "composition via assembly sockets"). One sub-part is the HOST — its GLB carries `socket_<slot>`
 * empties (see `docs/asset-style.md` "Assembly sockets") — and the others snap onto those sockets. The
 * shared assembler (`shared/assembler.ts`) reads this and is used by BOTH the game and the viewer, so a
 * composed product reads identically in both (that parity is the whole point of the descriptor living in
 * `shared/`).
 */
export interface ProductComposition {
  /** The sub-part id that hosts the others — its GLB carries the `socket_*` empties. */
  host: string;
  /**
   * Each non-host sub-part id → the host socket node its origin snaps to. A plain socket name
   * (`'socket_rim'`) is a single attach; a name whose family the host repeats as `socket_<x>_<i>`
   * (`'socket_axle'` → `socket_axle_0`, `socket_axle_1`, …) means "instance this one model at every
   * numbered socket the host exposes" — the assembler resolves which by looking the nodes up by name.
   */
  children: Readonly<Record<string, string>>;
}

/**
 * The products that render as composed sub-parts through the shared assembler. The **Reclaimer** is the
 * one product deliberately ABSENT: its bucket rides the arm's `socket_wrist` exactly like a host socket,
 * but it also ANIMATES, so it keeps its specialised driver (`ReclaimerRig` in each app) rather than the
 * static assembler — the same socket convention, a richer driver.
 *
 * The **chassis** composes here too: its per-size Frame is the host, instancing one shared Wheel unit at
 * every `socket_axle_<i>` and one Suspension unit at every `socket_susp_<i>` the frame exposes (the
 * instanced-stations case the §2b "family socket" convention is built for). In-game the deployed rig's
 * deck, spinnable wheels and deploy unfold are derived from this composed structure (`chassisToRig`), and
 * the viewer renders the same composition — so a chassis reads identically in both apps.
 */
export const PRODUCT_COMPOSITION: Readonly<Record<string, ProductComposition>> = {
  'electric-engine': {
    host: 'e-casing',
    children: { 'e-core': 'socket_core', 'e-coupling': 'socket_coupling', 'e-regulator': 'socket_regulator' },
  },
  'steam-engine': {
    host: 's-boiler',
    children: { 's-piston': 'socket_piston', 's-driveshaft': 'socket_driveshaft', 's-throttle': 'socket_throttle' },
  },
  storage: {
    host: 'container-shell',
    children: { 'container-rim': 'socket_rim' },
  },
  // Chassis — the per-size Frame hosts; the single Wheel + Suspension units instance across the frame's
  // numbered `socket_axle_<i>` / `socket_susp_<i>` corner stations (one logical part each, placed once per
  // corner). The frame owns the corner positions, so each size gets its own track width by construction.
  'chassis-1x3': {
    host: 'frame-1x3',
    children: { 'wheel-axle-1x3': 'socket_axle', 'suspension-steering-1x3': 'socket_susp' },
  },
  'chassis-3x5': {
    host: 'frame-3x5',
    children: { 'wheel-axle-3x5': 'socket_axle', 'suspension-steering-3x5': 'socket_susp' },
  },
  // The weapon — the Mount is the host (its GLB carries `socket_barrel` at the turret pivot); the Barrel
  // seats there. The render layer swivels the `socket_barrel` node so the barrel tracks its target.
  weapon: {
    host: 'weapon-mount',
    children: { 'weapon-barrel': 'socket_barrel' },
  },
};

/** The composition descriptor for a product group, or `undefined` when it doesn't compose via the
 *  assembler (the Reclaimer — see `PRODUCT_COMPOSITION`). */
export function productComposition(groupId: string): ProductComposition | undefined {
  return PRODUCT_COMPOSITION[groupId];
}
