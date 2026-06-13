import type { CollisionGrid } from '@features/terrain/collision-grid';
import type { Picker } from '@common/render/picker';
import type { PaintOverlay } from './paint-overlay';
import type { BrushRect } from './brush-cursor';

/**
 * Direct cell painting: LEFT-drag paints blocked collision, RIGHT-drag erases. Strokes interpolate along
 * the drag path so a freehand line is continuous, not dotted. The brush is a SQUARE of `brushSize` cells
 * per side — **size 1 is a single cell**, the smallest mark you can place — set on demand ([ ] keys or the
 * toolbar). Its footprint is shown live by the brush-tip cursor, snapped to the exact cells it will paint.
 */
export class PaintController {
  private brushSize = 1; // square side in cells; 1 = a single cell
  private painting = false;
  private erasing = false;
  private last: { x: number; z: number } | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly picker: Picker,
    private readonly grid: CollisionGrid,
    private readonly overlay: PaintOverlay,
    /** Show the brush footprint: the cell-snapped rect under the cursor (or null when off-canvas). */
    private readonly onCursor: (rect: BrushRect | null) => void,
    private readonly onChange: () => void = () => {},
  ) {
    canvas.addEventListener('contextmenu', (e) => e.preventDefault()); // right-drag erases, no menu
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button === 0) this.painting = true;
      else if (e.button === 2) this.erasing = true;
      else return;
      canvas.setPointerCapture(e.pointerId);
      this.last = null; // fresh stroke
      this.stroke(e.clientX, e.clientY);
    });
    canvas.addEventListener('pointermove', (e) => {
      this.moveCursor(e.clientX, e.clientY);
      if (this.painting || this.erasing) this.stroke(e.clientX, e.clientY);
    });
    canvas.addEventListener('pointerup', (e) => {
      if (e.button === 0) this.painting = false;
      else if (e.button === 2) this.erasing = false;
      this.last = null;
    });
    canvas.addEventListener('pointerleave', () => this.onCursor(null));
    window.addEventListener('keydown', (e) => {
      if (e.key === '[') this.setBrush(this.brushSize - 1);
      else if (e.key === ']') this.setBrush(this.brushSize + 1);
    });
  }

  get brushRadius(): number {
    return this.brushSize; // the side length (kept name for the toolbar wiring)
  }
  setBrush(n: number): void {
    this.brushSize = Math.min(64, Math.max(1, n)); // never below a single cell
    this.onChange();
  }

  /** The cell range a square brush centred on a ground point covers. */
  private cells(x: number, z: number): { minCol: number; minRow: number; maxCol: number; maxRow: number } {
    const half = Math.floor(this.brushSize / 2);
    const minCol = this.grid.colOf(x) - half;
    const minRow = this.grid.rowOf(z) - half;
    return { minCol, minRow, maxCol: minCol + this.brushSize - 1, maxRow: minRow + this.brushSize - 1 };
  }

  /** Report the cell-snapped world rect under the cursor so the brush-tip cursor can outline it. */
  private moveCursor(clientX: number, clientY: number): void {
    const hit = this.picker.raycastPlane(clientX, clientY, 0);
    if (!hit) { this.onCursor(null); return; }
    const r = this.cells(hit.x, hit.z);
    this.onCursor({
      minX: this.grid.originX + r.minCol * this.grid.cellSize,
      minZ: this.grid.originZ + r.minRow * this.grid.cellSize,
      maxX: this.grid.originX + (r.maxCol + 1) * this.grid.cellSize,
      maxZ: this.grid.originZ + (r.maxRow + 1) * this.grid.cellSize,
    });
  }

  /** Extend the stroke to the cursor, stamping the brush along the line from the last point (continuous). */
  private stroke(clientX: number, clientY: number): void {
    const hit = this.picker.raycastPlane(clientX, clientY, 0);
    if (!hit) return;
    const blocked = this.painting;
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

  /** Paint (or erase) a square of cells centred on a ground point. */
  private stamp(x: number, z: number, blocked: boolean): void {
    const r = this.cells(x, z);
    for (let row = r.minRow; row <= r.maxRow; row++) {
      for (let col = r.minCol; col <= r.maxCol; col++) this.grid.setBlocked(col, row, blocked);
    }
  }
}
