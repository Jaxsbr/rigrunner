# W1 — Feature-first vs Layer-first Architecture: Evidence Base

> **Role:** Web researcher — architecture organization theory and practice
> **Board vote:** **(b) ALTER Option B** — approve the feature-first direction with one structural
> amendment: make the dependency-direction violation explicit as a build rule, and keep `view.ts`
> out of `common/` until the animator split is confirmed to keep `common/` pointing strictly
> downward.
> **Date:** 2026-06-04

---

## 1. Scope of this document

This document assembles the external evidence base for the question:
*"Should `game/src/` be organized by technical role (layer-first) or by game mechanic (feature-first)?"*

It covers:

1. Foundational theory — screaming architecture, package-by-feature, vertical slice architecture (VSA), Feature-Sliced Design (FSD)
2. When feature-first starts to pay off (codebase size, team size)
3. Documented failure modes of both approaches
4. The "shared/common kitchen-sink" anti-pattern and guidance on strict shared tiers
5. Implications for an agent-assisted, single-developer, discovery-mode project
6. The specific structural question the proposal leaves open: dependency direction of `common/render/view.ts`

All external claims carry a URL citation. Claims from training knowledge (where web fetch was unavailable) are flagged.

---

## 2. Foundational theory

### 2.1 Screaming Architecture (Robert C. Martin)

Martin's thesis, articulated in *Clean Architecture* (2017) and widely referenced, is:

> "A software system's structure should communicate what the system is about."

The top-level folders of the source tree should name the *domain* — in RIGRUNNER's case: drive, engine, mounting, scrap, workshop, economy — not the *technical mechanisms* (controllers, services, repositories). The folder tree should "scream" the game, not the engine.

Key sources:
- [Screaming Architecture — Milan Jovanović](https://www.milanjovanovic.tech/blog/screaming-architecture)
- [Understanding Screaming Architecture: Tech-Driven vs Feature-Driven — Medium](https://medium.com/the-power-of-code/understanding-screaming-architecture-tech-driven-vs-feature-driven-27c6cb2aa64b)
- [What is Screaming Architecture? — Nile Bits](https://www.nilebits.com/blog/what-is-screaming-architecture/)

**Direct bearing on RIGRUNNER:** today's `game/src/` tree screams `components/`, `systems/`, `render/`, `content/`. Opening it, you learn nothing about scrap, or mounting, or the workshop. Option B makes it scream the game.

### 2.2 Package-by-Feature vs Package-by-Layer

The canonical survey of the Java/Spring world; the principles transfer directly to TypeScript.

**Layer-first failure modes** (strongly corroborated across sources):
- "You must jump from package to package to grasp the big picture of a feature" — Sandi Metz's complaint: "I felt like I had to understand *everything* in order to help with *anything*." ([Package by Feature — Philipp Hauer](https://phauer.com/2020/package-by-feature/))
- Classes accumulate in each layer without natural ceiling — the `components/` folder at 28 files is exactly this pattern.
- Classes in large flat packages tend to be public just to be visible, reducing encapsulation.
- High coupling between layers; low cohesion *within* layers.

**Feature-first benefits:**
- Self-contained features with minimal cross-package dependencies.
- Simpler, use-case-specific code without abstraction overhead.
- Enables feature deletion: remove the folder, the orphaned code goes with it.

Source: [Package by Feature, Not by Layer — Expedia Group Tech / Medium](https://medium.com/expedia-group-tech/package-by-feature-not-by-layer-5ba04a070003)

### 2.3 Vertical Slice Architecture (Jimmy Bogard)

VSA groups *all* code for a feature — UI, business logic, data access — in one vertical slice rather than distributing it across horizontal layers.

The foundational rule:

> **"Minimize coupling between slices, and maximize coupling in a slice."**

Source: [Vertical Slice Architecture — Jimmy Bogard](https://www.jimmybogard.com/vertical-slice-architecture/)

The approach scales *past* concentric/layered architectures precisely because each slice can choose its own internal patterns. The one precondition is team discipline around code smells; without it, slices drift.

### 2.4 Feature-Sliced Design (FSD)

FSD is a formal front-end methodology that formalizes the same intuitions. Its layers: `app → pages → widgets → features → entities → shared`. The strict dependency rule:

> **"Modules on one layer can only import from modules on layers strictly below them. Slices cannot use other slices on the same layer."**

Source: [Overview — Feature-Sliced Design](https://feature-sliced.design/docs/get-started/overview)

FSD's `shared` layer is explicitly the lowest tier: it may not import from features. Everything in `shared` is *project-agnostic* — UI primitives, design tokens, utilities, configuration. This mirrors the proposal's `core/` (pure ECS engine) and is a warning about `common/`.

---

## 3. At what size does feature-first start to pay off?

The evidence consistently points to the same inflection: **sooner than you expect**.

| Condition | Guidance | Source |
|---|---|---|
| Startup / solo / prototype | Package-by-layer *acceptable* | [jshingler.github.io](https://jshingler.github.io/blog/2025/10/25/package-by-feature-vs-clean-architecture/) |
| Growing system, 3–10 people | Package-by-feature (flat) recommended | ibid. |
| Multiple teams / domains | Package-by-feature + internal layers + clean boundaries | ibid. |
| 10+ domains | Package-by-feature: 13+ packages vs 3 in layer approach — *better* navigability | [sahibinden-technology / Medium](https://medium.com/sahibinden-technology/package-by-layer-vs-package-by-feature-7e89cde2ae3a) |

The counterintuitive finding: "you don't earn the right to Clean Architecture until you have complexity to clean" cuts *against* premature layering, not against feature grouping. Feature grouping is the simpler, lower-ceremony choice and it is the *natural* starting point.

Critically: at RIGRUNNER's size (~74 non-test files, ~8 game areas), the proposal's DAG shows the architecture is already *coherent enough* to carve — the cross-feature cycle analysis exists in the proposal itself. The absence of cycles confirms the feature graph is ready.

---

## 4. Documented failure modes

### 4.1 Layer-first failure modes

1. **Entropy is default.** The cheapest move — for a human or an agent — is to drop a new file into the flat pile. Option A (feature subfolder inside each role folder) patches this slightly but still smears one mechanic across five folders.
2. **Cognitive load scales with the pile, not the feature.** A developer (or agent) touching "scrap" must mentally filter 28 components to find the 4–6 that are scrap's. Every edit requires global context.
3. **Tests double the traversal noise** in each flat folder, which the proposal correctly diagnoses.
4. **Agent-hostile.** The most concrete recent evidence: an agent given a large layered codebase "confidently made changes across multiple layers, touched files it probably didn't need to touch, and broke parts of the system it never even looked at." ([AI Coding Agents Are Hitting a Wall — Medium](https://nitingavhane.medium.com/ai-coding-agents-are-hitting-a-wall-and-the-wall-is-your-architecture-a57ec11d20ce)). RIGRUNNER's implement-feature skill spawns agents that need to scope changes to one mechanic — layers make that harder.

### 4.2 Feature-first failure modes

1. **Cross-feature coupling creep.** Without enforced rules, features begin to import each other freely, recreating the dependency tangle from a different angle. Mitigation: the DAG in the proposal is already acyclic; the discipline must be maintained.
2. **`common/` becomes a kitchen sink.** This is the canonical failure mode of feature-first and is covered in §5 below.
3. **Premature vertical slice.** Slicing *before* the domain stabilizes creates folders that need to be merged or split. In RIGRUNNER's case the domain is mature enough — scrap, drive, engine, mounting, workshop, economy are all real game areas with existing files — so the risk is low.

---

## 5. The "shared/common kitchen-sink" anti-pattern

This is the most important structural risk in Option B and the one the proposal partially addresses.

### 5.1 The pattern

Every feature-first codebase accumulates a `common/` or `shared/` folder as a dumping ground for "I'm not sure where this goes." Over time it fills with half-finished features, domain-specific helpers that happen to be used twice, and code nobody dares delete. The result: "a dependency graph you can't reason about."

Source: [Secrets of a Scalable Component Architecture — Feature-Sliced Design Blog](https://feature-sliced.design/blog/component-architecture-guide)

> "Shared turns into a junk drawer of helpers, UI bits, and half-features."

The Milan Jovanović deep-dive on VSA shared logic names the specific anti-pattern:

> "A `Common.Services` project combining unrelated concerns (cart calculations, reporting, invoicing) creates artificial coupling and becomes unmaintainable."

Source: [Vertical Slice Architecture: Where Does the Shared Logic Live? — Milan Jovanović](https://www.milanjovanovic.tech/blog/vertical-slice-architecture-where-does-the-shared-logic-live)

### 5.2 The discipline rules that prevent it

All sources converge on the same set of gatekeeping rules:

1. **Rule of Three** — do not extract to `common/` until three *separate, stable* consumers exist. Promote after the third. (Jovanović; Hauer; Dodds)
2. **Only promote stable, slow-changing code.** "If shared logic changes once a year, share it. If it changes with every feature request, keep it local." (Jovanović)
3. **Duplication is cheaper than the wrong abstraction.** "Duplication is cheaper than the wrong abstraction" is the most-cited principle across all sources. It is also Kent C. Dodds' colocation argument in reverse: keep things close until extraction is obviously correct.
4. **FSD's inward-only rule:** shared may not import from features. Shared is the floor, not the ceiling.

### 5.3 Structural enforcement

Discipline alone is insufficient at scale. The FSD article is explicit:

> "The fix isn't discipline speeches — it's architecture constraints through structure and lint rules."

This is the one structural amendment Option B needs that is *not* currently stated in the proposal: a lint rule (or a documented and enforced constraint) that `common/` and `core/` cannot import from `features/`. This is the dependency-direction invariant.

---

## 6. Colocation of tests

All sources affirm what the proposal already states: tests belong beside their source.

Kent C. Dodds' colocation principle: "Place code as close to where it's relevant as possible." Tests are code; they change when the source changes; co-locating them reduces drift.

Source: [Colocation — Kent C. Dodds](https://kentcdodds.com/blog/colocation)

Practical implication confirmed by multiple sources:
- "When a feature is removed, it's simple to delete both the file and the test."
- "Colocation makes it much easier to see which files are lacking tests."

Source: [The benefits of colocating unit tests — Dom Habersack](https://domhabersack.com/blog/colocating-tests)

**For RIGRUNNER:** the proposal's noise complaint (test files doubling the flat-folder traversal count) is well-founded and supported. Co-located tests inside feature folders dissolve the noise because the feature folder naturally groups source + test.

---

## 7. Implications for a single-developer, agent-assisted, discovery-mode project

### 7.1 Feature-first is *especially* appropriate here

Three forces specific to RIGRUNNER amplify the standard arguments:

**Agents need tight scope.** The AI-hostile architecture evidence ([nitingavhane.medium.com](https://nitingavhane.medium.com/ai-coding-agents-are-hitting-a-wall-and-the-wall-is-your-architecture-a57ec11d20ce)) is directly relevant. The implement-feature skill scopes a coding agent to one mechanic at a time. Under the current layer-first structure, "implement a scrap mechanic change" requires the agent to read and modify files across `components/`, `systems/`, `content/`, `render/`, and `ui/`. Under Option B it reads `features/scrap/` and `common/` — a far tighter scope with dramatically lower unintended side-effect surface.

**Discovery-mode means frequent "where does this go?" questions.** The proposal diagnoses this correctly: in a flat pile, the cheapest move is to add one more file. Feature folders answer the question by construction — new scrap code goes in `features/scrap/`.

**Solo developer = zero team review for cross-feature coupling.** The protection against cross-feature coupling drift normally comes from code review. With a single developer, the *structural* enforcement (lint rules, folder conventions) carries more weight. This reinforces the amendment in §5.3.

### 7.2 Discovery-mode does not argue against restructuring

One might worry: "we're building by discovery; the domain isn't stable; premature structure is waste." The evidence does not support this concern *here* because:

- The domain features are already real and stable (they map to existing files, not speculative ones).
- The pending features in `milestones.md` — laden-weight, looter camps/combat, part-identity tiers, restoration sanctuary — all map cleanly to *new* feature folders (a `combat/` folder, a `sanctuary/` folder) that don't exist yet. Option B absorbs them without disrupting existing folders.
- The one risky slot is `hud/` — a cross-feature readout that today reads engine + drive. FSD's guidance is: cross-cutting readouts are a legitimate "widget" layer concern; parking `hud/stats-hud.ts` in a thin `hud/` slice is exactly right.

---

## 8. The open structural question: `common/render/view.ts` and the animator split

The proposal identifies this as "the one real refactor" and it surfaces the most important architectural question in Option B: **dependency direction**.

### 8.1 The problem as stated

If each animator (`animateWheels`, `animateStorageFill`, `animateReclaimer`, `animateScrapPile`) moves into its feature folder, and `common/render/view.ts` calls them by name, then `common/` (the shared tier) imports from `features/` (the feature tier). This inverts the mandatory dependency direction: shared must not depend on features.

### 8.2 What the evidence says

FSD is unambiguous:

> "Higher layers CAN import from lower layers (features can use shared/entities). Lower layers CANNOT import from higher layers (shared must never depend on features)."

Source: [Secrets of a Scalable Component Architecture — FSD Blog](https://feature-sliced.design/blog/component-architecture-guide)

The Jovanović VSA article recommends a callback/injection pattern for exactly this case: features register or inject their update handlers into the infrastructure tier; the infrastructure tier does not know about features by name.

### 8.3 The resolution options

Three clean resolutions exist, ordered by structural cost:

**Option B-i — keep animators in common/render until the pattern is clear.** Do not split `animators.ts` yet; treat it as a facade over animation side-effects that lives in `common/`. This is the zero-migration-cost path. Cost: `common/render` remains a mild grab-bag until the game's animation pattern stabilizes. The proposal already flags this as the "one real refactor" — deferring it is reasonable.

**Option B-ii — inversion of control (callbacks/registry).** `common/render/view.ts` accepts an array of per-frame animator functions via injection (passed in from `main.ts`, the composition root). Each feature registers its animator at startup in `main.ts`. `common/render/view.ts` knows nothing about which features exist. This is the architecturally cleanest solution and is consistent with RIGRUNNER's existing architecture (main.ts *is* the composition root and is the only cross-feature importer — confirmed ground truth #3).

**Option B-iii — elevate view.ts to main.ts.** The per-frame dispatch loop (`animateWheels`, etc.) is assembled inline in `main.ts` rather than hidden in `view.ts`. `view.ts` becomes a pure projection. This is the most explicit option and is coherent with ECS philosophy (the game loop is owned by the composition root).

**The board's recommendation:** declare B-ii or B-iii as the intended resolution *before* migration begins, not after. The proposal currently leaves this open with "every other file is a move, not a rewrite" — but the animator question is a rewrite, and it touches the dependency-direction invariant. Writing it down removes ambiguity for future agents.

---

## 9. Summary of findings

| Finding | Bearing on a/b/c choice |
|---|---|
| Feature-first is the right call for ~74-file, 8-area codebases — supported by all sources | Supports (a) or (b) over (c) |
| Layer-first failure modes (entropy, agent-hostility, cognitive load) are active *today* in RIGRUNNER's flat folders | Supports restructuring now |
| The "common kitchen-sink" is the canonical failure mode of feature-first | Supports (b): add enforcement to the proposal |
| Rule of Three / promote-after-third-consumer is the universal gating rule for `common/` | Supports the proposal's fan-in analysis as the right method |
| FSD's inward-only rule: `common/` may not import from `features/` | The proposal leaves this violation open in the animator case — *requires resolution before migration* |
| Colocation of tests is correct and well-supported | Confirms the proposal; no change needed |
| Agent-assisted development specifically benefits from tight feature scoping | Reinforces Option B over the current flat structure |
| Dependency enforcement should be structural (lint/rules), not just convention | (b): proposal should state this rule explicitly |
| Discovery-mode does not argue against Option B because existing features are real and stable | No change needed |
| Pending features (combat, sanctuary) map to new `features/` folders with no disruption | Option B absorbs the roadmap gracefully |

---

## 10. Board vote and rationale

**Vote: (b) ALTER Option B.**

The direction — feature-first, three tiers, `common/` as a strict kernel, tests co-located — is correct and well-supported by the evidence. The proposal should proceed, with two additions before the first file moves:

1. **State the dependency-direction invariant explicitly.** `core/` and `common/` must not import from `features/`. This is the single rule that prevents `common/` from becoming a kitchen sink and `view.ts` from creating a tier-violation. A comment in the proposal (or the eventual ADR) stating "violating this rule requires explicit justification" is sufficient now; a lint rule (e.g., ESLint `import/no-restricted-paths`) should follow the migration.

2. **Choose and document the animator-split resolution (B-ii or B-iii) before migration.** The proposal calls this "the one real refactor" but defers the pattern. The dependency-direction question cannot be deferred: if `common/render/view.ts` ends up importing feature animators, the central architectural invariant is broken on day one. The composition-root injection pattern (B-ii) or elevating the dispatch loop to `main.ts` (B-iii) both work; either is acceptable; one must be chosen.

Neither addition changes the structure of Option B. They add precision to two points that the proposal leaves as "to be worked out."

---

## Sources

- [Screaming Architecture — Milan Jovanović](https://www.milanjovanovic.tech/blog/screaming-architecture)
- [Understanding Screaming Architecture: Tech-Driven vs. Feature-Driven — Medium](https://medium.com/the-power-of-code/understanding-screaming-architecture-tech-driven-vs-feature-driven-27c6cb2aa64b)
- [What is Screaming Architecture? — Nile Bits](https://www.nilebits.com/blog/what-is-screaming-architecture/)
- [Package by Feature — Philipp Hauer](https://phauer.com/2020/package-by-feature/)
- [Package by Feature, Not by Layer — Expedia Group Tech / Medium](https://medium.com/expedia-group-tech/package-by-feature-not-by-layer-5ba04a070003)
- [Package by Layer vs Package by Feature — Sahibinden Technology / Medium](https://medium.com/sahibinden-technology/package-by-layer-vs-package-by-feature-7e89cde2ae3a)
- [Package by Layer vs Package by Feature (How Clean Architecture fits in) — jshingler.github.io](https://jshingler.github.io/blog/2025/10/25/package-by-feature-vs-clean-architecture/)
- [Vertical Slice Architecture — Milan Jovanović](https://www.milanjovanovic.tech/blog/vertical-slice-architecture)
- [Vertical Slice Architecture: Where Does the Shared Logic Live? — Milan Jovanović](https://www.milanjovanovic.tech/blog/vertical-slice-architecture-where-does-the-shared-logic-live)
- [Vertical Slice Architecture — Jimmy Bogard](https://www.jimmybogard.com/vertical-slice-architecture/)
- [My thoughts on Vertical Slices, CQRS, Semantic Diffusion — Architecture Weekly](https://www.architecture-weekly.com/p/my-thoughts-on-vertical-slices-cqrs)
- [Overview — Feature-Sliced Design](https://feature-sliced.design/docs/get-started/overview)
- [Secrets of a Scalable Component Architecture — Feature-Sliced Design Blog](https://feature-sliced.design/blog/component-architecture-guide)
- [Feature-Sliced Design and good frontend architecture — codecentric](https://www.codecentric.de/en/knowledge-hub/blog/feature-sliced-design-and-good-frontend-architecture)
- [Colocation — Kent C. Dodds](https://kentcdodds.com/blog/colocation)
- [The benefits of colocating unit tests — Dom Habersack](https://domhabersack.com/blog/colocating-tests)
- [AI Coding Agents Are Hitting a Wall — Nitin Gavhane / Medium](https://nitingavhane.medium.com/ai-coding-agents-are-hitting-a-wall-and-the-wall-is-your-architecture-a57ec11d20ce)
- [How to Structure Game Projects — Pandaqi Blog](https://pandaqi.com/blog/reviews-and-thoughts/how-to-structure-game-projects/pqblog_how_to_structure_game_projects/)
