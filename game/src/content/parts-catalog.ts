import type { World } from '../core/world';
import type { EntityId } from '../core/types';
import { EnginePart } from '../components/engine-part';

/**
 * The engine-parts catalog — the authoritative roster of buildable engine sub-parts for milestone
 * MW (the workshop interface). See `docs/workshop-interface-spec.md`.
 *
 * An engine is assembled from FOUR slots, always in the same grammar, and comes in TWO energy
 * types. One part per slot per type ⇒ exactly 8 catalog entries:
 *
 *   slot         ⚡ electric                  ⛽ mechanical
 *   ----------   -------------------------    --------------------------
 *   casing       e-casing  Coilframe Casing   m-casing  Drumframe Casing
 *   core         e-core    Motor Coil         m-core    Drive Block
 *   coupling     e-coupling Power Terminal     m-coupling Fuel Feed
 *   regulator    e-regulator Discharge Reg.    m-regulator Governor
 *
 * A complete engine = all four slots filled with parts of the SAME type; the resulting EngineSpec +
 * Weight is the SUM of the four parts' contributions (computed at assembly in Phase 2). The numbers
 * below are distributed so a full electric set sums to ≈ power 13 / torque 8 / weight 4 and a full
 * mechanical set to ≈ power 8 / torque 19 / weight 8 — the suggested engine profiles in the spec
 * (electric = snappy/light, mechanical = torquey/heavy). They are tunable against feel in P5.
 *
 * `durability` and `burst` are reserved placeholders for later milestones (casing durability;
 * regulator boost/overdrive magnitude) — carried so the shape is stable, but nothing consumes them
 * yet. Likewise `assetId` is a forward-looking stable id; no GLB is registered for these in MW, so
 * nothing renders a part until real assets land (P3 falls back gracefully).
 */
export type EnginePartSlot = 'casing' | 'core' | 'coupling' | 'regulator';
export type EnergyType = 'electric' | 'mechanical';

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
}

export interface PartDef {
  id: string;
  slot: EnginePartSlot;
  type: EnergyType;
  displayName: string;
  attributes: PartAttributes;
  assetId: string;
}

export const PARTS_CATALOG: readonly PartDef[] = [
  // ⚡ Electric — high power (top speed), low torque, light. Sum: power 13 / torque 8 / weight 4.
  {
    id: 'e-casing',
    slot: 'casing',
    type: 'electric',
    displayName: 'Coilframe Casing',
    attributes: { power: 1, torque: 1, weight: 2, durability: 5, burst: 0 },
    assetId: 'e-casing',
  },
  {
    id: 'e-core',
    slot: 'core',
    type: 'electric',
    displayName: 'Motor Coil',
    attributes: { power: 8, torque: 3, weight: 1, durability: 2, burst: 0 },
    assetId: 'e-core',
  },
  {
    id: 'e-coupling',
    slot: 'coupling',
    type: 'electric',
    displayName: 'Power Terminal',
    attributes: { power: 2, torque: 1, weight: 0, durability: 1, burst: 0 },
    assetId: 'e-coupling',
  },
  {
    id: 'e-regulator',
    slot: 'regulator',
    type: 'electric',
    displayName: 'Discharge Regulator',
    attributes: { power: 2, torque: 3, weight: 1, durability: 1, burst: 4 },
    assetId: 'e-regulator',
  },

  // ⛽ Mechanical — high torque (hauling), lower power, heavy. Sum: power 8 / torque 19 / weight 8.
  {
    id: 'm-casing',
    slot: 'casing',
    type: 'mechanical',
    displayName: 'Drumframe Casing',
    attributes: { power: 0, torque: 2, weight: 4, durability: 8, burst: 0 },
    assetId: 'm-casing',
  },
  {
    id: 'm-core',
    slot: 'core',
    type: 'mechanical',
    displayName: 'Drive Block',
    attributes: { power: 5, torque: 10, weight: 2, durability: 4, burst: 0 },
    assetId: 'm-core',
  },
  {
    id: 'm-coupling',
    slot: 'coupling',
    type: 'mechanical',
    displayName: 'Fuel Feed',
    attributes: { power: 1, torque: 3, weight: 1, durability: 2, burst: 0 },
    assetId: 'm-coupling',
  },
  {
    id: 'm-regulator',
    slot: 'regulator',
    type: 'mechanical',
    displayName: 'Governor',
    attributes: { power: 2, torque: 4, weight: 1, durability: 2, burst: 3 },
    assetId: 'm-regulator',
  },
];

/** Resolve a catalog id to its definition, or `undefined` if the id isn't in the catalog. */
export function partDef(id: string): PartDef | undefined {
  return PARTS_CATALOG.find((p) => p.id === id);
}

/**
 * Spawn one engine sub-part as a loose world entity carrying the `EnginePart` vessel (the catalog
 * id). It is NOT placed in the scene and carries no Transform/Renderable yet — in MW a part only
 * exists to be owned (inventory) and, later, assembled. P3 adds the visual/portrait seam.
 */
export function spawnEnginePart(world: World, def: PartDef): EntityId {
  const e = world.createEntity();
  world.add(e, EnginePart, { id: def.id });
  return e;
}
