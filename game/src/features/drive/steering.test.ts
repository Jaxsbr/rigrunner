import { describe, it, expect } from 'vitest';
import { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Part } from '@common/components/part';
import { Mount } from '@common/components/mount';
import { MountGrid } from '@common/components/mount-grid';
import { EngineSpec } from '@common/components/engine-spec';
import { engineDriveBias, steeringPivotLz } from './steering';

/** A rig carrying a deck of `rows` cells along its length (row 0 = front, highest = back). */
function rig(world: World, rows: number): EntityId {
  const e = world.createEntity();
  world.add(e, MountGrid, { cols: 1, rows, cellSize: 1, deckY: 0 });
  return e;
}

/** Mount an engine on `r` at `row` along the deck (front=0 .. back=rows-1). */
function engineAt(world: World, r: EntityId, row: number): EntityId {
  const p = world.createEntity();
  world.add(p, Part, { kind: 'engine' });
  world.add(p, Mount, { rig: r, col: 0, row, yaw: 0 });
  world.add(p, EngineSpec, { power: 12, torque: 10 });
  return p;
}

describe('engineDriveBias', () => {
  it('reads a single engine off the deck end it sits on (1×3 scout: front / middle / rear)', () => {
    // row 0 is the front (−Z), row 2 the back (+Z) — the user's "cell 0 = rear" mental model is the
    // reverse index, so we classify by position and the right end comes out either way.
    const front = new World();
    expect(engineDriveBias(front, (() => { const r = rig(front, 3); engineAt(front, r, 0); return r; })())).toBe('front');

    const middle = new World();
    expect(engineDriveBias(middle, (() => { const r = rig(middle, 3); engineAt(middle, r, 1); return r; })())).toBe('middle');

    const rear = new World();
    expect(engineDriveBias(rear, (() => { const r = rig(rear, 3); engineAt(rear, r, 2); return r; })())).toBe('rear');
  });

  it('classifies the 3×5 hauler zones: rows {0,1} front, {2} middle, {3,4} rear', () => {
    for (const [row, bias] of [[0, 'front'], [1, 'front'], [2, 'middle'], [3, 'rear'], [4, 'rear']] as const) {
      const w = new World();
      const r = rig(w, 5);
      engineAt(w, r, row);
      expect(engineDriveBias(w, r)).toBe(bias);
    }
  });

  it('several engines vote by majority — the end with the most wins', () => {
    const w = new World();
    const r = rig(w, 5);
    engineAt(w, r, 4); // rear
    engineAt(w, r, 3); // rear
    engineAt(w, r, 0); // front
    expect(engineDriveBias(w, r)).toBe('rear'); // 2 rear > 1 front
  });

  it('an even spread resolves to middle — front and rear cancel', () => {
    const w = new World();
    const r = rig(w, 5);
    engineAt(w, r, 4); // rear
    engineAt(w, r, 0); // front
    expect(engineDriveBias(w, r)).toBe('middle');
  });

  it('a tie against the middle resolves to middle', () => {
    const w = new World();
    const r = rig(w, 5);
    engineAt(w, r, 4); // rear
    engineAt(w, r, 2); // middle
    expect(engineDriveBias(w, r)).toBe('middle');
  });

  it('no engine (and no deck) is middle', () => {
    const w = new World();
    expect(engineDriveBias(w, rig(w, 3))).toBe('middle');
    expect(engineDriveBias(w, w.createEntity())).toBe('middle'); // no MountGrid
  });
});

describe('steeringPivotLz', () => {
  it('puts the pivot behind the origin for a rear drive, ahead for a front drive', () => {
    const w = new World();
    const rear = rig(w, 3);
    engineAt(w, rear, 2);
    const front = rig(w, 3);
    engineAt(w, front, 0);

    expect(steeringPivotLz(w, rear)).toBeGreaterThan(0); // +Z = back
    expect(steeringPivotLz(w, front)).toBeLessThan(0); // −Z = front
    expect(steeringPivotLz(w, front)).toBeCloseTo(-steeringPivotLz(w, rear)); // symmetric
  });

  it('a centred (or absent) drive pivots about the origin — offset 0', () => {
    const w = new World();
    const mid = rig(w, 3);
    engineAt(w, mid, 1);
    expect(steeringPivotLz(w, mid)).toBe(0);
    expect(steeringPivotLz(w, rig(w, 3))).toBe(0); // no engine
  });

  it('the longer 3×5 deck shifts its pivot farther than the short 1×3 — wheelbase matters', () => {
    const w = new World();
    const scout = rig(w, 3);
    engineAt(w, scout, 2); // rear
    const hauler = rig(w, 5);
    engineAt(w, hauler, 4); // rear
    expect(steeringPivotLz(w, hauler)).toBeGreaterThan(steeringPivotLz(w, scout));
  });
});
