# RIGRUNNER — Specs

Individual **feature specs & work-tracking** — one `*-spec.md` (or build-plan) per feature. A spec is
the detailed design + phased plan for a single mechanic; the **high-level direction** that decides
*which* features we aim at lives one level up in [`../milestones.md`](../milestones.md).

Non-spec docs (ideas, observations, the world-progression vision, asset/setup contracts) stay at the
`docs/` top level. Structural decisions live in [`../architecture/`](../architecture/) (ADRs).

## Convention

- One feature per file, named `<feature>-spec.md` (a pure historical build record may be a
  `<feature>-build-plan.md`).
- Each spec opens with a one-line **what this is** + a **Status** callout, and links back to its
  `milestones.md` entry.
- A spec describes where the feature **is** (state the present truth); how it got there lives in the
  dated `ideas.md` sessions + the PRs. Don't tombstone superseded plans inside a spec.

## Index

| Spec | Feature | Status |
|------|---------|--------|
| [workshop-interface-spec.md](workshop-interface-spec.md) | Workshop interface + engine composition (MW) | Phase 1 shipped; Phase 2 in progress |
| [part-identity-spec.md](part-identity-spec.md) | Part identity — tiers, specials, engine vocabulary (MP) | Phases 0–2 built; 3–5 pending |
| [chassis-spec.md](chassis-spec.md) | Chassis as the tiered envelope (engine cap) | Built |
| [scrap-stain-decals-spec.md](scrap-stain-decals-spec.md) | Scrap seepage stain decals | Shipped |
| [scrap-pile-polish-spec.md](scrap-pile-polish-spec.md) | Scrap-pile polish — rubble silhouette, pollution, variations, reclaim scar | Built |
| [option-c-build-plan.md](option-c-build-plan.md) | Scrap Piles / the Reclaimer rummage (Option C) | Done — historical staircase |
| [looter-camps-spec.md](looter-camps-spec.md) | Looter camps — enemies around a structure (Option D) | ✏️ Specced, not started |
| [track-marks-spec.md](track-marks-spec.md) | Terrain track marks — fading tread trails under movers | Built (v1, cosmetic) |
| [render-scaling-spec.md](render-scaling-spec.md) | Render scaling for a larger map (spatial index + chunked terrain) | ✏️ Specced, not started |
| [real-world-and-progression-spec.md](real-world-and-progression-spec.md) | Real world vs sandbox · persistence + menu · the progression spine | ✏️ Skeleton, not started |
