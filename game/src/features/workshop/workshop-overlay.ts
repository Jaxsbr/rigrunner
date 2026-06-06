import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { EnginePart } from '@common/parts/engine-part';
import { Assembly } from '@common/components/assembly';
import { Part } from '@common/components/part';
import { Mount } from '@common/components/mount';
import { MountGrid } from '@common/components/mount-grid';
import { Renderable } from '@common/components/renderable';
import { partDef, type PartDef, type PartSlot, type EnergyType } from '@common/parts/parts-catalog';
import { TIERS, tierOf, type TierId } from '@common/parts/tiers';
import { ELECTRIC_ENGINE_RECIPE, RECIPES, recipeById, type Recipe } from '@common/parts/recipes';
import { shopStockForTier, shopItemForPart, shopPartDef, type PartShopItem } from '@features/workshop/part-shop';
import { productAssetId, productRenderSpec } from '@features/workshop/product-visual';
import { inventoryItems, addToInventory, removeFromInventory } from '@features/economy/inventory';
import { getWallet } from '@features/economy/wallet';
import {
  getBench,
  benchSlots,
  placeOnBench,
  clearBenchSlot,
  benchSlotOf,
  loadRecipe,
} from '@features/workshop/bench';
import {
  sumPartStats,
  resolvePartStats,
  resolveEnergyType,
  productTier,
  type ProductStats,
} from '@common/sim/assembly';
import {
  acceptsType,
  acceptsChassisPart,
  assembleVerdict,
  assemble,
  dismantle,
} from './assembly';
import {
  autoFillBench,
  ownedCountForPart,
  planAutoFillBench,
  recipeSlotNeeds,
  tierCountForPart,
} from './bench-assist';
import {
  workshopEntity,
  stagedProducts,
  stageProduct,
  unstageProduct,
} from '@features/workshop/staging';
import { buyPart, purchaseVerdict, resaleValue, sellPart } from '@features/workshop/shop';
import { closestFreeCellLocal, partFootprint } from '@features/mounting/mounting';
import { createModelPortrait, type ModelPortrait } from '@shared/model-portrait';
import { ModelLoader } from '@shared/model-loader';
import { attachSubParts } from '@shared/assembler';
import { attachStaticHead } from '@common/render/articulation';
import { createDeckView, type DeckView, type DeckPart, type DeckSnapshot } from './deck-view';

/**
 * The workshop interface: a bottom-centre "🔧 Open Workshop" tab that appears while the rig is
 * parked in a workshop zone, and a full-screen overlay that opens when it's clicked — or by pressing
 * E in the zone (the in-world "Press E" hint). Opening the overlay freezes the simulation; closing
 * it (the close button or Escape) resumes.
 *
 * Layout (P7): a persistent INVENTORY rail (left) and INSPECT pane (right, a rotatable portrait +
 * stats of the selection), around a tabbed centre WORKSPACE:
 *   - BENCH tab — pick a recipe, drag loose parts into its role slots, watch the projected product
 *     stats update live (the "side-effects of this combination" readout), then ASSEMBLE.
 *   - WORKSHOP DECK tab — a live 3D view of the workshop deck and the products staged on it. Drag a
 *     product from inventory onto the deck to STAGE it (it snaps to the nearest free cell); click a
 *     staged product to inspect it, then UNSTAGE or DISMANTLE it.
 *   - PARTS SHOP tab — spend banked scrap from Wallet to buy stock parts into Inventory.
 *
 * The deck is the bridge between inventory and the drivable world: staging a product mounts it on
 * the workshop's own grid (gaining world presence), so once the overlay closes the player can grab
 * it off the deck and mount it on the rig with the in-world build interaction — and vice-versa, a
 * product set on the deck in-world (lifted off the rig) shows up here too. Rig-mounting itself stays
 * the tactile in-world drag; this interface owns browse / build / inspect / stage / dismantle.
 *
 * The class reads and mutates the World only through the component model (`Inventory` + `Bench` +
 * the assembly & staging systems), never a parallel store, so state survives close/reopen. It
 * surfaces two seams to main: `onPauseChange(paused)` (open ⇒ true, close ⇒ false) and
 * `setZoneActive(active)`, pushed each frame so the tab tracks proximity.
 */
export interface WorkshopOverlayOptions {
  /** Fired with `true` when the overlay opens, `false` when it closes — main flips `paused`. */
  onPauseChange(paused: boolean): void;
}

/**
 * The chip dot + portrait-placeholder tint, keyed by an item's energy type when it has one (engine
 * parts and engine products), else by its category/kind — so storage items (no electric/steam) get
 * the rig_blue "player-built" signature instead of a missing colour. This colour IS the type cast
 * (`docs/part-identity-spec.md` §3): electric reads cool/clean, steam warm/copper.
 */
const COLOR_BY_KEY: Record<string, number> = {
  electric: 0x59ff9f, // glow_green — cool/clean electric cast
  steam: 0x8a4b2f, // rust — warm/copper steam cast
  storage: 0x2f6f9f, // rig_blue
  reclaimer: 0xd9a521, // hazard_yellow — the rummage tool's signature
  chassis: 0x6b6b6b, // scrap_grey — the structural foundation
};
const tintOf = (colorKey: string): number => COLOR_BY_KEY[colorKey] ?? 0x6b6b6b;
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
/** A colour number as a CSS `#rrggbb` string — for inline tier-finish swatches. */
const cssHex = (n: number): string => '#' + n.toString(16).padStart(6, '0');
/** The small material-finish swatch (§3) that marks a part's tier on a chip / shop card. */
const finishSwatch = (color: number): string =>
  `<span class="wk-tier-finish" style="background:${cssHex(color)}"></span>`;

/** A shop card's role-tag span — omitted when the slot just repeats the part's name (since the strip,
 *  "Shell" / slot "shell"); a part whose name still differs from its role keeps the tag. */
const slotTag = (def: { slot: string; displayName: string }): string =>
  def.slot.toLowerCase() === def.displayName.toLowerCase()
    ? ''
    : `<span class="wk-shop-tag">${def.slot}</span>`;

const DRAG_THRESHOLD = 4; // px the pointer must travel before a press becomes a drag (vs a click)

/** Which centre-workspace tab is showing. */
type Tab = 'bench' | 'deck' | 'shop';

/**
 * A uniform façade over an inventory/bench item, whether it's a loose part or a composed product.
 * `slot` is the part role used to match a bench slot — `null` for products (they don't sit in slots).
 */
interface ItemView {
  entity: EntityId;
  displayName: string; // the composed label shown on the chip — "{Tier} {Slot}" for a part ("Iron Shell")
  baseName: string; // the un-prefixed noun ("Shell") — what the slot tag is checked against for redundancy
  colorKey: string; // chip dot/tint key: electric | steam | storage
  tag: string; // small right-aligned chip tag: the part role, or the product kind
  sub: string; // detail subtitle, e.g. "electric · casing" or "electric · engine"
  attrs: ProductStats; // the RESOLVED (tier-scaled) stats to show
  assetId: string | null; // portrait asset (unregistered id → tinted placeholder; null → empty)
  tierFinish?: number; // the part's tier finish colour (§3) — chip swatch + portrait tint; omitted for mixed-tier products
  slot: PartSlot | null; // bench role; null = product (not bench-droppable)
  type?: EnergyType; // energy type for the no-hybrid drop rule
  isProduct: boolean;
}

/** Where a part being dragged came from — used to validate the drop and to return it on cancel. */
type DragSource = { kind: 'inventory' } | { kind: 'bench'; slot: string };

interface DragState {
  view: ItemView;
  source: DragSource;
  chip: HTMLElement;
  startX: number;
  startY: number;
  offsetX: number; // cursor offset within the chip, so the ghost grabs where you clicked
  offsetY: number;
  ghost: HTMLElement | null; // created once the threshold is crossed
}

export class WorkshopOverlay {
  private open = false;
  private zoneActive = false;
  private tab: Tab = 'bench';
  private selected: EntityId | null = null;
  private drag: DragState | null = null;

  private readonly closeBtn: HTMLButtonElement;
  private readonly invList: HTMLElement;
  private readonly tabBenchBtn: HTMLButtonElement;
  private readonly tabDeckBtn: HTMLButtonElement;
  private readonly tabShopBtn: HTMLButtonElement;
  private readonly benchPanel: HTMLElement;
  private readonly deckPanel: HTMLElement;
  private readonly shopPanel: HTMLElement;
  private readonly shopWalletEl: HTMLElement;
  private readonly shopListEl: HTMLElement;
  private readonly deckHost: HTMLElement;
  private readonly recipeTabsEl: HTMLElement;
  private readonly recipeEl: HTMLElement;
  private readonly benchEl: HTMLElement;
  private readonly benchPreviewEl: HTMLElement;
  private readonly autoFillBtn: HTMLButtonElement;
  private readonly assembleBtn: HTMLButtonElement;
  private readonly detailEl: HTMLElement;
  private readonly portrait: ModelPortrait;
  private readonly deck: DeckView;
  private readonly slotEls = new Map<string, HTMLElement>();
  private renderedRecipeId: string | null = null; // which recipe's slot DOM is currently built
  private decorateHead = false; // gate: attach the bucket head only for the assembled Reclaimer product
  private headTint?: number; // the selected Reclaimer's bucket finish — the decorate hook tints the head with it
  // Set per selection: the inspect portrait composes a product's sub-parts onto its host (engine/storage)
  // through the shared assembler, mirroring the world/deck/viewer. Null for a loose part or a whole-GLB product.
  private composeSpec: { groupId: string; tiers: Record<string, TierId> } | null = null;
  private readonly headLoader = new ModelLoader(); // loads the Reclaimer bucket / composed sub-parts for the portrait

  private readonly onCloseClick = (): void => this.closeOverlay();
  private readonly onTabClick = (): void => this.openOverlay();
  private readonly onAutoFillClick = (): void => this.autoFillActive();
  private readonly onAssembleClick = (): void => this.assembleActive();
  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (this.open) {
      if (e.key === 'Escape') this.closeOverlay();
      return;
    }
    // Press E while parked in a workshop zone to open the interface — the keyboard equivalent of
    // clicking the tab, matching the in-world "Press E" hint. `!e.repeat` so a held key fires once.
    if (this.zoneActive && !e.repeat && e.key.toLowerCase() === 'e') this.openOverlay();
  };
  private readonly onPointerMove = (e: PointerEvent): void => this.handlePointerMove(e);
  private readonly onPointerUp = (e: PointerEvent): void => this.handlePointerUp(e);
  private readonly onResize = (): void => {
    this.portrait.resize();
    this.deck.resize();
  };

  constructor(
    private readonly tabEl: HTMLButtonElement,
    private readonly panel: HTMLElement,
    private readonly world: World,
    private readonly opts: WorkshopOverlayOptions,
  ) {
    this.closeBtn = panel.querySelector<HTMLButtonElement>('#workshop-close')!;
    this.invList = panel.querySelector<HTMLElement>('#wk-inv-list')!;
    this.tabBenchBtn = panel.querySelector<HTMLButtonElement>('#wk-tab-bench')!;
    this.tabDeckBtn = panel.querySelector<HTMLButtonElement>('#wk-tab-deck')!;
    this.tabShopBtn = panel.querySelector<HTMLButtonElement>('#wk-tab-shop')!;
    this.benchPanel = panel.querySelector<HTMLElement>('#wk-bench-panel')!;
    this.deckPanel = panel.querySelector<HTMLElement>('#wk-deck-panel')!;
    this.shopPanel = panel.querySelector<HTMLElement>('#wk-shop-panel')!;
    this.shopWalletEl = panel.querySelector<HTMLElement>('#wk-shop-wallet')!;
    this.shopListEl = panel.querySelector<HTMLElement>('#wk-shop-list')!;
    this.deckHost = panel.querySelector<HTMLElement>('#wk-deck-host')!;
    this.recipeTabsEl = panel.querySelector<HTMLElement>('#wk-recipe-tabs')!;
    this.recipeEl = panel.querySelector<HTMLElement>('#wk-recipe')!;
    this.benchEl = panel.querySelector<HTMLElement>('#wk-bench-slots')!;
    this.benchPreviewEl = panel.querySelector<HTMLElement>('#wk-bench-preview')!;
    this.autoFillBtn = panel.querySelector<HTMLButtonElement>('#wk-autofill')!;
    this.assembleBtn = panel.querySelector<HTMLButtonElement>('#wk-assemble')!;
    this.detailEl = panel.querySelector<HTMLElement>('#wk-detail')!;
    this.portrait = createModelPortrait(panel.querySelector<HTMLElement>('#wk-portrait-host')!, {
      // Compose the Reclaimer's bucket head onto the arm ONLY when previewing the assembled Reclaimer
      // PRODUCT (arm + bucket as one tool), matching the live world. The loose `reclaimer-arm`
      // sub-part shares the same arm GLB but must show bare — `decorateHead` (set per selection in
      // renderDetail) distinguishes the two, since the decorate hook only sees the asset id.
      decorate: (assetId, model) =>
        this.composeSpec
          ? attachSubParts(model, this.composeSpec.groupId, this.composeSpec.tiers, this.headLoader).then(() => {})
          : this.decorateHead
            ? attachStaticHead(assetId, model, this.headLoader, this.headTint)
            : undefined,
    });
    this.deck = createDeckView(this.deckHost, { onSelect: (e) => this.onDeckSelect(e) });

    this.tabEl.addEventListener('click', this.onTabClick);
    this.closeBtn.addEventListener('click', this.onCloseClick);
    this.tabBenchBtn.addEventListener('click', () => this.switchTab('bench'));
    this.tabDeckBtn.addEventListener('click', () => this.switchTab('deck'));
    this.tabShopBtn.addEventListener('click', () => this.switchTab('shop'));
    this.autoFillBtn.addEventListener('click', this.onAutoFillClick);
    this.assembleBtn.addEventListener('click', this.onAssembleClick);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('resize', this.onResize);

    this.syncTab();
    this.syncPanel();
    this.syncTabButtons();
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
    this.refresh();
    this.portrait.start();
    if (this.tab === 'deck') this.deck.start();
  }

  private closeOverlay(): void {
    if (!this.open) return;
    this.open = false;
    this.cancelDrag();
    this.opts.onPauseChange(false);
    this.portrait.stop();
    this.deck.stop();
    this.syncPanel();
    this.syncTab(); // restore the tab if the rig is still in the zone
  }

  // ── Tabs ────────────────────────────────────────────────────────────────────────────────────

  /**
   * Switch the centre workspace tab. Deliberately light — it only toggles panel visibility and
   * starts/stops the deck render loop; it does NOT rebuild the inventory list or bench DOM (those
   * don't change with the tab), so an in-flight drag whose source chip lives in the inventory stays
   * valid across an auto-switch to the deck.
   */
  private switchTab(tab: Tab): void {
    if (tab === this.tab) return;
    this.tab = tab;
    this.syncTabButtons();
    if (tab === 'deck') {
      this.deck.resize();
      this.renderDeck();
      if (this.open) this.deck.start();
    } else {
      this.deck.stop();
    }
    if (tab === 'shop') this.renderShop();
  }

  private syncTabButtons(): void {
    this.tabBenchBtn.classList.toggle('active', this.tab === 'bench');
    this.tabDeckBtn.classList.toggle('active', this.tab === 'deck');
    this.tabShopBtn.classList.toggle('active', this.tab === 'shop');
    this.benchPanel.classList.toggle('hidden', this.tab !== 'bench');
    this.deckPanel.classList.toggle('hidden', this.tab !== 'deck');
    this.shopPanel.classList.toggle('hidden', this.tab !== 'shop');
  }

  // ── DOM construction ──────────────────────────────────────────────────────────────────────

  /** The recipe currently loaded on the bench (falls back to the electric engine recipe). */
  private activeRecipe(): Recipe {
    const bench = getBench(this.world);
    return (bench && recipeById(bench.recipeId)) ?? ELECTRIC_ENGINE_RECIPE;
  }

  /** (Re)build the bench's role slots for a recipe — replaces any slots from a previous recipe. */
  private rebuildBenchSlots(recipe: Recipe): void {
    this.benchEl.innerHTML = '';
    this.slotEls.clear();
    for (const { slot, label } of recipe.slots) {
      const el = document.createElement('div');
      el.className = 'wk-slot';
      el.dataset['drop'] = `slot:${slot}`;
      const labelEl = document.createElement('div');
      labelEl.className = 'wk-slot-label';
      labelEl.textContent = label;
      el.appendChild(labelEl);
      this.benchEl.appendChild(el);
      this.slotEls.set(slot, el);
    }
    this.renderedRecipeId = recipe.id;
  }

  /** The recipe picker — one tab per buildable; the active one is highlighted. */
  private renderRecipeTabs(): void {
    const activeId = this.activeRecipe().id;
    this.recipeTabsEl.innerHTML = '';
    for (const r of RECIPES) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'wk-recipe-tab' + (r.id === activeId ? ' active' : '');
      btn.textContent = r.output;
      btn.addEventListener('click', () => this.switchRecipe(r.id));
      this.recipeTabsEl.appendChild(btn);
    }
  }

  /**
   * Pick a recipe to BUILD. This is a working-bench intent, so it always leaves any product-inspect
   * view (clears the selection). If it's a different recipe than the one loaded, any parts currently
   * on the bench return to inventory first (conserved — switching never destroys a part), then the
   * bench reshapes to the new recipe's slots.
   */
  private switchRecipe(id: string): void {
    this.selected = null; // selecting a recipe to build exits the read-only inspect view
    const bench = getBench(this.world);
    const recipe = recipeById(id);
    if (bench && recipe && bench.recipeId !== id) {
      for (const slot of Object.keys(bench.slots)) {
        const part = clearBenchSlot(this.world, slot);
        if (part !== null) addToInventory(this.world, part);
      }
      loadRecipe(this.world, recipe.id, recipe.slots.map((s) => s.slot));
    }
    this.refresh();
  }

  /**
   * A chip for an item (a loose part or a composed product). Interactive by default — draggable and
   * selectable. A `disabled` chip is read-only: it shows the same content but takes no pointer events
   * (used for a product's sub-parts when the bench is inspecting it — see `inspectedAssembly`).
   */
  private makeChip(view: ItemView, opts: { disabled?: boolean } = {}): HTMLElement {
    const chip = document.createElement('div');
    chip.className =
      `wk-chip ${view.colorKey}` + (view.isProduct ? ' product' : '') + (opts.disabled ? ' disabled' : '');
    chip.dataset['entity'] = String(view.entity);
    if (!opts.disabled && view.entity === this.selected) chip.classList.add('selected');
    // Drop the role tag when it just repeats the noun — a part's name IS its slot noun ("Shell" /
    // slot "shell"), so the tag would read "Shell shell". Checked against `baseName`, the un-prefixed
    // noun, so the composed "Iron Shell" still drops its redundant "shell" tag. A name that differs
    // from its role (a chassis part: "Wheel & Axle Set" / "wheel-axle", or a product's kind) keeps it.
    const showTag = view.tag.toLowerCase() !== view.baseName.toLowerCase();
    chip.innerHTML =
      `<span class="wk-dot"></span>` +
      (view.tierFinish !== undefined ? finishSwatch(view.tierFinish) : '') +
      `<span class="wk-name">${view.displayName}</span>` +
      (showTag ? `<span class="wk-slot-tag">${view.tag}</span>` : '');
    if (!opts.disabled) chip.addEventListener('pointerdown', (e) => this.beginDrag(e, view));
    return chip;
  }

  /** Rebuild the inventory list + bench + deck (if shown) from world state; re-apply selection. */
  private refresh(): void {
    // Inventory list.
    this.invList.innerHTML = '';
    const items = inventoryItems(this.world);
    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'wk-inv-empty';
      empty.textContent = 'Empty — every part is on the bench or the deck.';
      this.invList.appendChild(empty);
    } else {
      for (const entity of items) {
        const view = this.viewOf(entity);
        if (view) this.invList.appendChild(this.makeChip(view));
      }
    }

    // The bench has two modes. Working mode (default): the live bench for the active recipe, with
    // the recipe picker + a projected-stats preview + Assemble. Inspect mode (a composed product is
    // selected): a READ-ONLY view of that product's sub-parts in its recipe's slots, so the player
    // can read what it's made of before dismantling. The slot DOM is rebuilt only when the shape changes.
    const inspected = this.inspectedAssembly();
    const recipe = inspected ? inspected.recipe : this.activeRecipe();
    const needs = recipeSlotNeeds(this.world, recipe);
    this.renderRecipeTabs();
    if (this.renderedRecipeId !== recipe.id) this.rebuildBenchSlots(recipe);

    // Bench slots — filled from the inspected product's parts, or the live working bench.
    const slots = benchSlots(this.world);
    let filled = 0;
    for (const { slot } of recipe.slots) {
      const el = this.slotEls.get(slot)!;
      while (el.children.length > 1) el.removeChild(el.lastChild!); // keep the label (index 0)
      const entity = inspected ? (inspected.parts[slot] ?? null) : (slots[slot] ?? null);
      const view = entity !== null ? this.viewOf(entity) : null;
      if (entity !== null && view) {
        filled++;
        el.appendChild(this.makeChip(view, { disabled: inspected !== null }));
      } else {
        const need = needs.find((n) => n.slot === slot);
        const owned = need?.owned.length ?? 0;
        const empty = document.createElement('div');
        empty.className = `wk-slot-empty ${owned > 0 ? 'owned' : 'missing'}`;
        empty.innerHTML =
          `<span>Needs ${need?.def?.displayName ?? slot}</span>` +
          `<span>${owned > 0 ? `${owned} owned` : 'buy in shop'}</span>`;
        el.appendChild(empty);
      }
    }

    // Header + picker + preview + Assemble switch between the two modes.
    if (inspected) {
      const product = this.viewOf(this.selected!);
      this.recipeEl.textContent = `${product?.displayName ?? recipe.output} · assembled`;
    } else {
      this.recipeEl.textContent = `${recipe.output} · ${filled} / ${recipe.slots.length} parts`;
    }
    this.recipeTabsEl.style.display = inspected ? 'none' : '';
    this.renderBenchPreview(recipe, inspected !== null);
    this.renderAssemble(recipe, inspected !== null);
    this.renderShop();
    this.renderDetail();
    if (this.tab === 'deck') this.renderDeck();
  }

  /**
   * When the selected inventory item is a composed product, the bench enters read-only INSPECT mode:
   * it shows that product's recipe with its sub-parts dropped into the matching slots (disabled), so
   * the player can read its composition before deciding to dismantle. Returns null otherwise.
   */
  private inspectedAssembly(): { recipe: Recipe; parts: Record<string, EntityId> } | null {
    if (this.selected === null) return null;
    const asm = this.world.get(this.selected, Assembly);
    if (!asm) return null;
    const recipe = recipeById(asm.recipeId);
    if (!recipe) return null;
    const parts: Record<string, EntityId> = {};
    for (const e of asm.parts) {
      const ep = this.world.get(e, EnginePart);
      const def = ep ? partDef(ep.id) : undefined;
      if (def) parts[def.slot] = e; // pair each sub-part to its role slot
    }
    return { recipe, parts };
  }

  /**
   * The live "what you'll get" readout under the bench slots: the projected product stats summed
   * from whatever parts are placed so far (partial while incomplete), plus the resolved energy type
   * — so the player can compare combinations BEFORE committing to Assemble. Hidden while inspecting
   * an already-assembled product (its real stats show in the Inspect pane instead).
   */
  private renderBenchPreview(recipe: Recipe, inspecting: boolean): void {
    if (inspecting) {
      this.benchPreviewEl.style.display = 'none';
      return;
    }
    this.benchPreviewEl.style.display = '';
    const filled = Object.values(benchSlots(this.world)).filter((e): e is EntityId => e !== null);
    const stats = sumPartStats(this.world, filled);
    const defs = filled
      .map((e) => {
        const ep = this.world.get(e, EnginePart);
        return ep ? partDef(ep.id) : undefined;
      })
      .filter((d): d is NonNullable<typeof d> => d != null);
    const { type, mismatch } = resolveEnergyType(defs);
    const typeLabel = mismatch
      ? `<span class="wk-bp-bad">mixed — one type only</span>`
      : type
        ? `<span class="${type}">${cap(type)}</span>`
        : recipe.productKind === 'engine'
          ? '—'
          : cap(recipe.productKind);
    // The projected readout fits the build: a chassis shows its three contributed attributes; a
    // storage container leads with capacity (so dropping an iron Shell/Rim previews the bigger hold
    // before you commit); every other product shows the engine-shaped power/torque/weight triple.
    const statRows = recipe.productKind === 'chassis'
      ? `<span class="k">grip</span><span class="v">${stats.grip ?? 0}</span>` +
        `<span class="k">turning</span><span class="v">${stats.turning ?? 0}</span>` +
        `<span class="k">load cap</span><span class="v">${stats.loadCapacity ?? 0}</span>`
      : recipe.productKind === 'storage'
      ? `<span class="k">capacity</span><span class="v">${stats.capacity ?? 0}</span>` +
        `<span class="k">weight</span><span class="v">${stats.weight}</span>`
      : `<span class="k">power</span><span class="v">${stats.power}</span>` +
        `<span class="k">torque</span><span class="v">${stats.torque}</span>` +
        `<span class="k">weight</span><span class="v">${stats.weight}</span>`;
    this.benchPreviewEl.innerHTML =
      `<div class="wk-bp-title">Projected ${recipe.output.toLowerCase()} · ${typeLabel}</div>` +
      `<div class="wk-bp-stats">${statRows}</div>`;
  }

  /**
   * The Assemble action: enabled only when the bench can assemble the active recipe (all slots
   * filled, one consistent energy type). Otherwise it's disabled and shows WHY.
   */
  private renderAssemble(recipe: Recipe, inspecting = false): void {
    this.autoFillBtn.style.display = inspecting ? 'none' : '';
    this.assembleBtn.style.display = inspecting ? 'none' : '';
    if (inspecting) return;

    const plan = planAutoFillBench(this.world, recipe);
    if (plan.entries.length > 0 && plan.complete) {
      this.autoFillBtn.disabled = false;
      this.autoFillBtn.textContent = 'Build from Inventory';
      this.autoFillBtn.title = 'Fill the bench with owned matching parts, then assemble the product.';
    } else if (plan.entries.length > 0) {
      this.autoFillBtn.disabled = false;
      this.autoFillBtn.textContent = 'Auto-fill Available';
      this.autoFillBtn.title = 'Fill every empty slot that has a matching owned part.';
    } else if (!plan.complete) {
      this.autoFillBtn.disabled = false;
      this.autoFillBtn.textContent = 'Buy Missing Parts';
      this.autoFillBtn.title = 'Open the shop list focused on the parts this recipe still needs.';
    } else {
      this.autoFillBtn.disabled = true;
      this.autoFillBtn.textContent = 'Bench Filled';
      this.autoFillBtn.title = '';
    }

    const verdict = assembleVerdict(this.world, recipe);
    this.assembleBtn.disabled = !verdict.ok;
    this.assembleBtn.textContent = verdict.ok ? `⚙ Assemble ${recipe.output}` : verdict.reason;
    this.assembleBtn.title = verdict.ok ? '' : verdict.reason;
  }

  private autoFillActive(): void {
    const recipe = this.activeRecipe();
    const plan = planAutoFillBench(this.world, recipe);
    if (plan.entries.length === 0 && !plan.complete) {
      this.switchTab('shop');
      return;
    }

    autoFillBench(this.world, recipe);
    if (plan.complete && assembleVerdict(this.world, recipe).ok) {
      this.assembleActive();
      return;
    }
    this.refresh();
  }

  /** Assemble the active recipe's parts into a product; select it (→ inspect view) and pulse it. */
  private assembleActive(): void {
    const product = assemble(this.world, this.activeRecipe());
    if (product === null) return; // refused (incomplete / hybrid) — no change
    this.setSelected(product);
    this.flashSnap(product);
  }

  // ── Parts Shop ─────────────────────────────────────────────────────────────────────────────

  /** Render the current stock against the live Wallet total, with the active recipe first. */
  private renderShop(): void {
    const scrap = getWallet(this.world)?.scrap ?? 0;
    this.shopWalletEl.innerHTML = `<span>SCRAP</span><strong>${scrap}</strong>`;
    this.shopListEl.innerHTML = '';

    const recipe = this.activeRecipe();
    this.appendShopSectionTitle(`${recipe.output} Parts`);
    this.appendNeededPartCards(recipe);

    this.appendShopSectionTitle('All Stock');
    for (const item of shopStockForTier(TIERS[0]!.id)) {
      const def = shopPartDef(item);
      if (!def) continue;
      this.shopListEl.appendChild(this.shopBuyCard(def));
    }

    this.appendShopSectionTitle('Sell Loose Parts');
    const sellable = inventoryItems(this.world)
      .map((entity) => ({ entity, part: this.world.get(entity, EnginePart) }))
      .filter((row): row is { entity: EntityId; part: EnginePart } => {
        return row.part != null && shopItemForPart(row.part.id, row.part.tier) != null;
      });

    if (sellable.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'wk-shop-empty';
      empty.textContent = 'No loose parts in inventory.';
      this.shopListEl.appendChild(empty);
      return;
    }

    for (const { entity, part } of sellable) {
      const item = shopItemForPart(part.id, part.tier)!; // an instance is valued at its own tier
      const def = shopPartDef(item)!;
      const key = def.type ?? def.category;
      const tier = tierOf(part.tier);
      const value = resaleValue(item);
      const card = document.createElement('div');
      card.className = `wk-shop-card sell ${key}`;
      card.innerHTML =
        `<div class="wk-shop-main">` +
        `<div class="wk-shop-name-row">` +
        `<span class="wk-shop-dot"></span>` +
        finishSwatch(tier.finishColor) +
        `<span class="wk-shop-name">${tier.name} ${def.displayName}</span>` +
        slotTag(def) +
        `</div>` +
        `<div class="wk-shop-meta">${cap(def.category)} part</div>` +
        `</div>` +
        `<div class="wk-shop-side">` +
        `<div class="wk-shop-cost">${value} scrap</div>` +
        `</div>`;

      const side = card.querySelector<HTMLElement>('.wk-shop-side')!;
      const sell = document.createElement('button');
      sell.type = 'button';
      sell.className = 'wk-sell';
      sell.textContent = 'Sell';
      sell.addEventListener('click', () => this.sellShopPart(entity));
      side.appendChild(sell);

      this.shopListEl.appendChild(card);
    }
  }

  private appendShopSectionTitle(label: string): void {
    const title = document.createElement('div');
    title.className = 'wk-shop-section-title';
    title.textContent = label;
    this.shopListEl.appendChild(title);
  }

  private appendNeededPartCards(recipe: Recipe): void {
    for (const need of recipeSlotNeeds(this.world, recipe)) {
      const def = need.def;
      if (!def) continue;
      const key = def.type ?? def.category;
      const card = this.shopBuyCard(def);
      card.classList.add('needed', key, need.onBench ? 'filled' : 'missing');
      const state = card.querySelector<HTMLElement>('.wk-shop-state')!;
      if (need.onBench !== null) {
        const view = this.viewOf(need.onBench);
        state.textContent = view ? `on bench · ${view.displayName}` : 'on bench';
      } else if (need.owned.length > 0) {
        const best = this.viewOf(need.owned[0]!);
        state.textContent = best ? `${need.owned.length} owned · best ${best.displayName}` : `${need.owned.length} owned`;
      } else {
        state.textContent = 'missing';
      }
      this.shopListEl.appendChild(card);
    }
  }

  private shopBuyCard(def: PartDef): HTMLElement {
    const key = def.type ?? def.category;
    const owned = ownedCountForPart(this.world, def.id);
    const card = document.createElement('div');
    card.className = `wk-shop-card ${key}`;
    card.innerHTML =
      `<div class="wk-shop-main">` +
      `<div class="wk-shop-name-row">` +
      `<span class="wk-shop-dot"></span>` +
      `<span class="wk-shop-name">${def.displayName}</span>` +
      slotTag(def) +
      `</div>` +
      `<div class="wk-shop-meta">${cap(def.category)} part · ${owned} owned</div>` +
      `<div class="wk-shop-state"></div>` +
      `</div>` +
      `<div class="wk-shop-side wk-tier-buy-row"></div>`;

    const side = card.querySelector<HTMLElement>('.wk-shop-side')!;
    for (const tier of TIERS) {
      const item = shopItemForPart(def.id, tier.id);
      if (!item) continue;
      side.appendChild(this.tierBuyButton(item));
    }
    return card;
  }

  private tierBuyButton(item: PartShopItem): HTMLButtonElement {
    const tier = tierOf(item.tier);
    const verdict = purchaseVerdict(this.world, item);
    const ownedAtTier = tierCountForPart(this.world, item.partId, item.tier);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'wk-buy-tier';
    btn.disabled = !verdict.ok;
    btn.title = verdict.ok
      ? `${tier.name} · ${item.cost} scrap · ${ownedAtTier} owned`
      : `${verdict.reason} · ${tier.name} costs ${item.cost} scrap`;
    btn.innerHTML =
      finishSwatch(tier.finishColor) +
      `<span class="wk-buy-tier-name">${tier.name}</span>` +
      `<span class="wk-buy-tier-cost">${item.cost}</span>`;
    btn.addEventListener('click', () => this.buyShopItem(item));
    return btn;
  }

  /** Execute one shop transaction and select the newly owned part. */
  private buyShopItem(item: PartShopItem): void {
    const result = buyPart(this.world, item);
    if (!result.ok) {
      this.refresh();
      return;
    }

    this.selected = result.item;
    this.refresh();
    this.flashSnap(result.item);
  }

  /** Sell one loose inventory part back to the shop and clear it from selection if needed. */
  private sellShopPart(entity: EntityId): void {
    const result = sellPart(this.world, entity);
    if (result.ok && this.selected === entity) this.selected = null;
    this.refresh();
  }

  /**
   * Dismantle the selected product back into its parts (returned to inventory); clear selection.
   * Works whether the product sits in inventory OR is staged on the deck — a staged product is
   * unstaged first (back to inventory), then dismantled, so "dismantle anywhere" holds.
   */
  private dismantleSelected(): void {
    if (this.selected === null) return;
    const product = this.selected;
    if (!this.world.get(product, Assembly)) return; // products only
    if (this.isStaged(product)) unstageProduct(this.world, product); // deck → inventory first
    if (dismantle(this.world, product) === null) return;
    this.setSelected(null);
  }

  /** Pull the selected staged product off the deck and back into inventory (keeps it selected). */
  private unstageSelected(): void {
    if (this.selected === null || !this.isStaged(this.selected)) return;
    unstageProduct(this.world, this.selected);
    this.refresh();
  }

  private autoStageCell(product: EntityId): { col: number; row: number } | null {
    const workshop = workshopEntity(this.world);
    if (workshop === null) return null;
    const fp = partFootprint(this.world, product);
    return closestFreeCellLocal(this.world, workshop, 0, 0, Infinity, fp);
  }

  private stageSelected(): void {
    if (this.selected === null || this.isStaged(this.selected)) return;
    const workshop = workshopEntity(this.world);
    const cell = this.autoStageCell(this.selected);
    if (workshop === null || cell === null) {
      this.switchTab('deck');
      return;
    }
    if (stageProduct(this.world, this.selected, workshop, cell.col, cell.row)) this.refresh();
  }

  /** True if a product is currently staged on the workshop deck (mounted on the workshop). */
  private isStaged(entity: EntityId): boolean {
    const m = this.world.get(entity, Mount);
    return m != null && m.rig === workshopEntity(this.world);
  }

  /** Render the detail panel + portrait for the current selection. */
  private renderDetail(): void {
    const view = this.selected !== null ? this.viewOf(this.selected) : null;
    if (!view) {
      this.decorateHead = false;
      this.headTint = undefined;
      this.detailEl.innerHTML =
        `<div class="wk-detail-empty">Select a part or product to inspect it. Build on the ` +
        `Bench; drag finished products onto the Workshop Deck to stage them.</div>`;
      this.portrait.show(null);
      return;
    }
    // How the selected item draws in the portrait, resolved through the SAME `productRenderSpec` the
    // world and deck use — so the inspect view matches them. A loose part shows its own GLB; a composed
    // product (engine/storage) shows its host GLB and the decorate hook snaps the sub-parts on (each at
    // its tier); a whole-GLB product (chassis/Reclaimer) shows that GLB, the Reclaimer's bucket composed.
    this.decorateHead = false;
    this.composeSpec = null;
    this.headTint = undefined;
    let portraitAsset = view.assetId;
    let baseTint = view.tierFinish;
    if (view.isProduct) {
      const spec = productRenderSpec(this.world, view.entity);
      portraitAsset = spec.assetId; // the host GLB for a composed product, else the whole-product GLB
      baseTint = spec.tint;
      if (spec.compose) {
        this.composeSpec = { groupId: spec.groupId, tiers: spec.tiers };
      } else {
        this.decorateHead = this.world.get(view.entity, Part)?.kind === 'reclaimer';
        this.headTint = spec.headTint;
      }
    }
    const a = view.attrs;
    const staged = view.isProduct && this.isStaged(view.entity);
    const stageCell = view.isProduct && !staged ? this.autoStageCell(view.entity) : null;
    // The attribute readout fits the part: a chassis shows its three contributed attributes + mass; a
    // storage part/container leads with capacity (the felt "iron holds more" stat) + mass; everything
    // else shows the engine-shaped power/torque/weight + the reserved durability/burst. The numbers
    // are RESOLVED through tier, so an iron part reads its scaled values, not the base.
    const attrsHtml = view.colorKey === 'chassis'
      ? `<span class="k">grip</span><span class="v">${a.grip ?? 0}</span>` +
        `<span class="k">turning</span><span class="v">${a.turning ?? 0}</span>` +
        `<span class="k">load cap</span><span class="v">${a.loadCapacity ?? 0}</span>` +
        `<span class="k">weight</span><span class="v">${a.weight}</span>`
      : view.colorKey === 'storage'
      ? `<span class="k">capacity</span><span class="v">${a.capacity ?? 0}</span>` +
        `<span class="k">weight</span><span class="v">${a.weight}</span>` +
        `<span class="k reserved">durability</span><span class="v reserved">${a.durability} (reserved)</span>`
      : `<span class="k">power</span><span class="v">${a.power}</span>` +
        `<span class="k">torque</span><span class="v">${a.torque}</span>` +
        `<span class="k">weight</span><span class="v">${a.weight}</span>` +
        `<span class="k reserved">durability</span><span class="v reserved">${a.durability} (reserved)</span>` +
        `<span class="k reserved">burst</span><span class="v reserved">${a.burst} (reserved)</span>`;
    this.detailEl.innerHTML =
      `<h4>${view.displayName}</h4>` +
      `<div class="wk-detail-sub">${view.sub}${staged ? ' · staged on deck' : ''}</div>` +
      `<div class="wk-attrs">${attrsHtml}</div>` +
      // A product's actions: unstage (only when it's on the deck) + dismantle. A loose part shows a
      // hint that it builds on the bench (it isn't directly stageable).
      (view.isProduct
        ? `<div class="wk-actions">` +
          (staged
            ? `<button id="wk-unstage" class="wk-unstage" type="button">Return to Inventory</button>`
            : `<button id="wk-stage" class="wk-stage" type="button" ${stageCell ? '' : 'disabled'}>` +
              `${stageCell ? 'Stage on Deck' : 'Deck Full'}</button>`) +
          `<button id="wk-dismantle" class="wk-dismantle" type="button">Dismantle</button>` +
          `</div>` +
          (staged ? '' : `<div class="wk-hint">Stage to place it on the workshop deck, then close the panel and grab it in-world.</div>`)
        : `<div class="wk-hint">A sub-part — drop it on a Bench slot to build with it.</div>`);
    if (view.isProduct) {
      if (staged) {
        this.detailEl
          .querySelector<HTMLButtonElement>('#wk-unstage')!
          .addEventListener('click', () => this.unstageSelected());
      } else {
        this.detailEl
          .querySelector<HTMLButtonElement>('#wk-stage')!
          .addEventListener('click', () => this.stageSelected());
      }
      this.detailEl
        .querySelector<HTMLButtonElement>('#wk-dismantle')!
        .addEventListener('click', () => this.dismantleSelected());
    }
    // The portrait wears the tier finish: the placeholder block (most sub-parts have no GLB) takes it
    // as its colour, and a loaded GLB (the container, the Reclaimer arm) is washed toward it — falling
    // back to the type cast when there's no single tier for the base piece (a mixed single-GLB product).
    this.portrait.show(portraitAsset, {
      fallbackColor: baseTint ?? tintOf(view.colorKey),
      ...(baseTint !== undefined ? { tint: baseTint } : {}),
    });
  }

  // ── Deck (3D staging view) ──────────────────────────────────────────────────────────────────

  /** Build the deck snapshot from world state and hand it to the 3D view. */
  private renderDeck(): void {
    this.deck.render(this.deckSnapshot());
  }

  private deckSnapshot(): DeckSnapshot {
    const workshop = workshopEntity(this.world);
    const grid = workshop !== null ? this.world.get(workshop, MountGrid) : null;
    const parts: DeckPart[] = [];
    if (workshop !== null) {
      for (const e of stagedProducts(this.world, workshop)) {
        const m = this.world.get(e, Mount)!;
        // Mirror the staged product's OWN Renderable — the same description the world draws it from — so
        // the deck preview and the world agree: an engine/container composes from its sub-parts (each at
        // its tier), a chassis/Reclaimer draws its whole GLB with its finishes.
        const r = this.world.get(e, Renderable);
        const base = { entity: e, col: m.col, row: m.row, yaw: m.yaw, footprint: partFootprint(this.world, e) };
        if (r?.shape === 'assembly') {
          parts.push({ ...base, groupId: r.groupId, tiers: r.tiers });
        } else if (r?.shape === 'model') {
          parts.push({
            ...base,
            assetId: r.assetId,
            ...(r.tint !== undefined ? { tint: r.tint } : {}),
            ...(r.headTint !== undefined ? { headTint: r.headTint } : {}),
          });
        } else {
          const asm = this.world.get(e, Assembly);
          parts.push({
            ...base,
            assetId: productAssetId(this.world.get(e, Part)?.kind ?? 'engine', asm?.recipeId ?? '', asm?.type),
          });
        }
      }
    }
    return {
      workshopAssetId: 'workshop',
      grid: grid ?? { cols: 3, rows: 3, cellSize: 1, deckY: 0.2 },
      parts,
      selected: this.selected,
    };
  }

  /** A clean click on the 3D deck: select the staged product hit (or clear). */
  private onDeckSelect(entity: EntityId | null): void {
    this.setSelected(entity);
  }

  /** Set (or clear) the selection and repaint — selection drives the bench/deck mode. */
  private setSelected(entity: EntityId | null): void {
    this.selected = entity;
    this.refresh();
  }

  /** Click selection: re-clicking the selected item deselects it (the way out of inspect mode). */
  private toggleSelect(entity: EntityId): void {
    this.setSelected(this.selected === entity ? null : entity);
  }

  // ── Drag-and-drop: inventory ↔ bench, inventory → deck ──────────────────────────────────────

  private beginDrag(e: PointerEvent, view: ItemView): void {
    if (e.button !== 0) return;
    e.preventDefault();
    const chip = e.currentTarget as HTMLElement;
    const rect = chip.getBoundingClientRect();
    const benchSlot = benchSlotOf(this.world, view.entity);
    this.drag = {
      view,
      source: benchSlot ? { kind: 'bench', slot: benchSlot } : { kind: 'inventory' },
      chip,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      ghost: null,
    };
  }

  private handlePointerMove(e: PointerEvent): void {
    const d = this.drag;
    if (!d) return;
    if (!d.ghost) {
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_THRESHOLD) return;
      d.ghost = this.makeGhost(d.chip);
      d.chip.classList.add('dragging');
      // A product can only go to the deck — reveal it so the player sees where the drop will land.
      if (d.view.isProduct && this.tab !== 'deck') this.switchTab('deck');
    }
    d.ghost.style.left = `${e.clientX - d.offsetX}px`;
    d.ghost.style.top = `${e.clientY - d.offsetY}px`;
    this.highlightDropTarget(e.clientX, e.clientY);
  }

  private handlePointerUp(e: PointerEvent): void {
    const d = this.drag;
    if (!d) return;
    this.drag = null;

    if (!d.ghost) {
      this.toggleSelect(d.view.entity); // never crossed the threshold → it was a click
      return;
    }

    this.clearDropHighlights();
    this.deck.highlight(null);
    const dropEl = this.dropTargetAt(e.clientX, e.clientY);
    const moved = this.commitDrop(d, dropEl, e.clientX, e.clientY);
    if (moved) {
      d.ghost.remove();
      d.chip.classList.remove('dragging');
      this.setSelected(null); // refreshes — preview returns to the live build target
      this.flashSnap(d.view.entity);
    } else {
      this.returnGhost(d);
    }
  }

  /**
   * Apply a drop. Returns true if a part actually moved (so the caller refreshes), false if the
   * drop was invalid or a no-op (the ghost glides back — the tactile "refusal").
   *
   * Rules:
   *  - inventory part → a bench slot: allowed only when the slot matches the part's role, is empty,
   *    and the type doesn't clash (no-hybrid). The part leaves inventory and takes the slot.
   *  - bench part → the inventory list: always allowed; the slot empties and the part returns.
   *  - inventory PRODUCT → the deck: stage it onto the nearest free workshop cell.
   *  - a product onto a bench slot, or a sub-part onto the deck: refused.
   */
  private commitDrop(d: DragState, dropEl: HTMLElement | null, x: number, y: number): boolean {
    const drop = dropEl?.dataset['drop'];
    if (!drop) return false;

    if (drop === 'inventory') {
      if (d.source.kind !== 'bench') return false; // inventory → inventory: nothing to do
      clearBenchSlot(this.world, d.source.slot);
      addToInventory(this.world, d.view.entity);
      return true;
    }

    if (drop === 'deck') {
      if (!d.view.isProduct || d.source.kind !== 'inventory') return false; // products from inventory only
      const cell = this.deckCellAt(x, y, partFootprint(this.world, d.view.entity));
      if (!cell) return false; // deck full / off-deck / footprint won't fit
      const workshop = workshopEntity(this.world)!;
      return stageProduct(this.world, d.view.entity, workshop, cell.col, cell.row);
    }

    // drop === `slot:<name>`
    if (this.inspectedAssembly()) return false; // the shown slots are a read-only product view
    const slot = drop.slice('slot:'.length);
    if (d.view.slot === null || slot !== d.view.slot) return false; // wrong role (or a product)
    if (d.source.kind === 'bench' && d.source.slot === slot) return false; // already here
    if (!acceptsType(this.world, d.view.type)) return false; // cross-type — the no-hybrid refusal
    if (!this.acceptsChassisDrop(d.view.entity)) return false; // wrong chassis size — the size refusal
    if (!placeOnBench(this.world, slot, d.view.entity)) return false; // slot occupied — refused
    removeFromInventory(this.world, d.view.entity);
    return true;
  }

  /**
   * The chassis size-match guard at DROP time: a chassis sub-part whose size doesn't match the
   * active chassis recipe won't snap into its slot — the size counterpart to the no-hybrid
   * `acceptsType`. True for every non-chassis build/part (the engine/container/Reclaimer benches).
   */
  private acceptsChassisDrop(entity: EntityId): boolean {
    const ep = this.world.get(entity, EnginePart);
    const def = ep ? partDef(ep.id) : undefined;
    return def ? acceptsChassisPart(this.activeRecipe(), def) : true;
  }

  /**
   * The nearest free workshop region under a screen point on the deck (its anchor cell), or null.
   * `footprint` is the dragged product's size, so a 2×2 chassis kit snaps only where the whole block
   * fits; defaults to a single cell.
   */
  private deckCellAt(
    x: number,
    y: number,
    footprint: { cols: number; rows: number } = { cols: 1, rows: 1 },
  ): { col: number; row: number } | null {
    const workshop = workshopEntity(this.world);
    if (workshop === null) return null;
    const lp = this.deck.localPointAt(x, y);
    if (!lp) return null;
    // The deck view raycasts in workshop-local space, so the snap takes the local point directly —
    // no reach bound (the deck plane is unbounded; an off-deck miss is caught by `localPointAt`).
    return closestFreeCellLocal(this.world, workshop, lp.lx, lp.lz, Infinity, footprint);
  }

  /** Create the floating clone that follows the cursor. Sized to match the source chip. */
  private makeGhost(chip: HTMLElement): HTMLElement {
    const rect = chip.getBoundingClientRect();
    const ghost = chip.cloneNode(true) as HTMLElement;
    ghost.classList.remove('selected');
    ghost.classList.add('wk-ghost');
    ghost.style.transition = 'none';
    ghost.style.width = `${rect.width}px`;
    ghost.style.left = `${rect.left}px`;
    ghost.style.top = `${rect.top}px`;
    document.body.appendChild(ghost);
    return ghost;
  }

  /** Glide the ghost back to its origin chip, then remove it — the "return to origin" feel. */
  private returnGhost(d: DragState): void {
    const ghost = d.ghost!;
    const rect = d.chip.getBoundingClientRect();
    ghost.style.transition = 'left 0.14s ease-out, top 0.14s ease-out';
    ghost.style.left = `${rect.left}px`;
    ghost.style.top = `${rect.top}px`;
    window.setTimeout(() => {
      ghost.remove();
      d.chip.classList.remove('dragging');
    }, 150);
  }

  /** Brief snap pulse on the chip the moved item now lives in. */
  private flashSnap(entity: EntityId): void {
    const chip = this.panel.querySelector<HTMLElement>(`.wk-chip[data-entity="${entity}"]`);
    if (!chip) return;
    chip.classList.add('snapped');
    chip.addEventListener('animationend', () => chip.classList.remove('snapped'), { once: true });
  }

  /** The drop zone under the cursor (a bench slot, the inventory list, or the deck), or null. */
  private dropTargetAt(x: number, y: number): HTMLElement | null {
    return (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>('[data-drop]') ?? null;
  }

  private highlightDropTarget(x: number, y: number): void {
    this.clearDropHighlights();
    const d = this.drag;
    if (!d) return;
    const el = this.dropTargetAt(x, y);
    if (!el) {
      this.deck.highlight(null);
      return;
    }
    const drop = el.dataset['drop']!;
    if (drop === 'deck') {
      // Honest 3D highlight: green on the region a valid product will land on, rust otherwise. The
      // footprint sizes the highlight (a 2×2 block for a chassis kit).
      const ok = d.view.isProduct && d.source.kind === 'inventory';
      const fp = partFootprint(this.world, d.view.entity);
      const cell = ok ? this.deckCellAt(x, y, fp) : null;
      this.deck.highlight(cell, ok && cell !== null, fp);
      el.classList.add(ok && cell ? 'drop-hover' : 'drop-reject');
      return;
    }
    this.deck.highlight(null); // moved off the deck mid-drag
    const ok = this.wouldAccept(d, drop);
    el.classList.add(ok ? 'drop-hover' : 'drop-reject');
  }

  /** Pure predicate version of `commitDrop` for the hover highlight (bench/inventory targets). */
  private wouldAccept(d: DragState, drop: string): boolean {
    if (drop === 'inventory') return d.source.kind === 'bench';
    if (this.inspectedAssembly()) return false;
    const slot = drop.slice('slot:'.length);
    if (d.view.slot === null || slot !== d.view.slot) return false;
    if (d.source.kind === 'bench' && d.source.slot === slot) return false;
    if (!acceptsType(this.world, d.view.type)) return false;
    if (!this.acceptsChassisDrop(d.view.entity)) return false;
    return benchSlots(this.world)[slot] === null;
  }

  private clearDropHighlights(): void {
    for (const el of this.panel.querySelectorAll('.drop-hover, .drop-reject')) {
      el.classList.remove('drop-hover', 'drop-reject');
    }
  }

  private cancelDrag(): void {
    if (!this.drag) return;
    this.drag.ghost?.remove();
    this.drag.chip.classList.remove('dragging');
    this.clearDropHighlights();
    this.deck.highlight(null);
    this.drag = null;
  }

  // ── helpers ───────────────────────────────────────────────────────────────────────────────

  /**
   * Resolve an inventory/bench/deck entity to a uniform `ItemView`, or null if it's neither a known
   * part nor a product. A loose part (`EnginePart`) carries a bench role; a composed product
   * (`Assembly`) carries `slot: null` and shows its summed stats + recipe-derived display name.
   */
  private viewOf(entity: EntityId): ItemView | null {
    const part = this.world.get(entity, EnginePart);
    if (part) {
      const def = partDef(part.id);
      if (!def) return null;
      const key = def.type ?? def.category;
      const tier = tierOf(part.tier);
      // The tier rides as a one-word prefix composed here ("Iron Shell"), never stored in the catalog
      // displayName (§1/§2b); `baseName` keeps the un-prefixed noun so the chip can still drop a slot
      // tag that just repeats it.
      return {
        entity,
        displayName: `${tier.name} ${def.displayName}`,
        baseName: def.displayName,
        colorKey: key,
        tag: def.slot,
        sub: `${tier.name} · ${def.type ?? def.category} · ${def.slot}`,
        attrs: resolvePartStats(this.world, entity) ?? def.attributes,
        assetId: def.assetId,
        tierFinish: tier.finishColor,
        slot: def.slot,
        ...(def.type ? { type: def.type } : {}),
        isProduct: false,
      };
    }

    const asm = this.world.get(entity, Assembly);
    if (asm) {
      const recipe = recipeById(asm.recipeId);
      const kind = this.world.get(entity, Part)?.kind ?? 'engine';
      // The recipe name already carries the energy type (e.g. "Electric Engine"), so it stands alone
      // as the product's name — no type prefix to compose. A uniform-tier product wears that tier's
      // finish; a mixed-tier one has no single grade, so it shows none.
      const output = recipe?.output ?? cap(kind);
      const key = asm.type ?? kind;
      const tier = productTier(this.world, asm.parts);
      return {
        entity,
        displayName: output,
        baseName: output,
        colorKey: key,
        tag: kind,
        sub: asm.type ? `${asm.type} · ${kind}` : kind,
        attrs: sumPartStats(this.world, asm.parts),
        assetId: productAssetId(kind, asm.recipeId, asm.type),
        ...(tier ? { tierFinish: tierOf(tier).finishColor } : {}),
        slot: null,
        ...(asm.type ? { type: asm.type } : {}),
        isProduct: true,
      };
    }

    return null;
  }

  /** Tab is visible only while a zone is active and the overlay is closed. */
  private syncTab(): void {
    this.tabEl.classList.toggle('hidden', !this.zoneActive || this.open);
  }

  private syncPanel(): void {
    this.panel.classList.toggle('hidden', !this.open);
  }

  /** Tear down listeners + the portrait/deck — for HMR / teardown symmetry. */
  dispose(): void {
    this.cancelDrag();
    this.portrait.dispose();
    this.deck.dispose();
    this.tabEl.removeEventListener('click', this.onTabClick);
    this.closeBtn.removeEventListener('click', this.onCloseClick);
    this.autoFillBtn.removeEventListener('click', this.onAutoFillClick);
    this.assembleBtn.removeEventListener('click', this.onAssembleClick);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('resize', this.onResize);
  }
}
