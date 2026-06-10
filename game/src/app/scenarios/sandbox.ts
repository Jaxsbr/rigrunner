import { World } from '@core/world';
import { spawnRig } from '@features/mounting/rig';
import { engineParts } from '@features/engine/engines';
import { spawnWorkshop } from '@features/workshop/workshop';
import { scatterScrap, spawnScrapPile } from '@features/scrap/scrap';
import { Transform } from '@common/components/transform';
import { createPlayerStore } from '@features/economy/player-store';
import { addToInventory } from '@features/economy/inventory';
import { Bench, emptyBenchSlots } from '@features/workshop/bench';
import {
  ELECTRIC_ENGINE_RECIPE,
  STEAM_ENGINE_RECIPE,
  STORAGE_RECIPE,
  RECLAIMER_RECIPE,
  chassisRecipeForSize,
} from '@common/parts/recipes';
import { chassisParts } from '@features/chassis/chassis';
import { partDef } from '@common/parts/parts-catalog';
import { composeProduct } from '@common/sim/assembly';
import { placeProductInWorld } from '@features/workshop/assembly';
import { mountPart } from '@features/mounting/mounting';
import { stageProduct } from '@features/workshop/staging';
import { markOwned, setActiveRig } from '@features/chassis/ownership';
import { spawnCamp } from '@features/camps/camp-spawn';

/**
 * The **sandbox** scenario — the free-for-all test world, launched by `npm run dev:sandbox`. It owns
 * every grant-myself-anything affordance used while building a new world-interaction part: the full
 * engine matrix and spare Reclaimers staged on the workshop deck, a high-tier chassis kit in the
 * inventory, a wide scrap field, piles in every quadrant, and a camp in each corner. None of this
 * belongs in the game a player starts — keeping it here is exactly what lets the real cold-open
 * (`real-game.ts`) stop being vandalised to make the next part testable
 * (`real-world-and-progression-spec.md`, Phase 0).
 */
export function seedSandboxWorld(world: World): void {
  const player = spawnRig(world); // a scrap 1×3 chassis — a 3-cell deck (col 0, rows 0–2) that runs a single engine
  // The starter is the player's first owned chassis and the one they control at boot. Any chassis they
  // build and deploy in the world becomes another owned chassis (capped at MAX_OWNED); the chassis bar
  // + 1/2 keys switch which one input/camera/HUD/zones follow.
  markOwned(world, player);
  setActiveRig(world, player);
  // The rig starts with ONLY a pre-assembled ELECTRIC engine mounted — a bare, light starter for clean
  // drive/boost testing (electric's snappy/light profile is the friendlier default than the heavy
  // hauler). It's a normal composed engine — removable and dismantlable like any other — so the engine
  // swap loop is testable from the first session. The storage container and Reclaimer it used to carry
  // now sit staged on the workshop deck (below), so the rig can be loaded up when a test needs it.
  {
    const engine = composeProduct(world, ELECTRIC_ENGINE_RECIPE, engineParts('electric'));
    const rigT = world.get(player, Transform)!;
    placeProductInWorld(world, engine, rigT.x, rigT.z);
    mountPart(world, engine, player, 0, 1); // centre deck cell; the mounting system rides it into place
  }
  // Loose scrap scattered around the rig — drive over pieces to sweep them into mounted storage, bank
  // them at the workshop, then spend the wallet total in the Parts Shop. The larger field makes the
  // first spend loop worth playing: one starter container can bootstrap enough scrap for more storage.
  scatterScrap(world, 64, 5, 34);

  // The workshop — home base, a short drive up +Z from spawn. Park the rig in its proximity zone to
  // open the workshop interface (build/assemble parts) and to drain full containers into the wallet.
  const workshop = spawnWorkshop(world, 0, 8);
  // DEV/TEST SEED — stage everything a drive/boost test needs straight onto the workshop deck, so it's
  // grab-and-mount with no shop trip: the rest of the 2×2 engine MATRIX to swap through (the rig already
  // runs a rusty electric, so the other three sit here — rusty steam, iron electric, iron steam, front
  // row), plus the storage container and Reclaimer the rig no longer carries (back row — re-mount them
  // when a test needs hauling or rummaging). Each is a normal composed product on a 3×3 deck cell,
  // grabbed off the deck like any staged part.
  {
    stageProduct(world, composeProduct(world, STEAM_ENGINE_RECIPE, engineParts('steam')), workshop, 0, 0);            // rusty steam
    stageProduct(world, composeProduct(world, ELECTRIC_ENGINE_RECIPE, engineParts('electric'), 'iron'), workshop, 1, 0); // iron electric
    stageProduct(world, composeProduct(world, STEAM_ENGINE_RECIPE, engineParts('steam'), 'iron'), workshop, 2, 0);    // iron steam
    stageProduct(world, composeProduct(world, STORAGE_RECIPE, ['container-shell', 'container-rim'].map((id) => partDef(id)!)), workshop, 0, 2);   // storage container
    stageProduct(world, composeProduct(world, RECLAIMER_RECIPE, ['reclaimer-arm', 'reclaimer-bucket'].map((id) => partDef(id)!)), workshop, 2, 2); // Reclaimer (bucket — digs scrap)
    stageProduct(world, composeProduct(world, RECLAIMER_RECIPE, ['reclaimer-arm', 'stump-healer'].map((id) => partDef(id)!)), workshop, 1, 2);    // Reclaimer (stump-healer — grows stumps)
  }
  // Rummageable scrap piles (Option C / PR4–5) scattered around the field. A pile only lights up once
  // the rig parks in reach with a MOUNTED RECLAIMER aimed at it (the capability + facing gate); then
  // hold E to dig — the arm deploys, the heap slumps in waves, and loose scrap bursts out around the
  // rig for the usual drive-over collection to sweep into storage. When a pile empties it rolls the
  // loot table (PR5) — a 50% chance of 1–3 bonus sub-parts, revealed in the loot popup. Several piles
  // spread across the field so the loot roll is worth driving between and easy to exercise in testing.
  for (const [x, z] of [[-10, 2], [13, 6], [-15, -11], [9, -15], [17, -3], [-4, -16]] as const) {
    spawnScrapPile(world, x, z);
  }
  // A level-1 looter camp in each corner of the 80×80 map (inset to ±30 so the camp + its guard ring
  // sit clearly on the ground). Each is a deliberate drive-to out past the scrap field: by the time you
  // reach one you've gathered enough scrap to buy the weapon (the bootstrap rule — you can't loot your
  // way to the tool that lets you loot). Clear a camp's two guards to claim its cache; a too-weak rig is
  // taught to go back to the bay and build.
  for (const [cx, cz] of [[30, 30], [30, -30], [-30, 30], [-30, -30]] as const) {
    spawnCamp(world, cx, cz, 1);
  }
  // The player store (wallet + inventory). Starting scrap — a small stake so the player can buy a
  // few early parts from the Parts Shop without first grinding the loose-scrap field; the inventory
  // starts EMPTY (every build sub-part is bought). The workshop drain feeds the wallet; the HUD
  // reads it; the workshop interface browses the inventory.
  createPlayerStore(world, 100);

  // The assembly bench — a singleton (one workshop, one bench) on its own entity: the role slots the
  // workshop interface drops parts into while composing the active recipe's output. Starts on the
  // engine recipe, empty; the bench holds working state, the inventory holds owned-unplaced parts, and
  // a part is always in exactly one place.
  const bench = world.createEntity();
  world.add(bench, Bench, {
    recipeId: ELECTRIC_ENGINE_RECIPE.id,
    slots: emptyBenchSlots(ELECTRIC_ENGINE_RECIPE.slots.map((s) => s.slot)),
  });

  // TESTING SEED — an iron 1×3 chassis kit in the inventory so the high-tier chassis handling (tighter
  // turning, faster braking, higher top-speed ceiling) can be deployed without grinding the shop first.
  // The test ENGINES live staged on the workshop deck above.
  {
    const ironChassisKit = composeProduct(world, chassisRecipeForSize('1x3'), chassisParts('1x3'), 'iron');
    addToInventory(world, ironChassisKit);
  }
}
