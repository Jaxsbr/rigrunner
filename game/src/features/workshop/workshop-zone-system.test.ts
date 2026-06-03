import { describe, it, expect } from 'vitest';
import { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { Collider } from '@common/components/collider';
import { WorkshopZone } from '@features/workshop/workshop-zone';
import { workshopZoneSystem } from './workshop-zone-system';

function rig(world: World, x: number, z: number, radius = 1.2): EntityId {
  const e = world.createEntity();
  world.add(e, Transform, { x, z, rotationY: 0 });
  world.add(e, Collider, { radius });
  return e;
}

function workshop(world: World, x: number, z: number, radius = 3.5): EntityId {
  const e = world.createEntity();
  world.add(e, Transform, { x, z, rotationY: 0 });
  world.add(e, WorkshopZone, { radius, active: false });
  return e;
}

describe('workshopZoneSystem', () => {
  it('activates when the rig circle overlaps the zone', () => {
    const world = new World();
    const w = workshop(world, 0, 0, 3.5);
    const r = rig(world, 0, 4, 1.2); // dist 4 ≤ 3.5 + 1.2 = 4.7 → intersecting

    workshopZoneSystem(world, r);
    expect(world.get(w, WorkshopZone)!.active).toBe(true);
  });

  it('stays dormant when the rig is out of reach', () => {
    const world = new World();
    const w = workshop(world, 0, 0, 3.5);
    const r = rig(world, 0, 6, 1.2); // dist 6 > 4.7 → outside

    workshopZoneSystem(world, r);
    expect(world.get(w, WorkshopZone)!.active).toBe(false);
  });

  it('counts the rig collider radius (circle-vs-circle, not centre-in-circle)', () => {
    const world = new World();
    const w = workshop(world, 0, 0, 3.5);
    // Rig centre at 4.5 is OUTSIDE the bare 3.5 zone, but its 1.2 radius reaches in (4.5 ≤ 4.7).
    const r = rig(world, 0, 4.5, 1.2);

    workshopZoneSystem(world, r);
    expect(world.get(w, WorkshopZone)!.active).toBe(true);
  });

  it('toggles back to dormant when the rig drives away', () => {
    const world = new World();
    const w = workshop(world, 0, 0, 3.5);
    const r = rig(world, 0, 0, 1.2);

    workshopZoneSystem(world, r);
    expect(world.get(w, WorkshopZone)!.active).toBe(true);

    world.get(r, Transform)!.z = 20; // drove off
    workshopZoneSystem(world, r);
    expect(world.get(w, WorkshopZone)!.active).toBe(false);
  });
});
