import type { World } from '../core/world';
import type { EntityId } from '../core/types';
import { EnginePart } from '../components/engine-part';
import { Assembly } from '../components/assembly';
import { Part } from '../components/part';
import { partDef, type PartSlot, type EnergyType } from '../content/parts-catalog';
import { ENGINE_RECIPE, RECIPES, recipeById, type Recipe } from '../content/recipes';
import { inventoryItems, addToInventory, removeFromInventory } from '../components/inventory';
import {
  getBench,
  benchSlots,
  placeOnBench,
  clearBenchSlot,
  benchSlotOf,
  loadRecipe,
} from '../components/bench';
import {
  sumPartStats,
  acceptsType,
  assembleVerdict,
  assemble,
  dismantle,
  type ProductStats,
} from '../systems/assembly';
import { createModelPortrait, type ModelPortrait } from '../../../shared/model-portrait';

/**
 * The workshop interface: a bottom-centre "🔧 Open Workshop" tab that appears while the rig is
 * parked in a workshop zone, and a full-screen overlay that opens when it's clicked. Opening the
 * overlay freezes the simulation; closing it resumes.
 *
 * Inside the overlay the player can BROWSE owned items, INSPECT one (detail panel + a rotatable 3D
 * portrait), pick a RECIPE to build, MOVE parts between the inventory and the active recipe's bench
 * role slots, and — once the slots are full of one consistent type — ASSEMBLE them into a finished
 * product that drops into inventory (P4). A composed product can be DISMANTLED back into its parts.
 *
 * Inventory items are now of two shapes: loose parts (`EnginePart`) and composed products
 * (`Assembly`). The overlay treats them uniformly through `ItemView` — a part carries a role `slot`
 * (so it's bench-droppable), a product carries `slot: null` (it's inspect/dismantle-only here;
 * mounting is P6). Assembly itself is recipe-generic (see `systems/assembly.ts`): the engine and the
 * storage container build through the exact same path, so this UI never special-cases the engine.
 *
 * The class reads and mutates the World only through the component model (`Inventory` + `Bench` +
 * the assembly system), never a parallel store, so state survives close/reopen. It surfaces two
 * seams to the composition root (main.ts):
 *   - `onPauseChange(paused)` fires when the overlay opens (true) / closes (false).
 *   - `setZoneActive(active)` is pushed each frame from main so the tab tracks proximity.
 */
export interface WorkshopOverlayOptions {
  /** Fired with `true` when the overlay opens, `false` when it closes — main flips `paused`. */
  onPauseChange(paused: boolean): void;
}

/**
 * The chip dot + portrait-placeholder tint, keyed by an item's energy type when it has one (engine
 * parts and engine products), else by its category/kind — so storage items (no electric/mechanical)
 * get the rig_blue "player-built" signature instead of a missing colour.
 */
const COLOR_BY_KEY: Record<string, number> = {
  electric: 0x59ff9f, // glow_green
  mechanical: 0x8a4b2f, // rust
  storage: 0x2f6f9f, // rig_blue
};
const tintOf = (colorKey: string): number => COLOR_BY_KEY[colorKey] ?? 0x6b6b6b;
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Which GLB previews an assembled engine, by energy type. There are no bespoke composed-engine
 * assets yet, so we reuse the two existing engine models: mk2 (the brighter, more-illuminated build)
 * stands in for the clean/glowing ELECTRIC engine, and mk1 (the plainer starter) for the grimier
 * MECHANICAL one. Swap these for dedicated assets when they land. A storage product needs no entry —
 * its recipe id (`storage`) already resolves to the container GLB.
 */
const ENGINE_PREVIEW_ASSET: Record<EnergyType, string> = {
  electric: 'engine-mk2',
  mechanical: 'engine-mk1',
};

const DRAG_THRESHOLD = 4; // px the pointer must travel before a press becomes a drag (vs a click)

/**
 * A uniform façade over an inventory/bench item, whether it's a loose part or a composed product.
 * `slot` is the part role used to match a bench slot — `null` for products (they don't sit in slots).
 */
interface ItemView {
  entity: EntityId;
  displayName: string;
  colorKey: string; // chip dot/tint key: electric | mechanical | storage
  tag: string; // small right-aligned chip tag: the part role, or the product kind
  sub: string; // detail subtitle, e.g. "electric · casing" or "electric · engine"
  attrs: ProductStats; // power/torque/weight/durability/burst to show
  assetId: string | null; // portrait asset (unregistered id → tinted placeholder; null → empty)
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
  private selected: EntityId | null = null;
  private drag: DragState | null = null;

  private readonly closeBtn: HTMLButtonElement;
  private readonly invList: HTMLElement;
  private readonly recipeTabsEl: HTMLElement;
  private readonly recipeEl: HTMLElement;
  private readonly benchEl: HTMLElement;
  private readonly assembleBtn: HTMLButtonElement;
  private readonly detailEl: HTMLElement;
  private readonly portrait: ModelPortrait;
  private readonly slotEls = new Map<string, HTMLElement>();
  private renderedRecipeId: string | null = null; // which recipe's slot DOM is currently built

  private readonly onTabClick = (): void => this.openOverlay();
  private readonly onCloseClick = (): void => this.closeOverlay();
  private readonly onAssembleClick = (): void => this.assembleActive();
  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (this.open && e.key === 'Escape') this.closeOverlay();
  };
  private readonly onPointerMove = (e: PointerEvent): void => this.handlePointerMove(e);
  private readonly onPointerUp = (e: PointerEvent): void => this.handlePointerUp(e);
  private readonly onResize = (): void => this.portrait.resize();

  constructor(
    private readonly tab: HTMLButtonElement,
    private readonly panel: HTMLElement,
    private readonly world: World,
    private readonly opts: WorkshopOverlayOptions,
  ) {
    this.closeBtn = panel.querySelector<HTMLButtonElement>('#workshop-close')!;
    this.invList = panel.querySelector<HTMLElement>('#wk-inv-list')!;
    this.recipeTabsEl = panel.querySelector<HTMLElement>('#wk-recipe-tabs')!;
    this.recipeEl = panel.querySelector<HTMLElement>('#wk-recipe')!;
    this.benchEl = panel.querySelector<HTMLElement>('#wk-bench-slots')!;
    this.assembleBtn = panel.querySelector<HTMLButtonElement>('#wk-assemble')!;
    this.detailEl = panel.querySelector<HTMLElement>('#wk-detail')!;
    this.portrait = createModelPortrait(panel.querySelector<HTMLElement>('#wk-portrait-host')!);

    this.tab.addEventListener('click', this.onTabClick);
    this.closeBtn.addEventListener('click', this.onCloseClick);
    this.assembleBtn.addEventListener('click', this.onAssembleClick);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('resize', this.onResize);

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
    this.refresh();
    this.portrait.start();
  }

  private closeOverlay(): void {
    if (!this.open) return;
    this.open = false;
    this.cancelDrag();
    this.opts.onPauseChange(false);
    this.portrait.stop();
    this.syncPanel();
    this.syncTab(); // restore the tab if the rig is still in the zone
  }

  // ── DOM construction ──────────────────────────────────────────────────────────────────────

  /** The recipe currently loaded on the bench (falls back to the engine recipe). */
  private activeRecipe(): Recipe {
    const bench = getBench(this.world);
    return (bench && recipeById(bench.recipeId)) ?? ENGINE_RECIPE;
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
   * Load a different recipe onto the bench. Any parts currently on the bench return to inventory
   * first (conserved — switching never destroys a part), then the bench reshapes to the new recipe's
   * slots.
   */
  private switchRecipe(id: string): void {
    const bench = getBench(this.world);
    if (!bench || bench.recipeId === id) return;
    const recipe = recipeById(id);
    if (!recipe) return;
    for (const slot of Object.keys(bench.slots)) {
      const part = clearBenchSlot(this.world, slot);
      if (part !== null) addToInventory(this.world, part);
    }
    loadRecipe(this.world, recipe.id, recipe.slots.map((s) => s.slot));
    this.refresh();
  }

  /** A draggable, selectable chip for an item (a loose part or a composed product). */
  private makeChip(view: ItemView): HTMLElement {
    const chip = document.createElement('div');
    chip.className = `wk-chip ${view.colorKey}` + (view.isProduct ? ' product' : '');
    chip.dataset['entity'] = String(view.entity);
    if (view.entity === this.selected) chip.classList.add('selected');
    chip.innerHTML =
      `<span class="wk-dot"></span>` +
      `<span class="wk-name">${view.displayName}</span>` +
      `<span class="wk-slot-tag">${view.tag}</span>`;
    chip.addEventListener('pointerdown', (e) => this.beginDrag(e, view));
    return chip;
  }

  /** Rebuild the inventory list + bench slots from world state; re-apply selection + detail. */
  private refresh(): void {
    // Inventory list.
    this.invList.innerHTML = '';
    const items = inventoryItems(this.world);
    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'wk-inv-empty';
      empty.textContent = 'Empty — every part is on the bench.';
      this.invList.appendChild(empty);
    } else {
      for (const entity of items) {
        const view = this.viewOf(entity);
        if (view) this.invList.appendChild(this.makeChip(view));
      }
    }

    // The recipe picker, and the bench slot DOM for whichever recipe is active (rebuild only when
    // the recipe changed — e.g. after a switch — so an ordinary refresh keeps the existing slots).
    const recipe = this.activeRecipe();
    this.renderRecipeTabs();
    if (this.renderedRecipeId !== recipe.id) this.rebuildBenchSlots(recipe);

    // Bench slots (driven by the recipe), counting how many are filled for the header.
    const slots = benchSlots(this.world);
    let filled = 0;
    for (const { slot } of recipe.slots) {
      const el = this.slotEls.get(slot)!;
      // Drop everything after the label (index 0) so the label persists.
      while (el.children.length > 1) el.removeChild(el.lastChild!);
      const entity = slots[slot] ?? null;
      const view = entity !== null ? this.viewOf(entity) : null;
      if (entity !== null && view) {
        filled++;
        el.appendChild(this.makeChip(view));
      } else {
        const empty = document.createElement('div');
        empty.className = 'wk-slot-empty';
        empty.textContent = 'empty';
        el.appendChild(empty);
      }
    }

    // Recipe header: what's being built and how far along (e.g. "Engine · 2 / 4 parts").
    this.recipeEl.textContent = `${recipe.output} · ${filled} / ${recipe.slots.length} parts`;

    this.renderAssemble(recipe);
    this.renderDetail();
  }

  /**
   * The Assemble action: enabled only when the bench can assemble the active recipe (all slots
   * filled, one consistent energy type). Otherwise it's disabled and shows WHY — the readable
   * "won't assemble" state that pairs with the per-slot drop refusal.
   */
  private renderAssemble(recipe: Recipe): void {
    const verdict = assembleVerdict(this.world, recipe);
    this.assembleBtn.disabled = !verdict.ok;
    this.assembleBtn.textContent = verdict.ok ? `⚙ Assemble ${recipe.output}` : verdict.reason;
    this.assembleBtn.title = verdict.ok ? '' : verdict.reason;
  }

  /** Assemble the active recipe's parts into a product; select it and pulse the new chip. */
  private assembleActive(): void {
    const product = assemble(this.world, this.activeRecipe());
    if (product === null) return; // refused (incomplete / hybrid) — no change
    this.selected = product;
    this.refresh();
    this.flashSnap(product);
  }

  /** Dismantle the selected product back into its parts (returned to inventory); clear selection. */
  private dismantleSelected(): void {
    if (this.selected === null) return;
    if (dismantle(this.world, this.selected) === null) return; // not a product
    this.selected = null;
    this.refresh();
  }

  /** Render the detail panel + portrait for the current selection. */
  private renderDetail(): void {
    const view = this.selected !== null ? this.viewOf(this.selected) : null;
    if (!view) {
      this.detailEl.innerHTML = `<div class="wk-detail-empty">Select a part to inspect it.</div>`;
      this.portrait.show(null);
      return;
    }
    const a = view.attrs;
    this.detailEl.innerHTML =
      `<h4>${view.displayName}</h4>` +
      `<div class="wk-detail-sub">${view.sub}</div>` +
      `<div class="wk-attrs">` +
      `<span class="k">power</span><span class="v">${a.power}</span>` +
      `<span class="k">torque</span><span class="v">${a.torque}</span>` +
      `<span class="k">weight</span><span class="v">${a.weight}</span>` +
      `<span class="k reserved">durability</span><span class="v reserved">${a.durability} (reserved)</span>` +
      `<span class="k reserved">burst</span><span class="v reserved">${a.burst} (reserved)</span>` +
      `</div>` +
      (view.isProduct ? `<button id="wk-dismantle" class="wk-dismantle" type="button">Dismantle</button>` : '');
    if (view.isProduct) {
      this.detailEl
        .querySelector<HTMLButtonElement>('#wk-dismantle')!
        .addEventListener('click', () => this.dismantleSelected());
    }
    this.portrait.show(view.assetId, { fallbackColor: tintOf(view.colorKey) });
  }

  private select(entity: EntityId): void {
    this.selected = entity;
    for (const chip of this.panel.querySelectorAll<HTMLElement>('.wk-chip')) {
      chip.classList.toggle('selected', chip.dataset['entity'] === String(entity));
    }
    this.renderDetail();
  }

  // ── Drag-and-drop: inventory ↔ bench ──────────────────────────────────────────────────────

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
      // Not yet a drag — only promote to one once the pointer has travelled past the threshold,
      // so a plain click still reads as a selection rather than a (zero-distance) drag.
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_THRESHOLD) return;
      d.ghost = this.makeGhost(d.chip);
      d.chip.classList.add('dragging');
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
      // Never crossed the threshold → it was a click: select the item.
      this.select(d.view.entity);
      return;
    }

    this.clearDropHighlights();
    const dropEl = this.dropTargetAt(e.clientX, e.clientY);
    const moved = this.commitDrop(d, dropEl);
    if (moved) {
      d.ghost.remove();
      d.chip.classList.remove('dragging');
      this.select(d.view.entity); // keep the moved item selected
      this.refresh();
      this.flashSnap(d.view.entity);
    } else {
      this.returnGhost(d);
    }
  }

  /**
   * Apply a drop. Returns true if a part actually moved (so the caller refreshes), false if the
   * drop was invalid or a no-op (the ghost glides back to its origin — the tactile "refusal").
   *
   * Rules:
   *  - inventory part → a bench slot: allowed only when the slot matches the part's role, is empty,
   *    AND the part's energy type doesn't clash with what's already on the bench (the no-hybrid
   *    type-lock — a cross-type part won't snap). The part leaves inventory and takes the slot.
   *  - bench part → the inventory list: always allowed; the slot empties and the part returns.
   *  - a product (no role slot) anywhere on the bench: refused — products are inspect/dismantle-only
   *    here (mounting is P6).
   *  - anything else (wrong-role slot, occupied slot, inventory→inventory, same-slot): no move.
   */
  private commitDrop(d: DragState, dropEl: HTMLElement | null): boolean {
    const drop = dropEl?.dataset['drop'];
    if (!drop) return false;

    if (drop === 'inventory') {
      if (d.source.kind !== 'bench') return false; // inventory → inventory: nothing to do
      clearBenchSlot(this.world, d.source.slot);
      addToInventory(this.world, d.view.entity);
      return true;
    }

    // drop === `slot:<name>`
    const slot = drop.slice('slot:'.length);
    if (d.view.slot === null || slot !== d.view.slot) return false; // wrong role (or a product) — won't snap
    if (d.source.kind === 'bench' && d.source.slot === slot) return false; // already here
    if (!acceptsType(this.world, d.view.type)) return false; // cross-type — the no-hybrid refusal
    if (!placeOnBench(this.world, slot, d.view.entity)) return false; // slot occupied — refused
    removeFromInventory(this.world, d.view.entity); // (no-op if it came off the bench, but it can't here)
    return true;
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

  /** The drop zone under the cursor (a bench slot or the inventory list), or null. */
  private dropTargetAt(x: number, y: number): HTMLElement | null {
    return (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>('[data-drop]') ?? null;
  }

  private highlightDropTarget(x: number, y: number): void {
    this.clearDropHighlights();
    const d = this.drag;
    if (!d) return;
    const el = this.dropTargetAt(x, y);
    if (!el) return;
    // Mirror commitDrop's verdict so the highlight reads honestly: green = will snap, rust = refused.
    const ok = this.wouldAccept(d, el.dataset['drop']!);
    el.classList.add(ok ? 'drop-hover' : 'drop-reject');
  }

  /** Pure predicate version of `commitDrop` for the hover highlight (no mutation). */
  private wouldAccept(d: DragState, drop: string): boolean {
    if (drop === 'inventory') return d.source.kind === 'bench';
    const slot = drop.slice('slot:'.length);
    if (d.view.slot === null || slot !== d.view.slot) return false;
    if (d.source.kind === 'bench' && d.source.slot === slot) return false;
    if (!acceptsType(this.world, d.view.type)) return false;
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
    this.drag = null;
  }

  // ── helpers ───────────────────────────────────────────────────────────────────────────────

  /**
   * Resolve an inventory/bench entity to a uniform `ItemView`, or null if it's neither a known part
   * nor a product. A loose part (`EnginePart`) carries a bench role; a composed product (`Assembly`)
   * carries `slot: null` and shows its summed stats + the recipe-derived display name.
   */
  private viewOf(entity: EntityId): ItemView | null {
    const part = this.world.get(entity, EnginePart);
    if (part) {
      const def = partDef(part.id);
      if (!def) return null;
      const key = def.type ?? def.category;
      return {
        entity,
        displayName: def.displayName,
        colorKey: key,
        tag: def.slot,
        sub: `${def.type ?? def.category} · ${def.slot}`,
        attrs: def.attributes,
        assetId: def.assetId,
        slot: def.slot,
        ...(def.type ? { type: def.type } : {}),
        isProduct: false,
      };
    }

    const asm = this.world.get(entity, Assembly);
    if (asm) {
      const recipe = recipeById(asm.recipeId);
      const kind = this.world.get(entity, Part)?.kind ?? 'engine';
      const output = recipe?.output ?? cap(kind);
      const key = asm.type ?? kind; // engine product → its energy type; storage → 'storage'
      // An engine reuses the mk1/mk2 GLBs by type; any other product previews via its recipe id
      // (the storage container's `storage` id resolves to the container GLB). Unregistered → tint.
      const assetId = kind === 'engine' && asm.type ? ENGINE_PREVIEW_ASSET[asm.type] : asm.recipeId;
      return {
        entity,
        displayName: asm.type ? `${cap(asm.type)} ${output}` : output,
        colorKey: key,
        tag: kind,
        sub: asm.type ? `${asm.type} · ${kind}` : kind,
        attrs: sumPartStats(this.world, asm.parts),
        assetId,
        slot: null,
        ...(asm.type ? { type: asm.type } : {}),
        isProduct: true,
      };
    }

    return null;
  }

  /** Tab is visible only while a zone is active and the overlay is closed. */
  private syncTab(): void {
    this.tab.classList.toggle('hidden', !this.zoneActive || this.open);
  }

  private syncPanel(): void {
    this.panel.classList.toggle('hidden', !this.open);
  }

  /** Tear down listeners + the portrait — for HMR / teardown symmetry. */
  dispose(): void {
    this.cancelDrag();
    this.portrait.dispose();
    this.tab.removeEventListener('click', this.onTabClick);
    this.closeBtn.removeEventListener('click', this.onCloseClick);
    this.assembleBtn.removeEventListener('click', this.onAssembleClick);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('resize', this.onResize);
  }
}
