# RIGRUNNER — Terrain Track Marks (spec + plan)

**What this is:** the design + implementation record for a small **visual-only** feature — anything that
drives presses a **tread trail** into the ground that **fades out** behind it. Reference: *Machine Mind*,
where the vehicle lays two parallel tread bands that follow its path, curve through every turn, and fade
with distance — subtle dark marks on the tan ground.

> **Status:** **built** (this PR). Implemented as the `features/tracks/` slice: a pure stamp planner
> (`track-stamp.ts`, unit-tested) + a render-layer collaborator (`track-marks.ts`, the
> `ScrapStains`/`CampStains` pattern), driven off a shared `TrackEmitter` marker. Purely cosmetic — it
> touches no movement, collision, combat, or storage logic. Numbers below are the shipped strawmen,
> still to tune against feel.

---

## 1. The feeling we're buying

A moving machine should **write on the world**. Driving leaves a fading ribbon of tread behind you, so
a run reads as a path you carved — and a flurry of turns makes an interesting, curving, slowly-vanishing
trace. It's cheap weight on the "the world reacts to me" feeling, and it's the **first concrete step of
world restoration**: the same mark, later made by a dedicated part, is how driving will *green* the
ground (see §6).

It applies to **everything with a drivetrain**. Today that's two movers: the **player rig** and the
**camp guards** (the little robots). A new kind of mover leaves tracks the moment it carries the marker.

---

## 2. Scope — what this is and isn't

| In scope | Out of scope |
|---|---|
| A fading tread decal trail under every ground mover | Any change to movement / steering / collision |
| One simple tread style, sized per mover (gauge width) | Per-mover style variety beyond width |
| Curves with the path; fades over a few seconds | **Restoration** — persistence, greening, gating, a part (deferred — §6) |
| Tunable spacing / size / lifetime / opacity | Per-wheel contact-point marks (one centred ribbon for now) |

The trail is pure view: toggling the whole feature off changes nothing but pixels.

---

## 3. The seams it hooks into

| Concern | File · symbol | Note |
|---|---|---|
| "I leave tracks" marker | `@common/components/track-emitter.ts` · `TrackEmitter {width}` | shared vocabulary; the **future restoration part extends this** (§6) |
| The rig becomes a mover | `features/mounting/rig.ts` · `chassisToRig` (add) / `chassisToKit` (remove) | gauge by chassis size (1×3 → 1.5, 3×5 → 2.6); a folded kit isn't a mover |
| Guards are movers | `features/camps/camp-spawn.ts` | each guard gets `TrackEmitter {width: 0.55}` |
| Mover pose | `@common/components/transform.ts` · `Transform {x,z,rotationY}` | marks are laid off **position-delta**, not `rotationY` (a guard backing off faces the rig but moves away) |
| Decal precedent | `features/scrap/scrap-stains.ts`, `features/camps/camp-stains.ts` | same render-layer-collaborator shape (canvas-texture decals, eased opacity, owns no truth) |
| Dispatch | `game/src/main.ts` (always-run render block, by the stains) | `tracks.sync(world, dt)` — runs always so trails keep fading behind an overlay; frozen sim ⇒ no new marks |

---

## 4. The design

Two parts, split at the testability seam:

- **`track-stamp.ts` — pure geometry (unit-tested headless).** `planStamps(from, to, step)` decides
  *where* to lay marks. An **anchor** advances only by whole steps, so spacing is even regardless of
  frame rate or speed; a frame that travels less than a step leaves the anchor put and accumulates. Each
  mark takes the **travel direction at that point** (`yaw = atan2(-dx,-dz)`, matching the sim's
  forward = −z), so the trail curves with the real path. Two guards: **first-sight** (seed the anchor,
  don't streak from the origin) and **teleport** (a single-frame jump > `TRACK_TELEPORT` is a
  deploy/pack reseat or a respawn of the same entity — snap the anchor, lay nothing).

- **`track-marks.ts` — `TrackMarks` render collaborator (THREE, untested like its sibling stains).**
  Each frame: for every `TrackEmitter`+`Transform`, plan stamps from its anchor and press a tread decal
  per stamp; advance every live decal's fade; drop the faded ones. A flat `PlaneGeometry(width, length)`
  laid on the ground, spun about its normal to point its length along travel, wearing a shared
  canvas tread texture (two soft dark bands broken into lugs). Geometry is cached per gauge width; the
  texture is shared; only per-mark materials (for independent opacity) are disposed.

**Why position-delta, not a heading component:** it's the universal signal — a mover stamps only while
it actually moves, the trail bends with the path, and it needs nothing reported from the sim. Tread marks
are axis-symmetric, so a guard reversing away from the rig still marks correctly.

---

## 5. Tuning knobs (shipped strawmen, set to feel)

All in `features/tracks/`:

| Knob | File · const | Shipped | Effect |
|---|---|---|---|
| Mark spacing | `track-stamp.ts` · `TRACK_STEP` | `0.32` | smaller = smoother curves, more decals |
| Teleport cutoff | `track-stamp.ts` · `TRACK_TELEPORT` | `3` | a one-frame jump past this lays nothing |
| Mark length | `track-marks.ts` · `SEGMENT_LENGTH` | `TRACK_STEP × 2.2` | overlap that fuses marks into a ribbon |
| Lifetime | `track-marks.ts` · `LIFE` / `HOLD_FRAC` | `6` s / `0.4` | hold solid, then fade — the old end vanishes first |
| Darkness | `track-marks.ts` · `BASE_OPACITY` / `OPACITY_VAR` | `0.5` ± `0.08` | subtle dark-on-tan, varied per mark |
| Live cap | `track-marks.ts` · `MAX_SEGMENTS` | `640` | oldest dropped first — bounds a long drive |
| Gauge | `rig.ts` / `camp-spawn.ts` · `TrackEmitter.width` | rig 1.5/2.6, guard 0.55 | cross-track ribbon width |

---

## 6. The restoration future (deferred — DO NOT build yet)

`TrackEmitter` is deliberately the seam for the earned, upgradeable, **persistent life-trail**
(`world-progression-guidance.md` §3a): the same emitter, given a richer descriptor (a style/tier, a
consumed resource), is how driving will heal the ground rather than just scuff it. That version needs
decisions this feature intentionally leaves open — whether the restoration trail looks the same /
lighter / different, whether it persists, and whether it's the same emitter upgraded or a second
part-only one. Until that part exists, the renderer carries **no** restoration logic; it lays one
cosmetic, fading mark and nothing more.

---

## 7. Acceptance — how we know it's right

- Driving the rig lays a tread ribbon that **follows the path and curves through turns**, then **fades**
  behind it over a few seconds (verified in-game: straight + S-curve runs).
- The trail is **subtle** — dark tread on the tan ground, not a hard black line.
- **Camp guards** lay a narrower trail while they kite (same code path; gauge `0.55`).
- A deploy / pack-up / respawn does **not** draw a streak across the map (teleport guard).
- No change to movement, collision, combat, or storage — toggling the feature off changes only pixels.
- The seepage / camp stains still composite **over** the tracks (tracks at `renderOrder -1`).
