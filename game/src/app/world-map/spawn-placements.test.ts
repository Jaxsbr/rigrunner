import { describe, it, expect } from 'vitest';
import { World } from '@core/world';
import { Transform } from '@common/components/transform';
import { Renderable } from '@common/components/renderable';
import { WorkshopZone } from '@features/workshop/workshop-zone';
import { WorldShop } from '@features/shop/world-shop';
import { Camp } from '@features/camps/camp';
import { ScrapPile } from '@features/scrap/scrap-pile';
import { spawnPlacement, spawnPlacements } from './spawn-placements';
import type { Placement } from './placement';

describe('spawnPlacement', () => {
  it('spawns a workshop placement as a WorkshopZone at its transform, and reports it created', () => {
    const w = new World();
    const created = spawnPlacement(w, { kind: 'workshop', x: 5, z: -3, rotationY: 0 });
    const zones = w.query(WorkshopZone, Transform);
    expect(zones).toHaveLength(1);
    const t = w.get(zones[0]!, Transform)!;
    expect([t.x, t.z]).toEqual([5, -3]);
    expect(created).toContain(zones[0]);
  });

  it('captures every entity a composite placement spawns (a shop scatters a yard)', () => {
    const w = new World();
    const created = spawnPlacement(w, { kind: 'shop', x: 10, z: 10, rotationY: 0 });
    const shops = w.query(WorldShop);
    expect(shops).toHaveLength(1);
    expect(created).toContain(shops[0]);
    expect(created.length).toBeGreaterThan(1); // the building + its scattered yard props
  });

  it('spawns a camp placement at the level its kind names', () => {
    const w = new World();
    spawnPlacement(w, { kind: 'camp-2', x: 0, z: 0, rotationY: 0 });
    const camps = w.query(Camp);
    expect(camps).toHaveLength(1);
    expect(w.get(camps[0]!, Camp)!.level).toBe(2);
  });

  it('spawns a decoration placement as a plain drive-through model (no collider)', () => {
    const w = new World();
    spawnPlacement(w, { kind: 'yard-crate', x: 1, z: 2, rotationY: 0 });
    const crates = w
      .query(Renderable, Transform)
      .map((e) => w.get(e, Renderable)!)
      .filter((r) => r.shape === 'model' && r.assetId === 'yard-crate');
    expect(crates).toHaveLength(1);
  });

  it('skips an unknown kind without throwing, creating nothing', () => {
    const w = new World();
    expect(spawnPlacement(w, { kind: 'nope', x: 0, z: 0, rotationY: 0 })).toEqual([]);
  });
});

describe('spawnPlacements persistence filter', () => {
  const list: Placement[] = [
    { kind: 'workshop', x: 0, z: 0, rotationY: 0 },   // static
    { kind: 'scrap-pile', x: 1, z: 1, rotationY: 0 }, // progress
    { kind: 'camp-1', x: 2, z: 2, rotationY: 0 },     // progress
  ];

  it("'static' seeds only the static kinds (New Game + Continue)", () => {
    const w = new World();
    spawnPlacements(w, list, 'static');
    expect(w.query(WorkshopZone)).toHaveLength(1);
    expect(w.query(ScrapPile)).toHaveLength(0);
    expect(w.query(Camp)).toHaveLength(0);
  });

  it("'progress' seeds only the progress kinds (New Game only)", () => {
    const w = new World();
    spawnPlacements(w, list, 'progress');
    expect(w.query(WorkshopZone)).toHaveLength(0);
    expect(w.query(ScrapPile)).toHaveLength(1);
    expect(w.query(Camp)).toHaveLength(1);
  });

  it('no filter seeds the whole layout (the editor view)', () => {
    const w = new World();
    spawnPlacements(w, list);
    expect(w.query(WorkshopZone)).toHaveLength(1);
    expect(w.query(ScrapPile)).toHaveLength(1);
    expect(w.query(Camp)).toHaveLength(1);
  });
});
