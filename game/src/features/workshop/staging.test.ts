import { describe, it, expect } from 'vitest';
import { World } from '@core/world';
import { Inventory, inventoryItems, addToInventory } from '@features/economy/inventory';
import { Transform } from '@common/components/transform';
import { Renderable } from '@common/components/renderable';
import { Collider } from '@common/components/collider';
import { MountGrid } from '@common/components/mount-grid';
import { WorkshopZone } from '@features/workshop/workshop-zone';
import { Mount } from '@common/components/mount';
import { Assembly } from '@common/components/assembly';
import { spawnCatalogPart, partDef } from '@common/parts/parts-catalog';
import { engineParts } from '@features/engine/engines';
import { ENGINE_RECIPE, chassisRecipeForSize } from '@common/parts/recipes';
import { composeProduct } from '@common/sim/assembly';
import { chassisParts } from '@features/chassis/chassis';
import { partAtCell } from '@features/mounting/mounting';
import {
  workshopEntity,
  stagedProducts,
  stageProduct,
  unstageProduct,
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

/** A composed 1×3 chassis kit (a 2×2-footprint product), placed in inventory. */
function ownedKit(world: World) {
  const product = composeProduct(world, chassisRecipeForSize('1x3'), chassisParts('1x3'));
  addToInventory(world, product);
  return product;
}

const KIT_CELLS = [[0, 0], [1, 0], [0, 1], [1, 1]] as const;

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
    const part = spawnCatalogPart(world, partDef('e-casing')!);
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

describe('staging — a 2×2 chassis kit', () => {
  it('stages the kit reserving all four of its cells', () => {
    const { world, workshop } = setup();
    const kit = ownedKit(world);

    expect(stageProduct(world, kit, workshop, 0, 0)).toBe(true);
    for (const [c, r] of KIT_CELLS) expect(partAtCell(world, workshop, c, r)).toBe(kit);
    expect(inventoryItems(world)).not.toContain(kit);
  });

  it('refuses a product that would overlap the staged kit, but accepts a free corner', () => {
    const { world, workshop } = setup();
    stageProduct(world, ownedKit(world), workshop, 0, 0); // reserves (0,0),(1,0),(0,1),(1,1)
    const engine = ownedEngine(world);
    expect(stageProduct(world, engine, workshop, 1, 1)).toBe(false); // inside the block
    expect(stageProduct(world, engine, workshop, 2, 2)).toBe(true); // a free corner cell
  });

  it('refuses a kit whose 2×2 block would spill off the 3×3 deck', () => {
    const { world, workshop } = setup();
    expect(stageProduct(world, ownedKit(world), workshop, 2, 2)).toBe(false); // 2×2 from (2,2) is off-grid
  });

  it('unstaging a kit frees all four cells and returns it to inventory', () => {
    const { world, workshop } = setup();
    const kit = ownedKit(world);
    stageProduct(world, kit, workshop, 0, 0);

    unstageProduct(world, kit);

    for (const [c, r] of KIT_CELLS) expect(partAtCell(world, workshop, c, r)).toBeUndefined();
    expect(inventoryItems(world)).toContain(kit);
  });
});
