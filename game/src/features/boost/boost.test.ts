import { describe, it, expect } from 'vitest';
import { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Boost, freshBoost, HEAT_MAX } from '@common/components/boost';
import { DriveControl } from '@features/drive/drive-control';
import { Part } from '@common/components/part';
import { Mount } from '@common/components/mount';
import { EngineSpec } from '@common/components/engine-spec';
import { Assembly } from '@common/components/assembly';
import type { EnergyType } from '@shared/part-identity';
import { boostSystem, boostProfileFor } from './boost';

/** A rig that can boost: a Boost gauge, a DriveControl (flooring it forward), and one typed engine. */
function rig(world: World, type: EnergyType): EntityId {
  const r = world.createEntity();
  world.add(r, Boost, freshBoost());
  world.add(r, DriveControl, { throttle: 1, steer: 0, boost: false });
  const eng = world.createEntity();
  world.add(eng, Part, { kind: 'engine' });
  world.add(eng, Mount, { rig: r, col: 0, row: 0, yaw: 0 });
  world.add(eng, EngineSpec, { power: 10, torque: 10 });
  world.add(eng, Assembly, { recipeId: 'test', parts: [], type });
  return r;
}

describe('boostProfileFor', () => {
  it('is null without an engine — no power source, no boost', () => {
    const w = new World();
    const r = w.createEntity();
    w.add(r, Boost, freshBoost());
    w.add(r, DriveControl, { throttle: 1, steer: 0 });
    expect(boostProfileFor(w, r)).toBeNull();
  });

  it('resolves the engine type to its profile', () => {
    const w = new World();
    expect(boostProfileFor(w, rig(w, 'steam'))).not.toBeNull();
    expect(boostProfileFor(w, rig(w, 'electric'))).not.toBeNull();
  });
});

describe('boostSystem', () => {
  it('fills heat and applies a surge while held forward', () => {
    const w = new World();
    const r = rig(w, 'steam');
    w.get(r, DriveControl)!.boost = true;
    boostSystem(w, 0.1);
    const b = w.get(r, Boost)!;
    expect(b.active).toBe(true);
    expect(b.heat).toBeGreaterThan(0);
    expect(b.surgeSpeed).toBeGreaterThan(0);
    expect(b.surgeAccel).toBeGreaterThan(0);
  });

  it('steam is strong-short, electric is weak-long — bigger surge heats faster', () => {
    const steam = new World();
    const rs = rig(steam, 'steam');
    steam.get(rs, DriveControl)!.boost = true;
    const elec = new World();
    const re = rig(elec, 'electric');
    elec.get(re, DriveControl)!.boost = true;

    boostSystem(steam, 0.1);
    boostSystem(elec, 0.1);
    const bs = steam.get(rs, Boost)!;
    const be = elec.get(re, Boost)!;
    expect(bs.surgeSpeed).toBeGreaterThan(be.surgeSpeed); // steam surges harder
    expect(bs.heat).toBeGreaterThan(be.heat);             // ...and heats faster → shorter burst
  });

  it('does not boost without forward throttle (forward-only) — it cools instead', () => {
    const w = new World();
    const r = rig(w, 'steam');
    const ctl = w.get(r, DriveControl)!;
    ctl.boost = true;
    ctl.throttle = 0;
    w.get(r, Boost)!.heat = 20;
    boostSystem(w, 0.1);
    const b = w.get(r, Boost)!;
    expect(b.active).toBe(false);
    expect(b.surgeSpeed).toBe(0);
    expect(b.heat).toBeLessThan(20); // draining, not filling
  });

  it('drains heat while not boosting', () => {
    const w = new World();
    const r = rig(w, 'steam');
    w.get(r, Boost)!.heat = 50;
    w.get(r, DriveControl)!.boost = false;
    boostSystem(w, 0.1);
    expect(w.get(r, Boost)!.heat).toBeLessThan(50);
  });

  it('redlines into a lockout that holds until fully cool, then re-arms', () => {
    const w = new World();
    const r = rig(w, 'steam');
    w.get(r, DriveControl)!.boost = true; // hold it down throughout
    const b = w.get(r, Boost)!;

    // Hold until it redlines.
    for (let i = 0; i < 50 && !b.overheated; i++) boostSystem(w, 0.1);
    expect(b.overheated).toBe(true);
    expect(b.heat).toBe(HEAT_MAX);
    expect(b.active).toBe(false);    // boost is cut the instant it redlines
    expect(b.surgeSpeed).toBe(0);

    // Still held, but locked out — no boost while it cools.
    boostSystem(w, 0.1);
    expect(b.active).toBe(false);
    expect(b.heat).toBeLessThan(HEAT_MAX);

    // It cools all the way down despite boost still being held, then clears the lockout.
    for (let i = 0; i < 100 && b.overheated; i++) boostSystem(w, 0.1);
    expect(b.overheated).toBe(false);
    expect(b.heat).toBe(0);

    // Re-armed: the next held frame boosts again.
    boostSystem(w, 0.1);
    expect(w.get(r, Boost)!.active).toBe(true);
  });

  it('can be feathered — tapping never redlines, so short bursts recover', () => {
    const w = new World();
    const r = rig(w, 'steam');
    const ctl = w.get(r, DriveControl)!;
    const b = w.get(r, Boost)!;
    // Tap (boost one short frame), then rest several — repeat. Heat should never reach the redline.
    for (let cycle = 0; cycle < 10; cycle++) {
      ctl.boost = true;
      boostSystem(w, 0.1);
      ctl.boost = false;
      for (let i = 0; i < 4; i++) boostSystem(w, 0.1);
      expect(b.overheated).toBe(false);
    }
  });
});
