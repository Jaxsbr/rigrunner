import { World } from '@core/world';
import { bootstrap } from './app/bootstrap';
import { showMenu } from './app/menu';
import { sandboxScenario } from './app/scenarios/sandbox';
import { realGameScenario, hydrate, captureState } from './app/scenarios/real-game';
import { hasSave, loadGame, saveGame } from './app/persistence';

/**
 * The front door. The entry that decides WHICH world to enter, then hands a seeded world to the
 * engine. The launch mode picks the branch (Phase 0 — `real-world-and-progression-spec.md`):
 *
 *  - `dev:sandbox` (`import.meta.env.MODE === 'sandbox'`) boots STRAIGHT into the grant-everything
 *    test world, no menu — testing has its own room, so the real game's opening is never vandalised
 *    to make a new part testable.
 *  - any other launch is the real game: show the New Game / Continue menu, then seed the chosen world
 *    (a fresh cold-open, or the save hydrated over one) and start the engine, persisting on the way out.
 *
 * Both branches converge on the same `bootstrap(world, cfg)` — one engine, swappable opening. The
 * cross-feature seeding lives in the scenarios; this file only routes.
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
        const saved = loadGame();
        // A save can vanish between the menu rendering and the click (another tab clearing it);
        // fall back to a fresh cold-open rather than booting an empty world.
        if (saved) hydrate(world, saved);
        else realGameScenario.seed(world);
      } else {
        realGameScenario.seed(world);
      }
      bootstrap(world, { dev: false, onPersist: () => saveGame(captureState(world)) });
    },
  });
}
