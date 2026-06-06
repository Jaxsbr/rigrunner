# RIGRUNNER — Looter Camps: enemies around a structure (spec + plan)

**What this is:** the detailed design + phased implementation plan for **looter camps** — the game's
first **flee-or-fight** content (the candidate **Option D** in
[`milestones.md`](../milestones.md)). This is the structured home for the feature; the high-level
intent and its place in the dependency chain stay in `milestones.md`.

> **Status:** 🚧 **Draft skeleton — to be fleshed out.** The headings below are the shape of the spec;
> the content is a seed pulled from the Option D candidate definition. Nothing here is decided beyond
> what `milestones.md` already carries. Promote settled mechanics into `CLAUDE.md` once they ship.

---

## Essence (the one-liner)

A hostile **structure** surrounded by a few simple **enemies** — the first real *flee-or-fight*, and
the first thing whose **clearing** the world can later react to. Engage or evade; clearing it **drops
loot** and flips the camp to a **`cleared` state**.

---

## 1. Scope — the deliberately-minimum first cut

> Per `milestones.md`: build a **small system that stands on its own**, not the cross-system
> integration. One small, clearable camp that drops loot and announces it's cleared.

- _TBD — what the minimum playable slice is (a single fixed camp, one enemy type, simplest combat that
  proves the pillar)._

## 2. The camp (structure + state)

- _TBD — the camp as a world object: its structure/asset, its placement, and its state machine
  (`active` → `cleared`)._
- _TBD — what "clearing" means (all enemies defeated? structure destroyed?)._

## 3. Enemies

- _TBD — the first enemy type: behaviour, how it threatens the rig, how it can be defeated (driven
  over / shot)._
- _TBD — a `difficulty-scalar` hook on the enemy: fixed for now, but stat-driven so a future scaling
  system can drive it (a seam, not a built mechanic)._

## 4. Combat — offense & defense

- _TBD — the simplest combat that proves flee-or-fight: a directional weapon part (reuses the pillar-3
  "fires where it faces" precedent the Reclaimer established), projectiles, and damage to the rig._
- _TBD — defense: how the rig takes / survives damage, and the build choices that matter (armour vs
  speed vs firepower vs cargo)._
- _TBD — how this ties back to the central weight tradeoff (offense/defense cost weight)._

## 5. Loot & drops

- _TBD — clearing a camp drops loot. **Reuses Option C's `loot-table` data seam** — no new drop
  system; a camp is just another roll-on-a-table source._

## 6. Interface seams (architect for, don't build)

> Name the hooks that let future systems plug in later — **don't build the wiring now.**

- **Drops reuse Option C's loot table** — already a data seam.
- **A `cleared` signal** the camp emits on defeat — a flag/event **restoration** can later subscribe to
  (clear a camp → heal the ground around an old stump) **without Option D knowing anything about
  restoration**. The camp just publishes "I'm cleared," nothing more.
- **A difficulty-scalar hook** on the enemy for the future scaling-enemy / defensive-progression system.

## 7. Deliberately NOT in scope

- Enemy scaling, vehicle enemies / advanced AI, restoration wiring, multi-camp world placement.
- _TBD — anything else cut to keep the first slice minimum._

## 8. Open questions (flagged, not answered)

- _TBD — combat model (real-time aim? auto-fire when facing? projectile vs hitscan?)._
- _TBD — can you flee a camp once engaged, or does it pursue?_
- _TBD — what does "defeat" feel like for the player (death/respawn? limp home?) — touches the deferred
  run-lifecycle / `GameMode` question (`ideas.md` 2026-06-01)._

## 9. Per-PR plan

- _TBD — the PR-by-PR staircase (model the shape on `option-c-build-plan.md`), each step playable +
  tests green._

---

## Depends on / pairs with

- **Reuses** Option C's `loot-table` seam (shipped) for drops.
- **Needs** the rig's weapon/defense parts (offense/defense axes — currently unbuilt).
- **Feeds** the restoration through-line (M4 — camp-to-restored-ground) via the `cleared` signal.
