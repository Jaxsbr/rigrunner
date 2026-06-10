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

## Complexity earns its place

We've proven the loop on **a single tradeoff axis: weight.** Richer axes (power draw, heat,
center-of-mass/balance, part tiers/levels) remain **captured ideas, not committed mechanics**. As we
build by discovery, an extra axis or system goes in only when play tells us it earns its complexity —
we add mechanics because they make the game better, not because they were once listed.

---

## The build

We build the game in `game/`, to a high standard: testable, maintainable, upgradeable. Reusable
pieces are promoted into `shared/` explicitly. The hard-won findings we accumulate as we build live
in [`docs/observations.md`](docs/observations.md).

**We build by discovery.** There is no fixed design document or committed roadmap yet — we don't have
one concrete goal, and that's deliberate. We find the game by exploring: capturing ideas
([`docs/ideas.md`](docs/ideas.md)), surfacing the strongest as candidate milestones
([`docs/milestones.md`](docs/milestones.md)), and building toward them. Because there's no concrete
plan, **every idea is still just an idea worth capturing** — none is "too future" to write down, and
none is committed until it has earned a place here or on the milestone list.

---

## Technology

- **Three.js** — rendering (the game is 3D; it began on primitive geometry and grows real assets
  over time).
- **Blender MCP** — agent-driven 3D asset generation. Grey-box / "rough but not garbage" quality is
  the explicit early target; the goal is to validate an agent-driven asset pipeline, not polished art
  up front. Setup: [`docs/blender-mcp-setup.md`](docs/blender-mcp-setup.md). Style consistency comes
  from a shared kit (`tools/blender/rr_style.py`), the contract in
  [`docs/asset-style.md`](docs/asset-style.md), and the **`blender-asset`** skill — use that skill to
  make/import an asset. Assets are GLB, loaded via the `Renderable {shape:'model'}` seam.
- **Vite** — dev server and build tooling.

## Structure & launching

```
rigrunner/
  CLAUDE.md            # this file — source of truth
  AGENTS.md            # pointer to this file
  docs/                   # NON-spec docs live at the top level; per-feature specs live in docs/specs/
    milestones.md         # HIGH-LEVEL DIRECTION — candidate milestones discovered by exploration
    observations.md       # concrete findings accumulated while building (what's fun / wrong)
    ideas.md              # raw brainstorm sessions — forward-looking, NOT committed direction
    world-progression-guidance.md  # the connective vision (maps · tech · restoration · progression)
    asset-style.md        # the 3D asset visual + technical contract (palette/scale/orient/export)
    blender-mcp-setup.md  # one-time Blender + blender-mcp wiring
    references.md         # visual-reference scrapbook (index for docs/references/ images)
    references/           # drop inspiration images here (the visual companion to ideas.md)
    architecture/         # ADRs — structural decisions (+ the system-review evidence trail)
    specs/                # individual feature SPECS & work-tracking (one *-spec.md per feature)
  tools/blender/          # asset pipeline: rr_style.py kit + build_asset.py + assets/ generators
  game/                   # the game (the active build)         -> npm run dev:game (real) · dev:sandbox (test world)
    public/assets/        # committed runtime GLBs (served at /assets/*.glb, by game AND viewer)
    vite.config.ts        # path aliases (@core/@common/@features/@shared) — shared by dev/build/test
    src/                  # FEATURE-FIRST (ADR-003): three tiers + features; the app/ tier composes them
      core/               #   ECS engine, ZERO game knowledge — world · types · component · geometry
      common/             #   strict domain kernel (shared by ≥2 features): components/ parts/ sim/
                          #     render/ input/ — see the admission rule below
      features/           #   vertical slices, ONE folder per mechanic — open one, see the whole thing:
                          #     drive engine mounting scrap storage workshop economy hud camps (tests co-located)
      app/                #   COMPOSITION-ROOT tier — the cross-feature importers (ADR-003): bootstrap (engine +
                          #     frame loop) · scenarios/ (sandbox | real-game seeds) · menu · snapshot+persistence (ADR-004)
      main.ts             #   front door — picks the world by launch mode (dev:sandbox→test, else menu→real),
                          #     then hands a seeded world to bootstrap
  viewer/                 # asset viewer — inspect any GLB in isolation           -> npm run dev:viewer
  shared/                 # modules promoted for use by both apps (explicit, never implicit)
    palette.json          # SINGLE source of the colour palette (read by rr_style.py + TS)
    assets.ts             # the assetId -> GLB URL registry (game + viewer)
    model-loader.ts       # shared GLTF load+cache helper
  .claude/skills/blender-asset/  # skill: generate a style-consistent GLB and wire it in
```

Clean separation rule: **each app has its own entry point and its own launch command.** Apps
never reach into each other's directories. Shared code is always explicit, via `shared/` (the
viewer reusing the game's `public/assets/` GLB files is a deliberate, configured exception, so
both serve one set of asset files).

| Command | What it does |
|---|---|
| `npm run dev:game` | Launch the game (the active build) |
| `npm run dev:viewer` | Launch the asset viewer (inspect any GLB + the palette, outside the game) |

### Where new code goes (feature-first — [ADR-003](docs/architecture/adr-003-feature-first-src-structure.md))

`game/src/` is organized by **feature**, not by architectural role. When you write new code, place it
by the mechanic it serves, not by what kind of file it is:

- **Default: it belongs to a feature.** New code goes in `features/<mechanic>/` — the slice it serves
  (e.g. a scrap behaviour → `features/scrap/`). A component, system, content table, render bit, and UI
  for one mechanic all live **together** in that folder. A brand-new mechanic (combat, restoration)
  earns a **new** `features/<x>/` folder **when its code is written** — never a speculative empty one.
- **`common/` is the strict, shared kernel — earn your way in.** A module moves to `common/` only when
  it has **≥2 distinct *feature* consumers** *and* carries **no feature-specific semantics**; otherwise
  it stays in its feature (duplication is cheaper than a wrong promotion — Rule of Three). Sub-tiers:
  `common/components` (shared ECS data), `common/parts` (the parts/recipes registry), `common/sim`
  (generic sim primitives), `common/render` (render infrastructure), `common/input`.
- **`core/` is the ECS engine with ZERO game knowledge** (`world`/`types`/`component`/`geometry`).
- **Inward-only invariant (load-bearing):** `core/` and `common/` must **never** import from
  `features/`. Per-frame feature work (animators, overlays) is dispatched from the **`app/`**
  composition-root tier (`bootstrap`) — the only cross-feature importers — never from a `common/` façade.
- **Imports use path aliases:** `@core` · `@common` · `@features` · `@shared`. Cross-tier/cross-feature
  imports use an alias; same-feature siblings use `./`. **`@common` (in-game kernel) ≠ `@shared`
  (repo-root code shared by the game AND the viewer)** — don't confuse the two.
- Per-feature `CLAUDE.md` files (e.g. `features/scrap/`, `features/mounting/`) restate single-owner
  rules at the point of edit — read one if it's there.

---

## Capturing what Jaco says: ideas vs decisions

Jaco moves between two very different modes, and they must land in different places. **Before
writing anything down, classify the intent. When unsure, ask — and default to the looser bucket.**

### Brainstorm / idea / observation (the default for thinking-out-loud)
Signals: "I was thinking…", "what if…", "this could be cool", riffing on inspiration (e.g. "in
Minecraft…"), reacting to the game, no firm commitment — often a brain dump of several loose
threads. Jaco intends to capture *many* of these over time as raw material.
- **Forward-looking ideas / inspiration** → `docs/ideas.md`, under a dated brainstorm session.
- **Concrete findings from building / playing** ("this feels wrong", "X turned out to matter")
  → `docs/observations.md`.
- Either way, also capture a memory `note` tagged `brainstorm` + `status:raw`.
- **Do NOT** phrase any of it as committed, and **do NOT** edit the decided parts of this file
  because of it. These are candidates, not decisions.

### Concrete decision / action (commitments & specs)
Signals: "let's do X", "decision:", "we're going with…", "the architecture is…", deliberate detailed
specs, instructions to build.
- → Update **`CLAUDE.md`** (this file is the source of truth) and/or capture a memory
  `decision`/`learning`. Record the *why*, not just the *what*.

### Why this matters
It's cheap to leave a half-formed idea raw in `ideas.md` and promote it later; it's expensive and
misleading to enshrine a ramble as committed direction. If a single message mixes both modes, **split
it**: route the firm parts to `CLAUDE.md`, the loose parts to `ideas.md`/`observations.md`.

## Git workflow (mandatory — never commit to `main`)

**All work lands on `main` via a PR from a dedicated branch. Never commit or push to `main`
directly** — not even docs. This is enforced two ways and is not optional:

- **Server-side:** a GitHub ruleset on `main` ("Protect main — require PR") rejects direct
  pushes and force-pushes. A PR is required; **no approval is required** (Jaco self-merges).
- **Local:** `.githooks/pre-push` refuses pushes to `main`. Enable once per clone:
  `git config core.hooksPath .githooks` (override only in emergencies with `--no-verify`).

**Always start from fresh `origin/main` — never trust the current branch** (it may be stale or
already squash-merged, which caused real pain before):

```sh
git fetch origin
git switch -c <type>/<slug> origin/main   # feat/ fix/ refactor/ chore/ idea/ docs/
```

**Land it:** push the branch and open a PR (account `Jaxsbr`); share the link; don't merge
unless asked.

```sh
git push -u origin HEAD && gh pr create --fill --base main
```

**After merge, clean up** so branches don't go stale (the other failure mode we hit):

```sh
git switch main && git pull --ff-only
git branch -d <type>/<slug>
git fetch --prune
```

If a feature-branch push is rejected as "behind", **rebase** onto the moved base — don't
merge: `git fetch origin && git rebase origin/main` then `git push --force-with-lease`.

**Two skills encode this** so agents stay on the same page — use the matching one:
- **`brainstorm`** — ideation / design / docs / spec sessions (writes to `docs/`, no code).
- **`implement-feature`** — any code change in `game/` / `shared/` / `viewer/` / `tools/`.

## Working agreement

- This project is **agent-driven**: agents write the code. With no fixed spec, we're guided by
  captured ideas (`docs/ideas.md`) and candidate milestones (`docs/milestones.md`), discovering the
  game as we build.
- Build the official game in `game/` to a high standard — but stay light on speculative complexity;
  let mechanics earn their place (see "Complexity earns its place").
- GitHub account for this project: **`Jaxsbr`** (personal).
- **Git workflow is mandatory** — see "Git workflow" above. Branch off `origin/main`, PR to
  merge, never push to `main`, clean up merged branches.
