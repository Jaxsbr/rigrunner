import type { World } from '../core/world';
import type { EntityId } from '../core/types';
import { Transform } from '../components/transform';
import { Part } from '../components/part';
import { Storage } from '../components/storage';
import { Weight } from '../components/weight';
import { Collider } from '../components/collider';
import { Renderable } from '../components/renderable';

/**
 * A storage container: a part the player mounts on the rig to hold collected scrap. Its capabilities:
 * Part (grabbable + mountable like an engine), Storage (the cargo it holds, which travels WITH the
 * entity on and off the rig), Weight (its empty shell mass — cargo doesn't add weight yet), Collider
 * (so driving the container into scrap collects it too), and the GLB that draws the open-top cube.
 *
 * No MountFacing: a container has no directional meaning, so it rests deck-aligned (yaw 0) — exactly
 * what resolveLocalYaw returns for a part with no facing rule.
 *
 * It spawns empty; the render layer reads Storage.amount to show the scrap rising inside it.
 */
/** Scrap a single container holds (value 1 each). Exported so an assembled storage product
 *  (`systems/assembly.ts`) gives its `Storage` the same capacity a directly-spawned container has. */
export const CONTAINER_CAPACITY = 4; // 4 scrap pieces (value 1 each) fill one container
const CONTAINER_WEIGHT = 2;   // empty-shell mass the engines must haul (cargo is weightless for now)
const CONTAINER_RADIUS = 0.5; // ~1-cell footprint

export function spawnContainer(world: World, x = 0, z = 0): EntityId {
  const e = world.createEntity();
  world.add(e, Transform, { x, z, rotationY: 0, y: 0 });
  world.add(e, Part, { kind: 'storage' });
  world.add(e, Storage, { amount: 0, capacity: CONTAINER_CAPACITY });
  world.add(e, Weight, { value: CONTAINER_WEIGHT });
  world.add(e, Collider, { radius: CONTAINER_RADIUS });
  world.add(e, Renderable, { shape: 'model', assetId: 'storage' });
  return e;
}
