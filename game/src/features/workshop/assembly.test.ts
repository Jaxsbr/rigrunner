import { describe, it, expect } from 'vitest';
import { World } from '@core/world';
import { Inventory, inventoryItems, addToInventory } from '@features/economy/inventory';
import { Bench, emptyBenchSlots, placeOnBench, benchSlots, loadRecipe } from '@features/workshop/bench';
import { Part } from '@common/components/part';
import { Weight } from '@common/components/weight';
import { EngineSpec } from '@common/components/engine-spec';
import { Storage } from '@common/components/storage';
import { Assembly } from '@common/components/assembly';
import { Transform } from '@common/components/transform';
import { Renderable } from '@common/components/renderable';
import { Collider } from '@common/components/collider';
import { MountFacing } from '@common/components/mount-facing';
import { partDef, spawnCatalogPart } from '@common/parts/parts-catalog';
import { engineParts } from '@features/engine/engines';
import { ENGINE_RECIPE, STORAGE_RECIPE, RECLAIMER_RECIPE } from '@common/parts/recipes';
import { CONTAINER_CAPACITY } from '@common/components/storage';
import {
  sumPartStats,
  resolveEnergyType,
  composeProduct,
  isProduct,
} from '@common/sim/assembly';
import {
  benchEnergyType,
  acceptsType,
  isBenchComplete,
  assembleVerdict,
  assemble,
  placeProductInWorld,
  dismantle,
} from './assembly';

const ELECTRIC = ['e-casing', 'e-core', 'e-coupling', 'e-regulator'];
const MECHANICAL = ['m-casing', 'm-core', 'm-coupling', 'm-regulator'];
const STORAGE = ['container-shell', 'container-rim'];
const RECLAIMER = ['reclaimer-arm', 'reclaimer-bucket'];

/** A world wired like main.ts: an inventory singleton and a bench loaded with the engine recipe. */
function setup() {
  const world = new World();
  world.add(world.createEntity(), Inventory, { items: [] });
  const slots = ENGINE_RECIPE.slots.map((s) => s.slot);
  world.add(world.createEntity(), Bench, { recipeId: ENGINE_RECIPE.id, slots: emptyBenchSlots(slots) });
  return world;
}

/** Spawn a catalog part and drop it straight onto its matching bench slot. Returns the entity. */
function placeOnSlot(world: World, id: string) {
  const def = partDef(id)!;
  const e = spawnCatalogPart(world, def);
  placeOnBench(world, def.slot, e);
  return e;
}

describe('assembly — attribute summing', () => {
  it('sums a full electric set to the spec profile (power 13 / torque 8 / weight 4)', () => {
    const w = setup();
    const parts = ELECTRIC.map((id) => placeOnSlot(w, id));
    expect(sumPartStats(w, parts)).toMatchObject({ power: 13, torque: 8, weight: 4 });
  });

  it('sums a full mechanical set to the spec profile (power 8 / torque 19 / weight 8)', () => {
    const w = setup();
    const parts = MECHANICAL.map((id) => placeOnSlot(w, id));
    expect(sumPartStats(w, parts)).toMatchObject({ power: 8, torque: 19, weight: 8 });
  });

  it('ignores unresolved (non-catalog) entities when summing', () => {
    const w = setup();
    expect(sumPartStats(w, [w.createEntity()])).toEqual({
      power: 0, torque: 0, weight: 0, durability: 0, burst: 0,
    });
  });
});

describe('assembly — the no-hybrid energy rule', () => {
  it('a single-type set resolves to that type with no mismatch', () => {
    const defs = ELECTRIC.map((id) => partDef(id)!);
    expect(resolveEnergyType(defs)).toEqual({ type: 'electric', mismatch: false });
  });

  it('a mixed-type set is a mismatch (a hybrid)', () => {
    const defs = [partDef('e-casing')!, partDef('m-core')!];
    expect(resolveEnergyType(defs)).toEqual({ type: null, mismatch: true });
  });

  it('an untyped (storage) set resolves to no type and no mismatch', () => {
    const defs = STORAGE.map((id) => partDef(id)!);
    expect(resolveEnergyType(defs)).toEqual({ type: null, mismatch: false });
  });

  it('the bench reports its committed type and refuses the opposite type', () => {
    const w = setup();
    expect(benchEnergyType(w)).toBeNull(); // empty bench commits to nothing
    placeOnSlot(w, 'e-core');
    expect(benchEnergyType(w)).toBe('electric');
    expect(acceptsType(w, 'electric')).toBe(true);  // same type joins
    expect(acceptsType(w, 'mechanical')).toBe(false); // cross-type refused (won't snap)
    expect(acceptsType(w, undefined)).toBe(true);     // untyped never clashes
  });
});

describe('assembly — completeness + verdict', () => {
  it('is incomplete until every recipe slot is filled', () => {
    const w = setup();
    expect(isBenchComplete(w, ENGINE_RECIPE)).toBe(false);
    ELECTRIC.forEach((id) => placeOnSlot(w, id));
    expect(isBenchComplete(w, ENGINE_RECIPE)).toBe(true);
  });

  it('refuses to assemble an incomplete bench with a readable reason', () => {
    const w = setup();
    placeOnSlot(w, 'e-core');
    const v = assembleVerdict(w, ENGINE_RECIPE);
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/fill all/i);
  });
});

describe('assembly — assembling an engine', () => {
  it('turns four same-type parts into one complete engine, conserved', () => {
    const w = setup();
    const parts = ELECTRIC.map((id) => placeOnSlot(w, id));
    const product = assemble(w, ENGINE_RECIPE)!;

    expect(product).toBeDefined();
    expect(w.get(product, Part)).toEqual({ kind: 'engine' });
    expect(w.get(product, EngineSpec)).toEqual({ power: 13, torque: 8 });
    expect(w.get(product, Weight)).toEqual({ value: 4 });
    expect(w.get(product, Assembly)).toEqual({ recipeId: 'engine', parts, type: 'electric' });
    expect(isProduct(w, product)).toBe(true);

    // The bench is emptied and the parts live on, owned by the product (off the bench, not loose).
    expect(benchSlots(w)).toEqual({ casing: null, core: null, coupling: null, regulator: null });
    expect(parts.every((p) => w.isAlive(p))).toBe(true);

    // The product (not the loose parts) is the one owned inventory item.
    expect(inventoryItems(w)).toEqual([product]);
  });

  it('refuses to assemble a mixed-type (hybrid) bench', () => {
    const w = setup();
    placeOnSlot(w, 'e-casing');
    placeOnSlot(w, 'm-core'); // a mechanical part among electric → hybrid
    placeOnSlot(w, 'e-coupling');
    placeOnSlot(w, 'e-regulator');
    expect(assembleVerdict(w, ENGINE_RECIPE).ok).toBe(false);
    expect(assemble(w, ENGINE_RECIPE)).toBeNull();
    expect(inventoryItems(w)).toEqual([]); // nothing produced
  });

  it('refuses to assemble an incomplete bench', () => {
    const w = setup();
    placeOnSlot(w, 'e-core');
    expect(assemble(w, ENGINE_RECIPE)).toBeNull();
  });
});

describe('assembly — assembling a non-engine product (storage container)', () => {
  it('assembles the storage recipe into a container with Storage, no EngineSpec, no type', () => {
    const w = setup();
    loadRecipe(w, STORAGE_RECIPE.id, STORAGE_RECIPE.slots.map((s) => s.slot));
    STORAGE.forEach((id) => placeOnSlot(w, id));

    const product = assemble(w, STORAGE_RECIPE)!;
    expect(w.get(product, Part)).toEqual({ kind: 'storage' });
    expect(w.get(product, Storage)).toEqual({ amount: 0, capacity: CONTAINER_CAPACITY });
    expect(w.get(product, EngineSpec)).toBeUndefined();
    expect(w.get(product, Weight)).toEqual({ value: 4 }); // shell 3 + rim 1
    expect(w.get(product, Assembly)!.type).toBeUndefined(); // untyped product
    expect(inventoryItems(w)).toEqual([product]);
  });
});

describe('assembly — assembling the Reclaimer (the non-engine socket grammar)', () => {
  it('assembles arm + head into a reclaimer product: weight only, no EngineSpec/Storage, untyped', () => {
    const w = setup();
    loadRecipe(w, RECLAIMER_RECIPE.id, RECLAIMER_RECIPE.slots.map((s) => s.slot));
    const parts = RECLAIMER.map((id) => placeOnSlot(w, id));

    const product = assemble(w, RECLAIMER_RECIPE)!;
    expect(w.get(product, Part)).toEqual({ kind: 'reclaimer' });
    expect(w.get(product, Weight)).toEqual({ value: 8 }); // arm 5 + bucket 3
    expect(w.get(product, EngineSpec)).toBeUndefined(); // it does no engine work
    expect(w.get(product, Storage)).toBeUndefined(); // it is not a container
    expect(w.get(product, Assembly)).toEqual({ recipeId: 'reclaimer', parts }); // untyped — no `type`
    expect(inventoryItems(w)).toEqual([product]);
  });

  it('mounts directionally — placeProductInWorld gives it outward facing and the arm GLB', () => {
    const w = setup();
    loadRecipe(w, RECLAIMER_RECIPE.id, RECLAIMER_RECIPE.slots.map((s) => s.slot));
    RECLAIMER.forEach((id) => placeOnSlot(w, id));
    const reclaimer = assemble(w, RECLAIMER_RECIPE)!;

    placeProductInWorld(w, reclaimer, 2, 4);

    // The Reclaimer renders its articulated arm GLB (render layer attaches the bucket on the wrist).
    expect(w.get(reclaimer, Renderable)).toMatchObject({ shape: 'model', assetId: 'reclaimer-arm' });
    // Directional like an engine: its front (the arm) points off the rig.
    expect(w.get(reclaimer, MountFacing)).toMatchObject({ kind: 'specific', rule: 'outward' });
    expect(w.get(reclaimer, Collider)).toBeDefined();
  });
});

describe('assembly — composeProduct seeds a product outside the bench', () => {
  it('composes an electric engine identical to a bench-assembled one, not added to inventory', () => {
    const w = setup();
    const engine = composeProduct(w, ENGINE_RECIPE, engineParts('electric'));

    expect(w.get(engine, Part)).toEqual({ kind: 'engine' });
    expect(w.get(engine, EngineSpec)).toEqual({ power: 13, torque: 8 });
    expect(w.get(engine, Weight)).toEqual({ value: 4 });
    expect(w.get(engine, Assembly)!.type).toBe('electric');
    expect(w.get(engine, Assembly)!.parts).toHaveLength(4);
    // It seeds itself directly — it is NOT placed in inventory, and has no world presence yet.
    expect(inventoryItems(w)).toEqual([]);
    expect(w.get(engine, Transform)).toBeUndefined();
    expect(w.get(engine, Renderable)).toBeUndefined();
  });

  it('composes a mechanical engine to its profile (power 8 / torque 19 / weight 8)', () => {
    const w = setup();
    const engine = composeProduct(w, ENGINE_RECIPE, engineParts('mechanical'));
    expect(w.get(engine, EngineSpec)).toEqual({ power: 8, torque: 19 });
    expect(w.get(engine, Weight)).toEqual({ value: 8 });
    expect(w.get(engine, Assembly)!.type).toBe('mechanical');
  });
});

describe('assembly — placeProductInWorld gives a product world presence', () => {
  it('adds Transform/Renderable/Collider + an engine MountFacing, and drops it from inventory', () => {
    const w = setup();
    const engine = composeProduct(w, ENGINE_RECIPE, engineParts('electric'));
    addToInventory(w, engine);
    expect(inventoryItems(w)).toEqual([engine]);

    placeProductInWorld(w, engine, 3, 5);

    expect(w.get(engine, Transform)).toMatchObject({ x: 3, z: 5, y: 0 });
    const r = w.get(engine, Renderable)!;
    expect(r).toMatchObject({ shape: 'model', assetId: 'engine-mk2' }); // electric → mk2 stand-in
    expect(w.get(engine, Collider)).toBeDefined();
    expect(w.get(engine, MountFacing)).toMatchObject({ kind: 'specific', rule: 'outward' });
    expect(inventoryItems(w)).toEqual([]); // left inventory — a product is in exactly one place
  });

  it('a storage product gets no MountFacing and renders via its recipe id', () => {
    const w = setup();
    loadRecipe(w, STORAGE_RECIPE.id, STORAGE_RECIPE.slots.map((s) => s.slot));
    STORAGE.forEach((id) => placeOnSlot(w, id));
    const container = assemble(w, STORAGE_RECIPE)!;

    placeProductInWorld(w, container, 0, 0);

    expect(w.get(container, Renderable)).toMatchObject({ shape: 'model', assetId: 'storage' });
    expect(w.get(container, MountFacing)).toBeUndefined(); // a container has no directional facing
  });
});

describe('assembly — dismantle is the conserved reverse', () => {
  it('hands the same parts back to inventory and destroys the product', () => {
    const w = setup();
    const parts = ELECTRIC.map((id) => placeOnSlot(w, id));
    const product = assemble(w, ENGINE_RECIPE)!;

    const returned = dismantle(w, product)!;
    expect(returned).toEqual(parts); // the very same entities
    expect(w.isAlive(product)).toBe(false); // product gone
    expect(parts.every((p) => w.isAlive(p))).toBe(true); // parts conserved
    expect(inventoryItems(w).sort()).toEqual([...parts].sort()); // back in inventory, product removed
  });

  it('returns null for an entity that is not a product', () => {
    const w = setup();
    expect(dismantle(w, w.createEntity())).toBeNull();
  });
});
