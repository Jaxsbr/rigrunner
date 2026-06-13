import type { EditorMode } from './shape-tool';

/** The toolbar's live state, pushed in on every change so the labels track the tool. */
export interface EditorUIState {
  mode: EditorMode;
  carve: boolean;
  thickness: number;
  shapes: number;
}

/**
 * The editor's on-screen toolbar — vector authoring controls (mode, add/carve, wall thickness, delete)
 * plus Bake / Save, a live status line, and mode-specific hints. Plain DOM injected over the canvas
 * (dev tooling, not the player HUD), styled inline.
 */
export class EditorUI {
  private readonly status: HTMLElement;
  private readonly modeBtn: HTMLButtonElement;
  private readonly carveBtn: HTMLButtonElement;
  private readonly thickEl: HTMLElement;
  private readonly hints: HTMLElement;
  private readonly count: HTMLElement;

  constructor(opts: {
    onBake: () => void;
    onSave: () => void;
    onToggleMode: () => void;
    onToggleCarve: () => void;
    onThicker: () => void;
    onThinner: () => void;
    onDelete: () => void;
  }) {
    const panel = document.createElement('div');
    panel.style.cssText = [
      'position:fixed', 'top:12px', 'left:12px', 'z-index:10', 'width:250px',
      'font:13px/1.5 system-ui,sans-serif', 'color:#e8e2d4',
      'background:rgba(20,18,14,0.85)', 'border:1px solid rgba(180,150,90,0.4)',
      'border-radius:8px', 'padding:10px 12px', 'user-select:none',
    ].join(';');

    const title = document.createElement('div');
    title.textContent = 'RIGRUNNER · map editor';
    title.style.cssText = 'font-weight:600;color:#f0c870;margin-bottom:8px';

    this.modeBtn = this.button('Mode: Draw', opts.onToggleMode);
    this.carveBtn = this.button('Add', opts.onToggleCarve);
    const modeRow = this.row(this.modeBtn, this.carveBtn);

    const minus = this.button('–', opts.onThinner);
    const plus = this.button('+', opts.onThicker);
    this.thickEl = document.createElement('div');
    this.thickEl.style.cssText = 'flex:1;text-align:center;align-self:center';
    const delBtn = this.button('Delete', opts.onDelete);
    const thickRow = this.row(minus, this.thickEl, plus, delBtn);

    const actionRow = this.row(this.button('Bake from mesh', opts.onBake), this.button('Save', opts.onSave));

    this.count = document.createElement('div');
    this.count.style.cssText = 'color:#aaa29080;font-size:12px;margin-top:6px';
    this.status = document.createElement('div');
    this.status.style.cssText = 'color:#9fd09f;min-height:1.4em';
    this.hints = document.createElement('div');
    this.hints.style.cssText = 'color:#aaa29080;margin-top:6px;font-size:12px';

    panel.append(title, modeRow, thickRow, actionRow, this.count, this.status, this.hints);
    document.body.append(panel);

    this.setStatus('Loaded. Draw collision paths over the baked wall; Save compiles + writes the map.');
  }

  /** Push the tool's current state into the labels + hints. */
  refresh(s: EditorUIState): void {
    this.modeBtn.textContent = `Mode: ${s.mode === 'draw' ? 'Draw' : 'Edit'}`;
    this.carveBtn.textContent = s.carve ? 'Carve' : 'Add';
    this.carveBtn.style.background = s.carve ? '#e07a3d' : '#39a7c8';
    this.thickEl.textContent = `wall ⌀ ${s.thickness}`;
    this.count.textContent = `${s.shapes} shape${s.shapes === 1 ? '' : 's'}`;
    this.hints.innerHTML = s.mode === 'draw'
      ? 'Click to drop points · click the <b>start</b> to close a region<br><b>Enter</b> finish wall · <b>Esc</b> cancel · WASD/wheel/<b>T</b> view'
      : 'Drag a point to bend · dbl-click a path to add a point<br><b>Delete</b> remove · click a path to select · WASD/wheel/<b>T</b> view';
  }

  setStatus(msg: string): void {
    this.status.textContent = msg;
  }

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
}
