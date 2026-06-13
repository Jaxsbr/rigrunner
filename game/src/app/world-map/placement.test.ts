import { describe, it, expect } from 'vitest';
import { CollisionGrid } from '@features/terrain/collision-grid';
import { nextWind, snapWind, WIND_STEP, placementKind, type WorldMap, type Placement } from './placement';

describe('8-wind rotation', () => {
  it('round-robins through the 8 compass headings and wraps a full turn', () => {
    const winds: number[] = [];
    let r = 0;
    for (let i = 0; i < 9; i++) {
      winds.push(Math.round(r / WIND_STEP));
      r = nextWind(r);
    }
    expect(winds).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 0]); // N,NE,E,SE,S,SW,W,NW, back to N
  });

  it('snaps an arbitrary heading to the nearest wind, normalised to [0, 2π)', () => {
    expect(snapWind(0.1)).toBeCloseTo(0);
    expect(snapWind(WIND_STEP * 1.4)).toBeCloseTo(WIND_STEP);
    expect(snapWind(-WIND_STEP)).toBeCloseTo(WIND_STEP * 7); // wraps to NW, not −45°
    expect(snapWind(Math.PI * 2)).toBeCloseTo(0);
  });
});

describe('placement catalog', () => {
  it('classifies persistence: structures/decoration are static, camps/scrap are progress', () => {
    expect(placementKind('workshop')?.persistence).toBe('static');
    expect(placementKind('yard-crate')?.persistence).toBe('static');
    expect(placementKind('camp-1')?.persistence).toBe('progress');
    expect(placementKind('scrap-pile')?.persistence).toBe('progress');
  });

  it('marks solid kinds for collision bake and leaves drive-through scenery alone', () => {
    expect(placementKind('workshop')?.autoBake).toBe(true);
    expect(placementKind('shop')?.autoBake).toBe(true);
    expect(placementKind('scrap-pile')?.autoBake).toBe(true);
    expect(placementKind('yard-crate')?.autoBake).toBeFalsy(); // decoration is driven through
    expect(placementKind('camp-1')?.autoBake).toBeFalsy();     // a camp blocks via its cache, not a bake
  });

  it('returns undefined for a kind the catalog no longer knows', () => {
    expect(placementKind('gone')).toBeUndefined();
  });
});

describe('WorldMap round-trip', () => {
  it('serializes + reloads the layout alongside the collision raster', () => {
    const grid = CollisionGrid.blank(20, 1);
    grid.setBlocked(grid.colOf(-14.5), grid.rowOf(-14.5), true);
    const placements: Placement[] = [
      { kind: 'workshop', x: 1, z: 2, rotationY: 0 },
      { kind: 'shop', x: 3, z: 4, rotationY: WIND_STEP },
    ];
    const doc: WorldMap = { ...grid.toMap(), baseBlocked: grid.toMap().blocked, placements };

    const json = JSON.parse(JSON.stringify(doc)) as WorldMap;

    // The collision raster still loads as a plain CollisionMap (the game's read path is unchanged).
    expect(CollisionGrid.fromMap(json).isBlocked(-14.5, -14.5)).toBe(true);
    // …and the authored layers ride alongside it.
    expect(json.placements).toEqual(placements);
    expect(json.baseBlocked).toBe(doc.baseBlocked);
  });
});
