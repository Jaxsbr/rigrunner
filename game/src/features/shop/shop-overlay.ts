import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { EnginePart } from '@common/parts/engine-part';
import { partDef, type PartDef } from '@common/parts/parts-catalog';
import { tierOf } from '@common/parts/tiers';
import { partColorKey as keyOf, partTint as tintOf, cssHex } from '@common/parts/part-color';
import { inventoryItems } from '@features/economy/inventory';
import { getWallet } from '@features/economy/wallet';
import { createModelPortrait, type ModelPortrait } from '@shared/model-portrait';
import { shopItemForPart, shopStockForTier, type PartShopItem } from './part-shop';
import { buyPart, purchaseVerdict, resaleValue, sellPart } from './shop';
import { partDescription } from './part-descriptions';
import { WorldShop } from './world-shop';

/**
 * The world-shop interface: a bottom-centre "🛒 Open Shop" tab that appears while the rig is parked in
 * a shop's zone, and a full-screen overlay that opens on click — or by pressing E in the zone (the
 * in-world "Press E" hint). Opening freezes the simulation; closing (✕ or Escape) resumes. It is the
 * in-world replacement for the old workshop Shop tab (the workshop now only builds/assembles/banks).
 *
 * One reusable surface: opening reads the in-range `WorldShop`'s `tier`, and the shop sells the FULL
 * priced catalogue at that grade — there is no per-shop stock subset (buying is "any part the shop sells,
 * always available"). Buying mints the part at the shop's tier into Inventory; selling values a loose part
 * at its OWN tier and resells it at a loss to ANY shop (a greedy buyer that takes parts it doesn't sell).
 * The left column lists the catalogue (buy) and your loose parts (sell); the right column inspects the
 * focused entry — its portrait and the **self-describing blurb** that teaches what the part is for.
 *
 * Mutates the World only through the shop transaction seam (`buyPart`/`sellPart`) and reads Inventory +
 * Wallet — never a parallel store, so state survives close/reopen. It surfaces seams to the composition
 * root: `onPauseChange(paused)` (open ⇒ true), `setActiveShop(entity)` (pushed each frame so the tab
 * tracks proximity), and `isBusy()` — true when another sim-freezing overlay already holds the pause, so
 * one E press in overlapping zones can't stack two interfaces.
 */
export interface ShopOverlayOptions {
  /** Fired with `true` when the overlay opens, `false` when it closes — bootstrap flips `paused`. */
  onPauseChange(paused: boolean): void;
  /** True while the sim is already paused by another overlay — the shop must not open on top of it. */
  isBusy(): boolean;
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** A chassis sub-part's size badge (e.g. " (1×3)"), so the scout and hauler chassis parts — which share a
 *  displayName like "Chassis Frame" — are never indistinguishable in the buy list. Empty for non-chassis. */
const sizeSuffix = (def: PartDef): string => (def.chassisSize ? ` (${def.chassisSize.replace('x', '×')})` : '');

/** A selection: a stock line to buy (no entity yet) or a loose inventory part to sell. */
type Selection =
  | { mode: 'buy'; item: PartShopItem }
  | { mode: 'sell'; entity: EntityId; item: PartShopItem };

export class ShopOverlay {
  private open = false;
  private activeShop: EntityId | null = null; // the in-range shop, pushed each frame
  private shop: EntityId | null = null; // the shop this open session is scoped to (captured at open)
  private selected: Selection | null = null;

  private readonly closeBtn: HTMLButtonElement;
  private readonly titleEl: HTMLElement;
  private readonly walletEl: HTMLElement;
  private readonly listEl: HTMLElement;
  private readonly detailEl: HTMLElement;
  private readonly portrait: ModelPortrait;

  private readonly onTabClick = (): void => this.openOverlay();
  private readonly onCloseClick = (): void => this.closeOverlay();
  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (this.open) {
      if (e.key === 'Escape') this.closeOverlay();
      return;
    }
    // Press E while parked in a shop zone to open — the keyboard equivalent of clicking the tab,
    // matching the in-world "Press E" hint. `!e.repeat` so a held key fires once.
    if (this.activeShop !== null && !e.repeat && e.key.toLowerCase() === 'e') this.openOverlay();
  };
  private readonly onResize = (): void => this.portrait.resize();

  constructor(
    private readonly tabEl: HTMLButtonElement,
    private readonly panel: HTMLElement,
    private readonly world: World,
    private readonly opts: ShopOverlayOptions,
  ) {
    this.closeBtn = panel.querySelector<HTMLButtonElement>('#shop-close')!;
    this.titleEl = panel.querySelector<HTMLElement>('#shop-title')!;
    this.walletEl = panel.querySelector<HTMLElement>('#shop-wallet')!;
    this.listEl = panel.querySelector<HTMLElement>('#shop-list')!;
    this.detailEl = panel.querySelector<HTMLElement>('#shop-detail')!;
    this.portrait = createModelPortrait(panel.querySelector<HTMLElement>('#shop-portrait-host')!);

    this.tabEl.addEventListener('click', this.onTabClick);
    this.closeBtn.addEventListener('click', this.onCloseClick);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('resize', this.onResize);

    this.syncTab();
    this.syncPanel();
  }

  /** Pushed each frame by the composition root: the shop whose zone the rig is in (or null). */
  setActiveShop(entity: EntityId | null): void {
    if (entity === this.activeShop) return;
    this.activeShop = entity;
    this.syncTab();
  }

  private openOverlay(): void {
    // Don't open over an already-open sim-freezing overlay. Both this and the workshop bind a window
    // `keydown` 'E' listener; where a shop zone overlaps a workshop zone, one press fires both. The first
    // to open flips the shared `paused` bit (synchronously, via onPauseChange), so the second sees
    // `isBusy()` and bows out — only one interface opens, instead of two stacked modals.
    if (this.open || this.activeShop === null || this.opts.isBusy()) return;
    this.open = true;
    this.shop = this.activeShop;
    this.selected = null;
    this.opts.onPauseChange(true);
    this.syncPanel();
    this.syncTab(); // hide the tab while the overlay covers it
    this.refresh();
    this.portrait.start();
  }

  private closeOverlay(): void {
    if (!this.open) return;
    this.open = false;
    this.shop = null;
    this.selected = null;
    this.opts.onPauseChange(false);
    this.portrait.stop();
    this.syncPanel();
    this.syncTab(); // restore the tab if the rig is still in the zone
  }

  // ── Rendering ───────────────────────────────────────────────────────────────────────────────

  /** The shop component for the session's scoped shop, or null (it vanished — shouldn't happen). */
  private shopOf(): WorldShop | null {
    return this.shop !== null ? this.world.get(this.shop, WorldShop) ?? null : null;
  }

  /** Rebuild the wallet header, the buy/sell list and the inspect pane from world state. */
  private refresh(): void {
    const shop = this.shopOf();
    if (!shop) return;
    const scrap = getWallet(this.world)?.scrap ?? 0;
    this.titleEl.textContent = `🛒 ${tierOf(shop.tier).name.toUpperCase()} SHOP`;
    this.walletEl.innerHTML = `<span>SCRAP</span><strong>${scrap}</strong>`;
    this.listEl.innerHTML = '';

    // BUY — the full priced catalogue, minted at this shop's tier (always in stock; no per-shop subset).
    this.appendSectionTitle('Buy');
    const buyItems = shopStockForTier(shop.tier);
    for (const item of buyItems) this.listEl.appendChild(this.buyCard(item));

    // SELL — loose inventory parts that have a shop price, valued at their OWN tier.
    this.appendSectionTitle('Sell loose parts');
    const sellRows = inventoryItems(this.world)
      .map((entity) => ({ entity, part: this.world.get(entity, EnginePart) }))
      .map(({ entity, part }) => ({
        entity,
        item: part ? shopItemForPart(part.id, part.tier) : undefined,
      }))
      .filter((r): r is { entity: EntityId; item: PartShopItem } => r.item !== undefined);
    if (sellRows.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'shop-empty';
      empty.textContent = 'No loose parts to sell.';
      this.listEl.appendChild(empty);
    } else {
      for (const { entity, item } of sellRows) this.listEl.appendChild(this.sellCard(entity, item));
    }

    // Default the inspect pane to the first buyable so the teaching blurb is visible without a click.
    if (this.selected === null && buyItems.length > 0) this.selected = { mode: 'buy', item: buyItems[0]! };
    this.renderDetail();
  }

  private appendSectionTitle(label: string): void {
    const title = document.createElement('div');
    title.className = 'shop-section-title';
    title.textContent = label;
    this.listEl.appendChild(title);
  }

  /** A buy line: name + tier finish + cost + Buy. The whole card selects it; Buy purchases. */
  private buyCard(item: PartShopItem): HTMLElement {
    const def = partDef(item.partId)!;
    const verdict = purchaseVerdict(this.world, item);
    const card = this.makeCard(def, item, 'buy');

    const buy = document.createElement('button');
    buy.type = 'button';
    buy.className = 'shop-buy';
    buy.disabled = !verdict.ok;
    buy.title = verdict.ok ? `Buy · ${item.cost} scrap` : verdict.reason;
    buy.innerHTML = `<span class="shop-buy-cost">${item.cost}</span><span class="shop-buy-label">scrap</span>`;
    buy.addEventListener('click', (e) => {
      e.stopPropagation();
      this.doBuy(item);
    });
    card.querySelector<HTMLElement>('.shop-card-side')!.appendChild(buy);
    return card;
  }

  /** A sell line: the loose part valued at its own tier + a Sell button for the resale. */
  private sellCard(entity: EntityId, item: PartShopItem): HTMLElement {
    const def = partDef(item.partId)!;
    const card = this.makeCard(def, item, 'sell');

    const value = resaleValue(item);
    const sell = document.createElement('button');
    sell.type = 'button';
    sell.className = 'shop-sell';
    sell.innerHTML = `<span class="shop-buy-cost">+${value}</span><span class="shop-buy-label">scrap</span>`;
    sell.title = `Sell · +${value} scrap`;
    sell.addEventListener('click', (e) => {
      e.stopPropagation();
      this.doSell(entity);
    });
    card.querySelector<HTMLElement>('.shop-card-side')!.appendChild(sell);
    card.addEventListener('click', () => this.select({ mode: 'sell', entity, item }));
    return card;
  }

  /** The shared card body (dot + tier swatch + composed name + meta) for a buy or sell line. */
  private makeCard(def: PartDef, item: PartShopItem, mode: 'buy' | 'sell'): HTMLElement {
    const tier = tierOf(item.tier);
    const key = keyOf(def);
    const card = document.createElement('div');
    card.className = `shop-card ${key}${mode === 'sell' ? ' sell' : ''}`;
    card.innerHTML =
      `<div class="shop-card-main">` +
      `<div class="shop-card-name-row">` +
      `<span class="shop-dot"></span>` +
      `<span class="shop-finish" style="background:${cssHex(tier.finishColor)}"></span>` +
      `<span class="shop-name">${tier.name} ${def.displayName}${sizeSuffix(def)}</span>` +
      `</div>` +
      `<div class="shop-card-meta">${cap(def.category)} part</div>` +
      `</div>` +
      `<div class="shop-card-side"></div>`;
    if (mode === 'buy') card.addEventListener('click', () => this.select({ mode: 'buy', item }));
    return card;
  }

  /** The inspect pane: portrait + composed name + the self-describing blurb for the focused entry. */
  private renderDetail(): void {
    const sel = this.selected;
    if (!sel) {
      this.detailEl.innerHTML = `<div class="shop-detail-empty">Select a part to inspect it.</div>`;
      this.portrait.show(null);
      return;
    }
    const def = partDef(sel.item.partId)!;
    const tier = tierOf(sel.item.tier);
    const desc = partDescription(def.id) ?? '';
    const priceLine =
      sel.mode === 'buy'
        ? `<div class="shop-price">Buy · <strong>${sel.item.cost}</strong> scrap</div>`
        : `<div class="shop-price sell">Sell · <strong>+${resaleValue(sel.item)}</strong> scrap</div>`;
    this.detailEl.innerHTML =
      `<h4>${tier.name} ${def.displayName}${sizeSuffix(def)}</h4>` +
      `<div class="shop-detail-sub">${tier.name} · ${def.type ?? def.category} · ${def.slot}</div>` +
      (desc ? `<p class="shop-blurb">${desc}</p>` : '') +
      priceLine;
    // Sub-parts render their own GLB washed toward the part's tier finish (rusty here) — the same read
    // the chip and world model carry. A missing GLB falls back to a tinted placeholder block.
    this.portrait.show(def.assetId, { fallbackColor: tintOf(def), tint: tier.finishColor });
  }

  private select(sel: Selection): void {
    this.selected = sel;
    this.renderDetail();
  }

  // ── Transactions ────────────────────────────────────────────────────────────────────────────

  private doBuy(item: PartShopItem): void {
    const result = buyPart(this.world, item);
    if (result.ok) this.selected = { mode: 'buy', item }; // keep it focused after the purchase
    this.refresh();
    if (result.ok) this.bumpWallet();
  }

  private doSell(entity: EntityId): void {
    const result = sellPart(this.world, entity);
    if (result.ok && this.selected?.mode === 'sell' && this.selected.entity === entity) {
      this.selected = null; // the sold part is gone — drop the inspect focus
    }
    this.refresh();
    if (result.ok) this.bumpWallet();
  }

  /** A brief pulse on the wallet readout so each buy/sell visibly "registers" — the tactile cue the old
   *  workshop shop gave by flashing the moved chip. The reflow read restarts the CSS animation each time. */
  private bumpWallet(): void {
    this.walletEl.classList.remove('bumped');
    void this.walletEl.offsetWidth;
    this.walletEl.classList.add('bumped');
  }

  // ── Visibility ──────────────────────────────────────────────────────────────────────────────

  /** Tab is visible only while a shop is in range and the overlay is closed. */
  private syncTab(): void {
    this.tabEl.classList.toggle('hidden', this.activeShop === null || this.open);
  }

  private syncPanel(): void {
    this.panel.classList.toggle('hidden', !this.open);
  }

  /** Tear down listeners + the portrait — for HMR / teardown symmetry. */
  dispose(): void {
    this.portrait.dispose();
    this.tabEl.removeEventListener('click', this.onTabClick);
    this.closeBtn.removeEventListener('click', this.onCloseClick);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('resize', this.onResize);
  }
}
