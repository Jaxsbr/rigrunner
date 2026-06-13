# `features/terrain/` — the world's bounding terrain

The non-playable terrain that bounds the world. Today that's the **mountain ring** — Phase 1's "bowl
wall" (`real-world-and-progression-spec.md`): the worked, textured floor sits inside a circle of
craggy peaks that physically block the way out, save the exit gaps.

What's here:

- **`mountain-ring`** (`spawnMountainRing`) — places copies of the one `mountain` massif evenly around a
  circle (default radius = the textured floor's corner distance, `MOUNTAIN_RING_RADIUS`), each Solid so
  it blocks the rig, skipping any slot inside a caller-supplied gap (a drivable exit). It exports
  `MountainGap` so a scenario can line a gap up with the camps that guard it.

Single-owner / placement rules at the point of edit:

- **Placement is DETERMINISTIC — no RNG.** This is static scenery seeded in `seedStaticWorld`, which runs
  on BOTH New Game and Continue, so the ring MUST land identically every load (a random ring would
  teleport between sessions, and could drop a peak onto the parked rig). Per-instance yaw/scale/jitter
  come from a per-index hash, not `Math.random`.
- **The mountain is scenery, not a part** — one authored `mountain.glb` (`tools/blender/assets/mountain.py`),
  no tier matrix. It's reused at varied `Renderable.scale` per instance rather than re-authored.
- **Cross-feature direction (ADR-003):** terrain depends downhill only on `@common`/`@core` (the
  components + `GROUND_SIZE`). `@common`/`@core` never import it; the scenario (`app/`) seeds the ring.
