import type { EntityId } from '@core/types';
import { DEFAULT_TIER, type TierId } from '@common/parts/tiers';
import { difficultyFor, gradeDisarm, DISARM, type DisarmGrade } from './disarm';

/**
 * The disarm puzzle overlay (looter camps Phase 2): the timing sweet-spot mini-game that replaces Phase
 * 1's auto-success. It is the VIEW + INPUT side of a disarm — it owns the puzzle run (marker sweep, the
 * per-round target zone, the hit tally) but no sim truth; the moment the rounds finish it grades the run
 * and hands the outcome back through `onResolve`, which applies the loot + damage in the sim.
 *
 * Flow (the commit model from the build grill): main pushes the live gate in each frame via `setReady`.
 * Pressing E when ready OPENS the puzzle — a non-committal preview (Esc backs out free, the camp stays
 * disarmable), so a habitual E never accidentally burns a one-shot camp. The FIRST strike (`Space`)
 * commits you to the full N-round attempt; after that Esc is ignored and you play it out. When the last
 * round lands the overlay grades the run, closes (resuming the sim), resolves the outcome in the sim,
 * and announces the result — the loot overlay then reveals any spoils the next frame.
 *
 * Difficulty rides the trap arm's HEAD tier (`difficultyFor`): a rusty head is three narrow rounds, an
 * iron head one wide round. The marker bounces at a constant pace (`DISARM.crossSeconds`); only the zone
 * width + round count change with tier.
 */
export interface DisarmOverlayOptions {
  /** Fired with `true` when the puzzle opens, `false` when it closes — main folds it into `paused`. */
  onPauseChange(paused: boolean): void;
  /** Resolve the graded disarm in the sim (loot + damage + clear the camp); returns the damage dealt. */
  onResolve(camp: EntityId, grade: DisarmGrade): { damage: number };
  /** Announce the outcome line (grade + damage) — main wires this to the HUD toast. */
  announce(message: string): void;
}

export class DisarmOverlay {
  private open = false;

  // The live gate main pushes in (a DISARMABLE camp in range + a mounted trap arm): the camp to disarm
  // and the head tier that sets the difficulty. Null when no camp is in reach.
  private ready = false;
  private camp: EntityId | null = null;
  private headTier: TierId = DEFAULT_TIER;

  // The active puzzle run.
  private rounds = 0;
  private zoneWidth = 0;
  private results: boolean[] = []; // one entry per landed round: true = hit, false = miss
  private committed = false;
  private markerPos = 0; // 0..1 along the bar
  private markerDir = 1; // +1 / -1 — the bounce direction
  private zoneStart = 0; // 0..(1-zoneWidth)

  private readonly roundsEl: HTMLElement;
  private readonly zoneEl: HTMLElement;
  private readonly markerEl: HTMLElement;

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (this.open) {
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        this.strike();
      } else if (e.key === 'Escape' && !this.committed) {
        this.cancel();
      }
      return;
    }
    // Closed: E opens the puzzle when the gate is up. Ignore key-repeat so a held E opens once.
    if (this.ready && !e.repeat && e.key.toLowerCase() === 'e') this.openOverlay();
  };

  constructor(
    private readonly panel: HTMLElement,
    private readonly opts: DisarmOverlayOptions,
    private readonly rng: () => number = Math.random,
  ) {
    this.roundsEl = panel.querySelector<HTMLElement>('#disarm-rounds')!;
    this.zoneEl = panel.querySelector<HTMLElement>('#disarm-zone')!;
    this.markerEl = panel.querySelector<HTMLElement>('#disarm-marker')!;
    window.addEventListener('keydown', this.onKeyDown);
    this.syncPanel();
  }

  /** Main pushes the disarm gate each frame: whether a camp is in reach, and its head tier. */
  setReady(ready: boolean, camp: EntityId | null, headTier: TierId): void {
    this.ready = ready;
    if (ready) {
      this.camp = camp;
      this.headTier = headTier;
    } else if (!this.open) {
      this.camp = null;
    }
  }

  /** Advance the marker sweep — called every frame by main (the overlay animates while the sim is frozen). */
  tick(dt: number): void {
    if (!this.open) return;
    const speed = 1 / DISARM.crossSeconds;
    this.markerPos += this.markerDir * speed * dt;
    if (this.markerPos >= 1) {
      this.markerPos = 1;
      this.markerDir = -1;
    } else if (this.markerPos <= 0) {
      this.markerPos = 0;
      this.markerDir = 1;
    }
    this.renderMarker();
  }

  private openOverlay(): void {
    if (this.open || this.camp === null) return;
    const diff = difficultyFor(this.headTier);
    this.rounds = diff.rounds;
    this.zoneWidth = diff.zoneWidth;
    this.results = [];
    this.committed = false;
    this.markerPos = 0;
    this.markerDir = 1;
    this.placeZone();
    this.open = true;
    this.opts.onPauseChange(true);
    this.syncPanel();
    this.render();
  }

  /** Land a round: tally hit/miss at the marker's current position, then advance or finish. */
  private strike(): void {
    this.committed = true;
    const hit = this.markerPos >= this.zoneStart && this.markerPos <= this.zoneStart + this.zoneWidth;
    this.results.push(hit);
    if (this.results.length >= this.rounds) {
      this.finish();
    } else {
      this.placeZone();
      this.render();
    }
  }

  /** Grade the run, resume, resolve the outcome in the sim, and announce it. */
  private finish(): void {
    const hits = this.results.filter(Boolean).length;
    const grade = gradeDisarm(hits, this.rounds);
    const camp = this.camp!;
    // Close (resume) BEFORE resolving so the LootDrop the resolve queues is picked up by the loot
    // overlay next frame, not stacked under this one.
    this.close();
    const { damage } = this.opts.onResolve(camp, grade);
    this.opts.announce(messageFor(grade, damage));
  }

  /** Back out of an uncommitted attempt — the camp stays DISARMABLE, nothing spent. */
  private cancel(): void {
    this.close();
  }

  private close(): void {
    this.open = false;
    this.committed = false;
    this.opts.onPauseChange(false);
    this.syncPanel();
  }

  /** Roll a fresh random target zone for the current round and draw it. */
  private placeZone(): void {
    this.zoneStart = this.rng() * (1 - this.zoneWidth);
    this.renderZone();
  }

  private render(): void {
    this.renderRounds();
    this.renderZone();
    this.renderMarker();
  }

  private renderRounds(): void {
    // One pip per round: landed rounds show hit (green) / miss (red); the rest are pending dots.
    const pips: string[] = [];
    for (let i = 0; i < this.rounds; i++) {
      const r = this.results[i];
      const cls = r === undefined ? 'pending' : r ? 'hit' : 'miss';
      pips.push(`<span class="disarm-pip ${cls}"></span>`);
    }
    const label = `Strike ${Math.min(this.results.length + 1, this.rounds)} / ${this.rounds}`;
    this.roundsEl.innerHTML = `<span class="disarm-pips">${pips.join('')}</span><span class="disarm-count">${label}</span>`;
  }

  private renderZone(): void {
    this.zoneEl.style.left = `${this.zoneStart * 100}%`;
    this.zoneEl.style.width = `${this.zoneWidth * 100}%`;
  }

  private renderMarker(): void {
    this.markerEl.style.left = `${this.markerPos * 100}%`;
  }

  private syncPanel(): void {
    this.panel.classList.toggle('hidden', !this.open);
  }

  /** Tear down listeners — for HMR / teardown symmetry. */
  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
  }
}

/** The outcome line shown in the HUD toast after a disarm resolves. */
function messageFor(grade: DisarmGrade, damage: number): string {
  if (grade === 'success') return '✅ Trap disarmed cleanly — full spoils.';
  if (grade === 'partial') {
    return damage > 0
      ? `⚠ Partial disarm — the trap nicked you (−${damage} HP). Common spoils only.`
      : '⚠ Partial disarm — common spoils only.';
  }
  return `✸ Trap sprung! Botched disarm (−${damage} HP). No spoils.`;
}
