# Synthesis A — Evidence Integrity & Migration Cost/Risk

> **Synthesizer brief for the review board.** Area A integrates the local import-graph research
> (L1, L3, L4, L5) and re-verifies the load-bearing numbers against live code on
> `idea/feature-first-structure`. Its job is to give the three reviewers a trustworthy factual
> floor for the (a)/(b)/(c) decision.
>
> **Bottom line:** the proposal's evidence is sound; the migration is cheap and overwhelmingly
> mechanical; the scrap-first pilot is genuinely safe; and adding path aliases first would
> materially improve the calculus. **Verdict: (b) ALTER** — approve Option B as the organizing
> axis, with a small, well-defined pre-migration checklist. Every alteration sharpens a seam the
> proposal already named; none changes the shape of Option B.
>
> **Date:** 2026-06-04 · **Scope:** evidence integrity + true cost/risk of executing Option B.

---

## 1. Does the proposal's evidence hold up?

**Yes, on all three load-bearing claims.** I re-ran the counts myself rather than trusting the
digest. Ground truth as of HEAD on `idea/feature-first-structure`:

| Metric | Proposal / digest | My independent count | Verdict |
|---|---|---|---|
| Non-test source files | ~74 | **74** | exact |
| Total `.ts` (incl. tests) | ~93 | **94** | within 1 |
| Test `.ts` files | — | **20** | — |
| Total relative import lines (incl. tests) | — | **450** | — |
| Relative import lines, non-test source | 314 | **314** | exact |
| Non-test source files carrying ≥1 relative import | ~65 | **67** | within 2 |
| `main.ts` import lines | 32 | **32** | exact |
| Role-folder file counts | components 28 / systems 25 / content 15 / render 12 / core 5 / ui 5 / input 2 / build 1 | **identical** | exact |

### 1a. Fan-in table → "three tiers, not two"
L1 verified the §2 fan-in table line by line: **16 of 19 numbers are exact**, and the 3 deltas
(`assembly` 8→6, `part` 12→11, `workshop-zone` 8→7) are off-by-one/off-by-two artifacts of whether
tests were counted. None moves an architectural conclusion. The data shows a clean gap — kernel
modules sit at fan-in **7–19** (`world` 33, `types` 32, `component` 27, `transform` 19,
`parts-catalog` 12, `mount`/`mount-grid` 8, `renderable`/`collider` 7), feature-local modules at
**1–3**. There is nothing in the 4–6 band that blurs the line. **The "three tiers, not two" claim
is supported by the real numbers, not hand-waving.**

### 1b. The no-cycles DAG
L1 and L4 traced every cross-feature import edge directly from `from '...'` statements and checked
the reverse direction on each. **No cycle exists.** Every edge points downhill toward the kernel or
a lower feature: `drive→engine`, `drive→weight`, `movement→drive`, `staging→mounting/assembly`,
`workshop-drain→scrap`, `hud→engine/drive`, `workshop→mounting`, `workshop→shop`. Reverse edges
were confirmed clean (e.g. `engine.ts` imports only `core/*` + a few `components/*`; never drive,
weight, or scrap). **The DAG claim is verified.**

### 1c. "animators.ts is the one real refactor"
**Accurate but incomplete.** `render/animators.ts` is a genuine 4-way grab-bag — I confirmed the four
exports (`animateWheels`, `animateStorageFill`, `animateReclaimer`, `animateScrapPile`) share no
state and never call each other (the file is purely an organizational artifact). Splitting them is
file creation + path fixups, no logic rewrite. **What the proposal does NOT resolve** is the
dependency direction: `render/view.ts` imports all four animators by name and exposes one delegation
method each (confirmed at `view.ts` lines 14, 55–58). If the animators move into `features/` and a
`common/render/view.ts` keeps calling them, the **shared tier would import the feature tier** — a
tier inversion on day one. This is the single most important correction the board must lock (see §3).

**Evidence-integrity verdict:** the quantitative foundation of Option B is trustworthy. The one
place the proposal's *prose* outruns its rigor is the animators/view.ts dependency direction, which
it names but leaves open.

---

## 2. The true cost & risk of executing Option B (relative-imports-only)

### 2a. The dominant cost is import-string churn, and it is bounded
I confirmed **zero path aliases anywhere**: `game/tsconfig.json` has `moduleResolution: "bundler"`,
`include: ["src"]`, **no `baseUrl`, no `paths`**; there is **no `game/vite.config.ts`**; and a grep
for `@`/`~`-style imports across all of `game/src` returns **nothing**. Every one of the 314
non-test import lines is a relative path. Moving any file rewrites (a) every relative import inside
it whose depth changes and (b) every relative import in every file that points at it.

**Full Option B migration:** ~280–310 of the 314 non-test import lines need touching across the ~67
files that carry imports. `main.ts` alone carries **32 imports, all of which change** (it is the
composition root; nothing under it keeps its relative position). **Every change is a path string —
zero are semantic.** TypeScript catches any miss at compile time; nothing fails silently.

### 2b. The scrap pilot blast radius (re-measured precisely)
The scrap slice is **11 source files + 3 test files** (`collectible`, `scrap-pile`, `digging`,
`loot-drop`, `cleared-ground`, `scrap-pile` sys, `scrap-collection` sys, `scrap` content,
`loot-table` content, `scrap-stains` render, `loot-overlay` ui; tests: `scrap-collection.test`,
`scrap-pile.test`, `loot-table.test`). I confirmed exactly **5 external callers** import from scrap:

```
main.ts                     4 import lines → scrap
render/animators.ts         2  (animateReclaimer reads Digging; animateScrapPile reads ScrapPile)
render/interaction-hints.ts 1  (ScrapPile)
render/zone-overlays.ts     1  (ScrapPile)
systems/workshop-drain.ts   1  (mountedStorages from scrap-collection)
```

That is **9 incoming import lines**. Inside the 11 scrap source files there are **42 outgoing
relative-import lines**.

> **A nuance L1 under-counted, in the pilot's favour.** L1 reported "~23" outgoing lines because it
> counted only imports pointing *outside* scrap. In reality two things happen on the move, and they
> partly cancel:
> - **Intra-scrap cross-folder imports become same-folder `./` imports and simplify.** Today
>   `systems/scrap-pile.ts` imports `../components/scrap-pile`, `../content/scrap`,
>   `../content/loot-table` — once all land in `features/scrap/` those become `./scrap-pile`,
>   `./scrap`, `./loot-table`. That is *less* path, not more.
> - **Imports to core/common shift depth** (`../core/world` → `../../core/world` or
>   `../../common/...`).
>
> So the honest figure is ~42 outgoing + 9 incoming ≈ **~51 mechanical line edits across ~16
> files** — slightly more than L1's headline ~33, but the extra edits are the trivial `../`→`./`
> simplifications. Either way it is small, and **100% TypeScript-verified**.

### 2c. The four seams — status after verification
All four are real and all four have concrete, code-confirmed resolutions. None changes Option B's shape.

1. **`engine-part` / `spawnEnginePart` is NOT engine-specific.** I confirmed `spawnEnginePart`
   consumers: `parts-catalog.ts`, `shop.ts`, `assembly.ts`, **and `ui/loot-overlay.ts` (scrap)**.
   So placing `engine-part.ts` in `features/engine/` plants an **undeclared `scrap→engine` edge**
   that the proposal's DAG does not show. *Fix:* promote `engine-part.ts` to `common/parts/` next to
   `parts-catalog.ts` and rename the spawner `spawnCatalogPart`. Dissolves the leak; semantically
   more honest.
2. **`mountedStorages` is a storage query living in scrap.** Confirmed: defined at
   `scrap-collection.ts:38`, consumed by `workshop-drain.ts:6/61`. It queries `Storage`+`Mount` only
   — no scrap awareness. Leaving it in scrap forces a horizontal `workshop→scrap` import the DAG does
   not declare. *Fix:* extract to `features/storage/`; both `scrap` and `workshop` then import it via
   already-declared downhill edges. **This is the one ordering dependency that touches the pilot** —
   see §3.
3. **`collision` & `weight` in `common/sim`.** `weight` is unambiguous kernel (the central tradeoff
   axis). `collision` is generic by construction (its own comment says "what a collision *means* is
   decided by the consumer … scrap today, projectile damage later") but has one consumer today
   (`scrap-collection.ts` imports `./collision`). *Lean:* promote both now. Note for the pilot:
   `scrap-collection.ts`'s `./collision` import flips from a same-folder sibling to a cross-tier
   `../../common/sim/collision` import — a small but real consequence of sequencing collision's
   placement before/with scrap.
4. **`animators.ts` split + view.ts direction** — see §3; this is the only structural item.

### 2d. ADR-001 / ADR-002 single-owners — not fragmented
- **ADR-001** (`systems/mounting.ts` is the sole owner of grid-snap + closest-cell scan): Option B
  moves the whole file intact to `features/mounting/mounting.ts`. The single-owner is preserved; no
  re-implementation is created. L4 confirms `staging.ts` and `build-affordances.ts` *reuse* mounting's
  seams rather than duplicating them, and that relationship is unchanged by the move.
- **ADR-002** (one `shared/three-canvas.ts` host): this file lives at the **repo root `shared/`**,
  outside `game/src/`. Option B does not touch it and creates no second host. The four game files
  that reach repo-root `shared/` (`entity-views.ts`, `articulation.ts`, `deck-view.ts`,
  `workshop-overlay.ts` — confirmed) only gain one `../` of depth; mechanical, not a guardrail risk.

**Cost/risk verdict:** Option B is a **zero-tooling-change restructure** (L5 confirms: no vite
config, no tsconfig include edit, no vitest glob, no package.json script touched). The entire cost is
~280–310 mechanical, compiler-checked import-string edits, plus exactly one genuine refactor
(animators). The risk surface is "did you miss a path?" — and TypeScript answers that on every build.

---

## 3. Is the scrap-first pilot genuinely safe and informative?

**Yes — it is the right pilot, with one sequencing precondition.**

**Why it is safe:**
- **Smallest realistic blast radius:** ~51 line edits across ~16 files, all mechanical, all
  TypeScript-caught.
- **Headless-verifiable:** the 3 scrap tests (`scrap-collection.test.ts`, `scrap-pile.test.ts`,
  `loot-table.test.ts`) run with no DOM and no Three.js, so the pilot can be proven green by
  `vitest run game/src/features/scrap` without launching a browser.
- **Most self-contained slice:** no feature imports *from* scrap except the single
  `mountedStorages` function, and even the render couplings (`animators`, `interaction-hints`,
  `zone-overlays`) read just one scrap component each (`ScrapPile`/`Digging`).

**Why it is informative:** the scrap move exercises *every* hard part of the full migration in
miniature — a cross-tier import (`./collision` → `common/sim`), the animator/view.ts direction
question (animators reads `ScrapPile`/`Digging`), an undeclared cross-feature edge
(`mountedStorages`), and intra-slice `../`→`./` simplification. If the pilot is clean and the tests
stay green, the team has de-risked the whole pattern.

**The one precondition:** if scrap moves *before* `mountedStorages` is extracted, `workshop-drain.ts`
will carry a visible `from '../../features/scrap/...'` cross-feature import until workshop also moves.
That is a **sequencing reminder, not a correctness bug** (the DAG stays acyclic). The clean ordering
is: **(i) add path aliases, (ii) extract `mountedStorages` to `features/storage/`, (iii) decide
collision's home, (iv) move scrap.** With those done, the pilot is unambiguous.

---

## 4. Would introducing path aliases first change the calculus?

**Yes — materially, and it is the highest-leverage low-cost addition the board can make.** Every
local researcher (L1, L5) and the external evidence converge on this.

**What aliases cost:** one new `game/vite.config.ts` (~10 lines of `resolve.alias`) plus a `baseUrl`
+ `paths` block in `game/tsconfig.json`. `moduleResolution: "bundler"` already supports `paths`.
That is the entire setup.

**What aliases buy:**
1. **They convert the dominant cost into a one-time event.** Without aliases, *every future file
   move* re-pays depth-churn forever. With `@core`/`@common`/`@features`/`@shared`, an import string
   is decoupled from physical depth: moving a file between `common/render/` and `features/workshop/`
   no longer rewrites its callers' paths. Given the roadmap (combat, restoration, MP tiers — all new
   slices and new moves), this compounds.
2. **They eliminate the "two kinds of shared" naming hazard at the import site.** `@shared` always
   means repo-root cross-app; `@common` always means the in-game kernel. The ambiguity L5 flags
   (a bare `common/render/stage.ts` in a diff being mistaken for repo-root `shared/`) disappears
   when every import literally reads `@common/...` vs `@shared/...`.
3. **They make tier violations greppable.** A `@features/...` import appearing inside a `@common/...`
   file is an instantly visible (and ESLint-enforceable) red flag — the exact invariant Option B
   depends on.

**Timing:** add aliases **bundled with the migration**, as **step 0** of the first PR (the scrap
pilot). Doing it then pays the import-rewrite cost *once* instead of twice (a separate alias PR
followed by a separate move PR would rewrite the same lines twice). The pilot becomes: introduce
aliases, then move scrap using alias paths — and the diff is self-documenting.

**Net:** aliases do not change the *direction* of the decision, but they change the *cost profile*
from "pay depth-churn on every move forever" to "pay once." Skipping them would make Option B work,
but would leave the noisiest part of every future PR (the `../../../../` chains) unaddressed — and
the proposal does not currently mention them at all. **This is the strongest single reason to ALTER
rather than approve as-is.**

---

## 5. Consolidated pre-migration checklist (the "ALTER" payload)

Ordered for execution. Each is a boundary/sequencing decision, not a redesign.

| # | Action | Why (evidence) | Cost |
|---|---|---|---|
| 0 | **Add path aliases** (`@core`, `@common`, `@features`, `@shared`) in the first PR — new `game/vite.config.ts` + `tsconfig paths`. | Pays import-rewrite once; resolves shared/common naming at every import site; makes tier violations greppable (§4). | ~1 new file + 1 config block. |
| 1 | **Resolve view.ts/animators direction:** strip the four `animateX` delegates from `RenderView`; call the feature animators directly from `main.ts` (already the composition root). `common/render/view.ts` keeps only feature-import-free methods (`sync`, `follow`, `syncWorkshopZones`, `syncInteractionHints`, `syncScrapStains`, `render`). | Prevents a shared→feature tier inversion on day one (§1c, L3, L4). The "one real refactor" the proposal names but leaves open. | ~4 lines move from view.ts to main.ts. |
| 2 | **Extract `mountedStorages`** from `scrap-collection.ts` to `features/storage/`. | Removes the undeclared `workshop→scrap` edge before the scrap pilot lands (§2c, confirmed at `workshop-drain.ts:6`). | Rename 2 callers. |
| 3 | **Promote `engine-part.ts` to `common/parts/`** and rename `spawnEnginePart`→`spawnCatalogPart`. | Removes the undeclared `scrap→engine` edge (confirmed: `loot-overlay.ts` calls `spawnEnginePart`). | Location + rename across ~5 callers. |
| 4 | **Decide `collision.ts` → `common/sim/` now** (recommended) so scrap's `./collision` import resolves cleanly cross-tier. | The system is already generic; combat will be its 2nd consumer; deciding it before the pilot avoids re-churn (§2c). | Placement decision. |
| 5 | **Split `zone-overlays.ts` / `interaction-hints.ts`** into feature-local `workshop/` + `scrap/` halves (or promote the shared zone read-interface to `common/`). | Both iterate `WorkshopZone` + `ScrapPile` together — neither can cleanly live in one feature (L3/L4). | Mechanical split of small files. |
| 6 | **Pilot scrap first**, then economy → storage → engine → drive → mounting → workshop → hud. | Scrap is the most self-contained, headless-testable slice (§3). | — |
| 7 | **Doc hygiene in the migration PR:** fix the already-stale `tools/blender/build_asset.py` (`game/src/content/assets.ts` → `shared/assets.ts`); update `blender-asset` SKILL step 4 (`content/` → `features/<feature>/`); add the three-tier layout + the `shared/` vs `common/` distinction to the graduating ADR. | Prevents the path-rot that L5 documents from misleading agents post-migration. | A few line edits. |

Items 1–6 are the substance; item 0 is the cost-multiplier; item 7 is cleanup. **CLAUDE.md's
directory map stops at `game/` level and does NOT need surgery** (L5 confirmed) — the new layout is
recorded in the ADR instead.

---

## 6. Verdict for the board

**(b) ALTER Option B.** The evidence is trustworthy: the fan-in table, the three-tier split, and the
no-cycles DAG are all verified against live code, and the 74-file / 314-import / 32-import-`main.ts`
figures are exact. The migration is cheap and overwhelmingly mechanical — a zero-tooling-change,
TypeScript-checked, ~280–310-line path rewrite plus exactly one real refactor. The scrap-first pilot
is genuinely safe and informative, with `mountedStorages` extraction as its only sequencing
precondition.

The proposal earns **ALTER rather than APPROVE-as-is** for two reasons grounded in evidence:
1. it leaves the **animators/view.ts dependency direction unresolved** (a tier inversion waiting to
   be planted on the first move), and
2. it **does not mention path aliases**, the single change that converts the dominant ongoing cost
   from "forever" to "once."

Neither changes Option B's shape. The structural direction is correct and should proceed.

---

## Appendix — figures I re-verified myself (not taken from the digest)

```
74   non-test source files
94   total .ts files (20 tests)
450  total relative import lines (incl. tests)
314  relative import lines in non-test source
67   non-test source files carrying ≥1 relative import
32   import lines in main.ts (all change on migration)
0    path aliases (no baseUrl/paths in tsconfig; no game vite.config; no @/~ imports)

Scrap pilot:
  11 source + 3 test files move
  42 outgoing relative-import lines inside scrap files (some ../ → ./ simplify)
   9 incoming import lines across 5 external callers
     main.ts (4), animators.ts (2), interaction-hints.ts (1),
     zone-overlays.ts (1), workshop-drain.ts (1)
  ≈ 51 mechanical edits across ~16 files, all TypeScript-caught

Confirmed seam facts:
  spawnEnginePart consumers include ui/loot-overlay.ts  → undeclared scrap→engine edge
  mountedStorages defined scrap-collection.ts:38, used  workshop-drain.ts:6/61 → undeclared workshop→scrap
  view.ts:14/55-58 delegates all 4 animators            → shared→feature inversion if view.ts stays in common/
  scrap-collection.ts imports ./collision               → flips to cross-tier when collision → common/sim
  4 game files import repo-root shared/ at depth 3       → gain one ../ under Option B (mechanical)
```
