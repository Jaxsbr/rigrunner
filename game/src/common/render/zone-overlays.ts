import * as THREE from 'three';
import type { EntityId } from '@core/types';

/**
 * Proximity-zone discs: one flat green circle under each gated interaction, lit ONLY while it is
 * available. A dormant zone draws nothing (the structure — the heap, the workshop — is self-evident,
 * so an idle ring just clutters the ground and covers the scrap stains); the instant a gate lights,
 * the disc fades IN = "park here and go", and it fades OUT when the rig leaves. Each disc is a
 * translucent `glow_green` fill ringed by a thicker, darker `nature_green` border, so the zone reads
 * as a crisp outlined patch rather than a flat wash. The same disc reads identically for every gated
 * thing, on purpose.
 *
 * This is generic render INFRASTRUCTURE (ADR-003 §4): it knows nothing about which feature a disc
 * belongs to. Each feature contributes its discs as a plain `ZoneDisc[]` (see `features/<x>/overlays`)
 * and `main.ts` concatenates them and calls `sync` — so the shared render tier never imports a
 * feature. Discs are created lazily on first sight and dropped when their owner stops appearing in
 * the entry list (e.g. a pile destroyed when emptied).
 *
 * The disc sits BELOW the scrap stains and writes no depth, so an active ring composites under any
 * seepage stain rather than punching a hole in it. The fade mirrors `InteractionHints` (the "Press
 * E" bubble that rides above the same zone), so the disc and its prompt appear/disappear in lockstep.
 */
export interface ZoneDisc {
  id: EntityId;
  x: number;
  z: number;
  radius: number;
  active: boolean;
}

const FADE_IN_RATE = 6;        // opacity units/sec when lighting up (≈0.17 s) — matches the hints
const FADE_OUT_RATE = 3;       // half-speed when going dormant, so the disc lingers (≈0.33 s, twice the fade-in)
const FILL_COLOR = 0x59ff9f;   // glow_green — the lit fill
const BORDER_COLOR = 0x4c8f3a; // nature_green — a darker rim around the fill
const FILL_OPACITY = 0.25;     // fully-lit fill opacity (the disc has always been faint)
const BORDER_OPACITY = 0.7;    // fully-lit border opacity — crisper than the fill so the outline reads
const BORDER_FRAC = 0.08;      // ring thickness as a fraction of radius — a chunky outline
const MIN_BORDER = 0.35;       // metres, so even a small zone keeps a visible border

interface Disc {
  fill: THREE.Mesh;
  border: THREE.Mesh;
  opacity: number; // shared 0→1 fade factor; each material scales its lit opacity by this
  active: boolean;
}

export class ZoneOverlays {
  private readonly discs = new Map<EntityId, Disc>();

  constructor(private readonly scene: THREE.Scene) {}

  /** Reconcile the disc set with this frame's gated entries: upsert each, drop any that vanished. `dt` drives the fade. */
  sync(entries: readonly ZoneDisc[], dt: number): void {
    const seen = new Set<EntityId>();
    for (const e of entries) {
      seen.add(e.id);
      this.upsert(e, dt);
    }
    // Drop discs for any owner that no longer appears (destroyed, or its gate component removed).
    for (const [id, disc] of this.discs) {
      if (!seen.has(id)) {
        this.scene.remove(disc.fill);
        this.scene.remove(disc.border);
        this.discs.delete(id);
      }
    }
  }

  /** Create-or-update the disc for one gated entity, sized to its radius and eased toward `active`. */
  private upsert(e: ZoneDisc, dt: number): void {
    let disc = this.discs.get(e.id);
    if (!disc) {
      // Sized to the zone radius once (radius is fixed) and reused thereafter. depthWrite off + a y
      // just under the stains (≈0.02) so an active disc never occludes a seepage stain inside it.
      const fill = new THREE.Mesh(
        new THREE.CircleGeometry(e.radius, 48),
        new THREE.MeshBasicMaterial({ color: FILL_COLOR, transparent: true, opacity: 0, depthWrite: false }),
      );
      fill.rotation.x = -Math.PI / 2;
      fill.visible = false;

      // A thick darker rim hugging the disc's edge. Drawn a hair above the fill so the two coplanar
      // transparent layers don't z-fight, and over a slightly wider arc so the outline reads crisp.
      const thickness = Math.max(MIN_BORDER, e.radius * BORDER_FRAC);
      const border = new THREE.Mesh(
        new THREE.RingGeometry(Math.max(0, e.radius - thickness), e.radius, 48),
        new THREE.MeshBasicMaterial({ color: BORDER_COLOR, transparent: true, opacity: 0, depthWrite: false }),
      );
      border.rotation.x = -Math.PI / 2;
      border.visible = false;

      this.scene.add(fill);
      this.scene.add(border);
      disc = { fill, border, opacity: 0, active: e.active };
      this.discs.set(e.id, disc);
    }

    disc.fill.position.set(e.x, 0.012, e.z);   // below the scrap stains; above the ground/grid
    disc.border.position.set(e.x, 0.013, e.z); // a hair above the fill to avoid z-fighting

    // Ease the shared fade factor toward the gate state, then scale each layer's lit opacity by it.
    // Fade out runs at half the fade-in rate, so a zone lights up briskly but lingers as the rig leaves.
    const target = e.active ? 1 : 0;
    const rate = target > disc.opacity ? FADE_IN_RATE : FADE_OUT_RATE;
    disc.opacity += Math.sign(target - disc.opacity) * Math.min(dt * rate, Math.abs(target - disc.opacity));
    disc.active = e.active;
    const visible = disc.opacity > 0.01;
    (disc.fill.material as THREE.MeshBasicMaterial).opacity = disc.opacity * FILL_OPACITY;
    (disc.border.material as THREE.MeshBasicMaterial).opacity = disc.opacity * BORDER_OPACITY;
    disc.fill.visible = visible;
    disc.border.visible = visible;
  }
}
