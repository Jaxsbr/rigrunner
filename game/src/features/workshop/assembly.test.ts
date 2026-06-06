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
import { ELECTRIC_ENGINE_RECIPE, STEAM_ENGINE_RECIPE, STORAGE_RECIPE, RECLAIMER_RECIPE, chassisRecipeForSize } from '@common/parts/recipes';
import { CONTAINER_CAPACITY } from '@common/components/storage';
import {
  sumPartStats,
  resolveEnergyType,
  composeProduct,
  isProduct,
  assetTier,
} from '@common/sim/assembly';
import {
  benchEnergyType,
  acceptsType,
  acceptsChassisPart,
  isBenchComplete,
  assembleVerdict,
  assemble,
  placeProductInWorld,
  dismantle,
} from './assembly';

const ELECTRIC = ['e-casing', 'e-core', 'e-coupling', 'e-regulator'];
const STEAM = ['s-boiler', 's-piston', 's-driveshaft', 's-throttle'];
const STORAGE = ['container-shell', 'container-rim'];
const RECLAIMER = ['reclaimer-arm', 'reclaimer-bucket'];

/** A world wired like main.ts: an inventory singleton and a bench loaded with the electric recipe. */
function setup() {
  const world = new World();
  world.add(world.createEntity(), Inventory, { items: [] });
  const slots = ELECTRIC_ENGINE_RECIPE.slots.map((s) => s.slot);
  world.add(world.createEntity(), Bench, { recipeId: ELECTRIC_ENGINE_RECIPE.id, slots: emptyBenchSlots(slots) });
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
  it('sums a full electric set to the spec profile (power 11 / torque 7 / weight 4)', () => {
    const w = setup();
    const parts = ELECTRIC.map((id) => placeOnSlot(w, id));
    expect(sumPartStats(w, parts)).toMatchObject({ power: 11, torque: 7, weight: 4 });
  });

  it('sums a full steam set to the spec profile (power 7 / torque 16 / weight 8)', () => {
    const w = setup();
    loadRecipe(w, STEAM_ENGINE_RECIPE.id, STEAM_ENGINE_RECIPE.slots.map((s) => s.slot));
    const parts = STEAM.map((id) => placeOnSlot(w, id));
    expect(sumPartStats(w, parts)).toMatchObject({ power: 7, torque: 16, weight: 8 });
  });

  it('ignores unresolved (non-catalog) entities when summing', () => {
    const w = setup();
    expect(sumPartStats(w, [w.createEntity()])).toEqual({
      power: 0, torque: 0, weight: 0, durability: 0, burst: 0,
      grip: 0, turning: 0, loadCapacity: 0, capacity: 0,
    });
  });
});

describe('assembly — tiers scale resolved stats (the per-part additive axis)', () => {
  // Spawn a sub-part at a given tier and drop it on its bench slot. Returns the entity.
  function placeOnSlotAtTier(world: World, id: string, tier: 'rusty' | 'iron') {
    const def = partDef(id)!;
    const e = spawnCatalogPart(world, def, tier);
    placeOnBench(world, def.slot, e);
    return e;
  }

  it('a rusty (tier-1) part resolves to exactly its base — the multiplier is an identity', () => {
    const w = setup();
    const shell = placeOnSlotAtTier(w, 'container-shell', 'rusty');
    // base shell: weight 3 / capacity 3 (mult 1)
    expect(sumPartStats(w, [shell])).toMatchObject({ weight: 3, capacity: 3 });
  });

  it('an iron part resolves steeper — base × ~2.2, rounded', () => {
    const w = setup();
    const shell = placeOnSlotAtTier(w, 'container-shell', 'iron');
    // base capacity 3 × 2.2 = 6.6 → 7; base weight 3 × 2.2 = 6.6 → 7
    expect(sumPartStats(w, [shell])).toMatchObject({ weight: 7, capacity: 7 });
  });

  it('a rusty-shell + iron-rim container is a valid mid-value between all-rusty and all-iron', () => {
    const w = setup();
    loadRecipe(w, STORAGE_RECIPE.id, STORAGE_RECIPE.slots.map((s) => s.slot));

    const rusty = sumPartStats(w, [
      spawnCatalogPart(w, partDef('container-shell')!, 'rusty'),
      spawnCatalogPart(w, partDef('container-rim')!, 'rusty'),
    ]);
    const iron = sumPartStats(w, [
      spawnCatalogPart(w, partDef('container-shell')!, 'iron'),
      spawnCatalogPart(w, partDef('container-rim')!, 'iron'),
    ]);
    const mixed = sumPartStats(w, [
      spawnCatalogPart(w, partDef('container-shell')!, 'rusty'), // 3
      spawnCatalogPart(w, partDef('container-rim')!, 'iron'),    // round(1 × 2.2) = 2
    ]);

    expect(rusty.capacity).toBe(4);  // 3 + 1 — the tier-1 CONTAINER_CAPACITY
    expect(iron.capacity).toBe(9);   // 7 + 2 — the steep jump that "iron holds more" is felt as
    expect(mixed.capacity).toBe(5);  // 3 + 2 — strictly between, no special blending logic
    expect(rusty.capacity).toBeLessThan(mixed.capacity!);
    expect(mixed.capacity).toBeLessThan(iron.capacity!);
  });

  it('builds an iron container whose Storage capacity is the tier-scaled sum (iron holds more)', () => {
    const w = setup();
    loadRecipe(w, STORAGE_RECIPE.id, STORAGE_RECIPE.slots.map((s) => s.slot));
    placeOnSlotAtTier(w, 'container-shell', 'iron');
    placeOnSlotAtTier(w, 'container-rim', 'iron');

    const container = assemble(w, STORAGE_RECIPE)!;
    expect(w.get(container, Storage)).toEqual({ amount: 0, capacity: 9 });
    // The mixed/rusty baseline is CONTAINER_CAPACITY (4), so the iron one more than doubles it.
    expect(w.get(container, Storage)!.capacity).toBeGreaterThan(CONTAINER_CAPACITY);
  });
});

describe('assembly — assetTier picks each composed piece its own grade', () => {
  function placeOnSlotAtTier(world: World, id: string, tier: 'rusty' | 'iron') {
    const def = partDef(id)!;
    const e = spawnCatalogPart(world, def, tier);
    placeOnBench(world, def.slot, e);
    return e;
  }

  it('washes a Reclaimer arm and bucket by their OWN sub-part tiers (the mixed-build fix)', () => {
    const w = setup();
    loadRecipe(w, RECLAIMER_RECIPE.id, RECLAIMER_RECIPE.slots.map((s) => s.slot));
    placeOnSlotAtTier(w, 'reclaimer-arm', 'iron');   // arm GLB: reclaimer-arm
    placeOnSlotAtTier(w, 'reclaimer-bucket', 'rusty'); // bucket GLB: reclaimer-bucket
    const reclaimer = assemble(w, RECLAIMER_RECIPE)!;

    // Each rendered sub-asset resolves to the tier of the sub-part whose asset it is — so the arm
    // shows iron, the bucket rusty, rather than collapsing to one finish or none.
    expect(assetTier(w, reclaimer, 'reclaimer-arm')).toBe('iron');
    expect(assetTier(w, reclaimer, 'reclaimer-bucket')).toBe('rusty');
  });

  it('falls back to the uniform tier for a single-asset product (its GLB is no sub-part)', () => {
    const w = setup();
    loadRecipe(w, STORAGE_RECIPE.id, STORAGE_RECIPE.slots.map((s) => s.slot));
    placeOnSlotAtTier(w, 'container-shell', 'iron');
    placeOnSlotAtTier(w, 'container-rim', 'iron');
    const iron = assemble(w, STORAGE_RECIPE)!;
    // 'storage' is not any sub-part's asset, so a uniform-iron container resolves to iron…
    expect(assetTier(w, iron, 'storage')).toBe('iron');

    const wm = setup();
    loadRecipe(wm, STORAGE_RECIPE.id, STORAGE_RECIPE.slots.map((s) => s.slot));
    placeOnSlotAtTier(wm, 'container-shell', 'rusty');
    placeOnSlotAtTier(wm, 'container-rim', 'iron');
    const mixed = assemble(wm, STORAGE_RECIPE)!;
    // …and a mixed-tier single-GLB container has no one grade for that lone asset.
    expect(assetTier(wm, mixed, 'storage')).toBeNull();
  });
});

describe('assembly — the no-hybrid energy rule', () => {
  it('a single-type set resolves to that type with no mismatch', () => {
    const defs = ELECTRIC.map((id) => partDef(id)!);
    expect(resolveEnergyType(defs)).toEqual({ type: 'electric', mismatch: false });
  });

  it('a mixed-type set is a mismatch — the resolveEnergyType backstop', () => {
    // Disjoint slot vocabularies make a hybrid bench impossible to BUILD (see below), but the
    // resolver is kept as a backstop for any other path that hands it a mixed set.
    const defs = [partDef('e-casing')!, partDef('s-piston')!];
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
    expect(acceptsType(w, 'steam')).toBe(false);    // cross-type refused (won't snap)
    expect(acceptsType(w, undefined)).toBe(true);   // untyped never clashes
  });
});

describe('assembly — completeness + verdict', () => {
  it('is incomplete until every recipe slot is filled', () => {
    const w = setup();
    expect(isBenchComplete(w, ELECTRIC_ENGINE_RECIPE)).toBe(false);
    ELECTRIC.forEach((id) => placeOnSlot(w, id));
    expect(isBenchComplete(w, ELECTRIC_ENGINE_RECIPE)).toBe(true);
  });

  it('refuses to assemble an incomplete bench with a readable reason', () => {
    const w = setup();
    placeOnSlot(w, 'e-core');
    const v = assembleVerdict(w, ELECTRIC_ENGINE_RECIPE);
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/fill all/i);
  });
});

describe('assembly — assembling an engine', () => {
  it('turns four same-type parts into one complete engine, conserved', () => {
    const w = setup();
    const parts = ELECTRIC.map((id) => placeOnSlot(w, id));
    const product = assemble(w, ELECTRIC_ENGINE_RECIPE)!;

    expect(product).toBeDefined();
    expect(w.get(product, Part)).toEqual({ kind: 'engine' });
    expect(w.get(product, EngineSpec)).toEqual({ power: 11, torque: 7 });
    expect(w.get(product, Weight)).toEqual({ value: 4 });
    expect(w.get(product, Assembly)).toEqual({ recipeId: 'electric-engine', parts, type: 'electric' });
    expect(isProduct(w, product)).toBe(true);

    // The bench is emptied and the parts live on, owned by the product (off the bench, not loose).
    expect(benchSlots(w)).toEqual({ casing: null, core: null, coupling: null, regulator: null });
    expect(parts.every((p) => w.isAlive(p))).toBe(true);

    // The product (not the loose parts) is the one owned inventory item.
    expect(inventoryItems(w)).toEqual([product]);
  });

  it('cannot form a hybrid bench at all — a steam part has no slot on the electric bench', () => {
    const w = setup(); // electric engine recipe loaded
    placeOnSlot(w, 'e-casing');
    // The steam piston's slot ('piston') isn't one of the electric recipe's roles, so placing it is
    // refused by the bench — disjoint vocabularies make a hybrid impossible to BUILD (no resolver
    // check needed). The bench stays a pure-electric, still-incomplete build.
    const piston = spawnCatalogPart(w, partDef('s-piston')!);
    expect(placeOnBench(w, partDef('s-piston')!.slot, piston)).toBe(false);
    expect(benchEnergyType(w)).toBe('electric');
    expect(assemble(w, ELECTRIC_ENGINE_RECIPE)).toBeNull(); // still incomplete
    expect(inventoryItems(w)).toEqual([]); // nothing produced
  });

  it('refuses to assemble an incomplete bench', () => {
    const w = setup();
    placeOnSlot(w, 'e-core');
    expect(assemble(w, ELECTRIC_ENGINE_RECIPE)).toBeNull();
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
    const engine = composeProduct(w, ELECTRIC_ENGINE_RECIPE, engineParts('electric'));

    expect(w.get(engine, Part)).toEqual({ kind: 'engine' });
    expect(w.get(engine, EngineSpec)).toEqual({ power: 11, torque: 7 });
    expect(w.get(engine, Weight)).toEqual({ value: 4 });
    expect(w.get(engine, Assembly)!.type).toBe('electric');
    expect(w.get(engine, Assembly)!.parts).toHaveLength(4);
    // It seeds itself directly — it is NOT placed in inventory, and has no world presence yet.
    expect(inventoryItems(w)).toEqual([]);
    expect(w.get(engine, Transform)).toBeUndefined();
    expect(w.get(engine, Renderable)).toBeUndefined();
  });

  it('composes a steam engine to its profile (power 7 / torque 16 / weight 8)', () => {
    const w = setup();
    const engine = composeProduct(w, STEAM_ENGINE_RECIPE, engineParts('steam'));
    expect(w.get(engine, EngineSpec)).toEqual({ power: 7, torque: 16 });
    expect(w.get(engine, Weight)).toEqual({ value: 8 });
    expect(w.get(engine, Assembly)!.type).toBe('steam');
  });
});

describe('assembly — placeProductInWorld gives a product world presence', () => {
  it('adds Transform/Renderable/Collider + an engine MountFacing, and drops it from inventory', () => {
    const w = setup();
    const engine = composeProduct(w, ELECTRIC_ENGINE_RECIPE, engineParts('electric'));
    addToInventory(w, engine);
    expect(inventoryItems(w)).toEqual([engine]);

    placeProductInWorld(w, engine, 3, 5);

    expect(w.get(engine, Transform)).toMatchObject({ x: 3, z: 5, y: 0 });
    const r = w.get(engine, Renderable)!;
    // The engine composes from its sub-parts through the shared assembler (the same path the viewer
    // renders by), each piece at its own tier — not a single whole-engine GLB (§2b).
    expect(r).toMatchObject({ shape: 'assembly', groupId: 'electric-engine' });
    expect((r as Extract<typeof r, { shape: 'assembly' }>).tiers).toMatchObject({
      'e-casing': 'rusty', 'e-core': 'rusty', 'e-coupling': 'rusty', 'e-regulator': 'rusty',
    });
    expect(w.get(engine, Collider)).toBeDefined();
    expect(w.get(engine, MountFacing)).toMatchObject({ kind: 'specific', rule: 'outward' });
    expect(inventoryItems(w)).toEqual([]); // left inventory — a product is in exactly one place
  });

  it('a storage product gets no MountFacing and composes from its shell + rim', () => {
    const w = setup();
    loadRecipe(w, STORAGE_RECIPE.id, STORAGE_RECIPE.slots.map((s) => s.slot));
    STORAGE.forEach((id) => placeOnSlot(w, id));
    const container = assemble(w, STORAGE_RECIPE)!;

    placeProductInWorld(w, container, 0, 0);

    expect(w.get(container, Renderable)).toMatchObject({ shape: 'assembly', groupId: 'storage' });
    expect(w.get(container, MountFacing)).toBeUndefined(); // a container has no directional facing
  });
});

describe('assembly — the chassis size-match rule', () => {
  const recipe1x3 = chassisRecipeForSize('1x3');

  it('matches a sub-part to the recipe size, and waves through everything else', () => {
    expect(acceptsChassisPart(recipe1x3, partDef('wheel-axle-1x3')!)).toBe(true);
    expect(acceptsChassisPart(recipe1x3, partDef('wheel-axle-3x5')!)).toBe(false); // wrong size
    expect(acceptsChassisPart(ELECTRIC_ENGINE_RECIPE, partDef('e-core')!)).toBe(true); // not a chassis build
    expect(acceptsChassisPart(recipe1x3, partDef('e-core')!)).toBe(true); // not a chassis part
  });

  it('flags a size-mismatched chassis bench (a 3×5 part among 1×3 parts)', () => {
    const w = setup();
    loadRecipe(w, recipe1x3.id, recipe1x3.slots.map((s) => s.slot));
    placeOnSlot(w, 'wheel-axle-1x3');
    placeOnSlot(w, 'suspension-steering-1x3');
    placeOnSlot(w, 'frame-3x5');
    const v = assembleVerdict(w, recipe1x3);
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/size/i);
  });

  it('assembles a matched 1×3 set into a 2×2-footprint chassis kit', () => {
    const w = setup();
    loadRecipe(w, recipe1x3.id, recipe1x3.slots.map((s) => s.slot));
    ['wheel-axle-1x3', 'suspension-steering-1x3', 'frame-1x3'].forEach((id) => placeOnSlot(w, id));
    expect(assembleVerdict(w, recipe1x3).ok).toBe(true);

    const kit = assemble(w, recipe1x3)!;
    expect(w.get(kit, Part)!.kind).toBe('chassis');
    expect(w.get(kit, Part)!.footprint).toEqual({ cols: 2, rows: 2 });
  });
});

describe('assembly — dismantle is the conserved reverse', () => {
  it('hands the same parts back to inventory and destroys the product', () => {
    const w = setup();
    const parts = ELECTRIC.map((id) => placeOnSlot(w, id));
    const product = assemble(w, ELECTRIC_ENGINE_RECIPE)!;

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
