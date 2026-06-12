import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { MountGrid } from '@common/components/mount-grid';
import { WorkshopZone } from '@features/workshop/workshop-zone';
import { WorkshopDrain } from '@features/workshop/workshop-drain';
import { Renderable } from '@common/components/renderable';
import { Collider } from '@common/components/collider';
import { Solid } from '@common/components/solid';

/**
 * The workshop: a static 3×3 build fixture, the player's home base. It is composed from the SAME
 * mounting capability as the rig — a MountGrid — so parts move onto it with the identical grab /
 * snap / drop mechanism. The difference from the rig is what it LACKS: no Drivetrain/Velocity (it
 * never moves). It carries a Solid collision footprint so the rig can't drive through the platform,
 * but its *interaction* is still governed by the proximity zone (parking in range), not by contact,
 * and parts ride it via the mount grid.
 *
 * A WorkshopZone gates it: its grid is only a live drop target while the rig is parked within the
 * zone (systems/workshop-zone.ts). Drop a full storage container on it and the drain banks its
 * scrap into the player's Wallet (systems/workshop-drain.ts).
 *
 * The 3×3 grid mirrors the GLB authored in tools/blender/assets/workshop.py — 3 cells each way,
 * deck surface at y=0.20 (workshop.py DECK_TOP), so a mounted part rests exactly on the platform.
 */
const ZONE_RADIUS = 3.5;   // metres from centre the rig must reach to activate the workshop (tunable)
// One round footprint over the 3×3 (≈3×3 m) deck — slightly inside the corners, comfortably inside the
// zone so the rig still parks in build range (stops ≈ radius + rig collider out from centre). Tunable.
const SOLID_RADIUS = 1.7;

export function spawnWorkshop(world: World, x = 0, z = 0): EntityId {
  const e = world.createEntity();
  world.add(e, Transform, { x, z, rotationY: 0 });
  world.add(e, MountGrid, { cols: 3, rows: 3, cellSize: 1, deckY: 0.2 });
  world.add(e, WorkshopZone, { radius: ZONE_RADIUS, active: false });
  world.add(e, WorkshopDrain, { elapsed: 0 });
  world.add(e, Renderable, { shape: 'model', assetId: 'workshop' });
  world.add(e, Collider, { radius: SOLID_RADIUS });
  world.add(e, Solid, true);
  return e;
}
