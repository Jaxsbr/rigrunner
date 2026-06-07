import { defineComponent } from '@core/component';
import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { Collider } from '@common/components/collider';
import { Renderable } from '@common/components/renderable';
import { PROJECTILE } from './combat';

/** Which side fired a shot — a projectile only damages the OTHER team (no friendly fire). */
export type Team = 'rig' | 'enemy';

/**
 * A travelling shot. ONE component serves both the rig's weapon and enemy fire, so the same hit code
 * (`combatSystem`, over `@common/sim/collision` pairs) resolves rig→enemy and enemy→rig — the team is
 * all that differs. It moves at a constant planar velocity (`vx`,`vz`) and expires after `ttl` seconds
 * (range ÷ speed), so a missed shot doesn't fly forever. Shots travel, so a moving target can be
 * dodged and your own shots can miss.
 */
export interface Projectile {
  team: Team;
  damage: number;
  vx: number;
  vz: number;
  ttl: number;
}

export const Projectile = defineComponent<Projectile>('Projectile');

/** Tracers fly at roughly gun/turret height so they read as shots, not ground scuffs. */
const PROJECTILE_Y = 0.8;

/**
 * Spawn a travelling shot from (sx,sz) aimed at the target's CURRENT position (tx,tz): its velocity is
 * the unit heading × `speed`, and it lives `range / speed` seconds so it carries exactly to its range.
 * Aiming at the present position (not leading) is what lets a moving target dodge. A readable box tracer
 * tinted by team; it carries a Collider so the shared collision finder reports its hits like any contact.
 */
export function spawnProjectile(
  world: World,
  team: Team,
  sx: number,
  sz: number,
  tx: number,
  tz: number,
  speed: number,
  damage: number,
  range: number,
): EntityId {
  const dx = tx - sx;
  const dz = tz - sz;
  const len = Math.hypot(dx, dz) || 1; // a zero-length aim (target on top of us) fires straight ahead
  const ux = dx / len;
  const uz = dz / len;
  const e = world.createEntity();
  world.add(e, Transform, { x: sx, z: sz, y: PROJECTILE_Y, rotationY: Math.atan2(-ux, -uz) });
  world.add(e, Projectile, { team, damage, vx: ux * speed, vz: uz * speed, ttl: range / speed });
  world.add(e, Collider, { radius: PROJECTILE.radius });
  world.add(e, Renderable, {
    shape: 'box',
    size: { x: 0.18, y: 0.18, z: 0.6 },
    color: team === 'rig' ? PROJECTILE.rigColor : PROJECTILE.enemyColor,
  });
  return e;
}
