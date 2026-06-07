# `features/camps/` — the looter-camps slice (the game's first flee-or-fight)

The whole looter-camp mechanic lives here ([spec](../../../../docs/specs/looter-camps-spec.md)): rig
`Health`-based combat, a purchasable auto-fire **weapon**, travelling **projectiles** (rig + enemy),
**enemies** with detect→engage→pursue→retreat AI, the **`Camp`** objective state machine, the
data-driven **levels** + **loot**, the camp's **stains**, and the **restoration-site** handoff. Open
this folder and you see the fight end to end. (Phase 1 of 4 — see the spec's build phases.)

What's here:

- **Components:** `projectile` (+ `spawnProjectile`), `weapon` (per-gun firing state), `enemy`
  (`Enemy` + `EnemyAI`), `camp`, `restorable-site`.
- **Content (data):** `combat` (rig-side tuning constants), `camp-levels` (`CAMP_LEVELS` — a level is
  a data row), `camp-loot` (`CAMP_LOOT` + `rollCampLoot`).
- **Systems:** `weapon-fire-system`, `projectile-system` (travel + expiry), `combat-system`
  (hits + ram, over the shared collision pairs), `enemy-ai-system`, `camp-system` (state machine +
  payout), `repair-system`, plus `camp-spawn` (the builder).
- **Render** (dispatched from `main.ts`, never from `@common/render`): `camp-stains`, `weapon-animator`
  (the barrel swivel).

Single-owner / placement rules at the point of edit:

- **`Health`, `Projectile`, `Weapon`, `Enemy`, `Camp` are camp-owned for now.** `Health` is the one
  exception promoted to `@common/components` — it's a rig-level aggregated stat (`@common/sim/health`
  `rigMaxHealth`) with two feature consumers (the rig assembly sets it, combat spends it), like
  `Weight`. Keep the rest in-feature until a SECOND feature consumer earns a `@common` promotion
  (Rule of Three) — don't pre-promote.
- **Combat hits go through the shared collision finder** (`@common/sim/collision`) — camps was the
  second consumer that earned its promotion out of scrap. `main.ts` runs the finder ONCE and hands the
  pairs to both scrap collection and `combatSystem`; don't add a second collision pass.
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

Phase seams not built yet (don't wire them prematurely — see the spec): the **trap arm + real disarm**
(Phase 1 auto-succeeds the instant the last guard dies), **armour/shield parts** (the `Health.max`
aggregation seam in `@common/sim/health`), **per-tier weapon combat scaling**, and the **restoration
investment** (only the `RestorableSite` marker is emitted — nothing consumes it).
