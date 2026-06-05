# RIGRUNNER — Part Identity: Tiers, Specials & Engine Vocabulary (spec + plan)

**What this is:** the detailed design + phased implementation plan for the part-identity rework that
came out of the 2026-06-03 brainstorm (sparked by `observations.md` #10 "the workshop is dense /
text-heavy" and `ideas.md` 2026-06-03 "Part naming & lore: rarity-as-material tiers"). It supersedes
that raw `ideas.md` entry as the structured version.

> **Status:** Phase 0 (vocabulary + naming strip) and Phase 1 (tiers as a data axis, rusty → iron)
> are **built and merged**. The committed next step is the asset push: first **Phase 1.5 —
> asset-viewer upgrade** (the verification tool — view any sub-part at any tier and assemble arbitrary
> tier combinations to check fit), then **Phase 2 — sub-part asset completeness** (every sub-part the
> game has *today* gets its own 3D model, fully visible/usable in the game and the viewer). Phase 2 is
> where the tier **tint stopgap retires**: from there on every new part — and each tier as it's added —
> ships as a real authored asset in both the game and the viewer, never a tinted placeholder. Phase 2
> is the **gate** for the remaining mechanic phases — we do not add the set bonus, gold, or another
> tier (Phases 3–5) until every current part is modelled and reads as itself. The later phases stay
> **earn-their-place gated**; numbers here are strawmen, tuned to feel.

---

## 1. The core reframe — three orthogonal axes, not one crowded name

A part's identity has **three independent axes**. The confusion in `observations.md` #10 is what
happens when all three get smeared into the display name ("Coilframe Casing", "Motor Coil"). The fix:
**the name is the slot noun; type and tier ride as a short prefix + a visual cue, never crammed into
the noun.**

| Axis | Values | Applies to | Carried as |
|---|---|---|---|
| **Slot** (function) | per-category nouns (below) | every part | the **display noun** itself |
| **Type** | electric · steam | engines only (and future type-locked parts) | the **noun vocabulary** + a badge/colour cast |
| **Tier** (material) | rusty → iron → … (steep ladder) | every part | a **one-word prefix** + a material **finish** |
| **Special** | ordinary · "gold" | rare; the **assembled product** (e.g. a gold engine) | a **gold sheen/glow**; a fixed early-mid grade (≈ tier 2.5) |

At-a-glance label: **"Iron Boiler"** + steam cast. Full inspect: **"Iron Boiler — Steam engine, Tier 2."**
A **gold** special wears its sheen on the *assembled* engine and reads **"Gold Steam Engine — early-mid
grade (≈ Tier 2.5)."** Short where you scan, full where you commit.

---

## 2. Decided this session

### 2a. Engine vocabularies **diverge** — no shared nouns across types
Electric and steam engines are fundamentally different machines, so they get **completely separate
part vocabularies**. There is no "electric casing vs mechanical casing" — the noun itself tells you the
type, so no type prefix is ever needed and the mouthful disappears.

| Function | ⚡ Electric (clean/abstract nouns) | ♨ Steam (industrial nouns) |
|---|---|---|
| housing | **Casing** | **Boiler** |
| converter (type-defining) | **Core** | **Piston** |
| transmit to drive | **Coupling** | **Driveshaft** |
| output control / special-ability | **Regulator** | **Throttle** |

Electric keeps the four words it fits best ("core", "regulator" are electric-native). Steam takes the
iconic industrial set. The contrast *is* the identity. (Steam, not petrol — per the
`world-progression-guidance.md` §5 "both energy types restorative" reframe.)

> **Self-enforcing no-hybrid.** Because the two recipes use disjoint slot vocabularies, a Boiler can't
> physically go in an electric engine's Casing slot — the no-hybrid rule stops being a special check
> and becomes a fact of the parts. `resolveEnergyType` stays as a backstop.

### 2b. Strip the flavour names → slot nouns everywhere
Drop every flavour overlay. Display names become the slot nouns above, plus for the untyped categories:
**Storage** → `Shell`, `Rim`; **Reclaimer** → `Arm`, `Bucket`. (Shorter names also fix the truncation
gripe in #10.) Tier prefix is composed at render time ("Iron Shell"), not stored in `displayName`.

### 2c. Tiers are **per-sub-part and additive**, with a **matched-set bonus**, on a **steep curve**
- **Per-part, additive.** Each sub-part contributes its own tier's value independently — so a
  rusty-shell + iron-rim container is a *valid, valued in-between*, and every single upgrade is felt.
  (This maps directly onto the existing additive `sumPartStats` — see §4.)
- **Matched-set bonus.** When all of a product's parts share one tier, a bonus multiplier is applied on
  top — a reason to chase the complete same-tier set beyond the per-part gains.
- **Steep, not linear.** Tier value climbs sharply, so **one very-high-tier part outweighs several
  low ones** — an *elementium shell + rusty rim* must still beat an *all-iron* container. (The
  modded-Minecraft "each tier is a big jump" fantasy, `ideas.md` 2026-05-30.) The reward is also
  **footprint reclaim**: a higher-tier part does more in the same rig cell, so you need fewer of them.

### 2d. "Gold" is a rare special **grade**, not a recipe — and it lives on the *assembled* product
We drop the "find a special recipe" framing. **Gold is an early-mid-game grade** that slots into the tier
ladder between iron and the (future) third tier:

- **The ladder:** rusty = **tier 1**, iron = **tier 2**, **gold performs ≈ tier 2.5** (beats iron, below
  tier 3), and a future **tier 3 supersedes gold**. Gold is a *temporary edge* — the strong find that
  carries you through early-mid game until the real next tier arrives.
- **Gold is a whole, assembled part** (a gold *engine*, a gold *container*) — not a sub-part. The buff is
  a property of the finished product, so "gold" reads as a complete machine you found running well, not a
  single buffed cog.
- **A gold *sub-part* you loot is sell-fodder, not a build piece.** It sells for the matching iron
  (tier-2) sub-part's **buy** price — i.e. gold's *sell* value is tier-2 even though a gold product
  *performs* at ≈ 2.5. Finding gold pieces is a **money** event; finding a gold product is a **power**
  event. (It drops from the loot table — the epic tier Option C already stubbed; the exact source shape is
  the §6 fork.)

---

## 3. The visual-cue system (carries what text shouldn't)

One shared cue system, defined once (like `rr_style` / `shared/palette.json`), read by chips,
portraits, and world models:
- **Tier → material finish.** A palette entry per tier (rust-brown → iron-grey → …). The tint washes even
  grey-box GLBs so quality reads by *looking* — but it is a **bridge**: its end-state is a real authored
  asset per part (and per tier as tiers are added), verified in the viewer. **Phase 2 reaches that
  end-state and retires the tint as a stand-in** (see §5); from there new assets carry their own finish.
  (`ideas.md` 2026-06-03 / 2026-06-05.)
- **Type → colour cast / badge.** Electric = cool/clean cast; steam = warm brass/copper. A small badge
  on the chip. (Largely redundant once the nouns diverge — a nice belt-and-braces.)
- **Special ("gold") → gold sheen/glow** on the *assembled* product, marking the early-mid grade
  (≈ tier 2.5) at a glance — read as a whole gold machine, not a single buffed sub-part.

---

## 4. Data-model changes (grounded in the current code)

The architecture already leans our way; the changes are small and mostly additive.

### 4a. Tier lives on the part **instance**, not as catalog rows (the anti-explosion guardrail)
**Do not** author `e-core@rusty`, `e-core@iron`, … as separate catalog entries — that 4×'s the catalog
(and later the GLBs) per tier. Instead:
- `PARTS_CATALOG` keeps **one `PartDef` per slot×type**, whose `attributes` are the **base (tier-1)**
  values.
- A new `TIERS` table is the only place tiers are defined — ordered rows of
  `{ id, name, mult, finishColor }` (start with **two**: `rusty` mult 1, `iron` mult ≈ 2.2 — steep).
- The part **instance** vessel (`components/engine-part.ts`, today `{ id }`) gains
  `{ id, tier, special? }`. Tier multiplies the base attributes at resolve time; special applies its
  own multiplier.

### 4b. Resolve stats through tier × special, then add the set bonus
- `systems/assembly.ts → sumPartStats` already **sums** per-part attributes. Change it to read each
  part's **resolved** stats (`base × tier.mult × (special ? SPECIAL_MULT : 1)`) instead of raw
  `def.attributes`. Per-part-additive tiers then work **by construction** — no new summing logic.
- `buildProduct` detects a **uniform tier** across the product's parts and applies the **set-bonus
  multiplier** to the summed stats.
- **Gold is a product-level grade, not a per-part buff** (§2d): its ≈ tier-2.5 resolve attaches to the
  *assembled* product, not to each sub-part's sum. Exactly where the gold multiplier lands (here vs in
  `buildProduct`) is Phase-4 scope — see the §6 fork.

### 4c. Storage capacity must derive from tier (not the `CONTAINER_CAPACITY = 4` constant)
Today `attachCapability` hardcodes `capacity: CONTAINER_CAPACITY`. To make "iron container holds more":
- Add a **`capacity`** field to `PartAttributes` (0 for engine/reclaimer parts; `Shell`/`Rim` carry it).
- `attachCapability`'s `storage` case reads `stats.capacity` (the tier-scaled, set-bonus'd sum) instead
  of the constant. `containers.ts` keeps a base for a directly-spawned (tier-1) container.

### 4d. Engine recipe split (vocabulary divergence)
- `content/recipes.ts`: replace the single `ENGINE_RECIPE` with **`ELECTRIC_ENGINE_RECIPE`**
  (slots `casing/core/coupling/regulator`) and **`STEAM_ENGINE_RECIPE`**
  (slots `boiler/piston/driveshaft/throttle`). Both `productKind: 'engine'`. Add both to `RECIPES`.
- `parts-catalog.ts`: rework `EnginePartSlot` into the two disjoint slot sets; rename the `m-*` parts'
  slots/ids/`displayName` to the steam vocabulary; strip electric flavour names to the nouns. Keep
  `type` on `PartDef` (drives drive-feel, visuals, the backstop type check) — though it's now derivable
  from the slot.
- `content/engines.ts`: `engineParts(type)` → pick the recipe by type
  (`type === 'electric' ? ELECTRIC_ENGINE_RECIPE : STEAM_ENGINE_RECIPE`) and resolve its slots.
- Knock-on id renames: `part-costs.ts` (the `m-*` ids; higher tiers get a cost multiplier — see §6),
  `product-visual.ts` (asset map), `main.ts` (the starting-engine seed), and the affected `*.test.ts`.

### 4e. Gold via the loot table — the source is a flagged fork
- Repurpose the dormant **`recipe` epic tier** in `content/loot-table.ts` (Jaco dropped recipe-finding)
  into a **gold** epic tier — **activating the epic loot slot Option C already built**, no new drop system.
- **What it grants is an open fork (§6):** a whole **gold assembled product** (the power find — performs
  ≈ tier 2.5) versus **gold sub-parts** (the money find — each sells for the matching iron part's buy
  price). The instance stamp still rides on `{ id, tier, special }`; how `special` resolves to a product
  grade vs a sellable piece is settled when Phase 4 is scoped against feel.

---

## 5. Phased implementation plan (small PRs, each playable)

Ordered so the **firm, cheap wins land first** and the bigger systems are gated behind feeling the
prior one. Each phase is one-or-two PRs via `implement-feature` (branch → PR, never `main`).

**The gate (decided 2026-06-05):** Phases 0–1 are built. Before any further *mechanic* — the set
bonus, gold, or more tiers — the **asset push** comes first: **Phase 1.5 (asset-viewer upgrade — the
verification tool)** then **Phase 2 (sub-part asset completeness).** Every sub-part we have *today* gets
its own 3D model and is fully usable/visible in the game and the viewer, and **Phase 2 retires the tint
as a stand-in** — from there every new part/tier ships as a real authored asset. The reasoning: the tier
system's whole promise is "see your build in the parts" (§3), yet most sub-parts still render as tinted
placeholder cubes — stacking *more* tiers or specials on top of placeholder art deepens the hole, while
modelling what we already have is the higher-value next step. So **Phases 3–5 (set bonus, gold, more
tiers) do not start until Phase 2 lands.**

### Phase 0 — Vocabulary divergence + naming strip · ✅ done (merged)
Pure rename/restructure; ships the readability win immediately.
- Split the engine recipe into electric/steam with disjoint slot vocabularies (§4d).
- Strip all flavour names to slot nouns; shorten storage/reclaimer names (§2b).
- Add the **type badge/cast** to the inventory chip + portrait (first slice of §3).
- Update ids, costs, asset map, seeding, and tests.
- **Done when:** build a complete electric (Casing/Core/Coupling/Regulator) and a complete steam
  (Boiler/Piston/Driveshaft/Throttle) engine on the bench; the cross-recipe part won't slot; names read
  clean and untruncated; both drive with type-correct feel (unchanged from today).

### Phase 1 — Tier as a data axis (rusty → iron only) · ✅ done (merged)
- `TIERS` table (2 rows), instance `tier` field, resolve-through-multiplier in `sumPartStats` (§4a/b).
- `capacity` on `PartAttributes`; storage capacity derives from tier (§4c) — the felt "iron container
  holds more / reclaim footprint" payoff.
- Composed `"{Tier} {Slot}"` display + **tier finish tint** on chips/portraits/world model (§3). The
  render seam resolves a tier **per sub-asset** (`assetTier` / `productTints`), so a composed Reclaimer
  already wears its arm and bucket each at its own grade — the hook Phase 2 builds on.
- Source of iron parts for now: **the shop sells them** (tier-priced) so it's testable; production
  chain deferred.
- **Done when:** build a rusty container and an iron container, feel the capacity jump; confirm a
  *rusty-shell + iron-rim* container is a valid, mid-value in-between (per-part additive proven). ✓

### Phase 1.5 — Asset viewer: per-sub-part + tier-combination preview (Phase 2's verification tool) · *pre-req, decided next*

Phase 2 can't be judged without **seeing each sub-part** — but today the viewer only shows whole products
(the Reclaimer's arm + bucket are the lone exception, because that product already renders as two real
sub-assets). Before authoring the Phase 2 roster, the viewer becomes the surface that **verifies every
sub-part, at every grade, in isolation and in assembly.** Two capabilities:

- **View any sub-part at any tier.** Pick a single sub-part (Boiler, Piston, Core, Shell, Frame, …) and a
  tier, and inspect that one model on its own — so each authored piece can be checked before it goes near
  a product.
- **Compose a part from an arbitrary tier combination.** Build an assembled part in the viewer by choosing
  a tier *per sub-part* — e.g. a **rusty Boiler + iron Piston + iron Driveshaft + gold Throttle** steam
  engine — and see the whole thing rendered from its located sub-parts. This is the feedback loop for
  **spacing, symmetry, and cohesion**: where we'll spot that a sub-part needs nudging or a small model
  tweak so the assembled product reads clean.

**Build for many tiers, not three.** The tier list is data (§4a, `TIERS`); the viewer's tier pickers must
be **driven by that list**, gaining rows automatically as tiers are added — no hard-coded rusty/iron/gold.

- **Done when:** in the viewer, any single sub-part can be shown at any tier; and a product can be
  assembled from a freely-chosen tier-per-sub-part mix and viewed as a whole — enough to give
  spacing/symmetry/cohesion feedback on the composed result. (Drives the model tweaks Phase 2 then bakes
  in.)

### Phase 2 — Sub-part asset completeness (the gate) · *foundational, after Phase 1.5*

Every sub-part the game has **today** gets its own 3D model and is fully visible/usable in the game and
the **asset viewer** (the verification surface built in Phase 1.5) — no catalog sub-part still rendering
as a tinted placeholder cube. This is the down-payment the tier system's "read your build in the parts"
promise (§3) is owed: the tints work, but most sub-parts have no model of their own, so the payoff is
only half-delivered. We **finish the roster we already have before widening it** — no new tier, special,
or set bonus until this lands.

**This phase retires the tint as a stand-in.** The per-tier finish was a bridge (§3); once every current
sub-part is modelled, the tint has reached its end-state. **From Phase 2 onward, every new part — and each
new tier as it's added — must ship as a real authored asset, visible in both the game and the viewer.** No
new part is ever "done" as a tinted placeholder again.

**The standing acceptance rule this phase establishes (enforced in the `implement-feature` skill).** From
here on, **adding a player-visible part is not "done" until every tier of it has a real authored model**,
shipped in the **same PR** and **validated in the viewer** — never a placeholder meant to be filled in
later. "Player-visible" means anywhere a part renders: the shop, inventory inspect, the bench. It need not
look right *in-game* yet, but **every tier must read correctly in the viewer** (Phase 1.5's per-part +
tier-combination preview), and a **full check covers all currently-defined `TIERS`**, not just the one
tier you happened to test. An agent can **screenshot the viewer** to confirm each tier matches expectation;
a **Playwright assertion** over that render is the automation this opens (see `ideas.md` 2026-06-05). The
`implement-feature` skill carries this as a checklist item so future part work cannot ship a placeholder
and call it done.

**The sub-part map — what exists, and its asset status.** Six products, eighteen sub-part roles. Only
the Reclaimer's two are modelled; the rest fall back to a tinted placeholder block. Unique GLBs to
author: **8 engine + 2 storage + 3 chassis = 13.**

| Product | Sub-parts (slot · catalog id) | Asset id(s) | Model? |
|---|---|---|---|
| ⚡ Electric engine | Casing `e-casing` · Core `e-core` · Coupling `e-coupling` · Regulator `e-regulator` | one per id | ⬜ ×4 |
| ♨ Steam engine | Boiler `s-boiler` · Piston `s-piston` · Driveshaft `s-driveshaft` · Throttle `s-throttle` | one per id | ⬜ ×4 |
| 📦 Storage container | Shell `container-shell` · Rim `container-rim` | `container-shell` / `container-rim` | ⬜ ×2 |
| 🦾 Reclaimer | Arm `reclaimer-arm` · Bucket `reclaimer-bucket` | `reclaimer-arm` / `reclaimer-bucket` | ✅ ×2 |
| 🛞 Chassis 1×3 | Wheel & Axle `wheel-axle-1x3` · Suspension & Steering `suspension-steering-1x3` · Frame `frame-1x3` | `wheel-axle` / `suspension-steering` / `chassis-frame` | ⬜ ×3 |
| 🛞 Chassis 3×5 | Wheel & Axle `wheel-axle-3x5` · Suspension & Steering `suspension-steering-3x5` · Frame `frame-3x5` | *(shares the 1×3 ids above)* | ⬜ shared |

(Both chassis sizes currently point their sub-parts at the **same three** asset ids — `wheel-axle`,
`suspension-steering`, `chassis-frame` — so that's 3 unique models unless we decide the sizes should
look distinct; see the fork below.)

**Two halves — model coverage first, then composition:**
- **2a — Model every sub-part (the firm gate).** Author a GLB for each of the 13 via the
  `blender-asset` pipeline (on-palette, scaled, oriented), register it in `shared/assets.ts`, and let
  each sub-part show its **own model** in the inventory inspect portrait + bench — selecting "Core" or
  "Shell" shows a Core or a Shell, not a grey box. This half **must** land before Phases 3–5.
- **2b — Compose the sub-parts into the product whole (the vision it unlocks).** With every piece
  modelled, an assembled product can render as its **positioned, scaled sub-parts**, each wearing its
  own tier finish — so a built engine reads as *an open frame holding its located internals*, a built
  container as its shell + rim, and a mixed-tier build is finally legible *as* a mix (beyond the flat
  tint). This is the richer target captured in `ideas.md` (2026-06-05) + `observations.md` #12; the
  per-sub-asset seam (`assetTier` / `productTints`) is already in place. Scope 2b against feel once 2a
  exists — it's an art + per-product-layout job, the bigger lift.

- **Done when (2a, the gate):** every current catalog sub-part shows its own distinct 3D model in the
  workshop (inventory inspect at minimum) **and in the viewer** — **no placeholder cube for any catalog
  sub-part.** (2b, as it lands: an assembled product visibly reads as the sub-parts it's made of, each at
  its own tier.)

**Open forks (flagged, not blocking):**
- **Chassis sizes — shared or distinct models?** The 1×3 and 3×5 sub-parts share three asset ids
  today. Start with **three models, scaled per size** (cheap); diverge to six distinct ones only if
  the sizes should read differently in play.
- **What a composed engine looks like.** The open-frame-with-visible-internals direction (`ideas.md`
  2026-06-05) is the lead; the exact frame geometry, internal placement, and per-slot scale are 2b's
  design work, not decided here.

### Phase 3 — Matched-set bonus + steep-curve tuning
- Uniform-tier detection → set-bonus multiplier in `buildProduct` (§4b).
- Tune the tier `mult` curve so it's genuinely steep.
- **Done when:** a full same-tier set visibly beats a mixed one *and* the steepness check holds (one
  high-tier part outweighs a low-tier partner — verify with a 3rd tier stubbed in data).

### Phase 4 — "Gold" — the early-mid special grade
Gold is a **whole assembled part** (e.g. a gold engine), a rare early-mid find that **performs ≈ tier 2.5**
— above iron, below the future tier 3 that supersedes it (§2d). A gold **sub-part** you loot is instead
**sell-fodder**: it sells for the matching iron (tier-2) sub-part's *buy* price.
- Instance `special` flag + the gold visual cue on the assembled product (§3); resolve gold's stats to the
  ≈ tier-2.5 grade.
- Gold sub-part **sell price = the matching iron part's buy cost** (`part-costs.ts`) — gold's sell value is
  tier-2 even though a gold product performs above it.
- Activate the loot table's epic tier as the **gold** drop (§4e); the power-product-vs-sellable-piece source
  is the open fork in §6.
- **Done when:** a gold *product* is clearly the early-mid power spike (beats iron, gets outclassed once a
  tier-3 is stubbed in); and a looted gold *sub-part* sells for its iron counterpart's buy price — the
  money event reads distinctly from the power event.

### Phase 5 — More tiers + production-chain hook · *future / separate milestone*
- `alloy`, `elementium`, … as **pure data rows** in `TIERS` (no code).
- The smelter/caster that mints higher-tier parts from scrap (the deferred production chain — its own
  milestone; tiers give it its reason).

---

## 6. Open forks (flagged, not blocking)

- **Tier count & names** — start with **rusty → iron**; add `alloy`/`elementium`/… as data when play
  asks. Final names TBD.
- **Steam slot count** — kept at **four parallel slots** (different nouns, same structure) for a clean
  mental model. "Fundamentally different" *could* later mean a different part count for steam — parked.
- **Set-bonus magnitude** — starting strawman; tune so it rewards completion without dwarfing a great
  single part.
- **Gold source — power-product vs sellable-piece** — the epic loot slot (§4e) could drop a whole **gold
  assembled product** (the ≈ tier-2.5 power find), **gold sub-parts** (sell-fodder at the iron buy price),
  or both. Also unsettled: whether a gold product can be **assembled** by the player or only **found**, and
  what dismantling a gold product yields. Settle against feel when Phase 4 is scoped.
- **Gold's grade vs the ladder** — gold sits at ≈ **tier 2.5** and is superseded by a future **tier 3**.
  Tune the exact gap so gold feels like a genuine early-mid spike without dwarfing iron or making tier 3
  feel mandatory.
- **Higher-tier source** — shop (Phase 1, testable) vs the production chain (Phase 5). Tier-aware
  pricing: a `tier.mult`-scaled `buyCost` in `part-costs.ts`, or a cost field on `TIERS`.

---

## 7. Where this connects

- Resolves `ideas.md` 2026-06-03 (part naming & rarity tiers) and the recipe-rarity thread
  (2026-06-01) — recipes-as-loot is **replaced** by gold-parts-as-loot.
- Pays down `observations.md` #10 (workshop density) and #9 (recipe selector) — fewer, clearer recipes
  + shape/colour carrying identity.
- Feeds `world-progression-guidance.md` §2 (tech progression, advanced alloys), §5 (electric/steam
  identity), and Option C's loot table (`milestones.md`) — the epic tier finally drops something.
