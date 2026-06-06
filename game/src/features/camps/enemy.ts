import { defineComponent } from '@core/component';
import type { EntityId } from '@core/types';

/**
 * A camp guard. Each enemy is its OWN entity with its OWN `Health`, so the camp is cleared one at a
 * time. `camp` is the camp it guards — the camp's clear check counts surviving enemies that point at
 * it, and the AI's leash is measured from the camp, not the enemy's post.
 */
export interface Enemy {
  camp: EntityId;
}

export const Enemy = defineComponent<Enemy>('Enemy');

/** The guard's behaviour state: at post → chasing+firing → falling back to post. */
export type EnemyState = 'guard' | 'engage' | 'retreat';

/**
 * The guard's AI + combat tuning, stamped from the camp's level row at spawn so the system reads
 * everything off the entity (no per-frame table lookup). `GUARD` at its post until the rig enters
 * `detection`; `ENGAGE` (pursue + fire) until the rig is past `leash` measured FROM THE CAMP; `RETREAT`
 * back to (`postX`,`postZ`) and resume the guard. Pursuit and the camp-anchored leash are the per-level
 * knobs.
 */
export interface EnemyAI {
  state: EnemyState;
  postX: number;
  postZ: number;
  detection: number;
  leash: number;
  moveSpeed: number;
  damage: number;
  fireInterval: number;
  projectileSpeed: number;
  fireCooldownLeft: number;
}

export const EnemyAI = defineComponent<EnemyAI>('EnemyAI');
