# RIGRUNNER

A vehicle-building scavenger game. Compose a modular machine — a **rig** — from interchangeable
parts, drive it across a hostile landscape to harvest resources, then re-fit based on what the last
run demanded.

> **Core loop:** Build → Run → diagnose → Build better → Run farther.

This repo is in **Phase 1: prototype** — a throwaway proof of concept to find out whether that loop
is fun, using primitive shapes. See [`CLAUDE.md`](CLAUDE.md) for full context and
[`docs/prototype-spec.md`](docs/prototype-spec.md) for the 28-check acceptance spec.

## Getting started

```bash
npm install
npm run dev:prototype   # launch the prototype
npm run dev:game        # launch the production placeholder (Phase 2, not built yet)
```

## Layout

| Path | Purpose |
|---|---|
| `prototype/` | Phase 1 code — throwaway-ok, optimized for learning |
| `game/` | Phase 2 production game — high standards (placeholder until the prototype proves fun) |
| `shared/` | Modules promoted for use by both phases (explicit, never implicit) |
| `docs/` | Specs and design docs |

## Tech

Three.js + Vite. We are also trialing the **Blender MCP** for generating rudimentary part/asset meshes.
