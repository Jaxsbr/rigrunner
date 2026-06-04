import { describe, it, expect } from 'vitest';
import { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { MountGrid } from '@common/components/mount-grid';
import { Part } from '@common/components/part';
import { Mount } from '@common/components/mount';
import { Storage } from '@common/components/storage';
import { Wallet } from '@features/economy/wallet';
import { WorkshopDrain } from '@features/workshop/workshop-drain';
import { workshopDrainSystem } from './workshop-drain-system';

const INTERVAL = 0.4; // mirrors DRAIN_INTERVAL in workshop-drain.ts

function workshop(world: World): EntityId {
  const e = world.createEntity();
  world.add(e, Transform, { x: 0, z: 0, rotationY: 0 });
  world.add(e, MountGrid, { cols: 3, rows: 3, cellSize: 1, deckY: 0.2 });
  world.add(e, WorkshopDrain, { elapsed: 0 });
  return e;
}

function wallet(world: World, scrap = 0): EntityId {
  const e = world.createEntity();
  world.add(e, Wallet, { scrap });
  return e;
}

/** A storage container mounted on a workshop cell (mounted == "on the deck"). */
function container(
  world: World,
  shop: EntityId,
  col: number,
  row: number,
  amount = 4,
  capacity = 4,
): EntityId {
  const e = world.createEntity();
  world.add(e, Transform, { x: 0, z: 0, rotationY: 0 });
  world.add(e, Part, { kind: 'storage' });
  world.add(e, Storage, { amount, capacity });
  world.add(e, Mount, { rig: shop, col, row, yaw: 0 });
  return e;
}

describe('workshopDrainSystem', () => {
  it('banks one piece per interval into the wallet, lowering the container', () => {
    const world = new World();
    const shop = workshop(world);
    const c = container(world, shop, 0, 0, 4);
    const wt = wallet(world);

    workshopDrainSystem(world, INTERVAL);

    expect(world.get(c, Storage)!.amount).toBe(3);
    expect(world.get(wt, Wallet)!.scrap).toBe(1);
  });

  it('does not bank until a full interval has accrued', () => {
    const world = new World();
    const shop = workshop(world);
    const c = container(world, shop, 0, 0, 4);
    const wt = wallet(world);

    workshopDrainSystem(world, INTERVAL / 2);
    expect(world.get(wt, Wallet)!.scrap).toBe(0);
    expect(world.get(c, Storage)!.amount).toBe(4);

    workshopDrainSystem(world, INTERVAL / 2); // now a whole interval has passed across two frames
    expect(world.get(wt, Wallet)!.scrap).toBe(1);
    expect(world.get(c, Storage)!.amount).toBe(3);
  });

  it('conserves scrap: total drained equals total banked', () => {
    const world = new World();
    const shop = workshop(world);
    const c = container(world, shop, 0, 0, 4);
    const wt = wallet(world);

    for (let i = 0; i < 4; i++) workshopDrainSystem(world, INTERVAL);

    expect(world.get(c, Storage)!.amount).toBe(0);
    expect(world.get(wt, Wallet)!.scrap).toBe(4);
  });

  it('stops at empty and never goes negative or overbanks', () => {
    const world = new World();
    const shop = workshop(world);
    const c = container(world, shop, 0, 0, 2);
    const wt = wallet(world);

    for (let i = 0; i < 10; i++) workshopDrainSystem(world, INTERVAL);

    expect(world.get(c, Storage)!.amount).toBe(0);
    expect(world.get(wt, Wallet)!.scrap).toBe(2); // exactly what was in the container
  });

  it('drains SEQUENTIALLY: empties the first (deposit-order) container before the next', () => {
    const world = new World();
    const shop = workshop(world);
    const back = container(world, shop, 0, 2, 4); // row 2 = back
    const front = container(world, shop, 0, 0, 4); // row 0 = front → drains first
    wallet(world);

    // One interval: only the front container should lose a piece.
    workshopDrainSystem(world, INTERVAL);
    expect(world.get(front, Storage)!.amount).toBe(3);
    expect(world.get(back, Storage)!.amount).toBe(4);

    // Drain the front dry (3 more pieces); the back must still be untouched.
    for (let i = 0; i < 3; i++) workshopDrainSystem(world, INTERVAL);
    expect(world.get(front, Storage)!.amount).toBe(0);
    expect(world.get(back, Storage)!.amount).toBe(4);

    // Now the back starts draining.
    workshopDrainSystem(world, INTERVAL);
    expect(world.get(back, Storage)!.amount).toBe(3);
  });

  it('advances to the next container within a single long frame', () => {
    const world = new World();
    const shop = workshop(world);
    const front = container(world, shop, 0, 0, 1); // one piece
    const back = container(world, shop, 0, 1, 4);
    const wt = wallet(world);

    // A frame long enough for 3 pieces: empties front (1) then 2 from back.
    workshopDrainSystem(world, INTERVAL * 3);

    expect(world.get(front, Storage)!.amount).toBe(0);
    expect(world.get(back, Storage)!.amount).toBe(2);
    expect(world.get(wt, Wallet)!.scrap).toBe(3);
  });

  it('does not bank time while idle: a container arriving later does not dump instantly', () => {
    const world = new World();
    const shop = workshop(world);
    const wt = wallet(world);

    // Long idle stretch with nothing on the deck — elapsed must not accumulate.
    for (let i = 0; i < 5; i++) workshopDrainSystem(world, INTERVAL);
    expect(world.get(shop, WorkshopDrain)!.elapsed).toBe(0);

    // Now a full container arrives; a sub-interval frame must bank nothing yet.
    const c = container(world, shop, 0, 0, 4);
    workshopDrainSystem(world, INTERVAL / 2);
    expect(world.get(wt, Wallet)!.scrap).toBe(0);
    expect(world.get(c, Storage)!.amount).toBe(4);
  });

  it('grabbing a container off the deck mid-drain stops it, preserving its amount', () => {
    const world = new World();
    const shop = workshop(world);
    const c = container(world, shop, 0, 0, 4);
    wallet(world);

    workshopDrainSystem(world, INTERVAL); // banks 1, container down to 3
    expect(world.get(c, Storage)!.amount).toBe(3);

    world.remove(c, Mount); // "grab it off the deck" — no longer mounted on the workshop
    for (let i = 0; i < 5; i++) workshopDrainSystem(world, INTERVAL);

    expect(world.get(c, Storage)!.amount).toBe(3); // frozen at what it had left
  });

  it('no-ops when there is no wallet to bank into', () => {
    const world = new World();
    const shop = workshop(world);
    const c = container(world, shop, 0, 0, 4);

    expect(() => workshopDrainSystem(world, INTERVAL)).not.toThrow();
    expect(world.get(c, Storage)!.amount).toBe(4); // untouched — nowhere to put it
  });
});
