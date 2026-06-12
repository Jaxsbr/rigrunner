# RIGRUNNER — Lightweight collision & solid obstacles (spec)

**What this is:** the design + plan for a small, dependency-free **collision-response** layer so the rig
**physically collides** with solid world structures (scrap piles, enemy camps, shops, the workshop,
restored trees) instead of clipping straight through them. It builds entirely on the collision
*detection* the game already has — no physics engine, no new math library. Sequenced **before Phase 1**
of [`real-world-and-progression-spec.md`](real-world-and-progression-spec.md), because the crafted
cold-open (the bowl, the outpost, the structures you drive up to) has to *read as believable*.

> **Status:** ✅ **Built** (PR #74). Captured from the **2026-06-12** brainstorm (read
> [`../ideas.md`](../ideas.md) for the voice/why). The **response model** and **scope** shipped as specced,
> with one change found in play: the **head-on speed-bleed was removed** — it made walls *sticky* (at zero
> speed the turning model, `yaw ∝ speed`, couldn't rotate the rig off a wall, forcing a full reverse). The
> response now corrects **position only** and keeps the rig's speed, so a held turn pivots it off (§3). Radii
> are **build-time tuning**. Candidate/movable per "build by discovery."

---

## Why this exists (the problem it solves)

You can drive **straight through** scrap piles, enemy camps, shops, the workshop — and even the **trees
you restore**. The rig just clips through everything. It reads as unbelievable: the world doesn't push
back, and the one thing the game is *about* (healing the world) is something you then drive through like
a ghost. The cold-open's crafted structures (Phase 1) will only feel real if you can't pass through them.

We have **no physics or collision engine** and don't want one. The fix is a small, lightweight
mechanism — and most of it already exists.

---

## What already exists (build on it, don't reinvent)

The game already has collision **detection** and a footprint model:

- **`@common/sim/collision.ts` — `collisionSystem(world)`** returns every overlapping pair of circular
  colliders this frame (planar x/z: two overlap when `dist(centres) < r₁ + r₂`). A *pure read* — it
  reports pairs and mutates nothing; consumers decide what a pair *means* (scrap collection, ram/projectile
  hits). O(n²) with an early reject, with a named seam to swap in a spatial grid later.
- **`@common/components/collider.ts` — `Collider { radius }`** — a circle on the ground. The chassis and
  every mounted part each carry one, so the rig is a *union of circles* that grows with the build. The
  chassis (rig root) collider is `r ≈ 1.0` (1×3) / `1.9` (larger) — `features/mounting/rig.ts`.
- **`features/drive/movement.ts`** — the rig moves by a scalar `Velocity.speed` along its heading,
  advancing `Transform.x/z` each frame (`t.x += -sin(rotationY)·speed·dt`, likewise z). This direct
  position integration is exactly what makes positional push-out clean (see §3).
- **The "footprint vs meaning" precedent:** `features/scrap/collectible.ts` keeps `Collider` ("this has a
  physical footprint") **separate** from a tag that says what a hit means. We mirror it with a **`Solid`**
  tag — opt-in blocking — so nothing existing changes behaviour.

**Two real gaps:**

1. **Structures have no footprint to hit.** The workshop, world shops, scrap piles, and restored stumps
   deliberately use **proximity zones, not colliders** (`features/workshop/workshop.ts` says it outright:
   "no Collider — the proximity zone, not collisions"; likewise `features/shop/world-shop-spawn.ts`, the
   scrap-pile entity, and the restoration `Healable` stump). They need a `Collider` to be hit at all.
2. **There is no response.** `collisionSystem` only *reports* overlaps; nothing pushes the rig out. That
   is the whole job of this spec.

**The trap to avoid:** a plain `Collider` must NOT mean "blocks." **Loose scrap pieces**
(`features/scrap/scrap.ts`) carry a collider but must stay **drive-through** (you collect them by driving
over them), and **enemy guards/projectiles** (`features/camps/camp-spawn.ts`, `projectile.ts`) carry
colliders but must stay **rammable / damaging**. Blocking is therefore **opt-in via `Solid`**, never
implied by `Collider`.

---

## §3. The model — push-out + slide *(decided 2026-06-12)*

When a mover's circle overlaps a `Solid` circle, **de-penetrate** the mover — not stop it, not bounce it.

- **Push-out, along the contact normal.** The normal is the centre→centre direction (`Solid` → mover).
  Move the mover out along it by the **penetration depth** (`reach − dist`, where `reach = r_mover +
  r_solid`), so after the correction the circles are exactly touching, never overlapping. Clipping is gone
  every frame.
- **Slide falls out for free.** Only the *into-the-surface* component of the frame's motion is cancelled;
  the *tangential* component survives, so a rig hitting at an angle **scrapes along the surface** and
  deflects off — a heavy vehicle grinding past a wall, not a brick on glue.
- **No jitter, by construction.** Head-on, the push-out almost exactly cancels that frame's forward
  over-step, so the mover **sits flush** against the surface frame after frame. It is a **clamp to the
  surface, not an impulse that overshoots** — there is nothing to oscillate. And because there is **no
  velocity reflection**, there is **no bounce**.
- **Keep the mover's speed — position only (revised in play).** The response corrects **position only** and
  never touches `speed`. We first **bled** head-on speed toward 0 for a "settle," but play exposed a trap:
  steering is `yaw ∝ speed`, so a rig pinned at 0 speed **could not rotate off a wall** — it had to fully
  reverse, which read as *sticky / unforgiving*. Keeping the speed means a **held turn pivots the rig off**
  the wall and drives it away, no reverse needed. **Coming to rest is the existing coasting friction's job**
  (release the throttle against a wall and it stops there); the response doesn't duplicate that. A glancing
  hit keeps its speed too, so the slide carries on.
- **Degenerate case.** If a mover is exactly concentric with a `Solid` (`dist ≈ 0`, no defined normal),
  push out along the mover's **reverse heading** so the correction is deterministic.

### The system (≈25 lines)

A new `collisionResponseSystem(world, dt)`, dispatched from `app/bootstrap` **after** `movementSystem`
(so it corrects the final position for the frame), independent of the existing `collisionSystem` trigger
pass:

```
for each mover (Transform + Drivetrain + Velocity + Collider):   // player rig AND enemy rigs — §4
  const T = mover.Transform, R = mover.Collider.radius
  for each solid (Transform + Collider + Solid):
    const dx = T.x - solid.x, dz = T.z - solid.z
    const reach = R + solid.radius
    const d2 = dx*dx + dz*dz
    if (d2 >= reach*reach) continue                  // no overlap
    const dist = Math.sqrt(d2)
    const [nx, nz] = dist > 1e-4
        ? [dx/dist, dz/dist]                          // contact normal (solid → mover)
        : [-Math.sin(T.rotationY), -Math.cos(T.rotationY)]  // concentric: reverse heading
    const pen = reach - dist
    T.x += nx * pen;  T.z += nz * pen                 // de-penetrate to exactly touching — POSITION only;
                                                      // speed is left alone so the turning model can steer it off
```

- **One pass** is enough for the sparse `Solid` set. If a mover wedges into two solids at once and a corner
  wobble appears, a second resolve pass is the cheap fix — noted, not built.
- Pure over the world (state in, state out) — runs and is unit-tested headless like the rest of the sim.

---

## §4. Scope — what is solid, who is blocked

**Gets a `Collider` footprint + the `Solid` tag** (add a footprint where there isn't one today):

- **Scrap pile** structure.
- **Enemy camp structure** (the central building / loot crate) — **not** the guards (they stay rammable).
- **World shop** building.
- **Workshop.**
- **Restored tree** — when a `Healable` stump grows into a tree, it gains `Collider` + `Solid`, so **you
  cannot drive through the very thing you restored.**

**Movers that de-penetrate from solids — decided: the player rig AND enemy rigs.** Both are blocked, so
enemies also can't ghost through buildings. **Caveat to tune:** enemies can now **snag on geometry** — a
simple steer-around nudge in enemy pathing may be wanted once it's felt. That nudge can read the same
`Solid` set; it is **captured, not built** here.

**Stays as-is (NOT solid):** loose scrap pieces (drive-over collect), enemy guards + projectiles
(ram/combat), and all proximity zones (workshop/shop/pile/heal gates are unaffected).

---

## §5. Deliberate minimums (each a cheap upgrade later)

True to "complexity earns its place" — start small, leave the seam:

- **Rig root circle only.** Blocking uses the **chassis** collider, not the per-part union — one circle to
  resolve, no part→root mapping. If mounted parts visibly clip into walls, per-part blocking is the
  refinement (the union already exists for scrap collection).
- **One circle per structure.** A rectangular workshop gets a round footprint — slightly generous at the
  corners, fine to start. Capsule / AABB / multi-circle is a later refinement when a structure's shape
  demands it.
- **O(n²)** over movers × solids is nothing for the handful of solids we have; `collision.ts` already names
  the spatial-grid swap seam for when counts grow.
- **No swept / CCD.** A very fast (boosted) rig could tunnel through a *thin* solid in one frame — low risk
  with sensibly-sized footprints; add continuous detection only if it actually bites.

---

## §6. Interface seams (architect for, don't build)

- **`Solid` is the single opt-in.** Any future blocker — a boulder, a wreck, a wall segment — becomes
  blocking by gaining the tag; the response system needs no change.
- **A real bowl wall, later.** Phase 1 deliberately keeps the cold-open's bowl gated by **danger, not
  walls** (the wreckage wall is visual-only because we had no collision). This spec is the mechanism that
  *would* back a physical wall (tag the wall chunks `Solid`) — it **does not change Phase 1's call**, it
  just makes the option exist for when/if a physical blocker is wanted.
- **Enemy steer-around** pathing can later read the same `Solid` query to avoid snagging.

---

## §7. Persistence

No new save concern. `Solid` and the structure colliders are **static authored data** re-added by each
structure's constructor on rebuild — and the snapshot already restores the structures themselves
(ADR-004). The restored tree gains its `Solid` the same way it gains its mesh as `Healable.growth`
reaches a tree. Nothing extra to serialize.

---

## §8. Done when (verify in-game)

- Driving the rig into a **scrap pile / camp structure / shop / workshop / restored tree** stops it at the
  surface — **no clip-through**, **no jitter, no bounce**. Holding forward holds it flush against the
  surface; **releasing the throttle** lets it coast to rest there.
- **Forgiving recovery:** after a head-on hit you can **steer away and drive off without fully reversing**
  (the response keeps the rig's speed, so the turning model can rotate it off the wall).
- Approaching a structure **at an angle** makes the rig **slide along** it rather than stick.
- Regression: **loose scrap still collects** by driving over it; **enemy guards are still rammable**; the
  **reclaimer / heal / shop / workshop proximity** interactions all still fire.
- An **enemy rig** no longer drives through a structure.

---

## §9. Sequencing & where this connects

- **Before Phase 1** of [`real-world-and-progression-spec.md`](real-world-and-progression-spec.md) — the
  crafted bowl + outpost + structures must read as believable; a small, self-contained slice.
- [`../milestones.md`](../milestones.md): listed as the **pre-Phase-1** believability item (step 0 in
  *Where we are → what's next*, ahead of the cold-open).
- [`@common/sim/collision.ts`] + [`@common/components/collider.ts`] — the detection + footprint this
  builds on.
- `features/drive/movement.ts` — where motion integrates; the response runs **after** it each frame.
- `features/scrap/collectible.ts` — the **footprint-vs-meaning** precedent the `Solid` tag follows.
- [`../observations.md`](../observations.md) — capture the play-feel finding here once it ships (does the
  settle read as believable; do enemies snag?).
