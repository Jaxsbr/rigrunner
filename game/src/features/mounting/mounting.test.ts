import { describe, it, expect } from 'vitest';
import { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { MountGrid } from '@common/components/mount-grid';
import { Part } from '@common/components/part';
import { Mount } from '@common/components/mount';
import { Assembly } from '@common/components/assembly';
import type { EnergyType } from '@common/parts/parts-catalog';
import {
  cellLocalOffset,
  cellWorldPose,
  partAtCell,
  hasMountedPartKind,
  committedEngineType,
  canMountPartOn,
  closestFreeCellLocal,
  nearestMountTarget,
  outwardLocalYaw,
  leanLocalYaw,
  resolveLocalYaw,
  worldToRigLocal,
  isOverDeck,
  mountPart,
  unmountPart,
  mountingSystem,
} from './mounting';

const GRID: MountGrid = { cols: 2, rows: 3, cellSize: 1, deckY: 0.66 };

/** Direction the part's front (local −Z) points at a given local yaw (rig-local frame). */
function frontDir(localYaw: number): { x: number; z: number } {
  return { x: -Math.sin(localYaw), z: -Math.cos(localYaw) };
}

function rig(world: World, x = 0, z = 0, rotationY = 0): EntityId {
  const e = world.createEntity();
  world.add(e, Transform, { x, z, rotationY });
  world.add(e, MountGrid, { cols: 2, rows: 3, cellSize: 1, deckY: 0.66 });
  return e;
}

function enginePart(world: World, x = 0, z = 0): EntityId {
  const e = world.createEntity();
  world.add(e, Transform, { x, z, rotationY: 0, y: 0 });
  world.add(e, Part, { kind: 'engine' });
  return e;
}

/** A composed engine carrying its resolved energy type — the shape the no-hybrid lock reads. */
function typedEngine(world: World, type: EnergyType): EntityId {
  const e = world.createEntity();
  world.add(e, Transform, { x: 0, z: 0, rotationY: 0, y: 0 });
  world.add(e, Part, { kind: 'engine' });
  world.add(e, Assembly, { recipeId: 'engine', parts: [], type });
  return e;
}

describe('mounting geometry', () => {
  it('lays the 2×3 grid out centred, with row 0 toward the front (-Z)', () => {
    const grid: MountGrid = { cols: 2, rows: 3, cellSize: 1, deckY: 0.66 };
    expect(cellLocalOffset(grid, 0, 0)).toEqual({ lx: -0.5, lz: -1 }); // left, front
    expect(cellLocalOffset(grid, 1, 2)).toEqual({ lx: 0.5, lz: 1 }); // right, back
  });

  it('places a cell in the world at the deck height, offset from the rig', () => {
    const w = new World();
    const r = rig(w, 10, 5);
    const grid = w.get(r, MountGrid)!;
    const pose = cellWorldPose(w.get(r, Transform)!, grid, 1, 0); // right-front cell
    expect(pose.x).toBeCloseTo(10.5);
    expect(pose.z).toBeCloseTo(4); // front is -Z → z - 1
    expect(pose.y).toBeCloseTo(0.66);
  });

  it('rotates cell offsets with the rig heading', () => {
    const w = new World();
    const r = rig(w, 0, 0, Math.PI / 2); // yaw 90°
    const grid = w.get(r, MountGrid)!;
    // Front cell (local -Z) should now point toward world -X after a +90° yaw.
    const pose = cellWorldPose(w.get(r, Transform)!, grid, 0, 0);
    // col 0 local lx=-0.5, row 0 local lz=-1; under +90° yaw this is roughly (-1, +0.5).
    expect(pose.x).toBeCloseTo(-1);
    expect(pose.z).toBeCloseTo(0.5);
  });
});

describe('mounting occupancy + gating', () => {
  it('tracks which part occupies a cell, and reports the engine gate', () => {
    const w = new World();
    const r = rig(w);
    const p = enginePart(w);

    expect(hasMountedPartKind(w, r, 'engine')).toBe(false);
    mountPart(w, p, r, 1, 2);
    expect(partAtCell(w, r, 1, 2)).toBe(p);
    expect(partAtCell(w, r, 0, 0)).toBeUndefined();
    expect(hasMountedPartKind(w, r, 'engine')).toBe(true);

    unmountPart(w, p);
    expect(partAtCell(w, r, 1, 2)).toBeUndefined();
    expect(hasMountedPartKind(w, r, 'engine')).toBe(false);
  });

  it('finds the nearest free cell to a world point and skips occupied ones', () => {
    const w = new World();
    const r = rig(w);
    // A point right over the right-front cell (local 0.5, -1 → world 0.5, -1). A single-deck snap is
    // just nearestMountTarget over a one-element target list.
    expect(nearestMountTarget(w, [r], 0.5, -1, 0.7)).toEqual({ target: r, col: 1, row: 0 });

    // Occupy it; the same point should now snap to the next-nearest free cell instead.
    const p = enginePart(w);
    mountPart(w, p, r, 1, 0);
    const next = nearestMountTarget(w, [r], 0.5, -1, 5);
    expect(next).not.toBeNull();
    expect(next).not.toEqual({ target: r, col: 1, row: 0 });
  });

  it('returns null when no free cell is within snap distance', () => {
    const w = new World();
    const r = rig(w);
    expect(nearestMountTarget(w, [r], 20, 20, 0.7)).toBeNull();
  });
});

describe('closestFreeCellLocal', () => {
  /** A bare 3×3 deck (no Transform needed — the scan is purely local). */
  function deck(world: World): EntityId {
    const e = world.createEntity();
    world.add(e, MountGrid, { cols: 3, rows: 3, cellSize: 1, deckY: 0.2 });
    return e;
  }

  it('picks the cell under a deck-local point', () => {
    const w = new World();
    const d = deck(w);
    // 3×3, cellSize 1, centred: local (0,0) is the centre cell (col 1, row 1).
    expect(closestFreeCellLocal(w, d, 0, 0)).toMatchObject({ col: 1, row: 1 });
    expect(closestFreeCellLocal(w, d, -1, -1)).toMatchObject({ col: 0, row: 0 });
  });

  it('skips an occupied cell, returning the nearest free one', () => {
    const w = new World();
    const d = deck(w);
    mountPart(w, enginePart(w), d, 1, 1); // occupy the centre
    const cell = closestFreeCellLocal(w, d, 0, 0);
    expect(cell).not.toBeNull();
    expect(cell).not.toMatchObject({ col: 1, row: 1 }); // not the taken centre
  });

  it('honours maxDist — null when the nearest free cell is out of reach', () => {
    const w = new World();
    const d = deck(w);
    expect(closestFreeCellLocal(w, d, 20, 20, 0.7)).toBeNull();
    expect(closestFreeCellLocal(w, d, 20, 20)).not.toBeNull(); // unbounded default still finds one
  });

  it('returns null when every cell is taken', () => {
    const w = new World();
    const d = deck(w);
    for (let col = 0; col < 3; col++) {
      for (let row = 0; row < 3; row++) mountPart(w, enginePart(w), d, col, row);
    }
    expect(closestFreeCellLocal(w, d, 0, 0)).toBeNull();
  });
});

describe('no-hybrid type-lock', () => {
  it('reports the chassis as uncommitted until a typed engine is mounted', () => {
    const w = new World();
    const r = rig(w);
    expect(committedEngineType(w, r)).toBeNull();

    const elec = typedEngine(w, 'electric');
    mountPart(w, elec, r, 0, 0);
    expect(committedEngineType(w, r)).toBe('electric');

    unmountPart(w, elec);
    expect(committedEngineType(w, r)).toBeNull(); // removing frees the chassis again
  });

  it('accepts any engine onto an empty chassis', () => {
    const w = new World();
    const r = rig(w);
    expect(canMountPartOn(w, r, typedEngine(w, 'electric'))).toBe(true);
    expect(canMountPartOn(w, r, typedEngine(w, 'mechanical'))).toBe(true);
  });

  it('allows a same-type engine but refuses a cross-type one', () => {
    const w = new World();
    const r = rig(w);
    mountPart(w, typedEngine(w, 'electric'), r, 0, 0); // commits the chassis to electric

    expect(canMountPartOn(w, r, typedEngine(w, 'electric'))).toBe(true); // second electric: fine
    expect(canMountPartOn(w, r, typedEngine(w, 'mechanical'))).toBe(false); // hybrid: refused
  });

  it('re-opens to the other type once the incumbent engine is removed', () => {
    const w = new World();
    const r = rig(w);
    const elec = typedEngine(w, 'electric');
    mountPart(w, elec, r, 0, 0);
    const mech = typedEngine(w, 'mechanical');
    expect(canMountPartOn(w, r, mech)).toBe(false);

    unmountPart(w, elec); // remove the electric engine
    expect(canMountPartOn(w, r, mech)).toBe(true); // mechanical may now go on
  });

  it('locks each chassis independently — a commitment on one rig never gates another', () => {
    const w = new World();
    const r1 = rig(w, 0, 0);
    const r2 = rig(w, 20, 0);
    mountPart(w, typedEngine(w, 'electric'), r1, 0, 0);
    // r2 is untouched, so a mechanical engine mounts on it freely.
    expect(canMountPartOn(w, r2, typedEngine(w, 'mechanical'))).toBe(true);
  });

  it('is a target-agnostic clash check — the CALLER decides which targets are locked', () => {
    // The predicate reports a clash on ANY target already committed to a type, including a workshop
    // the player is merely STAGING engines on. That is exactly why the build controller applies it
    // to the rig only: a workshop deck must hold both engine types at once during a swap. This guards
    // against anyone re-gating the staging surface (the bug that prevented swapping engines).
    const w = new World();
    const shop = rig(w); // any MountGrid target stands in for the workshop staging deck
    mountPart(w, typedEngine(w, 'electric'), shop, 0, 0);
    expect(canMountPartOn(w, shop, typedEngine(w, 'mechanical'))).toBe(false);
  });

  it('imposes no constraint on non-engine parts or typeless engines', () => {
    const w = new World();
    const r = rig(w);
    mountPart(w, typedEngine(w, 'electric'), r, 0, 0); // chassis committed to electric

    // A storage part has no energy type → never clashes.
    const storage = w.createEntity();
    w.add(storage, Transform, { x: 0, z: 0, rotationY: 0, y: 0 });
    w.add(storage, Part, { kind: 'storage' });
    expect(canMountPartOn(w, r, storage)).toBe(true);

    // A typeless engine (no Assembly type) imposes no clash either.
    expect(canMountPartOn(w, r, enginePart(w))).toBe(true);
  });
});

describe('multi-grid mounting (rig + workshop)', () => {
  // A bare 3×3 mount target standing in for a workshop — mounting is grid-agnostic, so any entity
  // with a MountGrid + Transform is a valid target.
  function workshopGrid(w: World, x: number, z: number): EntityId {
    const e = w.createEntity();
    w.add(e, Transform, { x, z, rotationY: 0 });
    w.add(e, MountGrid, { cols: 3, rows: 3, cellSize: 1, deckY: 0.2 });
    return e;
  }

  it('picks the globally nearest cell across targets and reports which target won', () => {
    const w = new World();
    const r = rig(w, 0, 0);
    const shop = workshopGrid(w, 8, 0);

    // A point hard over the workshop's centre cell → the workshop wins, not the far-off rig.
    const hit = nearestMountTarget(w, [r, shop], 8, 0, 0.7);
    expect(hit).toEqual({ target: shop, col: 1, row: 1 });

    // A point over the rig → the rig wins.
    const onRig = nearestMountTarget(w, [r, shop], 0.5, -1, 0.7);
    expect(onRig?.target).toBe(r);
  });

  it('skips a target whose cell is occupied and falls to another target', () => {
    const w = new World();
    const r = rig(w, 0, 0);
    const shop = workshopGrid(w, 0, 8);

    // Occupy the rig's right-front cell, then aim at it: with the rig cell taken and the workshop
    // far, the closest FREE cell within a generous snap is still on the rig (a different cell).
    mountPart(w, enginePart(w), r, 1, 0);
    const hit = nearestMountTarget(w, [r, shop], 0.5, -1, 5);
    expect(hit?.target).toBe(r);
    expect(hit).not.toEqual({ target: r, col: 1, row: 0 });
  });

  it('returns null when no target has a free cell in reach', () => {
    const w = new World();
    const r = rig(w, 0, 0);
    const shop = workshopGrid(w, 8, 0);
    expect(nearestMountTarget(w, [r, shop], 50, 50, 0.7)).toBeNull();
  });

  it('rides a part mounted on the workshop to the workshop deck, not the rig', () => {
    const w = new World();
    rig(w, 0, 0);
    const shop = workshopGrid(w, 8, 0);
    const part = enginePart(w);

    mountPart(w, part, shop, 1, 1); // centre cell of the workshop
    mountingSystem(w);

    const t = w.get(part, Transform)!;
    expect(t.x).toBeCloseTo(8); // sits at the workshop, not at the rig origin
    expect(t.z).toBeCloseTo(0);
    expect(t.y).toBeCloseTo(0.2); // the workshop's deck height
  });
});

describe('mountingSystem', () => {
  it('rides a mounted part to its cell on the rig each frame', () => {
    const w = new World();
    const r = rig(w, 0, 0);
    const p = enginePart(w, 9, 9); // starts far away, loose
    mountPart(w, p, r, 0, 0);

    mountingSystem(w);
    const t = w.get(p, Transform)!;
    expect(t.x).toBeCloseTo(-0.5); // left-front cell
    expect(t.z).toBeCloseTo(-1);
    expect(t.y).toBeCloseTo(0.66);

    // Move + turn the rig; the part follows on the next mounting pass.
    const rt = w.get(r, Transform)!;
    rt.x = 4;
    rt.z = -2;
    mountingSystem(w);
    expect(t.x).toBeCloseTo(3.5);
    expect(t.z).toBeCloseTo(-3);
  });

  it('moving a part to another cell re-places it there', () => {
    const w = new World();
    const r = rig(w);
    const p = enginePart(w);
    mountPart(w, p, r, 0, 0);
    mountingSystem(w);

    mountPart(w, p, r, 1, 2); // same part, new cell (overwrites Mount)
    mountingSystem(w);
    const t = w.get(p, Transform)!;
    expect(t.x).toBeCloseTo(0.5);
    expect(t.z).toBeCloseTo(1);
  });

  it('orphans a mounted part if its rig is destroyed', () => {
    const w = new World();
    const r = rig(w);
    const p = enginePart(w);
    mountPart(w, p, r, 0, 0);

    w.destroyEntity(r);
    mountingSystem(w);
    expect(w.has(p, Mount)).toBe(false);
  });

  it('applies the placed facing as an offset on top of the rig heading', () => {
    const w = new World();
    const r = rig(w, 0, 0, 0.5); // rig yaw 0.5
    const p = enginePart(w);
    mountPart(w, p, r, 0, 0, 0.3); // local facing offset 0.3
    mountingSystem(w);
    expect(w.get(p, Transform)!.rotationY).toBeCloseTo(0.8); // 0.5 + 0.3
  });
});

describe('facing rules', () => {
  it('outward snaps corner cells to forward/back (the long axis), never a diagonal', () => {
    // Corner cells sit at local (±0.5, ±1): the radial is diagonal, but |lz| > |lx| so we snap to
    // the length axis — front corners point the front out the front (-Z), back corners out the back (+Z).
    const front = frontDir(outwardLocalYaw(GRID, 1, 0)); // right-front corner
    expect(front.x).toBeCloseTo(0);
    expect(front.z).toBeCloseTo(-1);

    const back = frontDir(outwardLocalYaw(GRID, 0, 2)); // left-back corner
    expect(back.x).toBeCloseTo(0);
    expect(back.z).toBeCloseTo(1);
  });

  it('outward turns a middle-row part purely sideways (no front/back component)', () => {
    // Middle row has lz = 0, so the only outward direction is across the width (±X).
    const yaw = outwardLocalYaw(GRID, 1, 1); // right-middle cell
    const dir = frontDir(yaw);
    expect(dir.x).toBeCloseTo(1);
    expect(dir.z).toBeCloseTo(0);
  });

  it('outward always resolves to one of the four orthogonal facings', () => {
    for (let col = 0; col < GRID.cols; col++) {
      for (let row = 0; row < GRID.rows; row++) {
        const d = frontDir(outwardLocalYaw(GRID, col, row));
        // Exactly one axis is ±1 and the other is 0 — no diagonals.
        const ortho = (Math.abs(d.x) < 1e-9 && Math.abs(Math.abs(d.z) - 1) < 1e-9)
          || (Math.abs(d.z) < 1e-9 && Math.abs(Math.abs(d.x) - 1) < 1e-9);
        expect(ortho).toBe(true);
      }
    }
  });

  it('flexible snaps to the cell edge the cursor leans toward (4 cardinals)', () => {
    // Left-front cell centre is local (-0.5, -1). Nudge the cursor in each direction from it.
    const c = cellLocalOffset(GRID, 0, 0);
    expect(frontDir(leanLocalYaw(GRID, 0, 0, c.lx + 0.3, c.lz)).x).toBeCloseTo(1); // leans right → front faces +X
    expect(frontDir(leanLocalYaw(GRID, 0, 0, c.lx - 0.3, c.lz)).x).toBeCloseTo(-1); // leans left → -X
    expect(frontDir(leanLocalYaw(GRID, 0, 0, c.lx, c.lz - 0.3)).z).toBeCloseTo(-1); // leans front → -Z
    expect(frontDir(leanLocalYaw(GRID, 0, 0, c.lx, c.lz + 0.3)).z).toBeCloseTo(1); // leans back → +Z
  });

  it('resolveLocalYaw dispatches on the composition (specific vs flexible vs none)', () => {
    expect(resolveLocalYaw(undefined, GRID, 1, 0, 0, 0)).toBe(0); // no composition → deck-aligned
    expect(resolveLocalYaw({ kind: 'specific', rule: 'outward' }, GRID, 1, 1, 0, 0))
      .toBeCloseTo(outwardLocalYaw(GRID, 1, 1));
    const c = cellLocalOffset(GRID, 0, 0);
    expect(resolveLocalYaw({ kind: 'flexible' }, GRID, 0, 0, c.lx + 0.3, c.lz))
      .toBeCloseTo(leanLocalYaw(GRID, 0, 0, c.lx + 0.3, c.lz));
  });
});

describe('deck hover', () => {
  it('knows when a rig-local point is over the deck footprint', () => {
    expect(isOverDeck(GRID, 0, 0)).toBe(true);
    expect(isOverDeck(GRID, 0.9, 1.4)).toBe(true); // within 1×1.5 half-extents
    expect(isOverDeck(GRID, 2, 0)).toBe(false); // off the side
    expect(isOverDeck(GRID, 0, 3)).toBe(false); // past the back
  });

  it('round-trips a world point through the rig-local frame', () => {
    const w = new World();
    const r = rig(w, 3, -2, 0.7);
    const rt = w.get(r, Transform)!;
    const pose = cellWorldPose(rt, GRID, 1, 2);
    const local = worldToRigLocal(rt, pose.x, pose.z);
    const off = cellLocalOffset(GRID, 1, 2);
    expect(local.lx).toBeCloseTo(off.lx);
    expect(local.lz).toBeCloseTo(off.lz);
  });
});
