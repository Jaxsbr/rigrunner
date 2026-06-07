import type { World } from '@core/world';
import { LootDrop } from '@common/components/loot-drop';
import { addToInventory } from '@features/economy/inventory';
import { getWallet } from '@features/economy/wallet';
import { partDef, spawnCatalogPart } from '@common/parts/parts-catalog';
import type { LootFind, LootRarity } from '@features/scrap/loot-table';

/**
 * The loot overlay (Option C / PR5): the reveal-and-grant popup for a rummaged-empty pile's hidden
 * finds. It is the view side of the `LootDrop` seam — it owns no truth. Each frame `update()` checks
 * the World for `LootDrop` entities (the rummage system queues one per cleared pile that rolled
 * anything); the first time it sees one it opens, freezes the sim (via `onPauseChange`), and lists
 * the finds. The scrap burst isn't shown here — it was already swept up off the ground during the
 * dig; this popup is only the NON-scrap reward (sub-parts today).
 *
 * "Collect" is the grant: every queued find becomes an owned loose part in `Inventory` (the same
 * store the workshop browses), the `LootDrop` entities are destroyed, and the sim resumes. There is
 * no discard — the plan grants on close. Closing with Escape or the button both collect, so a find
 * is never lost.
 *
 * Future tiers (full part, unique recipe) are dormant stubs in the loot table, so today every find
 * resolves to a catalog sub-part; granting is `spawnCatalogPart` + `addToInventory`. When those tiers
 * land they grant differently (a composed product / a learned recipe) — the seam to extend is here.
 */
export interface LootOverlayOptions {
  /** Fired with `true` when the popup opens, `false` when it closes — main folds it into `paused`. */
  onPauseChange(paused: boolean): void;
}

/** Rarity → accent colour (palette): common = rig_blue, rare = hazard_yellow, epic = a found-relic violet. */
const RARITY_COLOR: Record<LootRarity, string> = {
  guaranteed: '#8b97a0',
  common: '#7fb6e0',
  rare: '#d9a521',
  epic: '#b07fe0',
};

/** A find collapsed for display: the same item rolled twice shows as one row with a ×N count. */
interface FindRow {
  itemId: string;
  rarity: LootRarity;
  tierId: string;
  count: number;
}

export class LootOverlay {
  private open = false;

  private readonly listEl: HTMLElement;
  private readonly collectBtn: HTMLButtonElement;

  private readonly onCollectClick = (): void => this.collect();
  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (this.open && (e.key === 'Escape' || e.key === 'Enter')) this.collect();
  };

  constructor(
    private readonly panel: HTMLElement,
    private readonly world: World,
    private readonly opts: LootOverlayOptions,
  ) {
    this.listEl = panel.querySelector<HTMLElement>('#loot-list')!;
    this.collectBtn = panel.querySelector<HTMLButtonElement>('#loot-collect')!;
    this.collectBtn.addEventListener('click', this.onCollectClick);
    window.addEventListener('keydown', this.onKeyDown);
    this.syncPanel();
  }

  /** Called each frame by main. Opens the popup the frame a LootDrop appears; otherwise idle. */
  update(): void {
    if (this.open) return; // stays open until collected (which destroys the drops)
    if (this.world.query(LootDrop).length > 0) this.openOverlay();
  }

  private openOverlay(): void {
    this.open = true;
    this.opts.onPauseChange(true);
    this.render();
    this.syncPanel();
  }

  /** Grant every queued find to inventory + any wallet scrap to the wallet, destroy the drops, resume. */
  private collect(): void {
    if (!this.open) return;
    const wallet = getWallet(this.world);
    for (const d of this.world.query(LootDrop)) {
      const drop = this.world.get(d, LootDrop)!;
      // Camp loot banks scrap straight to the wallet (a camp isn't a heap to sweep); pile loot leaves
      // this 0 — its scrap was already scattered for drive-over collection.
      if (wallet && drop.walletScrap) wallet.scrap += drop.walletScrap;
      for (const find of drop.finds) {
        const def = partDef(find.itemId);
        if (def) addToInventory(this.world, spawnCatalogPart(this.world, def));
      }
      this.world.destroyEntity(d);
    }
    this.open = false;
    this.opts.onPauseChange(false);
    this.syncPanel();
  }

  /**
   * Build the popup body from every pending LootDrop: a scrap line (always — the guaranteed haul,
   * already scattered for drive-over collection, shown for information) followed by the non-scrap
   * finds, collapsing duplicate finds into ×N rows. When nothing but scrap dropped, the scrap line
   * is the whole popup — so the UI always shows what the pile gave.
   */
  private render(): void {
    let scrap = 0;
    let walletScrap = 0;
    const rows = new Map<string, FindRow>();
    for (const d of this.world.query(LootDrop)) {
      const drop = this.world.get(d, LootDrop)!;
      scrap += drop.scrap;
      walletScrap += drop.walletScrap ?? 0;
      for (const find of drop.finds) this.tally(rows, find);
    }

    this.listEl.innerHTML = '';

    const scrapColor = RARITY_COLOR.guaranteed;
    // Scattered scrap (a pile's burst) — shown only when there is some; collected by driving over the
    // burst, so this reports the amount unearthed, it is not granted again here.
    if (scrap > 0) {
      this.listEl.appendChild(this.scrapCard(scrapColor, 'Scrap unearthed', scrap, 'scattered'));
    }
    // Banked scrap (a camp's payout) — granted straight to the wallet on collect.
    if (walletScrap > 0) {
      this.listEl.appendChild(this.scrapCard(scrapColor, 'Scrap banked', walletScrap, 'to wallet'));
    }

    if (rows.size === 0) {
      const none = document.createElement('div');
      none.className = 'loot-none';
      none.textContent = 'No parts in this one — just scrap.';
      this.listEl.appendChild(none);
    }

    for (const row of rows.values()) {
      const def = partDef(row.itemId);
      const name = def?.displayName ?? row.itemId;
      const tierLabel = row.tierId.replace(/-/g, ' ');
      const color = RARITY_COLOR[row.rarity];
      const card = document.createElement('div');
      card.className = 'loot-card';
      card.style.borderLeftColor = color;
      card.innerHTML =
        `<span class="loot-dot" style="background:${color}"></span>` +
        `<span class="loot-name">${name}</span>` +
        (row.count > 1 ? `<span class="loot-count">×${row.count}</span>` : '') +
        `<span class="loot-tier" style="color:${color}">${tierLabel}</span>`;
      this.listEl.appendChild(card);
    }
  }

  /** A scrap summary card (scattered or banked) — same shape as a find row, no part behind it. */
  private scrapCard(color: string, name: string, count: number, note: string): HTMLElement {
    const card = document.createElement('div');
    card.className = 'loot-card';
    card.style.borderLeftColor = color;
    card.innerHTML =
      `<span class="loot-dot" style="background:${color}"></span>` +
      `<span class="loot-name">${name}</span>` +
      `<span class="loot-count">×${count}</span>` +
      `<span class="loot-tier" style="color:${color}">${note}</span>`;
    return card;
  }

  private tally(rows: Map<string, FindRow>, find: LootFind): void {
    const key = `${find.tierId}:${find.itemId}`;
    const existing = rows.get(key);
    if (existing) existing.count += 1;
    else rows.set(key, { itemId: find.itemId, rarity: find.rarity, tierId: find.tierId, count: 1 });
  }

  private syncPanel(): void {
    this.panel.classList.toggle('hidden', !this.open);
  }

  /** Tear down listeners — for HMR / teardown symmetry. */
  dispose(): void {
    this.collectBtn.removeEventListener('click', this.onCollectClick);
    window.removeEventListener('keydown', this.onKeyDown);
  }
}
