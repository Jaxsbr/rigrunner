import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { Collider } from '@common/components/collider';
import { TrackEmitter } from '@common/components/track-emitter';
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
  const camp = spawnCampStructure(world, x, z, level);
  // The guard ring — distributed around the camp, each watching outward from its post.
  for (let i = 0; i < lv.enemyCount; i++) {
    const angle = (i / lv.enemyCount) * Math.PI * 2;
    spawnGuardAt(world, camp, x + Math.cos(angle) * GUARD_RING_RADIUS, z + Math.sin(angle) * GUARD_RING_RADIUS, level);
  }
  return camp;
}

/**
 * The camp without its guards: the `Camp` objective entity + its standing structure (cache, tent) and
 * scattered debris. Split out from `spawnCamp` so a partially-cleared camp can be rebuilt from a save
 * with only its SURVIVING guards (a killed guard stays dead across a reload — `spawnCampFromSave`).
 */
function spawnCampStructure(world: World, x: number, z: number, level: number): EntityId {
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

  return camp;
}

/** Spawn one guard for `camp` at its post (x,z), watching outward from the camp centre, at full health. */
function spawnGuardAt(world: World, camp: EntityId, x: number, z: number, level: number): EntityId {
  const lv = campLevel(level);
  const ct = world.get(camp, Transform)!;
  const e = world.createEntity();
  // Face outward from the camp centre (front is local −Z): a guard watching the approach.
  world.add(e, Transform, { x, z, y: 0, rotationY: Math.atan2(-(x - ct.x), -(z - ct.z)) });
  world.add(e, Enemy, { camp });
  world.add(e, EnemyAI, {
    state: 'guard',
    postX: x,
    postZ: z,
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
  // A small tread gauge so a guard presses a narrow trail as it kites (features/tracks).
  world.add(e, TrackEmitter, { width: 0.55 });
  world.add(e, Renderable, { shape: 'model', assetId: 'enemy' });
  return e;
}

// ── Persistence (the durable half of a camp) ─────────────────────────────────────────────────────

/** A surviving guard's post — where it returns to and watches from. */
interface GuardSave {
  x: number;
  z: number;
}

/** A standing camp's saved state: its position, level, and the guards STILL ALIVE (a kill is durable). */
export interface CampSave {
  x: number;
  z: number;
  level: number;
  guards: GuardSave[];
}

/**
 * Describe every camp still worth saving — those not yet cleared (a cleared camp is represented by the
 * sprout it left, saved on the restoration side). Captures only the guards STILL ALIVE: a killed guard
 * is `destroyEntity`'d, so it simply isn't in the world to capture — its death persists. In-progress
 * guard HP/AI is not checkpointed (survivors come back at their post, full health), the same way the
 * rig's HP resets on load — deaths are durable, a half-fought fight is not.
 */
export function describeCamps(world: World): CampSave[] {
  const out: CampSave[] = [];
  for (const c of world.query(Camp, Transform)) {
    const camp = world.get(c, Camp)!;
    if (camp.state === 'cleared') continue;
    const t = world.get(c, Transform)!;
    const guards: GuardSave[] = [];
    for (const e of world.query(Enemy, EnemyAI)) {
      if (world.get(e, Enemy)!.camp !== c) continue;
      const ai = world.get(e, EnemyAI)!;
      guards.push({ x: ai.postX, z: ai.postZ });
    }
    out.push({ x: t.x, z: t.z, level: camp.level, guards });
  }
  return out;
}

/**
 * Respawn a camp from its save with ONLY its surviving guards. A camp whose guards were all killed
 * comes back with none and is marked `disarmable` directly — so a fully-fought camp opens straight to
 * its disarm instead of re-arming every guard you'd already cleared.
 */
export function spawnCampFromSave(world: World, d: CampSave): EntityId {
  const camp = spawnCampStructure(world, d.x, d.z, d.level);
  for (const g of d.guards) spawnGuardAt(world, camp, g.x, g.z, d.level);
  if (d.guards.length === 0) world.get(camp, Camp)!.state = 'disarmable';
  return camp;
}
