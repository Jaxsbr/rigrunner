import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import type { ComponentType } from '@core/component';
import { Transform } from '@common/components/transform';
import { Collider } from '@common/components/collider';
import type { ZoneDisc } from '@common/render/zone-overlays';

/**
 * The generic "park-near-this-thing" proximity gate, shared by every feature that opens an interface when
 * the rig drives up to a placed structure (the workshop, a world shop, and whatever points-of-interest
 * follow). A gate component carries a `radius` (its reach in metres) and an `active` flag the system
 * recomputes each frame; the prompt/overlay and the ground disc both read that one cached answer.
 *
 * Extracted to `common/sim` once two features (workshop + shop) carried byte-identical circle-vs-circle
 * code — the project's promotion bar (≥2 feature consumers, no feature-specific semantics). The component
 * stays in its feature (it knows it is a shop / a workshop); only the gating MECHANIC lives here, so the
 * two can never silently drift (a fix — hysteresis, a y-term, line-of-sight — lands once, for both).
 */
export interface ProximityGate {
  /** The interaction zone's radius in metres from the structure's centre. */
  radius: number;
  /** Recomputed each frame: true while the rig's collider intersects the zone. The cached truth. */
  active: boolean;
}

/**
 * Recompute each gated structure's `active` flag: true while the rig's collider overlaps the zone, so
 * parking BESIDE the structure counts, not just driving its centre onto the marker —
 *   `distance(rig, structure) ≤ gate.radius + rigColliderRadius`.
 * One boolean write per structure; pure over the World, so it runs and tests headless.
 */
export function recomputeProximityGate<C extends ProximityGate>(
  world: World,
  rig: EntityId,
  gate: ComponentType<C>,
): void {
  const rigT = world.get(rig, Transform);
  const rigR = world.get(rig, Collider)?.radius ?? 0;

  for (const e of world.query(gate, Transform)) {
    const g = world.get(e, gate)!;
    if (!rigT) {
      g.active = false;
      continue;
    }
    const t = world.get(e, Transform)!;
    g.active = Math.hypot(t.x - rigT.x, t.z - rigT.z) <= g.radius + rigR;
  }
}

/**
 * Map every gated structure to a generic ground-disc entry for the shared `ZoneOverlays` (ADR-003 §4):
 * the feature owns "where the disc sits", the render machinery stays feature-agnostic. Lit only while the
 * gate is `active` (the rig is in range). The composition root concatenates each feature's discs.
 */
export function proximityDiscs<C extends ProximityGate>(world: World, gate: ComponentType<C>): ZoneDisc[] {
  const out: ZoneDisc[] = [];
  for (const e of world.query(gate, Transform)) {
    const g = world.get(e, gate)!;
    const t = world.get(e, Transform)!;
    out.push({ id: e, x: t.x, z: t.z, radius: g.radius, active: g.active });
  }
  return out;
}
