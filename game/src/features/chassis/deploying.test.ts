import { describe, it, expect } from 'vitest';
import { World } from '@core/world';
import { Deploying, DEPLOY_DURATION, advanceDeploying } from './deploying';

describe('advanceDeploying', () => {
  it('ticks an in-progress deploy by dt', () => {
    const w = new World();
    const c = w.createEntity();
    w.add(c, Deploying, { since: 0 });

    advanceDeploying(w, 0.1);
    expect(w.get(c, Deploying)).toMatchObject({ since: 0.1 });
    advanceDeploying(w, 0.1);
    expect(w.get(c, Deploying)).toMatchObject({ since: 0.2 });
  });

  it('retires the marker once the unfold has run its full duration', () => {
    const w = new World();
    const c = w.createEntity();
    w.add(c, Deploying, { since: 0 });

    advanceDeploying(w, DEPLOY_DURATION - 0.01);
    expect(w.has(c, Deploying)).toBe(true); // still unfolding
    advanceDeploying(w, 0.02);
    expect(w.has(c, Deploying)).toBe(false); // completed → settled into a plain rig
  });

  it('is a no-op when nothing is deploying', () => {
    const w = new World();
    expect(() => advanceDeploying(w, 0.1)).not.toThrow();
  });

  it('advances each deploy independently', () => {
    const w = new World();
    const a = w.createEntity();
    const b = w.createEntity();
    w.add(a, Deploying, { since: DEPLOY_DURATION - 0.005 }); // about to finish
    w.add(b, Deploying, { since: 0 });                       // just started

    advanceDeploying(w, 0.01);
    expect(w.has(a, Deploying)).toBe(false); // a completed
    expect(w.get(b, Deploying)).toMatchObject({ since: 0.01 }); // b still going
  });
});
