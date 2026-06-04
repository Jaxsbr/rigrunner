# RIGRUNNER — Chassis system (spec + phased plan)

**What this is:** the design + phased implementation plan for making the **chassis** a first-class,
composed, sized part of the rig — the plan of record for the feature requested 2026-06-04. It is the
home for the whole feature; PR1 (the foundation) is built, PR2–PR3 are committed follow-ups.

> **Status:** **PR1 + PR2 are built.** PR3 is split: **PR3a** (multi-chassis ownership + selection +
> a visible deploy) is in progress; **PR3b** (the authored unfold animation) is planned — gated
> behind feeling PR3a, true to "build by discovery."

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

## 2. The 3-PR phasing

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
