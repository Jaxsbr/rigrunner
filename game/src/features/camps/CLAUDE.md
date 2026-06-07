# `features/camps/` — the looter-camps slice (the game's first flee-or-fight)

The whole looter-camp mechanic lives here ([spec](../../../../docs/specs/looter-camps-spec.md)): rig
`Health`-based combat, a purchasable auto-fire **weapon**, travelling **projectiles** (rig + enemy),
**enemies** with detect→engage→pursue→retreat AI, the **`Camp`** objective state machine, the
data-driven **levels** + **loot**, the purchasable **trap arm** + its **disarm puzzle**, the camp's
**stains**, and the **restoration-site** handoff. Open this folder and you see the fight end to end.
(Phases 1–2 of 4 built — see the spec's build phases.)

What's here:

- **Components:** `projectile` (+ `spawnProjectile`), `weapon` (per-gun firing state), `enemy`
  (`Enemy` + `EnemyAI`), `camp`, `restorable-site`.
- **Content (data):** `combat` (rig-side tuning constants), `camp-levels` (`CAMP_LEVELS` — a level is
  a data row), `camp-loot` (`CAMP_LOOT` + `rollCampLoot`/`rollCampLootForOutcome`), `disarm` (the trap
  arm's per-tier puzzle difficulty + the pure outcome maths: `gradeDisarm`, `disarmDamage`).
- **Systems:** `weapon-fire-system`, `projectile-system` (travel + expiry), `combat-system`
  (hits + ram, over the shared collision pairs), `enemy-ai-system`, `camp-system` (state machine +
  the outcome-aware `resolveDisarm` payout), `disarm-gate` (the proximity gate: a DISARMABLE camp in
  reach + the rig's mounted trap-arm head tier), `repair-system`, plus `camp-spawn` (the builder).
- **Render** (dispatched from `main.ts`, never from `@common/render`): `camp-stains`, `weapon-animator`
  (the barrel swivel), `trap-arm-animator` (the disarm-head idle sway). `disarm-overlay` is the
  timing-puzzle UI (a sim-freezing overlay, like the loot popup).

Single-owner / placement rules at the point of edit:

- **`Health`, `Projectile`, `Weapon`, `Enemy`, `Camp` are camp-owned for now.** `Health` is the one
  exception promoted to `@common/components` — it's a rig-level aggregated stat (`@common/sim/health`
  `rigMaxHealth`) with two feature consumers (the rig assembly sets it, combat spends it), like
  `Weight`. Keep the rest in-feature until a SECOND feature consumer earns a `@common` promotion
  (Rule of Three) — don't pre-promote.
- **Combat hits go through the shared collision finder** (`@common/sim/collision`) — camps was the
  second consumer that earned its promotion out of scrap. `main.ts` runs the finder ONCE and hands the
  pairs to both scrap collection and `combatSystem`; don't add a second collision pass.
- **The trap arm is a composed product like the weapon** — its parts (`trap-boom` host + `disarm-head`)
  live in `@common/parts` (identity/recipe/cost), NOT here; camps owns only the disarm *behaviour*. The
  disarm difficulty rides the HEAD's tier, read off the mounted product via `productSubPartTiers`
  (`@common/sim/assembly`) in `disarm-gate` — the boom is just the host. There is NO trap-arm component:
  the gate reads `Part.kind === 'trap-arm'` + a `Mount` on the rig directly (the Reclaimer pattern).
- **The disarm overlay owns the puzzle, the sim owns the payout.** `disarm-overlay` runs the timing
  mini-game and grades it; the moment it finishes it calls `resolveDisarm` (in `camp-system`) to apply
  loot + damage + clear the camp. The overlay never mutates the World itself — `main.ts` wires its
  `onResolve`/`announce` callbacks. Loot still flows through the shared `LootDrop` + loot overlay.
- **The weapon's fire cone reuses `@common/sim/fov`** (`facingWithinFov`, promoted alongside collision)
  — the same cone the Reclaimer's dig gate aims through.
- **Loot rolls through the shared roller** (`@common/sim/loot` `rollTable`/`rollCount`) over the
  camp's OWN `CAMP_LOOT` table, and pays out via the shared `LootDrop` (`@common/components`) + scrap's
  loot-overlay. Camps does NOT import scrap; both features meet at `@common`.
- **Cross-feature direction (ADR-003):** camps depends downhill only on `@common`/`@core`. It must NOT
  import `scrap`/`workshop`/etc.; anything it needs from another feature is passed in by `main.ts`
  (e.g. the workshop-zone `safe` flag → `repairSystem`). `@common`/`@core` never import camps.
- **Render reads state, never mutates it.** The barrel swivel reads `Weapon.aimYaw` (set by the fire
  system); the stains read `Camp.state`. The model never feeds the sim.

Phase seams not built yet (don't wire them prematurely — see the spec): **Phase 3** camp-stains +
restoration polish (the large stains that fade on clear, the visible stump/soil prop on the
`RestorableSite`), **Phase 4** more camp levels (new `CAMP_LEVELS` rows, each visually distinct, +
the scaling-enemy hook); **armour/shield parts** (the `Health.max` aggregation seam in
`@common/sim/health`), **per-tier weapon combat scaling**, and the **restoration investment** (only
the `RestorableSite` marker is emitted — nothing consumes it).

Phase 2 build note (the trap arm + real disarm — decided in a 2026-06-07 grill): disarm is a timing
sweet-spot in a sim-freezing overlay, opened by **E** on a `DISARMABLE` camp in range with a trap arm
mounted (**proximity-only gate — no FOV-aim**, a deliberate deviation from spec §5: the disarm is a
safe, post-combat act, so aiming the arm would be ceremony; the arm still articulates for feel). The
HEAD tier sets difficulty (`disarm.ts`: rusty 3×narrow / iron 1×wide). You play all N rounds and tally
hits → success / partial / fail; **all three CLEAR the camp** (one-shot — a fail permanently loses that
camp's loot), differing only in loot (success = full, partial = common + half scrap, fail = none) and
rig damage (partial 15 @ 50%, fail 30). Opening the overlay is free (Esc backs out); the first Space
commits.
