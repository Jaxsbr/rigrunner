import { PLACEMENT_KINDS, type PlacementCategory } from '../world-map/placement';

export type EditorMode = 'paint' | 'place';

interface EditorUIOpts {
  onMode: (mode: EditorMode) => void;
  onBake: () => void;
  onSave: () => void;
  onThicker: () => void;
  onThinner: () => void;
  onPickKind: (kind: string) => void;
  onRoundRobin: (on: boolean) => void;
}

const CATEGORY_LABEL: Record<PlacementCategory, string> = {
  structure: 'Structures',
  camp: 'Camps',
  scrap: 'Scrap',
  decoration: 'Decoration',
};

/**
 * The editor's on-screen toolbar. Two modes share it: PAINT (collision brush — Bake / brush size) and
 * PLACE (the structure/prop palette — round-robin rotate). A mode toggle swaps which section shows; Save
 * and the status line are common. Plain DOM injected over the canvas (dev tooling, not the player HUD).
 */
export class EditorUI {
  private readonly status: HTMLElement;
  private readonly brush: HTMLElement;
  private readonly paintSection: HTMLElement;
  private readonly placeSection: HTMLElement;
  private readonly hints: HTMLElement;
  private readonly modeButtons: Record<EditorMode, HTMLButtonElement>;
  private readonly kindButtons = new Map<string, HTMLButtonElement>();
  private mode: EditorMode = 'paint';
  private selectedKind = PLACEMENT_KINDS[0]?.id ?? 'workshop';

  constructor(private readonly opts: EditorUIOpts) {
    const panel = document.createElement('div');
    panel.style.cssText = [
      'position:fixed', 'top:12px', 'left:12px', 'z-index:10', 'width:248px',
      'font:13px/1.5 system-ui,sans-serif', 'color:#e8e2d4',
      'background:rgba(20,18,14,0.85)', 'border:1px solid rgba(180,150,90,0.4)',
      'border-radius:8px', 'padding:10px 12px', 'user-select:none',
      'max-height:90vh', 'overflow:auto',
    ].join(';');

    const title = document.createElement('div');
    title.textContent = 'RIGRUNNER · map editor';
    title.style.cssText = 'font-weight:600;color:#f0c870;margin-bottom:8px';

    // Mode toggle — Paint | Place.
    this.modeButtons = {
      paint: this.tab('Paint', () => this.setMode('paint')),
      place: this.tab('Place', () => this.setMode('place')),
    };
    const modeRow = this.row(this.modeButtons.paint, this.modeButtons.place);

    // Paint section — Bake the wall from the mountain, brush size.
    const brushLabel = document.createElement('div');
    this.brush = brushLabel;
    this.brush.style.cssText = 'flex:1;text-align:center;align-self:center';
    this.paintSection = document.createElement('div');
    this.paintSection.append(
      this.row(this.button('Bake from mesh', opts.onBake)),
      this.row(this.button('– brush', opts.onThinner), this.brush, this.button('brush +', opts.onThicker)),
    );

    // Place section — round-robin toggle + the kind palette.
    this.placeSection = document.createElement('div');
    this.placeSection.append(this.roundRobinRow(), this.palette());

    // Save is common to both modes.
    const saveRow = this.row(this.button('Save', opts.onSave));

    this.status = document.createElement('div');
    this.status.style.cssText = 'color:#9fd09f;min-height:1.4em;margin-top:4px';

    this.hints = document.createElement('div');
    this.hints.style.cssText = 'color:#aaa29080;margin-top:6px;font-size:12px';

    panel.append(title, modeRow, this.paintSection, this.placeSection, saveRow, this.status, this.hints);
    document.body.append(panel);

    this.setBrush(1);
    this.setMode('paint');
    this.setStatus('Loaded the committed map. Paint collision, or switch to Place to author the layout.');
  }

  setStatus(msg: string): void {
    this.status.textContent = msg;
  }

  setBrush(sideCells: number): void {
    this.brush.textContent = `brush: ${sideCells}×${sideCells}`;
  }

  private setMode(mode: EditorMode): void {
    this.mode = mode;
    this.paintSection.style.display = mode === 'paint' ? 'block' : 'none';
    this.placeSection.style.display = mode === 'place' ? 'block' : 'none';
    for (const m of ['paint', 'place'] as EditorMode[]) this.styleTab(this.modeButtons[m], m === mode);
    this.hints.innerHTML = mode === 'paint'
      ? 'L-drag <b>paint</b> · R-drag <b>erase</b> · <b>[ ]</b> brush size<br>WASD/arrows pan · wheel zoom · mid-drag pan · <b>T</b> tilt'
      : 'click <b>place</b> · drag <b>move</b> · <b>[ ]</b> rotate · <b>Del</b> remove<br>WASD/arrows pan · wheel zoom · mid-drag pan · <b>T</b> tilt';
    this.opts.onMode(mode);
  }

  private palette(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'margin-top:4px';
    let lastCategory: PlacementCategory | null = null;
    for (const def of PLACEMENT_KINDS) {
      if (def.category !== lastCategory) {
        lastCategory = def.category;
        const head = document.createElement('div');
        head.textContent = CATEGORY_LABEL[def.category];
        head.style.cssText = 'color:#c8a85a;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;margin:8px 0 3px';
        wrap.append(head);
      }
      const b = document.createElement('button');
      b.textContent = def.label;
      b.style.cssText = this.kindCss(def.id === this.selectedKind);
      b.addEventListener('click', () => this.pickKind(def.id));
      this.kindButtons.set(def.id, b);
      wrap.append(b);
    }
    return wrap;
  }

  private pickKind(kind: string): void {
    this.selectedKind = kind;
    for (const [id, b] of this.kindButtons) b.style.cssText = this.kindCss(id === kind);
    this.opts.onPickKind(kind);
    if (this.mode !== 'place') this.setMode('place');
  }

  private roundRobinRow(): HTMLElement {
    const row = document.createElement('label');
    row.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:4px;cursor:pointer';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.addEventListener('change', () => this.opts.onRoundRobin(box.checked));
    const text = document.createElement('span');
    text.textContent = 'round-robin rotate (8-wind)';
    row.append(box, text);
    return row;
  }

  // ── styling helpers ───────────────────────────────────────────────────────────────────────────────

  private row(...children: HTMLElement[]): HTMLElement {
    const r = document.createElement('div');
    r.style.cssText = 'display:flex;gap:6px;margin-bottom:6px';
    r.append(...children);
    return r;
  }

  private button(label: string, onClick: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = [
      'flex:1', 'padding:6px 8px', 'cursor:pointer', 'font:inherit',
      'color:#1a1712', 'background:#e8c060', 'border:none', 'border-radius:5px', 'font-weight:600',
    ].join(';');
    b.addEventListener('click', onClick);
    return b;
  }

  private tab(label: string, onClick: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  private styleTab(b: HTMLButtonElement, active: boolean): void {
    b.style.cssText = [
      'flex:1', 'padding:6px 8px', 'cursor:pointer', 'font:inherit', 'border-radius:5px', 'font-weight:600',
      active ? 'color:#1a1712;background:#f0c870;border:none' : 'color:#e8e2d4;background:rgba(255,255,255,0.06);border:1px solid rgba(180,150,90,0.4)',
    ].join(';');
  }

  private kindCss(active: boolean): string {
    return [
      'display:block', 'width:100%', 'text-align:left', 'padding:4px 8px', 'margin-bottom:3px',
      'cursor:pointer', 'font:inherit', 'font-size:12px', 'border-radius:4px',
      active ? 'color:#1a1712;background:#5cf0ff;border:none' : 'color:#d8d2c4;background:rgba(255,255,255,0.05);border:1px solid rgba(120,140,150,0.3)',
    ].join(';');
  }
}
