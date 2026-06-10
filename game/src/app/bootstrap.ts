import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { canPackUp, packUpChassis } from '@features/mounting/rig';
import { Transform } from '@common/components/transform';
import { DriveControl } from '@features/drive/drive-control';
import { mountingSystem } from '@features/mounting/mounting';
import { WorkshopZone } from '@features/workshop/workshop-zone';
import { movementSystem } from '@features/drive/movement';
import { boostSystem } from '@features/boost/boost';
import { Boost } from '@common/components/boost';
import { collisionSystem } from '@common/sim/collision';
import { scrapCollectionSystem } from '@features/scrap/scrap-collection';
import { scrapPileSystem, scrapRummageSystem, pileClearSystem } from '@features/scrap/scrap-pile-system';
import { workshopZoneSystem } from '@features/workshop/workshop-zone-system';
import { workshopDrainSystem } from '@features/workshop/workshop-drain-system';
import { createDriveInput } from '@common/input/drive-input';
import { createCameraInput } from '@common/input/camera-input';
import { createBuildController } from '@features/mounting/build-controller';
import { getActiveRig, MAX_OWNED } from '@features/chassis/ownership';
import { advanceDeploying } from '@features/chassis/deploying';
import { animateChassisDeploy } from '@features/chassis/deploy-animator';
import { ChassisBar } from '@features/chassis/chassis-bar';
import { PackPrompt } from '@features/chassis/pack-prompt';
import { activeStagingTargets } from '@features/workshop/staging';
import { RenderView } from '@common/render/view';
import { ZoneOverlays } from '@common/render/zone-overlays';
import { ScrapStains } from '@features/scrap/scrap-stains';
import { workshopZoneDiscs } from '@features/workshop/overlays';
import { scrapPileDiscs } from '@features/scrap/overlays';
import { animateWheels } from '@features/drive/wheel-spin';
import { animateStorageFill } from '@features/storage/storage-fill';
import { animateReclaimer } from '@features/scrap/reclaimer-animator';
import { animateScrapPile } from '@features/scrap/scrap-pile-animator';
import { animateScrapPileClear } from '@features/scrap/scrap-pile-clear-animator';
import { ScrapPileStains } from '@features/scrap/scrap-pile-stains';
import { StatsHud } from '@features/hud/stats-hud';
import { Toast } from '@features/hud/toast';
import { WalletHud } from '@features/economy/wallet-hud';
import { WorkshopOverlay } from '@features/workshop/workshop-overlay';
import { LootOverlay } from '@features/scrap/loot-overlay';
import { ScrapPrompt } from '@features/scrap/scrap-prompt';
import { Health } from '@common/components/health';
import { weaponFireSystem } from '@features/camps/weapon-fire-system';
import { enemyAiSystem } from '@features/camps/enemy-ai-system';
import { projectileMoveSystem } from '@features/camps/projectile-system';
import { combatSystem } from '@features/camps/combat-system';
import { campSystem, resolveDisarm } from '@features/camps/camp-system';
import { repairSystem } from '@features/camps/repair-system';
import { CampStains } from '@features/camps/camp-stains';
import { TrackMarks } from '@features/tracks/track-marks';
import { animateCampTeardown } from '@features/camps/camp-teardown-animator';
import { animateWeapons } from '@features/camps/weapon-animator';
import { animateTrapArm } from '@features/camps/trap-arm-animator';
import { DisarmOverlay } from '@features/camps/disarm-overlay';
import { DisarmPrompt } from '@features/camps/disarm-prompt';
import { findDisarmTarget } from '@features/camps/disarm-gate';
import { campDiscs } from '@features/camps/overlays';
import { DEFAULT_TIER } from '@common/parts/tiers';
import { HealthHud } from '@features/hud/health-hud';
import { restorationSystem } from '@features/restoration/restoration-system';
import { RestorationStains } from '@features/restoration/restoration-stains';
import { TreeGrower } from '@features/restoration/tree-grower';
import { HealPrompt } from '@features/restoration/heal-prompt';
import { healDiscs } from '@features/restoration/overlays';

/** Per-launch configuration for the engine — what differs between the real game and the sandbox. */
export interface BootCfg {
  /**
   * Dev-only affordances. On in the sandbox, off in the real game. Currently gates the manual `R`
   * run-reset key — a testing convenience that has no place in the game a player runs.
   */
  dev?: boolean;
  /**
   * Called when the page is about to unload, if this launch persists. The real game wires the save
   * here (capture → write the slot); the sandbox leaves it unset, so it never persists.
   */
  onPersist?: () => void;
}

/**
 * The composition root's engine: given an already-seeded `world`, wire input → simulation → render
 * together and run the frame loop (ADR-003). This is the half that is IDENTICAL for every scenario —
 * the seed (which entities exist) is the scenario's job; everything here (the systems, the render/UI,
 * the loop) is invariant. It is the ONLY layer that knows about all three tiers and every feature at
 * once: the feature render (sim-driven animators + proximity overlays/hints/stains) is dispatched
 * from HERE against the `scene` / `entityViews` the view façade exposes, so the shared render tier
 * never imports a feature.
 */
export function bootstrap(world: World, cfg: BootCfg = {}): void {
  const canvas = document.querySelector<HTMLCanvasElement>('#view')!;

  // Persist on the way out, if this launch saves (the real game). Capturing at unload keeps the slot
  // current without threading a save call through every mutation; a page reload triggers it too.
  if (cfg.onPersist) {
    window.addEventListener('beforeunload', cfg.onPersist);
  }

  const input = createDriveInput();
  const cameraInput = createCameraInput(canvas);
  const view = new RenderView(canvas);
  // The transient cap-refusal toast (top-centre): when the player hauls out a chassis kit they can't
  // field — already at MAX_OWNED — the build controller calls back here so the refusal is spoken, not
  // silent (the kit still glides home to the deck). The composition root owns the copy; the toast itself
  // is a generic primitive.
  const capToast = new Toast(document.querySelector<HTMLElement>('#cap-toast')!);

  // The build controller follows the ACTIVE rig (so you build on whichever chassis you control) and is
  // given the workshop's active staging decks — rather than importing the workshop's WorkshopZone
  // itself — so mounting never imports workshop; the edge points downhill (workshop → mounting),
  // keeping the cross-feature DAG acyclic (ADR-003).
  const build = createBuildController(
    world,
    view,
    canvas,
    () => getActiveRig(world)!,
    () => activeStagingTargets(world),
    () => capToast.show(`You can only field ${MAX_OWNED} chassis at once — pack up one first to make room.`),
  );
  const stats = new StatsHud(document.querySelector<HTMLElement>('#stats')!);
  const chassisBar = new ChassisBar(document.querySelector<HTMLElement>('#chassis-bar')!, world);
  const walletHud = new WalletHud(document.querySelector<HTMLElement>('#wallet')!);
  const healthHud = new HealthHud(document.querySelector<HTMLElement>('#health-bar')!);

  // Feature render dispatched from the composition root (ADR-003 §4): the proximity discs, the "Press
  // E"/"Hold E" hints, and the seepage stains are constructed against the view's scene here, so the
  // shared render tier (`@common/render/view`) imports no feature. The sim-driven animators are plain
  // functions called below against `view.entityViews`.
  const zones = new ZoneOverlays(view.scene);
  const stains = new ScrapStains(view.scene);
  const pileStains = new ScrapPileStains(view.scene);
  const campStains = new CampStains(view.scene);
  // Restoration render: the green regrowth patch under each cleared-site stump, and the procedural young
  // tree that rises out of a stump as the player grows it (posed off the sim's `Healable.growth`).
  const restorationStains = new RestorationStains(view.scene);
  const treeGrower = new TreeGrower();
  // Fading tread trails pressed into the ground by everything that drives (the rig + camp guards).
  const tracks = new TrackMarks(view.scene);

  // Three overlays can each freeze the simulation: the workshop interface, the loot popup, and the disarm
  // puzzle. We own one `paused` flag that is the OR of all three, so whichever is up holds the sim
  // still and resuming needs them all down. Each overlay flips its own bit through its callback.
  let paused = false;
  let workshopPaused = false;
  let lootPaused = false;
  let disarmPaused = false;
  const syncPaused = (): void => { paused = workshopPaused || lootPaused || disarmPaused; };

  // The workshop interface shell. Opening its tab freezes the simulation; the tab's visibility tracks
  // zone proximity, which we push in each frame (the overlay never touches the World).
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

  // The disarm puzzle. When the active rig parks a mounted trap arm in reach of a DISARMABLE camp, E
  // opens the timing mini-game; it freezes the sim, and on finish resolves the outcome (loot + damage +
  // clear the camp) and announces it. The loot overlay reveals any spoils the next frame.
  const disarm = new DisarmOverlay(
    document.querySelector<HTMLElement>('#disarm-overlay')!,
    {
      onPauseChange: (p) => { disarmPaused = p; syncPaused(); },
      onResolve: (camp, grade) => resolveDisarm(world, camp, getActiveRig(world)!, grade),
      announce: (msg) => capToast.show(msg),
    },
  );

  // The bottom-centre scrap-pile prompt: the fixed screen-space "Hold E" cue. We push the live
  // pile-gate state into it each frame (the prompt never touches the World).
  const scrapPrompt = new ScrapPrompt(document.querySelector<HTMLElement>('#scrap-prompt')!);

  // The pack-up prompt, sharing that bottom-centre slot: shown when the controlled chassis is empty and
  // can fold back into a kit. We compute the gate (off the workshop, off a pile) and push it here.
  const packPrompt = new PackPrompt(document.querySelector<HTMLElement>('#pack-prompt')!);

  // The disarm prompt, sharing that bottom-centre slot: shown when the rig is parked in reach of a
  // DISARMABLE camp with a trap arm mounted. We push the same gate the camp's proximity disc lights
  // on, so the ring and the prompt appear together.
  const disarmPrompt = new DisarmPrompt(document.querySelector<HTMLElement>('#disarm-prompt')!);

  // The heal prompt, sharing that bottom-centre slot: shown when the rig is parked with a stump-healer
  // Reclaimer aimed at a not-yet-grown stump. Mirrors the scrap prompt (a held-E interaction).
  const healPrompt = new HealPrompt(document.querySelector<HTMLElement>('#heal-prompt')!);

  /** True while the rig is parked in any workshop zone — drives the tab's visibility. */
  function anyZoneActive(): boolean {
    for (const w of world.query(WorkshopZone)) {
      if (world.get(w, WorkshopZone)!.active) return true;
    }
    return false;
  }

  // The run reset — the placeholder death stake (spec §2.1, flagged to revisit). On HP=0 (or, in the
  // sandbox, the dev R key) a brief curtain shows, then a page reload restarts the app from the front
  // door: the sandbox re-seeds its test world, the real game returns to its menu (where Continue reloads
  // the save). `dying` freezes input + sim during the curtain.
  const deathOverlay = document.querySelector<HTMLElement>('#death-overlay')!;
  let dying = false;
  function triggerReset(): void {
    if (dying) return;
    dying = true;
    deathOverlay.classList.remove('hidden');
    window.setTimeout(() => window.location.reload(), 1000);
  }
  if (cfg.dev) {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'r' || e.key === 'R') triggerReset();
    });
  }

  let last = performance.now();
  let prevActiveRig: EntityId | null = null; // last frame's active rig — a change drives the camera pan
  let prevWork = false; // E held last frame — the rising edge is the single-press pack-up trigger
  function frame(now: number): void {
    const dt = Math.min((now - last) / 1000, 0.05); // clamp to avoid jumps on refocus
    last = now;

    // The chassis the player currently controls — input, camera, HUD, the workshop zone and the
    // scrap-pile gate all follow it, so switching rigs (the chassis bar / 1-2 keys) reroutes them all
    // with no extra wiring. The starter is owned + active at boot, so this is always set.
    const activeRig = getActiveRig(world)!;

    // input → intent → the active rig's control component (the seam). While the workshop overlay is
    // open the sim is frozen: drive input is ignored and the control is zeroed, so no held-then-
    // released key survives the pause to lurch the rig on resume.
    const ctl = world.get(activeRig, DriveControl)!;
    let work = false; // E held this frame (only while the sim runs) — the hold-to-work rummage intent
    if (paused || dying) {
      ctl.throttle = 0;
      ctl.steer = 0;
      ctl.boost = false;
    } else {
      const intent = input.poll();
      ctl.throttle = intent.throttle;
      ctl.steer = intent.steer;
      ctl.boost = intent.boost;
      work = intent.work;
    }
    // E's RISING edge — one press, distinct from the held-E rummage. Pack-up (a single-shot action) reads
    // it; the two never collide because an empty chassis (the pack gate) carries no Reclaimer to rummage.
    const ePressed = work && !prevWork;
    prevWork = work;

    // simulation (the source of truth): drive the rigs, then ride mounted parts to their cells,
    // then let the build interaction move a carried part / settle drops. The whole block is gated by
    // `paused` — opening the overlay freezes movement, mounting-ride, the proximity gate, the build
    // interaction, collection and drain together; the scene keeps rendering frozen below.
    if (!paused && !dying) {
      // Resolve boost heat/surge for every rig BEFORE movement reads it (so the surge is current).
      boostSystem(world, dt);
      movementSystem(world, dt);
      mountingSystem(world);
      // recompute each workshop's proximity gate (rig in range?) before the build interaction reads
      // it, so a part dropped this frame snaps onto the workshop only when it's lit.
      workshopZoneSystem(world, activeRig);
      build.update(dt);
      // advance any in-progress chassis deploy (a kit the build interaction just hauled out and
      // converted): ticks the unfold's timeline and retires the Deploying marker when it completes.
      advanceDeploying(world, dt);

      // pack-up: one E press on an EMPTY controlled chassis (and only when a backup chassis exists to
      // hand control to) folds it back into a kit crate where it stands. Gated off the workshop zone —
      // which owns E there to open the interface — so the bottom-centre prompt slot and the E key are
      // never contested; control snaps to the backup (the camera eases over next frame). The local
      // `activeRig` is now the packed crate for the rest of this frame; getActiveRig is the backup.
      if (ePressed && !anyZoneActive() && canPackUp(world, activeRig)) {
        packUpChassis(world, activeRig);
      }

      // scrap piles: recompute each pile's capability+facing gate (after mounting has ridden the
      // Reclaimer to its cell, so its aim is current), then turn a held work key over an active pile
      // into the rummage — the arm digs and the heap bursts loose scrap around the rig.
      scrapPileSystem(world, activeRig);
      scrapRummageSystem(world, activeRig, work, dt);
      // advance the reclaim dissolve of any emptied pile (heap sinking, stump rising). In the sim block,
      // so it freezes behind the loot popup the empty pile just opened — the dissolve plays once collected.
      pileClearSystem(world, dt);

      // restoration: recompute each cleared-site stump's heal gate (a stump-healer Reclaimer aimed at it in
      // reach), then turn a held work key into the grow — the arm works and the stump's growth advances,
      // the tree-grower rendering a young tree rising out of it. Runs after the pile gate (they share the
      // work key, but the bucket↔healer head split keeps them from contending over the same arm).
      restorationSystem(world, activeRig, work, dt);

      // camps combat: enemies act, the rig's weapon fires, then all shots travel — all BEFORE the one
      // collision pass below, so this frame's positions are what hits resolve against.
      enemyAiSystem(world, activeRig, dt);
      weaponFireSystem(world, activeRig, dt);
      projectileMoveSystem(world, dt);

      // ONE collision pass feeds both consumers (the promoted @common/sim/collision): scrap collection
      // (drive-over sweep into storage) and combat (projectile hits + ram). Pure pair list in, each
      // consumer decides what a pair means.
      const pairs = collisionSystem(world);
      scrapCollectionSystem(world, pairs);
      combatSystem(world, activeRig, pairs);

      // camps: advance each camp's state machine — all guards down → DISARMABLE. The second transition
      // (DISARMABLE → CLEARED) is the player's: solving the disarm puzzle, handled by the disarm overlay.
      // Once CLEARED it also runs the teardown clock (structures sink, the sprout rises) on dt.
      campSystem(world, dt);

      // free repair while parked in a workshop zone (home base = safety + repair).
      repairSystem(world, activeRig, anyZoneActive(), dt);

      // workshop drain: bank scrap out of containers parked on a workshop into the player's wallet.
      workshopDrainSystem(world, dt);

      // death: HP gone → reset the run. Checked after repair, so a heal that out-paces the last hit saves you.
      const hp = world.get(activeRig, Health);
      if (hp && hp.current <= 0) triggerReset();
    }

    // the tab tracks zone proximity each frame (the overlay hides it while open, so reading the
    // frozen zone state while paused is harmless).
    overlay.setZoneActive(anyZoneActive());
    // the scrap prompt mirrors that for piles: shown only while the sim runs and a pile's gate is lit.
    scrapPrompt.sync(world, !paused);
    // the pack-up prompt shares the slot: shown only while the sim runs, away from any workshop zone,
    // and when the controlled chassis is empty with a backup to fall back to (`canPackUp`). Read fresh
    // from getActiveRig so the frame a pack-up happens it reflects the backup (not the just-packed crate).
    packPrompt.sync(!paused && !anyZoneActive() && canPackUp(world, getActiveRig(world)!));

    // the disarm gate: is the active rig parked with a mounted trap arm in reach of a DISARMABLE camp?
    // Push it (and the head tier that sets the puzzle difficulty) into the overlay, then advance the
    // marker sweep — both run always so the puzzle animates while it holds the sim frozen.
    const disarmTarget = findDisarmTarget(world, activeRig);
    disarm.setReady(disarmTarget !== null, disarmTarget?.camp ?? null, disarmTarget?.headTier ?? DEFAULT_TIER);
    disarm.tick(dt);
    // the disarm prompt mirrors that gate, shown only while the sim runs (the overlay hides it once open).
    disarmPrompt.sync(disarmTarget !== null && !paused && !dying);
    // the heal prompt: shown while the sim runs and some healable stump's gate is lit (a stump-healer aimed
    // at a not-yet-grown stump). Computed once and reused by the proximity discs below, so the ring and the
    // prompt read the same gate and appear together.
    const healZones = healDiscs(world);
    healPrompt.sync(!paused && !dying && healZones.some((d) => d.active));

    // the loot popup opens itself the frame a rummaged-empty pile queues a LootDrop (and freezes the
    // sim until the player collects). Checked every frame; a no-op once open or when no drop is pending.
    loot.update();

    // render (reads state; owns no truth) — always runs so the frozen scene stays drawn. The
    // sim-driven animators (wheel spin, storage fill) are skipped while paused: the rig coasts, so
    // its Velocity survives the freeze and the wheels would otherwise keep spinning.
    // A change of active rig (the 1/2 switch) tells the camera to EASE to the new rig rather than
    // teleport; during normal driving it stays glued. prevActiveRig starts null, so the boot frame is
    // not treated as a switch.
    const retarget = prevActiveRig !== null && activeRig !== prevActiveRig;
    prevActiveRig = activeRig;
    // A boost speed-kick: widen the camera FOV a few degrees while the active rig is boosting (eased in
    // and out by the camera). Zeroed while paused/dying so the view never sticks wide behind an overlay.
    const boosting = !paused && !dying && (world.get(activeRig, Boost)?.active ?? false);
    view.setFovExtra(boosting ? 6 : 0);
    view.follow(world.get(activeRig, Transform)!, cameraInput.poll(), dt, retarget);
    view.sync(world);
    // proximity discs (workshop + scrap): each feature contributes its gated disc entries and we
    // concatenate them for the shared render tier. Each feature's "what key does this" prompt is a
    // fixed bottom-centre HUD element (the workshop tab + the scrap prompt), kept in screen space so it
    // never sits over the deck or the heap. Runs always (even paused) so the discs stay put behind an
    // overlay rather than popping on resume.
    zones.sync([...workshopZoneDiscs(world), ...scrapPileDiscs(world), ...campDiscs(world, activeRig), ...healZones], dt);
    // seepage stains under loose scrap fade IN as pieces spawn (pollution) and OUT as they're collected
    // (cleaning); runs always so an in-progress fade finishes smoothly rather than freezing behind an overlay.
    stains.sync(world, dt);
    // pile pollution holds while a heap stands and fades out once it's reclaimed — the land slowly healing.
    pileStains.sync(world, dt);
    // camp stains hold while a camp stands and fade out once it's cleared — the world visibly cleaning up.
    campStains.sync(world, dt);
    // restoration regrowth: a faint green patch shows under every cleared-site stump and DEEPENS as the
    // player grows it into a tree (scaled by Healable.growth) — the land healing. Runs always so a live grow
    // and any fade finish smoothly behind an overlay.
    restorationStains.sync(world, dt);
    // tread trails: stamp new marks behind everything that drove this frame and fade the old ones. Runs
    // always so trails keep fading behind an overlay; the sim being frozen means nothing moves, so no new
    // marks are laid while paused.
    tracks.sync(world, dt);
    // the camp's teardown: a cleared camp's structures + debris sink into the ground while its sprout rises.
    // Reads Camp.tornDown (sim), so it runs always — a paused pose holds rather than snapping back to rest.
    animateCampTeardown(view.entityViews, world);
    // the pile's reclaim dissolve: an emptied heap sinks while its stump rises, off the shared Dissolving
    // clock. Runs always (like the camp teardown) so the dissolve holds behind the loot popup, not snaps.
    animateScrapPileClear(view.entityViews, world);
    // the growing tree: a young tree rises out of each stump being healed, posed off Healable.growth. Runs
    // always so a mid-grow pose holds behind an overlay rather than snapping (like the dissolve animators).
    treeGrower.sync(view.entityViews, world);
    if (!paused && !dying) {
      animateWheels(view.entityViews, world, dt);
      animateChassisDeploy(view.entityViews, world, dt);
      animateStorageFill(view.entityViews, world, dt);
      animateReclaimer(view.entityViews, world, dt);
      animateScrapPile(view.entityViews, world, dt);
      animateWeapons(view.entityViews, world, dt);
      animateTrapArm(view.entityViews, world, dt);
    }
    view.render();

    // UI (reads state; owns no truth) — the active rig's stat readout, the owned-chassis bar, and the
    // scrap wallet total.
    stats.update(world, activeRig);
    chassisBar.update();
    walletHud.update(world);
    healthHud.update(world, activeRig);
    // the cap-refusal toast ticks its dismiss countdown on real (clamped) time — always, so it fades on
    // schedule even if the player opens the workshop right after triggering it.
    capToast.update(dt);

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
