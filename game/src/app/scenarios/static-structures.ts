import type { World } from '@core/world';
import { spawnMountainRange } from '@features/terrain/mountain-mesh';
import { Bench, emptyBenchSlots } from '@features/workshop/bench';
import { ELECTRIC_ENGINE_RECIPE } from '@common/parts/recipes';

/**
 * The fixed, MAP-FREE singletons both the real game and the editor lay down: the bounding mountain mesh
 * and the assembly bench. These two are seeded in code (not authored as placements) because each is a
 * one-of-a-kind anchor — the mountain is the single ridge the wall collision is baked from, and the bench
 * is the non-spatial role-slot holder the workshop composes into.
 *
 * It deliberately imports NO collision map, so the editor can seed this backdrop without pulling the
 * committed map into its module graph — the editor reads the map fresh from disk over the dev endpoint
 * instead (see `app/editor`), which is what keeps Save from HMR-reloading the editor. Every other
 * structure (the workshop, the world shop, props) is now AUTHORED as a placement in the map and seeded by
 * `spawnPlacements` (`app/world-map`), so positions live in data the editor edits, not in TypeScript.
 */
export function seedStaticStructures(world: World): void {
  // The bounding mountain range mesh — the bowl wall's visual (the physical wall is the collision grid).
  spawnMountainRange(world);

  // The assembly bench — the singleton role-slot holder the workshop interface composes into.
  const bench = world.createEntity();
  world.add(bench, Bench, {
    recipeId: ELECTRIC_ENGINE_RECIPE.id,
    slots: emptyBenchSlots(ELECTRIC_ENGINE_RECIPE.slots.map((s) => s.slot)),
  });
}
