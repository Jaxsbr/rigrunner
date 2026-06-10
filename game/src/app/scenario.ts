import type { World } from '@core/world';

/**
 * A **scenario** is the seeded opening of a world — the half of the old composition root that
 * `bootstrap` deliberately does NOT do. `bootstrap` builds the invariant engine (every system, the
 * render/UI wiring, the frame loop); a scenario decides what entities already exist when that engine
 * starts running: the rig, the workshop, the loose scrap, the camps, and the player's
 * wallet/inventory/bench.
 *
 * The two are orthogonal — same engine, swappable opening — which is the whole point of the split
 * (`real-world-and-progression-spec.md`, Phase 0). The **sandbox** scenario seeds a grant-everything
 * test world; the **real game** scenario seeds a crafted, dev-grant-free cold-open. Because each owns
 * its own opening, testing a new part no longer means vandalising the starting experience.
 *
 * `seed` builds a fresh world for the scenario (a brand-new game, or a fresh sandbox). The real game
 * adds save-aware entry points (`hydrate`, `captureState`) on top of `seed` for the Continue path;
 * the sandbox has only `seed` because it never persists.
 */
export interface Scenario {
  seed(world: World): void;
}
