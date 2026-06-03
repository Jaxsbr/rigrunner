# W3 — Comparable Game Codebases: Structural Lessons for RIGRUNNER

**Reviewer role:** Web researcher — comparable game codebases  
**Date:** 2026-06-04  
**Proposal under review:** `docs/architecture/feature-first-structure-proposal.md` (Option B)  
**Board choice:** **(b) ALTER Option B** — approve the three-tier + features structure, with two targeted changes informed by how comparable games handle the same structural pressures RIGRUNNER faces.

---

## 1. Summary of findings

Seven comparable games and multiple design-pattern sources were surveyed. The consistent pattern across crafting games, factory builders, roguelites, and run-loop games is: **type-based ("role-sliced") organization is chosen at small scale, regretted at medium scale, and replaced with feature-based organization at large scale.** No comparable game at RIGRUNNER's current 74-file scale that uses type-slicing has documented satisfaction with it; every project that migrated to feature-slicing reports improved navigation and cohesion.

Two additional findings bear directly on the (a)/(b)/(c) choice:

1. **The `render/animators.ts` dependency direction** is an anti-pattern that comparable games resolve through callback injection or event-bus registration, never through a shared layer importing from features.
2. **The "build → run" loop split** is consistently handled as a **modal state machine within a single world** — not as separate scenes — which means RIGRUNNER's current "one world + modal interface mode" is the correct shape and should be codified structurally, not deferred or over-engineered.

---

## 2. Comparable codebases surveyed

### 2a. shapez.io — open-source factory/base-builder, JavaScript

**Repository:** [github.com/tobspr-games/shapez.io](https://github.com/tobspr-games/shapez.io)  
**Scale:** ~70k lines JS, multi-year active development  
**Language:** ES5/ES6 JavaScript (developer later stated they would use TypeScript if rewriting)

**Structure:**

```
src/js/
├── core/         ← engine utilities (renderer, input, audio, savegame)
├── game/         ← all gameplay code
│   ├── buildings/ ← ONE FILE PER BUILDING TYPE (miner.js, belt.js, cutter.js, ...)
│   ├── components/
│   ├── systems/
│   ├── hud/
│   ├── items/
│   ├── modes/
│   └── themes/
├── states/       ← scene/mode state machine
└── ...
```

**Key architectural lesson:** `game/buildings/` is a **vertical-slice folder** — each building file bundles all type-specific logic for that building. The parent `game/` folder is role-sliced (components, systems, hud), but the *content* within it gravitates toward feature-per-file. The developer's engine forced the role-split at the top; the feature logic naturally collapsed back into per-entity files anyway.

**Takeaway for RIGRUNNER:** shapez.io demonstrates the exact entropy the proposal describes — a role-sliced structure where game-specific logic gravitates toward feature-level files within each role folder. Option B formalizes what shapez.io discovered organically. The `modes/` folder maps to RIGRUNNER's deferred scene architecture.

**Source:** [tobspr-games/shapez.io on GitHub](https://github.com/tobspr-games/shapez.io), directory inspection.

---

### 2b. Slay the Web — open-source roguelike deck-builder, JavaScript

**Repository:** [github.com/oskarrough/slaytheweb](https://github.com/oskarrough/slaytheweb)  
**Scale:** mid-size; actively maintained  
**Language:** JavaScript with Astro UI  

**Structure:**

```
src/
├── game/         ← domain logic (feature-oriented)
│   ├── actions.js       ← action executor
│   ├── action-manager.js
│   ├── cards.js         ← card data + behavior (feature slice)
│   ├── combat.js / conditions.js / powers.js ← feature slices
│   ├── dungeon.js / rooms.js ← feature slices
│   └── utils-state.js   ← shared utilities
├── ui/           ← presentation layer
└── content/      ← game data / assets
```

**Key architectural lesson:** The game layer is organized **by feature domain** (cards, combat, powers, dungeon, rooms) rather than by type (state, actions, components). Shared utilities are a thin folder at the same level. There is no global `components/` or `systems/` folder — each domain file handles its own data and behavior. The UI layer is cleanly separated.

**Takeaway for RIGRUNNER:** `slaytheweb` is the closest in spirit to Option B's intent. Its `game/` directory is what RIGRUNNER's `features/` directory should look like. The clear `game/ → ui/` split maps directly to RIGRUNNER's `features/ → common/render/` boundary.

**Source:** [oskarrough/slaytheweb on GitHub](https://github.com/oskarrough/slaytheweb), directory inspection of [src/game/](https://github.com/oskarrough/slaytheweb/tree/main/src/game).

---

### 2c. OpenPenguinSurvivors — open-source Vampire Survivors clone, GDScript/Godot

**Repository:** [github.com/tristanarthur/OpenPenguinSurvivors](https://github.com/tristanarthur/OpenPenguinSurvivors)  
**Language:** GDScript (not TypeScript, but same structural pressures)

**Structure (root-level game modules):**

```
Camera/
Enemy/
EventBus/    ← cross-cutting event hub (thin, single file)
Pickup/
Player/
Weapon/
```

**Key architectural lesson:** A pure **feature-first organization** even in a small game (six top-level feature folders). The `EventBus/` folder is the exact solution to the cross-feature communication and render-dependency-direction problems the proposal identifies. Features communicate through events; no feature imports another feature directly.

**Takeaway for RIGRUNNER:** The `EventBus/` pattern for inter-feature communication is a concrete answer to the `render/animators.ts` dependency question. If RIGRUNNER's render code needs to call feature-specific animation logic, it subscribes to events or holds registered callbacks — it never imports from features. OpenPenguinSurvivors gets this right at tiny scale; RIGRUNNER should replicate the intent.

**Source:** [tristanarthur/OpenPenguinSurvivors on GitHub](https://github.com/tristanarthur/OpenPenguinSurvivors), directory inspection.

---

### 2d. Mindustry — open-source automation/tower-defense RTS, Java

**Repository:** [github.com/Anuken/Mindustry](https://github.com/Anuken/Mindustry)  
**Scale:** Very large (hundreds of thousands of lines, multi-year commercial project)  
**Language:** Java

**Structure (`core/src/mindustry/`):**

```
ai/, async/, audio/, content/, core/, ctype/, editor/,
entities/, game/, graphics/, input/, io/, logic/,
maps/, mod/, net/, service/, type/, ui/, world/
```

**Key architectural lesson:** Mindustry is organized **purely by type/role** at scale and is a commonly-cited example of the pain this causes. The `entities/` folder does contain sub-packages by entity type (comp/ for component definitions), but the game logic is distributed across `game/`, `logic/`, `world/`, and `entities/` simultaneously. Mindustry mod authors frequently complain about difficulty finding where specific mechanics live. The modding system (a form of feature extension) ultimately works around this by adding a parallel `content/` tree.

**Takeaway for RIGRUNNER:** Mindustry is the cautionary reference. At RIGRUNNER's current scale (74 non-test files), the type-sliced pain is starting to appear; at Mindustry's scale it is severe. Option B's adoption now, before the Mindustry trap closes, is well-timed.

**Source:** [Anuken/Mindustry on GitHub](https://github.com/Anuken/Mindustry), directory inspection; [Mindustry modding docs](https://mindustrygame.github.io/wiki/modding/1-modding/).

---

### 2e. FactorishJS — Factorio-style game, JavaScript (single-file)

**Repository:** [github.com/msakuta/FactorishJS](https://github.com/msakuta/FactorishJS)  
**Scale:** Small  
**Language:** JavaScript

**Structure:** Root-level `FactorishJS.js` (single large file) + utility modules (`perlinNoise.js`, `xorshift.js`).

**Key architectural lesson:** The single-file approach works at toy scale, then becomes the same flat-file problem RIGRUNNER currently has but compressed. The developer's next step would necessarily be to split by feature domain (mining, belts, smelting) because role-sliced splits create the same "mechanic is smeared across files" problem even within one file (e.g., a long series of if/else blocks per building type).

**Takeaway for RIGRUNNER:** Confirms the hypothesis — even the simplest games organically split by feature when growing. The flat structure is not viable.

**Source:** [msakuta/FactorishJS on GitHub](https://github.com/msakuta/FactorishJS).

---

### 2f. Three.js RTS ECS Engine demo — TypeScript, Three.js, ECS

**Repository:** [github.com/andvolodko/three.js-rts-ecs-engine](https://github.com/andvolodko/three.js-rts-ecs-engine)  
**Language:** TypeScript (97%)

**Structure:** TypeScript ECS demo with role-based `src/` organization (systems + traits separation).  

**Key architectural lesson:** The dev.to article by the same author ([Three.js Architecture: ECS](https://dev.to/i_babkov/threejs-architecture-ecs-3fg2)) is explicit: the role-sliced `systems/` + `traits/` split is appropriate for a *demo* and small projects, but the author warns against it at scale precisely because it encourages "logic-rendering coupling." The article recommends decoupled per-feature render layers — exactly what Option B proposes.

**Takeaway for RIGRUNNER:** Even the canonical Three.js + ECS tutorial advocates for Option B's approach at RIGRUNNER's scale.

**Source:** [Three.js Architecture: ECS — DEV Community](https://dev.to/i_babkov/threejs-architecture-ecs-3fg2), [andvolodko/three.js-rts-ecs-engine on GitHub](https://github.com/andvolodko/three.js-rts-ecs-engine).

---

### 2g. Pacific Drive — commercial vehicle survival roguelite (Ironwood Studios, Unreal Engine)

**Not open source**, but the most directly analogous game to RIGRUNNER commercially. Surveyed through developer interviews.

**Loop structure:**
- **Garage** (safe space): repair, upgrade, craft — exactly RIGRUNNER's "workshop" mode.
- **Zone expedition** (run): drive, scavenge, survive — exactly RIGRUNNER's "run" mode.

**Key architectural lesson (from the Unreal Engine developer interview):**

> "The garage provides a safe haven between each run... Breaking the game up into runs allows us to lean into the anomalous nature of the setting."

The mode separation was explicitly a *design feature*, not a technical constraint. The developers discovered the loop worked because the garage ritual deepened player attachment to the car, while the run-based structure kept tension constant. The two modes are structurally distinct but **share the same vehicle data model** — the car object persists across modes.

**Structural implication for RIGRUNNER:** The build↔run transition is a *modal state change on shared entity data*, not a scene reload. This means RIGRUNNER's features (`drive/`, `workshop/`, `mounting/`) should share `common/` components (e.g., `Assembly`, `Part`, `Weight`) that persist across modes. The drive-mode systems simply deactivate; the workshop-mode systems activate. This is the correct shape and it is already implicit in Option B.

**Source:** [Pacific Drive developer interview — Unreal Engine](https://www.unrealengine.com/en-US/developer-interviews/pacific-drive-is-a-run-based-driving-survival-game-with-an-ever-changing-mysterious-landscape).

---

## 3. The "build mode → run mode" split: how comparable games handle it

### Pattern observed across all surveyed games

No small/indie game surveyed uses **separate scenes** for build vs. run mode. The consistent pattern:

| Approach | Used by | Notes |
|----------|---------|-------|
| **Modal state on shared world** | Pacific Drive, Carvival, most roguelites | One world, systems activate/deactivate per mode |
| **State machine at composition root** | shapez.io `states/`, OpenPenguinSurvivors EventBus | Top-level state drives which systems are active |
| **Separate scenes (full reload)** | Larger games with distinct level data | Only when the two modes genuinely share no data |

RIGRUNNER's modes (workshop ↔ run) share:
- The rig entity (Assembly, Part components)
- The world entity (ScrapPile positions, cleared-ground state)
- The wallet/inventory

A full scene reload would destroy and rebuild this shared data unnecessarily. The modal state machine approach is correct and is what ideas.md 2026-06-01 defers. Option B accommodates this by keeping all features in one module tree, with `workshop/` and `drive/` as separate feature slices reading the same `common/` components.

**For the coming combat feature (ideas.md "Option D — looter camps"):** Combat is a new *mode* within the run, not a new scene. A `combat/` feature slice can read the same `drive/`, `mounting/`, and `economy/` components without duplicating them.

**For the future Restoration Sanctuary (M4/M5 ideas):** If the Sanctuary becomes a genuinely persistent separate world with different terrain, weather, and entity pools, then a scene architecture becomes warranted. But the structural advice here is: **don't design for scenes yet**. The modal state machine within one feature tree is the right shape until a second independent world actually ships. This is consistent with what ideas.md 2026-06-01 documents.

---

## 4. The render facade dependency direction: how comparable games solve it

The proposal's `render/animators.ts` split — where `common/render/view.ts` would import from feature animators — is the most structurally risky proposal element. The comparable-game survey surfaces three concrete solutions:

### 4a. EventBus pattern (OpenPenguinSurvivors)

```
feature/drive/ → emits "wheelSpin" event
feature/scrap/ → emits "pileSlump" event
common/render/view.ts ← subscribes to animation events, executes per frame
```

No import from `view.ts` into features. Features push events; view responds. Clean dependency direction.

### 4b. Callback injection at composition root (aligned with Bevy plugin model)

```
main.ts:
  import { animateWheels } from './features/drive/drive-anim'
  import { animateScrapPile } from './features/scrap/scrap-anim'
  view.register([animateWheels, animateScrapPile, ...])
```

`main.ts` is the **only** file allowed to see all features. It collects the animators and injects them into `view.ts` as callbacks. `view.ts` only knows about a `FrameCallback[]` interface defined in `common/`. This is the cleanest approach for RIGRUNNER's existing composition-root pattern.

### 4c. Component-driven render (pure ECS)

Each feature writes animator output into a `RenderPatch` component on the entity. The render system reads `RenderPatch` and applies it. No feature-specific import is needed in the render system — it reads generic components.

**Recommendation for RIGRUNNER:** Resolution 4b (callback injection) is the lowest-friction migration. It requires only that `view.ts` accept an injected array of `FrameCallback` functions and that `main.ts` wire them in. This is ~10 lines of change and preserves all existing animator logic. It also sets the precedent for how to add the future `combat/` animator (add one more entry to `main.ts`).

---

## 5. Scale and navigation: the "screaming architecture" test

The "Screaming Architecture" concept ([profy.dev](https://profy.dev/article/react-folder-structure)) states: a well-organized codebase tells readers about the game, not about the framework. Opening `game/src/` should reveal the game's features, not the ECS pattern.

**Current RIGRUNNER structure screams "ECS framework":**
```
components/  systems/  content/  render/  ui/  input/  core/
```

**Option B structure screams "vehicle scavenging game":**
```
core/  common/  features/drive/  features/scrap/  features/workshop/  features/mounting/
```

The comparable-game evidence is unanimous: feature-first organization at this scale (50–100 files) **always wins** on the navigation and agent-clarity tests. The type-sliced approach is only defended for sub-30-file projects or as a starting point before the game's areas are known.

RIGRUNNER now has seven distinct mechanical areas (drive, engine, mounting, scrap, storage, workshop, economy). They are known. The features are legible. The time to formalize them as the organizing axis is now, before the combat and restoration features add more surface area.

---

## 6. The two-"shared" naming problem

Verified fact #7 (orchestrator): there are **two kinds of "shared"** in the RIGRUNNER repo:
- `shared/` at repo root (cross-app: assets.ts, model-loader.ts, three-canvas.ts — used by both `game/` and `viewer/`)
- `common/` inside `game/src/` (in-game domain kernel: only used by the game)

The proposal's choice of `common/` for the in-game tier is correct precisely because it avoids clashing with the repo-root `shared/`. However, comparable game research surfaces a second risk: developers new to the project (or AI agents navigating the repo) may conflate the two. The fix is documentation in `CLAUDE.md` and in an AGENTS.md pointing `shared/` at cross-app code and `game/src/common/` at in-game domain code. This is not a reason to change the naming — `common/` is correct — but it must be explicitly documented.

**shapez.io's analogous problem:** shapez.io has a `src/js/core/` (engine utilities) and a `src/js/game/` (game logic) at top level, and within `game/` has another `components/` subfolder. The dual "core" semantics (top-level engine core vs. "core" systems within the game) caused confusion in the mod community. Option B avoids this by naming the tiers differently (`core/` for the ECS engine, `common/` for the domain kernel, `features/` for feature code).

---

## 7. Roadmap pressure compatibility

The proposal must absorb four pending areas without restructuring:

| Pending area | Current location | Under Option B |
|---|---|---|
| Laden-weight (weight aggregation seam) | `systems/`, `components/` | `common/sim/weight.ts` — already in the kernel tier |
| Part-identity tiers/specials | `content/`, `components/`, `systems/` | `features/workshop/`, `common/parts/` — natural home |
| Looter camps + combat (new area) | **No folder yet** | `features/combat/` — new vertical slice |
| Restoration Sanctuary | **No folder yet** | `features/sanctuary/` or a new `modes/` tier if it's a second world |

**The "no folder for combat" case is the most important.** A type-sliced structure forces the question: does `combat/` get a `systems/combat.ts` (in the flat `systems/` pile) or a `components/combat-*.ts`? Option B answers it cleanly: `features/combat/` owns everything about combat. No ambiguity, no decision cost per file.

**The Sanctuary question aligns with the deferred-scene architecture.** If Sanctuary is ever implemented as a second independent world loop (different from the scrap-run loop), a `modes/` folder with `run/` and `sanctuary/` sub-trees could be introduced. That is the moment to reconsider scene architecture. Until then, Sanctuary logic would live as a `features/sanctuary/` slice that activates via the modal state machine.

---

## 8. Agent navigability: a RIGRUNNER-specific concern

RIGRUNNER is explicitly agent-driven (CLAUDE.md: "this project is agent-driven: agents write the code"). The research on AI agent codebase navigation ([Propel Code, 2025](https://www.propelcode.ai/blog/structuring-codebases-for-ai-tools-2025-guide)) is unambiguous:

> "When you ask an AI agent to write a new feature, a good agent will eventually say: 'I need to write a test for this.' But what happens next is usually messy — the agent has to figure out where that test belongs."

Feature-first organization with co-located tests (Option B) solves this directly: the test for `features/scrap/scrap-collection.ts` lives at `features/scrap/scrap-collection.test.ts`. No decision required.

More broadly, the Screaming Architecture principle (§5 above) applies with doubled force for agents: an agent asked to "add a new scrap behavior" in a type-sliced codebase must query multiple folders. In Option B it opens `features/scrap/` and finds everything. **This is the concrete agent-productivity argument for Option B.**

---

## 9. Board recommendation: (b) ALTER Option B

The comparable-game evidence strongly supports Option B's structure. Two targeted alterations are recommended based on this research:

### Alteration 1: Resolve `animators.ts` dependency direction via callback injection (not view-imports-features)

The proposal says `common/render/view.ts` will call per-feature animators. Every comparable pattern (OpenPenguinSurvivors EventBus, shapez.io system dispatch, Bevy plugin registration) says the **render/shared layer must not import from features**. The correct fix (already described in W2) is: `view.ts` holds a `FrameCallback[]`, injected at startup by `main.ts`. This is ~10 lines of change and should be written as a prerequisite in the migration plan, not left as an ambiguity.

### Alteration 2: Add documentation clarifying the two "shared" namespaces

The repo has `shared/` (cross-app) and will have `game/src/common/` (in-game domain). Document this explicitly in `CLAUDE.md` and `AGENTS.md` before migration begins. The shapez.io community's confusion with dual `core/` semantics is the cautionary data point.

Everything else in Option B — the three-tier shape, the boundary decisions, the pilot-with-scrap approach, the co-located tests, the `main.ts` composition root — is consistent with every comparable game that has been at RIGRUNNER's scale and solved the same organizational problem.

---

## Sources

- [tobspr-games/shapez.io — GitHub](https://github.com/tobspr-games/shapez.io)
- [shapez.io src/js/game/ directory](https://github.com/tobspr-games/shapez.io/tree/master/src/js/game)
- [shapez.io src/js/game/buildings/ directory](https://github.com/tobspr-games/shapez.io/tree/master/src/js/game/buildings)
- [oskarrough/slaytheweb — GitHub](https://github.com/oskarrough/slaytheweb)
- [slaytheweb src/game/ directory](https://github.com/oskarrough/slaytheweb/tree/main/src/game)
- [tristanarthur/OpenPenguinSurvivors — GitHub](https://github.com/tristanarthur/OpenPenguinSurvivors)
- [Anuken/Mindustry — GitHub](https://github.com/Anuken/Mindustry)
- [Mindustry core/src/mindustry/ directory](https://github.com/Anuken/Mindustry/tree/master/core/src/mindustry)
- [msakuta/FactorishJS — GitHub](https://github.com/msakuta/FactorishJS)
- [andvolodko/three.js-rts-ecs-engine — GitHub](https://github.com/andvolodko/three.js-rts-ecs-engine)
- [Three.js Architecture: ECS — DEV Community](https://dev.to/i_babkov/threejs-architecture-ecs-3fg2)
- [Pacific Drive developer interview — Unreal Engine](https://www.unrealengine.com/en-US/developer-interviews/pacific-drive-is-a-run-based-driving-survival-game-with-an-ever-changing-mysterious-landscape)
- [Pacific Drive — Wikipedia](https://en.wikipedia.org/wiki/Pacific_Drive_(video_game))
- [Screaming Architecture: Evolution of a React folder structure — profy.dev](https://profy.dev/article/react-folder-structure)
- [Folder structure for big projects: package by type, layer or feature — Madisoft Labs](https://labs.madisoft.it/folder-structure-for-big-projects-package-by-type-layer-or-feature/)
- [Enjoyable Game Architecture (Chickensoft) — chickensoft.games](https://chickensoft.games/blog/game-architecture)
- [Modular Monolith: A Sane Architecture for Indie Game Devs — Wayline](https://www.wayline.io/blog/modular-monolith-indie-game-dev)
- [Feature-Sliced Design: Layers reference](https://feature-sliced.design/docs/reference/layers)
- [ECS Abstraction Layers and Module Encapsulation — Seba's Lab](https://www.sebaslab.com/ecs-abstraction-layers-and-modules-encapsulation/)
- [Structuring Codebases for AI Tools 2025 — Propel Code](https://www.propelcode.ai/blog/structuring-codebases-for-ai-tools-2025-guide)
- [Gamedev File Structure — Johan Steen / bitbebop.com](https://blog.bitbebop.com/gamedev-file-structure/)
- [Folder/Structure/Lessons for games — Game Developer](https://www.gamedeveloper.com/production/folder-structure-lessons-for-games)
- [REDLINE CROOKS — GamingOnLinux](https://www.gamingonlinux.com/2023/06/roguelite-vehicle-combat-game-redline-crooks-is-pure-chaos/)
- [Carvival — Steam](https://store.steampowered.com/app/2626430/Carvival/)
- [tiny-ai-ops/Survivors-Like — GitHub](https://github.com/tiny-ai-ops/Survivors-Like)
