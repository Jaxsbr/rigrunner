# RIGRUNNER — Spec: Workshop Interface, Parts Inventory & Engine Composition

The spec for milestone **MW**. It delivers, end to end:

1. An **openable workshop interface** — a tab appears when the rig is in the workshop zone; clicking
   it opens a game-freezing overlay.
2. A **generic parts inventory** — the player owns loose parts (and assembled engines); they're
   browsable in the workshop and movable between **inventory** and the **assembly bench**.
3. **Engine composition** — engines are **assembled from four parts** in two **energy types**
   (electric / mechanical). You build a complete engine on the bench, store it, and **mount it on a
   chassis**, where a **no-hybrid type-lock** is enforced.

> ✅ **Done when (verify in the running game):** with the 8 parts granted to inventory, you can build
> **both** a complete **electric** engine and a complete **mechanical** engine on the bench, move
> them to inventory, **mount one on the rig and drive** with type-correct behaviour, and confirm the
> **cross-type mount is blocked** until you remove the first engine. (Full checklist at the end.)

> 📦 **Two phases, many PRs — deliberately.** Phase 1 stands up the interface + inventory + bench
> (you can move parts around and inspect them). Phase 2 adds assembly + type-locked mounting. Ship
> Phase 1 first, feel it, then build Phase 2. **Do not land this in one PR.**

> ⚠️ **Status vs. the project's rules.** The four-slot grammar, the two types, and the no-hybrid
> type-lock are now **decided for this milestone** (Jaco confirmed, 2026-06-01). The richer **energy
> economy is deliberately deferred** (see "Deferred" below). MW stays a `pending` candidate in
> [`milestones.md`](milestones.md) until delivered; promote the settled mechanics into `CLAUDE.md`
> once they ship.

---

## Scope decision: fuel & energy sources are deferred

To cut scope, **this milestone does NOT implement the energy *source* components** (battery cell,
fuel reservoir) or **any fuel/charge consumption**. A completed, mounted engine simply **runs on
unlimited energy** — only its **type** (electric vs mechanical) shapes how it behaves.

What that means concretely:

- The engine's **energy coupling** is still one of the four parts (it *defines/gates* the type), but
  there is **no external source to plug in** and **nothing to refuel or recharge**.
- The **regulator** part is still required to complete an engine and contributes stats, but the
  **activatable special ability** it represents (electric *boost* / mechanical *overdrive*) is
  **deferred** — wiring a boost/overdrive input is a later PR, not part of MW.
- The full energy economy (capacity, discharge/burst, fuel grades, recharge, fuel weight) lives raw
  in [`ideas.md`](ideas.md) (2026-06-01 session) and is **out of scope here**.

---

## The known parts list (the reference)

An engine is **assembled from four slots**, always in this grammar:

| # | Slot | Role | Type-significance |
|---|------|------|-------------------|
| 1 | **casing** | outer shell | flavour + weight/durability |
| 2 | **converter core** | turns energy into drive | **type-defining** (the character of the engine) |
| 3 | **energy coupling** | how energy enters the engine | **type-gating** (what it's compatible with) |
| 4 | **regulator** | governs output / special ability | the special-ability axis (boost/overdrive — deferred) |

Two energy types ⇒ a part per slot per type ⇒ **8 parts total for the milestone**:

| Slot | ⚡ Electric part | ⛽ Mechanical part |
|------|----------------|-------------------|
| casing | `e-casing` — **Coilframe Casing** | `m-casing` — **Drumframe Casing** |
| converter core | `e-core` — **Motor Coil** | `m-core` — **Drive Block** |
| energy coupling | `e-coupling` — **Power Terminal** | `m-coupling` — **Fuel Feed** |
| regulator | `e-regulator` — **Discharge Regulator** | `m-regulator` — **Governor** |

Each part definition carries: `id`, `slot` (`casing|core|coupling|regulator`), `type`
(`electric|mechanical`), `displayName`, attribute contributions (`power`, `torque`, `weight`; plus a
placeholder `durability`/`burst` for later), and an `assetId` (placeholder until real GLBs exist).

A **complete engine** = all four slots filled with parts **of the same type**. Mixed-type parts
**never complete** an engine (the coupling and core disagree → the bench refuses to assemble).

---

## The two engine types (and the per-chassis distinction)

| | ⚡ Electric | ⛽ Mechanical |
|---|-----------|--------------|
| **Identity** | maneuver / scout / combat | hauler / heavy |
| **Profile** | high **power** (top speed), low torque, **light** | high **torque** (hauling), lower power, **heavy** |
| **Feel** | snappy, instant response | grindy, sustained, slow to respond |
| **Special (deferred)** | burst → **boost** | sustained → **overdrive** |
| **Look (future)** | clean, glowing, `glow_green`/`rig_blue` | grimy, `rust`/`dark_metal`, `hazard_yellow`, fumes |

These produce a standard `EngineSpec {power, torque}` + `Weight` — **the same contract everything
downstream already consumes** (`aggregateEngineOutput` in `systems/engine.ts`, `rigPerformance` in
`systems/drive.ts`). Composition only changes *how* those numbers are produced; downstream code
**must not change**.

### No hybrids — the chassis is type-locked

**A chassis (rig) is locked to a single energy type.** Concretely:

- Mounting an engine whose `type` **conflicts** with an engine already mounted on that rig is
  **rejected** — on the assembly/mount surface it simply **won't snap** (tactile refusal, not an
  error dialog).
- **Same-type multiples are allowed** (two electric engines is fine — `aggregateEngineOutput`
  already handles multiple engines with diminishing returns).
- To **switch types** you must first **remove** the existing engine(s); then the other type can go
  on.
- The rig's **current engine type** is surfaced (stats HUD + the workshop interface), so the player
  always knows what the chassis is committed to.

**Near-future (not MW):** this same lock will extend to *other* components — energy weapons require
an electric chassis; some mechanical weapons (e.g. a rotating turret motor) require a mechanical
chassis. Designed toward, **not built here**.

---

## What already exists (the seams we build on)

Architecture is ECS: data-only components, pure systems over a `World`, a render layer that is a
read-only projection, all wired in `game/src/main.ts`.

| Concern | Where | Notes |
|---|---|---|
| Workshop entity + deck | `game/src/content/workshop.ts` | `spawnWorkshop()`; `MountGrid {3×3, deckY 0.2}`; `WorkshopZone {radius 3.5, active}` |
| Proximity gate | `game/src/systems/workshop-zone.ts` | sets `zone.active` when the rig is in range — **drives when to show the tab** |
| Mounting / grid geometry | `game/src/systems/mounting.ts` | `mountPart`, `unmountPart`, `partAtCell`, `mountedStorages`, `cellWorldPose` — grid-agnostic |
| Parts | `game/src/components/part.ts` | `Part {kind}`; capability via components (`EngineSpec`, `Storage`, `Weight`, `Mount`) |
| Engine attrs | `game/src/components/engine-spec.ts`, `game/src/content/engines.ts` | `EngineSpec {power, torque}`; **`ENGINE_MK1/MK2` placeholders are retired by this milestone** |
| Engine → performance | `game/src/systems/engine.ts`, `game/src/systems/drive.ts` | `aggregateEngineOutput()` → `rigPerformance()`. **Downstream of `EngineSpec` — keep untouched.** |
| Wallet | `game/src/components/wallet.ts` | `Wallet {scrap}`, `getWallet()`. Singleton "player" entity — the home for the new inventory. |
| Build interaction | `game/src/build/build-controller.ts` | `beginCarry`/`dropCarry`, snap preview, return-to-origin glide — the mount path + the feel to mirror |
| Model render seam | `game/src/components/renderable.ts`, `shared/assets.ts`, `shared/model-loader.ts` | `Renderable {shape:'model', assetId}`; `MODEL_ASSETS`; cached `ModelLoader` |
| Rotatable preview | `viewer/src/main.ts` | `OrbitControls` + `frame(obj)` auto-fit — the **portrait** reuses this |
| HUD overlays | `game/src/ui/wallet-hud.ts`, `game/src/ui/stats-hud.ts` | DOM-overlay pattern for UI over the canvas |
| Frame loop | `game/src/main.ts` | where a `paused` flag gates which systems run |

### Principles

1. **Projection, then editor.** The interface first *reads* state; then it *mutates* — but always
   through the world component model (`mountPart`, inventory ops, `EngineAssembly`), never a parallel
   store.
2. **`EngineSpec` is the contract.** If a change to `engine.ts`/`drive.ts` seems needed, stop — the
   composition layer is leaking past its contract.
3. **Manual & tactile.** Success is felt as **parts snapping together** (shadow under the part, short
   glide/snap animations — `observations.md` #1). Incompatibility is felt as a **refusal to snap**.
4. **Reuse, don't fork.** Portrait reuses the viewer; the bench mirrors the build-controller *feel*;
   the overlay reuses the DOM-HUD pattern; mounting reuses `mountPart`.

---

# Phase 1 — Workshop interface, inventory & bench

Stand up the surface and the part-moving plumbing. No engine assembly logic yet — by the end of
Phase 1 you can open the workshop, browse owned parts, inspect them, and shuffle them between
inventory and the bench.

### PR P1 — Open tab + freezing overlay shell — ✅ DELIVERED (PR #5, tested 2026-06-01)

**Goal:** A tab-like "🔧 Open Workshop" button appears bottom-centre while the rig is in the workshop
zone. Clicking it opens a full-screen overlay that **freezes the simulation**; closing it resumes.
Ignoring it leaves today's manual offload untouched.

> ✅ **Delivered.** Tab tracks zone state (fades in/out), the overlay opens and freezes the sim
> (wheels still, no drift, drain paused) while still rendering the frozen scene, and `Esc`/Close
> resumes cleanly with no stuck input. Drive input is zeroed while paused; the sim block, build
> interaction, and the sim-driven animators are gated behind a `paused` flag owned by `main.ts`.
> New `game/src/ui/workshop-overlay.ts` owns the DOM and surfaces `onPauseChange` + `setZoneActive`.
> The empty overlay shell is intentional — contents land in P2/P3.

**In:**
- DOM tab anchored bottom-centre, shown only when any `WorkshopZone.active` is true (reuse the flag
  `workshopZoneSystem` already sets). Fades/slides in, doesn't pop.
- Overlay panel: titled frame + Close button + `Esc` to close (empty shell for now).
- A **`paused`** boolean owned by `main.ts`: when paused the frame loop skips simulation systems
  (movement, drive, drain, collection, zone, mounting-ride) but **keeps rendering** the frozen scene;
  sim-driving input is ignored.

**Out:** Overlay contents (P2+). No change to drain/offload when the overlay is closed.

**Files:** new `game/src/ui/workshop-overlay.ts`; edit `game/src/main.ts` (own `paused`, gate the
systems block, expose open/close).

**Manual test:**
1. `npm run dev:game`. Drive away from the workshop → no tab. Drive into the zone → tab fades in.
   Drive out → fades out.
2. Ignore the tab, drop a full container on the deck → it still drains to `SCRAP` (opt-in preserved).
3. Click the tab → overlay opens, scene **frozen** (no drift, wheels still, drain paused).
4. Drive keys while open → nothing moves.
5. `Esc`/Close → resumes cleanly (no input stuck, no resume jump).

**Done when:** the tab tracks zone state, the overlay opens/closes, and the freeze is clean both ways.

---

### PR P2 — Generic parts inventory + part catalog + dev grant — ✅ DELIVERED (PR #6)

**Goal:** Introduce a **generic inventory** of owned parts on the player ("wallet") entity, define
the **8-part catalog**, and **grant the 8 parts** for testing. No UI yet beyond a console/HUD count
— this is the data foundation.

> ✅ **Delivered.** The 8-part catalog (`content/parts-catalog.ts`) defines casing/core/coupling/
> regulator × electric/mechanical, each with attr contributions distributed so a full electric set
> sums to `13/8/4` and a full mechanical set to `8/19/8` (the P5 profiles, tunable); `durability`/
> `burst` are reserved placeholders. Parts are first-class entities via the lean `EnginePart {id}`
> vessel (`components/engine-part.ts`), description resolved through `partDef()`. `Inventory {items}`
> (`components/inventory.ts`) lives on the **same singleton as `Wallet`**, with conserved helpers
> (`addToInventory` idempotent, `removeFromInventory` drops-not-destroys, `inventoryItems` snapshot,
> `getInventory`). A **dev grant** in `main.ts` seeds the 8 parts and logs a one-line count, flagged
> as a stand-in for the deferred production chain. Purely additive — no system queries `EnginePart`,
> so driving/collecting/draining are unchanged; `EngineSpec` untouched. 86 tests pass (13 new).

**In:**
- New `game/src/content/parts-catalog.ts`: the 8 part definitions (table above) — `id`, `slot`,
  `type`, `displayName`, attr contributions, `assetId` (placeholder boxes are fine until GLBs exist).
- New `game/src/components/inventory.ts`: `Inventory` holding **owned, unplaced items** (loose parts
  and, later, assembled engines). Each item is a world entity id (parts are first-class entities) so
  identity/state survive moves — echoes the "parts are stateful vessels" requirement
  (`observations.md` #6–7). Lives on the **same singleton entity as `Wallet`** (the player store);
  `Wallet` stays scrap-only, `Inventory` holds parts — together "what the player owns."
- Helpers: `addToInventory`, `removeFromInventory`, `inventoryItems(world)`.
- A **dev grant** (debug action or startup allotment) that creates the 8 part entities and puts them
  in inventory. **`log`/comment that this is a stand-in for the real production chain** (deferred).

**Out:** Inventory UI panel (P3), assembly (Phase 2).

**Files:** new `parts-catalog.ts`, `components/inventory.ts`, maybe `systems/inventory.ts`; edit
`main.ts` (create inventory on the player entity; dev grant).

**Manual test:**
1. Start a session → a HUD/console line shows inventory holds **8 parts** (4 electric, 4 mechanical).
2. (If a quick test/assert is added) the catalog has exactly the 8 ids with correct slot/type.
3. No effect on driving, collecting, or draining — purely additive data.

**Done when:** the player owns the 8 catalog parts in a generic inventory, with conserved
add/remove helpers, and nothing else changes.

---

### PR P3 — Inventory browser + portrait + bench with inventory↔bench drag — ✅ DELIVERED (PR #7, accepted 2026-06-01)

**Goal:** Inside the overlay: **browse owned parts**, **inspect** a selection (details + rotatable
3D portrait), and **move parts between inventory and the assembly bench** freely. The bench shows the
four engine slots but does **not** assemble yet — this PR is about *moving and looking*.

> ✅ **Delivered.** The overlay now hosts an **inventory list**, a **detail panel** (slot/type/attrs;
> `durability`/`burst` shown as reserved), a **rotatable portrait**, and the **four-slot bench** with
> **pointer drag inventory↔bench** — role-matched, conserved (a part is always in exactly one place),
> with a snap pulse + return-to-origin glide mirroring the build-controller feel. The portrait core
> was extracted into a reusable **`shared/model-portrait.ts`** (own canvas/scene/loop, aspect-aware
> auto-fit, drag-spin, auto-rotate off; falls back to a tinted placeholder since part GLBs don't
> exist yet). Bench state lives in a new **`Bench` component** and survives close/reopen.
>
> **Beyond the spec (by Jaco's call, discovery):** the bench was made **recipe-driven** (new
> `content/recipes.ts`) rather than hardcoded to the engine, and a **second recipe — the storage
> container** (`container shell` + `container rim`, 2 parts, no energy type) — was added with a
> **recipe picker** to prove the bench is genuinely generic. Parts generalised: a `category`
> (`engine`/`storage`) and an optional `type` (engine-only). Switching recipes returns bench parts to
> inventory and reshapes the slots. **Caveat:** the picker is a flat tab strip — fine for two
> recipes, **won't scale** to many; a robust selector is flagged for later (`observations.md` #9).
> Forward idea captured: **loot-drop "special" recipes** that supersede basics (`ideas.md`
> 2026-06-01). 100 tests pass; game+viewer typecheck + build clean.

**In:**
- **Inventory panel:** list of owned parts (displayName, slot, type). Selecting one shows a detail
  panel (slot, type, attr contributions) and a **rotatable portrait**.
- **Portrait widget:** extract the viewer's preview core into a reusable
  `shared/model-portrait.ts` (own tiny scene/camera/lights, `ModelLoader`, `frame()`-style auto-fit,
  `OrbitControls` with gentle auto-rotate + drag, `dispose()`). Coexists with the frozen main scene
  (own canvas).
- **Bench:** a panel showing the four slots (`casing/core/coupling/regulator`), all empty.
- **Drag inventory ↔ bench:** drag a part from inventory onto a slot → it sits there (placed, not
  yet assembled). Drag a part from a slot back to inventory → returns. **Conserved** — no
  duplication/loss. Snap/return feel mirrors `build-controller.ts` (short animation, clear placement).

**Out:** "Complete engine" logic, type checks, computed spec (P4). Mounting (P6).

**Files:** new `shared/model-portrait.ts` (optionally refactor `viewer/src/main.ts` to consume it);
edit `workshop-overlay.ts` (inventory panel, detail, portrait host, bench, drag); read-only use of
`parts-catalog`, `Inventory`.

**Manual test:**
1. Open the overlay → inventory panel lists all 8 parts.
2. Select a part → detail panel shows slot/type/attrs; portrait shows its model, auto-rotates,
   drag-spins. Switch selections rapidly → no leak/jank (old portrait disposed).
3. Drag a part onto a bench slot → it appears there; inventory count drops by one.
4. Drag it back → returns to inventory; counts conserved.
5. Fill all four slots with a mix, then clear them back → every part accounted for.
6. Close & reopen → state is consistent (parts where you left them).

**Done when:** you can browse, inspect (with a working portrait), and shuffle parts between inventory
and the four bench slots with perfect accounting — the tactile substrate for assembly.

**End of Phase 1:** play it. The workshop is now a place you open, look into, and handle parts in.
Decide the assembly mechanics (Phase 2) are right before building them.

---

# Phase 2 — Engine composition & type-locked mounting

Turn placed parts into **complete engines** of two types, and let the player **mount** them onto a
chassis under the **no-hybrid lock**.

### PR P4 — Engine assembly: four same-type parts → a complete engine — ✅ DELIVERED (PR #8)

**Goal:** When the bench's four slots hold parts **all of the same type**, the bench can **assemble**
them into a **complete engine**; the result computes its `EngineSpec` + `Weight` and can be moved to
inventory. Mixed-type or incomplete slots → **cannot complete** (won't snap together).

> ✅ **Delivered, built RECIPE-GENERIC** (Jaco's call — any buildable assembles, not just the engine).
> A new lean **`Assembly` component** (`components/assembly.ts`) marks a composed product: its
> `recipeId`, the **part entities it owns** (kept alive — dismantle hands the same ones back, fully
> conserved), and the resolved energy `type`. A new pure, recipe-driven **`systems/assembly.ts`** does
> the work: `sumPartStats`, `resolveEnergyType` (the no-hybrid rule), `benchEnergyType`/`acceptsType`
> (the **tactile cross-type drop refusal** — a wrong-type part won't snap onto a bench committed to a
> type), `isBenchComplete`, `assembleVerdict` (with a readable disabled reason), `assemble` (stamps
> `Part{kind}` + `Weight` + the kind's capability + `Assembly`, consuming the bench parts into it),
> and `dismantle` (the conserved reverse). The **one** place kinds differ is `attachCapability`:
> engine → `EngineSpec`, storage → `Storage`. `Recipe` gained `productKind`; the storage container
> assembles through the identical path, proving the genericity.
>
> The overlay generalised every item to a uniform **`ItemView`** (loose parts AND composed products),
> and gained the **Assemble** action (enabled only when complete + one type, else it shows why) and
> **Dismantle** (in a product's detail). `EngineSpec`/`engine.ts`/`drive.ts` **untouched**. 15 new
> tests (116 total) cover summing, the no-hybrid rule, completeness/verdict, engine + storage
> assembly, and conserved dismantle.
>
> **Beyond the spec (discovery, by Jaco):**
> - **Composed engines preview with the existing GLBs** — electric → `engine-mk2`, mechanical →
>   `engine-mk1` (a stand-in until bespoke composed-engine assets exist); storage previews via its
>   container GLB.
> - **Product sub-part inspection** — selecting a composed product puts the bench into a read-only
>   view of its sub-parts (disabled chips), so you can read what it's made of (e.g. "rare casing,
>   common rest") before dismantling.
> - **Live build-target preview** — with nothing selected, the preview shows the active recipe's
>   product as a flat-grey **ghost silhouette** while the recipe is incomplete, snapping to the
>   full-colour part the instant Assemble enables (stats stay hidden until built). Also fixed a latent
>   `model-portrait` bug that disposed the loader's cache-shared geometry/materials on every swap.
> - **Dark scrollbars** in the overlay (the OS light-grey bar clashed with the panel).
>
> **Caveat:** Mk1/Mk2 are still the spawned world engines — **retiring them for composed engines is
> P5**; mounting a completed engine on the chassis (the type-lock) is **P6**. Note the file names
> landed as `assembly.ts` (not the spec's `engine-assembly.ts`) to reflect the generic scope.

**In:**
- New `game/src/components/engine-assembly.ts`: `EngineAssembly` = the four slots + the part filling
  each + the resolved `type`.
- New `game/src/systems/engine-assembly.ts`: `computeEngineSpec(assembly)` → `{spec: EngineSpec,
  weight, type}` (sum part contributions); `isComplete(assembly)` (all four slots filled, single
  type).
- **Assemble action** on the bench: enabled only when `isComplete`. On assemble, create a **complete
  engine entity** (`Part {kind:'engine'}` + `EngineSpec` + `Weight` + `EngineAssembly` carrying its
  parts + a `type` marker), consuming the four bench parts. A clear **snap-together** moment.
- **Type-mismatch feedback:** if the four slots aren't one consistent type, the assemble action is
  disabled with a readable "parts don't match" state — and ideally the offending slot **refuses** a
  cross-type part on drop.
- **Move the completed engine to inventory** (and back to the bench to dismantle — dismantle = the
  reverse, returning the four parts; optional this PR, can be a follow-up).

**Out:** Mounting on the rig (P6). Engine-type *drive feel* tuning (P5). Boost/overdrive activation
(deferred).

**Files:** new `engine-assembly.ts` (component + system); edit `workshop-overlay.ts` (assemble
action, completed-engine handling).

**Manual test:**
1. Drag the **four electric** parts into the four slots → the **Assemble** action enables.
2. Assemble → the four parts become **one complete electric engine** (snap feedback); slots empty.
3. The completed engine shows correct computed `power`/`torque`/`weight` in its detail panel.
4. Move the engine to inventory; build the **mechanical** engine the same way → also completes.
5. Put **three electric + one mechanical** in the slots → Assemble is **disabled** / the mismatched
   slot **refuses** the part.
6. Counts conserved throughout (parts in, one engine out; dismantle returns the same parts).

**Done when:** the bench turns four same-type parts into a correctly-spec'd complete engine of either
type, and refuses mixed/incomplete assemblies.

---

### PR P5 — Retire Mk1/Mk2: composed engines are the engines — ✅ DELIVERED

**Goal:** Replace the placeholder `ENGINE_MK1/MK2` with the two **composed** engine types so the
world's engines come from assemblies, and give each type its **distinct drive feel**.

> ✅ **Delivered.** `ENGINE_MK1/MK2`, `EngineDef`, and `spawnEngine` are **gone** — every engine is
> now composed from its four catalog sub-parts. `content/engines.ts` shrank to the engine's recipe in
> catalog terms (`engineParts(type)` → the four parts of an energy type, in slot order). The assembly
> system grew a reusable core: **`buildProduct`** (the product-construction `assemble` already did,
> extracted) and **`composeProduct`** (spawn fresh parts + build) — so a **directly-seeded engine is
> built identically to a bench-assembled one**. `main.ts` seeds the rig with a **pre-assembled
> electric engine, already mounted**, and **removes all loose world engines and containers** (decided
> with Jaco): the world starts clean, everything is built in the workshop. **Engine-type drive feel
> is left emergent** from the profiles (electric `13/8/4` light+fast, mechanical `8/19/8`
> heavy+torquey) through `drive.ts` — **no `responseType` ramp was added** (kept minimal; it can earn
> its place later). The stats HUD now **labels engines by energy type** (`Electric` / `Mechanical` /
> `Electric ×2`), retiring the Mk1/Mk2 labels and surfacing the chassis type early. `EngineSpec` /
> `engine.ts` / `drive.ts` contracts **untouched**. 7 new tests (123 total); game+viewer typecheck +
> build clean.
>
> **Beyond the spec (by Jaco's call):**
> - **Inventory → world bridge.** The spec never said how an *assembled* product gets from inventory
>   into the drivable world to be mounted. Added a **"Move to World"** button beside Dismantle in a
>   product's detail: it ejects the product onto the ground beside the rig (via new
>   `placeProductInWorld`, which grants Transform/Renderable/Collider + an engine's MountFacing) so the
>   player can grab and mount it with the build interaction (the overlay stays open). A deliberately
>   **temporary** stand-in — the **workshop-staging-grid** follow-up replaces it (see below).
> - **Dev grant trimmed to the container parts.** The rig already ships its electric engine, so the
>   starting inventory holds only the **container shell + rim** — exactly enough to build a storage
>   container and start the cargo loop. Engine sub-parts return when the P6 type-lock work needs them.
> - The product → GLB mapping (electric → `engine-mk2`, mechanical → `engine-mk1`, storage → its
>   container) moved into **`content/product-visual.ts`** so the portrait, inventory chip, and the
>   model placed in the world all agree.
>
> **Caveat:** the **no-hybrid type-lock on mount is NOT enforced yet** — that's **P6**. In P5 the build
> interaction will currently let a mechanical engine mount alongside the starting electric one; P6 adds
> the refusal + the chassis type readout's "—" empty state.

**In:**
- `spawnEngine()` builds an engine from an `EngineAssembly` and sets `EngineSpec`/`Weight` via
  `computeEngineSpec`. **The rig starts with a basic pre-assembled *electric* engine** (decided —
  gentle cold-start: the player can drive immediately, and electric's snappy/light profile is the
  friendlier default than the heavy hauler). It's a normal composed engine — removable/dismantlable
  like any other, which keeps the type-lock and swap loop testable from the first session.
- **Remove** the `ENGINE_MK1`/`ENGINE_MK2` constants (or re-express them only if still referenced),
  so there's a single way engines exist: composed from parts.
- **Engine-type drive feel** (minimal): electric = snappy/high-top-speed/light; mechanical =
  high-torque/heavy/sluggish — primarily emergent from the power/torque/weight profiles. A small
  optional `responseType` on the engine (electric=quick accel ramp, mechanical=slow ramp) may be read
  by `drive.ts` for a subtle ramp difference; keep it minimal and **don't change the `EngineSpec`
  contract** — read the type alongside the aggregated spec.
- Suggested starting numbers (tunable): electric ≈ `power 13 / torque 8 / weight 4`; mechanical ≈
  `power 8 / torque 19 / weight 8`. Tune against feel.

**Out:** The mounting UX (P6). Anything energy-source related (deferred).

**Files:** edit `game/src/content/engines.ts` (compose; remove Mk1/Mk2), `parts-catalog.ts` (attr
numbers), possibly `systems/drive.ts` (read `responseType` for ramp only). Verify untouched:
`systems/engine.ts`.

**Manual test:**
1. Start a fresh session → the rig already has a pre-assembled **electric** engine and drives
   immediately (snappy, light).
2. Drive with a mechanical engine → strong, hauls cargo well, heavy, slower to respond.
3. The contrast is **felt**, not just on the stats HUD.
4. No references to Mk1/Mk2 remain; the game still drives normally.

**Done when:** engines are exclusively the composed two-type engines, each with a clearly different
drive feel, with the downstream performance pipeline unchanged.

---

### PR P6 — Type-locked mounting: put a completed engine on the chassis

**Goal:** Mount a **completed engine** (from inventory) onto the rig, enforcing the **no-hybrid
type-lock**, and surface the chassis's current engine type.

**In:**
- A path to **mount a completed engine** onto a rig deck cell. Prefer reusing the existing
  carry/`mountPart` flow (from `build-controller.ts`) so it shares the world-camera build feel; the
  engine can be **dropped from inventory** into the world / onto the deck, or placed via the
  interface — pick the smaller change that reuses `mountPart`.
- **Type-lock validation** in the mount path: reject mounting an engine whose `type` conflicts with
  any engine already mounted on that rig — it **won't snap** (mirror the existing "no free cell"
  refusal). Same-type is allowed.
- **Surface the rig's engine type:** stats HUD (and the workshop interface) shows the chassis's
  committed type (e.g. `ENGINE: ELECTRIC`), or "—" when no engine is mounted.
- **Removing** the engine (existing unmount path) frees the chassis to accept the other type.

**Out:** Extending the lock to weapons/other components (near-future, not MW). Multiple-chassis
management (future).

**Files:** edit `build/build-controller.ts` (type-lock check in the mount validation; allow engines
sourced from inventory), `ui/stats-hud.ts` (show engine type), possibly `workshop-overlay.ts`
(mount-from-interface affordance + the engine-type readout). Reuse `systems/mounting.ts`.

**Manual test:**
1. With a completed **electric** engine in inventory, mount it on the rig → it snaps on; HUD shows
   `ENGINE: ELECTRIC`; the rig drives with electric feel.
2. With a completed **mechanical** engine, try to mount it on the **same** rig → it **won't snap**
   (refused); a brief readable reason is fine.
3. **Remove** the electric engine (HUD → `ENGINE: —`), then mount the mechanical engine → now it
   snaps; HUD shows `ENGINE: MECHANICAL`; drive feel switches to the hauler profile.
4. Mount a **second electric** engine alongside a first electric one → allowed (combined output via
   `aggregateEngineOutput`).
5. Inventory/world accounting stays conserved across all mounts/unmounts.

**Done when:** completed engines mount onto a chassis, the no-hybrid lock is enforced (cross-type
won't snap until you remove the incumbent), and the chassis's engine type is always visible.

---

## Discovered scope (spec-first, not yet built)

These came out of playing P5. They are **specified before building** (Jaco's call: brainstorm/spec
first). Sequence them after the core P-series; they don't block P6.

### PR P7 (discovered) — Workshop staging grid: inventory ↔ workshop deck, in the UI

**Why this exists.** P5 shipped a deliberately-temporary **"Move to World"** bridge: it ejects an
assembled product onto the ground beside the rig so it can be grabbed and mounted. Two problems showed
up in play: it's an *invisible* mechanism (you can't see the workshop's own deck or what's staged on
it), and ejecting-to-ground is a clumsy way to hand a part over. This PR **replaces Move-to-World**
with a visible **staging grid** inside the workshop interface.

**The model (reuse, don't invent).** The workshop already owns a `MountGrid` (its 3×3 deck, `deckY
0.2`) and is already a valid **mount target** for the build interaction (`build-controller.ts` snaps to
any active workshop deck). So "staging" is just **mounting a product onto the workshop's grid** instead
of the rig's. The new piece is only the **inventory ↔ workshop-grid** move (inventory is abstract, not
in the world); **workshop-grid ↔ rig already works** via the in-world build interaction when parked.

**In:**
- A **staging-grid panel** in the overlay showing the workshop's deck cells and the products currently
  on them (occupancy + each product's chip/name), refreshed from world state like the bench.
- **Move inventory → staging grid:** drop a product into a free workshop cell → it leaves inventory and
  mounts on the workshop deck (`mountPart(product, workshop, cell)`), gaining world presence
  (Transform/Renderable/Collider/MountFacing — the `placeProductInWorld` capability seam already exists).
- **Move staging grid → inventory:** pull a staged product back → unmount + return to inventory.
- **Only assembled/mountable products** may be staged. **Loose sub-parts are barred** (a lone casing
  has no standalone use on a deck) — captured as a possible future unbar in `ideas.md` (2026-06-01).
- **Remove the "Move to World" button** — staging is the inventory→world path now.
- **Conserved:** a product is in exactly one place — inventory OR a workshop cell OR mounted on the rig
  OR loose in the world.

**Open design questions (resolve in this PR, or a quick brainstorm pass first):**
- **Render style.** First cut: a **2D slot grid like the bench** (3×3 cells + product chips, drag in/out)
  — simplest, consistent, proven. A **3D mini-view** of the workshop deck (a `model-portrait`-style
  turntable showing real placement) is a possible later polish. *Recommendation: 2D grid first.*
- **Direct grid ↔ rig in the UI?** Or keep rig-mounting exclusively in the in-world build interaction
  (the player closes the overlay and drags the staged part onto the rig)? Leaning: keep rig-mounting
  in-world for now (one place to mount), the staging grid only bridges inventory ↔ workshop deck.

**Out:** Mounting onto the rig (stays the in-world build interaction + P6's type-lock). The
field-reconfiguration lock and the part-collection mechanism — both **`ideas.md` (2026-06-01)**, not
this PR. A 3D staging view (future polish).

**Manual test (sketch):**
1. Build a storage container on the bench → it lands in inventory.
2. Open the staging grid → drag the container onto a workshop cell → it appears on the deck (and in the
   world on the workshop), and leaves the inventory list. Counts conserved.
3. Drag it back to inventory → returns; deck cell empties.
4. Try to drag a **loose sub-part** onto the grid → refused (only products stage).
5. With a product staged on the workshop deck, close the overlay → grab it off the deck and mount it on
   the rig with the existing build interaction. Everything stays conserved across inventory ↔ deck ↔ rig.

**Done when:** the workshop deck and its staged products are visible in the interface, products move
freely inventory ↔ workshop grid (sub-parts barred, fully conserved), and "Move to World" is gone.

---

## Deferred (captured, not committed)

Out of MW by Jaco's call; pulled forward only when play asks.

- **Energy *source* components & consumption** — battery cell, fuel reservoir, charge/fuel as
  resources, recharge, refuel, fuel weight. The whole energy economy in `ideas.md` (2026-06-01).
- **Boost / overdrive activation** — the regulator part exists and contributes stats in MW, but
  wiring an activatable electric *boost* / mechanical *overdrive* input (and the discharge/sustain
  upgrade axes) is later.
- **Type-lock extending to other components** — energy weapons require electric; some mechanical
  weapons (rotating turret motor) require mechanical. Designed toward; built with the weapons work.
- **Casing materials** — steel/cobalt/aluminium/titanium + invented alloys as a casing attribute
  axis (the original casing-swap idea). MW uses one casing per type; materials are a later depth axis.
- **The production chain** — smelter (metals → alloys) and caster (materials → casings) as workshop
  fixtures that *make* parts, replacing MW's dev grant. Overlaps the workshop-drain upgrade seams in
  `ideas.md` (2026-05-31).
- **Footprint reclaim / tiers** — higher-tier parts doing the same job in fewer cells (`ideas.md`,
  2026-05-30).

---

## Cross-cutting notes

- **Pause scope:** the freeze pauses *simulation*; simplest is "pause everything," resumed cleanly.
  Revisit only if it feels wrong.
- **Inventory is the player's, not the rig's:** it survives rebuilds and chassis swaps (lives on the
  wallet/player singleton), readying the "multiple chassis" idea (`ideas.md`, 2026-05-30).
- **`EngineSpec` is sacred:** composition changes how the numbers are produced, never what consumes
  them.
- **Discovery cadence:** land PRs in order; after Phase 1 and again after P6, **play it** and update
  `observations.md`. Promote settled mechanics into `CLAUDE.md` once MW ships.

## Done-criterion checklist (one pass, all PRs landed)

Run `npm run dev:game`.

1. Outside the zone: no tab. Drive in: tab appears. Ignore it + drop a full container: still drains
   (opt-in preserved).
2. Open the tab: overlay opens, scene freezes; `Esc`/Close resumes cleanly.
3. Inventory lists the 8 granted parts; selecting shows details + a rotatable portrait.
4. Drag the four **electric** parts onto the bench slots → **Assemble** → a complete electric engine.
5. Move it to inventory; build the four-part **mechanical** engine → completes too.
6. A mixed set of parts **refuses** to assemble.
7. Fresh rig already runs on a pre-assembled **electric** engine (HUD shows `ENGINE: ELECTRIC`,
   drives snappy/light).
8. Try to mount the mechanical engine on the same rig → **won't snap** (no-hybrid lock).
9. Remove the electric engine (HUD → `ENGINE: —`) → mount the mechanical one → drives heavy/torquey;
   HUD shows `ENGINE: MECHANICAL`.
10. All part/engine accounting is conserved across inventory ↔ bench ↔ chassis and across restart.
