import { describe, it, expect } from 'vitest';
import { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { MountGrid } from '@common/components/mount-grid';
import { Part } from '@common/components/part';
import { Mount } from '@common/components/mount';
import { Storage } from '@common/components/storage';
import { Collectible } from '@features/scrap/collectible';
import type { CollisionPair } from '@common/sim/collision';
import { scrapCollectionSystem } from './scrap-collection';

function rig(world: World): EntityId {
  const e = world.createEntity();
  world.add(e, Transform, { x: 0, z: 0, rotationY: 0 });
  world.add(e, MountGrid, { cols: 2, rows: 3, cellSize: 1, deckY: 0.66 });
  return e;
}

function container(
  world: World,
  rigId: EntityId,
  col: number,
  row: number,
  capacity = 4,
  amount = 0,
): EntityId {
  const e = world.createEntity();
  world.add(e, Transform, { x: 0, z: 0, rotationY: 0 });
  world.add(e, Part, { kind: 'storage' });
  world.add(e, Storage, { amount, capacity });
  world.add(e, Mount, { rig: rigId, col, row, yaw: 0 });
  return e;
}

function scrap(world: World, value = 1, x = 0, z = 0): EntityId {
  const e = world.createEntity();
  world.add(e, Transform, { x, z, rotationY: 0 });
  world.add(e, Collectible, { value });
  return e;
}

const pair = (a: EntityId, b: EntityId): CollisionPair => ({ a, b });

describe('scrapCollectionSystem', () => {
  it('deposits a piece into the rig storage and removes the scrap', () => {
    const world = new World();
    const r = rig(world);
    const c = container(world, r, 0, 0);
    const s = scrap(world);

    const result = scrapCollectionSystem(world, [pair(r, s)]);

    expect(result.collected).toEqual([{ x: 0, z: 0, value: 1 }]);
    expect(result.refused).toEqual([]);
    expect(world.isAlive(s)).toBe(false);
    expect(world.get(c, Storage)!.amount).toBe(1);
  });

  it('reports each collected piece at its world spot with its value (for the "+N" pop)', () => {
    const world = new World();
    const r = rig(world);
    container(world, r, 0, 0);
    const s = scrap(world, 2, 3, -2); // value 2, sitting at (3, -2)

    const result = scrapCollectionSystem(world, [pair(r, s)]);

    // The spot is captured BEFORE the scrap is destroyed, so the pop lands where it was picked up.
    expect(result.collected).toEqual([{ x: 3, z: -2, value: 2 }]);
  });

  it('collects when scrap touches a MOUNTED PART (not just the chassis)', () => {
    const world = new World();
    const r = rig(world);
    const c = container(world, r, 0, 0); // the mounted part the scrap touches
    const s = scrap(world);

    scrapCollectionSystem(world, [pair(c, s)]); // contact is part×scrap, not rig×scrap
    expect(world.get(c, Storage)!.amount).toBe(1);
    expect(world.isAlive(s)).toBe(false);
  });

  it('fills the FRONT-LEFT container first (row, then col order)', () => {
    const world = new World();
    const r = rig(world);
    const back = container(world, r, 0, 2); // row 2 = back
    const frontRight = container(world, r, 1, 0); // row 0, col 1
    const frontLeft = container(world, r, 0, 0); // row 0, col 0 — should win
    const s = scrap(world);

    scrapCollectionSystem(world, [pair(r, s)]);

    expect(world.get(frontLeft, Storage)!.amount).toBe(1);
    expect(world.get(frontRight, Storage)!.amount).toBe(0);
    expect(world.get(back, Storage)!.amount).toBe(0);
  });

  it('cascades to the next container once the first is full', () => {
    const world = new World();
    const r = rig(world);
    const first = container(world, r, 0, 0, 4, 4); // already full
    const second = container(world, r, 1, 0, 4, 0);

    scrapCollectionSystem(world, [pair(r, scrap(world))]);

    expect(world.get(first, Storage)!.amount).toBe(4); // untouched
    expect(world.get(second, Storage)!.amount).toBe(1);
  });

  it('leaves scrap in the world when every container is full', () => {
    const world = new World();
    const r = rig(world);
    container(world, r, 0, 0, 4, 4);
    container(world, r, 1, 0, 4, 4);
    const s = scrap(world, 1, 5, 5);

    const result = scrapCollectionSystem(world, [pair(r, s)]);

    expect(result.collected).toEqual([]);
    expect(result.refused).toEqual([{ id: s, x: 5, z: 5 }]); // reported (id + spot) for the "NO SPACE" cue
    expect(world.isAlive(s)).toBe(true); // still there to pick up later
  });

  it('leaves — and reports as refused — scrap when the rig has no storage mounted', () => {
    const world = new World();
    const r = rig(world);
    const s = scrap(world, 1, -4, 7);

    const result = scrapCollectionSystem(world, [pair(r, s)]);

    expect(result.collected).toEqual([]);
    expect(result.refused).toEqual([{ id: s, x: -4, z: 7 }]);
    expect(world.isAlive(s)).toBe(true);
  });

  it('never overfills a container (atomic deposit clamps at capacity)', () => {
    const world = new World();
    const r = rig(world);
    const c = container(world, r, 0, 0, 4, 3);
    scrapCollectionSystem(world, [pair(r, scrap(world, 5))]); // value 5 into room-for-1
    expect(world.get(c, Storage)!.amount).toBe(4);
  });

  it('collects a piece only once even if it touches several rig colliders', () => {
    const world = new World();
    const r = rig(world);
    const c0 = container(world, r, 0, 0);
    const c1 = container(world, r, 1, 0);
    const s = scrap(world);

    // Same scrap overlaps the chassis AND both containers this frame.
    const result = scrapCollectionSystem(world, [pair(r, s), pair(c0, s), pair(c1, s)]);

    const total = world.get(c0, Storage)!.amount + world.get(c1, Storage)!.amount;
    expect(total).toBe(1); // exactly one unit collected, not three
    expect(result.collected).toHaveLength(1); // and reported once, not once per contact
    expect(world.isAlive(s)).toBe(false);
  });

  it('reports a piece refused by one rig but taken by another as collected, not refused', () => {
    const world = new World();
    const full = rig(world);
    container(world, full, 0, 0, 4, 4); // this rig has no room
    const roomy = rig(world);
    container(world, roomy, 0, 0, 4, 0); // this one does
    const s = scrap(world);

    // The same piece touches the full rig first (refused) then the roomy one (taken) in one frame.
    const result = scrapCollectionSystem(world, [pair(full, s), pair(roomy, s)]);

    expect(result.collected).toHaveLength(1);
    expect(result.refused).toEqual([]); // not double-reported as both taken and left behind
  });

  it('ignores a loose container (not mounted) as a collector', () => {
    const world = new World();
    const loose = world.createEntity();
    world.add(loose, Transform, { x: 0, z: 0, rotationY: 0 });
    world.add(loose, Part, { kind: 'storage' });
    world.add(loose, Storage, { amount: 0, capacity: 4 }); // no Mount → not on a rig
    const s = scrap(world);

    scrapCollectionSystem(world, [pair(loose, s)]);

    expect(world.get(loose, Storage)!.amount).toBe(0); // a loose part doesn't collect
    expect(world.isAlive(s)).toBe(true);
  });

  it('ignores scrap×scrap pairs', () => {
    const world = new World();
    const s1 = scrap(world);
    const s2 = scrap(world);
    const result = scrapCollectionSystem(world, [pair(s1, s2)]);
    expect(result.collected).toEqual([]);
    expect(result.refused).toEqual([]);
    expect(world.isAlive(s1)).toBe(true);
    expect(world.isAlive(s2)).toBe(true);
  });
});
