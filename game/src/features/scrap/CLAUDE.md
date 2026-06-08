# `features/scrap/` — the scrap-harvest slice

The whole scrap mechanic lives here (the feature-first pilot — [ADR-003](../../../../docs/architecture/adr-003-feature-first-src-structure.md)):
loose scrap, rummageable piles, the Reclaimer-gated hold-to-work dig, collection into storage, the
loot roll, and the scrap-specific render (stains, pile slump, Reclaimer arm). Open this folder and
you see the mechanic end to end.

What's here:

- **Components:** `collectible` (loose scrap), `scrap-pile`, `digging` (the rummage marker the
  Reclaimer animator reads), `dissolving` (the reclaim-dissolve clock a fully-rummaged pile runs — its
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

Single-owner / placement rules at the point of edit:

- **Collision now lives in `@common/sim/collision`** — it was promoted out of scrap when camps became
  its second consumer (projectile/enemy/ram hits), exactly as its header always said it should be. Both
  scrap (drive-over collection) and camps call the one shared pair finder; don't re-add a copy here.
- **The Reclaimer animator lives in scrap** (`reclaimer-animator.ts`) because it reads scrap's
  `Digging` marker; keep that edge pointing at scrap, not at mounting (which would cycle).
- Cross-feature: scrap depends downhill on `storage` (`mounted-storages`) and `economy` (loot grant)
  — never the reverse. `@common`/`@core` never import scrap.
