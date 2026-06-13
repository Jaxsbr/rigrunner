import type { Picker } from '@common/render/picker';
import type { CollisionShape } from '@features/terrain/collision-shapes';
import type { OrthoControls } from './ortho-controls';
import type { ShapeOverlay } from './shape-overlay';

export type EditorMode = 'draw' | 'edit';

/**
 * The vector authoring interaction. DRAW mode: each left-click drops a control point onto the active
 * path (the spline updates live); click back on the first point to close it into a filled region, Enter
 * finishes it as an open wall, Esc cancels. EDIT mode: left-drag a control point to bend the curve,
 * double-click a path to insert a point, Delete removes the selected point (or the whole path). New
 * paths take the current add/carve + thickness settings.
 *
 * It mutates the shared `shapes` array, then drives the three downstream effects through one `apply()`:
 * recompile the grid (collision), redraw the overlay (the lines + handles), and refresh the toolbar.
 */
export class ShapeTool {
  private mode: EditorMode = 'draw';
  private drawingIndex: number | null = null; // the path being drawn, or null
  private selected: { shape: number; point: number } | null = null; // point === -1 → whole-shape selected
  private dragging = false;

  // Settings the NEXT drawn path takes.
  newCarve = false;
  newThickness = 6;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly picker: Picker,
    private readonly controls: OrthoControls,
    private readonly shapes: CollisionShape[],
    private readonly overlay: ShapeOverlay,
    private readonly recompile: () => void,
    private readonly refreshUi: () => void,
  ) {
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return; // middle = pan (controls), right reserved
      canvas.setPointerCapture(e.pointerId);
      this.onDown(e.clientX, e.clientY);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (this.dragging) this.onDrag(e.clientX, e.clientY);
    });
    canvas.addEventListener('pointerup', () => { this.dragging = false; });
    canvas.addEventListener('dblclick', (e) => this.onDoubleClick(e.clientX, e.clientY));
    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  getMode(): EditorMode { return this.mode; }
  setMode(m: EditorMode): void {
    this.mode = m;
    if (m === 'edit' && this.drawingIndex !== null) this.drawingIndex = null; // finish any open draw
    this.apply();
  }

  /** A grab radius in world units that stays ~constant on screen as you zoom. */
  private pickRadius(): number {
    return this.controls.worldPerPixel * 9;
  }

  private ground(clientX: number, clientY: number): { x: number; z: number } | null {
    return this.picker.raycastPlane(clientX, clientY, 0);
  }

  private onDown(clientX: number, clientY: number): void {
    const hit = this.ground(clientX, clientY);
    if (!hit) return;
    if (this.mode === 'draw') {
      if (this.drawingIndex === null) {
        this.shapes.push({ points: [hit], closed: false, carve: this.newCarve, thickness: this.newThickness });
        this.drawingIndex = this.shapes.length - 1;
        this.selected = { shape: this.drawingIndex, point: 0 };
      } else {
        const shape = this.shapes[this.drawingIndex]!;
        if (shape.points.length >= 3 && this.dist(hit, shape.points[0]!) < this.pickRadius()) {
          shape.closed = true; // clicked the start → close the region
          this.drawingIndex = null;
        } else {
          shape.points.push(hit);
          this.selected = { shape: this.shapes.indexOf(shape), point: shape.points.length - 1 };
        }
      }
    } else {
      const pt = this.nearestPoint(hit);
      if (pt) { this.selected = pt; this.dragging = true; }
      else { const sh = this.nearestShape(hit); this.selected = sh !== null ? { shape: sh, point: -1 } : null; }
    }
    this.apply();
  }

  private onDrag(clientX: number, clientY: number): void {
    if (!this.selected || this.selected.point < 0) return;
    const hit = this.ground(clientX, clientY);
    if (!hit) return;
    this.shapes[this.selected.shape]!.points[this.selected.point] = hit;
    this.apply();
  }

  private onDoubleClick(clientX: number, clientY: number): void {
    const hit = this.ground(clientX, clientY);
    if (!hit) return;
    if (this.mode === 'draw') { this.drawingIndex = null; this.apply(); return; } // finish as an open wall
    // edit: insert a point on the nearest path, splitting the closest segment.
    const sh = this.nearestShape(hit);
    if (sh === null) return;
    const shape = this.shapes[sh]!;
    const insertAt = this.nearestSegment(shape, hit) + 1;
    shape.points.splice(insertAt, 0, hit);
    this.selected = { shape: sh, point: insertAt };
    this.apply();
  }

  private onKey(e: KeyboardEvent): void {
    if (e.key === 'Enter' && this.drawingIndex !== null) { this.drawingIndex = null; this.apply(); }
    else if (e.key === 'Escape' && this.drawingIndex !== null) {
      this.shapes.splice(this.drawingIndex, 1); // drop the in-progress path
      this.drawingIndex = null;
      this.selected = null;
      this.apply();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      this.deleteSelected();
    }
  }

  /** Remove the selected control point, or the whole shape if it's selected (or would fall below 1 point). */
  deleteSelected(): void {
    if (!this.selected) return;
    const shape = this.shapes[this.selected.shape];
    if (!shape) return;
    if (this.selected.point < 0 || shape.points.length <= 1) {
      this.shapes.splice(this.selected.shape, 1);
    } else {
      shape.points.splice(this.selected.point, 1);
    }
    this.selected = null;
    this.drawingIndex = null;
    this.apply();
  }

  /** Toggle a property of the selected shape, or fall back to the new-shape default. */
  toggleCarve(): void {
    const shape = this.selected ? this.shapes[this.selected.shape] : undefined;
    if (shape) shape.carve = !shape.carve;
    else this.newCarve = !this.newCarve;
    this.apply();
  }
  setThickness(t: number): void {
    this.newThickness = t;
    const shape = this.selected ? this.shapes[this.selected.shape] : undefined;
    if (shape && !shape.closed) shape.thickness = t;
    this.apply();
  }

  /** The carve/thickness the toolbar should show — the selected shape's, else the new-shape default. */
  get displayCarve(): boolean {
    const shape = this.selected ? this.shapes[this.selected.shape] : undefined;
    return shape ? shape.carve : this.newCarve;
  }
  get displayThickness(): number {
    const shape = this.selected ? this.shapes[this.selected.shape] : undefined;
    return shape && !shape.closed ? shape.thickness : this.newThickness;
  }

  private dist(a: { x: number; z: number }, b: { x: number; z: number }): number {
    return Math.hypot(a.x - b.x, a.z - b.z);
  }

  private nearestPoint(hit: { x: number; z: number }): { shape: number; point: number } | null {
    let best: { shape: number; point: number } | null = null;
    let bestD = this.pickRadius();
    this.shapes.forEach((s, si) =>
      s.points.forEach((p, pi) => {
        const d = this.dist(p, hit);
        if (d < bestD) { bestD = d; best = { shape: si, point: pi }; }
      }),
    );
    return best;
  }

  private nearestShape(hit: { x: number; z: number }): number | null {
    let best: number | null = null;
    let bestD = this.pickRadius();
    this.shapes.forEach((s, si) => {
      for (const p of s.points) {
        const d = this.dist(p, hit);
        if (d < bestD) { bestD = d; best = si; }
      }
    });
    return best;
  }

  /** Index i such that the click is nearest the control-point pair (i, i+1). */
  private nearestSegment(shape: CollisionShape, hit: { x: number; z: number }): number {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < shape.points.length - 1; i++) {
      const mid = { x: (shape.points[i]!.x + shape.points[i + 1]!.x) / 2, z: (shape.points[i]!.z + shape.points[i + 1]!.z) / 2 };
      const d = this.dist(mid, hit);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  /** Recompile the grid, redraw the overlay, refresh the toolbar — after any change. */
  private apply(): void {
    this.recompile();
    this.refreshOverlay();
    this.refreshUi();
  }

  /** Redraw only the lines + handles (no recompile) — called each frame so handles stay screen-sized. */
  refreshOverlay(): void {
    this.overlay.sync(this.shapes, this.selected, this.drawingIndex, this.controls.worldPerPixel * 5);
  }
}
