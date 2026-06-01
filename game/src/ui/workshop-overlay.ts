import type { World } from '../core/world';
import type { EntityId } from '../core/types';
import { EnginePart } from '../components/engine-part';
import { partDef, type PartDef } from '../content/parts-catalog';
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
import { createModelPortrait, type ModelPortrait } from '../../../shared/model-portrait';

/**
 * The workshop interface: a bottom-centre "🔧 Open Workshop" tab that appears while the rig is
 * parked in a workshop zone, and a full-screen overlay that opens when it's clicked. Opening the
 * overlay freezes the simulation; closing it resumes.
 *
 * Inside the overlay (P3) the player can BROWSE owned parts, INSPECT one (detail panel + a rotatable
 * 3D portrait), pick a RECIPE to build, and MOVE parts between the inventory and the active recipe's
 * bench role slots. There is no assembly yet — this is the tactile substrate for it: drag a part onto
 * its matching slot and it sits there; drag it back and it returns, with the part conserved at every
 * step (it's always in exactly one place — inventory OR a bench slot). Switching recipes returns any
 * bench parts to inventory and reshapes the slots to the new recipe.
 *
 * The class reads and mutates the World only through the component model (`Inventory` + `Bench`
 * helpers), never a parallel store, so the bench state survives close/reopen. It surfaces two seams
 * to the composition root (main.ts):
 *   - `onPauseChange(paused)` fires when the overlay opens (true) / closes (false).
 *   - `setZoneActive(active)` is pushed each frame from main so the tab tracks proximity.
 */
export interface WorkshopOverlayOptions {
  /** Fired with `true` when the overlay opens, `false` when it closes — main flips `paused`. */
  onPauseChange(paused: boolean): void;
}

/**
 * The chip dot + portrait-placeholder tint for a part. Keyed by its energy type when it has one
 * (engine parts), else by its category — so storage parts (no electric/mechanical) get the
 * rig_blue "player-built" signature instead of a missing colour.
 */
const COLOR_BY_KEY: Record<string, number> = {
  electric: 0x59ff9f, // glow_green
  mechanical: 0x8a4b2f, // rust
  storage: 0x2f6f9f, // rig_blue
};
const colorKey = (def: PartDef): string => def.type ?? def.category;
const tintOf = (def: PartDef): number => COLOR_BY_KEY[colorKey(def)] ?? 0x6b6b6b;

const DRAG_THRESHOLD = 4; // px the pointer must travel before a press becomes a drag (vs a click)

/** Where a part being dragged came from — used to validate the drop and to return it on cancel. */
type DragSource = { kind: 'inventory' } | { kind: 'bench'; slot: string };

interface DragState {
  entity: EntityId;
  def: PartDef;
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
  private readonly detailEl: HTMLElement;
  private readonly portrait: ModelPortrait;
  private readonly slotEls = new Map<string, HTMLElement>();
  private renderedRecipeId: string | null = null; // which recipe's slot DOM is currently built

  private readonly onTabClick = (): void => this.openOverlay();
  private readonly onCloseClick = (): void => this.closeOverlay();
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
    this.detailEl = panel.querySelector<HTMLElement>('#wk-detail')!;
    this.portrait = createModelPortrait(panel.querySelector<HTMLElement>('#wk-portrait-host')!);

    this.tab.addEventListener('click', this.onTabClick);
    this.closeBtn.addEventListener('click', this.onCloseClick);
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

  /** A draggable, selectable chip for a part entity. */
  private makeChip(entity: EntityId, def: PartDef): HTMLElement {
    const chip = document.createElement('div');
    chip.className = `wk-chip ${colorKey(def)}`;
    chip.dataset['entity'] = String(entity);
    if (entity === this.selected) chip.classList.add('selected');
    chip.innerHTML =
      `<span class="wk-dot"></span>` +
      `<span class="wk-name">${def.displayName}</span>` +
      `<span class="wk-slot-tag">${def.slot}</span>`;
    chip.addEventListener('pointerdown', (e) => this.beginDrag(e, entity, def));
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
        const def = this.defOf(entity);
        if (def) this.invList.appendChild(this.makeChip(entity, def));
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
      const def = entity !== null ? this.defOf(entity) : null;
      if (entity !== null && def) {
        filled++;
        el.appendChild(this.makeChip(entity, def));
      } else {
        const empty = document.createElement('div');
        empty.className = 'wk-slot-empty';
        empty.textContent = 'empty';
        el.appendChild(empty);
      }
    }

    // Recipe header: what's being built and how far along (e.g. "Engine · 2 / 4 parts").
    this.recipeEl.textContent = `${recipe.output} · ${filled} / ${recipe.slots.length} parts`;

    this.renderDetail();
  }

  /** Render the detail panel + portrait for the current selection. */
  private renderDetail(): void {
    const def = this.selected !== null ? this.defOf(this.selected) : null;
    if (!def) {
      this.detailEl.innerHTML = `<div class="wk-detail-empty">Select a part to inspect it.</div>`;
      this.portrait.show(null);
      return;
    }
    const a = def.attributes;
    this.detailEl.innerHTML =
      `<h4>${def.displayName}</h4>` +
      `<div class="wk-detail-sub">${def.type ?? def.category} · ${def.slot}</div>` +
      `<div class="wk-attrs">` +
      `<span class="k">power</span><span class="v">${a.power}</span>` +
      `<span class="k">torque</span><span class="v">${a.torque}</span>` +
      `<span class="k">weight</span><span class="v">${a.weight}</span>` +
      `<span class="k reserved">durability</span><span class="v reserved">${a.durability} (reserved)</span>` +
      `<span class="k reserved">burst</span><span class="v reserved">${a.burst} (reserved)</span>` +
      `</div>`;
    this.portrait.show(def.assetId, { fallbackColor: tintOf(def) });
  }

  private select(entity: EntityId): void {
    this.selected = entity;
    for (const chip of this.panel.querySelectorAll<HTMLElement>('.wk-chip')) {
      chip.classList.toggle('selected', chip.dataset['entity'] === String(entity));
    }
    this.renderDetail();
  }

  // ── Drag-and-drop: inventory ↔ bench ──────────────────────────────────────────────────────

  private beginDrag(e: PointerEvent, entity: EntityId, def: PartDef): void {
    if (e.button !== 0) return;
    e.preventDefault();
    const chip = e.currentTarget as HTMLElement;
    const rect = chip.getBoundingClientRect();
    const benchSlot = benchSlotOf(this.world, entity);
    this.drag = {
      entity,
      def,
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
      // Never crossed the threshold → it was a click: select the part.
      this.select(d.entity);
      return;
    }

    this.clearDropHighlights();
    const dropEl = this.dropTargetAt(e.clientX, e.clientY);
    const moved = this.commitDrop(d, dropEl);
    if (moved) {
      d.ghost.remove();
      d.chip.classList.remove('dragging');
      this.select(d.entity); // keep the moved part selected
      this.refresh();
      this.flashSnap(d.entity);
    } else {
      this.returnGhost(d);
    }
  }

  /**
   * Apply a drop. Returns true if a part actually moved (so the caller refreshes), false if the
   * drop was invalid or a no-op (the ghost glides back to its origin — the tactile "refusal").
   *
   * Rules (P3 — role-match only; the electric/mechanical type-lock is P4):
   *  - inventory part → a bench slot: allowed only when the slot matches the part's role AND is
   *    empty. The part leaves inventory and takes the slot.
   *  - bench part → the inventory list: always allowed; the slot empties and the part returns.
   *  - anything else (wrong-role slot, occupied slot, inventory→inventory, same-slot): no move.
   */
  private commitDrop(d: DragState, dropEl: HTMLElement | null): boolean {
    const drop = dropEl?.dataset['drop'];
    if (!drop) return false;

    if (drop === 'inventory') {
      if (d.source.kind !== 'bench') return false; // inventory → inventory: nothing to do
      clearBenchSlot(this.world, d.source.slot);
      addToInventory(this.world, d.entity);
      return true;
    }

    // drop === `slot:<name>`
    const slot = drop.slice('slot:'.length);
    if (slot !== d.def.slot) return false; // wrong role — won't snap
    if (d.source.kind === 'bench' && d.source.slot === slot) return false; // already here
    if (!placeOnBench(this.world, slot, d.entity)) return false; // slot occupied — refused
    removeFromInventory(this.world, d.entity); // (no-op if it came off the bench, but it can't here)
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

  /** Brief snap pulse on the chip the moved part now lives in. */
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
    if (slot !== d.def.slot) return false;
    if (d.source.kind === 'bench' && d.source.slot === slot) return false;
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

  /** Resolve a part entity to its catalog definition, or null if it isn't a known part. */
  private defOf(entity: EntityId): PartDef | null {
    const part = this.world.get(entity, EnginePart);
    return part ? (partDef(part.id) ?? null) : null;
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
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('resize', this.onResize);
  }
}
