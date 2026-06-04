import { defineComponent } from '@core/component';

/**
 * A circular collision footprint, centred on the entity's Transform. Driving is planar (the
 * sim only ever touches x/z), so a *circle* — one radius — is the cheapest shape that still
 * respects the rig's changing silhouette: the chassis and every mounted part each carry their
 * own Collider, so the rig's collision area is the union of those circles and grows/shrinks as
 * parts go on and off.
 *
 * It is deliberately a bare capability with no notion of *what* it collides with. The collision
 * system (systems/collision.ts) just reports overlapping pairs; meaning is assigned by whoever
 * consumes them — scrap collection today, projectile damage later — so this one component serves
 * every collision use without growing layers/masks before we need them.
 */
export interface Collider {
  radius: number;
}

export const Collider = defineComponent<Collider>('Collider');
