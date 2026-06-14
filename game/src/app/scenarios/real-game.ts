import { World } from '@core/world';
import { spawnRig } from '@features/mounting/rig';
import { engineParts } from '@features/engine/engines';
import { scatterScrap, scatterScrapAround } from '@features/scrap/scrap';
import { Transform } from '@common/components/transform';
import { createPlayerStore } from '@features/economy/player-store';
import { ELECTRIC_ENGINE_RECIPE, STORAGE_RECIPE } from '@common/parts/recipes';
import { partDef } from '@common/parts/parts-catalog';
import { composeProduct } from '@common/sim/assembly';
import { placeProductInWorld } from '@features/workshop/assembly';
import { mountPart } from '@features/mounting/mounting';
import { markOwned, setActiveRig } from '@features/chassis/ownership';
import { CollisionGrid } from '@features/terrain/collision-grid';
import { setWorldGrid } from '@features/terrain/world-grid';
import { spawnPlacements } from '../world-map/spawn-placements';
import type { WorldMap } from '../world-map/placement';
import { seedStaticStructures } from './static-structures';
import realGameMap from './maps/real-game.map.json';

/** A drivable mouth in the bounding ridge — the gaps the camps in the map guard. */
interface ExitGap {
  /** Gap centre angle (radians; 0 = +x, increasing counter-clockwise — the mapping the camps use). */
  angle: number;
  /** The baked gap-mouth half-width (radians) — documents the opening the camps flank; a tight ~9 m choke. */
  halfWidth: number;
}

// The exit gaps cut into the bounding mountain ridge — the only drivable mouths out of the safe bowl. The
// camp placements in the map line up off these angles. These are the gaps' WORLD-SPACE centre angles,
// measured from the baked collision footprint — NOT the authoring angles in `mountain_range.py`: the
// GLB's `export_yup` negates the Blender angle (world ≈ 2π − authored), so a gap authored at 2.3 rad
// surfaces in-world at ≈3.98. Angle convention: 0 = +x, counter-clockwise. `real-game-map.test.ts` pins
// the painted grid AND the camp placements to these angles, so the two can't drift apart.
export const EXIT_GAPS: ExitGap[] = [
  { angle: 0, halfWidth: 0.075 },     // east — the main exit, guarded by a pair of camps at its mouth
  { angle: 2.083, halfWidth: 0.075 }, // single-guarded
  { angle: 3.983, halfWidth: 0.075 }, // the lightly-held escape (unguarded for now)
];

/** The committed map's authored layout — the structures/props/camps/piles that used to be hard-coded here. */
const MAP = realGameMap as WorldMap;
const PLACEMENTS = MAP.placements ?? [];

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
  // The map-free singletons (mountain mesh + bench) — shared with the editor.
  seedStaticStructures(world);

  // The static collision grid — the committed map authored in the editor (`app/editor`). It walls the rig
  // and the camp guards alike off the painted ridge. Static scenery (deterministic), so New Game and
  // Continue raise the same wall; it is NOT part of the save. The game loads it from the bundled map; the
  // editor reads/writes the same file fresh over the dev endpoint (so it never sees a stale copy).
  setWorldGrid(world, CollisionGrid.fromMap(MAP));

  // The authored fixed structures (the workshop, the world shop, decoration props) — seeded on New Game
  // AND Continue, exactly like the singletons above, and equally not part of the save.
  spawnPlacements(world, PLACEMENTS, 'static');
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

  // The authored starting progress: the scrap PILES (one on the spawn → shop path, its LOCKED "Needs
  // Reclaimer" cue planting the question the shop answers; the rest scattered to work once the Reclaimer
  // is bought) and the CAMPS guarding the exit gaps (a pair flanking the east mouth, one holding the
  // north-west gap). These used to be hard-coded coordinates here; they now live in the map's placements,
  // authored in the editor — seeded on New Game only, then saved/restored by the snapshot like all progress.
  spawnPlacements(world, PLACEMENTS, 'progress');

  // The player store (wallet + inventory): starts BROKE, so collecting loose scrap is a required first
  // step (rung 0) before the Reclaimer is affordable — the opening can't be skipped. Inventory empty.
  createPlayerStore(world, 0);
}
