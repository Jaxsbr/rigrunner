# RIGRUNNER — World shops (spec skeleton)

**What this is:** the plan for moving the **shop out of the workshop overlay and into the world** — buying
parts becomes a matter of *driving to distributed, tier-themed shops*, not a free buy/sell tab at home. It
splits the shop UI from the workshop UI, and turns "what the shop offers" into a **progression lever** (find
shops → complete part-sets → venture further for the next ones).

> **Status:** ✏️ **Skeleton — candidate, not started.** Captured from the **2026-06-11** session in
> [`../ideas.md`](../ideas.md) (read that for the voice/why). The **structural call** is firm — the shop is its
> own phase, sequenced **before** Phase 1 of
> [`real-world-and-progression-spec.md`](real-world-and-progression-spec.md), and its first job is to split the
> shop UI out of the workshop. The **world-shop mechanics** below (tiers, unique stock, set-completion) are
> **candidate direction, deliberately movable**, not yet promoted to `CLAUDE.md`.

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

- **A shop is a place out in the world**, not a home tab. You **drive to it** to buy.
- **Shops mimic part tiers** (rusty, iron, …). A tier-shop sells that tier's parts — leaning directly on the
  tier model already being built in **MP** (`part-identity-spec.md`: rusty → iron → …).
- **Partial, unique stock.** A rusty shop is **not guaranteed to carry every** rusty part — there may be
  **multiple shops** to visit to find the different parts you need.
- **Unique shops.** Some shops unlock a **higher-tier single part** you can't get elsewhere.
- **Set-completion gates progression.** You may have to **visit all the relevant shops to complete a set of
  parts**, which lets you **progress to the next phase / region** and **venture further** to find more shops.
  This is the concrete form of the **"shop-unlock as a progression lever"** idea (the *outpost* thread,
  [`../ideas.md`](../ideas.md) 2026-06-11): finding shops *is* how you unlock new parts, and new parts drive
  progression.

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
  Parts Shop needs work" and the buying/building weld.
- **One reusable surface, scoped per shop.** Each world shop opens the *same* shop UI, scoped to **that shop's
  stock** (its tier + which parts it happens to carry). The seam: the shop UI takes a **stock list** so every
  shop — and any future home/special shop — reuses it without bespoke UI.

## Phases / slices

`pending` / candidate / movable.

### First slice — UI split + first world shop, together · `pending`
**Decided (2026-06-11):** the minimum first cut ships **both** at once, so the new mechanic is playable
immediately rather than a UI refactor with nothing behind it.
- **Split** the shop into its own UI surface (out of the workshop overlay).
- **Place the first (rusty) world shop** a short drive into the safe bowl — a structure you drive to that opens
  the shop UI scoped to its stock. This *is* the cold-open's first-purchase point.
- **The stock-list seam** (per-shop stock) so tiers, unique shops, and set-completion ride on it later.

### Following slices — the world-shop mechanic proper · `pending`
- More shops across the world, themed by **tier**; **partial/unique stock**; **unique higher-tier parts**.
- **Set-completion → phase/region unlock** (the progression lever); reconcile with the progression spec's
  region gate (restoration). Possibly: a cleared **camp/outpost** can *host* a shop (tie to Phase 1's outpost).

## Deliverables (first slice)

- **Shop UI as its own surface**, decoupled from the workshop overlay.
- **A world "shop" entity/structure** the rig drives to, which opens the shop UI scoped to its stock.
- **The first rusty shop placed in the safe bowl** — the cold-open's first-purchase point (hands off to Phase 1).
- **The per-shop stock-list seam** so tier/unique/set-completion mechanics attach without reworking the UI.

## Open questions (resolve at build time)

- **Stock definition** — explicit per-shop list vs a tier + rarity roll; how unique / higher-tier parts are marked.
- **Set-completion tracking** — how "complete a set → unlock the next phase/region" is represented, and how it
  **reconciles with the progression spec's restoration region-gate** (two gates, or one feeding the other?).
- **Selling** — where you sell back parts / dump scrap now that the workshop isn't a shop (home? shops? both?).
- **Shop ↔ outpost ↔ cleared-camp relationship** — are they one family (a cleared camp hosts a shop), or distinct?
- **Shop visual identity** — the asset/structure a world shop reads as.

## Where this connects

- [`real-world-and-progression-spec.md`](real-world-and-progression-spec.md) — **precedes Phase 1**; the
  cold-open buys at the first bowl shop, and the workshop's role narrows to build/assemble/bank.
- [`part-identity-spec.md`](part-identity-spec.md) (**MP**) — shops are themed by the **tiers** it defines.
- [`../observations.md`](../observations.md) #10 — the UI split pays down the workshop-bulk finding.
- [`../world-progression-guidance.md`](../world-progression-guidance.md) §2/§4 — the technology-progression
  spine and the progression gate; "find shops to unlock parts" is one lever feeding it.
