# RIGRUNNER

A vehicle-building scavenger game. The player composes a modular machine — a **rig** — from
interchangeable parts, then drives it across a hostile landscape to harvest resources, returning
to a workshop to re-fit the rig based on what the last run demanded.

This file is the single source of truth for project context. Agents: read it first.

---

## The core loop (why the game is fun)

> **Build → Run → diagnose → Build better → Run farther.**

The fun lives in a tight cause-and-effect with a ~60–90 second beat:

- A change made in the **build bay** produces a difference the player can *feel* on the **run**.
- A frustration on the run produces an obvious *"I know exactly what to change"* thought back in the bay.

That thought-then-payoff is the entire game. The build bay only has meaning because of the run;
the run only has expression because of the build. Neither is fun alone — together they are the engine.

## The mechanisms that make it fun

These are the load-bearing mechanics. Everything else is decoration on top of them.

1. **Physical composition.** Parts are grabbed, slotted, and dumped by hand. The rig's silhouette
   changes in real time as parts go on and off. No list menus, no confirm dialogs — the build is tactile.
2. **Felt tradeoffs (weight as the central tension).** Adding parts and cargo makes the rig
   physically slower and heavier to handle — not just a worse number on a sheet. The player feels
   their build through the controls.
3. **Directional meaning.** A part's *placement* matters: a gun fires in the direction it faces, so
   where you mount it changes how the rig fights.
4. **Tactile transformation.** Resource nodes visibly deplete as they are harvested; containers
   visibly fill. Progress is something you watch happen, not a counter ticking up.
5. **Flee-or-fight.** The build determines whether the player outruns threats or stands and fights.
   A "bad" build (e.g. too slow to flee, no weapon to fight) is a teaching moment that sends the
   player back to the bay — it is a feature, not a bug.

## Design tension we are deliberately keeping minimal

The prototype uses **a single tradeoff axis: weight.** We are intentionally deferring richer axes
(power draw, heat, center-of-mass/balance, part tiers/levels) until playtesting tells us the base
loop is fun and which extra axis, if any, earns its complexity.

---

## Project phases

### Phase 1 — Prototype (proof of concept) — **CURRENT**

Prove the core loop is fun using primitive shapes and placeholder assets.

- **Throwaway-acceptable.** No architectural standards, patterns, or test coverage required.
  Optimize for *learning whether it's fun*, not for code quality.
- Lives entirely in `prototype/`.
- Done when every item in [`docs/prototype-spec.md`](docs/prototype-spec.md) passes.

### Phase 2 — Production game (later, only if the prototype proves fun)

Rebuild the game properly in `game/` to high standards: testable, maintainable, high-quality,
upgradeable. The prototype is the **reference and starting point**, not the foundation — production
code is written fresh to standard. Anything genuinely reusable is promoted into `shared/` explicitly.

---

## Technology

- **Three.js** — rendering for both phases (the game is 3D; primitive geometry is fine for the prototype).
- **Blender MCP** — we want to trial the Blender MCP to generate rudimentary 3D part/asset meshes on
  demand. Grey-box / "rough but not garbage" quality is the explicit target for the prototype; the
  goal is to validate an agent-driven asset pipeline, not to make polished art.
- **Vite** — dev server and build tooling.

## Structure & launching

```
rigrunner/
  CLAUDE.md            # this file — source of truth
  AGENTS.md            # pointer to this file
  docs/
    prototype-spec.md  # the 28-check acceptance criteria
  prototype/           # Phase 1 code (throwaway-ok)   -> npm run dev:prototype
  game/                # Phase 2 production skeleton    -> npm run dev:game  (placeholder)
  shared/              # modules promoted for use by both phases (explicit, never implicit)
```

Clean separation rule: **each app has its own entry point and its own launch command.** Prototype and
game never reach into each other's directories. Shared code is always explicit, via `shared/`.

| Command | What it does |
|---|---|
| `npm run dev:prototype` | Launch the prototype (the canvas we are building now) |
| `npm run dev:game` | Launch the production game (placeholder until Phase 2) |

---

## Working agreement

- This project is **agent-driven**: agents write the code, guided by `docs/prototype-spec.md`.
- In the prototype phase, prefer the simplest thing that lets us *feel* the loop. Disposable is fine.
- GitHub account for this project: **`Jaxsbr`** (personal).
