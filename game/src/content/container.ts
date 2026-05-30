import type { World } from '../core/world';
import type { EntityId } from '../core/types';
import { Transform } from '../components/transform';
import { Renderable } from '../components/renderable';

/**
 * A scrap container: the first real 3D asset placed in the world. It is inert for now —
 * just a Transform + a model Renderable — a target to see the GLB pipeline render in-game.
 * Later it gains the components that make it harvestable / fillable.
 */
export function spawnContainer(world: World, x = 0, z = 0): EntityId {
  const e = world.createEntity();
  world.add(e, Transform, { x, z, rotationY: 0 });
  world.add(e, Renderable, { shape: 'model', assetId: 'scrap-container' });
  return e;
}
