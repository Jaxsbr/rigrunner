import { World } from './core/world';
import { spawnRig } from './content/rig';
import { spawnEngine, ENGINE_MK1, ENGINE_MK2 } from './content/engines';
import { spawnContainer } from './content/containers';
import { spawnWorkshop } from './content/workshop';
import { scatterScrap } from './content/scrap';
import { Transform } from './components/transform';
import { DriveControl } from './components/drive-control';
import { Wallet } from './components/wallet';
import { Inventory, addToInventory, inventoryItems } from './components/inventory';
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

// The workshop — home base, a short drive up +Z from spawn, clear of the side-staged parts. Park
// the rig in its proximity zone to move containers onto its 3×3 deck and drain them into the wallet.
spawnWorkshop(world, 0, 8);
// The player store: one singleton entity holding what the player OWNS across rebuilds — `Wallet`
// (banked scrap) and `Inventory` (loose parts / assembled engines). Lives outside any rig/container
// so both survive rig rebuilds and chassis swaps. The workshop drain feeds the wallet; the HUD
// reads it; the workshop interface (P3+) browses the inventory.
const playerStore = world.createEntity();
world.add(playerStore, Wallet, { scrap: 0 });
world.add(playerStore, Inventory, { items: [] });

// DEV GRANT — stand-in for the real production chain (deferred: the smelter/caster fixtures that
// will MAKE parts). Seed the player's inventory with the full 8-part catalog so the workshop can be
// exercised end to end before any production exists. Remove once parts are produced in-game.
for (const def of PARTS_CATALOG) {
  addToInventory(world, spawnEnginePart(world, def));
}
{
  const granted = inventoryItems(world);
  const electric = PARTS_CATALOG.filter((p) => p.type === 'electric').length;
  const mechanical = PARTS_CATALOG.filter((p) => p.type === 'mechanical').length;
  console.info(
    `[dev grant] inventory seeded with ${granted.length} engine parts ` +
      `(${electric} electric, ${mechanical} mechanical) — stand-in for the real production chain (deferred).`,
  );
}

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
  { onPauseChange: (p) => { paused = p; } },
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
