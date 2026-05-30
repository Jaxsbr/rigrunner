# AGENTS.md

**Single source of truth: [`CLAUDE.md`](CLAUDE.md). Read it first.**

Quick orientation:

- **RIGRUNNER** is a vehicle-building scavenger game. Core loop: **Build → Run → diagnose → Build better → Run farther.**
- **Current phase:** Phase 1 prototype (throwaway proof of concept). No architectural standards required — optimize for learning whether the loop is fun.
- **What to build against:** [`docs/prototype-spec.md`](docs/prototype-spec.md) — 28 concrete acceptance checks.
- **Tech:** Three.js + Vite. We are also trialing the **Blender MCP** for rudimentary part/asset meshes.
- **Where code goes:** prototype code in `prototype/` only. `game/` is a Phase 2 placeholder. Shared code goes in `shared/`, explicitly.
- **Launch:** `npm run dev:prototype` (prototype) · `npm run dev:game` (production placeholder).
