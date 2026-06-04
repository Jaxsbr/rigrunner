import { World } from '@core/world';
import { spawnRig } from '@features/mounting/rig';
import { engineParts } from '@features/engine/engines';
import { spawnWorkshop } from '@features/workshop/workshop';
import { scatterScrap, spawnScrapPile } from '@features/scrap/scrap';
import { Transform } from '@common/components/transform';
import { DriveControl } from '@features/drive/drive-control';
import { Wallet } from '@features/economy/wallet';
import { Inventory, addToInventory } from '@features/economy/inventory';
import { Bench, emptyBenchSlots } from '@features/workshop/bench';
import { ENGINE_RECIPE, STORAGE_RECIPE, RECLAIMER_RECIPE } from '@common/parts/recipes';
import { partDef } from '@common/parts/parts-catalog';
import { composeProduct } from '@common/sim/assembly';
import { placeProductInWorld } from '@features/workshop/assembly';
import { mountPart, resolveLocalYaw, mountingSystem } from '@features/mounting/mounting';
import { MountGrid } from '@common/components/mount-grid';
import { MountFacing } from '@common/components/mount-facing';
import { WorkshopZone } from '@features/workshop/workshop-zone';
import { movementSystem } from '@features/drive/movement';
import { collisionSystem } from '@features/scrap/collision';
import { scrapCollectionSystem } from '@features/scrap/scrap-collection';
import { scrapPileSystem, scrapRummageSystem } from '@features/scrap/scrap-pile-system';
import { workshopZoneSystem } from '@features/workshop/workshop-zone-system';
import { workshopDrainSystem } from '@features/workshop/workshop-drain-system';
import { createDriveInput } from '@common/input/drive-input';
import { createCameraInput } from '@common/input/camera-input';
import { createBuildController } from '@features/mounting/build-controller';
import { activeStagingTargets } from '@features/workshop/staging';
import { RenderView } from '@common/render/view';
import { ZoneOverlays } from '@common/render/zone-overlays';
import { InteractionHints } from '@common/render/interaction-hints';
import { ScrapStains } from '@features/scrap/scrap-stains';
import { workshopZoneDiscs, workshopHints } from '@features/workshop/overlays';
import { scrapPileDiscs, scrapPileHints } from '@features/scrap/overlays';
import { animateWheels } from '@features/drive/wheel-spin';
import { animateStorageFill } from '@features/storage/storage-fill';
import { animateReclaimer } from '@features/scrap/reclaimer-animator';
import { animateScrapPile } from '@features/scrap/scrap-pile-animator';
import { StatsHud } from '@features/hud/stats-hud';
import { WalletHud } from '@features/economy/wallet-hud';
import { WorkshopOverlay } from '@features/workshop/workshop-overlay';
import { LootOverlay } from '@features/scrap/loot-overlay';

/**
 * Composition root. The ONLY place that knows about all three tiers and every feature at once: it
 * wires input → simulation → render together (ADR-003). Each tier/feature stays ignorant of the
 * others; the feature render (sim-driven animators + proximity overlays/hints/stains) is dispatched
 * from HERE against the `scene` / `entityViews` the view façade exposes, so the shared render tier
 * never imports a feature.
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
// DEV/TEST SEED: the rig also starts with a storage container and a Reclaimer already mounted, so a
// test session can drive, rummage piles, and sweep scrap immediately — without rebuilding these two
// every run. They're normal composed products (removable/dismantlable like any part), just pre-fitted.
// Cells: engine is at (col 0, row 1); storage takes (col 1, row 1), the Reclaimer (col 1, row 0).
{
  const rigT = world.get(player, Transform)!;
  const grid = world.get(player, MountGrid)!;

  // Storage container (shell + rim) — non-directional, mounts deck-aligned.
  const storage = composeProduct(world, STORAGE_RECIPE, ['container-shell', 'container-rim'].map((id) => partDef(id)!));
  placeProductInWorld(world, storage, rigT.x, rigT.z);
  mountPart(world, storage, player, 1, 1);

  // Reclaimer (arm + bucket) — directional: placeProductInWorld gives it an outward MountFacing, so
  // resolve the matching local yaw for its cell and the arm rests pointing off the deck, ready to dig.
  const reclaimer = composeProduct(world, RECLAIMER_RECIPE, ['reclaimer-arm', 'reclaimer-bucket'].map((id) => partDef(id)!));
  placeProductInWorld(world, reclaimer, rigT.x, rigT.z);
  const reclaimerYaw = resolveLocalYaw(world.get(reclaimer, MountFacing), grid, 1, 0, 0, 0);
  mountPart(world, reclaimer, player, 1, 0, reclaimerYaw);
}
// Loose scrap scattered around the rig — drive over pieces to sweep them into mounted storage, bank
// them at the workshop, then spend the wallet total in the Parts Shop. The larger field makes the
// first spend loop worth playing: one starter container can bootstrap enough scrap for more storage.
scatterScrap(world, 64, 5, 34);

// The workshop — home base, a short drive up +Z from spawn. Park the rig in its proximity zone to
// open the workshop interface (build/assemble parts) and to drain full containers into the wallet.
spawnWorkshop(world, 0, 8);
// Rummageable scrap piles (Option C / PR4–5) scattered around the field. A pile only lights up once
// the rig parks in reach with a MOUNTED RECLAIMER aimed at it (the capability + facing gate); then
// hold E to dig — the arm deploys, the heap slumps in waves, and loose scrap bursts out around the
// rig for the usual drive-over collection to sweep into storage. When a pile empties it rolls the
// loot table (PR5) — a 50% chance of 1–3 bonus sub-parts, revealed in the loot popup. Several piles
// spread across the field so the loot roll is worth driving between and easy to exercise in testing.
for (const [x, z] of [[-10, 2], [13, 6], [-15, -11], [9, -15], [17, -3], [-4, -16]] as const) {
  spawnScrapPile(world, x, z);
}
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

// DEV/TEST SEED (remove before merge): stock the inventory so the drivetrain rebalance (milestone MD)
// can be felt without grinding or buying — 6 electric + 6 mechanical engines to mount 1..6 of either
// type and watch top speed / acceleration scale linearly, plus 4 storage containers to swap in. These
// are normal composed products (unplaced, browsable in the workshop), exactly what the bench / Parts
// Shop grant. Note: the deck is 2×3 (6 cells), so free the pre-mounted storage + Reclaimer cells to fit six.
for (let i = 0; i < 6; i++) {
  addToInventory(world, composeProduct(world, ENGINE_RECIPE, engineParts('electric')));
  addToInventory(world, composeProduct(world, ENGINE_RECIPE, engineParts('mechanical')));
}
for (let i = 0; i < 4; i++) {
  const container = composeProduct(world, STORAGE_RECIPE, ['container-shell', 'container-rim'].map((id) => partDef(id)!));
  addToInventory(world, container);
}
console.info('[starter] DEV SEED: inventory stocked with 6 electric + 6 mechanical engines and 4 storage containers (remove before merge).');

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
// The build controller is given the workshop's active staging decks (rather than importing the
// workshop's WorkshopZone itself) so mounting never imports workshop — the edge points downhill
// (workshop → mounting), keeping the cross-feature DAG acyclic (ADR-003).
const build = createBuildController(world, view, canvas, player, () => activeStagingTargets(world));
const stats = new StatsHud(document.querySelector<HTMLElement>('#stats')!);
const walletHud = new WalletHud(document.querySelector<HTMLElement>('#wallet')!);

// Feature render dispatched from the composition root (ADR-003 §4): the proximity discs, the "Press
// E"/"Hold E" hints, and the seepage stains are constructed against the view's scene here, so the
// shared render tier (`@common/render/view`) imports no feature. The sim-driven animators are plain
// functions called below against `view.entityViews`.
const zones = new ZoneOverlays(view.scene);
const hints = new InteractionHints(view.scene);
const stains = new ScrapStains(view.scene);

// Two overlays can each freeze the simulation: the workshop interface and the loot popup. Main owns
// one `paused` flag that is the OR of both, so whichever is up holds the sim still and resuming needs
// both down. Each overlay flips its own bit through its callback.
let paused = false;
let workshopPaused = false;
let lootPaused = false;
const syncPaused = (): void => { paused = workshopPaused || lootPaused; };

// The workshop interface shell. Opening its tab freezes the simulation; the tab's visibility tracks
// zone proximity, which main pushes in each frame (the overlay never touches the World).
const overlay = new WorkshopOverlay(
  document.querySelector<HTMLButtonElement>('#workshop-tab')!,
  document.querySelector<HTMLElement>('#workshop-overlay')!,
  world,
  {
    onPauseChange: (p) => { workshopPaused = p; syncPaused(); },
  },
);

// The loot popup. It opens itself the frame a rummaged-empty pile queues a LootDrop, freezes the sim
// while showing the find, and on Collect grants the find to inventory and resumes (see loot-overlay).
const loot = new LootOverlay(
  document.querySelector<HTMLElement>('#loot-overlay')!,
  world,
  {
    onPauseChange: (p) => { lootPaused = p; syncPaused(); },
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

  // the loot popup opens itself the frame a rummaged-empty pile queues a LootDrop (and freezes the
  // sim until the player collects). Checked every frame; a no-op once open or when no drop is pending.
  loot.update();

  // render (reads state; owns no truth) — always runs so the frozen scene stays drawn. The
  // sim-driven animators (wheel spin, storage fill) are skipped while paused: the rig coasts, so
  // its Velocity survives the freeze and the wheels would otherwise keep spinning.
  view.follow(world.get(player, Transform)!, cameraInput.poll(), dt);
  view.sync(world);
  // proximity discs + "Press E"/"Hold E" bubbles: each feature contributes its gated entries and
  // main concatenates them for the shared render-tier overlays. Runs always (even paused) so the
  // disc/prompt stay put behind the overlay rather than popping on resume.
  zones.sync([...workshopZoneDiscs(world), ...scrapPileDiscs(world)]);
  hints.sync([...workshopHints(world), ...scrapPileHints(world)], dt);
  // seepage stains under loose scrap fade IN as pieces spawn (pollution) and OUT as they're collected
  // (cleaning); runs always so an in-progress fade finishes smoothly rather than freezing behind an overlay.
  stains.sync(world, dt);
  if (!paused) {
    animateWheels(view.entityViews, world, dt);
    animateStorageFill(view.entityViews, world, dt);
    animateReclaimer(view.entityViews, world, dt);
    animateScrapPile(view.entityViews, world, dt);
  }
  view.render();

  // UI (reads state; owns no truth) — rig stat readout + the scrap wallet total.
  stats.update(world, player);
  walletHud.update(world);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
