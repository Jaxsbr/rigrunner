import type { World } from '../core/world';
import type { EntityId } from '../core/types';
import { Transform } from '../components/transform';
import { Collectible } from '../components/collectible';
import { Collider } from '../components/collider';
import { Renderable } from '../components/renderable';

/**
 * Loose scrap: a small bit of debris the rig collects by simply driving over it (see
 * systems/scrap-collection). It is NOT a part — you don't grab or mount it — so it has no Part;
 * it's just a Collectible with a physical footprint sitting in the world.
 *
 * It reuses the `scrap-pile` GLB shrunk to pickup size (≈0.3 m, the "Pickup" rung of the size
 * ladder in docs/asset-style.md). That's a deliberate placeholder: a *pile* is really the future
 * tool-gated loot mechanic, so this borrows its look until a dedicated small-scrap asset exists.
 */
const SCRAP_SCALE = 0.3;   // shrink the pile GLB down to a loose-scrap pickup
const SCRAP_RADIUS = 0.4;  // forgiving pickup footprint — easy to sweep up while driving
const SCRAP_VALUE = 1;     // each piece adds 1 to storage (cap 4 ⇒ 4 pieces fill a container)

/** Spawn one piece of loose scrap at a world position, facing a (cosmetic) yaw. */
export function spawnScrap(world: World, x: number, z: number, rotationY = 0): EntityId {
  const e = world.createEntity();
  world.add(e, Transform, { x, z, rotationY });
  world.add(e, Collectible, { value: SCRAP_VALUE });
  world.add(e, Collider, { radius: SCRAP_RADIUS });
  world.add(e, Renderable, { shape: 'model', assetId: 'scrap-pile', scale: SCRAP_SCALE });
  return e;
}

/**
 * Scatter `count` pieces at random positions in a ring `minR`..`maxR` from the origin — close
 * enough to find at once, far enough that collecting is an activity you drive out for, and clear
 * of the rig/parts that sit near the centre. Each gets a random facing so the field doesn't read
 * as a regular pattern. Returns the spawned ids.
 */
export function scatterScrap(
  world: World,
  count: number,
  minR = 6,
  maxR = 18,
): EntityId[] {
  const ids: EntityId[] = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = minR + Math.random() * (maxR - minR);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    ids.push(spawnScrap(world, x, z, Math.random() * Math.PI * 2));
  }
  return ids;
}
