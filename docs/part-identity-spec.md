# RIGRUNNER — Part Identity: Tiers, Specials & Engine Vocabulary (spec + plan)

**What this is:** the detailed design + phased implementation plan for the part-identity rework that
came out of the 2026-06-03 brainstorm (sparked by `observations.md` #10 "the workshop is dense /
text-heavy" and `ideas.md` 2026-06-03 "Part naming & lore: rarity-as-material tiers"). It supersedes
that raw `ideas.md` entry as the structured version.

> **Status:** Phase 0 (vocabulary + naming strip) is **decided** — Jaco committed to the engine
> vocabulary and the flavour-name strip in this session. Phases 1–4 (tiers, set bonus, specials,
> more tiers) are **planned but earn-their-place gated** — we build them in order, feeling each before
> the next, true to "build by discovery." Numbers here are starting strawmen, tuned against feel.

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
| **Special** | ordinary · special ("gold") | any part, rare | a **gold sheen/glow** + a proportional buff |

At-a-glance label: **"Iron Boiler"** + steam cast + (if special) a gold sheen. Full inspect:
**"Iron Boiler — Steam engine, Tier 2 · Special (+50%)."** Short where you scan, full where you commit.

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

### 2d. Specials are rare **parts ("the gold version"), not recipes**
We drop the "find a special recipe" framing. Instead you **find a rare buffed variant of an ordinary
part** — a gold/antique part with a proportional buff (e.g. +50%). It drops from the loot table (the
epic tier Option C already stubbed). Properties that make it *truly* persist:
- **Proportional buff** (a multiplier), so the next tier never outgrows it — it rides on top of tier.
- **Orthogonal to tier** — a special can appear at any tier (special rusty *or* special elementium).
- **Carried forward by the existing bench loop**: `dismantle()` already returns parts to inventory, so
  "pull the special out of the rusty build and reslot it into the iron build" is just dismantle →
  reslot → reassemble. *No new upgrade machinery needed.*

---

## 3. The visual-cue system (carries what text shouldn't)

One shared cue system, defined once (like `rr_style` / `shared/palette.json`), read by chips,
portraits, and world models:
- **Tier → material finish.** A palette entry per tier (rust-brown → iron-grey → …). Tints even
  grey-box GLBs, so quality reads by *looking*. This is the asset-pipeline's reason-to-exist palette
  (`ideas.md` 2026-06-03).
- **Type → colour cast / badge.** Electric = cool/clean cast; steam = warm brass/copper. A small badge
  on the chip. (Largely redundant once the nouns diverge — a nice belt-and-braces.)
- **Special → gold sheen/glow** overlaid on the tier finish, so you read *special* and *tier* together.

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

### 4e. Specials via the loot table
- Repurpose the dormant **`recipe` epic tier** in `content/loot-table.ts` (Jaco dropped recipe-finding)
  into a **`special-part`** epic tier: draws a catalog id from the sub-part pool and grants it as an
  instance with `special: true` (optionally at a raised tier). This **activates the epic loot slot
  Option C already built** — no new drop system.
- The grant path stamps `{ id, tier, special }` onto the `EnginePart` instance.

---

## 5. Phased implementation plan (small PRs, each playable)

Ordered so the **firm, cheap wins land first** and the bigger systems are gated behind feeling the
prior one. Each phase is one-or-two PRs via `implement-feature` (branch → PR, never `main`).

### Phase 0 — Vocabulary divergence + naming strip · *decided, no new mechanics*
Pure rename/restructure; ships the readability win immediately.
- Split the engine recipe into electric/steam with disjoint slot vocabularies (§4d).
- Strip all flavour names to slot nouns; shorten storage/reclaimer names (§2b).
- Add the **type badge/cast** to the inventory chip + portrait (first slice of §3).
- Update ids, costs, asset map, seeding, and tests.
- **Done when:** build a complete electric (Casing/Core/Coupling/Regulator) and a complete steam
  (Boiler/Piston/Driveshaft/Throttle) engine on the bench; the cross-recipe part won't slot; names read
  clean and untruncated; both drive with type-correct feel (unchanged from today).

### Phase 1 — Tier as a data axis (rusty → iron only) · *smallest cut*
- `TIERS` table (2 rows), instance `tier` field, resolve-through-multiplier in `sumPartStats` (§4a/b).
- `capacity` on `PartAttributes`; storage capacity derives from tier (§4c) — the felt "iron container
  holds more / reclaim footprint" payoff.
- Composed `"{Tier} {Slot}"` display + **tier finish tint** on chips/portraits/world model (§3).
- Source of iron parts for now: **the shop sells them** (tier-priced) so it's testable; production
  chain deferred.
- **Done when:** build a rusty container and an iron container, feel the capacity jump; confirm a
  *rusty-shell + iron-rim* container is a valid, mid-value in-between (per-part additive proven).

### Phase 2 — Matched-set bonus + steep-curve tuning
- Uniform-tier detection → set-bonus multiplier in `buildProduct` (§4b).
- Tune the tier `mult` curve so it's genuinely steep.
- **Done when:** a full same-tier set visibly beats a mixed one *and* the steepness check holds (one
  high-tier part outweighs a low-tier partner — verify with a 3rd tier stubbed in data).

### Phase 3 — Special "gold" parts
- Instance `special` flag + `SPECIAL_MULT`; gold visual cue (§3).
- Activate the loot table's epic tier as `special-part` (§4e).
- **Done when:** rummage a pile, find a gold sub-part, slot it, feel the proportional buff; dismantle a
  built product and reslot the special into a higher-tier rebuild (the carry-forward loop), confirming
  the special's advantage survives the tier jump.

### Phase 4 — More tiers + production-chain hook · *future / separate milestone*
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
- **Special model** — boolean flag (any-part can be special) vs named special variants with bespoke
  buffs. Start with the boolean + a flat `SPECIAL_MULT`; richen if it earns it.
- **Higher-tier source** — shop (Phase 1, testable) vs the production chain (Phase 4). Tier-aware
  pricing: a `tier.mult`-scaled `buyCost` in `part-costs.ts`, or a cost field on `TIERS`.
- **Tier × special interaction on the same part** — confirmed orthogonal (multipliers compose); watch
  that a special + top-tier part isn't so dominant it flattens the curve.

---

## 7. Where this connects

- Resolves `ideas.md` 2026-06-03 (part naming & rarity tiers) and the recipe-rarity thread
  (2026-06-01) — recipes-as-loot is **replaced** by gold-parts-as-loot.
- Pays down `observations.md` #10 (workshop density) and #9 (recipe selector) — fewer, clearer recipes
  + shape/colour carrying identity.
- Feeds `world-progression-guidance.md` §2 (tech progression, advanced alloys), §5 (electric/steam
  identity), and Option C's loot table (`milestones.md`) — the epic tier finally drops something.
