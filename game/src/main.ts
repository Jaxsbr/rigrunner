import { World } from './core/world';
import { spawnRig } from './content/rig';
import { spawnEngine, ENGINE_MK1, ENGINE_MK2 } from './content/engines';
import { spawnContainer } from './content/containers';
import { scatterScrap } from './content/scrap';
import { Transform } from './components/transform';
import { DriveControl } from './components/drive-control';
import { movementSystem } from './systems/movement';
import { mountingSystem } from './systems/mounting';
import { collisionSystem } from './systems/collision';
import { scrapCollectionSystem } from './systems/scrap-collection';
import { createDriveInput } from './input/drive-input';
import { createCameraInput } from './input/camera-input';
import { createBuildController } from './build/build-controller';
import { RenderView } from './render/view';
import { StatsHud } from './ui/stats-hud';

/**
 * Composition root. The ONLY place that knows about all three layers at once: it wires
 * input → simulation → render together. Each layer stays ignorant of the others.
 */
const canvas = document.querySelector<HTMLCanvasElement>('#view')!;

const world = new World();
const player = spawnRig(world);
// Two loose engines beside the rig to test the build loop + engine attributes: the basic Mk1
// (slow/weak) and the stronger Mk2. Mount one to feel its tier, swap for the other to feel the
// difference, or mount both to feel the (diminishing-returns) combined output.
spawnEngine(world, ENGINE_MK1, 3, 1);
spawnEngine(world, ENGINE_MK2, 4.5, 1);
// Three empty storage containers beside the rig to build the cargo loop: mount one (or several),
// then drive over loose scrap to fill them. Each holds 4 scrap; fill spills to the next in cell
// order once one is full. With none mounted, scrap can't be collected — the build→run gate.
spawnContainer(world, -3, 1);
spawnContainer(world, -4.5, 1);
spawnContainer(world, -3, 2.5);
// Loose scrap scattered in a ring around the rig — drive over a piece to sweep it into storage.
scatterScrap(world, 10);

const input = createDriveInput();
const cameraInput = createCameraInput(canvas);
const view = new RenderView(canvas);
const build = createBuildController(world, view, canvas, player);
const stats = new StatsHud(document.querySelector<HTMLElement>('#stats')!);

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.05); // clamp to avoid jumps on refocus
  last = now;

  // input → intent → the player's control component (the seam)
  const intent = input.poll();
  const ctl = world.get(player, DriveControl)!;
  ctl.throttle = intent.throttle;
  ctl.steer = intent.steer;

  // simulation (the source of truth): drive the rigs, then ride mounted parts to their cells,
  // then let the build interaction move a carried part / settle drops.
  movementSystem(world, dt);
  mountingSystem(world);
  build.update(dt);

  // collision → collection: with parts now placed at their cells, find overlaps and let any scrap
  // the rig (or a part on it) touched be swept into storage. Pure pair list in, mutations out.
  scrapCollectionSystem(world, collisionSystem(world));

  // render (reads state; owns no truth)
  view.follow(world.get(player, Transform)!, cameraInput.poll(), dt);
  view.sync(world);
  view.animateWheels(world, dt);
  view.animateStorageFill(world, dt);
  view.render();

  // UI (reads state; owns no truth) — refreshes the rig stat readout when its capabilities change.
  stats.update(world, player);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
