import type { ZoneDisc } from '@common/render/zone-overlays';

/**
 * The shared bottom-centre "Needs X…" hint — the LOCKED rung of the three-state legibility model
 * (INERT silhouette → LOCKED "you need a tool" → LIVE "do it now"). It mirrors the LIVE prompts'
 * look, recoloured grey (see `#locked-prompt` in `index.html`), so the same screen slot reads in
 * three states.
 *
 * One element serves every feature: of all the LOCKED zone discs in reach this frame, the NEAREST
 * one's requirement is shown, so two locked objects never stack two hints. It yields to any LIVE
 * cue — if any disc is `active` (a workable workshop/shop/pile/stump/camp in reach), the hint hides,
 * since every `.hud-prompt` shares this one bottom-centre slot and they must never overlap. Fed the
 * full disc set from `main.ts`, exactly the list the proximity discs render from, so the dim ring on
 * the ground and this hint key off one truth.
 */
export class LockedPrompt {
  constructor(private readonly el: HTMLElement) {}

  /**
   * Show the nearest locked disc's requirement, or hide. `discs` is this frame's full disc set,
   * `rig` the active rig's spot (null while it has no Transform), `live` false while the sim is
   * frozen or another bottom-centre cue owns the slot.
   */
  sync(discs: readonly ZoneDisc[], rig: { x: number; z: number } | null, live: boolean): void {
    let best: ZoneDisc | null = null;
    let bestDist = Infinity;
    // Suppress the whole hint if anything LIVE is in reach — its prompt owns the shared slot.
    const anyLive = discs.some((d) => d.active);
    if (live && rig && !anyLive) {
      for (const d of discs) {
        if (!d.locked || d.active || !d.lockedLabel) continue;
        const dist = Math.hypot(d.x - rig.x, d.z - rig.z);
        if (dist < bestDist) { bestDist = dist; best = d; }
      }
    }
    if (best && best.lockedLabel) {
      this.el.textContent = `🔒 ${best.lockedLabel}`;
      this.el.classList.remove('hidden');
    } else {
      this.el.classList.add('hidden');
    }
  }
}
