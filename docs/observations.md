# RIGRUNNER — Observations

A running log of things we *notice* while building the game — what makes the
loop feel good, what feels wrong, and the small details that turned out to matter
more than expected. The whole project asks "is the loop fun?"; this file is
where the answers accumulate.

Each entry: what we observed, why it matters, and (if acted on) what we did.

---

## 1. Tactile feedback on the grab/snap is load-bearing

**Context:** Build bay (Section A) — grabbing a part and dragging it toward a slot.

**Observation:** The *visual feedback during the drag* matters a lot — far more than
expected for "just" a build menu. Two things in particular:

- **A real shadow under the dragged part.** A shadow cast straight down onto the
  surface beneath the part gives an immediate, tactile sense of where the part *is*
  in space. Without it, a part floating in a 3D scene is ambiguous — you can't tell
  why a given cell is the one that will accept it. The shadow grounds the object and
  makes the snap target make sense to the eye. (Note to self: a shadow must be
  *underneath the object*, not a marker drawn in the target cell — those are
  different things and only the former reads as "this object is here.")
- **Small, fast animations on pick-up and put-down.** Animating the part rising when
  grabbed and gliding into place when dropped — even at ~140–180ms — changes the feel
  from "data structure being edited" to "thing being handled." The *speed* of these
  animations matters: too slow feels sluggish, instant feels like teleporting.

**Why it matters:** This is the "physical composition" pillar from the design doc.
The build bay is only fun if it feels tactile, and tactility here is bought almost
entirely with these micro-feedback details, not with the underlying logic.

**Takeaway:** Pick-up/put-down feedback (shadows + short, well-tuned animations) is an
area worth deliberate effort and love, not a polish afterthought. Budget time for it.

---

## 2. Steering needs speed-scaled effectiveness, not a binary on/off

**Context:** Driving (Section B) — steering the rig with A/D.

**Observation:** Gating steering on "is the rig moving" is correct and expected. But the
*amount* of steering available is wrong at the low end: you can turn extremely sharp on
the faintest sliver of forward movement, and then the instant forward motion stops, the
turn cuts dead too. Both the forward motion and the steering halt abruptly — it feels
unnatural. Sharp turning *at speed* is fine and even desirable (reads as a tracked /
chain-driven vehicle, not wheeled). The problem is purely the abrupt all-or-nothing
transition near zero speed.

**Why it matters:** Driving is half the loop. Abrupt, binary transitions read cheap;
the rig should feel like it has mass and traction.

**Action taken:** Steering effectiveness now ramps with speed (smoothstep up to a
"full-authority" speed) for both forward and reverse, so it fades in/out smoothly
instead of snapping. Sharp-at-speed is preserved.

**Follow-up (2026-06-06) — the ramp wasn't enough; switched to a turning-RADIUS model.**
The smoothstep "authority" ramp faded turning in near zero speed, but above the full-authority
speed it set a fixed *angular* rate (rad/s) decoupled from how fast the rig actually travelled. So
the *turning radius* (speed ÷ yaw) collapsed to roughly a rig-length and the rig still spun nearly
on the spot — "super turn on the spot" in play. Lowering the rate only widened the pivot a little; it
never reconnected rotation to motion.

The fix is a **turning-radius model** (`features/drive/movement.ts`): `yaw = steer × speed ÷ turnRadius`.
Rotation is now *proportional to forward speed*, so the rig always **arcs through a circle of fixed
radius** like a real vehicle — standing still it can't turn at all (the speed-gate falls out for free),
faster just travels that same circle quicker, and reversing flips the arc. The radius comes from the
chassis's suspension `turning` stat, tier-scaled in `chassisToRig` (tighter = sharper), floored at
`TURN_RADIUS_MIN` so even a high tier still arcs instead of pivoting. A 1×3 traces a 6.4-unit circle
rusty, 4.4-unit iron. (`Drivetrain.turnRadius` replaced the old `turnRate`/`turnFullSpeed`.) The
"sharp-at-speed reads as tracked/wheeled" intuition above still holds — but the radius is now
consistent across the whole speed range, which is what actually removes the pivot.

---

## 3. Parts read as random blocks on a slab — adjacency should *connect*

**Context:** Build bay — parts slotted on the 3×3 platform.

**Observation:** The 3×3 platform is fun, but the parts currently look like unrelated
blocks parked on a big flat slab. The thing it *wants* to be is **connected**: when two
components sit next to each other, the seam between them should resolve into something
that reads as "one machine." The mental model is seamless tile blending in a 2D tiling
game (grass→sand with no hard seam) — but here we have real 3D components, so it takes
actual geometry/styling work, not a texture trick. One promising direction: make it a
*style* statement — e.g. a futuristic rig where adjacent parts auto-connect with pipes,
cabling, or circuitry that bridges the gap; greebles that span the seam.

**Why it matters:** Directly serves the "physical composition" pillar — the rig should
feel like a coherent body you're assembling, not a tray of loose objects.

**Status:** FUTURE — real art/styling, not near-term scope. Logged now so we design
toward it (slot adjacency data, seam-bridging hooks) rather than against it.

---

## 4. Camera wants smooth zoom-out and an adjustable tilt

**Context:** Driving / viewing the field.

**Observation:** The camera angle is sufficient to see by, but it sits a touch too
close, and there's no way to see more of the surroundings. Wants:
- **Zoom out** a bit more to take in more of the field — but **not** closer than the
  current distance (current = the closest we want).
- **Tilt** the angle to hover a little more above (middle-mouse drag up/down) — not a
  full 90° top-down, just somewhat more overhead than the current view.
- Critically, **all camera motion must be smooth/animated** — no jerky or instant
  changes. Instant camera moves feel cheap.

**Why it matters:** Being able to read the field is table stakes for the run half of the
loop, and camera smoothness sets the perceived production quality of everything else.

**Action taken:** Wheel zooms out only (current distance is the floor); middle-mouse
vertical drag tilts pitch within a clamped range (current angle → a bit more overhead);
both ease toward their targets each frame rather than snapping.

---

## 5. Harvesting should be a player *command*, not proximity auto-harvest

**Context:** Harvesting (Section C) — first pass auto-harvested whenever the rig was
near a node.

**Observation:** Auto-harvest-on-proximity feels passive and wrong for this kind of
game. Players expect to *issue a command* to engage harvesting — it should be a
deliberate act, not something that just happens because you parked nearby.

**Why it matters — and the big one:** Making harvesting a *held* command (vs a toggle
or a one-press auto-drain) creates the central tension for **flee-or-fight** (Section E):
to harvest you must commit — parked, exposed, hands occupied — while threats close in.
"Top off the container or bail now?" is precisely the felt decision the game is built
around. A toggle or auto-drain throws that tension away.

**Action taken:** Harvesting now requires **holding** a command (`E` or left-click) while
in range. Release stops it. The harvest beam only shows while actually engaged.

---

## 6. "Any number of containers" is a real subsystem — so we first faked it with one number

**Context:** Harvesting with a variable number of containers. Symptom: "harvesting
doesn't work with one container." Root cause was NOT container-count logic (that was
fine) — it was the absence of any **run-lifecycle / state model**: nodes never
regenerated (a session "used them up"), and per-container fill persisted, so a
re-slotted container could be silently full next to already-drained nodes.

**Observation (the meta-point):** Supporting "any number of containers, connected,
filling correctly" *properly* is genuine systems work — an inventory/capacity
subsystem with its own state, persistence, and lifecycle. Trying to grow that
incrementally inside a throwaway early sketch is painful and bug-prone, and the pain
is a signal: that sketch is being asked to carry weight it isn't architected for.

**Why it matters:** This is the central tension of early exploration. The fix is almost never
"add the missing architecture" — it's to find the *dumbest model that still proves the
loop* and use that, explicitly deferring the real subsystem until it earns its place.

**Action taken — simplify, don't architect:**
- **Cargo is a single shared scalar pool** (`scrapHeld`) vs a capacity that's just
  `(# slotted containers) × CONTAINER_CAP`. Containers became a pure *view* that fills
  in order from the pool. One source of truth ⇒ "any number of containers" is correct
  by construction and "fill one-by-one" is free, with *less* code, not more.
- **A reset key (`R`)** respawns nodes and empties cargo, so the sandbox is re-testable
  (the missing "run lifecycle", faked).
- **A cargo readout in the HUD**, so world state is never an invisible mystery again.

**Takeaway:** the game DOES need a cargo/inventory subsystem and an
explicit run lifecycle (start / spend / return / reset). The early sketch proved we want
them; it did not pretend to be them. (Per-vessel storage is now implemented — see #7.)

---

## 7. The shared-pool model's seam: containers don't carry their own contents

**Context:** Immediately after #6's single-pool simplification — moving partly/fully
filled containers around the rig.

**Observation:** Because cargo is one shared scalar and containers are only a *view*
that fills in slot order, containers have no individual contents. Consequences a player
sees: take a full container off a rig that also has a partial one, and the partial one
appears to "absorb" the scrap (the pool just re-renders across fewer containers); move
a container off the rig entirely and it reads as empty (its share returns to the pool /
is dropped when capacity shrinks). Nothing is *preserved per container*.

**Why it matters:** This is the precise cost of that early shortcut. The *real* game
clearly wants each container to be a vessel that holds and preserves its own scrap
whether it's on the rig, on the floor, or being carried — which means per-container
state, transfer rules, and capacity bookkeeping that survive slot/unslot. That is
exactly the inventory subsystem #6 deferred.

**Decision:** Not worth fixing in the early sketch — it didn't change whether the *loop*
is fun, which was all that mattered to prove first. Banked as a requirement (now
implemented): **containers are stateful vessels that preserve contents on and off the machine.**

---

## 8. The build/drive *mode* was accidental complexity — a symptom of a math shortcut

**Context:** Re-fitting felt clunky: a BUILD/DRIVE toggle, the rig snapping straight on
return, and parts placing awkwardly when the rig was rotated.

**Observation:** All three were one root cause. The build-bay placement math assumed the
rig sat at the origin facing forward (so "world x/z == deck x/z"). To keep that
assumption true I needed a *mode* and a "home the rig straight" step on entry — and
parts could only be reasoned about in world axes, so a rotated platform placed them
wrong. The mode wasn't a design choice; it was scaffolding holding up a shortcut.

**Why it matters:** Players felt the scaffolding directly (the toggle, the reset, the
awkward placement). Worth remembering: clunky UX is often a *leak* of an internal
shortcut, not an independent UX problem — fix the internal model and the UX symptoms
vanish together.

**Action taken:** Placement now computes in the rig's **local frame** (`worldToLocal`),
so it's correct anywhere at any rotation. With that true, the mode dissolved entirely:
driving is always live, parts can be re-fitted any time, dropped parts orient to the
deck (animated, not snapped), and nothing ever resets the rig's rotation. The workshop
pad became a **safe zone** (the enemy can't touch you while you're on it) instead of a
mode trigger — keeping the "return home to re-fit in peace" beat without a toggle.

---

## 9. The recipe picker works for two recipes but won't scale to many

**Context:** Workshop interface (MW / PR P3). The bench was made **recipe-driven**, and a second
buildable (the **storage container** — shell + rim) was added beside the engine to prove the bench
isn't engine-shaped. Recipes are surfaced as a **row of "tab" buttons** above the bench slots.

**Observation:** A flat horizontal tab strip is fine for **two** recipes and is **acceptable in its
current state** — but it clearly won't scale. As recipes multiply (per-output recipes, tiers, and
especially the future *loot-drop special recipes* — see `ideas.md` 2026-06-01), a single row of tabs
becomes unreadable and unusable. A more robust selector is needed: a searchable / categorised /
scrolling list that can **group basic vs special** recipes and survive dozens of entries.

**Why it matters:** recipes are set to grow, and the selector is the seam that has to absorb that
growth. Naming the limit now means we replace it deliberately rather than discovering it the hard way.

**Status:** ACCEPTED FOR NOW — ships as a tab strip. Flagged to replace with a scalable recipe
selector once recipe count grows past a handful. Not built yet.

---

## 10. The workshop interface is dense and clunky — usable, but text-heavy and confusing in places

**Context:** The workshop overlay after Option C shipped (inventory rail + Bench / Workshop Deck /
Parts Shop tabs + inspect pane). Reflecting on actually *using* it across a few build/buy/assemble
sessions.

**Observation:** It works, and once you've learned it it's fine — but the learning curve is steeper
than it should be, and several things grate:

- **Too much to read to know what you're looking at.** There's a lot of text and not enough visual
  signal for *what is a part vs a recipe vs the current selection*, and *where* each thing lives. You
  parse labels instead of recognising shapes.
- **The Bench is the weakest spot.** Specifically **recipe selection** and the fact that the bench
  **shares its preview with the selected inventory item** — selecting an inventory part vs. picking a
  recipe to build both drive the same area, and it's confusing which mode you're in.
- **Sub-parts have no assets**, so their chip/portrait is a tinted placeholder and **text is the only
  way to tell them apart** — which compounds the density. Real (even grey-box) sub-part GLBs would do
  a lot of the disambiguating work the text is currently forced to do.
- **The UI truncates names to fit**, so the one channel we *do* lean on (text) is itself clipped —
  e.g. "Unearthing …" — making it even harder to read at a glance.
- The **Parts Shop** needs a little work; the **Workshop Deck** is fine; the **inspect pane** is okay.

**Why it matters:** the workshop is half the game (the "build" of build→run) and a load-bearing
**physical composition** surface. If reading it is work, the tight cause-and-effect beat the whole
game runs on gets muddied at the exact moment the player is forming their "I know what to change"
thought. This is the kind of clunk that (per observation #5) is often a *leak* of an internal model
issue, not just surface polish — worth a deliberate pass, not a quick re-skin.

**Status:** NOTED — not yet a committed work item. Threads to pull when we do a workshop-UX pass:
clearer part/recipe/selection affordances, separating "pick a recipe to build" from "inspect a
selected part", a no-truncation layout, and **real sub-part assets** so shape (not text) carries
identity. The recipe-selector limit in #9 is part of the same pass. Pairs with the part-naming /
rarity-visual-cues rebrand idea (see `ideas.md` 2026-06-03).

**Follow-up (2026-06-06) — the workshop friction is now a direct loop problem.**
Jaco's play feedback sharpened the issue from "dense" to "annoying to use":

- Building a product requires manual drag-and-drop into every bench slot even when the right parts are
  already owned; the bench should be able to auto-fill/build from available parts, with manual dragging
  reserved for deliberate mixed-tier/custom builds.
- Buying parts is hard to scan. The shop does not visually guide the player toward the part needed for
  the active recipe; finding the right item depends on reading small text carefully.
- Tier choice is too easy to miss. The active tier selector lives above the list, and it is easy to buy
  the wrong grade because the whole shop silently reprices/regrades around that toggle.
- Moving a finished product between inventory and the world is buried behind the Workshop Deck tab; if
  the player is elsewhere in the overlay, that extra tab switch feels like interface work instead of
  workshop work.
- The overlay still reads like generic dark HTML: functional, but visually out of step with the game's
  scavenged-machine / tactile rig-building vibe.

**Implication:** the next workshop-UX pass should not be a cosmetic skin. It should reduce required
drags/clicks, make recipe needs and tier choices visible before purchase, expose world staging from any
workshop context, and use the existing 3D part/deck/portrait path as the primary visual language.

---

## 11. Adding engines made you *slower* — two damping algorithms compounding

**Context:** Drivetrain / engine output, before the felt-weight feature. Bolting more engines onto a
rig past ~3 reduced its top speed and acceleration instead of raising them.

**Observation:** With **zero cargo**, a 4th–6th engine of *either* type was a net loss. The cause was
two algorithms stacking, fed by engine self-weight:

1. **`aggregateEngineOutput` summed engines on a `0.4ⁿ` falloff** → total output capped at ~1.67× a
   single engine, no matter how many you bolted on (geometric series).
2. **`rigPerformance` scaled everything by** `mobility = torque / (torque + 0.5·weight)`.
3. **Every engine is a mounted part with full `Weight`** (electric 4, mechanical 8) on top of the
   chassis's 10.

So output **plateaued** (1) while weight **climbed linearly** (3) → mobility fell (2) → past the peak
each engine *subtracted*. Measured on an all-electric rig: top speed peaked at **3 engines (~10.8)**
and by **6 engines (~9.5)** had dropped below the 2-engine figure. The electric-vs-mechanical
difference was *also* masked — the profiles already encode it (electric 13/8, mechanical 8/19); the
algorithm just hid it.

**Why it matters:** It directly contradicts the **build → run → build-better** loop — "bolt on more
drive" must feel *more powerful*, not punish you. And because it bit with **no cargo**, it couldn't be
explained to the player as weight; it just read as the game being broken. Classic observation-#5 leak:
clunky feel was a symptom of an internal model (two damping curves), not a surface issue.

**Action taken (milestone MD):** ripped out both algorithms. Engines now sum **linearly** (six give
the most) and **engine output IS performance** (top speed = power, acceleration = torque) with no
weight penalty. **Weight is parked** — `totalRigWeight` stays as the seam the felt-weight feature
(Option A) reattaches to. The electric/mechanical contrast now reads straight from the profiles:
electric tops faster, mechanical accelerates harder. Side effect to tune: absolute speeds rose (the
old mobility was secretly ~halving them); per-engine catalog `power`/`torque` are the knob for final
feel.

---

## 12. A flat tier *tint* reads clearly — but a built part should look like the parts it's made of

**Context:** MP **Phase 1** tiers ([`part-identity-spec.md`](specs/part-identity-spec.md)). Each part wears a
tier finish: a loose part, and each rendered sub-asset of a composed product, is washed toward its tier's
colour (rusty → brown, iron → grey). Tested on the Reclaimer, whose product renders as two real assets —
the arm and the bucket on its wrist socket.

**Observation:** The flat tint **works and reads well**. Rusty vs iron is obvious at a glance on chips,
portraits, and world models, and on the Reclaimer you can see an **iron arm beside a rusty bucket** —
the per-piece grade comes straight through. It was cheap to build and it gives the tier system a real,
felt visual.

But the tint is a **stopgap**, not the target. Where a product is **one GLB standing in for several
parts** (the engine = `engine-mk2`, the container = `storage`), a *mixed-tier* build has no single grade,
so that lone model just shows its default colours — you can't see that it's made of differently-graded
pieces. The thing I actually want: a built product that **looks like the parts it's composed of** — each
sub-part its own model, positioned and scaled inside the whole, each wearing its own tier finish, so you
read the build's bill-of-materials straight off the model (an open engine *frame* with iron + green-metal
internals visible through it). See the **2026-06-05** ideas session for the full target.

**Why it matters:** "you can see your whole build in the visuals of the parts" is, per Jaco, a really
important part of the game — it's the **physical-composition** pillar applied to a product, and the
top rung of the §3 tier-visual ladder. The Reclaimer proves the direction; the engine is the same idea
with more pieces.

**Action taken:** none yet — **deliberately**. The flat tint is the accepted current rung (easy, ships
progression). The per-sub-part composed visual is a later **art-pipeline** activity: it needs a model per
sub-part and an authored interior layout (where each piece sits, at what scale) for every product, plus a
direction for what a composed engine should even look like. The render seam already resolves a tier *per
sub-asset* (`assetTier` / `productTints`), so the data path is ready when the assets + layout exist;
until then a tinted placeholder block for a missing sub-part asset is fine. Continues observation **#3**
(parts read as random blocks; adjacency should *connect*).

---

## 13. Ramping the steering input — "turning acceleration" — is a surprise unlock

**Context:** Driving (Section B) — applying a hard turn while running down a straight line, on top of
the turning-radius steering model (the #2 follow-up).

**Observation:** With the radius model the rig already *arced* like a vehicle, but the **application**
of the turn was instant: slam A/D and the steer input jumps 0→full in one frame, so the rig snaps into
the arc. Easing the *applied* steer toward the input over a short ramp instead — so the turn **builds
up** and eases back out — was a disproportionately large improvement for how small the change is. It
reads as the rig **leaning into** the turn, as if the wheels/tracks have to be turned before they bite.
Jaco: "a super unlock for a unique driving mechanic." It's the steering analogue of throttle
acceleration — turning now has its own *acceleration*, not just a rate.

**Why it matters:** Driving is half the loop, and this is cheap weight on the controls that makes the
rig feel like it has mass and a real steering linkage rather than a turret on a swivel. Crucially it
**composes** under everything already there — ramp → turning-radius arc → engine-set pivot all stack —
so it deepens the feel without fighting any of it. It also hands us a new **tuning surface** (and a
candidate build-axis): *how fast a rig's steering bites* is now a feel we own.

**Action taken:** `features/drive/movement.ts` ramps an `appliedSteer` toward the raw `steer` input at
`STEER_RAMP` per second (≈0.33 s straight→full lock); the yaw + engine pivot use the ramped value, not
the raw key state. Stored as a sim-managed `appliedSteer` on `DriveControl` (input still writes only the
raw `steer`). One global constant for now — deliberately simple, because this wants more play.

**Open directions (more exploration + tweaking likely):**
- **Tune `STEER_RAMP` to feel** — 3/s is a first guess; lower reads heavier/lazier, higher snappier.
- **Make it a chassis/tier axis** — a better suspension could bite *faster* (shorter ramp), the way tier
  already tightens turn radius and braking. Steering *responsiveness* as a third handling stat.
- **Asymmetric ramp** — a different ramp-in vs ramp-out (e.g. quick to release, slow to commit) may feel
  better than the symmetric rate used now.
- **Weight coupling** — a heavy, laden rig could ramp its steering in more slowly (steering inertia),
  tying handling response to the central weight pillar.
- **Drift/slip potential** — a ramped steer is the natural seam for a momentum/counter-steer feel later,
  if play ever asks for it.

---

## 14. The starter rusty rig was too slow to *fight* — pace vs. the reference (Machine Mind)

**Context:** First playtest of looter camps (Phase 1) — driving a starting rusty rig (rusty engine +
rusty chassis) out to a camp to clear it. Compared against a screen-recording of **Machine Mind** (the
reference game) and the actual drive/camera code.

**Observation:** Two things made our combat feel sluggish where Machine Mind felt fluid:

1. **The rig couldn't out-pace the enemies it was meant to overrun.** Camp guards reposition at
   **4 u/s**. A *combat-configured* rusty rig (chassis + electric engine + the weapon) topped out at
   **~3.8 u/s** — *below* the enemies. So when a ranged guard backed off, the rig closed at ~0 (or
   negative when laden): you literally could not catch one to ram it. The arithmetic, not perception:
   `topSpeed = power × torque/(torque + 0.7·weight)`, and bringing the weapon's weight pushed mobility
   below the enemy's speed.
2. **The tier gap amplified it.** With iron's mult at 2.2, `iron = base × 2.2`, so any base-pace bump big
   enough to make rusty playable would have ballooned iron. The *starting* tier was the worst-feeling one.

What Machine Mind does (from the footage): a **tight, close camera** (the machine is a real on-screen
object, ~1/12 of width; you read your machine + nearby enemies clearly), and a machine that **clearly
out-runs the threats** and **fires while repositioning**. Kiting is easy because the machine is *fast and
legible*, not because the enemies are weak.

**Why it matters:** The flee-or-fight pillar needs the rig to actually be able to flee OR fight — and
"overrun by driving in" only works if the rig out-paces the enemy. A starter rig that can't is a dead end.

**Takeaway / what we did (2026-06-07):** Lifted the engines' base pace (electric 11/7 → 15/10, steam
7/16 → 10/22 — profiles + the weight-feel preserved; `WEIGHT_DRAG` untouched, so weight still bites) so a
combat rusty rig tops **~6.4 u/s** (laden ~4.7), comfortably above the 4 u/s guards. Eased iron's mult
**2.2 → 1.8** so the lift didn't balloon iron — the rusty→iron *gap* narrowed (the upgrade is still
clearly worth it) rather than the whole band sliding up. **Camera left as-is** (its zoom range already
mirrors Machine Mind's; a *speed-based auto-zoom* — out while moving, in while settling — is a captured
idea for later, not done). Open question for a later pass: whether turn-radius (handling) also wants a
tighter base for kiting, or whether the higher top speed already supplies enough turn *rate*.

---

## 15. The draw is culled for free; the bookkeeping isn't — and the ground can't be cut

**Context:** Asked "before enlarging the map, does the code only render what's in view?" — investigated the
render layer against the live code (2026-06-08).

**Observation:** The answer splits cleanly down the GPU/CPU line, and it's worth holding onto before any
map-enlargement work:

- **GPU draw side — handled, for free.** Three.js defaults `frustumCulled = true`, the code never disables
  it, and **every entity is its own `Object3D`** added straight to the scene (`entity-views.ts:52-56`). So
  off-screen entities are already skipped from the draw with zero culling code of our own. That separate-node
  design is the thing that makes real culling cheap to add later — nothing is merged into one giant mesh.
- **CPU side — not handled.** Every per-frame scan walks **all** entities regardless of visibility: the
  entity↔object sync (`entity-views.ts:38-64`, runs every frame for every entity), the picker, and collision
  (`collision.ts:29-30`, O(n²) — and *already* self-flagged for a spatial grid). Frustum culling saves the
  draw, not these loops.
- **Terrain — monolithic.** The ground is one 80×80 `PlaneGeometry` with a single baked texture
  (`stage.ts:61-71`). Fine as one draw call today; impossible to stream or chunk-assemble.
- **Camera far plane is wide (1000)** so distance alone never culls; only the frustum sides do. **Decals:**
  tracks are capped (640); stains scale linearly with entity count.

**Why it matters:** None of it bites at today's ~150–200 objects, so it's invisible right now — but the CPU
scans and the single ground mesh are exactly what a several-times-larger or procedurally-chunk-assembled
world (guidance §1) would make the bottleneck. Naming it now means we enlarge the map *deliberately*,
starting from a culling-ready position, rather than discovering the per-frame cost scaling with the whole
world the hard way.

**Status:** NOTED — work mapped, not started. The phased plan (spatial index for the scans first, then
chunked/streamable terrain sharing the chunk grain, then bounding decals; LOD/occlusion deferred) lives in
[`specs/render-scaling-spec.md`](specs/render-scaling-spec.md). It's infrastructure that **serves** the
**Hybrid chunk-assembly world** milestone (guidance §1), not a player-facing feature.

---

## 16. Looter camps land — the flee-or-fight content feels done

**Context:** A play session after the looter-camps Phases 1–3 shipped (PRs #55–#57) — driving out,
engaging/evading a camp, clearing it, and arming/disarming the trap. *(Captured 2026-06-08; landed late —
its branch was parked.)*

**Observation:** Camps **feel done** as a system. They're functional, they **look decent**, they're
**properly clearable**, and the **trap is genuinely designable** (arm/disarm reads as a real puzzle, not
a flag flip). As a content + **flee-or-fight** pillar this is the first thing in the game that gives the
rig a real reason to fight or run, and it delivers.

**Why it matters:** It's a positive baseline to build on rather than a problem to fix — worth recording
so we don't accidentally re-open what already works. The *remaining* camp work is additive (Phase 4 more
camp levels + the scaling-enemy hook, and the restoration investment that consumes the `RestorableSite`),
not corrective.

**Status:** GOOD — no action. The shipped camp loop is a keeper. *(Since capture, the restoration
investment has begun consuming the `RestorableSite` — the stump-healer, `features/restoration/`.)*

---

## 17. The build has no balance and nothing is gated behind progression yet

**Context:** Reflecting on the workshop / parts economy across build sessions. *(Captured 2026-06-08;
landed late — its branch was parked.)*

**Observation:** Rig and part building **isn't balanced in any way**. Parts are simply *available*, and a
handful have enough scrap behind them to buy — but there's no real cost curve, no power balance between
options, and **nothing is gated behind progression**. You're not earning your way *up* anything; the
catalog is just open. This is fine for proving the loop (and was the right shortcut to get here), but it's
clearly a placeholder, not a designed economy.

**Why it matters:** The "I know exactly what to change" loop only has teeth if upgrades are *meaningfully*
ranked and *earned*. Without balance, choices don't trade off against each other; without gating, there's
no progression spine for them to climb. This is a load-bearing system that's still entirely stubbed.

**Status:** NOTED — a known gap, not yet a committed work item. *(Since capture, the answer's shape has
firmed considerably: the 2026-06-10 session produced the **progression spine** and the phased plan in
[`specs/real-world-and-progression-spec.md`](specs/real-world-and-progression-spec.md) — Phase 0, the
game/sandbox split + persistence, has shipped; Phase 2 is where this balance/gating gap gets closed.)*

---

## 18. Nothing happens under the wheels — a cheap, absent feel-win (terrain track marks)

**Context:** Driving the rig around the field, watching what the ground does in response. (Nothing.)
*(Captured 2026-06-08; landed late — its branch was parked.)*

**Observation:** Anything that moves on wheels or tracks **leaves no mark on the terrain.** There's no
trace that you drove somewhere — the ground is inert under the rig. This is a **small** thing that would
add a **lot** to the feel (driving should *write* on the world, even faintly), and it's **completely
missing**. The fix is cheap: we already lay **fading radial ground decals** for scrap seepage and camp
mess (`features/scrap/scrap-stains.ts`, `features/camps/camp-stains.ts`) as zero-coupling render-layer
collaborators — a track-layer is the same pattern, a trail of fading decals dropped behind the rig off
the drive movement seam.

**Why it matters:** Driving is half the loop, and a moving machine that leaves no impression reads cheap
— the world doesn't acknowledge you're there. It's also the **concrete visual seed of world restoration**:
per `world-progression-guidance.md` §3a, the mark eventually becomes an earned, part-/resource-fed
**life-trail** that *greens* the ground. So the same surface buys near-term feel *and* opens the door to
the restoration through-line.

**Status:** DONE — shipped since capture, exactly as sketched: tread trails landed via
[`specs/track-marks-spec.md`](specs/track-marks-spec.md) (`features/tracks/`, the `TrackEmitter` seam a
future life-trail part plugs into). The mechanism design lives in `ideas.md` **2026-06-08**; the
restoration-attributing trail remains captured in guidance §3a. Continues the captured "residual scorch"
extension in [`specs/scrap-stain-decals-spec.md`](specs/scrap-stain-decals-spec.md) §7.

## 19. The world-shop slice quietly grew a "stock" mechanic we never asked for

**Context:** Reviewing the first world-shop slice (`features/shop/`, PR #71) and reconciling what was built
against what was wanted. *(Captured 2026-06-12.)*

**Observation:** The implementation grew a **per-shop `stock` list** (partial/unique stock, a "stock-list
seam tiers and set-completion ride on") that **was never a wanted mechanic** — it slipped in from the spec
draft. The actual model is simpler and was decided plainly: **you can buy any part a shop sells and it's
always in stock** (no scarcity); **you can sell any loose part to any shop, always at a loss** — the shop is
a greedy buyer that even takes parts it doesn't stock. So a shop is just *"the full catalogue at one intrinsic
tier"*, and the `stock` field, `allStockedPartIds`, and the partial-stock test were **speculative complexity
removed** (the buy list is now `shopStockForTier(tier)`; selling was already universal + lossy via
`resaleValue ≈ price/2`). Captured-but-not-built — if partial stock is ever genuinely wanted it reattaches as
an optional `WorldShop.stock?` subset the buy list filters on.

**Why it matters:** This is "**complexity earns its place**" in action — a seam built for a mechanic that
doesn't exist is cost with no payoff, and it actively mis-described the game (the sell path quietly worked
*against* the stock concept it was supposedly enforcing). Two structural lessons fell out of the same review,
both now fixed: **(a)** the shop and workshop each bound an independent window-`E` listener that, where their
proximity zones overlap (reachable once driving the 3×5 hauler, whose parts the bowl shop sells), opened
*both* full-screen overlays on one press — "which interaction owns E here" had no single arbiter, only
hand-placed spawn coordinates keeping the zones apart; now an `isBusy()` gate lets only one sim-freezing
overlay open at a time. **(b)** the shop had copy-pasted the workshop's proximity-gate math, the mulberry32
RNG (a third copy), and the part-identity colour map — all promoted to `@common` (`sim/proximity-gate`,
`sim/rng`, `parts/part-color`) so the two can't drift. A still-**latent** note left for when multiple shops
exist: `activeShopEntity()` returns the *first* active shop, not the *nearest* — moot with one shop, a
nearest-pick when overlapping shops become real.

**Status:** DONE (PR #71 review follow-up) — stock seam removed, E double-open fixed, the three duplications
promoted to `@common`; `tsc` + all tests green. The partial/unique-stock and multi-shop-arbitration ideas stay
captured (here + the world-shops spec), not committed.
