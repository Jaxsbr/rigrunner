import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { EnginePart } from '@common/parts/engine-part';
import { DEFAULT_TIER, type TierId } from '@common/parts/tiers';
import type { ChassisSize } from '@common/components/chassis';

/**
 * The engine-parts catalog — the authoritative roster of buildable engine sub-parts (milestone MW,
 * the workshop interface; see `docs/workshop-interface-spec.md`).
 *
 * An engine is assembled from FOUR slots and comes in TWO energy types whose part vocabularies
 * DIVERGE: electric and steam share no slot noun, so the noun itself tells you the type and a Boiler
 * can never sit in an electric Casing slot — the no-hybrid rule is a fact of the parts, not a check
 * (`docs/part-identity-spec.md` §2). One part per slot per type ⇒ 8 engine catalog entries (the
 * untyped storage / reclaimer / chassis recipes add their own parts below):
 *
 *   function     ⚡ electric                ♨ steam
 *   ----------   -----------------------   --------------------------
 *   housing      e-casing    Casing        s-boiler      Boiler
 *   converter    e-core      Core          s-piston      Piston
 *   transmit     e-coupling  Coupling      s-driveshaft  Driveshaft
 *   output       e-regulator Regulator     s-throttle    Throttle
 *
 * A complete engine = all four slots filled with parts of ONE type; the resulting EngineSpec +
 * Weight is the SUM of the four parts' contributions (computed at assembly). The numbers below are
 * distributed so a full electric set sums to ≈ power 13 / torque 8 / weight 4 (snappy/light — the
 * Runner) and a full steam set to ≈ power 8 / torque 19 / weight 8 (torquey/heavy — the Hauler).
 * They are tunable against feel.
 *
 * `durability` and `burst` are reserved placeholders for later milestones (housing durability;
 * output-control boost/overdrive magnitude) — carried so the shape is stable, but nothing consumes
 * them yet. Likewise `assetId` is a forward-looking stable id; engine sub-parts have no GLB of their
 * own, so a loose part falls back to a tinted placeholder until real assets land.
 */
/** Electric engine slots — the clean/abstract vocabulary. */
export type ElectricEngineSlot = 'casing' | 'core' | 'coupling' | 'regulator';
/** Steam engine slots — the industrial vocabulary, disjoint from electric's (no shared noun). */
export type SteamEngineSlot = 'boiler' | 'piston' | 'driveshaft' | 'throttle';
/** Any engine sub-part role. The two type vocabularies are disjoint, so the slot alone implies the
 *  energy type — the self-enforcing no-hybrid rule (`docs/part-identity-spec.md` §2a). */
export type EnginePartSlot = ElectricEngineSlot | SteamEngineSlot;
/** A storage-container part role (a second recipe — see `content/recipes.ts`). */
export type StoragePartSlot = 'shell' | 'rim';
/** A Reclaimer part role (Option C) — the first NON-engine socket grammar: a base `arm` plus the
 * `head` socket the bucket slots into (mirrors the articulation contract's `socket_wrist`). */
export type ReclaimerPartSlot = 'arm' | 'head';
/** A chassis part role — the three sub-parts a chassis is composed from: the wheel/axle set (top
 * speed), the suspension/steering set (turning), and the frame (load capacity). */
export type ChassisPartSlot = 'wheel-axle' | 'suspension-steering' | 'frame';
/** Any part role, across all recipes — the role a bench slot matches a part against. */
export type PartSlot = EnginePartSlot | StoragePartSlot | ReclaimerPartSlot | ChassisPartSlot;
export type EnergyType = 'electric' | 'steam';
/** What a part is for — groups the catalog and drives the chip/portrait tint when there's no
 * energy type (storage, reclaimer and chassis parts aren't electric/steam). */
export type PartCategory = 'engine' | 'storage' | 'reclaimer' | 'chassis';

/**
 * A part's contribution to the engine it's assembled into. `power`/`torque`/`weight` feed the
 * EngineSpec + Weight contract everything downstream already consumes; `durability`/`burst` are
 * reserved for later (not read in MW).
 */
export interface PartAttributes {
  power: number;
  torque: number;
  weight: number;
  durability: number; // reserved (casing toughness) — not consumed in MW
  burst: number;      // reserved (regulator boost/overdrive magnitude) — not consumed in MW
  // Chassis sub-part contributions — summed into a `Chassis` at assembly. Omitted (≡ 0) on every
  // non-chassis part. topSpeed/turning are inert until the laden-weight milestone; loadCapacity is
  // the rated carry weight the HUD reads.
  topSpeed?: number;
  turning?: number;
  loadCapacity?: number;
  // Storage sub-part contribution — the scrap a container can hold, summed at assembly into the
  // product's `Storage.capacity` (docs/part-identity-spec.md §4c). Rides only on Shell/Rim; ≡ 0
  // elsewhere. Scaled by tier like every attribute, so an iron container holds more than a rusty one.
  capacity?: number;
}

export interface PartDef {
  id: string;
  slot: PartSlot;
  category: PartCategory;
  /** Engine parts only — electric/steam (drives the type-lock). Omitted for untyped parts. */
  type?: EnergyType;
  /** Chassis parts only — which chassis size this sub-part builds. Drives the bench's size-match
   *  guard (a 1×3 part can't join a 3×5 chassis), the size counterpart to the no-hybrid type rule. */
  chassisSize?: ChassisSize;
  displayName: string;
  attributes: PartAttributes;
  assetId: string;
}

export const PARTS_CATALOG: readonly PartDef[] = [
  // ⚡ Electric — high power (top speed), low torque, light. Sum: power 13 / torque 8 / weight 4.
  {
    id: 'e-casing',
    slot: 'casing',
    category: 'engine',
    type: 'electric',
    displayName: 'Casing',
    attributes: { power: 1, torque: 1, weight: 2, durability: 5, burst: 0 },
    assetId: 'e-casing',
  },
  {
    id: 'e-core',
    slot: 'core',
    category: 'engine',
    type: 'electric',
    displayName: 'Core',
    attributes: { power: 8, torque: 3, weight: 1, durability: 2, burst: 0 },
    assetId: 'e-core',
  },
  {
    id: 'e-coupling',
    slot: 'coupling',
    category: 'engine',
    type: 'electric',
    displayName: 'Coupling',
    attributes: { power: 2, torque: 1, weight: 0, durability: 1, burst: 0 },
    assetId: 'e-coupling',
  },
  {
    id: 'e-regulator',
    slot: 'regulator',
    category: 'engine',
    type: 'electric',
    displayName: 'Regulator',
    attributes: { power: 2, torque: 3, weight: 1, durability: 1, burst: 4 },
    assetId: 'e-regulator',
  },

  // ♨ Steam — high torque (hauling), lower power, heavy. Sum: power 8 / torque 19 / weight 8. Its
  // industrial vocabulary (boiler/piston/driveshaft/throttle) is disjoint from electric's, so the
  // noun alone marks the type — see the header.
  {
    id: 's-boiler',
    slot: 'boiler',
    category: 'engine',
    type: 'steam',
    displayName: 'Boiler',
    attributes: { power: 0, torque: 2, weight: 4, durability: 8, burst: 0 },
    assetId: 's-boiler',
  },
  {
    id: 's-piston',
    slot: 'piston',
    category: 'engine',
    type: 'steam',
    displayName: 'Piston',
    attributes: { power: 5, torque: 10, weight: 2, durability: 4, burst: 0 },
    assetId: 's-piston',
  },
  {
    id: 's-driveshaft',
    slot: 'driveshaft',
    category: 'engine',
    type: 'steam',
    displayName: 'Driveshaft',
    attributes: { power: 1, torque: 3, weight: 1, durability: 2, burst: 0 },
    assetId: 's-driveshaft',
  },
  {
    id: 's-throttle',
    slot: 'throttle',
    category: 'engine',
    type: 'steam',
    displayName: 'Throttle',
    attributes: { power: 2, torque: 4, weight: 1, durability: 2, burst: 3 },
    assetId: 's-throttle',
  },

  // 📦 Storage container — a SECOND recipe (`STORAGE_RECIPE`): two parts, no energy type. Storage
  // parts contribute weight/durability AND `capacity` — the scrap the assembled container holds.
  // power/torque/burst stay 0 since a container does no engine work. The shell holds the bulk; the
  // rim a little more. A rusty (tier-1) container sums to capacity 4 — the same `CONTAINER_CAPACITY`
  // a directly-spawned one carries — and the tier multiplier makes an iron container hold more.
  {
    id: 'container-shell',
    slot: 'shell',
    category: 'storage',
    displayName: 'Shell',
    attributes: { power: 0, torque: 0, weight: 3, durability: 6, burst: 0, capacity: 3 },
    assetId: 'container-shell',
  },
  {
    id: 'container-rim',
    slot: 'rim',
    category: 'storage',
    displayName: 'Rim',
    attributes: { power: 0, torque: 0, weight: 1, durability: 3, burst: 0, capacity: 1 },
    assetId: 'container-rim',
  },

  // 🦾 Reclaimer — the rummage tool (Option C / PR3): a THIRD recipe (`RECLAIMER_RECIPE`) and the
  // first non-engine socket grammar — a base `arm` plus a `head` socket the bucket slots into. No
  // energy type (it does no engine work, so it never enters the no-hybrid rule); it contributes only
  // WEIGHT — a heavy tool the drive must haul, the felt tradeoff of mounting it. The arm GLB is the
  // articulated `reclaimer-arm` whose wrist socket the render layer parents the bucket onto, so the
  // assembled product renders the arm and the head rides along (see render/articulation.ts). power/
  // torque/durability/burst stay 0 — the Reclaimer's only stat in PR3 is the weight it adds.
  {
    id: 'reclaimer-arm',
    slot: 'arm',
    category: 'reclaimer',
    displayName: 'Arm',
    attributes: { power: 0, torque: 0, weight: 5, durability: 0, burst: 0 },
    assetId: 'reclaimer-arm',
  },
  {
    id: 'reclaimer-bucket',
    slot: 'head',
    category: 'reclaimer',
    displayName: 'Bucket',
    attributes: { power: 0, torque: 0, weight: 3, durability: 0, burst: 0 },
    assetId: 'reclaimer-bucket',
  },

  // 🛞 Chassis sub-parts — the foundation a rig is built on, composed from three slots (wheel/axle,
  // suspension/steering, frame) like an engine is from four. No energy type (it does no engine work).
  // Each slot owns one chassis attribute plus its own weight; power/torque/durability/burst stay 0.
  // There is a set PER SIZE: the 3×5 parts are heavier and rated higher than the 1×3's — a bigger
  // foundation. (Tier — rusty/iron/… — is the orthogonal material axis on the part INSTANCE that
  // multiplies these base values uniformly at resolve time; see `tiers.ts` and `resolvePartStats`.)

  // 1×3 — the light scout foundation.
  {
    id: 'wheel-axle-1x3',
    slot: 'wheel-axle',
    category: 'chassis',
    chassisSize: '1x3',
    displayName: 'Wheel & Axle Set',
    attributes: { power: 0, torque: 0, weight: 3, durability: 0, burst: 0, topSpeed: 12 },
    assetId: 'wheel-axle',
  },
  {
    id: 'suspension-steering-1x3',
    slot: 'suspension-steering',
    category: 'chassis',
    chassisSize: '1x3',
    displayName: 'Suspension & Steering Set',
    attributes: { power: 0, torque: 0, weight: 2, durability: 0, burst: 0, turning: 8 },
    assetId: 'suspension-steering',
  },
  {
    id: 'frame-1x3',
    slot: 'frame',
    category: 'chassis',
    chassisSize: '1x3',
    displayName: 'Chassis Frame',
    attributes: { power: 0, torque: 0, weight: 6, durability: 0, burst: 0, loadCapacity: 24 },
    assetId: 'chassis-frame',
  },

  // 3×5 — the heavy hauler foundation: more capacity, lower nimbleness, heavier.
  {
    id: 'wheel-axle-3x5',
    slot: 'wheel-axle',
    category: 'chassis',
    chassisSize: '3x5',
    displayName: 'Wheel & Axle Set',
    attributes: { power: 0, torque: 0, weight: 7, durability: 0, burst: 0, topSpeed: 16 },
    assetId: 'wheel-axle',
  },
  {
    id: 'suspension-steering-3x5',
    slot: 'suspension-steering',
    category: 'chassis',
    chassisSize: '3x5',
    displayName: 'Suspension & Steering Set',
    attributes: { power: 0, torque: 0, weight: 5, durability: 0, burst: 0, turning: 5 },
    assetId: 'suspension-steering',
  },
  {
    id: 'frame-3x5',
    slot: 'frame',
    category: 'chassis',
    chassisSize: '3x5',
    displayName: 'Chassis Frame',
    attributes: { power: 0, torque: 0, weight: 14, durability: 0, burst: 0, loadCapacity: 60 },
    assetId: 'chassis-frame',
  },
];

/** Resolve a catalog id to its definition, or `undefined` if the id isn't in the catalog. */
export function partDef(id: string): PartDef | undefined {
  return PARTS_CATALOG.find((p) => p.id === id);
}

/**
 * Spawn one catalog sub-part as a loose world entity carrying the `EnginePart` vessel — the catalog
 * `id` plus the `tier` it was made at (defaulting to the base of the ladder). It is NOT placed in the
 * scene and carries no Transform/Renderable yet — a loose part only exists to be owned (inventory)
 * and, later, assembled.
 *
 * The name reflects the registry it draws from, not one kind: it spawns ANY catalog sub-part — engine
 * pieces, container shells, Reclaimer parts, chassis parts. The shop hands it a non-default tier to
 * mint an iron part (`@features/workshop/shop`); seeds and the bench use the rusty default.
 */
export function spawnCatalogPart(world: World, def: PartDef, tier: TierId = DEFAULT_TIER): EntityId {
  const e = world.createEntity();
  world.add(e, EnginePart, { id: def.id, tier });
  return e;
}
