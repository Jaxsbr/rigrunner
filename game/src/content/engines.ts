import { PARTS_CATALOG, type PartDef, type EnergyType } from './parts-catalog';
import { ENGINE_RECIPE } from './recipes';

/**
 * Engines are no longer hand-authored blueprints (the old Mk1/Mk2 placeholders are retired): every
 * engine is COMPOSED from the four catalog sub-parts of one energy type, exactly as the workshop
 * bench assembles them. Its `EngineSpec` + `Weight` are the sum of its parts, so there is a single
 * way an engine comes to exist — `systems/assembly.ts` builds it from these parts.
 *
 * This module owns only the engine's RECIPE in catalog terms: which four parts make an electric vs a
 * mechanical engine. `composeProduct(world, ENGINE_RECIPE, engineParts(type))` turns that into a
 * finished engine product (the rig's starting engine seeds itself this way in `main.ts`); the bench
 * produces the same thing from parts the player dragged in.
 *
 * Two energy types ⇒ two profiles (the suggested, tunable numbers from the spec):
 *   - electric   ≈ power 13 / torque 8 / weight 4 — snappy, high top speed, light.
 *   - mechanical ≈ power 8 / torque 19 / weight 8 — torquey hauler, heavy, slower to respond.
 * The contrast is emergent from those profiles through `systems/drive.ts` (weight drags, torque
 * fights back); the `EngineSpec` contract downstream is untouched.
 */

/** The four catalog parts that compose an engine of `type`, in the engine recipe's slot order. */
export function engineParts(type: EnergyType): PartDef[] {
  return ENGINE_RECIPE.slots.map((s) => {
    const def = PARTS_CATALOG.find((p) => p.slot === s.slot && p.type === type);
    if (!def) throw new Error(`no ${type} engine part for slot '${s.slot}'`);
    return def;
  });
}
