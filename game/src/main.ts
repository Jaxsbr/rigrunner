import { World } from '@core/world';
import { bootstrap } from './app/bootstrap';
import { showMenu } from './app/menu';
import { seedSandboxWorld } from './app/scenarios/sandbox';
import { seedRealGameWorld, seedStaticWorld } from './app/scenarios/real-game';
import { captureSnapshot, restoreSnapshot } from './app/snapshot';
import { hasSave, loadGame, saveGame } from './app/persistence';
import { startEditor } from './app/editor/editor';

/**
 * The front door. The entry that decides WHICH world to enter, then hands a seeded world to the
 * engine. The launch mode picks the branch (Phase 0 — `real-world-and-progression-spec.md`):
 *
 *  - `dev:editor` (`import.meta.env.MODE === 'editor'`) opens the MAP EDITOR — paint the static
 *    collision grid against the real world, no menu and no sim (authoring, not play).
 *  - `dev:sandbox` (`import.meta.env.MODE === 'sandbox'`) boots STRAIGHT into the grant-everything
 *    test world, no menu — testing has its own room, so the real game's opening is never vandalised
 *    to make a new part testable.
 *  - any other launch is the real game: show the New Game / Continue menu, then enter the chosen world
 *    and start the engine, persisting on the way out. New Game seeds the cold-open; Continue lays the
 *    static world, then rebuilds saved progress from the snapshot.
 *
 * The game branches converge on the same `bootstrap(world, cfg)` — one engine, swappable opening; the
 * editor is its own loop. The cross-feature seeding/restoring lives in the scenarios + snapshot; this
 * file only routes.
 */
if (import.meta.env.MODE === 'editor') {
  // The map editor (`npm run dev:editor`): paint the static collision grid against the real world, no
  // menu and no driving sim — authoring, not play. It saves straight to the committed map file.
  startEditor();
} else if (import.meta.env.MODE === 'sandbox') {
  const world = new World();
  seedSandboxWorld(world);
  bootstrap(world, { dev: true }); // dev affordances on; the sandbox never persists
} else {
  showMenu({
    canContinue: hasSave(),
    onChoose: (choice) => {
      const world = new World();
      // Continue loads the save; a missing/corrupt slot (it can vanish between the menu rendering and
      // the click) falls through to a fresh cold-open, exactly like New Game.
      const snapshot = choice.kind === 'continue' ? loadGame() : null;
      if (snapshot) {
        seedStaticWorld(world);
        restoreSnapshot(world, snapshot);
      } else {
        seedRealGameWorld(world);
      }
      bootstrap(world, {
        dev: false,
        camera: snapshot?.camera, // resume the saved view pose; undefined opens at the default
        // World state via captureSnapshot; the camera pose (view state) rides along off the view.
        onPersist: (view) => saveGame({ ...captureSnapshot(world), camera: view.cameraPose() }),
      });
    },
  });
}
