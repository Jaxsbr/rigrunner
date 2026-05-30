# AGENTS.md

**Single source of truth: [`CLAUDE.md`](CLAUDE.md). Read it first.**

Quick orientation:

- **RIGRUNNER** is a vehicle-building scavenger game. Core loop: **Build → Run → diagnose → Build better → Run farther.**
- **Current phase:** The **prototype is COMPLETE.** We are now building the **official game** in `game/`, to a high standard — and we **build by discovery** (no fixed spec or committed roadmap yet).
- **What to build against:** captured ideas in [`docs/ideas.md`](docs/ideas.md) and candidate milestones in [`docs/milestones.md`](docs/milestones.md). [`docs/prototype-spec.md`](docs/prototype-spec.md) + [`docs/observations.md`](docs/observations.md) are the prototype's record (reference only).
- **Tech:** Three.js + Vite. We are also trialing the **Blender MCP** for rudimentary part/asset meshes.
- **Where code goes:** the official game in `game/`. `prototype/` is complete — a design reference only, never a foundation. Shared code goes in `shared/`, explicitly.
- **Launch:** `npm run dev:game` (the active build) · `npm run dev:prototype` (prototype reference, complete).
- **No concrete plan yet → every idea is still worth capturing.** Nothing is "too future" to write down; nothing is committed until it earns a place in `CLAUDE.md` or `milestones.md`.

**Before capturing anything Jaco says, classify the intent** (full version in `CLAUDE.md` § "Capturing what Jaco says"):

- **Brainstorm / idea / inspiration** ("what if…", riffing, thinking out loud) → `docs/ideas.md` (dated session) + a memory `note` tagged `brainstorm`/`status:raw`. **Never** treat as committed.
- **Concrete prototype finding** ("this feels wrong", "X mattered") → `docs/observations.md`.
- **Concrete decision / spec / build instruction** → update `CLAUDE.md` (source of truth) + a memory `decision`/`learning`, with the *why*.

When unsure, ask and default to the looser bucket. It's cheap to promote a raw idea later; expensive to enshrine a ramble as direction.
