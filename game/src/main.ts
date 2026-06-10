import { World } from '@core/world';
import { bootstrap } from './app/bootstrap';
import { showMenu } from './app/menu';
import { sandboxScenario } from './app/scenarios/sandbox';
import { realGameScenario, seedStaticWorld } from './app/scenarios/real-game';
import { captureSnapshot, restoreSnapshot } from './app/snapshot';
import { hasSave, loadGame, saveGame } from './app/persistence';

/**
 * The front door. The entry that decides WHICH world to enter, then hands a seeded world to the
 * engine. The launch mode picks the branch (Phase 0 — `real-world-and-progression-spec.md`):
 *
 *  - `dev:sandbox` (`import.meta.env.MODE === 'sandbox'`) boots STRAIGHT into the grant-everything
 *    test world, no menu — testing has its own room, so the real game's opening is never vandalised
 *    to make a new part testable.
 *  - any other launch is the real game: show the New Game / Continue menu, then enter the chosen world
 *    and start the engine, persisting on the way out. New Game seeds the cold-open; Continue lays the
 *    static world, then rebuilds saved progress from the snapshot.
 *
 * Both branches converge on the same `bootstrap(world, cfg)` — one engine, swappable opening. The
 * cross-feature seeding/restoring lives in the scenarios + snapshot; this file only routes.
 */
if (import.meta.env.MODE === 'sandbox') {
  const world = new World();
  sandboxScenario.seed(world);
  bootstrap(world, { dev: true }); // dev affordances on; the sandbox never persists
} else {
  showMenu({
    canContinue: hasSave(),
    onChoose: (choice) => {
      const world = new World();
      if (choice.kind === 'continue') {
        const snapshot = loadGame();
        // A save can vanish between the menu rendering and the click (another tab clearing it); fall
        // back to a fresh cold-open rather than booting an empty world.
        if (snapshot) {
          seedStaticWorld(world);
          restoreSnapshot(world, snapshot);
        } else {
          realGameScenario.seed(world);
        }
      } else {
        realGameScenario.seed(world);
      }
      bootstrap(world, { dev: false, onPersist: () => saveGame(captureSnapshot(world)) });
    },
  });
}
