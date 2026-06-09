import { describe, it, expect } from 'vitest';
import { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { Collider } from '@common/components/collider';
import { Mount } from '@common/components/mount';
import { RestorableSite } from '@common/components/restorable-site';
import { ReclaimerWorking } from '@common/components/reclaimer-working';
import { composeProduct } from '@common/sim/assembly';
import { RECLAIMER_RECIPE } from '@common/parts/recipes';
import { partDef } from '@common/parts/parts-catalog';
import { Healable } from './healable';
import { restorationSystem } from './restoration-system';

/** A rig at (x,z) with a collider (radius 1.2, like the in-game rig). */
function rig(world: World, x: number, z: number, rotationY = 0): EntityId {
  const e = world.createEntity();
  world.add(e, Transform, { x, z, rotationY });
  world.add(e, Collider, { radius: 1.2 });
  return e;
}

/** Mount a composed Reclaimer (arm + the given head) on `rig`, posed at (x,z) facing `rotationY` (as the
 *  mounting system would). The head id decides whether it can heal: only 'stump-healer' is a healer. */
function reclaimer(world: World, rigId: EntityId, x: number, z: number, rotationY: number, headId: string): EntityId {
  const e = composeProduct(world, RECLAIMER_RECIPE, [partDef('reclaimer-arm')!, partDef(headId)!]);
  world.add(e, Mount, { rig: rigId, col: 0, row: 0, yaw: 0 });
  world.add(e, Transform, { x, z, rotationY });
  return e;
}

/** A cleared-site stump at (x,z) — the marker a reclaimed pile or camp leaves. */
function stump(world: World, x: number, z: number): EntityId {
  const e = world.createEntity();
  world.add(e, Transform, { x, z, rotationY: 0 });
  world.add(e, RestorableSite, { x, z, kind: 'scrap', sourceLevel: 0 });
  return e;
}

describe('restorationSystem (the gate)', () => {
  it('tags every RestorableSite stump as Healable', () => {
    const world = new World();
    const r = rig(world, 0, 0);
    const s = stump(world, 0, -3);
    restorationSystem(world, r, false, 0.1);
    expect(world.has(s, Healable)).toBe(true);
    expect(world.get(s, Healable)!.growth).toBe(0);
  });

  it('stays dormant without a mounted healer, even in range + aimed', () => {
    const world = new World();
    const r = rig(world, 0, 0, 0);
    const s = stump(world, 0, -3); // straight ahead, in range
    restorationSystem(world, r, false, 0.1);
    expect(world.get(s, Healable)!.active).toBe(false);
  });

  it('stays dormant with a BUCKET reclaimer (the digger, not a healer)', () => {
    const world = new World();
    const r = rig(world, 0, 0, 0);
    reclaimer(world, r, 0, 0, 0, 'reclaimer-bucket');
    const s = stump(world, 0, -3);
    restorationSystem(world, r, false, 0.1);
    expect(world.get(s, Healable)!.active).toBe(false);
  });

  it('activates in range with a stump-healer aimed at the stump', () => {
    const world = new World();
    const r = rig(world, 0, 0, 0);
    reclaimer(world, r, 0, 0, 0, 'stump-healer'); // yaw 0 → front toward −Z
    const s = stump(world, 0, -3); // straight ahead, in range
    restorationSystem(world, r, false, 0.1);
    expect(world.get(s, Healable)!.active).toBe(true);
  });

  it('stays dormant when the healer faces away from the stump', () => {
    const world = new World();
    const r = rig(world, 0, 0, 0);
    reclaimer(world, r, 0, 0, 0, 'stump-healer'); // front toward −Z…
    const s = stump(world, 0, 3); // …but the stump is toward +Z (behind) — out of FOV
    restorationSystem(world, r, false, 0.1);
    expect(world.get(s, Healable)!.active).toBe(false);
  });

  it('stays dormant when aimed correctly but out of range', () => {
    const world = new World();
    const r = rig(world, 0, 0, 0);
    reclaimer(world, r, 0, 0, 0, 'stump-healer');
    const s = stump(world, 0, -10); // aimed, but dist 10 > 4 + 1.2
    restorationSystem(world, r, false, 0.1);
    expect(world.get(s, Healable)!.active).toBe(false);
  });
});

describe('restorationSystem (hold-to-grow)', () => {
  /** A world with the rig parked and a stump-healer aimed at a stump in range. */
  function workableWorld(): { world: World; r: EntityId; rec: EntityId; s: EntityId } {
    const world = new World();
    const r = rig(world, 0, 0, 0);
    const rec = reclaimer(world, r, 0, 0, 0, 'stump-healer');
    const s = stump(world, 0, -3);
    restorationSystem(world, r, false, 0); // tag Healable + light the gate
    return { world, r, rec, s };
  }

  it('marks the healer working while growing an active stump, clears it when released', () => {
    const { world, r, rec } = workableWorld();
    restorationSystem(world, r, true, 0.1);
    expect(world.has(rec, ReclaimerWorking)).toBe(true);
    restorationSystem(world, r, false, 0.1);
    expect(world.has(rec, ReclaimerWorking)).toBe(false);
  });

  it('advances growth while held and does not when the gate is unmet', () => {
    const { world, r, s } = workableWorld();
    restorationSystem(world, r, true, 3); // half of the 6 s grow
    expect(world.get(s, Healable)!.growth).toBeCloseTo(0.5, 5);
    // Releasing the key halts growth where it stands (no decay).
    restorationSystem(world, r, false, 3);
    expect(world.get(s, Healable)!.growth).toBeCloseTo(0.5, 5);
  });

  it('grows fully after enough holding, then drops the gate (no more prompt)', () => {
    const { world, r, rec, s } = workableWorld();
    restorationSystem(world, r, true, 6); // a full grow in one beat
    const h = world.get(s, Healable)!;
    expect(h.growth).toBe(1);
    expect(h.active).toBe(false);             // fully grown — the gate closes
    expect(world.has(rec, ReclaimerWorking)).toBe(false); // and the arm stops working

    // A subsequent frame keeps it dormant even with the key held + aimed in range.
    restorationSystem(world, r, true, 1);
    expect(world.get(s, Healable)!.active).toBe(false);
    expect(world.get(s, Healable)!.growth).toBe(1);
  });
});
