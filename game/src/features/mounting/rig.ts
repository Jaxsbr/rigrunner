import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { Drivetrain } from '@features/drive/drivetrain';
import { Velocity } from '@features/drive/velocity';
import { DriveControl } from '@features/drive/drive-control';
import { MountGrid } from '@common/components/mount-grid';
import { Weight } from '@common/components/weight';
import { Collider } from '@common/components/collider';
import { Renderable } from '@common/components/renderable';

/**
 * The first composition: a minimal drivable rig — a powered, steerable drive-train with a deck
 * to build on. A "rig" is not a class; it is this specific SET of capabilities. New entity kinds
 * are new functions like this (or, later, data), never new subclasses.
 *
 * Rendered as the `rig` GLB: a chassis with a 2×3 mounting deck and 6 wheels. The wheels are
 * separate named nodes the render layer spins by the rig's speed (see RenderView.animateWheels).
 *
 * Note it has a Drivetrain (chassis handling) but no propulsion of its own: top speed and
 * acceleration come from the engine(s) mounted on its deck, so with none it can't move
 * (movement.ts + systems/engine.ts). The MountGrid below mirrors the GLB's deck — 2 cells across
 * × 3 along, surface at y=0.66 (rig.py DECK_TOP).
 */
export function spawnRig(world: World, x = 0, z = 0): EntityId {
  const e = world.createEntity();
  world.add(e, Transform, { x, z, rotationY: 0 });
  world.add(e, Drivetrain, {
    friction: 12, turnRate: 2.3, turnFullSpeed: 5, reverseFactor: 0.5,
  });
  world.add(e, Velocity, { speed: 0 });
  world.add(e, DriveControl, { throttle: 0, steer: 0 });
  world.add(e, MountGrid, { cols: 2, rows: 3, cellSize: 1, deckY: 0.66 });
  // The bare rig's mass — chassis + platform + wheels — that the engines must haul, on top of the
  // engines' own weight. TODO: today this is one lumped number for testing; once the rig becomes
  // composed of parts (chassis/platform/wheels as separate components, each with a Weight), this
  // total will be summed from them instead of hard-coded here.
  world.add(e, Weight, { value: 10 });
  // The chassis's own collision footprint (a circle over the 2×3 body). Each mounted part adds its
  // own Collider, so the rig's true collision area is the union of these circles — it grows with the
  // build. Sized to cover the central body; parts jutting to the edges extend reach where they sit.
  world.add(e, Collider, { radius: 1.2 });
  world.add(e, Renderable, { shape: 'model', assetId: 'rig' });
  return e;
}
