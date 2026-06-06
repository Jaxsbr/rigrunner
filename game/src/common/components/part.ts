import { defineComponent } from '@core/component';

/**
 * Marks an entity as a *part* — a discrete module the player grabs, carries, and mounts onto a
 * rig's deck. `kind` is the open vocabulary of part types ('engine', 'storage', 'reclaimer',
 * 'chassis', 'weapon' today; more as they earn their place). New kinds are new string values plus the
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
 * `footprint` is how many deck cells the part occupies, anchored at its Mount's (col, row) and
 * spanning right/back from there. Absent ⇒ a single 1×1 cell (the common case). A chassis kit is
 * 2×2 — the packed form the player stages and hauls out (`CHASSIS_KIT_FOOTPRINT` in
 * `@common/components/chassis`); mounting's occupancy and snap honour the whole region (see
 * `@features/mounting/mounting`).
 */
export type PartKind = 'engine' | 'storage' | 'reclaimer' | 'chassis' | 'weapon';

export interface Part {
  kind: PartKind;
  /** Deck cells occupied, anchored at the Mount cell. Absent ⇒ 1×1. */
  footprint?: { cols: number; rows: number };
}

export const Part = defineComponent<Part>('Part');
