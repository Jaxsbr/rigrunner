import { defineComponent } from '@core/component';

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
 * The component is deliberately lean: it carries only the catalog `id`. Everything descriptive —
 * slot, energy type, display name, attribute contributions, asset — lives in the parts catalog
 * (`content/parts-catalog.ts`), resolved via `partDef(id)`. That keeps the catalog the single
 * source of truth and the entity a light, movable vessel.
 */
export interface EnginePart {
  /** The catalog id (e.g. `'e-core'`) — look up the full definition with `partDef()`. */
  id: string;
}

export const EnginePart = defineComponent<EnginePart>('EnginePart');
