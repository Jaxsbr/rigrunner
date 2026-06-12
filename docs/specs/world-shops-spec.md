# RIGRUNNER — World shops (spec skeleton)

**What this is:** the plan for moving the **shop out of the workshop overlay and into the world** — buying
parts becomes a matter of *driving to distributed, tier-themed shops*, not a free buy/sell tab at home. It
splits the shop UI from the workshop UI. *(A forward-looking "find shops → unlock parts" progression lever is
captured as candidate direction; the once-central partial/unique-stock + set-completion framing is **parked** —
see the 2026-06-12 decision below.)*

> **Status:** 🟡 **First slice SHIPPED** (`features/shop/`, PR #71); the rest is candidate. Captured from the
> **2026-06-11** session in [`../ideas.md`](../ideas.md) (read that for the voice/why). The **structural call**
> is firm and done — the shop is its own phase, sequenced **before** Phase 1 of
> [`real-world-and-progression-spec.md`](real-world-and-progression-spec.md); the UI split + the first bowl shop
> are built.
>
> **DECISION (2026-06-12): there is NO per-shop "stock".** The partial/unique-stock + stock-list-seam idea below
> was *not* what was wanted and was **not built** (it would have been speculative complexity — "complexity earns
> its place"). The shipped model: **a shop sells the FULL priced catalogue at its one intrinsic tier, always in
> stock**; **selling works for any loose part at any shop, always at a loss** (the shop is a greedy buyer that
> takes parts it doesn't sell). The remaining **forward-looking mechanics** (tier-themed shops, set-completion as
> a progression lever) stay **captured, movable, not committed** — and partial/unique stock is **parked**, not on
> the path. See [`../observations.md`](../observations.md) #19.

---

## Why this exists (the problem it solves)

Today the shop is a **tab inside the workshop overlay** (`features/workshop/part-shop.ts` + `shop.ts`): as long
as the rig is parked at home, you can buy and sell freely. Two problems:

- **It's too easy.** Buying has no cost of place — everything is available the moment you're home. There's no
  journey, no scarcity, no reason to explore for parts.
- **It adds to the workshop's bulk.** The workshop overlay is already dense and text-heavy
  ([`../observations.md`](../observations.md) #10): the Parts Shop "needs work," its tier selector *silently
  reprices/regrades* the whole list, and buying is hard to scan. Buying and building are **welded together**
  in one overloaded surface — structurally, the shop code even lives *inside* `features/workshop/`.

Pulling the shop out fixes both at once: a cleaner workshop, and a shop that becomes a *place you go* rather
than a tab you toggle.

## The concept — shops are world destinations

- **A shop is a place out in the world**, not a home tab. You **drive to it** to buy. *(Built.)*
- **A shop sells the full catalogue at its tier, always in stock.** Buying is "any part the shop sells, always
  available" — no scarcity, no per-shop subset. *(Built.)*
- **Selling is universal and lossy.** Any loose part sells at any shop, always at a loss (the shop is greedy and
  takes even parts it doesn't sell). *(Built.)*
- **Shops mimic part tiers** (rusty, iron, …). A tier-shop sells that tier's parts — leaning on the tier model
  in **MP** (`part-identity-spec.md`: rusty → iron → …). *(Captured, movable — today there is one rusty shop.)*

**Parked (decided 2026-06-12 — NOT being built):** *partial/unique stock* (a rusty shop carrying only **some**
rusty parts; **unique** higher-tier single parts), and *set-completion* gating progression on visiting all the
relevant shops. These were the original "stock-list seam" framing; they're a captured idea, not the path. If
partial stock is ever genuinely wanted, it reattaches as an optional `WorldShop.stock?` subset the buy list
filters on — added then, with a real second case, not speculatively now.

## Bootstrapping the cold-open (relationship to Phase 1)

This phase **precedes Phase 1** (the designed cold-open) precisely because the cold-open must be *designed
around* where you buy your first parts.

- **Nothing is bought/sold at the workshop.** The **first (rusty) shop sits a short drive away *inside* the
  safe bowl** — so even the first purchase (the Reclaimer) is a tiny journey, fully honouring "home buy/sell is
  too easy." Higher-tier shops live **out in the danger** beyond the bowl.
- The cold-open beat becomes: spawn → sweep loose scrap → **drive to the first bowl shop** → buy the Reclaimer
  → work a pile → … The workshop stays the place you **build, assemble, and bank**, not buy.

## The UI split (decouple the shop surface)

- **Move the shop into its own UI surface**, separate from the workshop overlay — paying down obs #10's "the
  Parts Shop needs work" and the buying/building weld. *(Built — `features/shop/shop-overlay.ts`.)*
- **One reusable surface, scoped per shop by TIER.** Each world shop opens the *same* shop UI, reading the
  in-range shop's intrinsic **tier** and offering the full catalogue at that grade (`shopStockForTier`). One UI
  drives every shop with a different tier — no bespoke UI, and (per the 2026-06-12 decision) no per-shop stock
  list to scope it.

## Phases / slices

`pending` / candidate / movable.

### First slice — UI split + first world shop, together · ✅ `shipped` (PR #71)
**Decided (2026-06-11):** the minimum first cut ships **both** at once, so the new mechanic is playable
immediately rather than a UI refactor with nothing behind it.
- ✅ **Split** the shop into its own UI surface (out of the workshop overlay).
- ✅ **Place the first (rusty) world shop** a short drive into the safe bowl — a structure you drive to that
  opens the shop UI (the full rusty catalogue). This *is* the cold-open's first-purchase point.
- ✅ **Buy/sell model wired:** buy the full catalogue at the shop's tier; sell any loose part at a loss.
  *(The originally-planned "per-shop stock-list seam" was dropped — see the 2026-06-12 decision above.)*

### Following slices — the world-shop mechanic proper · `pending` *(candidate, movable)*
- More shops across the world, themed by **tier** (each tier gets its own building GLB). The progression idea
  ("find shops → unlock parts") stays captured.
- **Parked:** partial/unique stock, unique higher-tier parts, and **set-completion → phase/region unlock**.
  *(If revived: reconcile set-completion with the progression spec's restoration region gate; a cleared
  camp/outpost possibly hosting a shop.)*

## Deliverables (first slice) — ✅ all shipped (PR #71)

- ✅ **Shop UI as its own surface**, decoupled from the workshop overlay.
- ✅ **A world "shop" entity/structure** the rig drives to, which opens the shop UI (full catalogue at its tier).
- ✅ **The first rusty shop placed in the safe bowl** — the cold-open's first-purchase point (hands off to Phase 1).
- ✅ **The buy/sell model** (buy full catalogue at tier; sell any part anywhere at a loss). *(Replaces the
  originally-planned per-shop stock-list seam, which was decided against — see above.)*

## Open questions (resolve at build time)

- ✅ **Stock definition — RESOLVED (2026-06-12):** no per-shop stock; a shop sells the full catalogue at its tier.
  Partial/unique stock parked.
- ✅ **Selling — RESOLVED:** you sell **any loose part at any shop, always at a loss** (`resaleValue ≈ price/2`).
  The workshop banks/builds; it never buys or sells.
- **Tier-themed shops** — when the second tier's shop lands, `spawnWorldShop` gains a `tier → assetId` lookup
  (and `shop` likely renames to `shop-rusty`) — added with the real second case, not speculatively.
- *(Parked with the partial-stock idea)* **Set-completion tracking** — how "complete a set → unlock the next
  phase/region" would reconcile with the progression spec's restoration region-gate.
- **Shop ↔ outpost ↔ cleared-camp relationship** — are they one family (a cleared camp hosts a shop), or distinct?
- **Shop visual identity** — ✅ the first shop reads as a busy, lived-in trade post (building + goods yard +
  worked ground); per-tier building GLBs follow.

## Where this connects

- [`real-world-and-progression-spec.md`](real-world-and-progression-spec.md) — **precedes Phase 1**; the
  cold-open buys at the first bowl shop, and the workshop's role narrows to build/assemble/bank.
- [`part-identity-spec.md`](part-identity-spec.md) (**MP**) — shops are themed by the **tiers** it defines.
- [`../observations.md`](../observations.md) #10 — the UI split pays down the workshop-bulk finding.
- [`../world-progression-guidance.md`](../world-progression-guidance.md) §2/§4 — the technology-progression
  spine and the progression gate; "find shops to unlock parts" is one lever feeding it.
