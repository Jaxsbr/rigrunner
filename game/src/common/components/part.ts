import { defineComponent } from '@core/component';

/**
 * Marks an entity as a *part* — a discrete module the player grabs, carries, and mounts onto a
 * rig's deck. `kind` is the open vocabulary of part types ('engine', 'storage', 'reclaimer',
 * 'chassis' today; 'gun', … as they earn their place). New kinds are new string values plus the
 * systems that give them meaning — never new subclasses.
 *
 * 'chassis' is the odd one out: it is composed on the bench like the others, but it is not mounted
 * ONTO a rig — it BECOMES the rig's foundation (it carries the deck the other parts mount onto). See
 * `@common/components/chassis.ts`.
 *
 * A part is a first-class world entity (Transform + Renderable). It is *loose* when it has no
 * Mount (sitting in the world), and *mounted* when it has a Mount pointing at a rig cell — at
 * which point the mounting system rides it along with that rig.
 *
 * Footprint is a single 1×1 cell for now; multi-cell parts can add a size field here later
 * without disturbing callers.
 */
export type PartKind = 'engine' | 'storage' | 'reclaimer' | 'chassis';

export interface Part {
  kind: PartKind;
}

export const Part = defineComponent<Part>('Part');
