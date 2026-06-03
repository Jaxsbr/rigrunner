# Synthesis C — Agent-Driven Development Fit

**Area:** Does Option B (feature-first, three-tier) make RIGRUNNER more reliable to build *by AI agents* — the project's explicit working model — and what conventions/repairs that fitness requires.
**Author:** Synthesizer, Area C · Architecture Review Board
**Date:** 2026-06-04
**Primary research read in full:** `docs/architecture/system-review/research/W4-agent-navigable-structure.md`, `docs/architecture/system-review/research/L5-cross-app-shared-build.md`. Cross-checked against the proposal (`docs/architecture/feature-first-structure-proposal.md`) and the real repo (skills, tools, CLAUDE.md, AGENTS.md).

> **Verdict for this area: (b) ALTER Option B.** Feature-first is a *genuine* help for agent reliability in this repo — not a wash — but only **conditional on three conventions being landed in the same migration**, not deferred. Without them, Option B trades the flat-folder "which pile?" problem for an unenforced `common/`-vs-`feature/` problem, and the project's agent-facing path references silently rot. With them, the central agent benefit (placement confidence + tight per-mechanic context) is real and durable.

---

## 1. Does feature-first reduce the agent problem, or just shift it?

### 1.1 The problem the proposal is actually trying to solve (and it's the right one)

The proposal's claim #2 (§1) is precise and correct: this is **not a findability problem** ("grep finds a known symbol fine") but a **placement problem** — *"where does this go / what already exists here."* W4 §1.1–1.3 confirms this framing against the literature: Claude Code/Cursor/Devin navigate by grep + directory traversal, so a *known* symbol is found regardless of layout. The addressable cost is the *second phase*: once a file is found, what does the surrounding directory tell the agent about where adjacent new code belongs, and what already exists for this mechanic?

This matters more for RIGRUNNER than for a human-led project because the working model is **explicitly agent-driven** (`CLAUDE.md` § "Working agreement": *"agents write the code"*) and **build-by-discovery** — there is no fixed spec, so every new mechanic arrives as a fresh agent task with no roadmap telling it where things live. The structure *is* the spec for placement. A flat `components/` of 28 files answers "where does a new scrap data struct go?" with silence; the cheapest agent move is to add one more file to the pile, which is exactly the entropy the proposal names.

### 1.2 The genuine reduction (confirmed)

For *feature-local* code — the overwhelming majority (fan-in 1–3, single-consumer tail, per L1) — Option B is an unambiguous improvement for agents on two axes:

1. **Context budget.** W4 §1.2: role-sliced layouts force an agent to open ~5 directories to assemble a per-mechanic picture (for scrap today: `components/`, `systems/`, `content/`, `render/`, `ui/`). LLM output quality degrades past ~40% of context window; loading five directories of mostly-irrelevant siblings to understand one mechanic burns that budget. Under Option B the same understanding comes from reading one folder, `features/scrap/`. This is a direct, measurable reduction in exploration steps.
2. **Placement confidence.** W4 §1.3 (citing Augment Code): *"When you ask an AI agent to write a new feature, the agent must figure out where that new code belongs… This discovery phase burns time and credits and repeats on every fresh chat."* A labelled `features/scrap/` folder answers the question; a flat `components/` does not. For a build-by-discovery project where every mechanic is a fresh agent task, "repeats on every fresh chat" is the dominant recurring tax, and feature folders pay it down.

This is not aspirational. It is the same conclusion every comparable-game and methodology source reached (W1, W2, W3), and it is consistent with the controlled-study evidence W4 §1.3 cites (structured context → lower runtime/token consumption at comparable task completion).

### 1.3 Where the ambiguity *moves* — and why that's smaller, not equal

The honest objection (W4 §2.2): feature-first does not eliminate placement ambiguity, it **relocates** it from "which of 7 role-folders?" to "is this `common/` or a `feature/`?" The shared-folder anti-pattern is the canonical failure mode of every feature-first codebase (W4 §2.2, citing the Shared Folder Anti-Pattern and VSA's "#1 failure mode": *"Creating a 'Shared' folder that becomes a dumping ground"*).

But the relocated ambiguity is **strictly smaller and, crucially, machine-decidable** in this repo — *if* one convention is added:

- The old ambiguity applied to **every** new file ("which pile?") and had **no decision rule** at all.
- The new ambiguity applies **only** to genuinely cross-feature code (the minority), and the proposal already carries the data to make it auditable: the **fan-in table**. W4 §3.1 operationalises this as a grep-countable gate (≥2 distinct *feature* consumers AND no feature-specific semantics → `common/`; otherwise it stays in its feature). The 33/32/27 cluster is unambiguously `core/`; the 7–19 cluster is unambiguously `common/`; the 1–3 tail is unambiguously feature-local. Only the four §4 seams are real judgment, and the proposal already documents them.

**So the answer to the assigned question is: it genuinely reduces the problem — it does not merely shift it — provided the fan-in gate is written down as the `common/` admission rule.** If the gate is left implicit ("Option B is *stricter* about what counts as shared" asserted but not enforced), then the claim is aspirational and an agent has no algorithmic rule, recreating flat-folder uncertainty for the cross-feature minority. The strictness is load-bearing (W4 §2.2) and must be *encoded*, not *intended*.

---

## 2. Conventions REQUIRED to make feature-first reliably agent-friendly

These are not nice-to-haves. Each maps to a documented agent failure mode. Ranked by leverage.

### 2.1 A written `common/` admission rule = the fan-in gate (REQUIRED — the durable defence)

Without an enforceable criterion, `common/` becomes the new dumping ground and the whole "strict shared tier" premise collapses (W4 §2.2, §3.1). The rule must be stated in the ADR and, ideally, machine-auditable:

> A module belongs in `common/` only when it has **≥2 distinct *feature* consumers** (verifiable by import count) **and** carries no feature-specific semantics. Otherwise it stays in its feature. Duplication is cheaper than a wrong promotion; promote on the Rule of Three, not on speculation.

This converts the only remaining agent placement decision from judgment into a check an agent (or a lint rule) can run. **This is the single most important convention** — it is what makes "feature-first reduces the problem" true rather than "feature-first moves the problem."

A companion invariant must be stated alongside it (also from W1/W2/W4 and the FSD inward-only rule): **`core/` and `common/` must never import from `features/`.** This is the rule that keeps `common/` from quietly absorbing feature code via the back door. It is directly load-bearing for the `animators.ts`/`view.ts` seam (see §4 below) and is grep-auditable.

### 2.2 Per-feature instruction files (`features/<name>/CLAUDE.md`) (REQUIRED — the structural multiplier)

W4 §3.2 establishes this as a **first-class mechanism, not a nicety**: Claude Code loads CLAUDE.md hierarchically — root + the subdirectory it is working in. This *only becomes possible* under a feature layout:

- A flat `components/CLAUDE.md` can only describe 28 unrelated data structs — low signal, not worth writing.
- A `features/scrap/CLAUDE.md` can document the mechanic's invariants, which system owns which truth, and the pattern a new file in this slice should follow — exactly the high-signal, low-noise guidance an agent acts on.

This is the convention that turns the directory structure from *passive* placement signal into *active* per-mechanic guidance. It is also where the project's single-owner ADRs should be re-anchored: **ADR-001's "`mounting.ts` is the single owner of grid-snap + cell geometry" belongs as an explicit line in `features/mounting/CLAUDE.md`** so an agent editing that slice cannot miss it (today it lives only in an ADR an agent may never open). This directly de-risks the verified-fact #6 concern that a restructure must not fragment single-owners — a per-feature instruction file makes the single-owner rule *more* visible after the move, not less.

Note: the repo currently has **zero** nested CLAUDE.md/AGENTS.md (confirmed: `find game/ -iname CLAUDE.md` is empty), so this is a net-new capability that Option B unlocks and the flat layout structurally cannot.

### 2.3 Path aliases (`@core` / `@common` / `@features` / `@shared`) (REQUIRED — and must land *with* the moves)

This is both a migration-risk mitigation and an *ongoing* agent-friction tax, and the proposal under-weights it (it is not mentioned). Per verified-fact #1 and W4 §3.3 / L5 §5: there are **no path aliases anywhere**; every import is relative, so moving any file rewrites every relative import that touches it (L1: ~314 import lines across the full migration). For agents specifically, the relative-`../` regime is a recurring tax: every future file move an agent makes cascades depth-counting changes through consumers, and an agent miscounting `../../../` vs `../../../../` is a classic, silent error class.

Aliases fix this and, importantly for *this* area, also resolve the **"two kinds of shared" naming risk** (verified-fact #7; L5 §2, §5.3; W3): `@shared` always means repo-root cross-app, `@common` always means the in-game kernel — **disambiguated at every import site**, including in the abbreviated paths that show up in skill prompts and diffs where the confusion risk is highest. `game/tsconfig.json` `moduleResolution: "bundler"` + Vite 6 support this natively with no new packages (W4 §3.3, L5 §5.2).

Sequencing nuance — the two research tracks differ and the difference matters for agents: W4 §7 recommends aliases as a **prerequisite PR (step 0, before any moves)**; L5 §5.5 recommends bundling them **into** the migration PR. **For agent reliability the W4 ordering is safer**: doing aliases first means the subsequent feature moves are pure path-string swaps an agent can do mechanically with TypeScript catching every miss, rather than two simultaneous variables (move + alias-rewrite) in one diff. Either is defensible; do not *omit* aliases.

### 2.4 Per-feature barrel `index.ts` (RECOMMENDED, additive)

W4 §3.4: an explicit public-API file per slice gives an agent a single import target for a feature's contract, prevents cross-feature reach-into-internals coupling, and shrinks the import surface an agent must understand when working on a *consumer* feature. It costs nothing to adopt alongside Option B and reinforces the §2.1 dependency invariant (a feature's public surface is reviewable). Recommended, not required — the migration is valid without it.

### 2.5 A one-line "where new code goes" rule in the agent source-of-truth (REQUIRED — currently absent)

This is a gap I confirmed directly and the other research tracks did not flag: **there is no documented placement rule anywhere today.** `CLAUDE.md` never enumerates `game/src/` subfolders (confirmed by grep). `AGENTS.md`'s "Where code goes" bullet only distinguishes `game/` vs `shared/` vs `viewer/` — it says nothing about *inside* `game/src/`. The `implement-feature` skill contains **zero** placement guidance (grep for `components/|systems/|where.*belong|directory` returns nothing). So today the "where does this go" answer is purely the *implicit* role-folder convention an agent infers from the existing tree.

This means Option B's payoff is not automatic. When the role-folders disappear, the implicit convention an agent has been pattern-matching against disappears with them, and there is no written rule to replace it. **The migration must add an explicit short rule** — to `AGENTS.md`'s "Where code goes" bullet and/or the `implement-feature` skill — of the shape:

> New game code goes in `game/src/features/<mechanic>/` beside the mechanic it serves. Promote to `game/src/common/` only when it has ≥2 distinct feature consumers and no feature-specific meaning. `game/src/core/` is the game-agnostic ECS engine — do not add game concepts there. (`shared/` at the repo root is cross-*app* code for game + viewer; distinct from `common/`.)

This single paragraph is what makes the structural signal *legible to a fresh agent context*, which is the whole point in a build-by-discovery, agent-driven project.

---

## 3. What in *this repo* breaks or needs updating for agents

Confirmed by direct inspection of the agent-facing files (skills, tools, CLAUDE.md, AGENTS.md, specs). Categorised by whether an agent would be *actively misled* (fix) vs harmlessly historical (leave).

### 3.1 MUST fix in the migration PR (agents would be actively misled)

| File / line | Current text | Problem for agents | Fix |
|---|---|---|---|
| `.claude/skills/blender-asset/SKILL.md` step 4 (line 87) | *"Give an entity a model Renderable (in `content/` or wherever it's spawned)"* | After migration there is **no `content/`**. An agent following this skill to wire a new asset would look for / create a `content/` folder. The "or wherever it's spawned" hedge is weak. | Change `content/` → `features/<feature>/`. (W4 / L5 §4.5 both flag this.) |
| `tools/blender/build_asset.py` lines 12 & 59 | *"register the assetId in `game/src/content/assets.ts`"* | **Already stale today** — `assets.ts` long ago moved to repo-root `shared/assets.ts` (L5 §4.1). An agent running the headless asset pipeline is told to edit a file that doesn't exist at that path. Option B makes it doubly wrong. | Fix to `shared/assets.ts` in the same PR (a pre-existing bug the migration is the natural moment to clear). |
| `tools/blender/assets/workshop.py` line 14 | comment references `game/src/content/workshop.ts` | An agent reading the workshop asset generator is pointed at a path that will no longer exist (moves to `features/workshop/`). Low frequency but it is live tool code, not a spec. | Update to the new path, or generalise the comment. |

### 3.2 SHOULD update (the agent source-of-truth, to *gain* the benefit)

| File | Action | Why |
|---|---|---|
| `CLAUDE.md` § "Structure & launching" | The directory map stops at `game/` level and does **not** enumerate `game/src/` subfolders (confirmed by grep) — so it needs **no surgery** for the move itself. But add the "two kinds of shared" sentence (`common/` = in-game kernel vs `shared/` = cross-app) and point the "source of truth" line at the new ADR. | L5 §4.4; W4 §5. Prevents the `common`/`shared` confusion at the *one* place a fresh agent reads first. |
| `AGENTS.md` "Where code goes" bullet | Add the one-line placement rule from §2.5. | This is the only agent-facing doc that currently says anything about code placement, and it stops at the app boundary. After role-folders vanish, this becomes the written replacement for the implicit convention. |
| `.claude/skills/implement-feature/SKILL.md` | Add the same short placement rule. | This skill is the entry point for *every* code change and currently carries **no** placement guidance — the highest-leverage single spot to put the new convention so agents apply it automatically. |
| `docs/architecture/adr-002` (line 14) references `game/src/ui/deck-view.ts` | No edit to the ADR file (it records a past decision); note the path change in the migration PR body. | L5 §4.3. ADRs are point-in-time records; rewriting them creates noise. |

### 3.3 LEAVE as-is (historical, agents should not navigate by these)

`docs/workshop-interface-spec.md` (~25 path refs), `docs/scrap-stain-decals-spec.md`, `docs/option-c-build-plan.md`, `docs/milestones.md`, `docs/part-identity-spec.md` all contain `game/src/<role>/...` references. These are **built specs / historical records** (L5 §4.2), not live navigation targets — agents find code via grep + CLAUDE.md, not by trusting old specs. Updating them would create churn and a false impression that they are maintained navigation indexes. Leaving them is correct; the risk is only that a future agent *trusts* a spec as a path index, which the §2.5 rule and grep-first navigation mitigate.

**Net on this question:** the agent-facing breakage surface is **small, bounded, and known** — exactly **3 must-fix lines** (one of which is already a bug independent of this proposal), a handful of source-of-truth additions, and a long tail of historical specs deliberately left alone. This is not a reason to reject Option B; it is a short checklist for the migration PR.

---

## 4. The one seam that is an agent *trap* if left as the proposal words it

The proposal (§3, §4.4) says the four animators move into their features and **`common/render/view.ts` calls them**. As worded, that plants a `common/ → features/` import — a direct violation of the §2.1 inward-only invariant, on day one. For an agent this is worse than a normal bug: it would be following the *proposal's own instruction* and would produce a structure that contradicts the rule the same migration is trying to establish. Every research track (W4 §4, W1, W2, W3, L1, L3, L4) independently converged on the same fix:

> Strip the `animateX` delegation from `RenderView`; have **`main.ts`** (already the composition root, verified-fact #3, the only legitimate cross-feature importer) import each feature's animator and call it in the frame loop directly.

For agent reliability this must be **written as the instruction in the ADR**, not left as the proposal's looser "view.ts calls them." Otherwise the first agent to execute the migration codifies the inversion. (The same applies to `zone-overlays.ts` / `interaction-hints.ts`, which L4 shows share the identical two-feature coupling — split per feature, wire from `main.ts`.)

This is a §2 convention in disguise: the dependency-direction rule (§2.1) is only useful to an agent if the *one place the proposal currently violates it* is corrected in the spec the agent will follow.

---

## 5. Net assessment: help or wash for agent reliability?

**A real help — not a wash — conditional on the conventions in §2 landing in the migration rather than being deferred.**

- **The core agent benefit is genuine and asymmetric in this repo's favour.** Build-by-discovery + agent-driven means every mechanic is a fresh agent task with no roadmap; the directory structure is the de-facto placement spec, and per-mechanic context co-location is exactly what the agents' grep+traversal navigation rewards. Feature folders convert "repeats on every fresh chat" placement discovery (W4 §1.3) into a one-folder answer, and unlock per-feature CLAUDE.md guidance the flat layout structurally cannot host.
- **The benefit is conditional, not automatic.** Two things could make it a wash:
  1. If `common/` ships without the written fan-in admission rule (§2.1), the relocated ambiguity is unenforced and `common/` drifts into a dumping ground — agents would face the same "which bucket?" uncertainty for cross-feature code.
  2. If the placement rule (§2.5) is not written into AGENTS.md / `implement-feature`, the *implicit* convention agents currently pattern-match (the role-folders) is deleted with nothing written to replace it — a fresh agent context would have *less* guidance immediately post-migration than before.
- **The breakage surface for agents is small and fully enumerated** (§3): 3 must-fix path lines, a few source-of-truth additions, the `animators`/`view.ts` wording correction (§4). All are migration-PR checklist items, none are structural blockers.

### Conditions under which Option B is a clear agent win
1. The `common/` admission rule (fan-in ≥2 distinct features, no feature semantics) **and** the inward-only invariant (`core`/`common` never import `features`) are written into the ADR.
2. A one-line "where new code goes" rule is added to `AGENTS.md` and the `implement-feature` skill.
3. At least the scrap pilot ships with a `features/scrap/CLAUDE.md` (and ADR-001's single-owner rule is restated in `features/mounting/CLAUDE.md` when mounting migrates).
4. Path aliases (`@core`/`@common`/`@features`/`@shared`) are added — ideally as the prerequisite step.
5. The three §3.1 path references are fixed and the `animators`/`view.ts` resolution (call from `main.ts`) is the written instruction, not "view.ts calls them."

Meet these and Option B materially improves agent reliability. Skip §2.1 or §2.5 and it degrades to roughly neutral. None of these conditions change the *shape* of Option B — which is why this area's verdict is **(b) ALTER**, aligned with W4 and L5, not (a) or (c).
