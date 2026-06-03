# ADR-003: Feature-first `game/src/` structure (three tiers + features)

- **Status:** Accepted — adopted as the organizing axis; migration is staged (see the review for the sequence).
- **Date:** 2026-06-04
- **Context:** PR #25 — the feature-first structure proposal (Option B) and the multi-agent review board that critiqued it.

## Context

`game/src/` was sliced by **architectural role** at the top level (`components/`, `systems/`,
`content/`, `render/`, `ui/`, `input/`, `core/`), each a flat list. At ~74 non-test files this smeared
one mechanic across ~5 folders and — the load-bearing problem — gave **no signal for where new code
belongs**, so the cheapest move for a human *or* an agent was "add one more file to the pile." That
placement entropy (not findability — grep finds a known symbol fine) is the pain this decision addresses.

A review board read the project's full history and critiqued the proposal (11 research artifacts,
4 synthesis briefs, 3 persona reviews). It **verified the evidence** — the internal import fan-in shows
three real tiers (pure engine / domain kernel / feature-local), and the cross-feature graph is
**acyclic** — and recommended adopting feature-first **with alterations**, not as written (verdict:
**(b) ALTER**, unanimous, high confidence). The full evidence, reasoning, dissents, and execution
sequence live in
[`system-review/2026-06-04-feature-first-src-structure/`](system-review/2026-06-04-feature-first-src-structure/)
(start with `board-conclusion.md`); the original proposal is archived in that same folder.

## Decision

Adopt **feature-first** as the organizing axis for `game/src/`: three tiers + features.

- **`core/`** — the ECS engine, **zero game knowledge** (`world`, `types`, `component`, `geometry`).
- **`common/`** — a **strict** domain kernel: shared components, `parts-catalog`, generic sim
  primitives, render infrastructure, input.
- **`features/`** — vertical slices, one folder per mechanic (`drive`, `engine`, `mounting`, `scrap`,
  `storage`, `workshop`, `economy`, `hud`), **tests co-located**.
- **`main.ts`** — the composition root and the **only** cross-feature importer.

The load-bearing rules (the things to stay consistent on):

1. **`common/` admission rule.** A module earns `common/` only when it has **≥2 distinct *feature*
   consumers** *and* carries **no feature-specific semantics**; otherwise it stays in its feature.
   Duplication is cheaper than a wrong promotion (Rule of Three) — the §2 fan-in table is a snapshot,
   this is the standing rule.
2. **Inward-only invariant.** `core/` and `common/` must **never** import from `features/`. (To be
   backed by ESLint `import/no-restricted-paths` as a fast-follow.)
3. **Per-frame feature dispatch lives in `main.ts`, not in a `common/` façade.** The render façade
   (`view.ts`) stays a pure projection; the feature animators — and the per-feature halves of
   `zone-overlays`/`interaction-hints` — are called from `main.ts`. This resolves the one tier
   inversion the proposal's original wording ("`common/render/view.ts` calls them") would otherwise
   have planted on day one.
4. **Path aliases** (`@core` / `@common` / `@features` / `@shared`) are the import convention — they
   decouple import strings from physical depth (a move stops being a cascade of `../` rewrites) and
   disambiguate the in-game `common/` from the repo-root `shared/`.
5. **Placement is written, not implicit.** `AGENTS.md` and the `implement-feature` skill carry a
   one-line "where new code goes" rule; per-feature `CLAUDE.md` files restate single-owner rules at
   the point of edit.
6. **Migrate slice-by-slice** in small PRs — game playable + tests green after each; **scrap first**
   (the most self-contained slice). Earned promotions happen at migration time: split `assembly.ts`
   (pure compute → `common/sim/`), `engine-part` → `common/parts/`, `weight` → `common/sim/`, extract
   `mountedStorages` → `features/storage/`. **Do not** pre-create speculative tiers (`modes/`,
   `scenes/`) or empty feature folders.

## Consequences

- A change scoped to a mechanic touches `features/<x>/` + `common/`, and the acyclic DAG **guarantees**
  no other feature is silently affected — a direct reduction of the side-effect surface for humans and
  agents alike.
- **ADR-001** (`mounting.ts` is the single owner of grid-snap/cell geometry) and **ADR-002** (one
  shared three.js canvas host) are **preserved**: `mounting.ts` moves intact to `features/mounting/`;
  `shared/three-canvas.ts` is repo-root cross-app code and is untouched by the move.
- The structure records **only code that already exists**. New mechanics (combat, restoration, the
  Sanctuary) get folders **when their code is written**; the deferred `GameMode`/scene split, when it
  comes, is a `main.ts` concern, not a slice restructure.
- The decision (the axis + the rules) holds from now; the **migration is staged and not yet executed**
  — until a slice moves, its files keep their current home.

## Anti-pattern this prevents

- **The flat-pile default** — "no obvious home → add one more file to the role-folder pile." A labelled
  feature folder answers "where does this go?" by construction.
- **The shared kitchen-sink** — `common/` quietly absorbing feature-specific code. The admission rule +
  inward-only invariant + lint keep it strict; a one-time fan-in snapshot is *not* enough on its own.
- **The tier inversion** — a `common/` (shared-tier) file importing from `features/`. Dispatch
  per-frame work from `main.ts` instead.
- **Speculative structure** — empty `modes/`/`scenes/`/`combat/` folders an editor (especially an
  agent) feels obliged to wire into. Build a folder when its code exists; let it earn its place.
