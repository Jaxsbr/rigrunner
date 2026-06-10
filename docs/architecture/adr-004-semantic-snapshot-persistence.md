# ADR-004: Persistence is a semantic snapshot, not a component dump

- **Status:** Accepted
- **Date:** 2026-06-10
- **Context:** PR #67 — Phase 0 of [`real-world-and-progression-spec.md`](../specs/real-world-and-progression-spec.md). The real game needs a save; the question was *how the save represents the world*.

## Context

A persistent real world (the spec's pillar — "the world remembers what you did to it") needs to
serialize the durable state — banked + unbanked scrap, the rig and its mounted loadout, the inventory,
and world content (piles still standing, camps still guarded, stumps already healed). The rig and the
inventory are **composed-entity graphs** (a chassis is a product of tiered sub-parts, with more products
mounted onto it by cell); a healed site is a **re-spawned `RestorableSite` stump**. So "just serialize
the world" has a real design fork, with three candidates:

- **A — Semantic snapshot.** Describe durable things in the game's OWN vocabulary (a recipe + its
  sub-parts at their tiers; a site's position + state + growth). Continue rebuilds the world from the
  save through the real constructors; New Game runs the authored cold-open.
- **B — Delta over a deterministic re-seed.** Continue re-runs the cold-open seed, then patches in saved
  changes. Tiny save, but it couples the save to a re-runnable deterministic seed and needs a stable
  site-identity tag to map deltas back onto re-seeded entities.
- **C — Generic ECS component snapshot.** Serialize an allow-list of components across all entities by
  id; remap id-edges and rebuild references on load.

## Decision

**Adopt A — the semantic snapshot.** The save describes facts in the game's vocabulary; the world is
rebuilt through the *same* construction code the bench and the world-seed use
(`buildProduct`/`chassisToRig`/`mountPart`/`spawnScrapPile`/`spawnCamp`), never a parallel deserializer.

- The reusable kernel — `describeProduct`/`rebuildProduct`/`describeItem`/`rebuildItem` — lives in
  `@common/sim/serialize` (≥2 consumers: rig + inventory, no feature semantics).
- Each feature owns the description of its OWN durable state (`describeScrapPiles`, `describeCamps`,
  `describeStumps`), co-located with that feature's spawner.
- The orchestration — folding the per-feature pieces into one `GameSnapshot` and replaying it — lives in
  the `app/` composition-root tier (`app/snapshot.ts`), the only place allowed to reach across features.
- The real-game scenario splits at the save seam: `seedStaticWorld` (workshop/bench — not progress, run
  by both New Game and Continue) vs `seedNewGameContent` (the starting progress a save carries). Continue
  is `seedStaticWorld` + `restoreSnapshot`, never the cold-open content.
- A `SNAPSHOT_VERSION` gates evolution; a mismatched save reads as "no save".

## Consequences

- **Rebuild reuses the real constructors**, so a restored product/rig is identical to a freshly-built
  one — there is no second code path to drift, and the invariants those constructors bake (capability
  components, health, colliders) are re-derived, never persisted.
- **No entity-id remapping and no runtime-state leak:** the save holds only facts (recipes, tiers,
  cells, positions, growth, container amount), so gate flags, in-flight projectiles, live enemy
  positions, and work timers simply never enter it. They reset on load, which is correct.
- **Scales to the larger Phase-3 world:** the snapshot describes whatever exists, authored or generated;
  it does not assume a re-runnable deterministic seed (the weakness that ruled out B).
- **Cost — it is "manual":** each new durable mechanic must add its own describe/respawn pair. This is
  the accepted price; a small per-feature seam beats a fragile generic engine. Watch for a mechanic that
  ships durable state but forgets its describe/respawn (it silently won't persist).
- **The four-place conservation invariant is fully captured.** A part lives in exactly one of four
  places (`bench.ts`/`staging.ts`): mounted on a chassis, staged on the workshop deck, in a bench slot,
  or in the inventory — the snapshot captures all four, so an owned part is never dropped on save
  regardless of where the player parked it (e.g. a container mid-drain on the deck, parts mid-build on
  the bench).
- **Deliberately not durable (v1):** rig HP + boost heat (a reload repairs), loose ground scrap (a
  one-time New-Game starter, not re-laid on Continue so a reload can't farm it), products/kits dropped
  **loose on the ground** (not on a rig, deck, bench, or in inventory), and mid-combat/mid-clear
  progress (a save is never a half-fought fight).

## Anti-pattern this prevents

**Serializing the engine's data shapes instead of the game's facts** (candidate C). Dumping raw
components by entity id forces a standing subsystem to remap every entity-reference edge (`Mount.host`,
`Assembly.parts`, camp decor back-links) and to maintain a strict *exclusion* list so derived/transient
state (the `active` gate, `worked`/`elapsed` timers, `Velocity`, projectiles, `Deploying`) doesn't leak
into the save — and it persists *data shapes that churn* rather than *semantic facts that are stable*,
making every component rename a migration. The save should speak the game's language (recipes, tiers,
positions, growth), and the game's own constructors should put the world back.
