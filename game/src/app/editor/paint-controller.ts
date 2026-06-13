import type { CollisionGrid } from '@features/terrain/collision-grid';
import type { Picker } from '@common/render/picker';
import type { PaintOverlay } from './paint-overlay';

/**
 * Turns mouse strokes into painted collision: the cursor is ray-cast to the ground (via the shared
 * Picker, so it's exact under any camera), mapped to a grid cell, and a circular brush of cells is
 * marked. LEFT button paints blocked rock; RIGHT button erases. `[` / `]` size the brush. After each
 * stroke it asks the overlay to repaint, so the red wash tracks the paint live.
 */
export class PaintController {
  private brushCells = 2; // brush radius in cells
  private painting = false;
  private erasing = false;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly picker: Picker,
    private readonly grid: CollisionGrid,
    private readonly overlay: PaintOverlay,
    private readonly onChange: () => void = () => {},
  ) {
    canvas.addEventListener('contextmenu', (e) => e.preventDefault()); // right-drag erases, no menu
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button === 0) this.painting = true;
      else if (e.button === 2) this.erasing = true;
      else return;
      canvas.setPointerCapture(e.pointerId);
      this.stroke(e.clientX, e.clientY);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (this.painting || this.erasing) this.stroke(e.clientX, e.clientY);
    });
    canvas.addEventListener('pointerup', (e) => {
      if (e.button === 0) this.painting = false;
      else if (e.button === 2) this.erasing = false;
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === '[') this.setBrush(this.brushCells - 1);
      else if (e.key === ']') this.setBrush(this.brushCells + 1);
    });
  }

  get brushRadius(): number {
    return this.brushCells;
  }

  private setBrush(n: number): void {
    this.brushCells = Math.min(20, Math.max(0, n));
    this.onChange();
  }

  /** Paint (or erase) a disc of cells centred on the ground point under the cursor. */
  private stroke(clientX: number, clientY: number): void {
    const hit = this.picker.raycastPlane(clientX, clientY, 0);
    if (!hit) return;
    const blocked = this.painting; // left = paint, right = erase
    const col0 = this.grid.colOf(hit.x);
    const row0 = this.grid.rowOf(hit.z);
    const r = this.brushCells;
    for (let dr = -r; dr <= r; dr++) {
      for (let dc = -r; dc <= r; dc++) {
        if (dc * dc + dr * dr <= r * r) this.grid.setBlocked(col0 + dc, row0 + dr, blocked);
      }
    }
    this.overlay.redraw();
  }
}
