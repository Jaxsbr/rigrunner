import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { EnginePart } from '@common/parts/engine-part';
import { DEFAULT_TIER, type TierId } from '@common/parts/tiers';
import { PART_IDENTITIES, type PartIdentity } from '@shared/part-identity';

/**
 * The engine-parts catalog — the authoritative roster of buildable sub-parts WITH their gameplay
 * numbers (milestone MW, the workshop interface; see `docs/workshop-interface-spec.md`).
 *
 * A part is described in two layers. Its IDENTITY — slot, category, energy type, display name, GLB
 * asset — lives in `shared/part-identity.ts` so the game and the asset viewer read one roster
 * (`docs/part-identity-spec.md`). This module takes each identity record and attaches its `attributes`
 * (power/torque/weight/…), producing the full `PartDef` everything downstream consumes. The identity
 * types are re-exported here so existing `@common/parts/parts-catalog` importers keep one import site.
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
 * distributed so a full electric set sums to ≈ power 11 / torque 7 / weight 4 (snappy/light — the
 * Runner) and a full steam set to ≈ power 7 / torque 16 / weight 8 (torquey/heavy — the Hauler).
 * They are tunable against feel — these are the engines' absolute pace, lowered here to slow the
 * whole game at the source (rather than a multiplier downstream).
 *
 * `durability` and `burst` are reserved placeholders for later milestones (housing durability;
 * output-control boost/overdrive magnitude) — carried so the shape is stable, but nothing consumes
 * them yet.
 */

// Re-export the identity vocabulary so consumers importing these from `@common/parts/parts-catalog`
// keep one import site even though the canonical definitions now live in `shared/`.
export type {
  ElectricEngineSlot,
  SteamEngineSlot,
  EnginePartSlot,
  StoragePartSlot,
  ReclaimerPartSlot,
  ChassisPartSlot,
  PartSlot,
  EnergyType,
  PartCategory,
} from '@shared/part-identity';

/**
 * A part's contribution to the product it's assembled into. `power`/`torque`/`weight` feed the
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

/** A full part definition — its shared identity plus the gameplay attributes the game attaches. */
export interface PartDef extends PartIdentity {
  attributes: PartAttributes;
}

/**
 * The gameplay attributes for each sub-part, keyed by identity id. Kept beside the identity roster it
 * pairs with (`PART_IDENTITIES`) — the two are merged into `PARTS_CATALOG` below. A missing entry is a
 * build error (an identity with no numbers), surfaced when the catalog is assembled.
 */
const PART_ATTRIBUTES: Record<string, PartAttributes> = {
  // ⚡ Electric — high power (top speed), low torque, light. Sum: power 11 / torque 7 / weight 4.
  'e-casing': { power: 1, torque: 1, weight: 2, durability: 5, burst: 0 },
  'e-core': { power: 6, torque: 3, weight: 1, durability: 2, burst: 0 },
  'e-coupling': { power: 2, torque: 1, weight: 0, durability: 1, burst: 0 },
  'e-regulator': { power: 2, torque: 2, weight: 1, durability: 1, burst: 4 },

  // ♨ Steam — high torque (hauling), lower power, heavy. Sum: power 7 / torque 16 / weight 8.
  's-boiler': { power: 0, torque: 2, weight: 4, durability: 8, burst: 0 },
  's-piston': { power: 4, torque: 8, weight: 2, durability: 4, burst: 0 },
  's-driveshaft': { power: 1, torque: 3, weight: 1, durability: 2, burst: 0 },
  's-throttle': { power: 2, torque: 3, weight: 1, durability: 2, burst: 3 },

  // 📦 Storage — weight/durability AND `capacity` (the scrap the container holds). power/torque/burst
  // stay 0 since a container does no engine work. A rusty (tier-1) container sums to capacity 4 — the
  // same CONTAINER_CAPACITY a directly-spawned one carries — and the tier multiplier makes iron hold more.
  'container-shell': { power: 0, torque: 0, weight: 3, durability: 6, burst: 0, capacity: 3 },
  'container-rim': { power: 0, torque: 0, weight: 1, durability: 3, burst: 0, capacity: 1 },

  // 🦾 Reclaimer — a heavy tool the drive must haul; its only stat in PR3 is the WEIGHT it adds. The
  // arm GLB is the articulated `reclaimer-arm` (the render layer parents the bucket onto its wrist
  // socket); power/torque/durability/burst stay 0.
  'reclaimer-arm': { power: 0, torque: 0, weight: 5, durability: 0, burst: 0 },
  'reclaimer-bucket': { power: 0, torque: 0, weight: 3, durability: 0, burst: 0 },

  // 🛞 Chassis — each slot owns one chassis attribute plus its own weight; power/torque/durability/
  // burst stay 0. There is a set PER SIZE: the 3×5 parts are heavier and rated higher than the 1×3's.
  // (Tier is the orthogonal material axis on the part INSTANCE that scales these uniformly at resolve.)
  'wheel-axle-1x3': { power: 0, torque: 0, weight: 3, durability: 0, burst: 0, topSpeed: 12 },
  'suspension-steering-1x3': { power: 0, torque: 0, weight: 2, durability: 0, burst: 0, turning: 8 },
  'frame-1x3': { power: 0, torque: 0, weight: 6, durability: 0, burst: 0, loadCapacity: 24 },
  'wheel-axle-3x5': { power: 0, torque: 0, weight: 7, durability: 0, burst: 0, topSpeed: 16 },
  'suspension-steering-3x5': { power: 0, torque: 0, weight: 5, durability: 0, burst: 0, turning: 5 },
  'frame-3x5': { power: 0, torque: 0, weight: 14, durability: 0, burst: 0, loadCapacity: 60 },
};

/** The full catalog — each shared identity record paired with its gameplay attributes, in roster order. */
export const PARTS_CATALOG: readonly PartDef[] = PART_IDENTITIES.map((identity) => {
  const attributes = PART_ATTRIBUTES[identity.id];
  if (!attributes) throw new Error(`parts-catalog: no attributes for identity '${identity.id}'`);
  return { ...identity, attributes };
});

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
