import { describe, it, expect } from 'vitest';
import { World } from '../core/world';
import { Inventory, inventoryItems, addToInventory } from '../components/inventory';
import { Transform } from '../components/transform';
import { Renderable } from '../components/renderable';
import { Collider } from '../components/collider';
import { MountGrid } from '../components/mount-grid';
import { WorkshopZone } from '../components/workshop-zone';
import { Mount } from '../components/mount';
import { Assembly } from '../components/assembly';
import { spawnEnginePart, partDef } from '../content/parts-catalog';
import { engineParts } from '../content/engines';
import { ENGINE_RECIPE } from '../content/recipes';
import { composeProduct } from './assembly';
import { partAtCell } from './mounting';
import {
  workshopEntity,
  stagedProducts,
  stageProduct,
  unstageProduct,
  nearestFreeWorkshopCell,
} from './staging';

/** A world wired like main.ts: an inventory singleton + a workshop (a 3×3 deck with a zone). */
function setup() {
  const world = new World();
  world.add(world.createEntity(), Inventory, { items: [] });
  const workshop = world.createEntity();
  world.add(workshop, Transform, { x: 0, z: 8, rotationY: 0 });
  world.add(workshop, MountGrid, { cols: 3, rows: 3, cellSize: 1, deckY: 0.2 });
  world.add(workshop, WorkshopZone, { radius: 3.5, active: false });
  return { world, workshop };
}

/** A composed electric engine, placed in inventory (the normal pre-stage home). */
function ownedEngine(world: World) {
  const product = composeProduct(world, ENGINE_RECIPE, engineParts('electric'));
  addToInventory(world, product);
  return product;
}

describe('staging — workshop lookup', () => {
  it('finds the workshop (MountGrid + WorkshopZone), not a bare grid', () => {
    const { world, workshop } = setup();
    world.add(world.createEntity(), MountGrid, { cols: 2, rows: 3, cellSize: 1, deckY: 0.2 }); // a rig-like grid
    expect(workshopEntity(world)).toBe(workshop);
  });
});

describe('staging — stage', () => {
  it('moves a product from inventory onto a workshop cell, gaining world presence', () => {
    const { world, workshop } = setup();
    const product = ownedEngine(world);

    expect(stageProduct(world, product, workshop, 1, 1)).toBe(true);

    expect(inventoryItems(world)).not.toContain(product); // left inventory
    expect(partAtCell(world, workshop, 1, 1)).toBe(product); // mounted on the cell
    expect(world.get(product, Mount)!.rig).toBe(workshop);
    expect(world.has(product, Transform)).toBe(true); // gained presence
    expect(world.has(product, Renderable)).toBe(true);
    expect(world.has(product, Collider)).toBe(true);
    expect(stagedProducts(world, workshop)).toEqual([product]);
  });

  it('refuses a loose sub-part (only assembled products stage)', () => {
    const { world, workshop } = setup();
    const part = spawnEnginePart(world, partDef('e-casing')!);
    addToInventory(world, part);
    expect(stageProduct(world, part, workshop, 1, 1)).toBe(false);
    expect(inventoryItems(world)).toContain(part); // untouched
    expect(world.has(part, Assembly)).toBe(false);
  });

  it('refuses an occupied cell', () => {
    const { world, workshop } = setup();
    const a = ownedEngine(world);
    const b = ownedEngine(world);
    expect(stageProduct(world, a, workshop, 1, 1)).toBe(true);
    expect(stageProduct(world, b, workshop, 1, 1)).toBe(false);
    expect(inventoryItems(world)).toContain(b);
  });
});

describe('staging — unstage', () => {
  it('returns a staged product to inventory and strips its world presence (conserved)', () => {
    const { world, workshop } = setup();
    const product = ownedEngine(world);
    stageProduct(world, product, workshop, 0, 0);

    unstageProduct(world, product);

    expect(inventoryItems(world)).toContain(product); // back in inventory
    expect(world.has(product, Mount)).toBe(false); // unmounted
    expect(world.has(product, Transform)).toBe(false); // presence stripped
    expect(world.has(product, Renderable)).toBe(false);
    expect(world.has(product, Collider)).toBe(false);
    expect(world.has(product, Assembly)).toBe(true); // still a product — same entity
    expect(stagedProducts(world, workshop)).toEqual([]);
  });

  it('round-trips: stage then unstage leaves the inventory exactly as it started', () => {
    const { world, workshop } = setup();
    const product = ownedEngine(world);
    const before = inventoryItems(world);
    stageProduct(world, product, workshop, 2, 2);
    unstageProduct(world, product);
    expect(inventoryItems(world)).toEqual(before);
  });
});

describe('staging — nearest free cell', () => {
  it('picks the cell under a deck-local point', () => {
    const { world, workshop } = setup();
    // 3×3, cellSize 1, centred: local (0,0) is the centre cell (col 1, row 1).
    expect(nearestFreeWorkshopCell(world, workshop, 0, 0)).toEqual({ col: 1, row: 1 });
    expect(nearestFreeWorkshopCell(world, workshop, -1, -1)).toEqual({ col: 0, row: 0 });
  });

  it('skips an occupied cell, returning the nearest free one', () => {
    const { world, workshop } = setup();
    stageProduct(world, ownedEngine(world), workshop, 1, 1); // occupy the centre
    const cell = nearestFreeWorkshopCell(world, workshop, 0, 0);
    expect(cell).not.toBeNull();
    expect(cell).not.toEqual({ col: 1, row: 1 }); // not the taken centre
  });

  it('returns null when every cell is taken', () => {
    const { world, workshop } = setup();
    for (let col = 0; col < 3; col++) {
      for (let row = 0; row < 3; row++) stageProduct(world, ownedEngine(world), workshop, col, row);
    }
    expect(nearestFreeWorkshopCell(world, workshop, 0, 0)).toBeNull();
  });
});
