# ADR-001: One canonical grid-snap; `mounting.ts` owns cell geometry

- **Status:** Accepted
- **Date:** 2026-06-01
- **Context:** PR #11 (3D workshop staging deck) review

## Context

Mounting is grid-agnostic by design: a rig and a workshop both carry a `MountGrid`, and a part
attaches to a `(platform, col, row)` cell as pure data. `systems/mounting.ts` is the home of that
grid geometry — `cellLocalOffset`, `cellWorldPose`, `worldToRigLocal`, `partAtCell`, and the
"forgiving closest empty cell" snap (`nearestFreeCellOn` / `nearestMountTarget`).

When the staging deck landed, `systems/staging.ts` grew its own `nearestFreeWorkshopCell` that
re-implemented the identical scan — loop the grid, skip occupied cells, pick the nearest by
`Math.hypot` to a local point. The only real difference was the input frame: the build interaction
works in **world** space (and converts via `worldToRigLocal`), while the deck view raycasts in
**deck-local** space and already has a local point. That frame difference was used to justify a
second copy of the scan.

Two copies of "closest empty cell" is two places to fix a snap bug, two places for the rules to
drift apart, and a blurred answer to "who owns grid geometry?"

## Decision

`mounting.ts` is the **single owner** of the grid-snap scan. The canonical primitive operates in the
platform's **local** frame:

```ts
closestFreeCellLocal(world, platform, lx, lz, maxDist = Infinity): { col, row, dist } | null
```

- World-space callers convert their point with `worldToRigLocal` first — `nearestFreeCellOn`
  (private, used by `nearestMountTarget`) is now just that conversion plus a delegate call.
- Local-space callers (the workshop deck view) pass their point straight in.
- `staging.ts` no longer implements a snap; the overlay calls `closestFreeCellLocal` directly.

The nearest-free-cell tests live with the helper, in `mounting.test.ts`.

## Consequences

- One snap algorithm; a change to the snap rule (reach, tie-breaking, occupancy) happens once.
- `staging.ts` shrinks to what only it can do — the inventory↔deck hop — and reads more clearly as
  orchestration over the mounting + assembly seams.
- The local-frame signature is the more primitive one; the world-space wrapper is the thin adapter.

## Anti-pattern this prevents

**Do not re-implement grid/cell geometry or the closest-cell scan outside `mounting.ts`.** If a new
surface needs to snap onto a grid, give it a `MountGrid` and call the canonical helper — convert your
point to the platform's local frame if you're in world space. A "the frame is slightly different"
or "it's only a dozen lines" excuse is exactly how the duplicate crept in; the fix is an adapter at
the boundary, not a second copy of the rule.
