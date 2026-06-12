import { defineComponent } from '@core/component';

/**
 * Opt-in marker: this entity's Collider BLOCKS movers. A driven rig that overlaps a Solid is pushed
 * back out to the surface by the collision response (`@features/drive/collision-response`); the
 * existing collision detection only ever REPORTS overlaps, so blocking is a separate capability.
 *
 * It is deliberately split from Collider, mirroring the Collectible split (footprint vs. what a contact
 * means): a Collider alone is just a physical footprint, and most footprints must stay pass-through —
 * loose scrap is collected by driving over it, enemy guards and projectiles are rammed/damaged. Blocking
 * is therefore something a structure asks for by ALSO carrying Solid, never implied by having a Collider.
 *
 * Any future blocker — a boulder, a wreck, a wall segment — becomes solid by gaining this tag, and the
 * response system needs no change. A tag (no data) because "is this solid?" is all the response asks; the
 * footprint itself lives on the Collider.
 */
export const Solid = defineComponent<true>('Solid');
