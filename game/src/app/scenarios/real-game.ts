import { World } from '@core/world';
import { spawnRig } from '@features/mounting/rig';
import { engineParts } from '@features/engine/engines';
import { scatterScrap, scatterScrapAround, spawnScrapPile } from '@features/scrap/scrap';
import { Transform } from '@common/components/transform';
import { createPlayerStore } from '@features/economy/player-store';
import { ELECTRIC_ENGINE_RECIPE, STORAGE_RECIPE } from '@common/parts/recipes';
import { partDef } from '@common/parts/parts-catalog';
import { composeProduct } from '@common/sim/assembly';
import { placeProductInWorld } from '@features/workshop/assembly';
import { mountPart } from '@features/mounting/mounting';
import { markOwned, setActiveRig } from '@features/chassis/ownership';
import { spawnCamp } from '@features/camps/camp-spawn';
import { CollisionGrid, type CollisionMap } from '@features/terrain/collision-grid';
import { setWorldGrid } from '@features/terrain/world-grid';
import { seedStaticStructures } from './static-structures';
import realGameMap from './maps/real-game.map.json';

/** A drivable mouth in the bounding ridge: the camps guarding it line up off `angle`. */
interface ExitGap {
  /** Gap centre angle (radians; 0 = +x, increasing counter-clockwise — the mapping the camps use). */
  angle: number;
  /** The baked gap-mouth half-width (radians) — documents the opening the camps flank; a tight ~9 m choke. */
  halfWidth: number;
}

// The exit gaps cut into the bounding mountain ridge — the only drivable mouths out of the safe bowl. The
// camps below guard them, lining up off these angles. These are the gaps' WORLD-SPACE centre angles,
// measured from the baked collision footprint — NOT the authoring angles in `mountain_range.py`: the
// GLB's `export_yup` negates the Blender angle (world ≈ 2π − authored), so a gap authored at 2.3 rad
// surfaces in-world at ≈3.98. Angle convention: 0 = +x, counter-clockwise.
export const EXIT_GAPS: ExitGap[] = [
  { angle: 0, halfWidth: 0.075 },     // east — the main exit, guarded by a pair of camps at its mouth
  { angle: 2.083, halfWidth: 0.075 }, // single-guarded
  { angle: 3.983, halfWidth: 0.075 }, // the lightly-held escape (unguarded for now)
];

/** A point at (`angle`, `radius`) in world space — to line camps up with the gap mouth they guard. */
function at(angle: number, radius: number): readonly [number, number] {
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
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
  // The map-free structures (workshop, world shop, mountain mesh, bench) — shared with the editor.
  seedStaticStructures(world);

  // The static collision grid — the committed map authored in the editor (`app/editor`). It walls the rig
  // and the camp guards alike off the painted ridge. Static scenery (deterministic), so New Game and
  // Continue raise the same wall; it is NOT part of the save. The game loads it from the bundled map; the
  // editor reads/writes the same file fresh over the dev endpoint (so it never sees a stale copy).
  setWorldGrid(world, CollisionGrid.fromMap(realGameMap as CollisionMap));
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
  // threat is concentrated at the mouths). A PAIR flanks the east gap close together (a level-1 and a
  // tougher level-2, ~7 m apart — a contested choke you must clear to slip out); a single level-1 holds
  // the north-west gap. All sit just inside the ridge, right in the gap corridor (`GUARD_R`), so the
  // player meets them exactly where they'd leave.
  const GUARD_R = 74;
  spawnCamp(world, ...at(EXIT_GAPS[0]!.angle - 0.05, GUARD_R), 1); // east gap — left of the mouth
  spawnCamp(world, ...at(EXIT_GAPS[0]!.angle + 0.05, GUARD_R), 2); // east gap — right of the mouth (tougher)
  spawnCamp(world, ...at(EXIT_GAPS[1]!.angle, GUARD_R), 1);        // north-west gap

  // The player store (wallet + inventory): starts BROKE, so collecting loose scrap is a required first
  // step (rung 0) before the Reclaimer is affordable — the opening can't be skipped. Inventory empty.
  createPlayerStore(world, 0);
}
