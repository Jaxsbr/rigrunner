# Scrap-pile polish — better heaps, pollution, and a restoration scar

**What this is:** a visual + lifecycle upgrade to the rummageable scrap pile so it reads as a
believable junk heap, sits in polluted ground like the camps and loose scrap do, varies pile-to-pile,
and leaves a living scar when reclaimed. No new gameplay axis — the rummage mechanic
([option-c-build-plan.md](option-c-build-plan.md)) is unchanged; this is the heap *earning its place
in the world* visually.

> **Status:** ✅ Built (one PR). Grilled + locked 2026-06-08. Hardcoded for the single pile variant set;
> per-biome / per-tier pile looks are a later concern, not designed here.

Lives in the scrap slice ([`features/scrap/`](../../game/src/features/scrap/)); the shared decal
machinery it leans on now lives in [`@common/render`](../../game/src/common/render/). Sibling polish:
[scrap-stain-decals-spec.md](scrap-stain-decals-spec.md) (loose-piece seepage) and the camps' Phase 3
mess ([looter-camps-spec.md](looter-camps-spec.md)).

---

## Why

The pile was the weakest-reading object in the field: a stack of a few **large flat slabs** that
looked like furniture, all **identical** pile-to-pile, sitting on **clean ground** while the loose
scrap around it and the looter camps both stained the earth — and **vanishing instantly** when emptied,
with none of the "the world reacts" beat the camps got. Four asks, one pass.

## The four asks

1. **Small discoloured bits, not big flat blocks.** Rebuild the heap from many small tumbled chunks
   in a balanced multi-tone weathered mix, so it reads as *accumulated rubble*, not stacked tabletops.
2. **Polluted ground**, the same contamination language the loose scrap and the camps already carry —
   the heap is a blight on the land while it stands.
3. **A restoration scar on reclaim** — when a pile is fully rummaged it leaves behind the same
   stump-with-branch-and-leaves a cleared camp leaves, so a cleared pile and a cleared camp speak one
   visual language of "the land can return."
4. **Variation** — piles shouldn't all look the same.

## Design decisions (from the 2026-06-08 grill)

### 1 — Silhouette: many small multi-tone chunks
- The heap is rebuilt from **~25–40 small tumbled chunks** (weighted toward `0.3–0.9 m` shards, bars,
  crushed cubes) plus a few half-buried wheels for story, keeping the **~5 m × 3 m footprint, ~3 m
  height**. No wide flat base slabs — a couple of mid-size pieces anchor the mass, the rest is rubble.
- **"Discoloured" = a balanced multi-tone weathered mix** — no single tone dominates: roughly even
  `scrap_grey` / `rust` / `dark_metal` with occasional `bone_white` (sun-bleached/oxidised bits). No
  new material was needed; the existing palette carries it.

### 2 — Variations: one seeded generator → 3 GLBs
- A single **seeded** generator (`tools/blender/assets/scrap_pile.py`) emits **three distinct
  silhouettes** — `scrap-pile-a/b/c.glb` — via thin wrapper modules. The variants differ in chunk
  layout *and* tone bias (one rustier, one greyer/darker, one balanced), so they read as different
  heaps, not the same mesh re-spun. `spawnScrapPile` picks one at random.
- Chosen over per-instance runtime tinting (too samey — shared silhouette) and over three
  hand-authored generators (triplicated authoring). One generator, three files.

### 3 — Pollution: camp-style oil + rust, scaled to the pile
- A new **pile-stains** decal layer in the camp's contamination idiom: a **mix of oil pools + rust
  discolouration** (the camp's **scorch layer is dropped** — nothing here is burned), heaviest under
  the heap and **bleeding out to ~8–10 m** (less than the camp's ~14 m — a junk pile is messy, not a
  scorched war-camp).
- **Lifecycle:** the stain **holds while the pile stands** and **fades out once the pile entity is
  gone**, co-timed with the reclaim dissolve — the loose-scrap stains' "notice it vanished" pattern,
  not a sim signal.
- **Rule of Three honoured:** the camps' blob-drawer + decal-cluster machinery was the duplicated
  copy the camps slice flagged for promotion "once a third consumer earns it." This pile layer **is**
  that third consumer, so the machinery was **promoted to
  [`@common/render/ground-stains.ts`](../../game/src/common/render/ground-stains.ts)** and `camp-stains`
  refactored onto it; pile-stains consumes the same engine with its own mix + palette. (The simpler
  single-blob loose-scrap `scrap-stains` is left as-is — a candidate future consolidation, not this PR.)

### 4 — Reclaim scar: reuse the camp sprout, short dissolve, shared restoration seam
- **Asset:** the stump **reuses the existing `camp-sprout.glb`** (stump + branch + green leaves) — a
  cleared site reads the same whether it was a camp or a pile, which is the point.
- **Lifecycle:** the pile **no longer destroys instantly** on empty. It runs a **short ~2.5 s
  dissolve** — the heap **sinks + shrinks** into the ground while the sprout **rises** out of it —
  mirroring the camp teardown. The dissolve is **sim-clocked, view-posed** and the animator runs
  **even while the loot popup freezes the sim**, so the heap holds full behind the popup and the
  dissolve plays the moment the loot is collected.
- **Shared restoration seam:** the stump publishes **`RestorableSite{kind:'scrap'}`** — the same
  marker a cleared camp emits — so future world-restoration (M4) treats cleared piles and cleared camps
  through **one seam**. To let scrap publish it without importing camps, `RestorableSite` was
  **promoted to [`@common/components`](../../game/src/common/components/)** (its second feature consumer
  — Rule of Three). The pile's old bare `ClearedGround` marker is **retired** (nothing read it; the
  richer marker supersedes it).

## How it's built (where the code lives)

| Piece | Location |
|---|---|
| 3 pile meshes | `tools/blender/assets/scrap_pile.py` (seeded) + `scrap_pile_a/b/c.py` wrappers → `scrap-pile-{a,b,c}.glb` |
| Random variant on spawn | `features/scrap/scrap.ts` (`spawnScrapPile`) |
| Shared decal engine | `@common/render/ground-stains.ts` (promoted; `camp-stains` refactored onto it) |
| Pile pollution layer | `features/scrap/scrap-pile-stains.ts` (own mix/palette, fades when the pile is gone) |
| Reclaim dissolve | `features/scrap/dissolving.ts` (clock), `scrap-pile-system.ts` (`pileClearSystem`), `scrap-pile-clear-animator.ts` (sink heap / rise stump) |
| Restoration marker | `@common/components/restorable-site.ts` (promoted from camps) |
| Per-frame dispatch | `main.ts` (pile-stains sync + clear animator run always; `pileClearSystem` in the sim block) |

## Seams left open (deliberately)

- **Nothing consumes `RestorableSite` yet** — both camps and piles now emit it; the M4 world-restoration
  work is its first consumer (unchanged from the camps spec).
- **Pile looks are one set** — the 3 variants are biome-agnostic. Per-biome / per-tier pile dressing is
  a future concern (mirrors the camps' "Phase 4 designs per-level looks" note), not designed here.
- **Loose-scrap `scrap-stains` stays separate** — a fourth consumer (or a cleanup pass) could fold its
  single-blob drawer onto `@common/render/ground-stains` too.
