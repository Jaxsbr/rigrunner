import type { CollisionGrid } from '@features/terrain/collision-grid';
import type { Picker } from '@common/render/picker';
import type { PaintOverlay } from './paint-overlay';

/**
 * Direct cell painting: LEFT-drag paints blocked collision, RIGHT-drag erases. Strokes interpolate along
 * the drag path so a freehand line is continuous, not dotted. The brush is a disc of `brushCells` radius,
 * sized on demand ([ ] keys or the toolbar), and its footprint is shown live by the brush-tip cursor
 * (fed the cursor position + radius through `onCursor`, so you always see exactly where paint will land).
 */
export class PaintController {
  private brushCells = 2; // brush radius in cells
  private painting = false;
  private erasing = false;
  private last: { x: number; z: number } | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly picker: Picker,
    private readonly grid: CollisionGrid,
    private readonly overlay: PaintOverlay,
    /** Show the brush footprint: the ground point under the cursor (or null when off-canvas) + its world radius. */
    private readonly onCursor: (world: { x: number; z: number } | null, radiusWorld: number) => void,
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
    canvas.addEventListener('pointerleave', () => this.onCursor(null, this.radiusWorld()));
    window.addEventListener('keydown', (e) => {
      if (e.key === '[') this.setBrush(this.brushCells - 1);
      else if (e.key === ']') this.setBrush(this.brushCells + 1);
    });
  }

  get brushRadius(): number {
    return this.brushCells;
  }
  setBrush(n: number): void {
    this.brushCells = Math.min(60, Math.max(0, n));
    this.onChange();
  }
  private radiusWorld(): number {
    return (this.brushCells + 0.5) * this.grid.cellSize; // the painted disc's true world radius
  }

  /** Report the cursor's ground position + brush radius so the brush-tip cursor can track it. */
  private moveCursor(clientX: number, clientY: number): void {
    this.onCursor(this.picker.raycastPlane(clientX, clientY, 0), this.radiusWorld());
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
