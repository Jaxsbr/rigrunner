# Proposal — Feature-first source structure for `game/src/` (ARCHIVED)

> **Status: ARCHIVED — historical.** This proposal was critiqued by a review board (2026-06-04) and
> graduated, *with alterations*, into [**ADR-003**](../../adr-003-feature-first-src-structure.md) — the
> current decision. It is kept here as the historical subject of that review; the verdict ((b) ALTER),
> the alteration payload, and the full evidence sit alongside it (start with
> [`board-conclusion.md`](board-conclusion.md)). **Do not treat this file as current direction —
> ADR-003 is.**
> **Original status (at review time):** Proposal / not committed; Jaco leaning Option B.
> **Date:** 2026-06-04 · **Author:** brainstorm session (Jaco + agent)

---

## 1. Why restructure

`game/src/` is sliced by **architectural role** at the top level — `components/`, `systems/`,
`content/`, `render/`, `ui/`, `input/`, `core/` — and each role is a **flat list**. At ~74
non-test files this is starting to hurt in three concrete ways:

1. **You can't see the game's areas by looking at folders.** One mechanic (scrap, workshop,
   mounting…) is smeared across five role-folders. To understand "scrap" you open
   `components/`, `systems/`, `content/`, `render/`, and `ui/` and pick the right files out of
   each flat pile.
2. **Cohesion decays, and agents accelerate it.** A flat folder gives no signal about where new
   code belongs, so the cheapest move — for a human *or* an agent — is to add one more file to
   the pile. This is the entropy we've been feeling: not a *findability* problem (grep finds a
   known symbol fine) but a *"where does this go / what already exists here"* problem, which is
   exactly what directory structure is supposed to answer.
3. **Test files double the apparent file count** in each flat folder, adding traversal noise.
   (Note: the fix is **not** a separate `tests/` tree — co-location is correct. The noise comes
   from the flat namespace, and it dissolves once source is grouped: a `scrap/` folder of ~8
   source + tests reads fine where a 28-file flat `components/` does not.)

The decision we want to lock is the **organizing axis**, so every future edit lands in the right
place — even before a full migration happens.

## 2. Current structure & dependency graph (evidence)

Top level today (`game/src/`): `components/` (28 files incl. tests), `systems/` (22), `render/`
(12), `content/` (15), `core/` (5), `ui/` (5), `input/` (2), `build/` (1), `main.ts`.

The architecture itself is clean — a real ECS: `World` is component-major storage, components are
pure data + a typed key, systems are free functions over the world, and render/ui are strict
projections that own no truth. The problem is purely **how files are grouped**, not how they're
written.

**Internal-import fan-in** (how many files import each module — the evidence for what is shared):

```
 33 world      19 transform     8 mount-grid    5 weight       3 velocity
 32 types      12 parts-catalog  8 mount         5 wallet       3 drivetrain
 27 component  12 part           8 assembly      5 storage      3 collectible
                                  7 renderable    4 recipes      ... (rest fan-in 1–3,
 (geometry 3)  (workshop-zone 8) 7 collider       4 engine-part   single-consumer)
```

Two signals fall out:

- **There are three tiers, not two.** `core/` hides a split: a **pure engine** (`world`, `types`,
  `component`, `geometry` — zero game knowledge) sits under a **domain kernel** — the vocabulary
  *most features speak*: `transform`, `part`, `parts-catalog`, `mount`/`mount-grid`, `assembly`,
  `renderable`/`collider`, `weight`. Everything else is feature-local (fan-in 1–3, one consumer).
- **Features form a clean DAG — no cycles.** Every cross-feature edge points downhill toward the
  kernel or a lower feature, which is what makes a feature-first split safe here:

```
        ┌──────────────── core (ECS engine) ───────────────┐
        │   world · types · component · geometry            │
        └────────────────────────▲──────────────────────────┘
                                  │ (everything)
        ┌──────────────── common (domain kernel) ───────────┐
        │  transform renderable collider part mount          │
        │  mount-grid mount-facing assembly weight           │
        │  parts-catalog · collision · weight-system         │
        │  render infra (stage camera picker view ...) input │
        └──▲────────▲────────▲────────▲────────▲──────────────┘
           │        │        │        │        │
        drive    engine   mounting  scrap   economy
           │        ▲        ▲        │        ▲
   drive→engine     │        │   scrap→{mounting,storage}
                    └─ workshop → {mounting, engine, storage, economy}
                       (assembles · stages · sells · drains — the hub)
```

## 3. Proposed graph & structure (Option B)

Three top-level tiers + `features/`. `core/` keeps its name (no churn); the kernel is named
`common/` to avoid clashing with the repo-root `shared/`. Tests sit beside their source inside
each slice.

```
game/src/
├── main.ts                      # composition root — the only cross-feature importer
│
├── core/                        # ECS engine — no game knowledge
│   └── world.ts  types.ts  component.ts  geometry.ts  (+ tests)
│
├── common/                      # domain kernel — the strict "shared" tier
│   ├── components/  transform renderable collider part mount mount-grid
│   │                mount-facing assembly weight
│   ├── parts/       parts-catalog.ts            # the part-definition registry (the spine)
│   ├── sim/         collision.ts  weight.ts     # generic sim primitives
│   ├── render/      stage orbit-camera picker entity-views view articulation
│   └── input/       drive-input  camera-input
│
└── features/                    # vertical slices — open one, see the whole mechanic
    ├── drive/       drive-control drivetrain velocity · movement drive (+tests)
    ├── engine/      engine-part engine-spec · engine (+test) · engines (+test)
    ├── mounting/    mounting staging (+tests) · build-controller · build-affordances · rig
    ├── scrap/       collectible scrap-pile digging loot-drop cleared-ground
    │                scrap-collection scrap-pile (+tests) · scrap loot-table (+tests)
    │                scrap-stains · loot-overlay
    ├── storage/     storage · containers
    ├── workshop/    workshop-zone workshop-drain bench · workshop-zone workshop-drain
    │                assembly shop staging (+tests) · recipes part-shop part-costs
    │                product-visual workshop · zone-overlays · workshop-overlay deck-view
    ├── economy/     wallet inventory (+test) · wallet-hud
    └── hud/         stats-hud                   # cross-feature readout (engine + drive)
```

**Why B over A or C.** Option A (a feature subfolder *inside* each role) still smears one mechanic
across five role-folders — it doesn't deliver "see the game in the folders." Option C (group only
the simulation by feature) is good, but B is stricter about *what counts as shared*, which is the
property Jaco wants: only genuinely cross-feature code earns a place in `common/`; everything else
lives with its mechanic.

**The one real refactor B forces:** `render/animators.ts` is a grab-bag dispatching wheel-spin
(drive), storage-fill (storage), reclaimer (mounting), and pile-slump (scrap). Under B each
animation moves into its feature's render and `common/render/view.ts` calls them. Every other file
is a move, not a rewrite.

**Suggested pilot:** migrate `scrap/` first — the graph shows it's the most self-contained slice.

## 4. Ambiguity / open boundary calls

The graph is unambiguous except at four seams. These are judgement calls to settle **before**
moving anything, not blockers:

1. **`engine-part` leaks.** Engine data, but `shop`, `assembly`, and `workshop-overlay` import it
   to list buyable engine parts. *Lean:* keep in `engine/`; a UI enumerating a feature's parts is
   acceptable. Alternative: promote next to `parts-catalog` in `common/parts/`.
2. **`staging` is shared by two features.** Imports mounting *and* workshop-zone (it stages an
   assembled product onto the workshop deck). *Lean:* put in `workshop/` (the consumer); it
   depends downhill on mounting. Defensible in `mounting/` too.
3. **`collision` & `weight` in `common/sim`.** `collision` is generic but today only scrap uses
   it; `weight` is *the* central tradeoff axis. *Lean:* promote both as kernel primitives.
   Stricter alternative: start `collision` in `scrap/` and promote when a second consumer appears.
4. **`render/animators.ts` must split** (see §3). The only structural rewrite; everything else is
   a file move.

`rig.ts` (chassis spawner, touches drive + mounting) and `hud/stats-hud.ts` (reads engine + drive)
are legitimately cross-cutting; parked at the seams (mounting and a thin `hud/`).
