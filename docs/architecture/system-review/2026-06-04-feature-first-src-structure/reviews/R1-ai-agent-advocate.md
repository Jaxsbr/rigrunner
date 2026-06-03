# Review R1 — The AI-Agent Advocate

**Reviewer persona:** The AI-Agent Advocate — I optimize for one thing above all: *can AI coding
agents reliably navigate, extend, and modify this codebase without accumulating entropy?* I care
about "one obvious place for new code," predictable boundaries, low placement ambiguity,
machine-greppability, and the `CLAUDE.md` / skill path contracts staying valid.

**Proposal under review:** `docs/architecture/feature-first-structure-proposal.md` (Option B).
**Date:** 2026-06-04 · **Verdict: (b) ALTER Option B.**

---

## 0. Verdict in one line

Option B is the **single most agent-favourable change available** to this repo — it converts the
recurring "where does this go?" tax (paid on *every* fresh agent chat in a build-by-discovery,
agent-driven project) into a one-folder answer. But the proposal as written **deletes the only
placement signal agents have today without writing its replacement**, and it instructs agents to
plant a tier-violating import on day one. Both are agent-reliability defects, not shape defects, so
the verdict is **(b) ALTER**, not (a). The five conditions below are the payload, ordered by
agent-reliability leverage.

---

## 1. Engaging claim #2 directly: "a flat folder gives no signal about where new code belongs, so
the cheapest move — for a human *or* an agent — is to add one more file to the pile. Agents
accelerate it."

**This claim is true, and it is the most important claim in the proposal for my lens. Option B
fixes it for the majority of code and *relocates* a smaller, machine-decidable residue — but only
if the residue is given a written rule.**

### 1.1 Why the claim is true (and why it bites agents harder than humans)

The proposal correctly separates *findability* from *placement*. An agent navigating via grep finds
a known symbol regardless of layout — findability is a non-problem. The problem is the **second
phase**: once a symbol is found, what does the surrounding directory tell the agent about (a) where
the *new* adjacent code belongs and (b) what already exists for this mechanic? A flat
`components/` of 28 files answers "where does a new scrap data struct go?" with silence. The
locally-rational move for an agent — exactly as the claim states — is `+1 file to the pile`, because
the pile is the only pattern the tree exposes.

This bites agents harder than humans for a reason specific to this project, which I verified:

- **There is no roadmap and no spec telling an agent where things live.** `CLAUDE.md` is the source
  of truth and the `implement-feature` skill's step 2 explicitly tells an agent to "Read `CLAUDE.md`
  … and the code you're touching" before coding. So the agent's *entire* placement signal is
  whatever it can infer from `CLAUDE.md` plus the existing tree.
- **`CLAUDE.md` does not enumerate `game/src/` subfolders at all** (grep-confirmed: no
  `components/`, `systems/`, `content/`, `features/`, `common/` references anywhere in it). The
  directory map in CLAUDE.md stops at the `game/` / `shared/` / `viewer/` level.
- **`AGENTS.md`'s "Where code goes" bullet stops at the app boundary** ("the game in `game/`.
  Shared code goes in `shared/`… the asset viewer is `viewer/`"). Nothing about *inside* `game/src/`.
- **The `implement-feature` skill carries zero placement guidance** (grep for
  `components/|systems/|where.*belong|directory|features/|common/` returns nothing).

So today the "where does this go" answer for an agent is **purely the implicit role-folder
convention inferred from the tree** — there is no written rule anywhere. That is precisely the
silent-entropy condition claim #2 describes, and a fresh agent context re-derives it from scratch
every chat.

### 1.2 Does Option B fix the problem or relocate it?

**It genuinely fixes it for the feature-local majority and relocates a strictly smaller,
machine-decidable residue.** This is not hand-waving — the fan-in numbers (independently re-verified
in Synthesis A against HEAD) make the residue countable:

- The fan-in 1–3 tail (the **majority** of files) becomes unambiguous: it lives in `features/<x>/`.
  "Where does a new scrap struct go?" gets a one-word answer — `features/scrap/`. The
  ~5-directory exploration an agent does today to assemble a per-mechanic picture (`components/`,
  `systems/`, `content/`, `render/`, `ui/` for scrap) collapses to **one folder**. That is a direct,
  measurable reduction in exploration steps and context-window burn.
- The relocated ambiguity is *only* "is this `common/` or a `feature/`?" and it applies *only* to
  the cross-feature minority. The old ambiguity applied to **every** file and had **no decision
  rule**. The new ambiguity has a grep-countable gate already sitting in the proposal: the fan-in
  table.

**But here is the load-bearing catch for agents, and it is the reason I land on (b):** the role
folders are the implicit placement convention agents currently pattern-match against. When Option B
deletes them, *that implicit signal is deleted with them* — and the proposal writes **nothing** to
replace it. The fan-in/admission rule that would make `common/`-vs-`feature/` machine-decidable is
**asserted but not encoded** ("Option B is *stricter* about what counts as shared"). Asserted
strictness is not enforced strictness. To an agent there is no difference between "the rule lives in
the author's head" and "there is no rule" — both produce a coin-flip on the cross-feature minority,
which re-creates flat-folder uncertainty exactly where the kitchen-sink anti-pattern lives.

**So my answer to claim #2 is precise: Option B fixes the problem for the majority and shrinks the
residue to a machine-decidable minority — *conditional on the fan-in gate and a placement rule being
written down in the agent source-of-truth*. Skip that, and Option B relocates the entropy rather than
removing it, and a fresh agent context post-migration would have *less* guidance than before (the
implicit role-folder pattern is gone, nothing written replaces it).** That conditionality is the
whole reason this is (b) and not (a).

---

## 2. The agent-reliability multiplier the flat layout structurally cannot offer

This is the strongest *positive* argument for Option B from my lens, and it is one the flat layout
can never match: **hierarchical `CLAUDE.md` loading.**

Claude Code loads `CLAUDE.md` hierarchically — root, plus the subdirectory the agent is working in.
I confirmed there are currently **zero** nested instruction files under `game/`
(`find game/ -iname CLAUDE.md -o -iname AGENTS.md` is empty). This is not an accident of neglect —
it is *structurally impossible to do well under the flat layout*:

- A `game/src/components/CLAUDE.md` could only describe 28 unrelated data structs — low signal, not
  worth writing, and an agent editing one component would be handed 27 irrelevant ones.
- A `game/src/features/scrap/CLAUDE.md` documents *one mechanic*: its invariants, which system owns
  which truth, the pattern a new file in this slice should follow. High signal, low noise — exactly
  what an agent acts on.

Option B turns the directory structure from a *passive* placement signal into an *active*
per-mechanic instruction surface. This is a net-new agent capability the flat layout cannot host,
and it is the single biggest argument in Option B's favour for my lens. It is also where the
single-owner ADRs should be re-anchored: **ADR-001's "`mounting.ts` is the single owner of grid-snap
+ cell geometry" must become an explicit line in `features/mounting/CLAUDE.md`.** Today that rule
lives only in an ADR an agent may never open while editing the mounting slice; after the move it
sits in the one file an agent loads automatically when working there. This directly answers
verified-fact #6's worry: a per-feature CLAUDE.md makes the single-owner rule *more* visible after
the restructure, not less — provided we actually write it.

---

## 3. The one seam that is an agent *trap* exactly as the proposal words it

I verified this seam in code, and it is the sharpest agent-specific risk in the whole proposal.

The proposal (§3, §4.4) says the four animators move into their features and
**"`common/render/view.ts` calls them."** As worded, that is a `common/ → features/` import — a
direct violation of the inward-only invariant — landing on the proposal's own *first* refactor.

For an agent this is worse than an ordinary bug, because the agent would be **faithfully executing
the proposal's own instruction** and would produce a structure that contradicts the rule the same
migration is establishing. An agent does not push back on a spec; it implements it. If the ADR says
"view.ts calls the feature animators," the first agent codifies the inversion and every subsequent
agent treats it as the house pattern.

The code makes the correct fix near-zero-friction, and I confirmed the exact lines:

- `render/view.ts:14` imports all four animators; lines 55–58 are four thin delegating methods
  (`animateWheels(world, dt) { animateWheels(this.views, world, dt); }`, etc.) — they add nothing
  but a hop through `this.views`.
- `main.ts:232–235` **already** calls `view.animateWheels(world, dt)` … `view.animateScrapPile(world,
  dt)` per-frame. The composition root is *already* doing the dispatch; it is merely routing it
  through the facade.

So the fix is: **strip the four `animateX` delegates from `RenderView`; have `main.ts` (already the
composition root, verified-fact #3, the only legitimate cross-feature importer) import each feature's
animator and call it directly** with the `views` handle. main.ts already loops these four calls — it
just calls the free functions instead of the facade methods. `view.ts` stays in `common/render/` as a
pure projection. This is the resolution Synthesis A, B, and C all converge on, and the code shows it
is a ~4-line move into the file agents already understand best.

**For agent reliability this resolution must be written as the literal instruction in the graduating
ADR — not the proposal's looser "view.ts calls them."** The same applies to `zone-overlays.ts` and
`interaction-hints.ts`, which each iterate `WorkshopZone` + `ScrapPile` together (a two-feature
coupling): split them per-feature and wire from `main.ts`, or promote a shared proximity-zone
read-interface to `common/`. The board must pick one and write it down, because an agent given the
ambiguous version will pick inconsistently across chats.

---

## 4. Path aliases: the highest-leverage low-cost addition, and an agent-error-class eliminator

I confirmed the ground truth: **no aliases anywhere.** `game/tsconfig.json` has
`moduleResolution: "bundler"`, `include: ["src"]`, **no `baseUrl`, no `paths`**; there is **no
`game/vite.config.ts`** and **no root vite config**; a grep for `@`/`~` imports across `game/src`
returns nothing. Vite is invoked as `vite game` / `vite build game` (package.json), so a
`game/vite.config.ts` is the natural, self-contained alias home — no root config needed, no new
packages (`moduleResolution: "bundler"` + Vite 6 support `paths` natively).

From the agent lens, aliases matter for two reasons the cost-focused reviewers under-weight:

1. **They eliminate a classic silent agent error class.** Under the all-relative regime, every
   future file move an agent makes cascades depth-counting changes (`../../../` vs `../../../../`)
   through every consumer. An agent miscounting `../` levels is a textbook silent error — it
   sometimes compiles to the wrong-but-existing path, or fails in ways the agent then "fixes" by
   guessing more `../`. With `@core` / `@common` / `@features` / `@shared`, import strings are
   **depth-independent**: moving a file does not rewrite its callers' paths, so the error class
   disappears. Given the roadmap (combat, restoration, MP tiers — all new slices and new moves; see
   §6), this compounds on every future agent task.

2. **They resolve the "two kinds of shared" hazard at the one place it bites agents hardest: the
   abbreviated path in a skill prompt or a diff.** Repo-root `shared/` is cross-*app* (game +
   viewer); `game/src/common/` is the in-game kernel. A bare `common/render/stage.ts` or
   `shared/assets.ts` in a diff is easy for an agent to conflate. `@shared` always means cross-app;
   `@common` always means the in-game kernel — **disambiguated at every import site.** This is the
   cleanest fix for verified-fact #7.

3. **They make the inward-only invariant greppable and lintable.** A `@features/...` import appearing
   inside a `@common/...` or `@core/...` file is an instantly visible red flag — and exactly the
   kind of thing an agent (or an ESLint `import/no-restricted-paths` rule) can check mechanically. An
   agent that can *grep* the tier rule is an agent that can self-correct against it.

**Sequencing (my recommendation as the agent advocate): add aliases as a prerequisite step-0 PR,
before any file moves.** Synthesis A/B lean toward bundling aliases *into* the migration PR (one
rewrite pass, lower total cost). I disagree on the agent-reliability axis specifically: doing aliases
first makes the subsequent feature moves **pure path-string swaps** that an agent can do mechanically
with TypeScript catching every miss — one variable per diff. Bundling them means an agent juggles
*two* simultaneous transformations (physical move + alias rewrite) in one diff, which is exactly the
condition under which agents drop edits or mis-attribute failures. The cost difference (one extra PR)
is trivial; the reliability difference is real. **The non-negotiable is that aliases are not
omitted** — and the proposal omits them entirely.

---

## 5. The agent-facing path contracts that break (small, bounded, fully enumerated)

I verified every agent-facing path reference by direct inspection. The breakage surface is **exactly
three must-fix lines** an agent would be actively misled by, plus source-of-truth additions. This is
a migration-PR checklist, not a blocker.

### 5.1 MUST fix in the migration PR (an agent would be actively misled)

| File / line | Current text | Why it misleads an agent | Fix |
|---|---|---|---|
| `.claude/skills/blender-asset/SKILL.md` line 87 | "Give an entity a model Renderable (in `content/` or wherever it's spawned)" | After migration there is **no `content/`**. An agent following the asset-wiring skill would look for / create a `content/` folder that no longer exists. | Change `content/` → `features/<feature>/`. |
| `tools/blender/build_asset.py` lines 12 & 59 | "register the assetId in `game/src/content/assets.ts`" | **Already stale today.** I confirmed `game/src/content/assets.ts` does **not exist** (`ls` errors); the registry is `shared/assets.ts` (1404 bytes, present). An agent running the headless asset pipeline is told to edit a non-existent path *right now*; Option B makes it doubly wrong. | Fix to `shared/assets.ts` — a pre-existing bug the migration is the natural moment to clear. |
| `tools/blender/assets/workshop.py` line 14 | comment references `game/src/content/workshop.ts` | Live tool code points an agent at a path that moves to `features/workshop/workshop.ts`. | Update the path or generalise the comment. |

The `blender-asset` SKILL.md line 79 already *correctly* points at `shared/assets.ts` — so the skill
is internally inconsistent today (step 3 says `shared/assets.ts`, step 4 says `content/`). The
migration is the clean moment to align both.

### 5.2 MUST add (the written placement rule — the gap §1 exposed)

This is the condition that makes Option B a clear agent win rather than a wash. Because the implicit
role-folder convention is the *only* placement signal agents have today (§1.1), and Option B deletes
it, the migration **must** write the replacement into the files agents actually read:

- **`AGENTS.md` "Where code goes" bullet** — extend it past the app boundary into `game/src/`.
- **`.claude/skills/implement-feature/SKILL.md` step 2 ("Orient before coding")** — this skill is the
  entry point for *every* code change and currently has zero placement guidance. Highest-leverage
  single spot.
- **`CLAUDE.md`** — one paragraph distinguishing `common/` (in-game kernel) from repo-root `shared/`
  (cross-app), and pointing the source-of-truth line at the graduating ADR. (CLAUDE.md needs no
  *map* surgery — it never enumerated `game/src/` subfolders — just this disambiguation.)

The rule, stated once and reused verbatim in all three:

> New game code goes in `game/src/features/<mechanic>/`, beside the mechanic it serves. Promote to
> `game/src/common/` only when it has **≥2 distinct feature consumers** and **no feature-specific
> meaning** (the fan-in gate). `game/src/core/` is the game-agnostic ECS engine — never add game
> concepts there. **`core/` and `common/` must never import from `features/`** (the inward-only
> invariant). (`shared/` at the repo root is cross-*app* code for game + viewer — distinct from
> `common/`.)

### 5.3 LEAVE as-is (historical, agents navigate by grep + CLAUDE.md, not old specs)

`docs/workshop-interface-spec.md` (~25 path refs), `docs/scrap-stain-decals-spec.md`,
`docs/option-c-build-plan.md`, `docs/milestones.md`, `docs/part-identity-spec.md`,
`docs/architecture/adr-002` (references `game/src/ui/deck-view.ts`) — all contain
`game/src/<role>/...` paths. These are built specs / point-in-time records. Rewriting them creates
churn and the false impression they are maintained navigation indexes. The §5.2 rule + grep-first
navigation mitigate the only residual risk (an agent over-trusting an old spec as a path index).

---

## 6. Does Option B absorb the roadmap without forcing agents into entropy? (cross-check with S-D)

From the agent lens, the roadmap is the real test: every pending item is a *fresh agent task*, and
the structure is the de-facto placement spec for each. I concur with Synthesis D on substance and add
the agent-reliability framing:

- **Combat (Option D)** is the headline case — a brand-new feature with *no current folder*. Under
  the flat layout an agent placing combat makes ~5 independent per-file decisions into 5 flat piles
  (enemy-AI into the 25-file `systems/`, `health.ts` into the 28-file `components/`, …) with no rule
  to guide any of them. Under Option B the answer is one folder, `features/combat/`, created when its
  code is written. This is the cleanest possible agent placement outcome and it is exactly what an
  open `features/` tier is for. **Do not pre-create the slice** — an empty `features/combat/` is a
  speculative-structure trap that an agent would "helpfully" start filling.
- **The `assembly.ts` split S-D requires is also an agent-correctness fix, not just a roadmap fix.**
  The pure-compute half (`sumPartStats`, `composeProduct`, …) is *already* consumed by
  `content/engines.ts` and `content/containers.ts`, which become `features/engine/` and
  `features/storage/`. Leaving all of `assembly.ts` in `features/workshop/` plants a sideways
  `feature → feature` edge on day one — the precise edge the inward-only invariant forbids and that an
  agent grepping for tier violations would flag. Carving the pure half into `common/sim/assembly.ts`
  at migration keeps the invariant true *and* greppable. Pair it with the `spawnEnginePart` /
  `engine-part.ts` → `common/parts/` promotion (consumed by storage, Reclaimer, and loot grants —
  another undeclared cross-feature edge). Both are "an agent following the rule would catch this" cases.
- **The Sanctuary / scenes deferral is correct for agents.** It is a `main.ts` (composition-root)
  concern, not a slice change. **Do not add a `modes/` or `scenes/` tier now** — a speculative empty
  tier is the worst possible signal to a fresh agent ("there must be a mode system; let me wire into
  it"). Option B's "create the folder when the code exists" discipline is exactly the
  no-speculative-structure rule that keeps agents from inventing architecture.

This matters for my lens specifically because **"complexity earns its place" is itself an
agent-legibility rule**: zero speculative folders means an agent never faces an empty directory it
feels obliged to populate, and every folder that exists maps to code that exists. Option B honours
this — its migration creates no speculative slices.

---

## 7. Why not (a), and why not (c)

**Why not (a) APPROVE as-is.** Two agent-reliability defects make as-is unsafe to hand to an agent:
(1) the proposal deletes the only placement signal agents have (the implicit role-folder convention)
and writes no replacement into `AGENTS.md` / `implement-feature` / `CLAUDE.md` — post-migration a
fresh agent would have *less* guidance than today (§1.1, §5.2); and (2) the proposal's own animator
wording instructs an agent to plant a `common → features` tier inversion on the first refactor
(§3). Approving as-is approves both. These are the two conditions under which Option B degrades from
"clear agent win" to "roughly neutral." Neither changes Option B's shape — hence (b), not a rejection.

**Why not (c) ALTERNATIVE.** From the agent lens there is no diverging direction that beats Option B.
Option A (feature subfolder inside each role folder) is *worse* for agents — it keeps the 5-folder
exploration *and* adds a sublevel, and it cannot host a per-mechanic `CLAUDE.md` (the §2 multiplier).
Option C (group only simulation by feature) leaves `render/` and `ui/` role-sliced — so an agent
working a mechanic's *render/UI* still scatters across role folders, and the per-feature CLAUDE.md
covers only half the slice. "Stay flat" is refuted by §1.1: the placement-entropy condition is
already active and agent-accelerated. The diverging directions are all strictly weaker on the exact
axis I care about — placement confidence + per-mechanic context co-location.

---

## 8. The five ALTER conditions (my payload, ordered by agent-reliability leverage)

None changes the *shape* of Option B. All are migration-PR / step-0 items.

1. **Write the placement rule (§5.2) into `AGENTS.md`, the `implement-feature` skill, and a CLAUDE.md
   disambiguation paragraph.** *Highest leverage.* This is the written replacement for the implicit
   role-folder convention Option B deletes. Without it, a fresh agent post-migration has less
   guidance than today. This is the difference between Option B *fixing* the entropy and merely
   *relocating* it.
2. **Encode the `common/` admission rule + inward-only invariant in the graduating ADR** (fan-in ≥2
   distinct feature consumers, no feature-specific semantics; `core`/`common` never import
   `features`). Asserted strictness ≠ enforced strictness. Back it with ESLint
   `import/no-restricted-paths` once the structure settles, so the invariant is machine-checkable by
   the next agent.
3. **Fix the animator/`view.ts` wording in the ADR to the explicit instruction:** strip the four
   `animateX` delegates from `RenderView`; call the animators directly from `main.ts` (which already
   dispatches them at lines 232–235). Same explicit treatment for `zone-overlays.ts` /
   `interaction-hints.ts`. Write the chosen resolution down — an agent implements the spec verbatim.
4. **Add path aliases** (`@core` / `@common` / `@features` / `@shared`) — as a **prerequisite step-0
   PR** (my agent-reliability lean over bundling). Kills the `../` mis-count error class, disambiguates
   `common` vs `shared` at every import site, and makes the tier invariant greppable.
5. **Seed per-feature `CLAUDE.md` on the scrap pilot and on `mounting/`** (the latter restating
   ADR-001's single-owner rule), and fix the three stale path references in §5.1. Per-feature
   CLAUDE.md is the structural multiplier the flat layout cannot host (§2); seed it where the pilot
   proves it.

**Net:** Option B is a real, asymmetric agent-reliability win for a build-by-discovery, agent-driven
project — *conditional on conditions 1–3 landing in the migration rather than being deferred*. Meet
them and the codebase gains the one thing it currently lacks: a written, machine-checkable,
per-mechanic answer to "where does this go and what already exists here." That is the entire job of
directory structure, and it is the entire job of agent-reliability.
