import type { World } from '@core/world';
import { spawnWorkshop } from '@features/workshop/workshop';
import { spawnWorldShop } from '@features/shop/world-shop-spawn';
import { spawnMountainRange } from '@features/terrain/mountain-mesh';
import { Bench, emptyBenchSlots } from '@features/workshop/bench';
import { ELECTRIC_ENGINE_RECIPE } from '@common/parts/recipes';

/**
 * The fixed, MAP-FREE scaffolding both the real game and the editor lay down: the workshop home base, the
 * world shop, the bounding mountain mesh, and the assembly bench. It deliberately imports NO collision
 * map, so the editor can seed this backdrop without pulling the committed map into its module graph — the
 * editor reads the map fresh from disk over the dev endpoint instead (see `app/editor`), which is what
 * keeps Save from HMR-reloading the editor and what guarantees it never loads a stale map. The real
 * game's `seedStaticWorld` lays these structures, then adds the collision grid from the bundled map.
 */
export function seedStaticStructures(world: World): void {
  // The workshop — home base, a short drive up +Z from spawn, near the centre of the bowl.
  spawnWorkshop(world, 0, 8);

  // The one (rusty) world shop — out toward the bowl's southern rim, a real drive from home but still
  // inside the safe zone.
  spawnWorldShop(world, 36, -37);

  // The bounding mountain range mesh — the bowl wall's visual (the physical wall is the collision grid).
  spawnMountainRange(world);

  // The assembly bench — the singleton role-slot holder the workshop interface composes into.
  const bench = world.createEntity();
  world.add(bench, Bench, {
    recipeId: ELECTRIC_ENGINE_RECIPE.id,
    slots: emptyBenchSlots(ELECTRIC_ENGINE_RECIPE.slots.map((s) => s.slot)),
  });
}
