# RIGRUNNER

A vehicle-building scavenger game. Compose a modular machine — a **rig** — from interchangeable
parts, drive it across a hostile landscape to harvest resources, then re-fit based on what the last
run demanded.

> **Core loop:** Build → Run → diagnose → Build better → Run farther.

See [`CLAUDE.md`](CLAUDE.md) for the full context — it's the single source of truth. We **build by
discovery**: there's no fixed roadmap; we capture ideas ([`docs/ideas.md`](docs/ideas.md)), surface
the strongest as candidate milestones ([`docs/milestones.md`](docs/milestones.md)), and build toward
them.

## Getting started

```bash
npm install
npm run dev:game        # launch the game (the active build)
npm run dev:viewer      # launch the asset viewer (inspect any GLB in isolation)
npm run test:game       # run the game's unit tests
```

## Layout

| Path | Purpose |
|---|---|
| `game/` | The game — built to a high standard (testable, maintainable, upgradeable) |
| `viewer/` | Asset viewer — inspect any GLB + the palette, outside the game |
| `shared/` | Modules used by both game and viewer (explicit, never implicit) |
| `tools/blender/` | Asset pipeline — the `rr_style` kit + generators |
| `docs/` | Design docs, observations, ideas, and milestones |

## Tech

Three.js (rendering) + Vite (dev/build). We use the **Blender MCP** to generate grey-box part/asset
meshes via an agent-driven pipeline — see [`docs/asset-style.md`](docs/asset-style.md) and the
`blender-asset` skill.
