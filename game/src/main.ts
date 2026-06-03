import { World } from './core/world';
import { spawnRig } from './content/rig';
import { engineParts } from './content/engines';
import { spawnWorkshop } from './content/workshop';
import { scatterScrap, spawnScrapPile } from './content/scrap';
import { Transform } from './components/transform';
import { DriveControl } from './components/drive-control';
import { Wallet } from './components/wallet';
import { Inventory } from './components/inventory';
import { Bench, emptyBenchSlots } from './components/bench';
import { ENGINE_RECIPE } from './content/recipes';
import { composeProduct, placeProductInWorld } from './systems/assembly';
import { mountPart } from './systems/mounting';
import { WorkshopZone } from './components/workshop-zone';
import { movementSystem } from './systems/movement';
import { mountingSystem } from './systems/mounting';
import { collisionSystem } from './systems/collision';
import { scrapCollectionSystem } from './systems/scrap-collection';
import { scrapPileSystem, scrapRummageSystem } from './systems/scrap-pile';
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
// Loose scrap scattered around the rig — drive over pieces to sweep them into mounted storage, bank
// them at the workshop, then spend the wallet total in the Parts Shop. The larger field makes the
// first spend loop worth playing: one starter container can bootstrap enough scrap for more storage.
scatterScrap(world, 64, 5, 34);

// The workshop — home base, a short drive up +Z from spawn. Park the rig in its proximity zone to
// open the workshop interface (build/assemble parts) and to drain full containers into the wallet.
spawnWorkshop(world, 0, 8);
// A rummageable scrap pile (Option C / PR4), off to one side of the field. It only lights up once
// the rig parks in reach with a MOUNTED RECLAIMER aimed at it (the capability + facing gate); then
// hold E to dig — the arm deploys, the heap slumps in waves, and loose scrap bursts out around the
// rig for the usual drive-over collection to sweep into storage.
spawnScrapPile(world, -10, 2);
// The Reclaimer is no longer a staged prop (Option C / PR3): it's now a real buildable, mountable,
// purchasable part. Buy the Arm + Bucket in the Parts Shop, assemble them on the bench (the
// Reclaimer recipe), stage the product on the workshop deck, then grab it off the deck and mount it
// on the rig like any part. (PR2's articulation runtime renders it with the bucket on its wrist.)
// The player store: one singleton entity holding what the player OWNS across rebuilds — `Wallet`
// (banked scrap) and `Inventory` (loose parts / assembled engines). Lives outside any rig/container
// so both survive rig rebuilds and chassis swaps. The workshop drain feeds the wallet; the HUD
// reads it; the workshop interface (P3+) browses the inventory.
const playerStore = world.createEntity();
// DEV/TEST SEED: temporarily inflated so the Reclaimer (arm 24 + bucket 12 = 36) can be bought and
// tested without grinding the loose-scrap field first. Revert to 5 before merge — the intended cold
// start is exactly enough for the first storage-container shell + rim.
world.add(playerStore, Wallet, { scrap: 60 });
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

// No loose-part dev grant: every build sub-part now comes from the Parts Shop. The rig still starts
// with a complete mounted electric engine so the player can drive immediately.
console.info('[starter] DEV SEED: wallet seeded with 60 scrap so the Reclaimer can be bought to test (revert to 5 before merge).');

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
  let work = false; // E held this frame (only while the sim runs) — the hold-to-work rummage intent
  if (paused) {
    ctl.throttle = 0;
    ctl.steer = 0;
  } else {
    const intent = input.poll();
    ctl.throttle = intent.throttle;
    ctl.steer = intent.steer;
    work = intent.work;
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

    // scrap piles: recompute each pile's capability+facing gate (after mounting has ridden the
    // Reclaimer to its cell, so its aim is current), then turn a held work key over an active pile
    // into the rummage — the arm digs and the heap bursts loose scrap around the rig.
    scrapPileSystem(world, player);
    scrapRummageSystem(world, player, work, dt);

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
    view.animateReclaimer(world, dt);
    view.animateScrapPile(world, dt);
  }
  view.render();

  // UI (reads state; owns no truth) — rig stat readout + the scrap wallet total.
  stats.update(world, player);
  walletHud.update(world);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
