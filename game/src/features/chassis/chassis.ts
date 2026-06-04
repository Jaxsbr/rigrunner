import { PARTS_CATALOG, type PartDef } from '@common/parts/parts-catalog';
import { chassisRecipeForSize } from '@common/parts/recipes';
import type { ChassisSize } from '@common/components/chassis';

/**
 * The chassis feature's recipe-in-catalog-terms — the chassis counterpart to `engineParts(type)`
 * (`@features/engine/engines.ts`). A chassis is COMPOSED from three sub-parts of one size, exactly as
 * the workshop bench will assemble it (PR2); `composeProduct(world, chassisRecipeForSize(size),
 * chassisParts(size))` turns that into a finished chassis product, which `spawnRig` then makes
 * drivable.
 *
 * There is one sub-part per slot per size (`wheel-axle-1x3` … `frame-3x5`), so this picks the three
 * catalog entries whose id ends in the size — the same shape the bench will enforce by slot.
 */

/** The three catalog sub-parts that compose a chassis of `size`, in the chassis recipe's slot order. */
export function chassisParts(size: ChassisSize): PartDef[] {
  return chassisRecipeForSize(size).slots.map((s) => {
    const def = PARTS_CATALOG.find((p) => p.category === 'chassis' && p.slot === s.slot && p.id.endsWith(size));
    if (!def) throw new Error(`no ${size} chassis part for slot '${s.slot}'`);
    return def;
  });
}
