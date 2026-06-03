# Option C — Reclaimer & Scrap-Pile Rummage: build plan

The PR-by-PR path to deliver **Option C** (`milestones.md` → "Scrap Piles: the Reclaimer rummage").
Each PR is sized to **stand on its own** and land independently; together they complete the option.

> ⚠️ Same status as `milestones.md` — **candidate & movable**. Scope/order can shift as we build by
> discovery. This plan exists so we can see the whole staircase while shipping one step at a time.

**Status legend:** `done` · `active` · `pending`.

---

## Why this order

The Reclaimer is three "firsts" (`milestones.md`): first **articulated** asset, first **attached**
asset, first **composed non-engine** part. The pipeline/runtime firsts are de-risked **before** the
gameplay leans on them — so the rummage feature lands on a proven articulation seam instead of
inventing it inline. Assets → game-runtime → real part → interaction → loot.

---

## PR1 — Articulated arm + bucket assets + viewer animation · `done`

**Delivered (this PR).** The two GLBs and the articulation pipeline, provable in isolation.

- `reclaimer-arm.glb` — articulated: root `reclaimer-arm` → `joint_yaw` → `joint_boom` →
  `joint_wrist` → `socket_wrist` (named nodes, pivots on their axes).
- `reclaimer-bucket.glb` — the unearthing-bucket head, origin at its attach pivot.
- Pipeline: `rr_style` articulation helpers (`empty` / `set_origin` / `parent_keep`), an
  `ARTICULATED` export path in `build_asset.py`, and the convention in `asset-style.md`.
- Viewer: loads the arm onto a pedestal, parents the bucket on `socket_wrist`, and offers the arm's
  two **poses** as a toggle — **Dig** (looping yaw sweep + boom dip + wrist curl) and **Stow** (static
  diagonal-up, not-in-operation); `#<assetId>` deep-links.

**Seam left for the game:** the node-name contract (`joint_*` to rotate, `socket_*` to attach) and a
reference driver (`viewer/src/articulation.ts`) the game re-implements against the same names.

---

## PR2 — Game-side articulation runtime · `done`

**Goal:** the game can render an articulated GLB and drive it — the viewer's contract, in `game/`.

- Render layer: load an articulated asset, expose its `joint_*` nodes, and parent a `socket_*` head
  GLB at runtime (mirrors `articulation.ts`, but in the game's render/ECS seam — no cross-app reach).
- A small joint driver (idle/dig poses) the game owns.
- **Proof it ships:** the Reclaimer renders in-game (idle pose) on a mount or staging deck.

**Depends on:** PR1. **Deliberately not here:** mounting-as-a-part, the pile, loot.

---

## PR3 — The Reclaimer as a real part: assemble · mount · acquire · `done`

**Goal:** the Reclaimer becomes a buildable, mountable, purchasable part.

- **Assemble** the Reclaimer from **arm + slottable bucket** on MW's existing bench — the first
  **non-engine socket grammar** (a head-socket alongside the engine's four-slot grammar). Delivered
  as `RECLAIMER_RECIPE` (`arm` + `head` slots) + a new `reclaimer` part category/kind; assembly is
  recipe-generic, so it reused the existing bench/inspect/dismantle path unchanged.
- **Mount** the assembled Reclaimer on the chassis, **directional** (facing matters) — it gets the
  same `MountFacing {specific, outward}` an engine does, so the arm points off the rig. The product
  renders the articulated `reclaimer-arm` GLB and the render layer parents the bucket on its wrist.
- **Acquire** both parts via **Option B's Parts Shop** (two new entries in the part-cost list),
  priced under the **bootstrapping constraint**: affordable from **loose scrap alone** (M1), since
  piles are gated behind owning it — a save-up goal, above storage cost.

**Resolved — the Reclaimer cost numbers:** `reclaimer-arm` **24** + `reclaimer-bucket` **12** = **36**
scrap. That sits well above a storage container (5) and ≈ a whole engine (electric 30 / mechanical
36), so it reads as the priciest single save-up goal, yet is reachable from the loose-scrap field
alone (no pile needed to earn it). The Reclaimer also adds **weight 8** (arm 5 + bucket 3) — as heavy
as a mechanical engine — so mounting it is a felt tradeoff. All tunable in `content/part-costs.ts` /
`content/parts-catalog.ts`. **Depended on:** PR2 + MW bench/mount.

---

## PR4 — Scrap pile: capability-gated hold-to-work rummage · `done`

**Goal:** the felt rummage beat — gated, tactile, depleting.

**Delivered (this PR).**

- A **pile entity** (`spawnScrapPile`) — a rough **5×3×3** rusted heap with wheels (a new
  `scrap-pile` GLB; the small drive-over pickup got its own dedicated `loose-scrap` GLB, retiring the
  old "loose scrap borrows the pile" placeholder). A `ScrapPile` component carries the gate + depth.
- A **capability + facing gate** (`scrapPileSystem`): a pile lights up its proximity disc (same lit
  green as the workshop) **only** when the rig parks in reach AND carries a **mounted Reclaimer** AND
  its arm is **aimed at the pile within a 120° FOV**. No Reclaimer / wrong way round → the disc stays
  dim (visibly locked).
- **Hold-to-work** (`scrapRummageSystem`, **E** held): the Reclaimer is marked `Digging` and the arm
  **deploys from its stowed pose** to the dig cycle (`ReclaimerRig.drive` smooth-blends stow↔dig) and
  **retracts** when you release / drive off; the heap **depletes in waves** and the render layer
  **shrinks** it (pillar 4).
- **Scrap burst:** each wave scatters `loose-scrap` around the rig, **drive-over-collected reusing
  M1**, **gated on storage space**. An emptied pile is destroyed (the cleared ground) — its burst was
  the yield (the loot table is PR5).

**Depended on:** PR2 (drive the dig), PR3 (own the gate), M1 (scatter-collect). **Not here:** the loot
table / loot UI (PR5).

---

## PR4.5 — Proximity "E" interaction hint · `done`

**Standalone UX polish landed between PR4 and PR5.** When a gated interaction's proximity disc lights
up, a small speech bubble fades in above the object telling the player which key acts — and fades out
when they leave the circle:

- **Workshop** → "Press E" (a tap opens the interface). E in the zone now opens the workshop, the
  keyboard equivalent of clicking the tab, so the hint is truthful.
- **Scrap pile** → "Hold E" (press-and-hold rummages, from PR4).

The bubble is a camera-facing sprite in the render layer (`InteractionHints`) that READS the same
`active` flag the disc does (sim-owned) and eases its own opacity — view polish, no new sim truth.

---

## PR5 — Loot: table · UI · grant · the "cleared" seam · `pending`

**Goal:** the hidden reward and the future-restoration hook.

- A **data-driven loot table** rolled when a pile is **emptied**: scrap (100%, the burst) +
  sub-parts (common) + full parts (rare) + unique recipes (epic — *future* slot, recipe system not built).
- A **loot UI** shows the non-scrap finds; on close they're **granted to `Inventory`**.
- The pile emits a **"ground-cleared" signal** on empty — the seam **restoration**
  (camp-to-restored-ground) subscribes to later; **nothing restoration-aware is built here.**

**Resolves:** **loot-roll shape** (per-tier vs weighted) and **inventory-full handling** open
sub-questions. **Reuses:** the loot-table seam Option D + rare-recipe scavenging later share.

**Depends on:** PR4 (a pile to empty), the parts/inventory system (shipped).

---

## After PR5 — Option C is complete

The remaining Option C "deliberately NOT in scope" items stay future work, each a natural next option:
the **tiller/restoration head** (a new head on the same `socket_wrist`), the **recipe-rarity** system
(fills the epic slot), **Option D** enemy drops (reuse the loot table), and **region-gating** (reuse
the capability-gate). All are seams this option leaves open, not wiring it builds.
