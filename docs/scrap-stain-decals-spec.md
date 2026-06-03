# RIGRUNNER — Scrap Stain / Seepage Decals (spec + plan)

**What this is:** the design + implementation plan for a small **visual-only** tweak — a stain/seepage
mark on the ground around every loose scrap piece, that **fades out when the scrap is collected**
(a cleaning effect) and **fades in when new scrap is spawned** by looting a scrap-pile (pollution
added). Captured ahead of building so we have a historical record of the plan when we pick it up next.

> **Status:** **built** (same PR/branch as this spec). Implemented as `game/src/render/scrap-stains.ts`
> — a render-layer collaborator (`ScrapStains`) following §5a (despawn-diff, zero coupling to
> collection). Purely cosmetic: it touches no collection, collision, loot, or storage logic. The
> numbers below are the shipped strawmen — still tune against feel. True to "build by discovery", it
> went in because it makes the world read as *lived-in and reactive*, not because it was on a roadmap.

---

## 1. The feeling we're buying

Loose scrap should look like it has been **bleeding into the ground** — an oily/rusty seepage stain
spreading out from under each piece. That does two jobs:

- **Legibility from a distance.** A dark smudge on the dusty tan ground (`0x8a8275`) is easier to spot
  while driving than the small `loose-scrap` GLB alone — it advertises "there's pickup here."
- **A reactive world.** The world visibly responds to the player:
  - **Collect a piece → its stain slowly fades** (you *cleaned* that spot — the land heals).
  - **Loot a pile → fresh scrap bursts out, each new stain fades in** (you made a mess — *pollution
    spreads* as you tear the heap apart).

The stain is the *trace* of the scrap, animated in both directions so the cause→effect of the core
loop is felt in the ground itself.

---

## 2. Scope — what this is and isn't

| In scope | Out of scope |
|---|---|
| A ground decal under every loose-scrap entity | Any change to collection / deposit rules |
| Fade-in on spawn, fade-out on collect | Any change to collision, loot tables, or storage |
| Pure render/animation layer | The big rummageable `scrap-pile` heap getting its own stain (could come later) |
| Tunable colour / size / fade rates | Persisted/permanent scorch marks that outlive the scrap (a possible follow-up, see §7) |

The decal is bound 1:1 to a loose-scrap entity's lifetime. When the scrap is gone *and* its stain has
finished fading out, the decal is removed. Nothing about gameplay state depends on it.

---

## 3. The seams it hooks into (today's code)

This stays cosmetic by living entirely in the render/animation layer, the same way wheels, storage
fill, and the pile-shrink already animate off World state without owning it.

| Concern | File · symbol | Note |
|---|---|---|
| Loose scrap entity | `game/src/content/scrap.ts` · `spawnScrap()` | gets `Transform` + `Renderable {assetId:'loose-scrap'}`. The decal tracks this `Transform`. |
| Spawn seam (startup field + pile burst) | `scrap.ts` · `scatterScrapAround()` / `scatterScrap()` | startup field at origin **and** the rummage burst both funnel through here → both get fade-in stains for free. |
| Collection (the fade-out trigger) | `game/src/systems/scrap-collection.ts` · `scrapCollectionSystem()` | today it calls `world.destroyEntity(scrap)` immediately on deposit (line ~89), and **returns the collected ids**. The returned list is the hook — see §5. |
| Pile rummage burst | `game/src/systems/scrap-pile.ts` · `scrapRummageSystem()` (~line 146) | spawns via `scatterScrapAround` → already covered by the spawn seam. |
| Scene + ground | `game/src/render/stage.ts` | ground is an 80×80 `PlaneGeometry`, tan `MeshStandardMaterial`. Decals sit just above it. |
| Entity→object sync | `game/src/render/entity-views.ts` · `EntityViews.sync()` | maps `EntityId → THREE.Object3D` from `Transform`. The decal registry mirrors this lifecycle. |
| Animator suite + tick | `game/src/render/animators.ts`; called from `game/src/main.ts` (~lines 206–209) | new `animateScrapStains(dt)` slots in alongside `animateStorageFill` / `animateScrapPile`. |
| Fade-easing precedent | `interaction-hints.ts` (`FADE_RATE`, linear sign/min easing); `animators.ts` (`*_EASE` exp-lerp) | reuse one of these patterns — no new easing math needed. |

---

## 4. The decal itself (render strategy)

Keep it dead simple first; only reach for a shader if flat decals look wrong.

- **Geometry:** a small horizontal `PlaneGeometry` (or circle) laid flat on the ground (`rotation.x =
  -π/2`), centred on the scrap's `(x, z)`, sitting a hair above the ground plane (e.g. `y ≈ 0.02`) to
  avoid z-fighting with the ground and grid.
- **Look:** a soft-edged radial blob — a dark, desaturated oily/rust tone reading against the tan
  ground. Start with a **radial-gradient canvas texture** (transparent at the rim, opaque-ish centre),
  same canvas-texture trick `interaction-hints.ts` already uses — no asset pipeline needed. A `.glb`
  is overkill for a flat smudge.
- **Material:** transparent, `depthWrite: false`, slight `polygonOffset` or the small `y` lift so it
  composites cleanly over the ground without fighting the grid helper.
- **Per-piece variety (shipped):** the field must NOT read as stamped copies, so every stain randomises
  independently — **size** (half-extent **0.45–1.3 m**, from a faint mark to a big puddle past the
  scrap's 0.4 m footprint), **ovalness** (minor axis 0.55–1.0 of the major) at a **random ground-plane
  orientation**, **darkness** (per-stain max opacity 0.28–0.6 — some deep oily pools, some light
  seepage), and **pattern** (each picks one of a small pool of distinct blotch textures, whose core
  darkness, falloff, and scatter of darker pools all differ).
- **One decal per loose-scrap entity**, owned by a small render-side registry keyed by `EntityId`
  (mirrors `EntityViews.objects`), NOT a component on the entity — gameplay never needs to know.

> **Possible optimisation, not v1:** with up to ~64 startup pieces + bursts, a per-decal mesh is fine.
> If draw calls bite, batch into a single instanced mesh / merged geometry later. Don't pre-optimise.

---

## 5. The animation — fade-in (pollution) & fade-out (cleaning)

Each decal carries a tiny bit of animation state (opacity + target), held in the decal object's
`userData`, exactly like the existing animators. One `animateScrapStains(dt)` pass per frame eases
every decal's opacity toward its target and culls finished fade-outs.

**Lifecycle / state machine per decal:**

1. **Born (scrap spawned):** create decal at the scrap's position with `opacity = 0`, `target = 1`.
   → it **fades in** = *pollution seeping in*. (Covers both the startup scatter and the pile burst,
   since both go through `scatterScrapAround`.)
2. **Steady:** scrap alive, decal at full opacity, just tracking the (cosmetic) position.
3. **Collected (scrap destroyed):** set `target = 0`. → it **fades out** = *the land cleaning up*.
4. **Done:** once `opacity ≈ 0`, dispose the decal (geometry/material/texture) and drop it from the
   registry.

**Wiring the fade-out trigger (the one careful bit).** `scrapCollectionSystem` destroys the entity
the same frame it deposits, so by the time the render layer runs the entity is already gone — we must
catch the *id* before it vanishes. Two clean options (decide at build time, both keep collection
logic untouched):

- **(a) Diff the registry against live entities each frame.** In `animateScrapStains`, any decal whose
  `EntityId` is no longer `world.isAlive(...)` flips to `target = 0`. Zero coupling to the collection
  system — the render layer just notices the scrap is gone. **Preferred** for its looseness.
- **(b) Consume the returned collected-ids.** `scrapCollectionSystem` already **returns the collected
  ids** (its doc comment literally says "handy for tests and, later, feedback FX"). `main.ts` can hand
  that list to the decal layer to start the fade-out. More explicit, slightly more wiring.

> Prefer **(a)** unless we find a reason we need the explicit signal — it means the stain reacts to
> *any* despawn, and the collection system stays exactly as it is.

**Timescales (strawmen, tune to feel):**

| Transition | Feel | Shipped rate (`*_EASE` /s) |
|---|---|---|
| Fade-**in** (pollution) | gradual seep, not a pop — "spreading" | slow, `FADE_IN_EASE = 0.7` ⇒ ~**4 s** to full (well below the UI `FADE_RATE` of 6/s) |
| Fade-**out** (cleaning) | unhurried healing of the land | slower still, `FADE_OUT_EASE = 0.4` ⇒ ~**7 s** to clear |

Reuse the **exp-lerp** easing from `animators.ts` (`shown += (target - shown) * min(1, dt * EASE)`,
snap within ~0.001) with small `EASE` constants, or the linear sign/min from `interaction-hints.ts`.
Either is fine; exp-lerp gives a softer tail that suits "seeping/healing." `dt` is already clamped to
0.05 in the main loop, so no large-step guard is needed.

---

## 6. Acceptance — how we'll know it's right

- Every loose-scrap piece (startup field *and* pile bursts) has a stain under it.
- A freshly-burst piece's stain is visibly **absent at the instant of spawn and grows in** over a
  second or two — you can watch pollution arrive as you rummage a pile.
- Driving over a piece to collect it leaves a stain that **lingers and slowly fades**, not a hard
  cut — the spot visibly "cleans up" after the junk is gone.
- No change to what gets collected, how containers fill, or pile/loot behaviour — toggling the whole
  feature off changes nothing but pixels.
- No z-fighting shimmer between stain, ground, and grid; framerate unaffected by a full startup field.

---

## 7. Captured-but-not-committed extensions (don't build unless play asks)

- **Residual scorch.** Instead of fully cleaning, leave a faint permanent-ish mark where scrap was —
  a "this area's been picked over" history. Cuts against the clean-the-land reading, so only if it
  feels good.
- **Pile aura.** Give the big rummageable `scrap-pile` heap its own larger stain that shrinks with
  `remaining` (it already shrinks visually via `animateScrapPile`).
- **Stain intensity by value/tier.** If scrap ever carries tiers (see `part-identity-spec.md`), richer
  scrap could seep darker/bigger. Pure flavour; gated on tiers existing at all.
- **Instanced batching** for the decals if draw calls ever matter (see §4 note).

---

## 8. Build order when we pick this up

1. Render-only decal registry + a single radial-gradient canvas texture; spawn a decal per loose-scrap
   entity, tracking position. (No fade yet — just get stains on the ground, looking right.)
2. Add `animateScrapStains(dt)` with fade-**in** on birth. Tune in-rate/size/colour.
3. Add fade-**out** via the despawn-diff (§5a); dispose finished decals. Tune out-rate.
4. Feel pass: sizes, colours, rates against the tan ground; confirm acceptance (§6). Promote nothing
   to `shared/` — this is game-render-local.
