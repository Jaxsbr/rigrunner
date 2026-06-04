# `features/mounting/` — the rig deck + build-interaction slice

Mounting parts onto a grid: the rig chassis (`rig.ts`), the mount sim (`mounting.ts`), the build
interaction (`build-controller.ts` — grab → preview → drop → connect), and the `carried` marker.

## Single owner: `mounting.ts` owns grid-snap / cell geometry ([ADR-001](../../../../docs/architecture/adr-001-canonical-grid-snap.md))

`mounting.ts` is the **single owner** of the grid-snap scan and cell geometry — `cellLocalOffset`,
`cellWorldPose`, `worldToRigLocal`, `partAtCell`, and the forgiving closest-empty-cell snap
(`nearestFreeCellOn` / `nearestMountTarget`). The canonical primitive works in the platform's **local**
frame; the world-space form is a thin adapter.

**Do not re-implement grid/cell geometry or the closest-cell scan anywhere else.** If a new surface
needs to snap onto a grid, give it a `MountGrid` (`@common/components`) and call the canonical helper —
convert your point to the platform's local frame if you're in world space. "The frame is slightly
different" / "it's only a dozen lines" is exactly how a duplicate crept in once; the fix is an adapter,
not a copy. (ADR-001 referenced this file as `systems/mounting.ts`; it now lives here.)

## Dependency direction (ADR-003)

- Mounting depends downhill on `drive` (the rig carries drive components) — never the reverse.
- **Mounting must NOT import `workshop`.** The build controller offers active workshop decks as
  staging drop-targets via an **injected** `stagingTargets` provider (`main.ts` passes
  `@features/workshop/staging` → `activeStagingTargets`), so the edge points `workshop → mounting`
  (downhill) and the cross-feature DAG stays acyclic. Don't re-add a `WorkshopZone` import here.
