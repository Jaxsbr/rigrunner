# Board Conclusion — Review of the Feature-First `src/` Structure Proposal

> **The board's verdict on the feature-first `src/` structure proposal (Option B)** — now graduated into [ADR-003](../../adr-003-feature-first-src-structure.md); the reviewed proposal is archived alongside this file as [`feature-first-structure-proposal.md`](feature-first-structure-proposal.md).
> Collated by the orchestrator from 11 research artifacts, 4 synthesis briefs, and 3 persona reviews.
> **Date:** 2026-06-04 · **Branch reviewed:** `idea/feature-first-structure`.

---

## Verdict — (b) ALTER Option B

**Unanimous, high confidence.** Adopt feature-first as the organizing axis — Jaco's lean is
correct — but execute it as **(b) ALTER**, not **(a) approve-as-is**, because the proposal as written
would plant a tier-violating import on day one and omits the single change (path aliases) that turns
the dominant migration cost from *recurring* into *one-time*. None of the required alterations change
the **shape** of Option B; they sharpen seams the proposal already named.

| Voter | Lens | Vote | Confidence |
|---|---|---|---|
| **R1 — AI-Agent Advocate** | agent navigability / placement reliability | **(b)** | high |
| **R2 — Human-Friendly Architect** | long-term maintainability / downhill deps | **(b)** | high |
| **R3 — Indie Game Developer** | shipping velocity / iteration | **(b)** | high |
| S-A — Evidence & migration cost | — | b-alter | — |
| S-B — Architecture theory & peer practice | — | b-alter | — |
| S-C — Agent-driven development fit | — | b-alter | — |
| S-D — Roadmap & game-design fit | — | b-alter | — |

> Of the 11 research lenses, **only L2 (testability) leaned (a)** — and only because its narrow lens
> sees no problem to fix. Every other local and web lens, every synthesis, and every reviewer landed
> on (b). There is **no evidence-backed (c)** on the table (see §7).

---

## 1. Why the axis is approved (the consensus)

Feature-first is the right organizing axis for a ~74-file, single-developer, **agent-driven**,
build-by-discovery ECS/Three.js game. The board's agreement rests on four verified pillars:

1. **The pain is active today, not hypothetical.** `systems/` is 25 files and `components/` 28, each
   a flat list with *no internal grouping and no written placement rule anywhere*. To understand
   "scrap" you open five role-folders and pick the right 4–6 files out of each. The canonical
   layer-first failure modes the literature documents are already exhibited in the live code
   (S-B §1.2). This is "slightly overdue," not premature.
2. **Zero speculative folders.** Every proposed slice (`drive`, `engine`, `mounting`, `scrap`,
   `storage`, `workshop`, `economy`, `hud`) maps to files that exist *on disk today*. The proposal
   names mechanics that already shipped — the textbook precondition for feature-first being safe
   rather than premature (S-B §1.1).
3. **ECS vs feature-first is a false dichotomy.** ECS is a *data model*; feature-first is a *file
   convention* — orthogonal. `core/world.ts` is verified game-agnostic and stays the engine tier;
   where game *systems* physically sit is a navigation decision. Every non-trivial ECS codebase
   surveyed (Bevy plugin crates, sim-ecs, Meta SpatialFeatures) groups systems **with their feature**
   and keeps a thin engine core — exactly Option B's `core / common / features` shape (S-B §2).
   Comparable games confirm it (Slay the Web is the closest spirit-match; shapez.io's
   one-file-per-building shows feature logic gravitating back even inside a role split); **Mindustry**
   is the cautionary type-sliced-at-scale counter-case (S-B §3).
4. **It is the most agent-favourable change available**, and this project is explicitly agent-driven.
   For the feature-local majority (fan-in 1–3), it collapses a ~5-directory exploration into one
   folder, shrinking every fresh agent task's context budget and side-effect surface — a
   *defect-surface-reduction* argument, not an aesthetic one (S-C §1.2, S-B §4.1).

**The evidence the proposal rests on is sound.** S-A re-counted the load-bearing numbers against live
code: **74 non-test files (exact), 314 non-test import lines (exact), `main.ts` 32 imports (exact)**;
the fan-in table is 16/19 exact (the 3 deltas are test-counting artifacts that move no conclusion);
the "three tiers, not two" claim is backed by a real fan-in gap (kernel 7–33 vs feature-local 1–3);
and **the no-cycles DAG is verified** — every cross-feature edge points downhill.

---

## 2. The ALTER payload (the board's agreed changes)

These are the conditions that move the verdict from (a) to (b). None changes Option B's shape; all are
migration-PR checklist items or one-time pre-work.

### A. Resolve the `animators.ts` / `view.ts` dependency inversion **before any file moves** — the must-fix
This is "the one real refactor" the proposal names but leaves open. The proposal's wording
("`common/render/view.ts` calls the feature animators") would, executed verbatim, make the **shared
tier import the feature tier** — a tier inversion on day one, faithfully reproduced by the first agent
that follows the spec. **Fix:** strip the four `animateX` delegates from `RenderView` and call the
animators directly from `main.ts` (the composition root — already dispatching them at `main.ts:232-235`,
so this is near-zero-friction). Apply the same treatment to `zone-overlays.ts` and
`interaction-hints.ts`, which share the identical two-feature (`WorkshopZone` + `ScrapPile`) coupling.
Record the chosen resolution in the graduating ADR. *(All 3 reviewers + S-A §1c/§3 + S-B §6.1 + S-C §4
+ L1/L3/L4 converge — the single most-cited correction in the whole review.)*

### B. Add path aliases (`@core` / `@common` / `@features` / `@shared`) — the highest-leverage omission
The proposal does not mention them; there are **none today** (every import is relative,
`moduleResolution: "bundler"`, no `game/vite.config.ts`). Aliases (a ~10-line vite config + a
`tsconfig paths` block, natively supported) **convert the dominant cost from "forever" to "once"**:
without them, *every future file move* re-pays relative-path depth-churn — and the roadmap is all new
slices and moves. They also **disambiguate `common/` vs the repo-root `shared/` at every import site**
(`@common` ≠ `@shared`) and make tier violations greppable/lintable. *(S-A §4 calls this "the strongest
single reason to ALTER rather than approve as-is.")*

### C. Promote only the **earned** shared code at migration (forced by shipped code, not speculation)
- **Split `assembly.ts` along its existing seam.** Pure computation (`sumPartStats`,
  `resolveEnergyType`, `buildProduct`, `composeProduct`) → `common/sim/assembly.ts`; inventory+bench
  interaction (`assemble`, `dismantle`, `isBenchComplete`, …) stays in `features/workshop/`. **Forced
  today:** `content/engines.ts` and `content/containers.ts` already consume `composeProduct`, so
  leaving all of `assembly.ts` in `workshop/` plants a `engine→workshop` / `storage→workshop` edge on
  day one — and MP (the very next milestone) makes it worse. *(S-D §2.2 — the one structural alteration
  the roadmap forces; L4 concurs.)*
- **Promote `engine-part.ts` / `spawnEnginePart` → `common/parts/`** (rename `spawnCatalogPart`).
  Confirmed consumers include `ui/loot-overlay.ts` (scrap), `shop`, `assembly` — leaving it in
  `features/engine/` plants an undeclared `scrap→engine` edge. *(S-A seam #1.)*
- **Promote `weight.ts` → `common/sim/`** — unambiguous: weight is *the* proven tradeoff axis, ≥2
  consumers. (Not in dispute.)
- **Extract `mountedStorages` from `scrap-collection.ts` → `features/storage/`** — removes the
  undeclared `workshop→scrap` edge and is the one sequencing precondition for a clean scrap pilot.
  *(S-A seam #2.)*

### D. Write down **and** enforce the `common/` admission rule (don't just assert it)
> A module earns `common/` only with **≥2 distinct *feature* consumers AND no feature-specific
> semantics**; otherwise it stays in its feature. **Invariant:** `core/` and `common/` must **never**
> import from `features/`.

This turns the fan-in table from a one-time snapshot into a standing, machine-auditable gate. With a
solo dev and no code review, structural enforcement matters *more*, not less — without it `common/`
drifts into the kitchen-sink that is feature-first's canonical failure mode. Encode in the graduating
ADR; back with ESLint `import/no-restricted-paths` (timing in §4.2). *(S-B §5, S-C §2.1, R1, R2.)*

### E. Write a "where new code goes" placement rule — currently **absent everywhere**
There is **no written placement rule today**; an agent's only placement signal is the *implicit*
role-folder convention. Deleting the role-folders removes that signal — so without writing the
replacement, **a fresh agent is *worse off* immediately post-migration than before.** Add a one-line
rule to `AGENTS.md` ("Where code goes") and the `implement-feature` skill, plus a `common`-vs-`shared`
disambiguation paragraph in `CLAUDE.md`. This is part of the definition-of-done, not a nice-to-have.
*(S-C §2.5 — a gap only the agent lens caught; R1, R3 confirm.)*

### F. Seed per-feature `CLAUDE.md` (the capability Option B *unlocks*)
The flat layout structurally cannot host useful nested instruction files; a feature folder can. Seed
`features/scrap/CLAUDE.md` with the pilot and `features/mounting/CLAUDE.md` when mounting migrates —
the latter to **re-anchor ADR-001's single-owner rule at the point of edit** (today it lives only in an
ADR an agent may never open). *(S-C §2.2 — "the structural multiplier.")*

### G. Fix the 3 stale agent-facing path references in the migration PR
`.claude/skills/blender-asset/SKILL.md` step 4 (`content/` → `features/<feature>/`);
`tools/blender/build_asset.py` L12/59 (`content/assets.ts` → `shared/assets.ts` — **already stale
today**, a pre-existing bug); `tools/blender/assets/workshop.py` L14. Leave historical specs alone —
they are records, not navigation indexes. *(S-C §3.1.)*

### H. Ship scrap-first, then small feature-shaped PRs — never a big-bang
Scrap is the most self-contained slice: **~51 mechanical, TypeScript-caught edits across ~16 files**,
with **3 headless tests** (`scrap-collection`, `scrap-pile`, `loot-table`) that prove it green without
a browser. It exercises every hard part of the migration in miniature. Then proceed one slice per PR,
game playable + tests green after each, with the genuine refactors (animator split, assembly split,
engine-part promotion) **isolated into their own bisectable PRs**. *(S-A §3, R3.)*

### I. Do **not** pre-build a `modes/`/`scenes/` tier or empty feature folders
Combat lands as `features/combat/` *when its code is written*; the Restoration Sanctuary's eventual
`GameMode` split is a `main.ts` composition-root change, **not** a slice restructure. Speculative empty
folders violate "complexity earns its place" and are an agent trap (an agent feels obliged to wire into
any folder that exists). *(S-D §2.5, R1, R3 — unanimous.)*

---

## 3. The two genuine disagreements (surfaced, with the board's resolution)

The board converged on almost everything. Two narrow, principled splits remain — both worth Jaco
seeing rather than papering over.

### 3.1 `collision.ts` — promote to `common/sim/` now, or hold in `scrap/` until combat?
- **Promote now** (S-A seam #3, the proposal's own lean, R3): the system is generic by construction;
  combat will be its 2nd consumer; deciding it before the pilot avoids re-churning scrap's
  `./collision` import later.
- **Hold for combat** (R2 dissents, on strict "earn its place" grounds): `collision.ts` has **exactly
  one feature consumer today** (scrap). Promoting it now is *speculative* — and it fails the very
  admission rule the board is adopting in §2.D (≥2 distinct feature consumers). The Rule of Three says
  hold it in `features/scrap/` and promote in the combat PR; path aliases (§2.B) make that later move
  near-free anyway.

> **Orchestrator's resolution: hold `collision.ts` in `features/scrap/` for now; promote to
> `common/sim/` in the PR that introduces combat.** R2's position is the more internally consistent
> with the admission rule the board is enforcing, and aliases neutralise the "avoid re-churn" argument.
> This is genuinely low-stakes: if Jaco prefers to spare the pilot one cross-tier import flip, promoting
> now is also defensible. **`weight.ts` is *not* in dispute — promote it** (≥2 consumers, the proven axis).

### 3.2 How much convention/enforcement to bundle vs. defer (the "don't let ALTER become a second project" guardrail)
R3 (indie dev) explicitly diverges from the other four on **scope discipline**: the ALTER payload must
not grow faster than the structure it serves. The substance isn't contested — only the sequencing:
- **DROP** per-feature barrel `index.ts` — it was only ever "recommended/additive" (S-C §2.4); R3
  flags speculative cycle/tree-shake risk. → **Dropped.**
- **DEFER** ESLint `import/no-restricted-paths` to a fast-follow *after* the structure settles —
  write the invariant now, lint it once stable. R1/R2 wanted lint backing; R3 says it's a CI surface
  that can stall the move. → **Adopt R3's sequencing** (compatible with R1/R2's intent: the invariant
  is written immediately; enforcement follows).
- **SEED, don't mandate**, per-feature `CLAUDE.md` — scrap + mounting on day one. → **Adopted.**

> **Orchestrator's resolution:** R3's guardrail is a sequencing refinement, not a real conflict — adopt
> it. Prerequisites = aliases + animator fix + written placement/admission rules; fast-follow = ESLint;
> dropped = barrels.

---

## 4. Recommended execution sequence (the concrete altered proposal)

This is Option B, unchanged in shape, with the §2 payload sequenced per §3.

- **Step 0 — Prerequisite PR (no file moves yet):**
  1. Add path aliases `@core`/`@common`/`@features`/`@shared` (new `game/vite.config.ts` + `tsconfig
     paths`).
  2. Resolve the animator/`view.ts` inversion — strip `animateX` delegates from `RenderView`, call from
     `main.ts`; split `zone-overlays.ts`/`interaction-hints.ts` and wire from `main.ts`.
  3. Extract `mountedStorages` → `features/storage/`.
  4. Write the placement rule (`AGENTS.md` + `implement-feature`) and the `common/` admission rule +
     inward-only invariant into a **graduating ADR** (this is where the accepted proposal becomes an ADR).
  5. Fix the 3 stale path references (G).
- **Step 1 — Pilot PR:** migrate `features/scrap/`; seed `features/scrap/CLAUDE.md`; decide
  `collision.ts` placement (recommend: hold in scrap — §3.1). Prove green with the 3 headless tests.
- **Steps 2+ — One slice per PR**, game playable + tests green after each, recommended order:
  **economy → storage → engine → drive → mounting → workshop → hud.** Isolate the genuine refactors
  (`assembly.ts` split, `engine-part` promotion) into their own bisectable PRs. Seed
  `features/mounting/CLAUDE.md` (re-anchor ADR-001).
- **Fast-follow:** ESLint `import/no-restricted-paths` once the structure settles.
- **Defer / drop:** per-feature barrels; any `modes/`/`scenes/` tier.
- **Do not interleave** with MP Phase 0 (part-identity) — it touches the same files
  (`parts-catalog.ts`, `assembly.ts`, the workshop overlay). Sequence them cleanly.

### Pre-decisions to record now (don't act on yet)
- **`Health` placement (when Option D / combat ships):** if the rig takes damage →
  `common/components/health.ts`; if enemies only "end the run" → `features/combat/`. Wrong guess costs a
  later promotion, not a rewrite. *(S-D §2.3.)*
- The Restoration Sanctuary is the documented "second loop-mode" trigger; when it ships it forces the
  deferred `GameMode` / `stepSimulation()`+`renderFrame()` extraction **in `main.ts`** — a
  composition-root change, not a slice restructure. *(S-D §2.5.)*

---

## 5. Why not (a), and why not (c)

- **Not (a) approve-as-is:** executing the proposal verbatim plants the `common→features` animator
  inversion on its first refactor (§2.A) and ships an unenforced `common/` admission rule (§2.D) with no
  written placement rule to replace the role-folder signal it deletes (§2.E). Approving as-is approves a
  known day-one invariant break.
- **Not (c) alternative:** there is no diverging direction with any support. Option A still smears each
  mechanic across role folders and *cannot host per-mechanic `CLAUDE.md`*; the original Option C leaves
  `render/` and `ui/` role-sliced — exactly where the Three.js coupling and felt-tuning work
  (animators, the 1,012-line workshop overlay, scrap stains) accumulates; "stay flat" is refuted by the
  already-active, agent-accelerated entropy. The literature, peer practice, and the roadmap are
  unanimous that feature-first at this scale is correct.

---

## 6. Next step

✅ **Done:** graduated into [**ADR-003 — Feature-first `game/src/` structure**](../../adr-003-feature-first-src-structure.md)
(2026-06-04), capturing the three-tier layout, the `common/` admission rule + inward-only invariant,
the chosen animator/`view.ts` resolution, the path-alias decision, and the scrap-first pilot ordering.

**Now:** execute **Step 0** (path aliases + animator/`view.ts` fix + extract `mountedStorages` + write
the placement & admission rules), then the scrap pilot.

---

## Appendix — artifacts & evidence index

**Reviews** (`reviews/`): `R1-ai-agent-advocate.md`, `R2-human-friendly-architect.md`,
`R3-indie-game-developer.md`.
**Synthesis briefs** (`synthesis/`): `S-A-evidence-and-migration-cost.md`,
`S-B-architecture-theory-and-practice.md`, `S-C-agent-driven-fit.md`,
`S-D-roadmap-and-game-design-fit.md`.
**Research** (`research/`): L1 import-graph, L2 testability, L3 render seam, L4 feature boundaries,
L5 cross-app/build, L6 roadmap pressure; W1 feature-vs-layer, W2 ECS+Three, W3 comparable games,
W4 agent-navigable, W5 UI growth.

**Numbers worth remembering** (re-verified against live code by S-A): 74 non-test files · 314 non-test
import lines · `main.ts` 32 imports (all change) · **0 path aliases** · scrap pilot ≈ 51 mechanical
edits across ~16 files, 3 headless tests · DAG verified acyclic · ADR-001/ADR-002 single-owners
preserved by the move.
