import { defineComponent } from '@core/component';
import type { TierId } from './tiers';

/**
 * Marks an entity as a single *engine sub-part* — one of the four pieces (casing, converter core,
 * energy coupling, regulator) the player assembles into a complete engine on the workshop bench.
 *
 * Distinct from `Part {kind}` (the mountable rig modules — engines, storage). An EnginePart is NOT
 * mounted on the rig directly; it lives in the player's inventory or on a bench slot until four
 * same-type parts are assembled into a real engine (Phase 2). It is a first-class world entity so
 * its identity and any future per-part state survive moves between inventory ↔ bench ↔ engine
 * (`observations.md` #6–7: "parts are stateful vessels").
 *
 * The vessel is deliberately lean. `id` keys the catalog (`parts-catalog.ts`), which holds everything
 * descriptive and SHARED across every instance — slot, energy type, base attributes, asset. What the
 * vessel carries on top is the per-instance state two otherwise-identical parts can DIFFER on: `tier`,
 * the material grade that multiplies the catalog's base attributes at resolve time
 * (`docs/part-identity-spec.md` §4a). A rusty Shell and an iron Shell share one `PartDef` but resolve
 * to different stats because their instances carry different tiers. (`special` — the rare gold buff —
 * is the next per-instance field this vessel grows, in a later part-identity phase.)
 */
export interface EnginePart {
  /** The catalog id (e.g. `'e-core'`) — look up the full base definition with `partDef()`. */
  id: string;
  /** The material grade this instance was made at — scales the base attributes (`TIERS`/`tierOf`). */
  tier: TierId;
}

export const EnginePart = defineComponent<EnginePart>('EnginePart');
