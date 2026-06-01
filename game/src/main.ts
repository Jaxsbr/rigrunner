import { World } from './core/world';
import { spawnRig } from './content/rig';
import { engineParts } from './content/engines';
import { spawnWorkshop } from './content/workshop';
import { scatterScrap } from './content/scrap';
import { Transform } from './components/transform';
import { DriveControl } from './components/drive-control';
import { Wallet } from './components/wallet';
import { Inventory, addToInventory, inventoryItems } from './components/inventory';
import { Bench, emptyBenchSlots } from './components/bench';
import { ENGINE_RECIPE } from './content/recipes';
import { composeProduct, placeProductInWorld } from './systems/assembly';
import { mountPart } from './systems/mounting';
import { WorkshopZone } from './components/workshop-zone';
import { PARTS_CATALOG, spawnEnginePart } from './content/parts-catalog';
import { movementSystem } from './systems/movement';
import { mountingSystem } from './systems/mounting';
import { collisionSystem } from './systems/collision';
import { scrapCollectionSystem } from './systems/scrap-collection';
import { workshopZoneSystem } from './systems/workshop-zone';
import { workshopDrainSystem } from './systems/workshop-drain';
import { createDriveInput } from './input/drive-input';
import { createCameraInput } from './input/camera-input';
import { createBuildController } from './build/build-controller';
import { RenderView } from './render/view';
import { StatsHud } from './ui/stats-hud';
import { WalletHud } from './ui/wallet-hud';
import { WorkshopOverlay } from './ui/workshop-overlay';

/**
 * Composition root. The ONLY place that knows about all three layers at once: it wires
 * input → simulation → render together. Each layer stays ignorant of the others.
 */
const canvas = document.querySelector<HTMLCanvasElement>('#view')!;

const world = new World();
const player = spawnRig(world);
// The rig starts with a basic pre-assembled ELECTRIC engine already mounted — a gentle cold start
// (the player can drive immediately, and electric's snappy/light profile is the friendlier default
// than the heavy hauler). It's a normal composed engine — removable and dismantlable like any other
// — so the type-lock and swap loop are testable from the first session. There are no longer any
// loose engines or containers scattered in the world: everything is built in the workshop and moved
// out (the player owns the parts to build a container — see the dev grant below).
{
  const engine = composeProduct(world, ENGINE_RECIPE, engineParts('electric'));
  const rigT = world.get(player, Transform)!;
  placeProductInWorld(world, engine, rigT.x, rigT.z);
  mountPart(world, engine, player, 0, 1); // a deck cell; the mounting system rides it into place
}
// Loose scrap scattered in a ring around the rig — drive over a piece to sweep it into storage
// (once the player has built and mounted a container).
scatterScrap(world, 10);

// The workshop — home base, a short drive up +Z from spawn. Park the rig in its proximity zone to
// open the workshop interface (build/assemble parts) and to drain full containers into the wallet.
spawnWorkshop(world, 0, 8);
// The player store: one singleton entity holding what the player OWNS across rebuilds — `Wallet`
// (banked scrap) and `Inventory` (loose parts / assembled engines). Lives outside any rig/container
// so both survive rig rebuilds and chassis swaps. The workshop drain feeds the wallet; the HUD
// reads it; the workshop interface (P3+) browses the inventory.
const playerStore = world.createEntity();
world.add(playerStore, Wallet, { scrap: 0 });
world.add(playerStore, Inventory, { items: [] });

// The assembly bench — a singleton (one workshop, one bench) on its own entity: the role slots the
// workshop interface drops parts into while composing the active recipe's output. Starts on the
// engine recipe, empty; the bench holds working state, the inventory holds owned-unplaced parts, and
// a part is always in exactly one place.
const bench = world.createEntity();
world.add(bench, Bench, {
  recipeId: ENGINE_RECIPE.id,
  slots: emptyBenchSlots(ENGINE_RECIPE.slots.map((s) => s.slot)),
});

// DEV GRANT — stand-in for the real production chain (deferred: the smelter/caster fixtures that
// will MAKE parts). Seed the FULL catalog: the two container parts (shell + rim) to build a storage
// container and start the cargo loop, AND both engine part sets (4 electric + 4 mechanical). The rig
// already ships with an electric engine, but the engine sub-parts are back now (P5 had trimmed them
// to just the container) so P6's type-lock is testable: build a MECHANICAL engine to confirm the
// cross-type mount is refused, and a second ELECTRIC engine to confirm same-type mounting is allowed.
// Remove this grant once parts are produced in-game.
for (const def of PARTS_CATALOG) {
  addToInventory(world, spawnEnginePart(world, def));
}
console.info(
  `[dev grant] inventory seeded with ${inventoryItems(world).length} parts ` +
    `(container shell + rim, plus the 8 engine sub-parts) — stand-in for the real production chain (deferred).`,
);

const input = createDriveInput();
const cameraInput = createCameraInput(canvas);
const view = new RenderView(canvas);
const build = createBuildController(world, view, canvas, player);
const stats = new StatsHud(document.querySelector<HTMLElement>('#stats')!);
const walletHud = new WalletHud(document.querySelector<HTMLElement>('#wallet')!);

// The workshop interface shell. Opening its tab freezes the simulation; main owns the `paused`
// flag and the overlay flips it through the callback. The tab's visibility tracks zone proximity,
// which main pushes in each frame (the overlay never touches the World).
let paused = false;
const overlay = new WorkshopOverlay(
  document.querySelector<HTMLButtonElement>('#workshop-tab')!,
  document.querySelector<HTMLElement>('#workshop-overlay')!,
  world,
  {
    onPauseChange: (p) => { paused = p; },
    // Inventory → world bridge (a temporary stand-in until the workshop-staging-grid flow replaces
    // it): drop the chosen product onto the ground just off the rig's side, where the player can
    // grab it with the build interaction and mount it. Local→world by the rig's heading so it lands
    // beside the rig whichever way it's parked. The overlay stays open; closing it reveals the part.
    onMoveToWorld: (entity) => {
      const rigT = world.get(player, Transform)!;
      const c = Math.cos(rigT.rotationY);
      const s = Math.sin(rigT.rotationY);
      const lx = 2.2; // just off the right edge of the 2-wide deck
      placeProductInWorld(world, entity, rigT.x + lx * c, rigT.z - lx * s);
    },
  },
);

/** True while the rig is parked in any workshop zone — drives the tab's visibility. */
function anyZoneActive(): boolean {
  for (const w of world.query(WorkshopZone)) {
    if (world.get(w, WorkshopZone)!.active) return true;
  }
  return false;
}

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.05); // clamp to avoid jumps on refocus
  last = now;

  // input → intent → the player's control component (the seam). While the workshop overlay is open
  // the sim is frozen: drive input is ignored and the control is zeroed, so no held-then-released
  // key survives the pause to lurch the rig on resume.
  const ctl = world.get(player, DriveControl)!;
  if (paused) {
    ctl.throttle = 0;
    ctl.steer = 0;
  } else {
    const intent = input.poll();
    ctl.throttle = intent.throttle;
    ctl.steer = intent.steer;
  }

  // simulation (the source of truth): drive the rigs, then ride mounted parts to their cells,
  // then let the build interaction move a carried part / settle drops. The whole block is gated by
  // `paused` — opening the overlay freezes movement, mounting-ride, the proximity gate, the build
  // interaction, collection and drain together; the scene keeps rendering frozen below.
  if (!paused) {
    movementSystem(world, dt);
    mountingSystem(world);
    // recompute each workshop's proximity gate (rig in range?) before the build interaction reads
    // it, so a part dropped this frame snaps onto the workshop only when it's lit.
    workshopZoneSystem(world, player);
    build.update(dt);

    // collision → collection: with parts now placed at their cells, find overlaps and let any
    // scrap the rig (or a part on it) touched be swept into storage. Pure pair list in, mutations
    // out.
    scrapCollectionSystem(world, collisionSystem(world));

    // workshop drain: bank scrap out of containers parked on a workshop into the player's wallet.
    workshopDrainSystem(world, dt);
  }

  // the tab tracks zone proximity each frame (the overlay hides it while open, so reading the
  // frozen zone state while paused is harmless).
  overlay.setZoneActive(anyZoneActive());

  // render (reads state; owns no truth) — always runs so the frozen scene stays drawn. The
  // sim-driven animators (wheel spin, storage fill) are skipped while paused: the rig coasts, so
  // its Velocity survives the freeze and the wheels would otherwise keep spinning.
  view.follow(world.get(player, Transform)!, cameraInput.poll(), dt);
  view.sync(world);
  view.syncWorkshopZones(world);
  if (!paused) {
    view.animateWheels(world, dt);
    view.animateStorageFill(world, dt);
  }
  view.render();

  // UI (reads state; owns no truth) — rig stat readout + the scrap wallet total.
  stats.update(world, player);
  walletHud.update(world);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
