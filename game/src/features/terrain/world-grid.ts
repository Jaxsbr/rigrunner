import { defineComponent } from '@core/component';
import type { World } from '@core/world';
import type { CollisionGrid } from './collision-grid';

/**
 * The world's static collision grid, carried as a singleton component so it travels with the World and
 * the systems can find it without a global. Set once by the scenario at seed time (the real game loads
 * the committed map; the sandbox sets none — it's the free test world), read each frame by
 * `gridBlockSystem` via `getWorldGrid`.
 */
export interface WorldGrid {
  grid: CollisionGrid;
}

export const WorldGrid = defineComponent<WorldGrid>('WorldGrid');

/** Attach the static collision grid to the world (one singleton entity). */
export function setWorldGrid(world: World, grid: CollisionGrid): void {
  const e = world.createEntity();
  world.add(e, WorldGrid, { grid });
}

/** The world's static collision grid, or null if none was seeded (e.g. the sandbox). */
export function getWorldGrid(world: World): CollisionGrid | null {
  const es = world.query(WorldGrid);
  return es.length > 0 ? world.get(es[0]!, WorldGrid)!.grid : null;
}
