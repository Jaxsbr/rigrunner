# `features/tracks/` — terrain tread trails

Everything that drives presses a fading tread trail into the ground. The whole feature is view-only —
open this folder and you see it end to end:

- **`track-stamp.ts`** — the pure geometry of WHERE to lay marks: even spacing off position-delta, with
  first-sight + teleport guards. No THREE / no DOM, so it is unit-tested headless (`track-stamp.test.ts`).
- **`track-marks.ts`** — `TrackMarks`, a render-layer collaborator (the `ScrapStains`/`CampStains`
  pattern): it turns those stamps into soft tread-band decals, fades them out over their lifetime, and
  caps the live count. Built against the scene and `sync(world, dt)`-dispatched from `main.ts`.

Single-owner / placement rules at the point of edit:

- **It reads the sim, never mutates it.** Marks are laid from `Transform` position-delta over the shared
  `TrackEmitter` (`@common/components`) marker — NOT from any reported heading (a guard backing off
  faces the rig but moves away; the delta is the truth). Destroy this layer and the sim is unaffected.
- **`TrackEmitter` lives in `@common/components`, not here.** It is shared vocabulary set by the rig
  assembly (`mounting/rig.ts → chassisToRig`) and the camp spawner (`camps/camp-spawn.ts`); this slice
  only consumes it. A new kind of mover leaves tracks by getting the marker — no change here.
- **This is the seam the future restoration "life-trail" plugs into.** An earned trail-laying part will
  extend `TrackEmitter` (a style/tier, a consumed resource) so driving greens the ground. Keep the
  emitter the single descriptor; don't grow restoration logic in the renderer until that part exists.
- **Cross-feature (ADR-003):** depends downhill only on `@common`/`@core`. `@common`/`@core` never
  import tracks; per-frame dispatch is from `main.ts`.
