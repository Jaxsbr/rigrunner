# RIGRUNNER — Observations

A running log of things we *notice* while building the prototype — what makes the
loop feel good, what feels wrong, and the small details that turned out to matter
more than expected. The prototype exists to answer "is the loop fun?"; this file is
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

**Status:** FUTURE — real art/styling, out of prototype scope. Logged now so we design
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
