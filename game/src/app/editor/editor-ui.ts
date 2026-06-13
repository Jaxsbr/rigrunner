/**
 * The editor's on-screen toolbar — a small fixed panel with the Save / Bake actions, a live status line,
 * the current brush size, and the control hints. Plain DOM injected over the canvas (the editor is dev
 * tooling, not part of the player HUD), styled inline so it needs no stylesheet.
 */
export class EditorUI {
  private readonly status: HTMLElement;
  private readonly brush: HTMLElement;

  constructor(opts: { onSave: () => void; onBake: () => void }) {
    const panel = document.createElement('div');
    panel.style.cssText = [
      'position:fixed', 'top:12px', 'left:12px', 'z-index:10',
      'font:13px/1.5 system-ui,sans-serif', 'color:#e8e2d4',
      'background:rgba(20,18,14,0.82)', 'border:1px solid rgba(180,150,90,0.4)',
      'border-radius:8px', 'padding:10px 12px', 'min-width:220px', 'user-select:none',
    ].join(';');

    const title = document.createElement('div');
    title.textContent = 'RIGRUNNER · map editor';
    title.style.cssText = 'font-weight:600;color:#f0c870;margin-bottom:6px';

    const buttons = document.createElement('div');
    buttons.style.cssText = 'display:flex;gap:8px;margin-bottom:8px';
    buttons.append(
      this.button('Bake from mesh', opts.onBake),
      this.button('Save', opts.onSave),
    );

    this.brush = document.createElement('div');
    this.status = document.createElement('div');
    this.status.style.cssText = 'color:#9fd09f;min-height:1.5em';

    const hints = document.createElement('div');
    hints.style.cssText = 'color:#aaa29080;margin-top:6px;font-size:12px';
    hints.innerHTML =
      'L-drag <b>paint</b> · R-drag <b>erase</b> · <b>[ ]</b> brush<br>' +
      'WASD/arrows pan · wheel zoom · mid-drag pan · <b>T</b> tilt';

    panel.append(title, buttons, this.brush, this.status, hints);
    document.body.append(panel);

    this.setBrush(2);
    this.setStatus('Loaded the committed map. Bake to (re)derive the wall from the mountain.');
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

  setStatus(msg: string): void {
    this.status.textContent = msg;
  }

  setBrush(radiusCells: number): void {
    this.brush.textContent = `brush: ${radiusCells} cell${radiusCells === 1 ? '' : 's'} radius`;
  }
}
