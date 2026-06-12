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
  (`spawnWorldShop` builder + `allStockedPartIds`; it also scatters the shop's yard), `shop-zone-system.ts`
  (the circle-vs-circle proximity gate, mirroring `workshopZoneSystem`), `shop-yard.ts` (`spawnShopYard` —
  the goods-yard layout algorithm: deterministic, entrance-relative scatter of `yard-*` props around a shop).
- **The UI:** `shop-overlay.ts` (the standalone `ShopOverlay` — buy/sell scoped to one shop's stock,
  with the self-describing `part-descriptions.ts` blurbs). It is NOT part of the workshop overlay.
- **Render** (dispatched from `app/bootstrap.ts`, never from `@common/render`): `overlays.ts` (the shop's
  proximity-disc entries), `shop-vent-animator.ts` (the roof whirlybird spin off the `joint_vent` node),
  `shop-ground.ts` (the worn, trampled, cracked ground decal — a procedural CanvasTexture plane, laid under
  the grime), and `shop-stains.ts` (the worked-ground oil/rust/grime over it, on the shared
  `@common/render/ground-stains` engine). (The yard PROPS are ordinary decoration entities `shop-yard.ts`
  spawns — `view.sync` draws them like any model.)

Single-owner / placement rules at the point of edit:

- **Commerce lives ONLY here.** The workshop builds/assembles/stages/banks — it never buys or sells.
  Don't re-add a shop tab to `features/workshop/`; a part you can't afford is bought at a world shop.
- **Tier is intrinsic to a shop**, not a UI selector — a rusty shop sells rusty. There is no in-UI tier
  toggle that reprices the list (that was obs #10's gripe).
- **Cross-feature edges point downhill:** shop depends on `economy` (Wallet/Inventory) and `common/parts`
  (the catalog + tiers) — never the reverse. `@common`/`@core` never import shop; per-frame shop render is
  dispatched from the `app/` composition root.

## Visual design — a shop is a *point of interest*: a busy, lived-in trade post

A world shop is one of the FEW points of interest in a barren landscape, so it has to earn the drive:
styled, busy, unmistakably tended. It is built in three layers — keep them separate.

- **The building** (`tools/blender/assets/shop.py` → `shop` GLB): just the lit container shopfront — the
  open, roofed-at-the-back bay so the elevated camera sees the counter; the hazard doorway frame; and a
  **warm lamp** panel + beacon (`glow_warm`, a dim amber — NOT the neon `glow_green`, which read as too
  futuristic; `glow_green` stays for energy/tier fill). No yard dressing is baked in here.
- **The goods yard** (`shop-yard.ts` + the `yard-*` props): the building is never a bare box in the void.
  `spawnShopYard` scatters small props — supply **crates**, fuel **drums**, half-unpacked **parts** heaps,
  a loaded delivery **pallet**, and one potted **plant** — across the **eight tiles around the shop's one
  tile**, 360°, dense enough to read as a working yard (deliveries unpacked, shipments batched) you tiptoe
  through to reach the counter. Why separate props + a layout algorithm, not one baked asset: the yard
  varies per shop (a position-seeded RNG → no two identical) and the kit can grow without re-authoring the
  building. Placement is in the shop's frame (entrance-relative), so the cell in front of the counter stays
  lighter and the yard sits right at any facing. The props are plain decoration entities (no collider — you
  drive through them).
- **The worked ground** — two stacked decals so the EARTH reads as used, not pristine desert the props were
  dropped onto. First `shop-ground.ts` lays a worn pad (a procedural CanvasTexture plane oriented to the
  shop): compacted/trampled dirt, dried-mud cracks, drag-scuffs, a beaten path and a few salvaged pavers
  clustered AT THE ENTRANCE where the rig walks up. Over it, `shop-stains.ts` adds the heavy oil/rust/grime
  field — a place that hauls goods all day is genuinely dirty. Both are unlit, depth-write-off decals (they
  discolour the floor + its shadows), drawn under the props; both seed off shop position (stable per shop,
  varied shop to shop). Heavy, but still short of a camp's scorched blight: a worked yard, not a ruin.

The **plant** is the deliberate sign of life — the one green thing — but its foliage is `leaf_green` (the
muted sage that matches the restored-tree leaves), NOT the saturated `nature_green` that pops as neon under
the warm sun. It's set forward and misaligned from the building, not flush to a wall, so it reads as
placed-by-someone, not built-in. Green + order amid barren ground is itself the navigation cue.

**Tier-distinct assets (forward-looking).** A shop's grade should be legible at a glance: rusty looks
scrappy; iron reads posh, clean machined metal; future grades go grand and futuristic. Each tier gets its
OWN building GLB (and, in time, its own yard-prop flavour), not a tint. Today there is one (`shop` = rusty),
so `spawnWorldShop` hard-wires `assetId: 'shop'`. When the second tier's asset is authored, that becomes a
`tier → assetId` lookup (and `shop` likely renames to `shop-rusty`) — add the seam with the real second
case, not a speculative one-entry map now (Rule of Three).
