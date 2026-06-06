import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { Collider } from '@common/components/collider';
import { Renderable } from '@common/components/renderable';
import { Health } from '@common/components/health';
import { Camp } from './camp';
import { Enemy, EnemyAI } from './enemy';
import { campLevel } from './camp-levels';

/** How far the guard ring stands from the camp centre, and how big the structure reads. */
const GUARD_RING_RADIUS = 3.5;

/**
 * Build a level-`level` camp at (x,z): the `Camp` objective entity, its structure (a loot container + a
 * tent), and its ring of guards — all driven by the `CAMP_LEVELS` row, so a richer camp is a data change
 * (`camp-levels.ts`), not new code here. Each guard is its own entity with its own `Health`, AI tuning
 * stamped from the level, and a post at its spawn spot (where `RETREAT` returns it).
 *
 * The structure props and guards render as authored GLBs (`camp-cache`, `tent`, `enemy`); the camp
 * reads its level VISUALLY from this composition, never a HUD label. Returns the camp entity.
 */
export function spawnCamp(world: World, x: number, z: number, level = 1): EntityId {
  const lv = campLevel(level);

  const camp = world.createEntity();
  world.add(camp, Transform, { x, z, y: 0, rotationY: 0 });
  world.add(camp, Camp, { level, state: 'guarded' });

  // The loot container (the cache the camp guards) and a tent — the level-1 silhouette. Pure visual
  // props (no collider; the game has no collision response, and loot is granted on clear, not on touch).
  const container = world.createEntity();
  world.add(container, Transform, { x: x + 1.4, z, y: 0, rotationY: 0 });
  world.add(container, Renderable, { shape: 'model', assetId: 'camp-cache' });

  const tent = world.createEntity();
  world.add(tent, Transform, { x: x - 1.6, z: z + 0.4, y: 0, rotationY: 0 });
  world.add(tent, Renderable, { shape: 'model', assetId: 'tent' });

  // The guard ring — distributed around the camp, each watching outward from its post.
  for (let i = 0; i < lv.enemyCount; i++) {
    const angle = (i / lv.enemyCount) * Math.PI * 2;
    const ex = x + Math.cos(angle) * GUARD_RING_RADIUS;
    const ez = z + Math.sin(angle) * GUARD_RING_RADIUS;
    const e = world.createEntity();
    // Face outward from the camp centre (front is local −Z): a guard watching the approach.
    world.add(e, Transform, { x: ex, z: ez, y: 0, rotationY: Math.atan2(-(ex - x), -(ez - z)) });
    world.add(e, Enemy, { camp });
    world.add(e, EnemyAI, {
      state: 'guard',
      postX: ex,
      postZ: ez,
      detection: lv.detection,
      leash: lv.leash,
      moveSpeed: lv.enemyMoveSpeed,
      damage: lv.enemyDamage,
      fireInterval: lv.enemyFireInterval,
      projectileSpeed: lv.enemyProjectileSpeed,
      fireCooldownLeft: 0,
    });
    world.add(e, Health, { current: lv.enemyHealth, max: lv.enemyHealth });
    world.add(e, Collider, { radius: 0.6 });
    world.add(e, Renderable, { shape: 'model', assetId: 'enemy' });
  }

  return camp;
}
