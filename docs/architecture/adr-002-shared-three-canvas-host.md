# ADR-002: One shared three.js canvas host for 3D widgets

- **Status:** Accepted
- **Date:** 2026-06-01
- **Context:** PR #11 (3D workshop staging deck) review

## Context

The game has several small, self-contained three.js widgets that render into their own canvas
alongside the main game canvas:

- the asset **viewer** preview core (`viewer/`),
- the part **`model-portrait`** (`shared/model-portrait.ts`), a single-GLB turntable, and
- the **`deck-view`** (`game/src/ui/deck-view.ts`), the multi-model staging deck added in PR #11.

Each one independently re-created the same scaffolding: make a canvas, a `Scene`, a
`PerspectiveCamera`, a `WebGLRenderer` (alpha + capped pixel ratio), `OrbitControls`, the **identical**
three-light rig (ambient + key sun + fill), a `requestAnimationFrame` render loop, and matching
`resize` / `start` / `stop` / `dispose` plumbing — plus a copy-pasted `disposeObject` GPU-cleanup
helper. `model-portrait` was *itself* extracted from the viewer "so the two don't fork" — and then
`deck-view` forked it a third time. Four-way drift was one widget away.

## Decision

A single shared host owns the scaffolding: **`shared/three-canvas.ts`** →
`createThreeCanvas(host, options)` returning `{ scene, camera, renderer, controls, canvas, resize,
start, stop, dispose }`, plus the shared `disposeObject(obj)` helper.

- The light rig is **fixed inside the host**, not a per-widget knob — a part must read the same across
  the viewer, the portrait, and the deck, so lighting is not something a widget gets to vary.
- Widgets add only their own *content*: `model-portrait` adds the turntable + bounds-fit framing +
  ghost mode; `deck-view` adds the multi-model deck + raycasting/picking/highlight.
- Per-widget divergence rides two hooks: `onResize` (e.g. re-fit framing when the aspect changes) and
  `onDispose` (free widget-owned GPU resources before the host tears down).

## Consequences

- Canvas/renderer/lights/loop/resize/dispose live once; a fix (e.g. pixel-ratio, context-loss
  handling, a lighting tweak) applies to every widget.
- `model-portrait` and `deck-view` are now visibly *just* their content — easier to read and to test
  by eye.
- A new 3D widget starts from `createThreeCanvas`, so consistency is the default, not a discipline.

## Anti-pattern this prevents

**Do not hand-roll the three.js canvas/renderer/lights/loop for a new widget.** Build on
`createThreeCanvas` and add only content. If a widget needs something the host doesn't expose, extend
the host (or add a hook) so the capability stays shared — never start a fourth private copy of the
scaffolding. The same goes for `disposeObject`: import the shared one; do not paste another GPU-cleanup
traversal (and never call it on a `clone(true)` of a cached `ModelLoader` template — those share the
cache's geometry/materials and must only be removed, not freed).
