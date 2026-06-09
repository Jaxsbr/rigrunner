# `features/restoration/` — the stump-healing slice

The restoration mechanic lives here: the player swaps the Reclaimer's digging bucket for a **stump-healer**
head and grows a cleared-site stump back into a young tree. It is the first consumer of the
`RestorableSite` marker that cleared scrap piles and looter camps have always emitted (the shared
restoration seam) — so a stump from EITHER source heals through one path. Open this folder and you see the
heal end to end. It is scrap's rummage sibling: the same capability-gated, hold-to-work grammar, only the
tool (stump-healer head), the target (a stump), and the payoff (a tree + greenery, not loot) differ.

What's here:

- **Component:** `healable` (`Healable {growth, active}`) — the sim truth the render reads. `growth` 0→1 is
  how far a stump has been grown (only ever rises); `active` is the per-frame gate flag the "Hold E" prompt
  + proximity disc light off.
- **System:** `restoration-system` (`restorationSystem`) — tags every `RestorableSite` `Healable`,
  recomputes each stump's gate (rig in reach + a stump-healer Reclaimer aimed at it within an FOV + not yet
  fully grown), and turns a held work key into the grow: it marks the healer `ReclaimerWorking` (the arm
  deploys + animates) and advances `growth`. Pure over the World; runs headless.
- **Render** (dispatched from `main.ts`, never from `@common/render`): `tree-grower` (the procedural young
  tree that rises out of a stump, posed off `Healable.growth` across three growth stages), `restoration-stains`
  (the green moss+grass regrowth patch under a stump, on the shared `@common/render/ground-stains` engine —
  deepening with growth), and the `overlays` adapter (`healDiscs` — the proximity ring under a healable
  stump, fed to the shared `ZoneOverlays`). `heal-prompt` is the bottom-centre "Hold E" HUD cue (the
  `ScrapPrompt`/`DisarmPrompt` sibling).

Single-owner / placement rules at the point of edit:

- **The bucket↔healer head split keeps scrap's rummage and this heal mutually exclusive on any one arm.** A
  Reclaimer has a single `head` slot, so it is EITHER a digger (bucket) or a healer (stump-healer), never
  both. Scrap's `mountedReclaimer` excludes a stump-healer head; this slice's `mountedHealer` requires it.
  So only one system ever drives the shared `@common/components/reclaimer-working` marker for a given arm —
  no contention. That marker is shared (it was promoted out of scrap when restoration became its second
  consumer): it means "the reclaimer arm is working", which is not scrap-specific.
- **The head a Reclaimer carries is read via `reclaimerHeadPartId`** (`@common/sim/assembly`) — the same
  seam the render layer maps to the head GLB (bucket vs stump-healer on the wrist socket). Don't re-walk the
  `Assembly` for the head; reuse that helper.
- **Render reads state, never mutates it.** The tree-grower poses meshes from `growth`; the green patch
  eases toward a `growth`-scaled strength. Neither feeds the sim. The growing tree is parented under the
  stump's own render object, so it inherits the stump's pose (including its rise-from-soil animation).
- **Cross-feature direction (ADR-003):** restoration depends downhill only on `@common`/`@core` (the shared
  `RestorableSite`, `ReclaimerWorking`, `ground-stains`, `assembly`, `fov`). It must NOT import `scrap`/
  `camps`; both merely EMIT the `RestorableSite` it consumes, at the shared seam. `@common`/`@core` never
  import restoration; `main.ts` dispatches its per-frame render + system.

The stump-healer part itself (identity/recipe-slot/cost/GLB) lives with the other parts in `@common/parts`
+ `shared/` (the `head`-slot sibling of `reclaimer-bucket`), NOT here — this slice owns only the heal
*behaviour*, like camps owns disarm behaviour but not the trap-arm parts.
