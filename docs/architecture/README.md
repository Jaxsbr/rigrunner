# Architecture Decision Records (ADRs)

This folder is the running log of **architectural decisions** for RIGRUNNER — the choices about
*structure* that we want to stay consistent on as the game grows. Each record captures the context,
the decision, and (most importantly) **the bad design it exists to prevent**, so we don't re-litigate
or re-introduce a pattern we already rejected.

ADRs are for cross-cutting structural calls (where a responsibility lives, what the canonical helper
is, which seam owns a concern). They are **not** for feature design — that lives in `docs/ideas.md`,
`docs/milestones.md`, and the `*-spec.md` docs. And they don't replace `CLAUDE.md`, which remains the
source of truth for project rules and the core loop.

## Convention

- One decision per file, named `adr-NNN-short-slug.md`, where `NNN` is a zero-padded number that
  **increments by one each time** — `adr-001`, `adr-002`, `adr-003`, … Numbers are never reused.
- Use the next free number; never renumber existing records.
- A decision that replaces an earlier one doesn't edit it — it gets its own new ADR and marks the old
  one `Superseded by ADR-NNN` in its Status line (the history stays readable).
- Keep each record short. Link to the code/PR rather than pasting large diffs.

Use the shape of the existing records as the template: **Status · Date · Context · Decision ·
Consequences · Anti-pattern this prevents.**

## Index

| ADR | Title | Status |
|-----|-------|--------|
| [001](adr-001-canonical-grid-snap.md) | One canonical grid-snap; `mounting.ts` owns cell geometry | Accepted |
| [002](adr-002-shared-three-canvas-host.md) | One shared three.js canvas host for 3D widgets | Accepted |
| [003](adr-003-feature-first-src-structure.md) | Feature-first `game/src/` structure (three tiers + features) | Accepted |
| [004](adr-004-semantic-snapshot-persistence.md) | Persistence is a semantic snapshot, not a component dump | Accepted |
