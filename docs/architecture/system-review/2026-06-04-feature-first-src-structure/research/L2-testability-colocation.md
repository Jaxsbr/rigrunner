# L2 — Testability & Test Co-location Research

> **Board role:** Local-repo researcher — testability and test co-location  
> **Proposal under review:** `docs/architecture/feature-first-structure-proposal.md` (Option B)  
> **Date:** 2026-06-04

---

## 1. How tests are organised today

### 1.1 Vitest invocation

The project has a **single `package.json`** at the repo root. There is no `vite.config.*` or `vitest.config.*` anywhere (confirmed by `find`). Vitest uses its default `**/*.test.ts` discovery, scoped by the path argument:

```
"test:game":       "vitest run game"
"test:game:watch": "vitest game"
```

The `game` argument is a **substring path filter**, not a config root. Every file whose path contains `game` is collected. All 20 test files match because they live under `game/src/**/*.test.ts`. This is confirmed by running `vitest run game/src/systems/scrap` — it picks up exactly the two scrap test files in `systems/` and nothing else.

### 1.2 Test file inventory

20 test files, 186 passing tests (verified against `vitest run game`):

| Current path | Tests | Feature theme |
|---|---|---|
| `core/world.test.ts` | 3 | ECS engine |
| `components/bench.test.ts` | 10 | Workshop (bench is workshop-only) |
| `components/inventory.test.ts` | 7 | Economy / player inventory |
| `content/engines.test.ts` | 3 | Engine feature |
| `content/loot-table.test.ts` | 8 | Scrap feature |
| `content/parts-catalog.test.ts` | 9 | Common/parts |
| `content/recipes.test.ts` | 5 | Workshop |
| `render/articulation.test.ts` | 9 | Mounting (Reclaimer joint driver) |
| `systems/assembly.test.ts` | 21 | Workshop |
| `systems/collision.test.ts` | 7 | Common/sim |
| `systems/drive.test.ts` | 6 | Drive |
| `systems/engine.test.ts` | 6 | Engine |
| `systems/mounting.test.ts` | 32 | Mounting |
| `systems/movement.test.ts` | 7 | Drive |
| `systems/scrap-collection.test.ts` | 10 | Scrap |
| `systems/scrap-pile.test.ts` | 14 | Scrap |
| `systems/shop.test.ts` | 10 | Workshop / Economy |
| `systems/staging.test.ts` | 6 | Workshop |
| `systems/workshop-drain.test.ts` | 9 | Workshop |
| `systems/workshop-zone.test.ts` | 4 | Workshop |

### 1.3 The flat-folder doubling problem is real

The proposal claims that test files "double the apparent file count" in flat folders. The numbers confirm it:

| Folder | Source files | Test files | Total | Test % |
|---|---|---|---|---|
| `systems/` | 13 | 12 | 25 | **48%** |
| `components/` | 26 | 2 | 28 | 7% |
| `content/` | 11 | 4 | 15 | 27% |
| `core/` | 4 | 1 | 5 | 20% |
| `render/` | 11 | 1 | 12 | 8% |
| `ui/` | 5 | 0 | 5 | 0% |

`systems/` is nearly half tests by file count — and the full 25-file listing mixes domains (assembly, collision, drive, engine, mounting, movement, scrap×2, shop, staging, weight, workshop-drain, workshop-zone) with no grouping signal. The noise is not imaginary.

---

## 2. Shared test fixtures: none exist

A search for cross-file test helper exports returns zero results:

```
grep -r "export" game/src --include="*.test.ts"   # → no output
```

Every test file is fully self-contained. Helper functions (`rig()`, `setup()`, `makeArm()`, etc.) are defined locally and not exported. There are **no shared test fixtures** to relocate under Option B.

This is the best possible starting point for a restructure: no test infrastructure to move, no fixture ownership question to settle before migrating.

---

## 3. Cross-folder import audit

107 cross-folder `import` lines exist across the 20 test files. The destination folder breakdown:

| Import destination (today) | Count | Option B location |
|---|---|---|
| `../components/…` | 73 | `../../common/components/…` |
| `../core/…` | 23 | `../../core/…` (unchanged tier) |
| `../content/…` | 11 | Splits: `../../common/parts/…` or `../../features/engine/…` |

**Key finding:** No test file imports cross-folder from `systems/`, `render/`, `ui/`, or `input/`. Every cross-folder import in a test targets either `core/`, `components/`, or `content/` — exactly the tiers that map cleanly to `core/` and `common/` under Option B. This means the import structure of the tests *already reflects the three-tier dependency graph* the proposal is making explicit.

### 3.1 Cross-feature test imports under Option B

Two tests would have cross-feature imports after migration, both legal downhill dependencies:

- `features/workshop/assembly.test.ts` imports `engineParts` from `features/engine/engines.ts`. Workshop depends on engine — permitted by the DAG.
- `features/workshop/staging.test.ts` imports `partAtCell` from `features/mounting/mounting.ts`. Workshop depends on mounting — also permitted.

Neither import is surprising; both reflect real gameplay dependencies (the workshop stages mounted products, the assembly test needs a real engine to compose). No test would need to import uphill or sideways in a way that violates the proposed DAG.

---

## 4. Migration cost for test files

| Category | Count | Nature |
|---|---|---|
| Cross-folder import lines to rewrite | 107 | Mechanical: `../components/` → `../../common/components/`, etc. |
| Shared test fixtures to relocate | 0 | None exist |
| Test files to rename | 0 | Only their folder changes |
| Vitest scripts to update | 0 | `vitest run game` still matches all tests |

The 107 import rewrites are mechanical and uniform: almost all are pattern-replacements of the form `../components/X` → `../../common/components/X`. A single `find + sed` pass or IDE rename refactor handles the bulk of it. The content-folder split (some content stays in `common/parts/`, some moves to feature folders) requires per-file judgement but is a small fraction (11 lines across 7 test files).

**The absence of path aliases is the dominant mechanical risk** for the overall migration (confirmed fact #1 in the brief). For test files specifically it is manageable because tests only import from the top two tiers (core + components/content) — they never import from sibling-folder systems or render code. The worst case is `assembly.test.ts` (14 cross-folder import lines, all to components/content/core).

---

## 5. What changes for the build→test loop

### 5.1 Run command: no change needed

`vitest run game` continues to collect every `game/src/**/*.test.ts` file after migration. No config file, no script changes.

### 5.2 Feature-granular subset runs: a new capability

Today, running all scrap-related tests requires two commands:

```
vitest run game/src/systems/scrap          # 24 tests (scrap-pile + scrap-collection)
vitest run game/src/content/loot           # 8 tests (loot-table)
```

Under Option B:

```
vitest run game/src/features/scrap         # all 32 scrap tests in one command
```

This is not just convenient — it changes the **mental model for the build→test loop**. Today "run the scrap tests" is ambiguous and incomplete by default (most people would only run the `systems/scrap` path and miss the `content/loot-table` tests). Under Option B it is unambiguous and complete by default.

The same improvement applies to every feature: `vitest run game/src/features/workshop` catches all 6 workshop test files (assembly, staging, shop, workshop-zone, workshop-drain, plus recipes) in one invocation.

### 5.3 Watch mode: no change

`vitest game` (watch) works the same way — it watches all files matching `game` in their path. No intervention needed.

---

## 6. Test discoverability under Option B

### 6.1 "Where are the tests for this mechanic?"

Today, understanding what is tested for the scrap mechanic requires scanning five folders. Under Option B:

```
ls game/src/features/scrap/
# collectible.ts  digging.ts  loot-drop.ts  loot-table.ts  loot-table.test.ts
# scrap-pile.ts  scrap-pile.test.ts  scrap-collection.ts  scrap-collection.test.ts
# cleared-ground.ts  scrap-stains.ts  loot-overlay.ts
```

One `ls` shows source and tests together. This is the structural promise of Option B: the test for a piece of logic lives next to the logic, inside the folder named after the mechanic it tests.

### 6.2 "Is this code tested?"

In the current flat structure, the presence of a `.test.ts` sibling in `systems/` does not tell you whether the matching component or content file has coverage — those live in different folders. Under Option B, the co-located test is visible next to the source it covers, regardless of whether that source is a component, system, or content object.

### 6.3 What Option B does NOT change

- Tests for `common/` modules will live in `common/`, not in `features/`. This is correct: a test for `collision.ts` (a generic spatial primitive) lives in `common/sim/`, not in any feature that happens to use it.
- The 32 tests in `systems/mounting.test.ts` remain co-located with mounting logic. The test file is large today because the mounting system is the ADR-001 single owner of grid-snap geometry; Option B keeps it whole in `features/mounting/`.

---

## 7. Projected test distribution under Option B

| Option B location | Test files | Tests |
|---|---|---|
| `core/` | 1 | 3 |
| `common/components/` | 1–2 (bench, inventory) | 17 |
| `common/parts/` | 2 (parts-catalog, recipes) | 14 |
| `common/sim/` | 1 (collision) | 7 |
| `features/drive/` | 2 (drive, movement) | 13 |
| `features/engine/` | 2 (engine, engines) | 9 |
| `features/mounting/` | 2 (mounting, articulation) | 41 |
| `features/scrap/` | 3 (scrap-pile, scrap-collection, loot-table) | 32 |
| `features/workshop/` | 6 (assembly, staging, shop, workshop-zone, workshop-drain + one more) | ~56 |
| `features/economy/` | 0 | 0 |
| `features/hud/` | 0 | 0 |
| **Total** | **20** | **186** |

The distribution shifts from "25 files in one flat folder" to "2–6 files per feature folder." `features/workshop/` is the largest (workshop is genuinely the hub feature) but still navigable — and every file there is obviously workshop logic.

**Note on bench/inventory placement:** `bench.test.ts` and `inventory.test.ts` currently live in `components/`. Their natural Option B home is determined by their fan-in: `bench` is used only by workshop (assembly + workshop-overlay); `inventory` is used by workshop and economy (shop, staging). If both become `common/components/`, their test files follow. If `bench` moves to `features/workshop/`, its test moves with it. Either call is fine for testability — co-location is the rule.

---

## 8. Roadmap fit: new features land cleanly

Pending milestones include combat (Option D — enemies, projectiles, damage), weight aggregation (laden-weight seam), and part identity tiers. Under the current flat structure, combat would add files into `components/` (enemy component), `systems/` (combat system + tests), and `render/` (enemy render). Under Option B it lands in `features/combat/` with its tests co-located — one new folder, no noise in existing folders.

This is directly decision-useful: the test noise problem in `systems/` (25 files, half tests) will only grow under the current structure. Option B caps it.

---

## 9. One open question the board should decide

**Where do `bench.test.ts` and `inventory.test.ts` live?**

`bench` is workshop-only (one consumer). `inventory` is shared by workshop and economy (shop, staging). Under Option B strict rules:

- `bench` → `features/workshop/bench.ts` + `bench.test.ts`
- `inventory` → `features/economy/inventory.ts` + `inventory.test.ts` (or `common/components/` if inventory is genuinely cross-feature)

Either call is testability-neutral — the test stays next to the source wherever the source lands. This is a seam boundary question, not a test question. But naming it here means the pilot migration (scrap) can defer it and the next migration (workshop or economy) resolves it.

---

## 10. Verdict on the (a)/(b)/(c) choice

From a testability and test co-location standpoint, **Option B is unambiguously positive**:

- The flat-folder doubling problem is real and measurable (`systems/` is 48% tests today).
- There are zero shared fixtures to complicate the migration.
- Test import patterns already follow the three-tier DAG — they only import from `core/` and `components/content/`, never from `systems/render/ui` cross-folder. The restructure makes the structure match the reality.
- Vitest mechanics require no changes. The only gain is a new capability: feature-granular subset runs.
- Migration cost for test files specifically is 107 mechanical import rewrites — modest and automatable.
- Future features (combat, restoration) land in clean feature folders with co-located tests from day one.

**Recommendation: (a) — Approve Option B as-is.** There is no testability reason to alter or reject the proposal. The one open question (bench/inventory placement) is a boundary call that can be deferred to the first migration that touches those files.
