import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { Renderable } from '@common/components/renderable';
import { spawnWorkshop } from '@features/workshop/workshop';
import { spawnWorldShop } from '@features/shop/world-shop-spawn';
import { spawnCamp } from '@features/camps/camp-spawn';
import { spawnScrap, spawnScrapPile } from '@features/scrap/scrap';
import { placementKind, type Placement, type Persistence } from './placement';

/**
 * Turn authored placements into world entities — the cross-feature dispatch the composition root owns
 * (ADR-003: only `app/` imports across features). Each `kind` routes to its feature spawner; decoration
 * kinds spawn a plain drive-through model. The scenario calls `spawnPlacements` at seed time; the editor
 * calls `spawnPlacement` per drop so it can track and move/remove exactly what each placement created.
 */

/** A decoration prop is scenery you drive past: a positioned model with no collider (the shop-yard rule). */
function spawnDecoration(world: World, assetId: string, x: number, z: number, rotationY: number, scale?: number): void {
  const e = world.createEntity();
  world.add(e, Transform, { x, z, rotationY });
  world.add(e, Renderable, { shape: 'model', assetId, scale });
}

/** Route one placement to the feature that knows how to build it. */
function dispatch(world: World, p: Placement): void {
  const def = placementKind(p.kind);
  if (!def) {
    console.warn(`[world-map] unknown placement kind '${p.kind}' — skipped`);
    return;
  }
  switch (def.category) {
    case 'structure':
      if (def.id === 'workshop') spawnWorkshop(world, p.x, p.z, p.rotationY);
      else if (def.id === 'shop') spawnWorldShop(world, p.x, p.z, undefined, p.rotationY);
      return;
    case 'camp':
      // Camps don't rotate their internal layout yet (the guard ring is radial); rotationY is recorded
      // for the data round-trip but not applied — a known limitation noted in the editor.
      spawnCamp(world, p.x, p.z, def.level ?? 1);
      return;
    case 'scrap':
      if (def.id === 'loose-scrap') spawnScrap(world, p.x, p.z, p.rotationY);
      else spawnScrapPile(world, p.x, p.z, p.rotationY);
      return;
    case 'decoration':
      spawnDecoration(world, def.ghostAssetId, p.x, p.z, p.rotationY, def.ghostScale);
      return;
  }
}

/**
 * Spawn one placement and return EVERY entity it created — a composite (a shop scatters a yard, a camp
 * rings guards + debris) makes several, so the editor captures them by diffing the live set rather than
 * trusting a single returned id. The order is stable enough for the editor to translate/destroy the set.
 */
export function spawnPlacement(world: World, p: Placement): EntityId[] {
  const before = new Set(world.query());
  dispatch(world, p);
  return world.query().filter((e) => !before.has(e));
}

/**
 * Seed a list of placements. `filter` selects which persistence class to lay (the scenario seeds `static`
 * in `seedStaticWorld` and `progress` in `seedNewGameContent`); omit it to spawn them all (the editor,
 * which shows the whole authored world regardless of how the game will later split it).
 */
export function spawnPlacements(world: World, placements: readonly Placement[], filter?: Persistence): void {
  for (const p of placements) {
    if (filter && placementKind(p.kind)?.persistence !== filter) continue;
    spawnPlacement(world, p);
  }
}
