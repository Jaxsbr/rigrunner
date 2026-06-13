import { World } from '@core/world';
import { spawnRig } from '@features/mounting/rig';
import { engineParts } from '@features/engine/engines';
import { spawnWorkshop } from '@features/workshop/workshop';
import { scatterScrap, scatterScrapAround, spawnScrapPile } from '@features/scrap/scrap';
import { Transform } from '@common/components/transform';
import { createPlayerStore } from '@features/economy/player-store';
import { Bench, emptyBenchSlots } from '@features/workshop/bench';
import { ELECTRIC_ENGINE_RECIPE, STORAGE_RECIPE } from '@common/parts/recipes';
import { partDef } from '@common/parts/parts-catalog';
import { composeProduct } from '@common/sim/assembly';
import { placeProductInWorld } from '@features/workshop/assembly';
import { mountPart } from '@features/mounting/mounting';
import { markOwned, setActiveRig } from '@features/chassis/ownership';
import { spawnCamp } from '@features/camps/camp-spawn';
import { spawnWorldShop } from '@features/shop/world-shop-spawn';
import { spawnMountainRing, type MountainGap } from '@features/terrain/mountain-ring';

// The exit gaps cut into the bounding mountain ring — the only drivable mouths out of the safe bowl.
// Shared by the ring (which leaves them open) and the camps below (which guard them), so a gap and its
// guards line up. Angle convention: 0 = +x, increasing counter-clockwise. Two are guarded in + outside
// to make leaving costly; the third (south-west) is the lightly-held escape.
const EXIT_GAPS: MountainGap[] = [
  { angle: 0, halfWidth: 0.22 },   // east — the main exit, double-guarded (a camp inside AND outside)
  { angle: 2.3, halfWidth: 0.22 }, // north-west — single-guarded
  { angle: 4.2, halfWidth: 0.22 }, // south-west — the lightly-held escape (unguarded for now)
];

/** A point at `radius` along an exit gap's angle — to line a camp up with the mouth it guards. */
function onGap(gapIndex: number, radius: number): readonly [number, number] {
  const a = EXIT_GAPS[gapIndex]!.angle;
  return [Math.cos(a) * radius, Math.sin(a) * radius];
}

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
 * `seedRealGameWorld` (a brand-new game) is the two together. This is Phase 1's designed cold-open
 * (`real-world-and-progression-spec.md`): a safe bowl walled by a ring of mountains, the home hub near
 * its centre, a shop out at the rim, and the danger (camps) guarding the exits. Coordinates are tuned by
 * play — the shape is what's fixed.
 */
export function seedRealGameWorld(world: World): void {
  seedStaticWorld(world);
  seedNewGameContent(world);
}

/** The fixed, non-progress scaffolding both New Game and Continue lay down first. */
export function seedStaticWorld(world: World): void {
  // The workshop — home base, a short drive up +Z from spawn, near the centre of the bowl. Park the rig
  // in its proximity zone to open the workshop interface (build/assemble parts) and drain full
  // containers into the wallet. Buying is NOT here — that's the world shop, out at the rim.
  spawnWorkshop(world, 0, 8);

  // The one (rusty) world shop — out toward the bowl's southern rim, a real drive from home but still
  // inside the safe zone (the danger is far past it, at the wall). Reaching it is the cold-open's first
  // expedition; its Reclaimer entry answers the "Needs Reclaimer" the on-path pile planted. Shops are
  // placed strategically (one for now); buying lives in the world, not a workshop tab.
  spawnWorldShop(world, 36, -37);

  // The bounding mountain ring — the bowl wall. The worked floor sits inside a circle of solid peaks
  // that physically block the way out, save the three EXIT_GAPS. The danger beyond (camps at the gaps)
  // is what makes leaving cost; the wall just draws the edge and funnels you to the mouths. Static
  // scenery (placed deterministically), so New Game and Continue raise the same ring.
  spawnMountainRing(world, { gaps: EXIT_GAPS });

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
  // Loose scrap — the New-Game starter field (not re-laid on Continue, so a reload can't farm it). A
  // DENSE ring hugs the spawn so the very first movement sweeps a piece in (rung 0 self-teaches: "I
  // collect by driving"), with a sparser scatter across the bowl beyond. Pieces are chunky + randomised
  // (2–6 each), so a handful funds the first Reclaimer.
  scatterScrapAround(world, rigT.x, rigT.z, 12, 4, 13); // the dense home ring
  scatterScrap(world, 12, 16, 48);                      // the sparser field across the bowl

  // Scrap piles. ONE sits on the path from spawn toward the shop — you pass it before you own a tool, so
  // its LOCKED "Needs Reclaimer" cue plants the question the shop then answers. The rest are scattered to
  // work once you've bought the Reclaimer. (No Reclaimer is given — buying it is the spine's first rung.)
  spawnScrapPile(world, 12, -12); // on the spawn → shop path: the LOCKED teacher
  for (const [x, z] of [[-26, 14], [22, 26], [-16, -32]] as const) {
    spawnScrapPile(world, x, z);
  }

  // Camps guard the exit gaps — the danger that makes leaving the bowl hard (no roaming enemies; the
  // threat is concentrated at the mouths). The east gap is double-guarded (a level-1 camp just inside,
  // a tougher level-2 just outside the wall); the north-west gap has a single level-1 camp. Each lines
  // up with its gap (`onGap`) so the player meets guards exactly where they'd slip out.
  spawnCamp(world, ...onGap(0, 96), 1);   // inside the east gap
  spawnCamp(world, ...onGap(0, 124), 2);  // outside the east gap — the frontier step up
  spawnCamp(world, ...onGap(1, 96), 1);   // inside the north-west gap

  // The player store (wallet + inventory): starts BROKE, so collecting loose scrap is a required first
  // step (rung 0) before the Reclaimer is affordable — the opening can't be skipped. Inventory empty.
  createPlayerStore(world, 0);
}
