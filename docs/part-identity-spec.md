# RIGRUNNER — Part Identity: Tiers, Specials & Engine Vocabulary (spec + plan)

**What this is:** the detailed design + phased implementation plan for the part-identity rework that
came out of the 2026-06-03 brainstorm (sparked by `observations.md` #10 "the workshop is dense /
text-heavy" and `ideas.md` 2026-06-03 "Part naming & lore: rarity-as-material tiers"). It supersedes
that raw `ideas.md` entry as the structured version.

> **Status:** Phase 0 (vocabulary + naming strip), Phase 1 (tiers as a data axis, rusty → iron) and
> **Phase 1.5 — asset-viewer upgrade** (the verification tool) are **built and merged**. **Phase 2a —
> sub-part model coverage (the gate)** is now **built**: all 13 missing sub-parts (8 engine + 2 storage
> + 3 chassis) have a real authored GLB, registered in `shared/assets.ts`, and each reads as itself in
> the viewer (every sub-part × every tier passes `check:assets` and renders a real model) and in the
> game's inventory inspect. **The tint stand-in is retired**: from here every new part — and each tier
> as it's added — ships as a real authored asset in both the game and the viewer, never a tinted
> placeholder. **Phase 2b — composition via assembly sockets** is now **built for every product**: a host
> GLB carries `socket_<slot>` empties and one shared assembler (`shared/assembler.ts`, §2b) snaps the
> sub-parts on — each at its own tier — used by the game AND the viewer, so a build reads identically in
> both. Engine + storage compose onto their open-frame hosts; the **chassis** composes too — its per-size
> **Frame** is the host (a flat mounting deck on a ladder with ground clearance), instancing its size's
> **Wheel** + **Suspension** unit at every corner station, so the deployed driving rig is rebuilt from its
> sub-parts (its deck, spinnable wheels and deploy unfold all re-derived from the composed structure) and
> reads as a graded mix. (The 1×3 scout and 3×5 hauler diverged enough in play that they no longer share a
> wheel/suspension — each size has its own, the scout's smaller for a lower stance.) With 2b
> fully landed, the remaining work is the **earn-their-place gated** mechanic phases: set bonus, gold, more
> tiers (Phases 3–5). Numbers here are strawmen, tuned to feel.

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

> **Status (2026-06-06): §4 is built.** The data-model changes below shipped in Phases 0–2; the prose
> still reads as the original plan, but each item is now live in code. Paths also moved with the
> **feature-first** restructure ([ADR-003](architecture/adr-003-feature-first-src-structure.md)):
> `content/*` → `common/parts/*` (registries) or `features/<x>/*` (feature code), `systems/*` →
> `common/sim/*`, `components/*` → `common/components/*` (the part-instance vessel is
> `common/parts/engine-part.ts`). The `content/`/`systems/` paths below are corrected to match.

### 4a. Tier lives on the part **instance**, not as catalog rows (the anti-explosion guardrail)
**Do not** author `e-core@rusty`, `e-core@iron`, … as separate catalog entries — that 4×'s the catalog
(and later the GLBs) per tier. Instead:
- `PARTS_CATALOG` keeps **one `PartDef` per slot×type**, whose `attributes` are the **base (tier-1)**
  values.
- A new `TIERS` table is the only place tiers are defined — ordered rows of
  `{ id, name, mult, finishColor }` (start with **two**: `rusty` mult 1, `iron` mult ≈ 2.2 — steep).
- The part **instance** vessel (`common/parts/engine-part.ts`, today `{ id }`) gains
  `{ id, tier, special? }`. Tier multiplies the base attributes at resolve time; special applies its
  own multiplier. (Built: it carries `{ id, tier }`; gold's `special` is Phase 4.)

### 4b. Resolve stats through tier × special, then add the set bonus
- `common/sim/assembly.ts → sumPartStats` already **sums** per-part attributes. Change it to read each
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
- `common/parts/recipes.ts`: replace the single `ENGINE_RECIPE` with **`ELECTRIC_ENGINE_RECIPE`**
  (slots `casing/core/coupling/regulator`) and **`STEAM_ENGINE_RECIPE`**
  (slots `boiler/piston/driveshaft/throttle`). Both `productKind: 'engine'`. Add both to `RECIPES`.
- `parts-catalog.ts`: rework `EnginePartSlot` into the two disjoint slot sets; rename the `m-*` parts'
  slots/ids/`displayName` to the steam vocabulary; strip electric flavour names to the nouns. Keep
  `type` on `PartDef` (drives drive-feel, visuals, the backstop type check) — though it's now derivable
  from the slot.
- `features/engine/engines.ts`: `engineParts(type)` → pick the recipe by type
  (`type === 'electric' ? ELECTRIC_ENGINE_RECIPE : STEAM_ENGINE_RECIPE`) and resolve its slots.
- Knock-on id renames: `part-costs.ts` (the `m-*` ids; higher tiers get a cost multiplier — see §6),
  `product-visual.ts` (asset map), `main.ts` (the starting-engine seed), and the affected `*.test.ts`.

### 4e. Gold via the loot table — the source is a flagged fork
- Repurpose the dormant **`recipe` epic tier** in `features/scrap/loot-table.ts` (Jaco dropped recipe-finding)
  into a **gold** epic tier — **activating the epic loot slot Option C already built**, no new drop system.
- **What it grants is an open fork (§6):** a whole **gold assembled product** (the power find — performs
  ≈ tier 2.5) versus **gold sub-parts** (the money find — each sells for the matching iron part's buy
  price). The instance stamp still rides on `{ id, tier, special }`; how `special` resolves to a product
  grade vs a sellable piece is settled when Phase 4 is scoped against feel.

### 4f. Chassis handling derives from the tier-scaled chassis stats (built 2026-06-06)
The chassis sub-parts carry handling stats that resolve through tier like any attribute (§4b), then feed
the rig's `Drivetrain` in `chassisToRig` (`features/mounting/rig.ts`) — so a higher-tier chassis isn't
just a visual/capacity upgrade, it **handles** better. This realises §2c's "every single upgrade is felt"
for the running gear:
- **Suspension & Steering → `turning` → turn rate** (a constant floor + a tier-scaled bonus). An iron
  suspension corners sharper, but the floor keeps rusty gear decent and the rusty→iron gap modest.
- **Wheel & Axle → `grip` → off-throttle deceleration** (added to a constant brake floor). Iron wheels
  scrub speed faster when you lift off the throttle, for tighter, more placeable control. *(The chassis
  attribute formerly named `topSpeed` — inert, since engines own top speed now — was renamed `grip` for
  this and is the only field rename.)*
- **Frame → `loadCapacity`** (unchanged) — the rated carry weight the HUD reads.

Per-part additive tiers (§2c) carry straight over: an iron suspension on a rusty frame gives sharp
cornering while staying cheap to haul. Turn rate and braking are each a constant **floor** plus a
tier-scaled **bonus**, so rusty gear handles decently and the tier gap stays modest — 1×3 turn rate
≈ 2.7 rad/s rusty → 4.2 iron (a steep linear scale once made iron corner too hard); friction 14 rusty
→ 21 iron. (A sibling balance rule landed alongside but
lives outside this spec — engine **count** is capped low per chassis, 1 on the 1×3 and 3 on the 3×5, so
engine **tier**, not engine stacking, is the power lever.)

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

### Phase 1.5 — Asset viewer: per-sub-part + tier-combination preview (Phase 2's verification tool) · ✅ built

Phase 2 can't be judged without **seeing each sub-part** — but today the viewer only shows whole products
(the Reclaimer's arm + bucket are the lone exception, because that product already renders as two real
sub-assets). Before authoring the Phase 2 roster, the viewer becomes the surface that **verifies every
sub-part, at every grade, in isolation and in assembly.** Three capabilities — two for the eye, one for
the machine:

- **View any sub-part at any tier.** Pick a single sub-part (Boiler, Piston, Core, Shell, Frame, …) and a
  tier, and inspect that one model on its own — so each authored piece can be checked before it goes near
  a product.
- **Compose a part from an arbitrary tier combination.** Build an assembled part in the viewer by choosing
  a tier *per sub-part* — e.g. a **rusty Boiler + iron Piston + iron Driveshaft + gold Throttle** steam
  engine — and see the whole thing rendered from its located sub-parts. This is the feedback loop for
  **spacing, symmetry, and cohesion**: where we'll spot that a sub-part needs nudging or a small model
  tweak so the assembled product reads clean.
- **Drive it from an agent / Playwright (the automation half).** The viewer is built to be **scripted**,
  not just clicked: an agent addresses an exact part+tier (a query param or a small control hook),
  screenshots it, and asserts the render is the model we expect. Two checks it must support — a
  **coverage** assertion (fail if any currently-defined `TIERS` row has no distinct model for a part:
  this is what mechanically enforces Phase 2's no-placeholder rule) and a **per-part×tier visual** check
  (a baseline render the part is approved against once, so later drift is caught). Settle the visual-diff
  strategy against feel during the build — exact-pixel diffs are flaky across GPU/AA, so a tolerance or a
  cheaper signal (silhouette / dominant palette) may be the pragmatic assertion; a human approves the
  baseline, the machine guards it after.

**Build for many tiers, not three.** The tier list is data (§4a, `TIERS`); the viewer's tier pickers must
be **driven by that list**, gaining rows automatically as tiers are added — no hard-coded rusty/iron/gold.

- **Done when:** in the viewer, any single sub-part can be shown at any tier; a product can be assembled
  from a freely-chosen tier-per-sub-part mix and viewed as a whole (enough to give spacing/symmetry/cohesion
  feedback); **and the viewer is agent/Playwright-drivable to a specific part+tier, with a coverage check
  that fails on a missing-tier model and a per-part×tier visual check against an approved baseline.**
  (Drives the model tweaks Phase 2 then bakes in, and gives Phase 2's no-placeholder rule a mechanical
  gate.)

**Built as.** The part-identity roster (the tier ladder + every sub-part's slot/type/name/asset) is
promoted to `shared/part-identity.ts` so the game and the viewer read one source of truth (the game's
`PARTS_CATALOG` now layers its gameplay `attributes` over these identity records). The viewer's new
**Parts** tab inspects any sub-part at any tier and composes a product from a tier-per-sub-part mix
(tier pickers driven by the `TIERS` data; unmodelled parts show a tinted placeholder flagged "no
model"). The automation half is lightweight (no new deps): every view is URL-addressable
(`#part=…&tier=…`, `#product=…&tiers=…`) and `window.__viewer` exposes the catalog, programmatic
selection, a `settled()` promise, and a `state()` snapshot (per-asset real-model-or-placeholder + tris,
plus a sampled dominant-palette signature). The **coverage gate** is `npm run check:assets` — data-driven,
it fails (exit 1) listing the 13 GLBs Phase 2 must author. The per-part×tier **visual baseline** is
foundationed (the signature is exposed) but not yet captured: baselining 13 identical placeholders is
pointless, so baselines get approved in Phase 2 as each real model lands.

### Phase 2 — Sub-part asset completeness (the gate) · 2a ✅ built · 2b ✅ built (engine + storage + chassis)

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
tier you happened to test. Phase 1.5's **agent/Playwright check** (the coverage assertion + the per-part×tier
visual baseline) gives this rule a **mechanical gate** — an agent screenshots the viewer and the coverage
check fails outright on a missing-tier model. The `implement-feature` skill carries this as a checklist
item so future part work cannot ship a placeholder and call it done.

**The sub-part map.** Six products, eighteen sub-part roles — **all now modelled (2a).** 2a authored the
13 that were missing (8 engine + 2 storage + 3 chassis); the Reclaimer's two predated it.

| Product | Sub-parts (slot · catalog id) | Asset id(s) | Model? |
|---|---|---|---|
| ⚡ Electric engine | Casing `e-casing` · Core `e-core` · Coupling `e-coupling` · Regulator `e-regulator` | one per id | ✅ ×4 |
| ♨ Steam engine | Boiler `s-boiler` · Piston `s-piston` · Driveshaft `s-driveshaft` · Throttle `s-throttle` | one per id | ✅ ×4 |
| 📦 Storage container | Shell `container-shell` · Rim `container-rim` | `container-shell` / `container-rim` | ✅ ×2 |
| 🦾 Reclaimer | Arm `reclaimer-arm` · Bucket `reclaimer-bucket` | `reclaimer-arm` / `reclaimer-bucket` | ✅ ×2 |
| 🛞 Chassis 1×3 | Wheel `wheel-axle-1x3` · Suspension `suspension-steering-1x3` · Frame `frame-1x3` | `wheel-axle-sm` / `suspension-steering-sm` / `frame-1x3` | ✅ ×3 |
| 🛞 Chassis 3×5 | Wheel `wheel-axle-3x5` · Suspension `suspension-steering-3x5` · Frame `frame-3x5` | `wheel-axle` / `suspension-steering` / `frame-3x5` | ✅ ×3 |

(**Every** chassis sub-part is per-size — the 1×3 scout and 3×5 hauler diverged too much to share. The 3×5
keeps the full-size `wheel-axle` / `suspension-steering`; the 1×3 has the smaller `-sm` pair (a lower
scout stance). Each **Frame** is a distinct GLB — a flat mounting deck on a ladder with ground clearance,
carrying its own corner stations — and its size's Wheel + Suspension instance at every station. See the
2b design below.)

**Two halves — model coverage first, then composition:**
- **2a — Model every sub-part (the firm gate).** Author a GLB for each of the 13 via the
  `blender-asset` pipeline (on-palette, scaled, oriented), register it in `shared/assets.ts`, and let
  each sub-part show its **own model** in the inventory inspect portrait + bench — selecting "Core" or
  "Shell" shows a Core or a Shell, not a grey box. This half **must** land before Phases 3–5.
- **2b — Compose the sub-parts into the product whole (the vision it unlocks).** With every piece
  modelled, an assembled product renders as its **positioned, scaled sub-parts**, each wearing its own
  tier finish — a built engine reads as *an open frame holding its located internals*, a built container
  as its shell + rim, a built chassis as its frame with axles + suspension, and a mixed-tier build is
  finally legible *as* a mix (beyond the flat tint). This is the richer target captured in `ideas.md`
  (2026-06-05) + `observations.md` #12. **The mechanism is decided below.**

- **Done when (2a, the gate):** every current catalog sub-part shows its own distinct 3D model in the
  workshop (inventory inspect at minimum) **and in the viewer** — **no placeholder cube for any catalog
  sub-part.** ✓ met.
- **Done when (2b):** in the viewer **and** in-game, each product renders through the shared assembler as
  its positioned, tier-finished sub-parts — engine = open frame holding its internals, storage = shell +
  rim, chassis = per-size Frame deck holding wheels + suspension at every corner — and a mixed-tier build
  reads as a mix. ✓ met for the **engine + storage + chassis** (world, workshop deck + inspect portrait,
  and the viewer; the Reclaimer already composed). See "What shipped (2b)" below.

##### What shipped (2b)

The driving requirement was **viewer↔game parity when composing** — what the viewer shows for a composed
product must be what the game shows. One shared assembler (`shared/assembler.ts`) used by both apps gives
that by construction.

- **Engine + storage compose, both apps.** The Casing/Boiler/Shell hosts gained `socket_<slot>` empties
  (the Casing/Boiler reworked into open frames that hold their internals); the assembler snaps each
  sub-part on at its own tier. Rendered through it: the in-world entity, the workshop deck + inspect
  portrait, and the viewer's Parts tab. `Renderable` gained an `assembly` variant; `productRenderSpec`
  resolves a product to compose-or-single-GLB in one place so every surface agrees.
- **Reclaimer** already composed (bucket on the arm's `socket_wrist`) and keeps its `ReclaimerRig` (it
  also animates) — the same socket convention, a richer driver.
- **Chassis composes, both apps (shipped 2026-06-06).** Its in-game GLB was a *functional rig* — the
  mounting deck + grid (`deckY`, cell lips aligned to `mounting.ts`), spinnable `wheel_*` nodes, the kit↔rig
  swap, and the deploy unfold — so composing it meant rebuilding that working rig from sub-parts. Decided
  as one PR doing exactly that. The **Frame** became the per-size host: `frame-1x3` / `frame-3x5` are
  distinct GLBs, each a flat mounting deck on a ladder with ground clearance, carrying `socket_axle_<i>` +
  `socket_susp_<i>` corner stations (rig-body + sockets are siblings, so the deploy's deck un-squash never
  moves the wheels). The **Wheel** is a hub-origin unit instanced at every corner station, the
  **Suspension** a corner unit instanced inboard of each wheel. Initially these were *shared* across sizes
  (the Frame owning the track), but in play the 1×3 scout and 3×5 hauler diverged too much — so they're now
  **per-size too**: the 3×5 keeps the full-size pair, the 1×3 a smaller `-sm` wheel/suspension for a lower
  scout stance (a lower deckY, 0.70 vs 0.84). The deployed rig composes at the deploy
  seam (`chassisToRig` → a `shape: 'assembly'` Renderable); a *staged* chassis still shows the packed
  `chassis-kit` crate (it only composes once hauled out). Wheel-spin + the deploy unfold were re-derived
  from the composed structure (the wheels are collected from the assembled group; deploy splays the
  corner sockets, spins the instanced wheels, and un-squashes the `rig-body` deck). The old whole-rig
  GLBs (`chassis-1x3` / `chassis-3x5` / `chassis-frame`) are retired. Each sub-part still wears its own
  grade, so a mixed-tier chassis now reads as a mix in the world, not just a flat Frame tint.

#### 2b design — composition via assembly sockets (decided 2026-06-05)

The spatial layout lives **in the art, authored by the generators that already compute it**, snapped
together at runtime by **one shared assembler** — the Reclaimer's `socket_wrist` head-attach
generalized to every product. No layout numbers are duplicated in code; alignment is true *by
construction* because the part that owns the geometry also places the socket.

- **Assembly-socket convention** (added to `docs/asset-style.md`). A **host** part carries `socket_<slot>`
  empties — static attach points where a child part's **origin** is snapped. Repeated stations use a
  `socket_axle_<i>` / `socket_susp_<i>` family. These are *attach* sockets, distinct from the `joint_*`
  motion handles (which rotate); a host may carry both.
- **Host per product** (the open frame the rest seat into):
  - ⚡/♨ **engine** → the **Casing** / **Boiler** is the host, carrying `socket_core|coupling|regulator`
    / `socket_piston|driveshaft|throttle` at the internal positions — the "open frame holding its
    internals" read.
  - 📦 **storage** → the **Shell** is the host, carrying `socket_rim` at the mouth.
  - 🛞 **chassis** → the **Frame** is the host, carrying `socket_axle_<i>` + `socket_susp_<i>` at the
    cell stations the frame generator already lays out.
  - 🦾 **reclaimer** → already composes (Arm host + Bucket on `socket_wrist`).
- **Chassis = one axle + one suspension, instanced per station** (decided). The **"Wheel & Axle Set"**
  and **"Suspension & Steering Set"** stay **one logical sub-part each** (their stats apply once); the
  assembler **instances the model** at every `socket_axle_<i>` / `socket_susp_<i>` the frame exposes. The
  instancing is **purely visual** — it never changes the logical part count or stats. The **frame is
  per-size** (`frame-1x3` / `frame-3x5` distinct GLBs, each with its own station count + positions).
  > **Evolved in play (2026-06-06):** the wheel/suspension started **shared** across sizes ("shared
  > axle/suspension, per-size frames"), but the 1×3 scout and 3×5 hauler diverged too much to share —
  > the scout wanted a smaller wheel (a lower stance) and a scaled-down suspension. So **every** chassis
  > sub-part is now per-size: `wheel-axle` / `suspension-steering` (3×5, full-size) and `wheel-axle-sm` /
  > `suspension-steering-sm` (1×3). The frame is also a flat ladder with ground clearance, and the
  > suspension sits inboard of the wheel (visible running gear), not under it.
- **The shared assembler** (a module in `shared/`, used by the game **and** the viewer). Given a product
  group + a tier-per-sub-part map, it loads the host, finds its sockets by name, and loads + tints +
  snaps each child (instancing across the `_<i>` families), returning the composed group. It generalizes
  the viewer's `ReclaimerRig` / the game's `attachStaticHead`.
- **Viewer:** the Parts-tab product view renders through the assembler — the real assembled whole, not a
  provisional row. **Game:** the whole-product GLBs for the **engine** (`engine-mk1/2`), **storage**
  (`storage`) and the **chassis** (`chassis-1x3`/`-3x5`, retired) are replaced by the assembler output, so
  an in-game engine/container/rig reads as its located sub-parts at their own tiers. *(Built as: a
  `Renderable` `assembly` variant; `productRenderSpec` is the one place a product resolves to
  compose-or-single-GLB, shared by the world entity, the workshop deck + inspect portrait — and the
  chassis composes at its own deploy seam, `chassisToRig`, since a staged chassis stays the kit crate.)*
- **No manipulator needed.** Sockets are placed **procedurally by the generators**, so the chassis needs
  zero hand-placement and engine/storage need only a few socket offsets eyeballed in the viewer. A full
  transform-gizmo manipulator is **out of scope**; if hand-tuning engine internals proves painful, a
  *light* "nudge + read-out the transform" mode is the fallback, not a gizmo.

**New asset work 2b introduced (built):** sockets added to the Casing/Boiler/Shell generators (the Casing
+ Boiler reworked into open frames that hold their internals); and the **chassis frame split**
(`chassis-frame` → `frame-1x3` / `frame-3x5`, each a full mounting deck with `socket_axle_<i>` +
`socket_susp_<i>` corner stations) with the **Wheel** re-authored as one hub-origin unit and the
**Suspension** as one corner unit, both instanced per station.

**Still open (art tuning, not blocking):** the exact internal placement + per-slot scale inside each
engine frame, and the per-corner placement of the chassis wheels/suspension — settled by eye in the viewer.

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
