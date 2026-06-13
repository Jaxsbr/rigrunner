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
  private brushCells = 1; // brush radius in cells — small by default, for tracing fine detail
  private painting = false;
  private erasing = false;
  private last: { x: number; z: number } | null = null; // previous stroke point, for continuous lines

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
      this.last = null; // a fresh stroke — the first dab stands alone, no line back to the last stroke
      this.stroke(e.clientX, e.clientY);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (this.painting || this.erasing) this.stroke(e.clientX, e.clientY);
    });
    canvas.addEventListener('pointerup', (e) => {
      if (e.button === 0) this.painting = false;
      else if (e.button === 2) this.erasing = false;
      this.last = null;
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
    this.brushCells = Math.min(40, Math.max(0, n));
    this.onChange();
  }

  /**
   * Extend the stroke to the ground point under the cursor: stamp the brush ALONG the line from the last
   * point to this one (sub-cell steps), so a fast freehand drag draws a smooth continuous line instead of
   * a trail of separate dabs.
   */
  private stroke(clientX: number, clientY: number): void {
    const hit = this.picker.raycastPlane(clientX, clientY, 0);
    if (!hit) return;
    const blocked = this.painting; // left = paint, right = erase
    if (this.last) {
      const dist = Math.hypot(hit.x - this.last.x, hit.z - this.last.z);
      const steps = Math.max(1, Math.ceil(dist / (this.grid.cellSize * 0.5)));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        this.stamp(this.last.x + (hit.x - this.last.x) * t, this.last.z + (hit.z - this.last.z) * t, blocked);
      }
    } else {
      this.stamp(hit.x, hit.z, blocked);
    }
    this.last = hit;
    this.overlay.redraw();
  }

  /** Paint (or erase) a disc of cells centred on a ground point. */
  private stamp(x: number, z: number, blocked: boolean): void {
    const col0 = this.grid.colOf(x);
    const row0 = this.grid.rowOf(z);
    const r = this.brushCells;
    for (let dr = -r; dr <= r; dr++) {
      for (let dc = -r; dc <= r; dc++) {
        if (dc * dc + dr * dr <= r * r) this.grid.setBlocked(col0 + dc, row0 + dr, blocked);
      }
    }
  }
}
