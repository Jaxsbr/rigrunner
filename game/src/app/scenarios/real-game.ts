import { World } from '@core/world';
import type { Scenario } from '../scenario';
import { spawnRig } from '@features/mounting/rig';
import { engineParts } from '@features/engine/engines';
import { spawnWorkshop } from '@features/workshop/workshop';
import { scatterScrap, spawnScrapPile } from '@features/scrap/scrap';
import { Transform } from '@common/components/transform';
import { Wallet } from '@features/economy/wallet';
import { Inventory } from '@features/economy/inventory';
import { Bench, emptyBenchSlots } from '@features/workshop/bench';
import { ELECTRIC_ENGINE_RECIPE, STORAGE_RECIPE } from '@common/parts/recipes';
import { partDef } from '@common/parts/parts-catalog';
import { composeProduct } from '@common/sim/assembly';
import { placeProductInWorld } from '@features/workshop/assembly';
import { mountPart } from '@features/mounting/mounting';
import { markOwned, setActiveRig } from '@features/chassis/ownership';
import { spawnCamp } from '@features/camps/camp-spawn';

/**
 * The **real game** scenario — the world a player plays, launched by `npm run dev:game`. It is split at
 * the persistence seam:
 *
 *  - `seedStaticWorld` lays the fixed scaffolding every session has regardless of progress (the
 *    workshop home base and the assembly bench). **Both** New Game and Continue run it first — it is
 *    NOT part of the save.
 *  - `seedNewGameContent` lays the starting progress (rig, scrap field, piles, a camp, the starting
 *    wallet) — the stuff a save later carries. Only New Game runs it; Continue instead rebuilds that
 *    progress from the snapshot (`restoreSnapshot`).
 *
 * `seed` (the `Scenario` contract, used for a brand-new game) is the two together. The cold-open is
 * **provisional** — Phase 1 of `real-world-and-progression-spec.md` crafts the designed opening in
 * earnest. What matters now is that the real game stands on its own, free of the sandbox's scaffolding.
 */
export const realGameScenario: Scenario = {
  seed(world: World): void {
    seedStaticWorld(world);
    seedNewGameContent(world);
  },
};

/** The fixed, non-progress scaffolding both New Game and Continue lay down first. */
export function seedStaticWorld(world: World): void {
  // The workshop — home base, a short drive up +Z from spawn. Park the rig in its proximity zone to
  // open the workshop interface (build/assemble parts) and to drain full containers into the wallet.
  spawnWorkshop(world, 0, 8);

  // The assembly bench — a singleton: the role slots the workshop interface drops parts into while
  // composing the active recipe's output. Starts on the engine recipe, empty.
  const bench = world.createEntity();
  world.add(bench, Bench, {
    recipeId: ELECTRIC_ENGINE_RECIPE.id,
    slots: emptyBenchSlots(ELECTRIC_ENGINE_RECIPE.slots.map((s) => s.slot)),
  });
}

/** The starting progress a New Game begins with — everything the save would later carry. */
export function seedNewGameContent(world: World): void {
  const player = spawnRig(world); // a scrap 1×3 chassis — a 3-cell deck (col 0, rows 0–2)
  markOwned(world, player);
  setActiveRig(world, player);
  const rigT = world.get(player, Transform)!;
  // The starter carries a mounted electric engine AND a storage container — a clean, immediately
  // playable rig. Storage is mounted from the start so the first action reads plainly: drive over loose
  // scrap to sweep it in. The Reclaimer that works piles is deliberately NOT given — buying it is the
  // spine's first earned rung.
  {
    const engine = composeProduct(world, ELECTRIC_ENGINE_RECIPE, engineParts('electric'));
    placeProductInWorld(world, engine, rigT.x, rigT.z);
    mountPart(world, engine, player, 0, 1); // centre deck cell
  }
  {
    const storage = composeProduct(world, STORAGE_RECIPE, ['container-shell', 'container-rim'].map((id) => partDef(id)!));
    placeProductInWorld(world, storage, rigT.x, rigT.z);
    mountPart(world, storage, player, 0, 0); // end deck cell
  }
  // A modest loose-scrap field — the New-Game starter (not re-laid on Continue, so a reload can't farm
  // it). A few rummageable piles and one reachable level-1 camp teach the spine: sweep scrap → buy a
  // Reclaimer → work a pile → buy a weapon → clear the camp.
  scatterScrap(world, 48, 5, 26);
  for (const [x, z] of [[-10, 2], [12, -4], [6, -14]] as const) {
    spawnScrapPile(world, x, z);
  }
  spawnCamp(world, 26, 22, 1);
  // The player store: one singleton holding what the player OWNS across rebuilds — Wallet (banked
  // scrap) + Inventory (loose parts / assembled products). A small starting stake; the inventory starts
  // empty (every build sub-part is bought).
  const playerStore = world.createEntity();
  world.add(playerStore, Wallet, { scrap: 100 });
  world.add(playerStore, Inventory, { items: [] });
}
