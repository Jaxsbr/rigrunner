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
