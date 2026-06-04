import { defineComponent } from '@core/component';
import type { EntityId } from '@core/types';
import type { EnergyType } from '@common/parts/parts-catalog';

/**
 * Marks an entity as a *composed product* — the thing the bench builds when a recipe's slots are all
 * filled (an assembled engine, a built storage container, …). It is the generic counterpart to
 * `EnginePart`: where an EnginePart is one loose piece, an Assembly is a finished article made FROM
 * several pieces, and it lives in the player's inventory (and, later, mounts on the rig) like any
 * other part.
 *
 * Deliberately recipe-agnostic — it is NOT engine-specific. A product knows three things:
 *   - `recipeId`   which recipe built it (resolve the display name / slot grammar via `recipeById`).
 *   - `parts`      the part entities it was composed from, kept ALIVE and owned by the product. They
 *                  left the bench (and inventory) into here; dismantling the product hands these exact
 *                  same entities back to inventory, so identity and any per-part state are conserved
 *                  end to end (`observations.md` #6–7: parts are stateful vessels — nothing is cloned
 *                  or destroyed across assemble ↔ dismantle).
 *   - `type`       the resolved energy type for typed products (engine: electric/mechanical), or
 *                  `undefined` for untyped ones (a storage container has no energy type). This is the
 *                  no-hybrid marker the chassis type-lock reads in P6.
 *
 * The product also carries the standard downstream capabilities for its kind, attached at assembly
 * time (an engine gets `EngineSpec` + `Weight`; a container gets `Storage` + `Weight`) — see
 * `systems/assembly.ts`. Those are the contract everything downstream already consumes; the Assembly
 * component is just the provenance + dismantle ledger sitting alongside them.
 */
export interface Assembly {
  /** The recipe that produced this product (its id — resolve via `recipeById`). */
  recipeId: string;
  /** The part entities consumed into this product, in recipe-slot order. Returned on dismantle. */
  parts: EntityId[];
  /** The single energy type of the parts (engine products), or `undefined` when untyped (storage). */
  type?: EnergyType;
}

export const Assembly = defineComponent<Assembly>('Assembly');
