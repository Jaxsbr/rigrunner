import { describe, it, expect } from 'vitest';
import { World } from '@core/world';
import type { EntityId } from '@core/types';
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
import { chassisRecipeForSize, ELECTRIC_ENGINE_RECIPE, STORAGE_RECIPE } from '@common/parts/recipes';
import { partDef } from '@common/parts/parts-catalog';
import { composeProduct } from '@common/sim/assembly';
import { engineParts } from '@features/engine/engines';
import { mountPart, withinEngineCapacity } from '@features/mounting/mounting';
import { chassisParts } from './chassis';
import {
  ActiveRig,
  PlayerChassis,
  ownedChassis,
  getActiveRig,
  markOwned,
  setActiveRig,
  MAX_OWNED,
} from './ownership';
import { Deploying } from './deploying';
import {
  spawnRig,
  chassisToRig,
  chassisToKit,
  deployChassis,
  canPackUp,
  packUpChassis,
} from '@features/mounting/rig';

const engine = (w: World) => composeProduct(w, ELECTRIC_ENGINE_RECIPE, engineParts('electric'));
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

describe('deployChassis', () => {
  it('converts a hauled-out kit to a rig and registers it owned, without switching control', () => {
    const w = new World();
    const kit = composeProduct(w, chassisRecipeForSize('1x3'), chassisParts('1x3'));

    expect(deployChassis(w, kit, 4, 5)).toBe(true);
    expect(w.get(kit, DriveControl)).toBeDefined(); // it's a drivable rig now
    expect(w.get(kit, Renderable)).toMatchObject({ assetId: 'chassis-1x3' });
    expect(ownedChassis(w)).toContain(kit); // registered as owned
    expect(getActiveRig(w)).toBeNull(); // deploying does NOT move control to the new chassis
    expect(w.get(kit, Deploying)).toMatchObject({ since: 0 }); // marked for the unfold animation
  });

  it('refuses to deploy past MAX_OWNED, leaving the kit unconverted', () => {
    const w = new World();
    for (let i = 0; i < MAX_OWNED; i++) markOwned(w, w.createEntity()); // fill the cap
    const kit = composeProduct(w, chassisRecipeForSize('1x3'), chassisParts('1x3'));

    expect(deployChassis(w, kit, 0, 0)).toBe(false);
    expect(w.get(kit, DriveControl)).toBeUndefined(); // not converted
    expect(ownedChassis(w)).not.toContain(kit);
  });
});

/** Two drivable, owned 1×3 rigs with control on the first — the multi-chassis starting state. */
function twoFielded(w: World): [EntityId, EntityId] {
  const a = spawnRig(w, 0, 0);
  const b = spawnRig(w, 10, 0);
  markOwned(w, a);
  markOwned(w, b);
  setActiveRig(w, a);
  return [a, b];
}

describe('chassisToKit', () => {
  it('folds a drivable rig back into a packed kit — the inverse of chassisToRig', () => {
    const w = new World();
    const rig = spawnRig(w, 7, -2); // a drivable 1×3 rig
    expect(w.get(rig, DriveControl)).toBeDefined();

    expect(chassisToKit(w, rig)).toBe(rig); // the same entity folds back

    // Drive/world components stripped.
    expect(w.has(rig, DriveControl)).toBe(false);
    expect(w.has(rig, Velocity)).toBe(false);
    expect(w.has(rig, Drivetrain)).toBe(false);
    expect(w.has(rig, Collider)).toBe(false);
    // The packed crate look + the 2×2 footprint a rig sheds, both restored.
    expect(w.get(rig, Renderable)).toMatchObject({ shape: 'model', assetId: 'chassis-kit' });
    expect(w.get(rig, Part)!.footprint).toEqual({ cols: 2, rows: 2 });
    // The chassis spec, deck and mass survive — it deploys again as the same chassis.
    expect(w.get(rig, Chassis)!.size).toBe('1x3');
    expect(w.get(rig, MountGrid)).toMatchObject({ cols: 1, rows: 3 });
    expect(w.get(rig, Weight)!.value).toBe(11);
    // Stays where the rig stood, ready to be hauled onto the workshop deck.
    expect(w.get(rig, Transform)).toMatchObject({ x: 7, z: -2 });
  });
});

describe('canPackUp', () => {
  it('allows packing an empty fielded chassis while a backup is owned', () => {
    const w = new World();
    const [a] = twoFielded(w);
    expect(canPackUp(w, a)).toBe(true);
  });

  it('refuses while the chassis still carries a mounted part (strip it bare first)', () => {
    const w = new World();
    const [a] = twoFielded(w);
    mountPart(w, engine(w), a, 0, 0);
    expect(canPackUp(w, a)).toBe(false);
  });

  it('refuses the last fielded chassis — no backup to hand control to', () => {
    const w = new World();
    const only = spawnRig(w);
    markOwned(w, only);
    setActiveRig(w, only);
    expect(canPackUp(w, only)).toBe(false);
  });

  it('refuses a chassis the player does not own', () => {
    const w = new World();
    const loose = spawnRig(w); // a rig, but never marked owned
    expect(canPackUp(w, loose)).toBe(false);
  });
});

describe('packUpChassis', () => {
  it('folds the active chassis to a kit, frees a cap slot, and hands control to the backup', () => {
    const w = new World();
    const [a, b] = twoFielded(w);

    expect(packUpChassis(w, a)).toBe(true);

    // a is a packed kit now — no longer fielded.
    expect(w.has(a, DriveControl)).toBe(false);
    expect(w.get(a, Renderable)).toMatchObject({ assetId: 'chassis-kit' });
    expect(w.get(a, Part)!.footprint).toEqual({ cols: 2, rows: 2 });
    expect(w.has(a, PlayerChassis)).toBe(false); // dropped from the owned/fielded set
    expect(ownedChassis(w)).toEqual([b]);         // freeing a slot under the cap
    // Control snapped to the backup; nothing else carries the active marker.
    expect(getActiveRig(w)).toBe(b);
    expect(w.has(a, ActiveRig)).toBe(false);
  });

  it('is a refused no-op when the gate is not met', () => {
    const w = new World();
    const [a] = twoFielded(w);
    mountPart(w, engine(w), a, 0, 0); // not empty → gate closed

    expect(packUpChassis(w, a)).toBe(false);
    expect(w.get(a, DriveControl)).toBeDefined(); // unchanged — still a drivable rig
    expect(getActiveRig(w)).toBe(a);
  });

  it('frees a slot so a third chassis can then deploy', () => {
    const w = new World();
    const [a] = twoFielded(w);
    const kit = composeProduct(w, chassisRecipeForSize('1x3'), chassisParts('1x3'));

    expect(deployChassis(w, kit, 0, 0)).toBe(false); // at the cap (2 fielded)
    packUpChassis(w, a);
    expect(deployChassis(w, kit, 3, 3)).toBe(true); // the freed slot admits it
  });
});
