/**
 * The workshop interface shell: a bottom-centre "🔧 Open Workshop" tab that appears while the rig
 * is parked in a workshop zone, and a full-screen overlay that opens when it's clicked. Opening the
 * overlay freezes the simulation; closing it resumes.
 *
 * This class owns only the DOM and its own listeners — it knows nothing about the World or the
 * frame loop. It surfaces two seams to the composition root (main.ts):
 *   - `onPauseChange(paused)` fires when the overlay opens (true) or closes (false); main owns the
 *     actual `paused` flag and gates its simulation systems on it.
 *   - `setZoneActive(active)` is pushed in each frame from main (which reads WorkshopZone state), so
 *     the tab tracks proximity without this module ever touching the ECS.
 *
 * The overlay panel is an empty shell for now (P1): the inventory browser, portrait, and assembly
 * bench land in later PRs. The tab is shown only while a zone is active AND the overlay is closed.
 */
export interface WorkshopOverlayOptions {
  /** Fired with `true` when the overlay opens, `false` when it closes — main flips `paused`. */
  onPauseChange(paused: boolean): void;
}

export class WorkshopOverlay {
  private open = false;
  private zoneActive = false;
  private readonly closeBtn: HTMLButtonElement;

  private readonly onTabClick = (): void => this.openOverlay();
  private readonly onCloseClick = (): void => this.closeOverlay();
  // Esc closes, but only while open — so it never steals the key from anything else when closed.
  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (this.open && e.key === 'Escape') this.closeOverlay();
  };

  constructor(
    private readonly tab: HTMLButtonElement,
    private readonly panel: HTMLElement,
    private readonly opts: WorkshopOverlayOptions,
  ) {
    this.closeBtn = panel.querySelector<HTMLButtonElement>('#workshop-close')!;
    this.tab.addEventListener('click', this.onTabClick);
    this.closeBtn.addEventListener('click', this.onCloseClick);
    window.addEventListener('keydown', this.onKeyDown);
    this.syncTab();
    this.syncPanel();
  }

  /** Pushed in each frame by main from the WorkshopZone state. Updates tab visibility. */
  setZoneActive(active: boolean): void {
    if (active === this.zoneActive) return;
    this.zoneActive = active;
    this.syncTab();
  }

  private openOverlay(): void {
    if (this.open) return;
    this.open = true;
    this.opts.onPauseChange(true);
    this.syncPanel();
    this.syncTab(); // hide the tab while the overlay covers it
  }

  private closeOverlay(): void {
    if (!this.open) return;
    this.open = false;
    this.opts.onPauseChange(false);
    this.syncPanel();
    this.syncTab(); // restore the tab if the rig is still in the zone
  }

  /** Tab is visible only while a zone is active and the overlay is closed. */
  private syncTab(): void {
    this.tab.classList.toggle('hidden', !this.zoneActive || this.open);
  }

  private syncPanel(): void {
    this.panel.classList.toggle('hidden', !this.open);
  }

  /** Tear down listeners — for HMR / teardown symmetry; the game itself never disposes it. */
  dispose(): void {
    this.tab.removeEventListener('click', this.onTabClick);
    this.closeBtn.removeEventListener('click', this.onCloseClick);
    window.removeEventListener('keydown', this.onKeyDown);
  }
}
