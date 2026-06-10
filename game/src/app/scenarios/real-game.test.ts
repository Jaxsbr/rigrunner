import { describe, it, expect } from 'vitest';
import { World } from '@core/world';
import { getWallet } from '@features/economy/wallet';
import { realGameScenario, hydrate, captureState } from './real-game';
import { SAVE_VERSION } from '../persistence';

/**
 * The real game's save round-trip (Phase 0). The localStorage layer is exercised manually (it no-ops
 * headless); these prove the pure capture/hydrate seam either side of it — that a captured wallet
 * survives a re-seed, which is what makes Continue mean "pick up where I left off".
 */
describe('real-game scenario persistence', () => {
  it('captures the live wallet into a versioned GameState', () => {
    const world = new World();
    realGameScenario.seed(world);
    getWallet(world)!.scrap = 250;

    const state = captureState(world);

    expect(state.version).toBe(SAVE_VERSION);
    expect(state.wallet.scrap).toBe(250);
  });

  it('hydrate lays the saved wallet over a fresh cold-open', () => {
    const source = new World();
    realGameScenario.seed(source);
    getWallet(source)!.scrap = 250;
    const state = captureState(source);

    const restored = new World();
    hydrate(restored, state);

    // The cold-open seeds 100; the saved 250 must win, or Continue would silently reset progress.
    expect(getWallet(restored)!.scrap).toBe(250);
  });
});
