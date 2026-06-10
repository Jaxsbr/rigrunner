import { World } from '@core/world';
import type { Scenario } from '../scenario';
import { type GameState, SAVE_VERSION } from '../persistence';
import { spawnRig } from '@features/mounting/rig';
import { engineParts } from '@features/engine/engines';
import { spawnWorkshop } from '@features/workshop/workshop';
import { scatterScrap, spawnScrapPile } from '@features/scrap/scrap';
import { Transform } from '@common/components/transform';
import { Wallet, getWallet } from '@features/economy/wallet';
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
 * The **real game** scenario — the world a player actually plays, launched by `npm run dev:game`. It
 * seeds a clean, dev-grant-free cold-open: a playable starter rig, the workshop, a modest scrap field,
 * a few piles, and one reachable camp — the spine's first rungs and nothing the sandbox grants for
 * free. Unlike the sandbox it is **save-aware**: `hydrate` rebuilds the cold-open and lays the saved
 * state over it (the Continue path), and `captureState` reads the world back out to a `GameState`.
 *
 * This opening is **provisional** — Phase 1 of `real-world-and-progression-spec.md` is where the
 * designed cold-open gets crafted in earnest (one legible first action, a tuned layout). What matters
 * now is that the real game stands on its own without any of the sandbox's testing scaffolding.
 */
export const realGameScenario: Scenario = {
  seed(world: World): void {
    seedColdOpen(world);
  },
};

function seedColdOpen(world: World): void {
  const player = spawnRig(world); // a scrap 1×3 chassis — a 3-cell deck (col 0, rows 0–2)
  markOwned(world, player);
  setActiveRig(world, player);
  const rigT = world.get(player, Transform)!;
  // The starter carries a mounted electric engine AND a storage container — a clean, immediately
  // playable rig (NOT the sandbox's grant-everything deck). Storage is mounted from the start so the
  // first action reads plainly: drive over loose scrap to sweep it in. The Reclaimer that works piles
  // is deliberately NOT given — buying it is the spine's first earned rung.
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
  // A modest loose-scrap field and the workshop home base a short drive up +Z from spawn.
  scatterScrap(world, 48, 5, 26);
  spawnWorkshop(world, 0, 8);
  // A few rummageable piles and one reachable level-1 camp — legibly few, so the opening teaches the
  // spine (sweep scrap → buy a Reclaimer → work a pile → buy a weapon → clear the camp) without the
  // sandbox's full quadrant spread.
  for (const [x, z] of [[-10, 2], [12, -4], [6, -14]] as const) {
    spawnScrapPile(world, x, z);
  }
  spawnCamp(world, 26, 22, 1);
  // The player store (wallet + inventory) and the assembly bench — the same singletons the sandbox
  // seeds. The wallet starts with a small stake and is the slice persistence round-trips today.
  const playerStore = world.createEntity();
  world.add(playerStore, Wallet, { scrap: 100 });
  world.add(playerStore, Inventory, { items: [] });
  const bench = world.createEntity();
  world.add(bench, Bench, {
    recipeId: ELECTRIC_ENGINE_RECIPE.id,
    slots: emptyBenchSlots(ELECTRIC_ENGINE_RECIPE.slots.map((s) => s.slot)),
  });
}

/**
 * The Continue path: build the cold-open, then lay the saved state over it. Re-seeding first means the
 * save only has to carry what *changed* (the wallet today) rather than the entire world — the fixed
 * opening is regenerated, the deltas are applied on top.
 */
export function hydrate(world: World, state: GameState): void {
  seedColdOpen(world);
  applyState(world, state);
}

function applyState(world: World, state: GameState): void {
  const wallet = getWallet(world);
  if (wallet) wallet.scrap = state.wallet.scrap;
}

/** Read the live world back out to a serializable `GameState` for the save slot. */
export function captureState(world: World): GameState {
  return {
    version: SAVE_VERSION,
    wallet: { scrap: getWallet(world)?.scrap ?? 0 },
  };
}
