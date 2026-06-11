# `features/shop/` — the world-shop slice

Buying and selling parts, as **world destinations you drive to** — the in-world replacement for the old
workshop Shop tab ([ADR-003](../../../../docs/architecture/adr-003-feature-first-src-structure.md);
[`docs/specs/world-shops-spec.md`](../../../../docs/specs/world-shops-spec.md)). Open this folder and
you see the whole mechanic: the transaction seam, the world entity + its proximity gate, the standalone
shop UI, and the shopfront's render.

What's here:

- **Transactions (the seam):** `shop.ts` (`buyPart`/`sellPart`/`purchaseVerdict`/`resaleValue`) +
  `part-shop.ts` (the `PartShopItem` stock line + `tieredCost`/`shopItemForPart`) + `part-costs.ts` (the
  single price-tuning table). These moved out of `features/workshop/` — the shop no longer lives inside
  the build surface. They mutate only Wallet + Inventory (`@features/economy`), and know nothing about
  recipes or world placement.
- **The world entity:** `world-shop.ts` (the `WorldShop` component — `{ tier, stock, radius, active }`,
  the stock-list seam tiers/partial-stock/set-completion ride on), `world-shop-spawn.ts`
  (`spawnWorldShop` builder + `allStockedPartIds`), `shop-zone-system.ts` (the circle-vs-circle proximity
  gate, mirroring `workshopZoneSystem`).
- **The UI:** `shop-overlay.ts` (the standalone `ShopOverlay` — buy/sell scoped to one shop's stock,
  with the self-describing `part-descriptions.ts` blurbs). It is NOT part of the workshop overlay.
- **Render** (dispatched from `app/bootstrap.ts`, never from `@common/render`): `overlays.ts` (the shop's
  proximity-disc entries) and `shop-vent-animator.ts` (the roof whirlybird spin off the `joint_vent` node).

Single-owner / placement rules at the point of edit:

- **Commerce lives ONLY here.** The workshop builds/assembles/stages/banks — it never buys or sells.
  Don't re-add a shop tab to `features/workshop/`; a part you can't afford is bought at a world shop.
- **Tier is intrinsic to a shop**, not a UI selector — a rusty shop sells rusty. There is no in-UI tier
  toggle that reprices the list (that was obs #10's gripe).
- **Cross-feature edges point downhill:** shop depends on `economy` (Wallet/Inventory) and `common/parts`
  (the catalog + tiers) — never the reverse. `@common`/`@core` never import shop; per-frame shop render is
  dispatched from the `app/` composition root.
