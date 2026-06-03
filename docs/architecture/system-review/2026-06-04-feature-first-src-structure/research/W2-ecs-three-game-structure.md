# W2 — ECS & Three.js/TS Game Project Structure: External Evidence

**Reviewer role:** Web researcher — ECS + Three.js/TypeScript game project structure  
**Date:** 2026-06-04  
**Proposal under review:** `docs/architecture/feature-first-structure-proposal.md` (Option B)  
**Board choice:** **(b) ALTER Option B** — approve the three-tier + features structure but add path aliases as a prerequisite, and clarify the `animators.ts` split strategy so that `common/render/view.ts` does not import from `features/`.

---

## 1. Summary of findings

Six independent bodies of evidence converge on the same conclusion: **a thin engine core + a shared domain kernel + per-feature vertical slices is the dominant, battle-tested pattern for ECS game projects**. Option B matches this pattern almost exactly. The one gap the external evidence surfaces is mechanical: the proposal's migration path is costlier than necessary because RIGRUNNER has no path aliases, and the proposal's resolution of the `animators.ts` split creates a dependency-direction violation that industry practice resolves differently.

---

## 2. The ECS-vs-feature-first tension is a false dichotomy

The proposal asks whether feature-first "fights" ECS. The external evidence says no — the two are orthogonal:

- **ECS defines a data model** (entities are IDs; components are pure data; systems are free functions over matching component sets). It says nothing about how files are grouped.
- **Feature-first is a _file organization_ convention.** A feature slice owns the components, systems, and render code that implement one mechanic. The ECS engine itself (the `World`, the query runner, the type registry) remains a thin, game-agnostic core.

The Three.js + ECS blog post at dev.to ([Three.js Architecture: ECS](https://dev.to/i_babkov/threejs-architecture-ecs-3fg2)) demonstrates this: it keeps a role-sliced layout (a `systems/` folder and a `traits/` folder) for a tiny demo, justifying the split as "logic and rendering exist in separate, testable units." That's fine at small scale. The same author warns that at larger scale "logic-rendering coupling" in traditional Three.js projects is the failure mode — and the remedy is exactly what Option B proposes: owned feature render layers instead of one monolithic `render/` folder.

The simulation library [sim-ecs](https://github.com/NSSTC/sim-ecs) organizes its Pong example with systems named by feature behavior (`InputSystem`, `PaddleSystem`, `CollisionSystem`, `BallSystem`, `AnimationSystem`) co-located by feature rather than split into a flat `systems/` directory. This is the micro-scale confirmation.

---

## 3. The three-tier pattern is the consensus

Multiple independent sources describe the same three-tier shape:

| Tier | Name in sources | Contents |
|------|----------------|----------|
| 1 (bottom) | Engine / micro-kernel / core | Entity/component primitives, scheduler, query engine — zero game knowledge |
| 2 (middle) | Domain kernel / shared kernel / common | Cross-feature data types, shared systems, render infrastructure |
| 3 (top) | Features / game layer / plugins | Vertical slices that own their own components, systems, and render code |

Sources:

- The ECS 2.0 / micro-kernel architecture article ([daydreamsoft.com](https://www.daydreamsoft.com/blog/ecs-2-0-data-oriented-micro-kernel-architectures-for-massive-persistent-game-worlds)) describes tier 1 as "intentionally small and efficient, designed only to manage system execution, event dispatching, job distribution, and memory access patterns" and tier 2 as independently operating subsystems surrounding the kernel. Tier 3 is "game-specific code."
- The generalist programmer game engine layer article ([generalistprogrammer.com](https://generalistprogrammer.com/game-engine-architecture)) describes a five-layer stack but collapses to the same three when viewed from a game codebase perspective: platform/core (engine), resource management + scene (kernel/common), game logic (features). The rule: "each layer depends only on layers beneath it."
- The Bevy game engine (Rust ECS, the most-cited ECS exemplar) uses exactly this shape ([vladbat00.github.io](https://vladbat00.github.io/blog/001-organising-bevy-projects/)): `bevy_ecs` (the pure engine crate), `bevy_*` plugin crates (the shared infrastructure), and per-game feature plugins that group components + systems + resources per mechanic. The folder structure from the Vlad article:

  ```
  src/
  ├── lib.rs          ← composition root (= main.ts in Option B)
  ├── algo/
  ├── duel/           ← one feature plugin: owns components, systems, events
  ├── gameplay/
  ├── grid/
  ├── items/
  ├── player/
  ├── utils/          ← shared utilities (= common/ in Option B)
  └── world_gen/
  ```

  Inside each feature folder (e.g. `duel/`): the plugin registers its own components and systems in a `build()` method called from the composition root. This is structurally identical to Option B's `features/drive/`, `features/scrap/`, etc., with `main.ts` as the composition root.

- The Meta Horizon Spatial SDK ([developers.meta.com](https://developers.meta.com/horizon/documentation/spatial-sdk/spatial-sdk-ecs/)) formalizes this as "SpatialFeatures": "rather than manually registering individual components and systems, SpatialFeatures let you package complete ECS-based functionality into reusable modules." The module owns its components + systems + resources; the engine and shared infrastructure sit below.

**Option B matches this consensus precisely.** The naming (`core/`, `common/`, `features/`) is non-standard only in that most sources use "engine/kernel/game" or Bevy's crate-level naming, but the structural intent is identical.

---

## 4. Vertical-slice "shared layer" discipline matches Option B's rules

The vertical slice architecture literature ([chanhle.dev](https://chanhle.dev/en/blog/vertical-slice-architecture-guide)) gives the clearest statement of the shared-layer discipline:

> "Shared code should be earned through repeated use, not created preemptively."

And it names the anti-pattern: "Fake Slices" — feature folders that route all logic through a giant shared `services/` directory. True vertical slicing means shared infrastructure for cross-cutting concerns only; feature-specific logic stays in the feature.

The Feature-Sliced Design methodology ([feature-sliced.design](https://feature-sliced.design/docs/get-started/overview)) goes further and states an **import rule**: modules can only import from layers strictly below them. A feature cannot import from another feature at the same level. The shared/entities/kernel layer contains "cross-cutting stuff" that all features may consume.

Option B's stated rules reproduce this exactly:
- `core/` has zero game knowledge (nothing may import from above it).
- `common/` holds only genuinely cross-feature code.
- Features import from `common/` and `core/` but not from each other (the DAG in the proposal is acyclic).
- `main.ts` is the only cross-feature importer — it is the composition root.

This is the correct shape. The discipline is well-founded.

---

## 5. The `animators.ts` split: the dependency-direction problem

The proposal identifies `render/animators.ts` as "the one real refactor" and says: "each animation moves into its feature's render and `common/render/view.ts` calls them."

This creates a dependency-direction violation: `common/render/view.ts` (in the kernel tier) would import from `features/drive/`, `features/storage/`, `features/mounting/`, `features/scrap/` (in the feature tier). **That inverts the allowed dependency direction** — shared/kernel code must not depend on feature code.

The external evidence surfaces two clean resolutions:

**Resolution A — Event/component-based render dispatch (data-driven, purist ECS)**  
The Sander Mertens article ([ajmmertens.medium.com](https://ajmmertens.medium.com/why-vanilla-ecs-is-not-enough-d7ed4e3bebe5)) argues that system execution order should be *phase-based and data-driven*, not expressed as direct system-to-system dependencies. Under this approach, each feature's animator is a system that runs in a known render phase; `view.ts` does not call animators directly — it only drives the ECS update loop. Animators read component state and write Three.js object mutations independently. No cross-tier import occurs.

**Resolution B — Feature animators registered at composition root**  
Following the Bevy plugin model ([bevy.org](https://bevy.org/learn/quick-start/getting-started/plugins/)): each feature plugin *registers* its animator system with the app (i.e., `main.ts`). The shared `view.ts` has a per-frame hook that runs all registered frame-update functions; individual features push their animator into that hook at startup. `view.ts` holds a list of callbacks; it never imports from `features/`. This preserves Option B's tier rules.

**Resolution C — Animators stay in their feature; `view.ts` receives injected callbacks**  
The simplest migration for RIGRUNNER: `view.ts` accepts an array of `FrameAnimator` callbacks injected by `main.ts`. Each feature exports its animator. `main.ts` (the composition root — the *only* file allowed to import broadly) collects them and passes them to `view`. Dependency direction stays clean: `view.ts` ↑ `common/`, animators ↑ `features/`, wiring ↑ `main.ts`.

Resolution C is the lowest-effort and most idiomatic given RIGRUNNER's existing `main.ts`-as-composition-root pattern. It is the direct translation of the Bevy plugin registration model to TypeScript without needing a formal plugin registry.

---

## 6. Path aliases: the dominant mechanical cost the proposal under-weights

Verified fact #1 (from the orchestrator): RIGRUNNER has **no path aliases** — every import is relative. Moving any file rewrites every relative import that touches it.

The external evidence is unambiguous on this:

- **tsconfig `paths` + vite-tsconfig-paths** ([npmjs.com/vite-tsconfig-paths](https://www.npmjs.com/package/vite-tsconfig-paths), [timsanteford.com](https://www.timsanteford.com/posts/setting-up-vitest-to-support-typescript-path-aliases/)) make the alias transparent to both Vite's dev server and Vitest. The plugin is a one-line addition to the Vite config and one-time addition of `paths` to `tsconfig.json`.
- **The refactoring benefit is directly relevant here:** "when restructuring your project, path aliases eliminate the need to update imports across multiple files." ([webreaper.dev](https://webreaper.dev/posts/tsconfig-paths-setup/))
- RIGRUNNER's `game/tsconfig.json` has `moduleResolution: "bundler"` and no `baseUrl`/`paths`. The `game/` app currently has no `vite.config.ts` of its own (Vite is launched with `vite game` from the root). Adding aliases requires a `game/vite.config.ts` with `resolve.alias` (or the `vite-tsconfig-paths` plugin) and updating `game/tsconfig.json` with `baseUrl` and `paths`.
- With aliases in place, moving `systems/drive.ts` → `features/drive/drive.ts` does not touch any importing file. Without aliases, every importer must be updated.

**The proposal should treat path-alias setup as a prerequisite step, not an afterthought.** It reduces the migration from a grep-and-fix-imports operation across ~93 files to pure file-move operations.

Suggested aliases (illustrative, not prescriptive):

```json
// game/tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "~core/*":    ["src/core/*"],
      "~common/*":  ["src/common/*"],
      "~features/*":["src/features/*"]
    }
  }
}
```

```ts
// game/vite.config.ts (new file)
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vite';
export default defineConfig({ plugins: [tsconfigPaths()] });
```

The `~` prefix is a common convention distinguishing internal project aliases from npm package names.

---

## 7. ECS and Three.js-specific structural notes

**Three.js render is not inherently feature-agnostic.** The Three.js [Discover Three.js book](https://discoverthreejs.com/book/first-steps/app-structure/) and the Three.js Journey course ([threejs-journey.com](https://threejs-journey.com/lessons/code-structuring-for-bigger-projects)) both describe a module-per-concern approach for larger Three.js projects — but they are not ECS projects and do not prescribe role-sliced vs. feature-sliced. The only constraint Three.js imposes is that the scene, renderer, and camera are shared objects. RIGRUNNER already handles this correctly via ADR-002's single three-canvas host.

**Render systems in ECS are projections, not owners of truth.** This is already correct in RIGRUNNER (verified fact #5). Each feature's render code reads component state and updates Three.js objects. There is no state in the render layer. This means splitting animators by feature is safe — there is no shared mutable state that would break if the animator functions are in separate files.

**ECS systems are free functions, not classes.** RIGRUNNER's existing design (verified fact #5) matches the lightweight "bitECS-style" ECS where systems are pure functions. The Becsy ([lastolivegames.github.io](https://lastolivegames.github.io/becsy/guide/introduction)) and sim-ecs ([github.com/NSSTC/sim-ecs](https://github.com/NSSTC/sim-ecs)) approaches use class-based systems but the organizational lesson is the same: systems belong with the feature they implement, not in a global `systems/` folder.

**`hud/stats-hud.ts` is a legitimate cross-feature projection.** The proposal's placement of `hud/` as its own feature slice is consistent with the Bevy model: a HUD system reads components from multiple features (engine + drive) but writes only to UI — it is a projection, not an owner. It belongs as a thin feature slice that reads `common/` components. The Feature-Sliced Design model calls this a "Widget" (a self-contained chunk that composes across entities). Option B's `features/hud/` is correct.

---

## 8. What the research does NOT support

- **A global `systems/` folder is not recommended by any ECS source at feature-code scale.** The role-sliced pattern appears only in small examples (sub-10 files). Every large-scale ECS project found (Bevy, sim-ecs Pong, the Vlad Bevy article, Meta SpatialFeatures) groups systems with their feature, not in a flat global folder.
- **Option A** (feature subfolder inside each role folder) has no external defenders. No source recommends "components/scrap/, systems/scrap/, render/scrap/" over "features/scrap/{components, systems, render}."
- **Option C** (group only the simulation by feature) is a valid incremental step but is strictly weaker than B — it leaves the render and UI code role-sliced, which is where Three.js coupling pain accumulates.

---

## 9. Board recommendation: (b) ALTER Option B

Approve the three-tier architecture (core / common / features) and the overall structure as proposed. Make two concrete additions before treating the proposal as an ADR:

**Addition 1 — Path aliases as migration prerequisite**  
Add a step 0 to the migration plan: install `vite-tsconfig-paths`, create `game/vite.config.ts`, and add `baseUrl`/`paths` to `game/tsconfig.json`. Define `~core/*`, `~common/*`, `~features/*` aliases. Do this before moving any file. This converts a high-friction import-rewrite migration into low-friction file moves.

**Addition 2 — Resolve the `animators.ts` dependency direction explicitly**  
The proposal says `common/render/view.ts` will call per-feature animators. This must be corrected: `view.ts` must not import from `features/`. The recommended resolution (Resolution C above) is: `view.ts` accepts an injected array of `FrameAnimator` callbacks; `main.ts` collects each feature's animator and passes them in at startup. This preserves the tier rules, keeps `main.ts` as the composition root, and requires zero additional framework.

Everything else in Option B — the tier names, the boundary decisions at the four noted seams, the "scrap first" pilot recommendation, the co-located tests — is consistent with external best practice and should be adopted as-is.

---

## Sources

- [Three.js Architecture: ECS — DEV Community](https://dev.to/i_babkov/threejs-architecture-ecs-3fg2)
- [Vertical Slice Architecture guide — Chanh Le](https://chanhle.dev/en/blog/vertical-slice-architecture-guide)
- [Feature-Sliced Design: Overview](https://feature-sliced.design/docs/get-started/overview)
- [Why Vanilla ECS Is Not Enough — Sander Mertens (Medium)](https://ajmmertens.medium.com/why-vanilla-ecs-is-not-enough-d7ed4e3bebe5)
- [ECS 2.0 and Data-Oriented Micro-Kernel Architecture — daydreamsoft.com](https://www.daydreamsoft.com/blog/ecs-2-0-data-oriented-micro-kernel-architectures-for-massive-persistent-game-worlds)
- [Game Engine Architecture (layers) — generalistprogrammer.com](https://generalistprogrammer.com/game-engine-architecture)
- [Bevy Plugins — bevy.org](https://bevy.org/learn/quick-start/getting-started/plugins/)
- [Organising Bevy Projects — vladbat00.github.io](https://vladbat00.github.io/blog/001-organising-bevy-projects/)
- [Bevy Code Organization — taintedcoders.com](https://taintedcoders.com/bevy/code-organization)
- [ECS SpatialFeatures — Meta Horizon OS developers.meta.com](https://developers.meta.com/horizon/documentation/spatial-sdk/spatial-sdk-ecs/)
- [sim-ecs — GitHub NSSTC/sim-ecs](https://github.com/NSSTC/sim-ecs)
- [bitECS — GitHub NateTheGreatt/bitECS](https://github.com/NateTheGreatt/bitECS)
- [Becsy ECS introduction — lastolivegames.github.io](https://lastolivegames.github.io/becsy/guide/introduction)
- [vite-tsconfig-paths — npmjs.com](https://www.npmjs.com/package/vite-tsconfig-paths)
- [Setting up Vitest for TypeScript path aliases — timsanteford.com](https://www.timsanteford.com/posts/setting-up-vitest-to-support-typescript-path-aliases/)
- [TSConfig path aliases to improve your code — webreaper.dev](https://webreaper.dev/posts/tsconfig-paths-setup/)
- [Aliasing in Vite w/ TypeScript — DEV Community](https://dev.to/tilly/aliasing-in-vite-w-typescript-1lfo)
- [Three.js Journey: code structuring for bigger projects — threejs-journey.com](https://threejs-journey.com/lessons/code-structuring-for-bigger-projects)
- [Discover Three.js: App Structure — discoverthreejs.com](https://discoverthreejs.com/book/first-steps/app-structure/)
- [Web Game Dev: ECS — webgamedev.com](https://www.webgamedev.com/code-architecture/ecs)
