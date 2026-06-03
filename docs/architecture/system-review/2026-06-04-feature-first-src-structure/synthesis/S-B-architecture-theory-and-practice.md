# Synthesis B — Architecture Theory & Peer Practice

> **Synthesizer brief for the review board.** This is the theory-and-practice grounding the three
> reviewers should lean on when they cast their (a)/(b)/(c) vote on
> `docs/architecture/feature-first-structure-proposal.md` (Option B).
> **Drawn from:** web research W1 (feature-vs-layer theory), W2 (ECS + Three.js/TS structure),
> W3 (comparable game codebases), cross-checked against the real RIGRUNNER code.
> **Date:** 2026-06-04 · **Author:** Synthesizer, Area B.
>
> **My own vote, stated up front so the board can weigh it:** **(b) ALTER Option B.** The
> organizing axis is correct and well-evidenced; two precision additions are required before any
> file moves (animator dependency-direction resolution + path aliases). Details in §6.

---

## 0. What this brief answers

The board asked Area B four questions. This document answers each in turn, then states the
strongest argument for and against, then lands the vote.

1. Does feature-first pay off at THIS size (~74 files, single-dev, agent-assisted, discovery-mode
   ECS/Three.js), or is it premature? (§1)
2. How does feature-first reconcile — or fight — with ECS's "systems-first" instinct, and what do
   comparable game codebases actually do? (§2, §3)
3. The strongest theory-grounded argument FOR Option B, and the strongest AGAINST. (§4)
4. Does a strict `common/` tier avoid the "shared kitchen-sink" anti-pattern, or risk it? (§5)

---

## 1. Does feature-first pay off at ~74 files? (Yes — and it is not premature)

### 1.1 The size question, answered against the literature

The single most common objection to restructuring a small project is *"this is premature; you'll
churn folders before the domain settles."* The evidence says that objection does **not** apply
here, for a specific and checkable reason: **the domain is already stable.**

The package-by-feature literature gives an explicit size ladder (W1 §3):

| Condition | Guidance |
|---|---|
| Solo / prototype, domain unknown | layer-first *acceptable* |
| Growing system, domain known | package-by-feature recommended |
| 10+ domains / multiple teams | package-by-feature + internal layers |

RIGRUNNER sits squarely in the middle band: ~74 non-test source files, **8 real and named game
areas** (drive, engine, mounting, scrap, storage, workshop, economy, hud). The counter-intuitive
finding from the literature is that the inflection point arrives **"sooner than you expect"**
(W1 §3) — feature-first is the *lower-ceremony* choice, not the heavier one. Layer-first is what
you keep only while you don't yet know what the features are.

The decisive test for "premature?" is: **do the proposed feature folders map to real, existing
files, or to speculative ones?** Every slice in the proposal's §3 layout (`drive/`, `engine/`,
`mounting/`, `scrap/`, `storage/`, `workshop/`, `economy/`, `hud/`) maps to files that exist on
disk *today* — they are confirmed in `game/src/systems/` (drive.ts, engine.ts, mounting.ts,
scrap-collection.ts, scrap-pile.ts, staging.ts, shop.ts, workshop-drain.ts, workshop-zone.ts,
movement.ts, collision.ts, weight.ts, assembly.ts) and their paired components/render files. We
are **naming areas that already exist**, not inventing future ones. That is the textbook
precondition for feature-first being safe rather than premature (W1 §4.2, §7.2).

### 1.2 The failure modes the literature predicts for layer-first are *active today*

This is the part the board should weigh most heavily: the flat role-sliced layout is not
hypothetically risky — it is *already exhibiting* the canonical layer-first failure modes the
literature documents (W1 §4.1):

- **Entropy is the default move.** A flat folder gives no signal about where new code belongs, so
  the cheapest move — for a human *or* an agent — is "add one more file to the pile." This is
  exactly Sandi Metz's complaint that layer-first forces you to "understand *everything* in order
  to help with *anything*" (W1 §2.2). RIGRUNNER's `systems/` folder is the live instance:
  Bash-confirmed at 25 files (13 source + 12 test), with no internal grouping.
- **Cognitive load scales with the pile, not the feature.** To touch "scrap," you must mentally
  filter `components/` (28 files), `systems/`, `content/`, `render/`, `ui/` and pick out the
  scrap-relevant 4–6 in each. The proposal's §1 diagnosis ("smeared across five role-folders") is
  precisely the documented pain.
- **Tests double the traversal noise.** Confirmed in the real code: `systems/` is 48% test files.
  The proposal correctly notes the fix is *not* a `tests/` tree — co-location is right — the noise
  comes from the flat namespace and dissolves once source is grouped (W1 §6).

### 1.3 Why "discovery-mode" does *not* argue against this

RIGRUNNER's CLAUDE.md is emphatic that the game is built "by discovery" with no fixed roadmap and
that "complexity earns its place." A naive reading says: *don't lock structure into a game that's
still being discovered.* The literature gives the precise rebuttal (W1 §7.2):

- **Discovery happens inside features, not across them.** The discovery-mode caution is about not
  committing to *mechanics* (extra tradeoff axes, combat, restoration) prematurely. Option B does
  not commit to any mechanic — it only names the mechanics that *already shipped*. A discovered
  new mechanic lands as a new `features/<x>/` folder; a discovered-and-abandoned one is deleted by
  removing its folder (feature-deletion is a documented benefit, W1 §2.2). Feature-first is in fact
  the *most* discovery-friendly layout because it makes both addition and deletion cheap and local.
- **Discovery-mode means frequent "where does this go?" decisions** — exactly the question a flat
  pile cannot answer and a labelled feature folder answers by construction (W1 §7.1).

**Conclusion for §1:** feature-first pays off at this size. It is not premature; it is slightly
overdue. The proposal's own diagnosis matches the literature's documented layer-first failure
modes line-for-line.

---

## 2. Feature-first vs the ECS "systems-first" instinct (a false dichotomy)

This is the question the board is most likely to get tangled in, because ECS culture has a strong
"systems live together" reflex. The research is unambiguous: **the tension is a false dichotomy**
(W2 §2).

### 2.1 ECS is a data model; feature-first is a file convention — they are orthogonal

- **ECS defines a *data model*:** entities are IDs, components are pure data, systems are free
  functions over matching component sets. It says **nothing** about how files are grouped on disk.
- **Feature-first defines a *file organization convention*:** a slice owns the components, systems,
  and render code that implement one mechanic. The ECS *engine* (the `World`, the query runner, the
  type registry) stays a thin, game-agnostic core beneath it.

I verified this directly against RIGRUNNER's `game/src/core/world.ts`: the `World` class is pure
component-major storage (`createEntity`, `add`, `get`, `query`, `destroyEntity`) with **zero game
knowledge** — it never mentions a part, a scrap pile, or a wheel. That is the engine tier. Where
`drive.ts` physically sits relative to `engine.ts` is irrelevant to the World; it is purely a
human/agent-navigation decision. **Moving a system file into a feature folder does not touch the
ECS data model at all.** This dissolves the "systems-first instinct" entirely: the instinct is
real for the *engine*, and Option B honours it (the engine stays in `core/`), but it has no claim
on where *game-specific systems* live.

### 2.2 The "global systems/ folder" has no external defenders at feature-code scale

Every large-scale ECS project surveyed groups systems **with their feature**, not in a flat global
`systems/` folder (W2 §3, §8):

- **Bevy** (the most-cited ECS exemplar): per-feature *plugin crates*; each feature plugin
  registers its own components + systems + resources in a `build()` method, wired from a composition
  root (`lib.rs`). The Vlad Bevy-organization article shows `src/duel/`, `src/items/`, `src/player/`,
  `src/grid/`, `src/world_gen/` + a shared `utils/` — structurally identical to Option B's
  `features/<x>/` + `common/`, with `lib.rs ≈ main.ts`.
- **sim-ecs** (TS ECS): the Pong example names systems by feature behaviour (`PaddleSystem`,
  `BallSystem`, `InputSystem`) co-located by feature, not split into a flat `systems/` dir.
- **Meta Horizon Spatial SDK** formalizes this as "SpatialFeatures": a module packages complete
  ECS functionality (its components + systems + resources) as one reusable unit.

The global `systems/` folder appears **only in sub-10-file demos** (W2 §8). RIGRUNNER is 7× past
that. The Three.js+ECS tutorial author (dev.to "Three.js Architecture: ECS") explicitly says the
role-sliced `systems/` + `traits/` split is fine for a *demo* but warns it breeds
"logic-rendering coupling" at scale and recommends per-feature owned render layers — i.e. Option B.

### 2.3 The three-tier shape is the cross-source consensus, and Option B maps onto it exactly

W2 §3 found the same three-tier shape across four independent sources (Bevy crate layout, the
ECS-2.0 micro-kernel article, the generalist game-engine layer model, Meta SpatialFeatures):

| Tier | Consensus name | RIGRUNNER (Option B) | RIGRUNNER reality |
|---|---|---|---|
| Bottom | engine / micro-kernel | `core/` | `world.ts types.ts component.ts geometry.ts` — confirmed zero game knowledge |
| Middle | domain / shared kernel | `common/` | `transform part parts-catalog mount weight collision render-infra input` |
| Top | features / plugins / game layer | `features/` | the 8 vertical slices |

The naming is non-standard only in surface vocabulary (most sources say "engine/kernel/game");
the *structural intent* is identical. The proposal's "three tiers, not two" claim is independently
confirmed by the import-graph evidence (L1): a clean fan-in gap separates kernel modules (fan-in
7–33) from feature-local modules (fan-in 1–3). The tiers are real, not invented.

### 2.4 Composition-root and the cross-feature DAG match the Bevy/FSD model

Two further idiomatic confirmations (W2 §4, §7):

- **`main.ts` as the sole cross-feature importer** is exactly the Bevy plugin-registration model
  and FSD's "App" layer. Ground truth #3 confirms `main.ts` (245 lines) is already the only file
  importing broadly across areas — RIGRUNNER is *already* using the composition-root pattern; Option
  B just makes it the explicit rule.
- **The acyclic cross-feature DAG** (drive→engine, scrap→{mounting,storage}, workshop→{mounting,
  engine, storage, economy}) matches FSD's strict "import only downward" rule. L1 verified no cycle
  exists in the real import graph. A feature-first split is only *safe* when the feature graph is
  acyclic; here it is.

**Conclusion for §2:** feature-first does not fight ECS — it is what every non-trivial ECS codebase
actually does. The "systems-first instinct" is satisfied by keeping the *engine* in `core/`; it has
no legitimate claim on where game systems live.

---

## 3. What comparable game codebases actually do (the peer-practice spine)

W3 surveyed seven comparable games. The pattern is consistent enough to be a law: **type-based
("role-sliced") organization is chosen at small scale, regretted at medium scale, and replaced by
feature-based at large scale.** No surveyed game at RIGRUNNER's scale documents *satisfaction* with
type-slicing.

| Game | Domain | What it shows |
|---|---|---|
| **shapez.io** (factory builder, ~70k LOC JS) | most-analogous builder | Role-sliced `game/{components,systems,hud}` BUT `game/buildings/` is one-file-per-building — feature logic *gravitated back* to feature-per-file inside the role split. Option B formalizes the entropy shapez.io discovered organically. |
| **Slay the Web** (roguelite deck-builder, JS) | feature-domain `game/` | `game/{cards,combat,dungeon,powers,rooms}.js` + thin `utils-state.js` + separate `ui/`. **Closest in spirit to Option B** — this is what `features/` should look like; `game/→ui/` maps to `features/→common/render/`. |
| **OpenPenguinSurvivors** (VS-clone, GDScript) | pure feature-first | Top-level `Enemy/ Weapon/ Pickup/ Player/` + a single `EventBus/`. Direct answer to the animator dependency-direction problem: features emit, render subscribes, no shared tier imports features. |
| **Mindustry** (RTS, very large Java) | **cautionary** | Pure type-slicing at scale (`game/ logic/ world/ entities/` simultaneously). Mod authors consistently cite navigation difficulty. This is the trap Option B avoids by adopting *before* the project reaches that scale. |
| **Pacific Drive** (commercial vehicle survival) | most-analogous *loop* | Garage↔Zone (= workshop↔run) is a **modal state machine on a shared car entity**, NOT a scene reload. Validates RIGRUNNER's "one world + modal interface mode" as correct. |

Three peer-practice conclusions land directly on the (a)/(b)/(c) choice:

1. **The "screaming architecture" test** (W3 §5): today `game/src/` screams *"ECS framework"*
   (`components/ systems/ render/ content/`); Option B makes it scream *"vehicle scavenging game"*
   (`features/drive/ features/scrap/ features/workshop/`). Every comparable game at 50–100 files
   wins on this test with feature-first.

2. **The build→run split is a modal state machine, not scenes** (W3 §3). This validates the
   *deferral* of scene/game-mode architecture (ideas.md 2026-06-01, ground truth #10). Combat is a
   new *mode within the run* (a `features/combat/` slice reading shared components), not a new scene.
   The Restoration Sanctuary only warrants scene architecture *if* it becomes a genuinely separate
   persistent world — and that is a `main.ts`/composition-root concern, not a `features/` concern.
   **Option B should NOT pre-build a `scenes/` or `modes/` tier.** Peer practice says wait for the
   second real world.

3. **The render-facade dependency direction is an anti-pattern in *every* comparable codebase**
   (W3 §4). No surveyed game has its shared/render layer import from features. All three peer
   solutions (EventBus subscription, callback injection at the composition root, component-driven
   render) keep the arrow pointing the right way. See §6.1.

---

## 4. The strongest argument FOR and the strongest argument AGAINST

### 4.1 Strongest theory-grounded argument FOR Option B

**Feature-first minimizes the working-set an editor (human or agent) must hold to make a correct,
side-effect-free change — and RIGRUNNER's development model maximizes the value of that.**

The chain is: Vertical Slice Architecture's foundational rule is *"minimize coupling between slices,
maximize coupling in a slice"* (W1 §2.3). Combined with FSD's strict downward-only import rule
(W1 §2.4), the result is that any change scoped to one mechanic touches one feature folder +
`common/`, and the structure *guarantees* that no other feature can be silently affected (because
no feature imports another feature; the DAG is acyclic — verified in L1).

For RIGRUNNER this argument is **doubly load-bearing** because the project is explicitly
agent-driven (CLAUDE.md: "agents write the code"). The 2025 AI-agent evidence is concrete: agents
in layered codebases "confidently made changes across multiple layers, touched files they didn't
need to touch, and broke parts of the system they never looked at" (W1 §4.1, citing the
agents-hitting-a-wall piece). The `implement-feature` skill scopes a coding agent to one mechanic;
under the current layout "change a scrap behaviour" forces the agent to read across five role
folders; under Option B it reads `features/scrap/` + `common/` — a dramatically smaller context
budget and side-effect surface (W3 §8; W1 §7.1). The same applies to co-located tests: the agent
asking "where does this test go?" gets a structural answer for free (W3 §8).

This is not an aesthetic argument. It is a **defect-surface-reduction** argument, and it is the
strongest one on the table.

### 4.2 Strongest theory-grounded argument AGAINST Option B

**The strongest honest case against is: the dominant *cost* of Option B is mechanical
import-rewriting that the proposal under-specifies, and the dominant *risk* — `common/` becoming a
kitchen sink — is mitigated by a fan-in gate the proposal states but does not yet enforce. So the
proposal as written is *not safe to execute as-is*: it would plant a tier-violating import on day
one (the animator/`view.ts` inversion).**

Three concrete supports:

- **No path aliases anywhere** (ground truth #1). Every import is relative; moving any file rewrites
  every importer. L1 measured the full migration at ~314 relative-import lines across ~65 source
  files. The proposal's claim "every other file is a move, not a rewrite" is *false* under the
  no-alias regime — a move *is* a rewrite of every consumer. This is not a reason to reject the
  direction, but it is a reason the proposal is incomplete (W2 §6).
- **The animator split is described in a way that violates the central invariant.** The proposal
  says `common/render/view.ts` "calls them" (the feature animators). That is the kernel tier
  importing the feature tier — the exact inversion FSD calls illegal (W1 §8, W2 §5, W3 §4). The
  proposal *names* this as "the one real refactor" but does **not resolve the dependency
  direction.** Left unresolved, the very first migration step breaks the tier contract.
- **`common/` is the canonical failure mode of feature-first** (W1 §5). The proposal's defence is a
  fan-in analysis, which is the *right method* — but a one-time snapshot is not enforcement. Without
  a stated admission rule + lint, `common/` drifts back into a junk drawer over the project's life.

Note carefully: **this is an argument for (b) ALTER, not for (a) reject or (c) alternative.** None
of these supports challenge the *axis*; they challenge the *completeness* of the migration plan.
That is precisely the (b) verdict.

---

## 5. Does a strict `common/` tier avoid the kitchen-sink anti-pattern — or risk it?

This is the single most important structural risk in feature-first (W1 §5; W2 §4). The honest
answer: **a `common/` tier always *risks* the kitchen sink; Option B's design avoids it IF — and
only if — two things are added that the proposal currently leaves implicit.**

### 5.1 What the literature says prevents the kitchen sink

Every source converges on the same gatekeeping rules (W1 §5.2):

1. **Rule of Three** — do not extract to `common/` until **three** separate, stable consumers exist.
2. **Promote only slow-changing code.** "If it changes once a year, share it; if it changes with
   every feature, keep it local."
3. **Duplication is cheaper than the wrong abstraction** (the most-cited principle across all
   sources).
4. **FSD's inward-only rule:** `common/` (and `core/`) must **never** import from `features/`. The
   shared tier is the floor, not the ceiling.

The VSA literature names the precise anti-pattern Option B must avoid: a `Common.Services` grab-bag
that combines unrelated concerns and "becomes unmaintainable" (W1 §5.1); and the "Fake Slice" —
feature folders that route all logic through a giant shared `services/` dir (W2 §4).

### 5.2 Where Option B gets it right

- **It uses fan-in as the admission criterion.** The proposal's §2 fan-in table *is* the Rule-of-Three
  applied quantitatively: modules with fan-in ≥ ~7 (world 33, transform 19, parts-catalog 12, mount
  8, weight 5) are demonstrably cross-feature and earn `common/`; modules with fan-in 1–3 stay in
  their feature. This is exactly the literature's prescribed gate, made machine-auditable. L1
  verified the table is accurate (16 of 19 numbers exact; the 3 discrepancies are within noise and
  change no conclusion).
- **It splits the kernel into two tiers** (`core/` engine vs `common/` domain). This is stricter
  than a single `shared/`, and the split is real (the fan-in gap is observable). Keeping the pure
  engine separate from the domain kernel is what FSD's "shared must be project-agnostic" rule asks
  for (W1 §2.4) — RIGRUNNER's `core/` genuinely is project-agnostic (verified in `world.ts`).
- **It deliberately names the in-game tier `common/`, not `shared/`,** to avoid clashing with the
  repo-root cross-app `shared/`. This is the right call (W3 §6).

### 5.3 Where it still risks the kitchen sink (and the two fixes)

The risk is **not** in the feature folders — those are self-evidently scoped. It is in `common/`
(W4's framing, echoing W1 §5.3 and W2 §4). Two gaps:

1. **The admission rule is stated as a snapshot, not enforced as a standing rule.** The fan-in table
   is a 2026-06-04 photograph. To prevent drift, the *rule* ("only code with ≥ 2 distinct *feature*
   consumers and no feature-specific semantics may live in `common/`") must be written into the ADR,
   and — post-migration — backed by a lint rule (ESLint `import/no-restricted-paths`). The FSD blog
   is blunt: *"The fix isn't discipline speeches — it's architecture constraints through structure
   and lint rules"* (W1 §5.3). With a single developer there is **no code review** to catch
   drift (W1 §7.1), which makes structural enforcement matter *more* here, not less.

2. **The inward-only invariant is currently *violated* by the proposal's own animator wording.** A
   strict `common/` is only strict if `common/` never imports `features/`. The proposal's
   "`common/render/view.ts` calls the feature animators" sentence is a `common→features` import —
   the precise inversion that turns the strict tier into a leaky one. This must be resolved (§6.1)
   *before* the kitchen-sink claim is true.

**Conclusion for §5:** the strict `common/` tier is *designed* to avoid the kitchen sink and uses
the right method (fan-in = quantified Rule of Three). But "designed to avoid" is not "avoids" until
the admission rule is enforced and the one self-inflicted inward-violation (animators) is fixed.
With those two additions, Option B's `common/` is genuinely strict; without them, it has the same
drift exposure as any other shared folder.

---

## 6. The two precision additions the theory/practice evidence requires

All three web artifacts (W1, W2, W3) — and the local seam analyses (L1, L3, L4) — converge on the
**same two additions**, independently. That convergence is itself strong evidence they are real,
not stylistic.

### 6.1 Resolve the animator dependency-direction BEFORE migration (the must-fix)

The proposal's "`common/render/view.ts` calls the feature animators" creates a `common→features`
inversion. Three clean resolutions exist; the board should pick one and write it into the ADR:

- **Callback injection at the composition root (recommended, lowest-friction).** `view.ts` holds a
  `FrameCallback[]` (interface defined in `common/`); each feature exports its animator; `main.ts`
  (already the only cross-feature importer) collects them and injects them at startup. ~10 lines.
  This is the direct TS translation of the Bevy plugin-registration model (W2 §5 Resolution C; W3
  §4b). It also sets the precedent for the future `combat/` animator: add one line to `main.ts`.
- **Elevate the per-frame dispatch into `main.ts`** (W1 §8 B-iii / W2 Resolution): strip the
  `animateX` delegation methods from `RenderView` entirely and call the four animators directly from
  `main.ts`. `view.ts` becomes a pure projection. L3 and L4 both independently recommend exactly
  this. Coherent with ECS (the game loop is owned by the composition root).
- **Component-driven / event-bus render** (W2 Resolution A; W3 §4a/4c): features write a render
  marker or emit an event; the render layer reads generic components / subscribes. Most "pure ECS"
  but the highest-ceremony for RIGRUNNER's current size — defer unless the animation system grows.

Either of the first two is acceptable. The *non-negotiable* is that the resolution is **chosen and
documented before the first file moves**, because the animator split is literally the proposal's
first real refactor and the inversion would land on day one.

> Note for the board on `view.ts`'s home: the cleanest framing (L1, L3, L4) is to treat `view.ts`
> as a **composition-layer peer of `main.ts`**, not as `common/render/` infrastructure — because a
> facade that wires per-feature animators is inherently cross-feature. If the `animateX` calls are
> removed from `RenderView` (resolution 2 above), `view.ts` can stay in `common/render/` as a pure
> projection. This is a one-sentence decision the ADR should record.

### 6.2 Add path aliases as migration step 0 (the dominant-cost reducer)

With no aliases (ground truth #1), Option B is a ~314-line import-rewrite across ~65 files (L1).
Adding `tsconfig` `paths` + `vite-tsconfig-paths` (`~core/*`, `~common/*`, `~features/*`) **before**
moving any file converts the migration from grep-and-fix-imports into pure file moves (W2 §6), and
permanently eliminates depth-churn on every future move. It also resolves the `common/` vs repo-root
`shared/` naming ambiguity at every import site (`@common` vs `@shared`). `moduleResolution:
"bundler"` + Vite 6 support this natively. This is a small, mechanical prerequisite PR — not a
change to Option B's shape.

### 6.3 (Minor, from peer practice) Document the two "shared" namespaces

Repo-root `shared/` (cross-app, used by game + viewer) vs `game/src/common/` (in-game domain). The
naming choice is correct, but shapez.io's community confusion over dual "core" semantics (W3 §6) is
the cautionary data point. One paragraph in CLAUDE.md/AGENTS.md distinguishing the two closes it.

---

## 7. Why NOT (a), and why NOT (c)

**Why not (a) APPROVE as-is:** the direction is right, but the proposal, executed verbatim, plants
a tier-violating `common→features` import on its first refactor (§6.1) and ships an unenforced
`common/` admission rule (§5.3). Approving as-is means approving a known day-one invariant break.
Every web artifact (W1, W2, W3) and every local seam artifact (L1, L3, L4, L5, L6) independently
landed on (b), not (a) — only L2 (testability) landed on (a), and only because its lens sees no
problem. The weight of evidence is (b).

**Why not (c) ALTERNATIVE:** there is no diverging direction with external support. The literature
and peer practice are *unanimous* that feature-first at this scale is correct (W1 §3, W2 §8, W3
§5). Option A has "no external defenders" (W2 §8). Option C (group only the simulation by feature)
is "a valid incremental step but strictly weaker than B — it leaves render and UI role-sliced,
which is exactly where Three.js coupling pain accumulates" (W2 §8). A "do nothing / stay flat"
alternative is refuted by §1.2 (the failure modes are already active). There is simply no
evidence-backed (c) on the table.

---

## 8. One-paragraph brief for each reviewer to lean on

> Feature-first is the correct organizing axis for a ~74-file, single-dev, agent-assisted,
> discovery-mode ECS/Three.js game — the size literature puts RIGRUNNER past the inflection point,
> the domain is already stable (the slices map to real files), and the layer-first failure modes are
> *active today*. The ECS "systems-first instinct" is a false dichotomy: ECS is a data model,
> feature-first is a file convention, and every non-trivial ECS codebase (Bevy, sim-ecs, Meta
> SpatialFeatures) groups systems with their feature while keeping the engine in a thin game-agnostic
> core — which RIGRUNNER's `core/world.ts` already is. Comparable games (Slay the Web, shapez.io,
> OpenPenguinSurvivors) confirm it; Mindustry is the cautionary type-sliced counter-case. The strict
> `common/` tier *avoids* the kitchen-sink anti-pattern only because it uses fan-in as a quantified
> Rule-of-Three gate — but that gate must be written as a standing rule + lint, and the proposal's
> one self-inflicted inward-violation (the `common/render/view.ts → feature animators` inversion)
> must be resolved (callback injection at `main.ts`, or elevate the dispatch to `main.ts`) before any
> file moves. Add path aliases as step 0 to make the migration pure file-moves. **Vote: (b) ALTER —
> right axis, two precision additions before execution.**

---

## Appendix — source map

- **W1** — Feature-vs-layer theory: `docs/architecture/system-review/research/W1-feature-vs-layer-architecture.md`
  (screaming architecture, package-by-feature, VSA, FSD, kitchen-sink rules, agent-hostility).
- **W2** — ECS + Three.js/TS structure: `docs/architecture/system-review/research/W2-ecs-three-game-structure.md`
  (ECS-vs-feature false dichotomy, three-tier consensus, Bevy/sim-ecs/Meta, path aliases, animator resolution).
- **W3** — Comparable game codebases: `docs/architecture/system-review/research/W3-comparable-game-codebases.md`
  (shapez.io, Slay the Web, OpenPenguinSurvivors, Mindustry, Pacific Drive, modal-state-machine, EventBus).
- **Local cross-checks:** L1 (import-graph reality-check — fan-in & DAG verified), L3 (render seam),
  L4 (feature-boundary seams), L5 (cross-app/build), L6 (roadmap pressure), L2 (testability — the one
  (a)-leaning lens). All in `docs/architecture/system-review/research/`.
- **Code grounded against:** `game/src/core/world.ts` (engine is game-agnostic — confirmed),
  `game/src/systems/` (25 files, 48% tests — flat-folder noise confirmed),
  `docs/architecture/feature-first-structure-proposal.md` (the proposal).
