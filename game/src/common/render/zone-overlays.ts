import * as THREE from 'three';
import type { EntityId } from '@core/types';

/**
 * Proximity-zone discs: one flat circle under each gated interaction, lit while it is in play. This
 * is the ground half of the three-state legibility model every interactive object reads in:
 *   - INERT (out of range) → no disc (the structure is self-evident; an idle ring just clutters).
 *   - LOCKED (`locked`) → a faint, DIM-GREY ring: "you're in reach but lack the tool" — you can't act
 *     yet. It fires before you own the tool, so an inert-looking heap can teach what it needs.
 *   - LIVE (`active`) → a bright `glow_green` ring: "park here and go". `active` wins over `locked`.
 * A lit disc fades IN; it fades OUT when the rig leaves. Each disc is a translucent fill ringed by a
 * thicker, darker border, so the zone reads as a crisp outlined patch rather than a flat wash. The
 * same disc reads identically for every gated thing of a given state, on purpose.
 *
 * This is generic render INFRASTRUCTURE (ADR-003 §4): it knows nothing about which feature a disc
 * belongs to. Each feature contributes its discs as a plain `ZoneDisc[]` (see `features/<x>/overlays`)
 * and `main.ts` concatenates them and calls `sync` — so the shared render tier never imports a
 * feature. Discs are created lazily on first sight and dropped when their owner stops appearing in
 * the entry list (e.g. a pile destroyed when emptied).
 *
 * The disc sits BELOW the scrap stains and writes no depth, so a lit ring composites under any
 * seepage stain rather than punching a hole in it. Its opacity eases in/out with the zone's state, so
 * the lit ring tracks the same proximity the HUD prompt (workshop tab / scrap prompt / locked hint)
 * reflects, and they appear/disappear in lockstep.
 */
export interface ZoneDisc {
  id: EntityId;
  x: number;
  z: number;
  radius: number;
  /** LIVE — the gate is open and the rig can act now (bright green ring + a "Hold/Press E" prompt). */
  active: boolean;
  /** LOCKED — in reach but missing the required tool (dim-grey ring + a "Needs X…" hint). Ignored when `active`. */
  locked?: boolean;
  /** The "Needs X…" requirement the shared locked hint shows when THIS is the nearest locked target. */
  lockedLabel?: string;
}

const FADE_IN_RATE = 12;       // opacity units/sec when lighting up (≈0.08 s) — snaps to full fast, so even a
                               // brief drive-through fully lights rather than flickering a faint partial disc
const FADE_OUT_RATE = 1.5;     // much slower when going dormant (≈0.67 s) — the disc lingers and eases out, so a
                               // momentary activation reads as "lit then slowly faded", never an instant blink
const FILL_COLOR = 0x59ff9f;   // glow_green — the lit (LIVE) fill
const BORDER_COLOR = 0x4c8f3a; // nature_green — a darker rim around the LIVE fill
const LOCKED_FILL_COLOR = 0x8a8f96;   // dim grey — the LOCKED fill ("you need a tool", not "go")
const LOCKED_BORDER_COLOR = 0x4a4d52; // a darker grey rim around the LOCKED fill
const LOCKED_OPACITY_SCALE = 0.6;     // a LOCKED ring is fainter than a LIVE one — present, not inviting
const FILL_OPACITY = 0.25;     // fully-lit fill opacity (the disc has always been faint)
const BORDER_OPACITY = 0.7;    // fully-lit border opacity — crisper than the fill so the outline reads
const BORDER_FRAC = 0.04;      // ring thickness as a fraction of radius — a slim outline
const MIN_BORDER = 0.175;      // metres, so even a small zone keeps a visible border

interface Disc {
  fill: THREE.Mesh;
  border: THREE.Mesh;
  opacity: number; // shared 0→1 fade factor; each material scales its lit opacity by this
  active: boolean;
  locked: boolean; // the last-lit state's look (grey vs green) — held through the fade-out so it doesn't recolour mid-fade
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
      disc = { fill, border, opacity: 0, active: e.active, locked: false };
      this.discs.set(e.id, disc);
    }

    disc.fill.position.set(e.x, 0.012, e.z);   // below the scrap stains; above the ground/grid
    disc.border.position.set(e.x, 0.013, e.z); // a hair above the fill to avoid z-fighting

    // Ease the shared fade factor toward the lit state (LIVE or LOCKED), then scale each layer's lit
    // opacity by it. Fade out runs at half the fade-in rate, so a zone lights up briskly but lingers
    // as the rig leaves. `active` (LIVE) wins over `locked` — a workable zone is never shown as locked.
    const lit = e.active || e.locked === true;
    const target = lit ? 1 : 0;
    const rate = target > disc.opacity ? FADE_IN_RATE : FADE_OUT_RATE;
    disc.opacity += Math.sign(target - disc.opacity) * Math.min(dt * rate, Math.abs(target - disc.opacity));
    disc.active = e.active;
    // Lock in the look while lit so a fade-OUT keeps it (recolouring a half-faded ring would flicker).
    if (lit) disc.locked = !e.active;

    const fillMat = disc.fill.material as THREE.MeshBasicMaterial;
    const borderMat = disc.border.material as THREE.MeshBasicMaterial;
    fillMat.color.setHex(disc.locked ? LOCKED_FILL_COLOR : FILL_COLOR);
    borderMat.color.setHex(disc.locked ? LOCKED_BORDER_COLOR : BORDER_COLOR);
    const lockScale = disc.locked ? LOCKED_OPACITY_SCALE : 1;
    const visible = disc.opacity > 0.01;
    fillMat.opacity = disc.opacity * FILL_OPACITY * lockScale;
    borderMat.opacity = disc.opacity * BORDER_OPACITY * lockScale;
    disc.fill.visible = visible;
    disc.border.visible = visible;
  }
}
