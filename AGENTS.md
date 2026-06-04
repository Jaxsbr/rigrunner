# AGENTS.md

**Single source of truth: [`CLAUDE.md`](CLAUDE.md). Read it first.**

Quick orientation:

- **RIGRUNNER** is a vehicle-building scavenger game. Core loop: **Build → Run → diagnose → Build better → Run farther.**
- **How we work:** we build the game in `game/` to a high standard, and we **build by discovery** (no fixed spec or committed roadmap yet).
- **What to build against:** captured ideas in [`docs/ideas.md`](docs/ideas.md) and candidate milestones in [`docs/milestones.md`](docs/milestones.md). [`docs/observations.md`](docs/observations.md) logs the hard-won findings as we build.
- **Tech:** Three.js + Vite. We use the **Blender MCP** for grey-box part/asset meshes.
- **Where code goes:** the game in `game/`. Shared code goes in `shared/`, explicitly; the asset viewer is `viewer/`.
- **`game/src/` is FEATURE-FIRST** ([ADR-003](docs/architecture/adr-003-feature-first-src-structure.md)): place new code in `features/<mechanic>/` (the slice it serves — a mechanic's component/system/content/render/UI live together); promote to `common/` only when ≥2 *features* need it and it has no feature-specific semantics; `core/`+`common/` must never import `features/`. Imports use aliases `@core`/`@common`/`@features`/`@shared` (`@common` ≠ repo-root `@shared`). Full rule in `CLAUDE.md` → "Where new code goes".
- **Launch:** `npm run dev:game` (the game) · `npm run dev:viewer` (the asset viewer).
- **No concrete plan yet → every idea is still worth capturing.** Nothing is "too future" to write down; nothing is committed until it earns a place in `CLAUDE.md` or `milestones.md`.

**Before capturing anything Jaco says, classify the intent** (full version in `CLAUDE.md` § "Capturing what Jaco says"):

- **Brainstorm / idea / inspiration** ("what if…", riffing, thinking out loud) → `docs/ideas.md` (dated session) + a memory `note` tagged `brainstorm`/`status:raw`. **Never** treat as committed.
- **Concrete finding from building / playing** ("this feels wrong", "X mattered") → `docs/observations.md`.
- **Concrete decision / spec / build instruction** → update `CLAUDE.md` (source of truth) + a memory `decision`/`learning`, with the *why*.

When unsure, ask and default to the looser bucket. It's cheap to promote a raw idea later; expensive to enshrine a ramble as direction.
