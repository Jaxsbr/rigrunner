# L5 — Cross-App, Shared Tier & Build/Tooling Analysis

**Role:** Local-repo researcher — cross-app, shared tier & build/tooling  
**Sources read:** `shared/` (repo root), `viewer/`, `game/index.html`, `game/tsconfig.json`,
`viewer/tsconfig.json`, `viewer/vite.config.ts`, `package.json`,
`game/src/render/animators.ts`, `game/src/render/view.ts`, `game/src/render/entity-views.ts`,
`game/src/ui/deck-view.ts`, `game/src/ui/workshop-overlay.ts`, `game/src/main.ts`,
`.claude/skills/blender-asset/SKILL.md`, `.claude/skills/implement-feature/SKILL.md`,
`tools/blender/build_asset.py`, `CLAUDE.md`, `docs/architecture/feature-first-structure-proposal.md`,
relevant spec documents in `docs/`.  
**Date:** 2026-06-04

---

## 1. Scope

This review covers four concrete questions:

1. **Naming collision risk** — does `common/` (the proposed in-game domain kernel) collide, in
   practice, with the repo-root `shared/`?
2. **Tooling impact** — does Option B require any change to `vite`, `tsconfig`, `vitest`, or
   `package.json` scripts? Or is it purely file moves?
3. **External references to `game/src`** — do any files outside `game/src/` (skills, tools,
   docs, `CLAUDE.md`) reference old role-sliced paths in a way that would mislead agents after
   migration?
4. **Path aliases** — would adding `tsconfig "paths"` + Vite `resolve.alias` materially
   de-risk the move and all future moves?

---

## 2. Repo-root `shared/` and the proposed in-game `common/`

### 2.1 What `shared/` actually is

`shared/` at the repo root contains exactly five files:

```
shared/assets.ts          # assetId → GLB URL registry (both apps)
shared/model-loader.ts    # GLTF load+cache helper
shared/model-portrait.ts  # turntable canvas widget (workshop overlay only)
shared/three-canvas.ts    # shared Three.js canvas host (ADR-002)
shared/palette.json       # single source of colour palette (rr_style.py + TS)
```

These are **cross-app** primitives. They exist because both `game/` and `viewer/` need them,
and the clean-separation rule (`CLAUDE.md` § "Structure & launching") prohibits the apps from
importing from each other. The viewer's `vite.config.ts` explicitly widens `server.fs.allow`
to the repo root and its `tsconfig.json` includes `["src", "vite.config.ts", "../shared"]`.

The proposed `common/` would live at `game/src/common/` — visible only to `game/`. It is a
**game-only** domain kernel. The two things are genuinely different in purpose and scope.

### 2.2 Is `common` the right name?

**Risk (concrete, not theoretical):** an agent or developer who sees a bare path like
`common/render/stage.ts` in a diff, error message, or import — without the `game/src/` prefix
— could momentarily confuse it with the repo-level `shared/`. The risk is modest in normal
reading (full paths are shown), but it rises in agent instructions and skill prompts where
paths are often abbreviated.

**Why `common` still works:**
- The full path is always `game/src/common/`, which is unambiguous.
- `CLAUDE.md` already uses "shared" to mean the repo-root tier. An in-game tier with a
  *different* name is actively clearer than naming it `shared/` as well.
- Alternatives were assessed: `kernel/` is more precise ("the vocabulary every feature speaks")
  but is also less familiar as a folder convention. `domain/` is also precise but suggests
  domain-driven design semantics. `lib/` is too generic.

**Finding:** `common` is acceptable, but the in-game meaning **must be documented explicitly**
(a one-line comment in the folder, or an entry in the ADR) to prevent the modest confusion risk
from compounding. The most important thing is that it is NOT named `shared/`.

### 2.3 Dependency direction: game/src files that import repo-root shared/

Four files in `game/src/` currently import from repo-root `shared/`:

| File (current path) | Imports from shared/ |
|---------------------|---------------------|
| `game/src/render/entity-views.ts` | `shared/model-loader` |
| `game/src/render/articulation.ts` | `shared/model-loader` (type import) |
| `game/src/ui/deck-view.ts` | `shared/model-loader`, `shared/assets`, `shared/three-canvas` |
| `game/src/ui/workshop-overlay.ts` | `shared/model-loader`, `shared/model-portrait` |

These four files all sit at depth 3 within `game/src/` (e.g. `game/src/render/entity-views.ts`),
so their current import is `../../../shared/model-loader`.

Under Option B:
- `render/entity-views.ts` moves to `game/src/common/render/entity-views.ts` (depth 4)
- `render/articulation.ts` moves to `game/src/common/render/articulation.ts` (depth 4)
- `ui/deck-view.ts` moves to `game/src/features/workshop/deck-view.ts` (depth 4)
- `ui/workshop-overlay.ts` moves to `game/src/features/workshop/workshop-overlay.ts` (depth 4)

All four files gain one path segment. Their `../../../shared` imports must become `../../../../shared`.
This is purely mechanical churn — correct, not a design question.

**Decision-bearing note:** this exact class of churn is eliminated by path aliases (§5 below).

---

## 3. Tooling impact — is Option B purely file moves?

### 3.1 Vite entry point

`game/index.html` references `/src/main.ts`. Under Option B, `main.ts` stays at
`game/src/main.ts` (it is the composition root and is explicitly kept there by the proposal).
The Vite entry is unchanged.

There is **no `vite.config.ts` for the game** today — `vite game` uses the `game/` directory
as root with all defaults. Option B does not require adding one (though adding one would be
needed for path aliases, §5).

### 3.2 TypeScript config (`game/tsconfig.json`)

```json
"include": ["src"]
```

This includes all of `game/src/**`. Under Option B, `game/src` still contains `core/`,
`common/`, `features/`, and `main.ts`. No change to `tsconfig.json` is required.

### 3.3 Vitest test discovery

`package.json` runs `vitest run game`. In Vitest, the argument is a path filter; it discovers
all `*.test.ts` files under `game/`. Tests co-located inside any subfolder of `game/src/` are
found automatically. Option B does not change this behaviour — no test-glob update needed.

### 3.4 `package.json` scripts

`dev:game`, `build:game`, `typecheck:game`, `test:game`, `test:game:watch` all reference
`game/` as the root, not `game/src/**`. All unchanged by Option B.

### 3.5 `viewer/tsconfig.json` and `viewer/vite.config.ts`

`viewer/` imports exclusively from:
- `three` (npm)
- `../../shared/model-loader`, `../../shared/assets`, `../../shared/palette.json` (repo-root shared)
- `./articulation` (its own source)

The viewer never imports from `game/src`. Option B is an internal restructure of `game/src/`,
so the viewer is **completely unaffected**.

`viewer/vite.config.ts` points `publicDir` at `game/public` (for the GLB files) — also
unaffected.

### 3.6 Summary

**Option B requires zero tooling changes.** No new Vite config, no tsconfig edits, no vitest
glob changes, no package.json script updates. It is purely a file-move operation whose only
mechanical costs are relative-import path rewrites.

---

## 4. External references to `game/src` paths — documentation debt

### 4.1 Already-stale reference (pre-existing bug)

`tools/blender/build_asset.py` lines 12 and 59 both say:

```
register the assetId in game/src/content/assets.ts
```

`assets.ts` was moved to `shared/assets.ts` some time ago. This reference is already wrong
today, independent of Option B. It is a low-severity bug (the message is informational) but
it is the clearest demonstration that tool file comments about internal paths rot over time.

### 4.2 Spec documents (historical, not agent-navigation documents)

`docs/workshop-interface-spec.md` and `docs/scrap-stain-decals-spec.md` contain a combined
~25 references to paths like `game/src/components/`, `game/src/systems/`, `game/src/ui/`,
`game/src/content/`, and `game/src/render/`. These are **built specs** — they record what was
implemented when the feature was shipped, not live navigation targets. Agents should not use
them to find code (CLAUDE.md + grep/Read are the right tools). Updating them would create
noise; they are best left as historical records.

### 4.3 ADR-002

`docs/architecture/adr-002-shared-three-canvas-host.md` references `game/src/ui/deck-view.ts`
once. Under Option B this would become `game/src/features/workshop/deck-view.ts`. Since ADRs
record decisions made at a point in time, the existing file does not need updating; the
implementing PR should note the path change in its body.

### 4.4 CLAUDE.md — the agent source of truth

`CLAUDE.md`'s "Structure & launching" section shows the repo tree down to `game/` level only:

```
game/                   # the game (the active build)
  public/assets/        # committed runtime GLBs
```

It does **not** enumerate `game/src/` subfolders. This is good. After Option B is approved and
migrated, CLAUDE.md does not need a surgery of the directory map — but the ADR that graduates
this proposal should include a summary of the three-tier layout so agents landing fresh on the
repo understand it without having to grep. The "source of truth" sentence in CLAUDE.md should
point to the ADR once it exists.

### 4.5 Skill: `blender-asset`

`.claude/skills/blender-asset/SKILL.md` step 4 says:

> Give an entity a model `Renderable` (in `content/` or wherever it's spawned)

After migration there is no `content/` folder — entity spawning moves into the relevant
`features/<feature>/` folder. The phrase "or wherever it's spawned" offers a graceful hedge,
but `content/` as the example would mislead agents placing new GLB references. This one line
needs updating to `features/<feature>/` when Option B is migrated.

### 4.6 Skill: `implement-feature`

`.claude/skills/implement-feature/SKILL.md` references `shared/` only in the repo-root sense
(the cross-app tier). No change needed.

### 4.7 `tools/blender/assets/workshop.py`

Line 14 references `game/src/content/workshop.ts` in a comment. Historical, low priority.

---

## 5. Path aliases — decision-useful analysis

### 5.1 What they are

TypeScript `paths` in `tsconfig.json` + Vite `resolve.alias` in a `vite.config.ts` replace
relative import strings with stable symbolic names:

```ts
// Today (depth-dependent):
import { ModelLoader } from '../../../shared/model-loader';
import { World } from '../../core/world';

// With aliases (depth-independent):
import { ModelLoader } from '@shared/model-loader';
import { World } from '@core/world';
```

### 5.2 Setup cost

There is no `game/vite.config.ts` today. Adding one is a one-line file plus config. This
is the only non-trivial setup step.

```ts
// game/vite.config.ts (new)
import { defineConfig } from 'vite';
import { resolve } from 'path';
export default defineConfig({
  resolve: {
    alias: {
      '@core':     resolve(__dirname, 'src/core'),
      '@common':   resolve(__dirname, 'src/common'),
      '@features': resolve(__dirname, 'src/features'),
      '@shared':   resolve(__dirname, '../shared'),
    },
  },
});
```

`game/tsconfig.json` needs `baseUrl: "."` and a `paths` block to match. The existing
`moduleResolution: "bundler"` is compatible with `paths`.

One-time migration: all ~359 relative imports in game/src would need rewriting. This is the
same rewrite required by the file moves, so alias adoption could be bundled with the migration
at no additional conceptual cost — only additional textual volume.

### 5.3 What they solve

**Concrete:**

1. **Shared-tier imports stop accumulating `../`**. The four files that today use
   `../../../shared/` will need `../../../../shared/` under Option B. With `@shared` they stay
   `@shared/model-loader` regardless of where in the tree the file lives.

2. **Every future file move is cheaper.** A file that moves between `common/render/` and
   `features/workshop/` today requires updating all its callers' relative paths. With aliases,
   only the caller's understanding of which tier the module belongs to changes — and that is
   captured in the alias prefix, not in a depth count.

3. **The `@shared` alias makes the two-kinds-of-shared explicit in code.** `@shared` always
   means repo-root cross-app. `@common` always means game-internal kernel. There is no
   ambiguity at the import site.

### 5.4 What they do NOT solve

- Aliases do not remove the need to carefully classify files (common vs feature vs core).
- Aliases do not prevent circular imports or tier violations — they make those violations
  easier to grep for (a `@features` import inside `@common` is immediately visible).
- They add one new file (`game/vite.config.ts`) to the project.

### 5.5 Recommendation

**Path aliases are worth adding at the point of migration, not before.** Reason: the value is
greatest when files are being moved (the import rewrites happen anyway); adding aliases before
the move would require a second pass. Bundling alias adoption with the Option B migration
produces aliases everywhere in a single PR rather than two separate PRs.

**Aliases also provide the clearest resolution to the naming confusion risk** identified in §2:
`@common` and `@shared` make the distinction explicit at every import site, even in abbreviated
paths.

---

## 6. Cross-app boundary integrity under Option B

One guardrail in `viewer/vite.config.ts` is worth preserving explicitly:

```ts
// viewer/vite.config.ts
server: { fs: { allow: ['..'] } }
```

This allows the viewer's dev server to serve files from the repo root (so `../../shared/...`
imports work). Under Option B this is unchanged. The viewer never reaches into `game/src/`.

**ADR-002 single-owner rule** (`shared/three-canvas.ts`): `three-canvas.ts` lives in repo-root
`shared/`. Under Option B it stays there — it is explicitly cross-app. The proposal's
`common/render/` does not duplicate it; render files that need a canvas host will continue to
import `@shared/three-canvas`. No fragmentation risk.

---

## 7. Findings summary

| Question | Finding |
|----------|---------|
| Does `common/` name collide with `shared/`? | Minor ambiguity risk; mitigated by the full path context and by path aliases (`@common` vs `@shared`). Name is acceptable; `kernel/` would be marginally clearer but `common` is fine. |
| Tooling changes required by Option B? | **Zero.** No vite config, no tsconfig include, no vitest glob, no package.json scripts need changing. Purely file moves + import path rewrites. |
| Does viewer/ need changes? | **No.** viewer/ never imports game/src. |
| External references that become stale? | build_asset.py (already wrong re: content/assets.ts); blender-asset skill step 4 (content/ example). CLAUDE.md and the two-spec docs do not need updating. |
| Should path aliases be added? | **Yes, at migration time.** Bundle with the Option B file moves. Resolves the shared/-vs-common naming ambiguity at import sites and eliminates depth-dependent churn on all future moves. |

---

## 8. Bearing on the (a)/(b)/(c) choice

The tooling picture is uncomplicated: Option B is a **zero-tooling-change restructure** from
the build system's perspective. The viewer is unaffected. The two-kinds-of-shared risk is real
but solvable with path aliases and a naming note. No external config file blocks or
complicates the migration.

**Recommendation: (b) ALTER — approve Option B with two additions:**

1. **Add path aliases (`@core`, `@common`, `@features`, `@shared`) as part of the migration
   PR** (requires one new `game/vite.config.ts` and a `paths` addition to `game/tsconfig.json`).
   Bundle with the file moves so the two-pass rewrite cost is paid once.

2. **Fix `tools/blender/build_asset.py`** lines 12/59 in the same PR — the `content/assets.ts`
   reference is already stale (it should be `shared/assets.ts`) and the migration PR is the
   natural moment to correct it.

These are small additions to an otherwise clean proposal. Everything else in Option B
holds from this lens — the zero-tooling cost, the viewer isolation, the viewer/vite cross-app
boundary, and the ADR-002 single-canvas-host guardrail all survive the restructure without
modification.
