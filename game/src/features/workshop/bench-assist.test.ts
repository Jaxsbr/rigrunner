import { describe, it, expect } from 'vitest';
import { World } from '@core/world';
import { Inventory, addToInventory, inventoryItems } from '@features/economy/inventory';
import { EnginePart } from '@common/parts/engine-part';
import { partDef, spawnCatalogPart } from '@common/parts/parts-catalog';
import {
  ELECTRIC_ENGINE_RECIPE,
  CHASSIS_1X3_RECIPE,
  CHASSIS_3X5_RECIPE,
  type Recipe,
} from '@common/parts/recipes';
import { Bench, emptyBenchSlots, benchSlots } from './bench';
import { autoFillBench, planAutoFillBench, recipeDefForSlot } from './bench-assist';

function setup(recipe: Recipe): World {
  const world = new World();
  const inv = world.createEntity();
  world.add(inv, Inventory, { items: [] });
  const bench = world.createEntity();
  world.add(bench, Bench, {
    recipeId: recipe.id,
    slots: emptyBenchSlots(recipe.slots.map((slot) => slot.slot)),
  });
  return world;
}

function ownedPart(world: World, id: string, tier: 'rusty' | 'iron' = 'rusty') {
  const entity = spawnCatalogPart(world, partDef(id)!, tier);
  addToInventory(world, entity);
  return entity;
}

describe('bench assist', () => {
  it('plans and fills every matching recipe slot from inventory', () => {
    const world = setup(ELECTRIC_ENGINE_RECIPE);
    ownedPart(world, 'e-casing');
    ownedPart(world, 'e-core');
    ownedPart(world, 'e-coupling');
    ownedPart(world, 'e-regulator');

    expect(planAutoFillBench(world, ELECTRIC_ENGINE_RECIPE)).toMatchObject({
      complete: true,
      missingSlots: [],
    });

    const result = autoFillBench(world, ELECTRIC_ENGINE_RECIPE);

    expect(result.complete).toBe(true);
    expect(inventoryItems(world)).toEqual([]);
    expect(Object.keys(benchSlots(world))).toEqual(['casing', 'core', 'coupling', 'regulator']);
    expect(Object.values(benchSlots(world)).every((entity) => entity !== null)).toBe(true);
  });

  it('prefers the highest owned tier for an empty slot', () => {
    const world = setup(ELECTRIC_ENGINE_RECIPE);
    const rusty = ownedPart(world, 'e-core', 'rusty');
    const iron = ownedPart(world, 'e-core', 'iron');

    autoFillBench(world, ELECTRIC_ENGINE_RECIPE);

    expect(benchSlots(world).core).toBe(iron);
    expect(inventoryItems(world)).toEqual([rusty]);
    expect(world.get(iron, EnginePart)).toEqual({ id: 'e-core', tier: 'iron' });
  });

  it('only considers chassis parts that match the active chassis recipe size', () => {
    const scout = setup(CHASSIS_1X3_RECIPE);
    ownedPart(scout, 'wheel-axle-3x5');
    ownedPart(scout, 'suspension-steering-3x5');
    ownedPart(scout, 'frame-3x5');

    expect(planAutoFillBench(scout, CHASSIS_1X3_RECIPE)).toMatchObject({
      complete: false,
      missingSlots: ['wheel-axle', 'suspension-steering', 'frame'],
    });

    const hauler = setup(CHASSIS_3X5_RECIPE);
    ownedPart(hauler, 'wheel-axle-3x5');
    ownedPart(hauler, 'suspension-steering-3x5');
    ownedPart(hauler, 'frame-3x5');

    expect(planAutoFillBench(hauler, CHASSIS_3X5_RECIPE).complete).toBe(true);
  });

  it('resolves the shop definition for a recipe slot', () => {
    expect(recipeDefForSlot(ELECTRIC_ENGINE_RECIPE, 'casing')?.id).toBe('e-casing');
    expect(recipeDefForSlot(CHASSIS_1X3_RECIPE, 'frame')?.id).toBe('frame-1x3');
    expect(recipeDefForSlot(CHASSIS_3X5_RECIPE, 'frame')?.id).toBe('frame-3x5');
  });
});
