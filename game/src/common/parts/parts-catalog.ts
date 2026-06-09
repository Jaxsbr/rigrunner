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
 * distributed so a full electric set sums to ≈ power 15 / torque 10 / weight 4 (snappy/light — the
 * Runner) and a full steam set to ≈ power 10 / torque 22 / weight 8 (torquey/heavy — the Hauler).
 * They are tunable against feel — these are the engines' absolute pace, and `drive.ts` reads them as
 * THE pace knob (raise here to make the whole game faster, lower to slow it; never a downstream
 * multiplier). They were raised from the original 11/7 · 7/16 in the 2026-06-07 playtest pass so a
 * starting rusty rig out-paces the looter-camp guards (4 u/s) and can kite/overrun rather than crawl.
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
  WeaponPartSlot,
  TrapPartSlot,
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
  // non-chassis part. `topSpeed` + `grip` (wheel/axle), `turning` (suspension) and `loadCapacity`
  // (frame) feed driving + handling — see `drive.ts`/`chassisToRig`: topSpeed → the forward top-speed
  // CEILING the engines fill toward, grip → off-throttle deceleration, turning → turn rate,
  // loadCapacity → the rated carry weight the HUD reads. All scale with the part's tier, so iron
  // running gear lifts the ceiling, brakes harder, turns sharper and hauls more.
  topSpeed?: number;
  grip?: number;
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
  // ⚡ Electric — high power (top speed), low torque, light. Sum: power 15 / torque 10 / weight 4.
  'e-casing': { power: 1, torque: 1, weight: 2, durability: 5, burst: 0 },
  'e-core': { power: 9, torque: 5, weight: 1, durability: 2, burst: 0 },
  'e-coupling': { power: 2, torque: 2, weight: 0, durability: 1, burst: 0 },
  'e-regulator': { power: 3, torque: 2, weight: 1, durability: 1, burst: 4 },

  // ♨ Steam — high torque (hauling), lower power, heavy. Sum: power 10 / torque 22 / weight 8.
  's-boiler': { power: 0, torque: 3, weight: 4, durability: 8, burst: 0 },
  's-piston': { power: 6, torque: 11, weight: 2, durability: 4, burst: 0 },
  's-driveshaft': { power: 1, torque: 4, weight: 1, durability: 2, burst: 0 },
  's-throttle': { power: 3, torque: 4, weight: 1, durability: 2, burst: 3 },

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

  // 🛞 Chassis — each slot owns its handling/structural attributes plus its own weight; power/torque/
  // durability/burst stay 0. Per SIZE: wheel/axle → `topSpeed` (the top-speed CEILING) + `grip`
  // (off-throttle deceleration), suspension → `turning` (turn rate), frame → `loadCapacity`. The
  // scout (1×3) turns sharper (turning 8 > 5); the hauler (3×5) is heavier, carries more
  // (loadCapacity 60 > 24) and rolls a slightly higher ceiling (topSpeed 14 > 12). The ceiling sits
  // just above a fair fully-built top speed, so it bites only over-powered / high-tier builds; the
  // tier multiplier lifts topSpeed/grip/turning from there — iron running gear is faster and handles
  // better. (Tier is the orthogonal material axis on the INSTANCE, scaled at resolve. topSpeed values
  // are strawmen — tune to feel.)
  'wheel-axle-1x3': { power: 0, torque: 0, weight: 3, durability: 0, burst: 0, topSpeed: 12, grip: 6 },
  'suspension-steering-1x3': { power: 0, torque: 0, weight: 2, durability: 0, burst: 0, turning: 8 },
  'frame-1x3': { power: 0, torque: 0, weight: 6, durability: 0, burst: 0, loadCapacity: 24 },
  'wheel-axle-3x5': { power: 0, torque: 0, weight: 7, durability: 0, burst: 0, topSpeed: 14, grip: 6 },
  'suspension-steering-3x5': { power: 0, torque: 0, weight: 5, durability: 0, burst: 0, turning: 5 },
  'frame-3x5': { power: 0, torque: 0, weight: 14, durability: 0, burst: 0, loadCapacity: 60 },

  // 🔫 Weapon — Mount + Barrel. Their only stat in Phase 1 is the WEIGHT they add to the rig (you feel
  // the gun in the handling); the combat numbers (damage/rate/range) are the `WEAPON` constant in
  // `@features/camps`, not per-instance attributes yet. power/torque/durability/burst stay 0. The two
  // sum to the same ~4 weight the single gun carried.
  'weapon-mount': { power: 0, torque: 0, weight: 2, durability: 0, burst: 0 },
  'weapon-barrel': { power: 0, torque: 0, weight: 2, durability: 0, burst: 0 },

  // 🧰 Trap arm — Boom + Disarm Head. Like the Reclaimer/weapon, their only stat is the WEIGHT they add
  // (a real tool you feel in the handling); the disarm difficulty rides the HEAD's tier, read at the
  // puzzle, not as a per-instance attribute. power/torque/durability/burst stay 0. The two sum to 6 —
  // between the weapon (4) and the Reclaimer (8).
  'trap-boom': { power: 0, torque: 0, weight: 4, durability: 0, burst: 0 },
  'disarm-head': { power: 0, torque: 0, weight: 2, durability: 0, burst: 0 },
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
 * The COMMON sub-part loot pool: the loose engine + storage building blocks (not the premium
 * Reclaimer / weapon parts, which are save-up goals in the shop). Derived from the catalog so a new
 * buildable sub-part is lootable the moment it joins — no edit to any loot table. Shared by every loot
 * table that drops sub-parts (the scrap pile, a cleared camp), which is why it sits with the catalog
 * it's drawn from rather than in any one feature.
 */
export const SUB_PART_POOL: readonly string[] = PARTS_CATALOG
  .filter((p) => p.category === 'engine' || p.category === 'storage')
  .map((p) => p.id);

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
