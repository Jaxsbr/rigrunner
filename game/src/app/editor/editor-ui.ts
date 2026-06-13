/**
 * The editor's on-screen toolbar — Bake / Save, an on-demand brush-size control, a live status line, and
 * the control hints. Plain DOM injected over the canvas (dev tooling, not the player HUD), styled inline.
 */
export class EditorUI {
  private readonly status: HTMLElement;
  private readonly brush: HTMLElement;

  constructor(opts: { onBake: () => void; onSave: () => void; onThicker: () => void; onThinner: () => void }) {
    const panel = document.createElement('div');
    panel.style.cssText = [
      'position:fixed', 'top:12px', 'left:12px', 'z-index:10', 'width:240px',
      'font:13px/1.5 system-ui,sans-serif', 'color:#e8e2d4',
      'background:rgba(20,18,14,0.85)', 'border:1px solid rgba(180,150,90,0.4)',
      'border-radius:8px', 'padding:10px 12px', 'user-select:none',
    ].join(';');

    const title = document.createElement('div');
    title.textContent = 'RIGRUNNER · map editor';
    title.style.cssText = 'font-weight:600;color:#f0c870;margin-bottom:8px';

    const actions = this.row(this.button('Bake from mesh', opts.onBake), this.button('Save', opts.onSave));

    this.brush = document.createElement('div');
    this.brush.style.cssText = 'flex:1;text-align:center;align-self:center';
    const brushRow = this.row(
      this.button('– brush', opts.onThinner),
      this.brush,
      this.button('brush +', opts.onThicker),
    );

    this.status = document.createElement('div');
    this.status.style.cssText = 'color:#9fd09f;min-height:1.4em';

    const hints = document.createElement('div');
    hints.style.cssText = 'color:#aaa29080;margin-top:6px;font-size:12px';
    hints.innerHTML =
      'L-drag <b>paint</b> · R-drag <b>erase</b> · <b>[ ]</b> brush size<br>' +
      'WASD/arrows pan · wheel zoom · mid-drag pan · <b>T</b> tilt';

    panel.append(title, actions, brushRow, this.status, hints);
    document.body.append(panel);

    this.setBrush(1);
    this.setStatus('Loaded the committed map. Bake to (re)derive the wall, then paint to refine.');
  }

  setStatus(msg: string): void {
    this.status.textContent = msg;
  }

  setBrush(sideCells: number): void {
    this.brush.textContent = `brush: ${sideCells}×${sideCells}`;
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
