# W4 — AI-Agent-Navigable Codebase Organisation
**Research track · Architecture Review Board**
Date: 2026-06-04

---

## Scope and question

The proposal's core claim #2 (§1) is:

> "A flat folder gives no signal about where new code belongs, so the cheapest move — for a human *or* an agent — is to add one more file to the pile. This is the entropy we've been feeling: not a *findability* problem (grep finds a known symbol fine) but a *'where does this go / what already exists here'* problem, which is exactly what directory structure is supposed to answer."

This review asks: what is actually known about structuring repos so AI coding agents navigate and modify them reliably? Specifically:

1. **Is feature-first genuinely better for agents?**  Does directory grouping affect agent retrieval success, context quality, or placement accuracy?
2. **Or does it just move the ambiguity?**  Is "is this `common/` or `features/`?" as bad as "which flat folder?"
3. **What conventions make feature-first reliably agent-friendly?**  Naming, per-directory instruction files, barrel exports, path aliases.
4. **What bearing does this have on the (a)/(b)/(c) choice?**

---

## 1. How coding agents actually navigate codebases

### 1.1 Grep + directory traversal, not vector search

Cursor, Claude Code, and Devin use grep/ripgrep as their primary search backbone rather than semantic vector search. The dominant reasons: zero configuration, all-file-type coverage, composable output, and safe failure modes (false positives are recoverable; a crashed language server is not). In a typical agentic exploration loop, 4–12 parallel tool calls fire per turn across different directories and file globs.
[[Why Coding Agents Still Use grep](https://yage.ai/share/why-coding-agents-still-use-grep-en-20260327.html)]
[[Why Cursor, Claude Code, and Devin Use grep, Not Vectors](https://www.mindstudio.ai/blog/is-rag-dead-what-ai-agents-use-instead)]

A critical implication for RIGRUNNER: **if a symbol name is known, grep finds it regardless of folder organisation**. The proposal's concession — "grep finds a known symbol fine" — is correct. The addressable problem is the *second phase*: once the agent has found a file, what does the surrounding directory tell it about where adjacent new code should go?

### 1.2 The exploration overhead of role-sliced layouts

A key empirical claim in the literature is that role-sliced layouts force agents to make "numerous directory jumps, reading large monolithic files that contain mostly irrelevant context."
[[Coding Agents as a First-Class Consideration in Project Structures](https://dev.to/somedood/coding-agents-as-a-first-class-consideration-in-project-structures-2a6b)]

LLMs degrade in output quality past roughly 40 % of their context window. Agents operating in a role-sliced repo that scatters one mechanic across five directories must load more files to construct a feature-local picture, consuming disproportionate context budget. Feature-first reduces this by co-locating all end-to-end logic for a mechanic, minimising the number of directories the agent needs to open to understand "scrap" or "mounting."

The RIGRUNNER-specific evidence makes this concrete: to understand `scrap` in the current layout an agent must open `components/` (scrap-pile, collectible, loot-drop, cleared-ground, digging), `systems/` (scrap-collection, scrap-pile), `content/` (scrap.ts, loot-table.ts), `render/` (scrap-stains, animators fragment), and `ui/` (loot-overlay) — five directories. Under Option B all of these collapse into `features/scrap/`.

### 1.3 The "where does new code go" problem is distinct from findability

The Augment Code research confirms this framing directly:

> "When you ask an AI agent to write a new feature, the agent must figure out where that new code belongs… This discovery phase burns time and credits and repeats on every fresh chat."
[[AI Spec Template: What to Include and Leave Out](https://www.augmentcode.com/guides/ai-spec-template)]

The problem is not retrieval of existing symbols but **placement confidence** for new code. A flat `components/` folder with 28 files gives an agent no signal whether a new data struct belongs in it, in a new feature folder, or in `common/`. A `features/scrap/` folder gives an explicit answer: if this code serves the scrap mechanic and has no other consumers, it goes here.

The controlled study by Lulla et al. (cited in the Configuring Agentic AI Coding Tools paper) found that "lower runtime and token consumption" while "maintaining comparable task completion behavior" when agents work with structured AGENTS.md context — consistent with the claim that structural signals reduce exploration overhead.
[[Configuring Agentic AI Coding Tools: An Exploratory Study (arXiv:2602.14690v3)](https://arxiv.org/html/2602.14690v3)]

---

## 2. Feature-first is better for agents — with a real caveat

### 2.1 The affirmative case

The literature consistently supports the proposal's claim. Vertical slice / feature-first organisation:

- **Reduces exploration steps**: all code for a mechanic is reachable from one directory.
- **Makes new-code placement obvious**: "add to `features/scrap/` unless it has multiple consumers."
- **Enables incremental concurrent work**: features can be added without touching unrelated slices, reducing merge conflicts and context pollution.
- **Aligns with how agents are prompted**: agents write one feature per context window, and the ideal structure is "malleable enough such that features can be added incrementally."
[[Coding Agents as a First-Class Consideration in Project Structures](https://dev.to/somedood/coding-agents-as-a-first-class-consideration-in-project-structures-2a6b)]

The vertical slice architecture literature independently validates this: "all aspects of a feature are contained within a single slice" reduces cognitive load for the feature-author — human or agent — because "you don't need to keep a mental map of where the controller lives, where the service is, or where the repository might be."
[[Vertical Slice Architecture](https://www.milanjovanovic.tech/blog/vertical-slice-architecture)]

### 2.2 The real caveat: the `common/` boundary is a new form of the same ambiguity

The shared/common folder anti-pattern is well-documented:

> "Shared folders usually start small — but grow into unmanageable nests… Terms like 'common' are so subjective these libraries tend to become dumping grounds for anything that engineers think might become reusable at some point."
[[The Shared Folder Anti-Pattern](https://medium.com/clean-code-playbook/the-shared-folder-anti-pattern-a-friendly-warning-from-inside-the-codebase-ef1cdf1471c8)]

The Vertical Slice Architecture literature frames this as "the #1 failure mode":

> "Creating a 'Shared' folder that becomes a dumping ground. Teams struggle distinguishing between genuinely cross-cutting code and business logic belonging in specific features."
[[VSA Folder Structure: 4 Approaches Compared](https://nadirbad.dev/vertical-slice-architecture-folder-structure-4-approaches-compared)]

The proposal's claim that Option B is "stricter about what counts as shared" is therefore load-bearing — it must actually enforce that strictness, not just assert it. Structural strictness requires more than a good intention in a proposal document.

**The concern in RIGRUNNER's specific case:** The proposal places in `common/` items like `engine-spec`, `assembly`, `collision`, `weight`, `staging` alongside render infrastructure and input. Of these, the fan-in evidence supports `world`, `transform`, `part`, `parts-catalog`, and `mount`/`mount-grid` as genuinely cross-feature (fan-in 8–33). For `assembly` (fan-in 8) and `staging` the proposal itself identifies them as judgment calls (§4 open boundary calls). An agent confronted with a new cross-feature concept has no algorithmic rule to determine `common/` vs its feature — the same uncertainty that exists today in a flat layout.

---

## 3. What conventions make feature-first reliably agent-friendly

### 3.1 The fan-in gate: the only durable `common/` criterion

Feature-Sliced Design (FSD) — the most mature published methodology for this pattern — defines the `shared` layer's eligibility criterion as "reusable functionality… not tied to a single business domain, with no dependencies on feature or app-specific code."
[[Feature-Sliced Design — Layers](https://feature-sliced.design/docs/reference/layers)]

The RIGRUNNER proposal already has an evidence base for this: the fan-in table. A defensible operationalisation:

- **fan-in ≥ N (e.g. 4+)** with consumers in at least two distinct features → eligible for `common/`
- **fan-in 1–3, single consumer** → stays in its feature

This rule is machine-evaluable (grep-countable) and gives both humans and agents an unambiguous placement decision. Without it the `common/` boundary must be adjudicated by judgment on every new file, recreating the flat-folder ambiguity for cross-feature code.

**RIGRUNNER-specific: the proposal's fan-in table already does this work.** The 33/32/27 fan-in cluster (`world`, `types`, `component`) is unambiguously core. The 7–19 cluster (`transform`, `parts-catalog`, `mount`/`mount-grid`, `assembly`, `renderable`, `weight`) is unambiguously `common/`. The 1–3 tail is unambiguously feature-local. The four open boundary calls in §4 are the real judgment seam — and the proposal documents them, which is the right move.

### 3.2 Per-directory CLAUDE.md / AGENTS.md: the structural multiplier

Claude Code reads CLAUDE.md files hierarchically, loading both root and subdirectory files when working in a subdirectory. This makes per-feature CLAUDE.md/AGENTS.md files a first-class mechanism for guiding agents:

> "When Claude works on an API controller, it sees the root CLAUDE.md (architecture, roles, domain model) plus the subdirectory harness (patterns, conventions, legacy flags)."
[[Building the Agent Harness: Subdirectory CLAUDE.md Files](https://dev.to/tacoda/building-the-agent-harness-subdirectory-claudemd-files-dcl)]

AGENTS.md is now a Linux Foundation open standard (as of August 2025), adopted across 60,000+ repositories, with backing from OpenAI, Anthropic, Google, and AWS.
[[CLAUDE.md, AGENTS.md & Copilot Instructions: Configure Every AI Coding Assistant](https://www.deployhq.com/blog/ai-coding-config-files-guide)]

**The payoff for Option B specifically:** a flat role-sliced layout has no sensible place to put a per-feature CLAUDE.md — a `components/CLAUDE.md` can only document 28 unrelated data structs. A `features/scrap/CLAUDE.md` can document the mechanic's invariants, which systems own what truth, and what patterns a new file in this feature should follow. That is high-signal, low-noise guidance that an agent actually acts on.

The builder.io guidance formalises this pattern:

> "Components live in `app/components`… forms: copy `app/components/DashForm.tsx`. Prevents agents from replicating legacy patterns while reducing navigation errors."
[[Improve your AI code output with AGENTS.md](https://www.builder.io/blog/agents-md)]

### 3.3 Path aliases reduce migration cost and long-term structural coupling

The current RIGRUNNER repo has **no path aliases anywhere** — every import is a relative `../` chain. This is the dominant mechanical migration cost of Option B: moving a file rewrites every relative import that touches it. The verified fact (from the orchestrator) is that this is "the DOMINANT mechanical migration cost and a key risk surface."

TypeScript path aliases decouple import statements from physical file locations:

> "Without aliases, refactoring can be a huge time sink and can lead to bugs if you forget to update import paths in every file."
[[Using path aliases for cleaner React and TypeScript imports](https://blog.logrocket.com/using-path-aliases-cleaner-react-typescript-imports/)]

An alias scheme like `@core/`, `@common/`, `@features/drive/` etc. would mean: (a) the migration itself rewrites relative paths once, replacing them with aliases; (b) all future structural moves within a tier don't cascade through the codebase; (c) agents writing new imports use the alias, which self-documents tier membership at the import site.

game/tsconfig.json `moduleResolution: "bundler"` supports aliases directly with `compilerOptions.paths`, and Vite 6 supports them via `resolve.alias`. No additional packages are required.

### 3.4 Barrel `index.ts` per feature: the public-API surface

FSD mandates an explicit public API file per slice:

> "Require explicit public API files (index.ts) for each reusable slice/package."
[[Feature-Sliced Design — Monorepo](https://feature-sliced.design/blog/frontend-monorepo-explained)]

A `features/scrap/index.ts` that re-exports only what other features or `common/` legitimately consume:
- Gives agents a single import target for the feature's public interface.
- Makes the feature's contract explicit and reviewable.
- Prevents other features from reaching into implementation details (a common source of hidden coupling).
- Reduces the import surface an agent must understand when working on a consumer.

This is an additive convention that costs nothing to adopt alongside Option B.

---

## 4. The `animators.ts` split and the dependency-direction question

The proposal correctly identifies `render/animators.ts` as the one file requiring a genuine rewrite rather than a move. The four animators (`animateWheels` → drive, `animateStorageFill` → storage, `animateReclaimer` → mounting, `animateScrapPile` → scrap) need to move into their respective feature directories.

The proposal notes the subtlety: if each animator moves into its feature and `common/render/view.ts` calls them all, then a `common/` file imports from `features/` — a shared-tier dependency on features, which inverts the intended dependency direction.

This is the standard FSD constraint: **shared/common must never import from features**.
[[Feature-Sliced Design — Layers](https://feature-sliced.design/docs/reference/layers)]

**Resolution options:**

1. **Inversion via callbacks / injected functions**: `common/render/view.ts` exposes an `animators` slot (array of `(views, world, dt) => void`) that `main.ts` populates by importing the per-feature animators. The composition root (already the "only file that imports broadly") is the right place for this wiring. This preserves the dependency direction at the cost of one extra argument/config on `RenderView`.

2. **Move view.ts delegation to main.ts**: `main.ts` calls per-feature animate functions directly in the frame loop (it already calls `view.animateWheels`, etc., by name). After the split, main.ts imports from `features/drive/`, `features/storage/`, etc. directly. `common/render/view.ts` loses these delegating wrappers. This is clean but makes `main.ts` slightly more verbose.

Option 2 is the simpler structural choice given that `main.ts` is already the composition root and already calls each animator by name. The frame loop in `main.ts` (lines 232–237) is the right home for this cross-feature orchestration; `view.ts` acting as an intermediary for feature-specific animations is the accidental coupling that the split resolves.

---

## 5. RIGRUNNER-specific risk: "two kinds of shared"

The proposal correctly names the in-game kernel `common/` to avoid clashing with the repo-root `shared/`. This is necessary but not sufficient. The risk is confusion for any agent (or human) who reads "shared" in a path and must decide whether it means `shared/` (cross-app: game + viewer) or `common/` (in-game kernel).

**Mitigation:** The root-level CLAUDE.md (already the project source of truth) should contain an explicit one-paragraph statement of the distinction. This is a documentation task, not a structural change.

The `game/src/common/` name is well-chosen and distinct. The risk drops to near-zero once the CLAUDE.md entry is written.

---

## 6. ECS-specific consideration: systems are functions, not classes

The ECS literature notes that systems "perform one specific task" and should be explicitly ordered. RIGRUNNER's systems are free functions over the world, making them good candidates for co-location with their feature — `features/drive/drive.ts` containing `movementSystem` and `driveSystem` is natural and readable.

The only ECS-specific structural constraint that matters here is the ADR-001 rule: `systems/mounting.ts` is the **single owner** of grid-snap + cell geometry. Under Option B, `mounting.ts` moves into `features/mounting/` but its single-owner invariant is unchanged — the rule is about which file owns the logic, not which directory it lives in. The ADR should be updated to reference the new path after migration.

---

## 7. Migration strategy: incremental is safe

The proposal's recommendation to pilot with `features/scrap/` first is well-calibrated. `scrap` is the most self-contained slice (verified: its only imports from other features are downhill toward `common/` — collision, storage), and it would validate the pattern before committing the full migration.

With no path aliases today, each file move requires updating imports in all consumers. The orchestrator confirmed this is the dominant cost. A practical sequence:

1. **Add path aliases first** (one PR, touches only tsconfig.json + vite.config). No files move.
2. **Migrate `features/scrap/`** (validates the approach against real code).
3. **Add `features/scrap/CLAUDE.md`** with the feature's invariants.
4. **Migrate remaining features** in order of increasing dependency (drive → engine → storage → mounting → economy → workshop → hud).
5. **Split `render/animators.ts`** as part of each feature's migration (animateWheels when drive/ migrates, etc.).
6. **Update root CLAUDE.md** with the "two kinds of shared" distinction.

Total file count: ~74 non-test files across 8 features. Realistic estimate with aliases pre-added: 2–3 focused PRs.

---

## 8. Verdict on the (a)/(b)/(c) choice

### Summary of findings

| Claim | Evidence verdict |
|---|---|
| Feature-first genuinely better for agents | **Confirmed**. Reduces exploration steps, context budget, placement ambiguity for feature-local code. |
| Role-sliced causes "pile accumulation" | **Confirmed**. Flat folders give no placement signal; literature and the RIGRUNNER evidence both support this. |
| Feature-first moves the ambiguity to `common/` | **Partially confirmed**. True if `common/` has no enforceable admission criterion. Mitigated by the fan-in gate. |
| The proposal's open boundary calls are blockers | **No**. §4 documents them correctly; they are judgment calls, not ambiguities the structure fails to resolve. |
| Path aliases are needed for the migration | **Strongly supported**. They de-risk the structural change and reduce future import maintenance for agents. |
| Per-directory CLAUDE.md per feature | **High-value additive**. First-class mechanism supported by both Claude Code and AGENTS.md standard. |
| `animators.ts` split dependency direction | **Real issue, resolvable**. Inversion-via-main.ts is the clean path given main.ts is already the composition root. |

### Recommendation: **(b) ALTER Option B**

Option B is structurally correct and well-evidenced. Approve it with two required additions and one clarification:

**Required addition 1 — Formalise the `common/` admission criterion.**
Write the fan-in gate into the proposal/ADR: a module moves to `common/` only when it has ≥ 2 distinct feature consumers (verified by grep/import count at migration time) AND it has no feature-specific semantics. This turns the admission decision from a judgment call into an auditable rule — the condition that prevents `common/` from becoming a new dumping ground.

**Required addition 2 — Add path aliases before any file moves.**
The no-aliases regime is the dominant migration risk and a long-term agent-friction tax. Before moving any file, add `@core/`, `@common/`, and `@features/<name>/` aliases to `game/tsconfig.json` and `vite.config.ts`. This is a one-PR change that unlocks all subsequent migrations and reduces future import-rewrite costs to near zero.

**Clarification — Resolve the `animators.ts` dependency direction.**
The proposal notes the subtlety but does not commit to a resolution. The clean path is: each animator moves into its feature during that feature's migration; `main.ts` imports them directly and calls them in the frame loop (removing `view.animateX()` delegation wrappers from `view.ts`). This keeps `common/render/view.ts` clean and preserves the dependency direction without architectural overhead.

These are not blocking objections to Option B's structure — they are additions that make its central claim ("only genuinely cross-feature code earns a place in `common/`") enforceable rather than merely aspirational.

---

## Sources

- [Coding Agents as a First-Class Consideration in Project Structures — dev.to](https://dev.to/somedood/coding-agents-as-a-first-class-consideration-in-project-structures-2a6b)
- [Structuring Your Codebase for AI Tools: 2025 Developer Guide — Propel Code](https://www.propelcode.ai/blog/structuring-codebases-for-ai-tools-2025-guide)
- [CLAUDE.md, AGENTS.md & Copilot Instructions: Configure Every AI Coding Assistant — DeployHQ](https://www.deployhq.com/blog/ai-coding-config-files-guide)
- [Configuring Agentic AI Coding Tools: An Exploratory Study — arXiv:2602.14690v3](https://arxiv.org/html/2602.14690v3)
- [Improve your AI code output with AGENTS.md — builder.io](https://www.builder.io/blog/agents-md)
- [Building the Agent Harness: Subdirectory CLAUDE.md Files — dev.to](https://dev.to/tacoda/building-the-agent-harness-subdirectory-claudemd-files-dcl)
- [Your agent's context is a junk drawer — Augment Code](https://www.augmentcode.com/blog/your-agents-context-is-a-junk-drawer)
- [AI Spec Template: What to Include and Leave Out — Augment Code](https://www.augmentcode.com/guides/ai-spec-template)
- [Why Coding Agents Still Use grep as Their Search Backbone — yage.ai](https://yage.ai/share/why-coding-agents-still-use-grep-en-20260327.html)
- [Why Cursor, Claude Code, and Devin Use grep, Not Vectors — MindStudio](https://www.mindstudio.ai/blog/is-rag-dead-what-ai-agents-use-instead)
- [Vertical Slice Architecture — Milan Jovanović](https://www.milanjovanovic.tech/blog/vertical-slice-architecture)
- [VSA Folder Structure: 4 Approaches Compared — Nadir Bad](https://nadirbad.dev/vertical-slice-architecture-folder-structure-4-approaches-compared)
- [The Shared Folder Anti-Pattern — Clean Code Playbook / Medium](https://medium.com/clean-code-playbook/the-shared-folder-anti-pattern-a-friendly-warning-from-inside-the-codebase-ef1cdf1471c8)
- [Flutter Project Structure: Feature-first or Layer-first? — codewithandrea.com](https://codewithandrea.com/articles/flutter-project-structure/)
- [Feature-Sliced Design — Layers Reference](https://feature-sliced.design/docs/reference/layers)
- [Feature-Sliced Design — Monorepo Explained](https://feature-sliced.design/blog/frontend-monorepo-explained)
- [Using path aliases for cleaner React and TypeScript imports — LogRocket](https://blog.logrocket.com/using-path-aliases-cleaner-react-typescript-imports/)
- [AGENTS.md — agents.md](https://agents.md/)
