# `features/scrap/` — the scrap-harvest slice

The whole scrap mechanic lives here (the feature-first pilot — [ADR-003](../../../../docs/architecture/adr-003-feature-first-src-structure.md)):
loose scrap, rummageable piles, the Reclaimer-gated hold-to-work dig, collection into storage, the
loot roll, and the scrap-specific render (stains, pile slump, Reclaimer arm). Open this folder and
you see the mechanic end to end.

What's here:

- **Components:** `collectible` (loose scrap), `scrap-pile`, `digging` (the rummage marker the
  Reclaimer animator reads), `loot-drop`, `cleared-ground`.
- **Systems:** `collision` (see below), `scrap-collection`, `scrap-pile-system` (the rummage/slump
  sim — suffixed `-system` to sit beside the like-named `scrap-pile` component), `scrap` (the spawner
  /scatter), `loot-table`.
- **Render** (dispatched from `main.ts`, never from `@common/render`): `scrap-stains`,
  `scrap-pile-animator`, `reclaimer-animator`, and the `overlays` adapter (its pile disc/hint
  entries). `loot-overlay` is the loot-popup UI.

Single-owner / placement rules at the point of edit:

- **`collision.ts` is a PROMOTION CANDIDATE, not scrap-owned forever.** It is generic by construction
  (no scrap semantics) but lives here because scrap is its only consumer today. The day a **second**
  feature needs it — combat (projectile/enemy hits) is the expected one — **promote it to
  `@common/sim/collision`**, don't add a second copy. The header comment in `collision.ts` says the
  same; honour it.
- **The Reclaimer animator lives in scrap** (`reclaimer-animator.ts`) because it reads scrap's
  `Digging` marker; keep that edge pointing at scrap, not at mounting (which would cycle).
- Cross-feature: scrap depends downhill on `storage` (`mounted-storages`) and `economy` (loot grant)
  — never the reverse. `@common`/`@core` never import scrap.
