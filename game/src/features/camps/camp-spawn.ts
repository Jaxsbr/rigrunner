import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { Collider } from '@common/components/collider';
import { Renderable } from '@common/components/renderable';
import { Health } from '@common/components/health';
import { Camp } from './camp';
import { CampDecor } from './camp-decor';
import { Enemy, EnemyAI } from './enemy';
import { campLevel } from './camp-levels';

/** How far the guard ring stands from the camp centre, and how big the structure reads. */
const GUARD_RING_RADIUS = 3.5;

/** The wreckage strewn around a standing camp (the environmental mess). Each piece is scattered with a
 *  random yaw + slight scale so a tiny asset set reads as a littered, fought-over camp; all are
 *  `CampDecor`, so they sink + despawn with the rest of the camp on clear. */
const DEBRIS_ASSETS = ['debris-crate', 'debris-heap', 'camp-firepit'] as const;
const DEBRIS_COUNT = 5;
const DEBRIS_MIN_R = 2.2; // keep the centre clear for the sprout that rises there on clear
const DEBRIS_MAX_R = 4.8;

/**
 * Build a level-`level` camp at (x,z): the `Camp` objective entity, its structure (a loot container + a
 * tent), its scattered debris (the environmental mess), and its ring of guards. The enemy roster + tuning
 * come from the `CAMP_LEVELS` row, so a richer camp is a data change (`camp-levels.ts`), not new code here.
 * Each guard is its own entity with its own `Health`, AI tuning stamped from the level, and a post at its
 * spawn spot (where `RETREAT` returns it).
 *
 * The structure/debris props and guards render as authored GLBs (`camp-cache`, `tent`, `debris-*`,
 * `enemy`); the camp reads its level VISUALLY from this composition, never a HUD label. The structure +
 * debris are tagged `CampDecor` so they tear down with the camp on clear. Returns the camp entity.
 */
export function spawnCamp(world: World, x: number, z: number, level = 1): EntityId {
  const lv = campLevel(level);

  const camp = world.createEntity();
  world.add(camp, Transform, { x, z, y: 0, rotationY: 0 });
  world.add(camp, Camp, { level, state: 'guarded', tornDown: 0 });

  // The loot container (the cache the camp guards) and a tent — the level-1 silhouette. Pure visual
  // props (no collider; the game has no collision response, and loot is granted on clear, not on touch).
  // Both are `CampDecor` of this camp, so they sink + despawn when it's cleared.
  const container = world.createEntity();
  world.add(container, Transform, { x: x + 1.4, z, y: 0, rotationY: 0 });
  world.add(container, Renderable, { shape: 'model', assetId: 'camp-cache' });
  world.add(container, CampDecor, { camp });

  const tent = world.createEntity();
  world.add(tent, Transform, { x: x - 1.6, z: z + 0.4, y: 0, rotationY: 0 });
  world.add(tent, Renderable, { shape: 'model', assetId: 'tent' });
  world.add(tent, CampDecor, { camp });

  // Scattered wreckage — the camp's environmental mess. Placed in an annulus around the centre (kept
  // clear for the sprout), each a random debris model at a random facing + slight scale.
  for (let i = 0; i < DEBRIS_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = DEBRIS_MIN_R + Math.random() * (DEBRIS_MAX_R - DEBRIS_MIN_R);
    const assetId = DEBRIS_ASSETS[Math.floor(Math.random() * DEBRIS_ASSETS.length)]!;
    const piece = world.createEntity();
    world.add(piece, Transform, { x: x + Math.cos(angle) * radius, z: z + Math.sin(angle) * radius, y: 0, rotationY: Math.random() * Math.PI * 2 });
    world.add(piece, Renderable, { shape: 'model', assetId, scale: 0.85 + Math.random() * 0.3 });
    world.add(piece, CampDecor, { camp });
  }

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
      fireRange: lv.fireRange,
      standoff: lv.standoff,
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
