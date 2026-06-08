# RIGRUNNER — Boost & Drive Balance (spec)

**What this is:** the design + implementation plan for two coupled changes: a nitro-style **boost**
mechanism, and a **drive rebalance** that tames the power curve so boost can sit on top of it without
breaking the game. They ship together because you cannot size a boost until the base curve is sane —
"any boost on a bat-out-of-hell rig makes it unrealistic." Requested 2026-06-09; designed in a
grilling session that resolved every fork below.

> **Status:** **designed, not yet built.** This is the plan of record. Numbers marked _(tune)_ are
> strawmen to be set against feel in a playtest pass — the game's pace lives in the catalog and a few
> named knobs, not in magic constants scattered through systems.

---

## 1. The problem this fixes

Today the drive curve has **no ceiling** and engines sum **linearly** (`engine.ts` →
`aggregateEngineOutput`, `drive.ts` → `rigPerformance`):

```
mobility = torque / (torque + 0.7·weight)            ∈ (0,1]
topSpeed = ΣenginePower · mobility                    ← unbounded
accel    = ΣengineTorque · mobility                   ← unbounded
```

Three felt problems all trace to that one root — **nothing caps the top end**:

1. **3×steam on an iron 3×5 with load "moves like a bat out of hell."** Three engines = literally 3×
   power and torque; iron multiplies it again. Nothing pulls it back.
2. **Compounding is too generous.** An earlier `0.4ⁿ` falloff was removed because it made engines 4–6
   a *net loss* (their tiny power gain lost to their added weight). The fix overcorrected to a flat
   linear sum. We want diminishing returns back — but *always net-positive* this time.
3. **Future tiers would look like a bug.** Tiers multiply base attributes (rusty ×1, iron ×1.8). Add
   an `alloy`/`elementium`/lvl4+ and a `3×lvl4` build's raw power climbs with no limit — the curve
   has no headroom built in.

The slow end is just as real: a **single electric on a rusty 1×3 with load** is "very slow, just
acceptable." It has nowhere to go but the bay. Boost is what gives that rig an answer.

---

## 2. Part 1 — Drive rebalance (fix the base curve first)

Four changes turn the unbounded curve into a bounded one. After this, the model reads:

```
rawPower  = diminishingSum(engine powers)            ← sublinear (§2.2)
rawTorque = diminishingSum(engine torques)           ← sublinear
mobility  = rawTorque / (rawTorque + 0.7·weight)     ← unchanged
topSpeed  = min(chassisCeiling, rawPower · mobility)  ← ceiling caps the top end (§2.1)
accel     = rawTorque · mobility                      ← uncapped; tamed by diminishing + load
reverse   = topSpeed · reverseFactor                  ← unchanged (0.5)
```

### 2.1 Chassis top-speed ceiling _(the spine)_

Each chassis caps its own forward top speed. Engines and tiers determine how **fast you reach** that
ceiling and how well you **hold it under load** (via `mobility`) — but they can never exceed it. A
lvl9 engine still can't break the map. This is the future-proofing: the curve has a built-in roof, so
new tiers fill toward it instead of climbing past it.

- **New field `Chassis.topSpeed`** (the ceiling), in `@common/components/chassis.ts`.
- **Fed from a new `topSpeed` contribution on the wheel-axle sub-part** (`PartAttributes.topSpeed`,
  summed at assembly like `grip`/`turning`/`loadCapacity`), tier-scaled — so **iron wheels = a higher
  ceiling**. This *realizes the original chassis-spec intent* (the spec's sub-part table already lists
  wheel-axle → "top speed"; it was wired as `grip`/deceleration and the speed role deferred). We are
  now wiring the deferred role.
- **The clamp** lives in `rigPerformance` (`drive.ts`): `topSpeed = min(chassis.topSpeed, rawPower ·
  mobility)`. Acceleration stays uncapped — it's tamed by §2.2 and by load, and a launch that's
  punchy-but-not-linear feels good.

The ceiling should sit **slightly above a fair, fully-built top speed for that chassis**, so it
mainly bites the over-powered / high-tier builds (the bat-out-of-hell case) without crippling an
ordinary rig. Strawman: 1×3 ≈ **14 u/s**, 3×5 ≈ **22 u/s** _(tune)_.

### 2.2 Diminishing returns on the engine sum

Re-introduce sublinear stacking — the "extra juice at a diminishing rate" — with the hard rule that
**each added engine's gain must clearly beat the weight it drags on** (the lesson from the old
`0.4ⁿ`). Use explicit, legible **marginal weights**:

```
weights = [1.0, 0.7, 0.5]      (engine 1 full, engine 2 +70%, engine 3 +50%)

1 engine : 1.00×    2 engines: 1.70×    3 engines: 2.20×
```

- Applied to **both** the power and torque sums, in `aggregateEngineOutput` (`engine.ts:39`) — the one
  place the per-attribute sum happens.
- **Order:** rank the mounted engines by total output (`power + torque`) **descending**, then assign
  weights by rank (strongest engine runs full, extras supplement). Deterministic and order-independent;
  for the common homogeneous build, order is moot.
- The third weight (`0.5`) is **defined but unreachable today** (see §2.3) — kept for any future
  larger chassis.
- Always monotonically increasing, never a net loss — reattaching this on top of the weight-mobility
  term does **not** bring back the engines-backfire, because `+0.5×` an engine's power comfortably
  beats one engine's weight.

> Implementation note: the current `engine.ts` and `drive.ts` doc-comments describe the *linear* sum
> as a deliberate, permanent choice ("more engines are now strictly more performance"). When this
> lands, **rewrite those comments to describe the new diminishing-returns reality** — state the
> present, don't leave a "we used to…" tombstone.

### 2.3 Engine cap: 3×5 → 2

Drop the 3×5 hauler from `engineMax=3` to **`engineMax=2`** (`recipes.ts` →
`CHASSIS_3X5_RECIPE.chassis.engineMax`; 1×3 stays at 1). With the ceiling + diminishing returns, this
is no longer a *balance necessity* — it's an identity choice: a laden hauler maxes at **1.7× power**,
so it often sits **below its (high) ceiling** → **"haulers are strong but never truly fast."** That
deliberate gap is exactly what gives the hauler a reason to want boost.

Capping at 2 (not 1) preserves the load-bearing multi-engine mechanics: **steering-pivot voting**
(`steering.ts` — front/rear/middle drive bias only matters with ≥2 engines to position) and the
**"stack engines to operate the chassis"** identity.

> The stale `chassis-spec.md` table lists 1×3 "1–2" and 3×5 "3–6" engines — neither matches the code
> (`1` and `3`). Update that table to `1×3 = 1`, `3×5 = 2` when this lands.

### 2.4 Shave the Iron tier multiplier

Lower the Iron mult from **1.8 → ~1.6** _(tune)_ in `shared/part-identity.ts` (`TIERS`). It was
already eased 2.2 → 1.8 in the 2026-06-07 pass to keep the rusty floor competitive; a further small
trim narrows the rusty→iron gap and pulls the iron top-end in. The ceiling (§2.1) does most of the
top-speed work now, so this is a gentle accel/reach trim, not a structural lever — keep an eye on the
floor (rusty rig must still out-pace the 4 u/s looter-camp guards).

---

## 3. Part 2 — Boost (sits on the fixed base)

A manual nitro: **hold `Shift`** for a surge of acceleration and speed that briefly punches above the
ceiling, gated by a heat gauge that must cool before reuse.

### 3.1 Form — flat additive surge _(the self-balancing core)_

Boost adds a **fixed** `+Δspeed` (lifting the effective top-speed cap *above* the chassis ceiling) and
`+Δaccel`, **identical for every rig**. Because it's flat, not a multiplier:

| Rig | Base top speed | + flat boost (e.g. +6) | Relative gain |
|---|---|---|---|
| slow electric scout (laden) | ~8 u/s | ~14 u/s | **+75% — transformative** |
| 2×steam iron hauler | ~18 u/s | ~24 u/s | +33% — a garnish |

The weaker the rig, the bigger the relative gift. This delivers "helps the slow rig a lot, doesn't
break the fast one" **mechanically**, not by hand-tuning. A multiplier would do the opposite (help the
already-fast rig most), so it is rejected.

> Plumbing: boost is a **transient** applied in the movement system on top of base `rigPerformance`,
> not baked into `rigPerformance` itself (which stays the pure base the HUD reads). The flat `+Δaccel`
> ensures even a low-power rig surges — the surge does not depend on the rig's own power to feel.

### 3.2 Heat model — continuous gauge

One **0–100 heat** value on a new `Boost` component, driven by a `boostSystem`:

- **Hold `Shift`** (and not overheated) → boost active → **heat fills fast**.
- **Release** → **heat drains slow** (fill rate > drain rate, so you cannot boost forever).
- **Redline to 100 → OVERHEAT:** boost cuts out and is **hard-locked until heat cools all the way back
  to 0.** Greedy holding earns a long forced cooldown.
- Below redline you can **feather it** — tap-tap for near-continuous short bursts, riding the edge.
  This is the skill expression.

### 3.3 Engine-type identity — compensation, not amplification

Each type's boost **patches its weakness** rather than doubling its strength:

| Type | Profile | Surge | Heat fill | Why |
|---|---|---|---|---|
| **♨ Steam** | **strong-short** | big | fast → short | Its weakness is *top speed* (ceiling-capped, "strong but never fast"). A violent short burst lets it briefly **smash through its speed ceiling**. A boiler venting overpressure *is* a sudden violent release. |
| **⚡ Electric** | **weak-long** | mild | slow → long | It's already fast (high power) but accelerates poorly and runs light. A long mild trickle helps it **hold and build speed over distance** — a capacitor sipping out a sustained hum. |

One clean relationship makes this fall out: **heat-fill-rate ∝ surge magnitude.** Big surge (steam)
fills heat fast → short; mild surge (electric) fills slow → long. Both deliver a **similar total
boost per overheat cycle** — equal budget, opposite shape (spike vs sustain).

- **Data swap:** the catalog `burst` values are currently backwards for this (e-regulator `burst=4` >
  s-throttle `burst=3`). Swap so **steam carries the larger burst** (e.g. s-throttle `burst=6`,
  e-regulator `burst=3`) _(tune)_, or read surge magnitude from per-type boost constants. Either way
  the field is no longer a reserved placeholder — it becomes the boost's surge input.

### 3.4 Scaling — flat per rig, by engine type only

Boost magnitude is a property of the **engine type only** — **not** multiplied by tier, **not** by
engine count:

```
rusty scout : steam surge = +6        iron hauler : steam surge = +6
lvl4        : steam surge = +6        lvl9        : steam surge = +6
```

Tier and count improve your **base** (ceiling reach, mobility, accel); boost is a **separate
equalizing layer** on top, **bounded forever**. A lvl9 boost equals a rusty boost, so boost can
**never** become the "3×lvl4 looks like a bug" problem, and it reinforces the §3.1 self-balancing
(strong rigs don't get bigger boosts). A rig needs ≥1 engine to boost (no power = no boost); the
profile comes from the rig's engine type.

### 3.5 Cost — heat only

Boosting costs **no scrap and no fuel.** The heat gauge is the entire limiter. Keeps the system
self-contained and respects "complexity earns its place" — no new economy axis.

### 3.6 Steering during boost — emergent

No special-casing. Because `yaw = steer · speed / turnRadius`, the speed surge **naturally widens
turns** mid-boost, so boost becomes **"commit to a straighter line"** — a real speed-vs-maneuver
tradeoff, on-theme, zero new code. Players learn to boost on straightaways.

### 3.7 Input, edge cases, feedback

- **Input:** hold **`Shift`** (free — controls are `w/s/a/d` + a `work` action). Add to the
  `DriveIntent` (`@common/input/drive-input.ts`) as a `boost: boolean`.
- **Forward only:** boost applies when `throttle > 0`; ignored in reverse / at rest.
- **HUD:** a **heat bar** in the stats HUD (`features/hud`) that fills as you boost and **reddens near
  / at overheat** (locked state visibly distinct). The HUD remains a pure projection of state.
- **Juice (felt feedback):** a boost **visual** while active — exhaust flare / speed lines / a brief
  FX kick — so the surge is something you *see*, not just a number. Detail for the build.

---

## 4. Implementation map (seams)

| Change | File(s) |
|---|---|
| `Chassis.topSpeed` ceiling field | `@common/components/chassis.ts` |
| `PartAttributes.topSpeed` on wheel-axle; sum at assembly | `@common/parts/parts-catalog.ts`, assembly |
| Ceiling clamp on top speed | `@features/drive/drive.ts` (`rigPerformance`) |
| Diminishing-returns marginal weights `[1.0,0.7,0.5]` | `@features/engine/engine.ts` (`aggregateEngineOutput`) |
| 3×5 `engineMax` 3 → 2 | `@common/parts/recipes.ts` (`CHASSIS_3X5_RECIPE`) |
| Iron mult 1.8 → ~1.6 | `shared/part-identity.ts` (`TIERS`) |
| `burst` swap (steam > electric) | `@common/parts/parts-catalog.ts` (`PART_ATTRIBUTES`) |
| `Boost` component (heat, active, locked) | new, `@features/<boost>/` |
| `boostSystem` (heat fill/drain/overheat, reads input + engine type) | new, `@features/<boost>/` |
| Apply flat surge on top of base perf | `@features/drive/movement.ts` |
| `boost: boolean` on intent | `@common/input/drive-input.ts` |
| Heat bar + boost visual | `@features/hud`, render |
| Rewrite stale linear-sum comments; fix chassis-spec table | `engine.ts`, `drive.ts`, `docs/specs/chassis-spec.md` |

Boost is a new mechanic → a **new `features/<boost>/` folder** (per ADR-003), created when its code is
written, with its component + system + HUD bit + tests co-located.

---

## 5. Tuning table (open numbers — set against feel)

| Knob | Strawman | Notes |
|---|---|---|
| 1×3 ceiling | 14 u/s | just above a fair fully-built top speed |
| 3×5 ceiling | 22 u/s | hauler can approach but rarely hit it laden |
| marginal weights | `[1.0, 0.7, 0.5]` | each step must beat its engine's weight |
| Iron mult | 1.6 | from 1.8; watch the rusty floor vs 4 u/s guards |
| steam surge (Δspeed) | +8 u/s | strong-short |
| electric surge (Δspeed) | +4 u/s | weak-long |
| Δaccel | proportional to Δspeed | flat, per type |
| heat fill (steam) | to 100 in ~1.5 s | short |
| heat fill (electric) | to 100 in ~4 s | long |
| heat drain | full in ~3 s | slower than fill |
| overheat re-arm | heat = 0 | hard lockout until fully cool |

Total boost-per-cycle should land **similar** across the two types (spike vs sustain), per §3.3.

---

## 6. Acceptance / feel targets

- **Slow rig redeemed:** single electric, rusty 1×3, laden — base stays modest, but a held boost is a
  *transformative* sustained lift. The "nowhere to go but the bay" frustration gets an answer.
- **Fast rig tamed:** 2×steam, iron 3×5, laden — strong but **never bat-out-of-hell**: the ceiling
  caps top speed, diminishing returns + cap-2 hold power to 1.7×, iron is trimmed. Boost is a brief
  violent garnish above the ceiling, not a license to fly.
- **Future-proof:** a hypothetical 3×lvl4 build is strong and reaches its ceiling reliably under load,
  but **does not look like a bug** — top speed is ceiling-bounded and boost is tier-independent.
- **Boost reads by type:** steam = a punchy short kick; electric = a long mild push. Overheating feels
  like a self-inflicted mistake; feathering feels skilful.

---

## 7. Deferred ideas (captured, not committed)

- **Boost burns cargo scrap** — a "do I burn my loot to escape?" tradeoff, very on-theme, but a new
  economy axis. Logged to `docs/ideas.md`; add only if play asks for it.
- The unreachable **third marginal weight** (`0.5`) anticipates a future larger chassis.

---

## 8. Decision log (grilling outcomes, 2026-06-09)

1. **One spec, two parts** — boost can't be sized before the base curve is fixed.
2. **Power-curve taming = chassis speed ceiling** (over diminishing-only / hard-cap-only). + shave Iron.
3. **Diminishing returns shape = explicit marginal weights** `[1.0, 0.7, 0.5]`.
4. **3×5 engine cap → 2** ("strong but never fast" hauler identity; keeps multi-engine play).
5. **Boost form = flat additive surge** (self-balancing; multiplier rejected).
6. **Heat model = continuous gauge** with redline → hard overheat lockout (ride-able below redline).
7. **Type identity = compensation:** steam strong-short, electric weak-long (swap `burst` data).
8. **Boost scaling = flat per rig, engine-type only** (tier/count-independent; bounded forever).
9. **Cost = heat only** (no scrap/fuel).
10. **Steering = emergent wider turns** (no special-casing).
