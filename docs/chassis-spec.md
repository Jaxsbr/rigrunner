# RIGRUNNER — Chassis system (spec + phased plan)

**What this is:** the design + phased implementation plan for making the **chassis** a first-class,
composed, sized part of the rig — the plan of record for the feature requested 2026-06-04. It is the
home for the whole feature; PR1–PR4 are built and PR5 is a committed follow-up.

> **Status:** **PR1–PR4 are built.** PR3 shipped in two parts — **PR3a** (multi-chassis ownership +
> selection + a visible deploy) and **PR3b** (the authored unfold animation + eased camera switch).
> **PR4** (pack-up: fold an empty chassis back into a kit, freeing a fielded slot) is built. **PR5**
> (ownership-cap feedback) remains a planned skeleton — gated behind feeling the earlier work, true to
> "build by discovery."

---

## 1. What a chassis is

The chassis is the **foundation** a rig is built on: the wheels/tracks it rolls on and the deck the
rig's parts mount onto. Until now the player's "rig" *was* a monolithic chassis (one hard-coded deck +
one lumped weight + one GLB). This feature decomposes it: a chassis is **composed from sub-parts**,
exactly as an engine is, and comes in two **sizes**.

A rig is still a **rig** — the controllable machine. `Chassis` is now a component *on* it (the
counterpart to an engine's `EngineSpec`), not the rig itself.

### Sub-parts (composed on the bench, summed into the chassis)
| Slot | Sub-part | Contributes |
|---|---|---|
| `wheel-axle` | Wheel & Axle Set | top speed |
| `suspension-steering` | Suspension & Steering Set | turning radius |
| `frame` | Chassis Frame | load capacity (max carry weight) |

The sum of the sub-parts makes the whole chassis's attributes — `topSpeed`, `turning`,
`loadCapacity` — plus its own mass (`Weight`, summed from the three).

### Sizes (the structural choice)
| Size | Deck (cols×rows) | Engines (min–max) | Role |
|---|---|---|---|
| **1×3** | 1 × 3 (3 cells) | 1 – 2 | light scout — the starter (replaces the deprecated 2×3) |
| **3×5** | 3 × 5 (15 cells) | 3 – 6 | heavy hauler |

Size fixes the deck dimensions (`MountGrid`) and the engine envelope; it is **not** a sub-part. Each
size has its own GLB and its own (heavier, higher-rated) sub-part set.

### Tiers (scrap, iron, …) — a separate, not-yet-built axis
Sub-parts will eventually carry **tiers** (scrap → iron → …). Per
[`part-identity-spec.md`](part-identity-spec.md) §4a, tier is an axis on the part **instance**, not a
catalog row, and multiplies the base attributes at resolve time — uniformly across *all* parts,
chassis included. PR1 ships the base (tier-1 / "scrap") sub-parts only; nothing tier-specific is built
here. When the tier system lands, chassis sub-parts gain tiers for free.

---

## 2. The phased plan

### PR1 — Foundation *(built)*
The chassis becomes a real, composed, sized part, wired end-to-end except for driving behaviour.
- `Chassis` component (`@common/components/chassis.ts`); `'chassis'` `PartKind`.
- Six chassis sub-parts (3 slots × 2 sizes, scrap base) + `topSpeed`/`turning`/`loadCapacity` on
  `PartAttributes` (`@common/parts/parts-catalog.ts`).
- Two chassis recipes carrying a size-fixed `chassis` meta block (`@common/parts/recipes.ts`); a
  `'chassis'` case in `attachCapability` that stamps `Chassis` + the deck `MountGrid`
  (`@common/sim/assembly.ts`).
- `@features/chassis/chassis.ts` (`chassisParts(size)`); `spawnRig(world, x, z, size)` composes the
  chassis and builds the drivable rig around it (`@features/mounting/rig.ts`).
- Engine **max** enforced at mount (`withinEngineCapacity` in `@features/mounting/mounting.ts`, applied
  in the build controller); engine **min** is a HUD warning, never a refusal.
- Chassis HUD section: size, engines `N / min–max`, load `X / capacity` (`@features/hud/stats-hud.ts`).
- Assets: `chassis-1x3.glb` (replaces `rig.glb`) + `chassis-3x5.glb`, via
  `tools/blender/assets/chassis_common.py` + the two size modules. Registered in `shared/assets.ts`.
- The 1×3 starter seed in `main.ts` rewritten for the 3-cell deck.

### PR2 — The chassis-kit workshop flow *(built)*
- A chassis is built from its three sub-parts on the workshop **bench** (its two recipes sit in the
  picker, size-locked by `acceptsChassisPart`), assembling into a **chassis-kit** — a composed
  product with a 2×2 `Part.footprint` (`CHASSIS_KIT_FOOTPRINT`), shown as a 2×2 block on the deck.
- The kit is hauled off the deck **out into the world**, where it assembles into a new drivable
  chassis. The convert seam is `chassisToRig` (factored out of `spawnRig`, `@features/mounting/rig`);
  the kit renders as the packed `chassis-kit` crate and swaps to the unfolded chassis on deploy.
- Sub-parts are bought in the **Parts Shop** (`part-costs.ts`). Mounting carries a multi-cell
  footprint primitive (`regionFree`, footprint-aware `partAtCell`/snap/ride) for the 2×2 block.

### PR3 — Multi-chassis ownership + selection
The player owns **1–2** chassis and switches which one they control. Split in two:

**PR3a — ownership + selection + a visible deploy *(in progress)*.**
- `PlayerChassis` + `ActiveRig` markers (`@features/chassis/ownership.ts`): own up to `MAX_OWNED`
  (2); exactly one is active. `main.ts`'s single `player` binding becomes a per-frame `activeRig` the
  input/camera/HUD/zone/scrap/build interaction all follow; the build controller takes a `getRig`.
- A top-left **chassis bar** (`chassis-bar.ts`): a chip per owned chassis (size + its `1`/`2`
  hotkey, active highlighted); click or press the number to switch control.
- **Visible deploy:** a hauled-out kit's crate **lands and stays a crate**, then after a short beat
  assembles into a rig (`deployChassis` = `chassisToRig` + `markOwned`, cap-aware). Control **stays
  on the current rig** (no camera jump); a 3rd kit at the cap is refused and returns to the deck.

**PR3b — the authored unfold animation *(planned)*.** Replace PR3a's simple assemble beat with a
mechanical unfold (wheels roll out, body rises) — an articulated "deploying" chassis + a deploy
animator. The deploy seam (`deployChassis`) stays; only the visual is upgraded. Camera target-easing
on a `1`/`2` switch (PR3a retargets instantly) rides along here.

### PR4 — Pack-up: fold a deployed chassis back into a kit *(built)*
The inverse of deploy, so a chassis isn't a one-way commitment — the player can retire one to make
room for (or rework) another. While the player controls a chassis that has **no parts mounted**
(strip it first — packing a loaded chassis would orphan its parts), a contextual **`E` prompt**
appears — the same fixed HUD-prompt pattern as the scrap-pile "Hold E" / workshop tab — reading
*"Pack up chassis."* Pressing `E` folds it back into a **chassis-kit** crate where it stands (the
inverse of `chassisToRig`), then **hands control to the player's other chassis**; the player hauls the
crate onto the workshop deck like any kit. The packed chassis stops counting as fielded, **freeing a
slot under the `MAX_OWNED` cap** so a different chassis can deploy in its place.

As built (the skeleton's open questions, settled):
- **Empty-only gate** — the prompt shows only on a controlled chassis with **zero mounted parts**
  (`hasMountedParts`). No hint is shown when it isn't empty yet — kept minimal until play asks for one.
- **Control hand-off → require a backup** — you can't drive a kit, so pack-up is offered **only when a
  second fielded chassis exists** to take control; it snaps there on pack (the PR3b eased camera switch
  rides along). Packing your *only* chassis is disallowed (the prompt never shows) — it would leave
  nothing to drive, and supporting a "no active rig" state is deliberately out of scope. Common flow:
  own 2 → strip one bare → pack it → control snaps to the other → haul the freed kit to the workshop.
- **Where the kit goes** — the crate folds **in place in the world** where the chassis stood
  (symmetric with deploy, which lands the kit in the field), a grabbable chassis `Part` again; the
  player hauls it onto the workshop deck via the existing PR2 staging. See the ownership state model.
- **Fielded vs packed** — `PlayerChassis` marks a **fielded** chassis (drivable, in the `1`/`2` bar,
  counts toward the cap). Pack-up removes `PlayerChassis`/`ActiveRig`, so a packed kit is "in storage"
  and frees a cap slot; deploy re-adds them. The chassis bar drops its chip automatically (it queries
  `PlayerChassis`).
- **Prompt placement** — the pack prompt shares the bottom-centre `.hud-prompt` slot with the workshop
  tab / scrap prompt, kept mutually exclusive: it's gated **off any workshop zone** (which owns `E`
  there to open the interface) and never coincides with a pile (an empty chassis carries no Reclaimer
  to rummage). `E` is read as a **rising edge** (single press) distinct from the held-`E` rummage.
- **Seams** (`@features/mounting/rig.ts`, beside their deploy mirrors): `chassisToKit` (the pure
  inverse of `chassisToRig`), `packUpChassis` (the inverse of `deployChassis` — convert + un-field +
  hand off control), and `canPackUp` (the gate). `hasMountedParts` is in `@features/mounting/mounting`;
  the `PackPrompt` HUD class is in `@features/chassis`.

### PR5 — Ownership-cap feedback (notification) *(planned — skeleton)*
Today a 3rd chassis at the cap is refused **silently** (the kit just glides back to the workshop
deck), which reads as a bug. A player may have deliberately built a different-size or
differently-configured 3rd chassis and won't understand why it won't deploy. Surface a clear
**notification** at the refusal — e.g. *"You can only field 2 chassis at once — pack up or dismantle
one first"* — pointing them at PR4's pack-up.

To design (skeleton):
- A lightweight **transient notification / toast** HUD primitive — the game has only *fixed* HUD
  prompts (`.hud-prompt`) and modal overlays today; a brief auto-dismissing message is new. (Distinct
  from PR4's contextual `E` prompt, which reuses the fixed-prompt pattern.)
- **When to warn** — at deploy-refusal for sure; consider a heads-up at *build* time too (assembling
  a kit you can't currently field), so the disappointment lands earlier. Depends on PR4 for the
  call-to-action ("pack up") to be actionable.

### Ownership state model (settled in PR4)
PR4 forces a distinction PR3a doesn't make: **fielded** chassis (deployed, drivable — the ones the
`MAX_OWNED = 2` cap and the `1`/`2` bar count, marked `PlayerChassis`) vs **packed kits** (a chassis
you own but haven't deployed — a crate). **Settled: only fielded chassis count toward the cap** — a
packed kit is "in storage" and doesn't, so pack-up genuinely frees a slot to deploy a different
chassis. Pack-up removes `PlayerChassis`/`ActiveRig`; deploy adds them back.

On the "where does a loose kit live?" question Jaco flagged: PR4 leaves the packed crate **in the
field** where the chassis stood (symmetric with deploy, which lands a hauled-out kit in the field),
and the player hauls it onto the workshop deck — the world holds it only until it's carried there.
Whether a kit should be *forced* to the workshop (never allowed to litter the field long-term) is
still open; revisit if loose crates prove messy in play.

---

## 3. Deferred: sub-part → driving behaviour (read this)

**By decision (2026-06-04), chassis sub-parts do NOT affect how the rig drives in PR1.** The
`Chassis.topSpeed` and `Chassis.turning` values are summed and stored, but:

- **handling** still comes from the rig's **constant `Drivetrain`** (the same `turnRate` etc. for both
  sizes), and
- **propulsion / top speed** still comes solely from the mounted **engines** (`drive.ts` is
  untouched — a unit test asserts `rigPerformance` is unchanged by the chassis).

This is parked alongside the existing **"weight is parked"** decision (`drive.ts`, `weight.ts`). The
two reattach together in the future **laden-weight milestone**, which will:
- derive `Drivetrain.turnRate` from `Chassis.turning`,
- cap engine-derived top speed by `Chassis.topSpeed`, and
- make `Chassis.loadCapacity` a **binding** limit (overload → a real penalty/refusal).

Until then **load capacity is a HUD readout only** — the HUD shows `load X / capacity Y` (live mounted
weight vs the rated capacity) using the existing `totalRigWeight`, but nothing refuses an overload.

The seams are deliberately left clean for that milestone: `Chassis` already carries the resolved
`topSpeed`/`turning`/`loadCapacity`; `totalRigWeight` already sums the live load.

---

## 4. Data model (PR1, as built)

- `Chassis { size; engineMin; engineMax; topSpeed; turning; loadCapacity }` — `@common/components`.
- `PartKind` gains `'chassis'`; `PartCategory` gains `'chassis'`; `PartSlot` gains
  `'wheel-axle' | 'suspension-steering' | 'frame'`; `PartAttributes` gains optional
  `topSpeed?`/`turning?`/`loadCapacity?` (≡ 0 on non-chassis parts).
- `Recipe.chassis?: { size; cols; rows; deckY; engineMin; engineMax }` — present only on the two
  chassis recipes. `attachCapability`'s `'chassis'` case stamps `Chassis` (size + envelope from the
  recipe; the three attributes from the summed stats) **and** the deck `MountGrid` (cols/rows/deckY).
- A chassis product is special: it is not mounted onto a rig — `spawnRig` adds the rig's
  drive/world components (`Transform`/`Velocity`/`DriveControl`/`Drivetrain`/`Collider`/`Renderable`)
  onto it. It carries `Part{kind:'chassis'}` but the build controller excludes that kind from
  grabbable parts (you can't lift the rig off itself).

Scrap-tier sub-part numbers (starting strawmen, tuned later — inert except `loadCapacity`'s readout):

| Sub-part | 1×3 | 3×5 |
|---|---|---|
| Wheel & Axle Set | topSpeed 12, weight 3 | topSpeed 16, weight 7 |
| Suspension & Steering Set | turning 8, weight 2 | turning 5, weight 5 |
| Chassis Frame | loadCapacity 24, weight 6 | loadCapacity 60, weight 14 |

---

## 5. Verification (PR1)
- Headless tests (`game/src/features/chassis/chassis.test.ts`): each size composes the right `Chassis`
  + `MountGrid` + summed mass; the engine cap admits up to `engineMax` then refuses a third over a
  free cell; non-engine parts are never capped. Plus `sumPartStats` covers the new attributes.
- `npm run dev:game`: the rig spawns as a 1×3 (3-cell deck), wheels spin, the HUD shows the chassis
  section; dev-toggle `spawnRig(world, 0, 0, '3x5')` to confirm the larger deck + envelope + asset.

---

## 6. Where this connects
- Supersedes the memory decision "rig frame is single-weight placeholder until components land" — the
  chassis is now componentised (mass summed from sub-parts).
- Feeds the parked **laden-weight** milestone (the driving-behaviour + capacity seam, §3).
- Shares the tier architecture with [`part-identity-spec.md`](part-identity-spec.md) §4 (instance-tier,
  resolve-through-multiplier).
