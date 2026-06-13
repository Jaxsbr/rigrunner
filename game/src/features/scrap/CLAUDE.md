# `features/scrap/` — the scrap-harvest slice

The whole scrap mechanic lives here (the feature-first pilot — [ADR-003](../../../../docs/architecture/adr-003-feature-first-src-structure.md)):
loose scrap, rummageable piles, the Reclaimer-gated hold-to-work dig, collection into storage, the
loot roll, and the scrap-specific render (stains, pile slump, Reclaimer arm). Open this folder and
you see the mechanic end to end.

What's here:

- **Components:** `collectible` (loose scrap), `scrap-pile`, `dissolving` (the reclaim-dissolve clock a fully-rummaged pile runs — its
  heap sinks while a stump rises; scrap's sibling of the camp's `Camp.tornDown`). On reclaim the pile
  emits a `RestorableSite{kind:'scrap'}` stump — the SAME marker a cleared camp leaves — which lives in
  `@common/components` (the shared restoration seam).
- **Systems:** `scrap-collection`, `scrap-pile-system` (the rummage/slump sim + `pileClearSystem`, the
  dissolve clock — suffixed `-system` to sit beside the like-named `scrap-pile` component), `scrap` (the
  spawner/scatter; picks one of three `scrap-pile-*` variant GLBs at random), `loot-table`.
  (Collision is no longer here — see below.)
- **Render** (dispatched from `main.ts`, never from `@common/render`): `scrap-stains` (loose-piece
  seepage), `scrap-pile-stains` (the heap's oil+rust pollution, on the shared `@common/render/ground-stains`
  engine), `scrap-pile-animator` (the dig-slump), `scrap-pile-clear-animator` (the reclaim dissolve: sink
  the heap, rise the stump — the camp-teardown sibling), `reclaimer-animator`, and the `overlays` adapter
  (its pile disc/hint entries). `loot-overlay` is the loot-popup UI. See `docs/specs/scrap-pile-polish-spec.md`.
- **Pickup feedback:** `floating-text` is a generic camera-facing "battle text" sprite layer (pop a
  label — text + an optional `FloatingIcon` chip — at a world point, it rises + fades); `scrap-pops` is the
  scrap policy over it — a "+N" with a scrap chip where each piece is swept up, a debounced "NO SPACE"
  above the rig when a full hold drives over scrap it can't take. The chip is the seam for future
  collectible kinds (each ships its own `FloatingIcon`). `scrapCollectionSystem` returns a
  `CollectionResult` (collected spots+values, refused spots+ids) that feeds it.

Single-owner / placement rules at the point of edit:

- **Collision now lives in `@common/sim/collision`** — it was promoted out of scrap when camps became
  its second consumer (projectile/enemy/ram hits), exactly as its header always said it should be. Both
  scrap (drive-over collection) and camps call the one shared pair finder; don't re-add a copy here.
- **The Reclaimer animator lives in scrap** (`reclaimer-animator.ts`) because rummaging began here; it
  reads the shared `@common/components/reclaimer-working` `ReclaimerWorking` marker (promoted out of scrap
  once restoration's stump-heal became its second consumer — both deploy the same arm). Keep the animator
  here, not in mounting (which would cycle).
- **`floating-text` is generic but stays in scrap** until a second consumer earns its promotion — the
  day combat wants damage numbers it moves to `@common/render` (a move, not a rewrite), with `scrap-pops`
  left behind as the scrap-specific policy. Don't pre-promote it (ADR-003 Rule of Three).
- Cross-feature: scrap depends downhill on `storage` (`mounted-storages`) and `economy` (loot grant)
  — never the reverse. `@common`/`@core` never import scrap.
