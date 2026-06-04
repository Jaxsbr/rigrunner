import { describe, it, expect } from 'vitest';
import { World } from '@core/world';
import { Part } from '@common/components/part';
import { Weight } from '@common/components/weight';
import { Chassis } from '@common/components/chassis';
import { MountGrid } from '@common/components/mount-grid';
import { Mount } from '@common/components/mount';
import { Transform } from '@common/components/transform';
import { Collider } from '@common/components/collider';
import { Drivetrain } from '@features/drive/drivetrain';
import { DriveControl } from '@features/drive/drive-control';
import { Velocity } from '@features/drive/velocity';
import { Renderable } from '@common/components/renderable';
import { chassisRecipeForSize, ENGINE_RECIPE, STORAGE_RECIPE } from '@common/parts/recipes';
import { partDef } from '@common/parts/parts-catalog';
import { composeProduct } from '@common/sim/assembly';
import { engineParts } from '@features/engine/engines';
import { mountPart, withinEngineCapacity } from '@features/mounting/mounting';
import { chassisParts } from './chassis';
import { spawnRig, chassisToRig } from '@features/mounting/rig';

const engine = (w: World) => composeProduct(w, ENGINE_RECIPE, engineParts('electric'));
const container = (w: World) =>
  composeProduct(w, STORAGE_RECIPE, ['container-shell', 'container-rim'].map((id) => partDef(id)!));

describe('chassisParts', () => {
  it('picks the three size-matched sub-parts in recipe-slot order', () => {
    const parts = chassisParts('1x3');
    expect(parts.map((p) => p.id)).toEqual(['wheel-axle-1x3', 'suspension-steering-1x3', 'frame-1x3']);
    expect(parts.every((p) => p.category === 'chassis')).toBe(true);
  });
});

describe('composing a chassis', () => {
  it('stamps the 1×3 Chassis spec, deck grid and summed mass', () => {
    const w = new World();
    const c = composeProduct(w, chassisRecipeForSize('1x3'), chassisParts('1x3'));

    expect(w.get(c, Part)!.kind).toBe('chassis');
    expect(w.get(c, Part)!.footprint).toEqual({ cols: 2, rows: 2 }); // composed as a packed 2×2 kit
    expect(w.get(c, Chassis)).toMatchObject({
      size: '1x3', engineMin: 1, engineMax: 2, topSpeed: 12, turning: 8, loadCapacity: 24,
    });
    // Deck dimensions come from the recipe, not the sub-parts.
    expect(w.get(c, MountGrid)).toMatchObject({ cols: 1, rows: 3, cellSize: 1, deckY: 0.66 });
    // Mass is summed from the sub-parts (3 + 2 + 6).
    expect(w.get(c, Weight)!.value).toBe(11);
  });

  it('stamps the larger 3×5 Chassis spec, deck grid and mass', () => {
    const w = new World();
    const c = composeProduct(w, chassisRecipeForSize('3x5'), chassisParts('3x5'));

    expect(w.get(c, Chassis)).toMatchObject({
      size: '3x5', engineMin: 3, engineMax: 6, topSpeed: 16, turning: 5, loadCapacity: 60,
    });
    expect(w.get(c, MountGrid)).toMatchObject({ cols: 3, rows: 5 });
    expect(w.get(c, Weight)!.value).toBe(26); // 7 + 5 + 14
  });
});

describe('spawnRig', () => {
  it('builds a drivable rig around a 1×3 chassis by default', () => {
    const w = new World();
    const rig = spawnRig(w);

    // Chassis-derived: deck + spec come from the composed chassis.
    expect(w.get(rig, Chassis)!.size).toBe('1x3');
    expect(w.get(rig, MountGrid)).toMatchObject({ cols: 1, rows: 3 });
    // Drive/world components bolted on to make it drivable.
    expect(w.get(rig, Drivetrain)).toBeDefined();
    expect(w.get(rig, DriveControl)).toBeDefined();
    expect(w.get(rig, Renderable)).toMatchObject({ shape: 'model', assetId: 'chassis-1x3' });
    expect(w.get(rig, Part)!.footprint).toBeUndefined(); // a rig is not a 2×2 kit
  });

  it('builds a 3×5 rig when asked', () => {
    const w = new World();
    const rig = spawnRig(w, 0, 0, '3x5');
    expect(w.get(rig, Chassis)!.engineMax).toBe(6);
    expect(w.get(rig, MountGrid)).toMatchObject({ cols: 3, rows: 5 });
    expect(w.get(rig, Renderable)).toMatchObject({ shape: 'model', assetId: 'chassis-3x5' });
  });
});

describe('engine-capacity gate', () => {
  it('admits engines up to the 1×3 cap (2), then refuses a third even over a free cell', () => {
    const w = new World();
    const rig = spawnRig(w); // 1×3 → engineMax 2

    const e1 = engine(w);
    expect(withinEngineCapacity(w, rig, e1)).toBe(true);
    mountPart(w, e1, rig, 0, 0);

    const e2 = engine(w);
    expect(withinEngineCapacity(w, rig, e2)).toBe(true);
    mountPart(w, e2, rig, 0, 1);

    // At the cap: a third is refused though cell (0,2) is still free.
    expect(withinEngineCapacity(w, rig, engine(w))).toBe(false);
  });

  it('never caps a non-engine part', () => {
    const w = new World();
    const rig = spawnRig(w);
    mountPart(w, engine(w), rig, 0, 0);
    mountPart(w, engine(w), rig, 0, 1); // rig at the engine cap
    expect(withinEngineCapacity(w, rig, container(w))).toBe(true);
  });
});

describe('chassisToRig', () => {
  it('turns a composed (staged) chassis product into a drivable rig and clears its kit footprint', () => {
    const w = new World();
    const chassis = composeProduct(w, chassisRecipeForSize('1x3'), chassisParts('1x3'));
    // Stand in for "staged on a deck": it carries a Mount and the 2×2 footprint before deploying.
    mountPart(w, chassis, w.createEntity(), 0, 0);
    expect(w.get(chassis, Part)!.footprint).toEqual({ cols: 2, rows: 2 });

    const rig = chassisToRig(w, chassis, 5, -3);
    expect(rig).toBe(chassis); // the same entity becomes the rig

    expect(w.get(chassis, Transform)).toMatchObject({ x: 5, z: -3, y: 0 });
    expect(w.get(chassis, Drivetrain)).toBeDefined();
    expect(w.get(chassis, DriveControl)).toBeDefined();
    expect(w.get(chassis, Velocity)).toBeDefined();
    expect(w.get(chassis, Collider)).toMatchObject({ radius: 1.0 });
    expect(w.get(chassis, Renderable)).toMatchObject({ shape: 'model', assetId: 'chassis-1x3' });
    expect(w.has(chassis, Mount)).toBe(false); // no longer staged
    expect(w.get(chassis, Part)!.footprint).toBeUndefined(); // a rig is never mounted on a grid
    // The chassis spec + deck survive — deploying is a transform, not a rebuild.
    expect(w.get(chassis, Chassis)!.size).toBe('1x3');
    expect(w.get(chassis, MountGrid)).toMatchObject({ cols: 1, rows: 3 });
  });

  it('sizes the 3×5 rig collider and asset from its chassis', () => {
    const w = new World();
    const chassis = composeProduct(w, chassisRecipeForSize('3x5'), chassisParts('3x5'));
    chassisToRig(w, chassis, 0, 0);
    expect(w.get(chassis, Collider)).toMatchObject({ radius: 1.9 });
    expect(w.get(chassis, Renderable)).toMatchObject({ shape: 'model', assetId: 'chassis-3x5' });
  });
});
