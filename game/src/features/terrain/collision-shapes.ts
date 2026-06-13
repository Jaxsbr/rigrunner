import type { CollisionGrid } from './collision-grid';

/**
 * Vector collision shapes — the authoring source the map editor edits, compiled down into the runtime
 * collision grid. Authoring is resolution-independent: you draw smooth spline paths and bend them by
 * dragging points, instead of stamping cells. The grid is just the compiled result the game loads
 * (slide/de-pen, guards — all unchanged). See `docs/specs/map-editor-spec.md`.
 *
 * A shape is a path of control points rendered as a Catmull-Rom spline (smooth, passing THROUGH the
 * points). Open paths are thick walls (a curved barrier); closed paths are filled regions. Each shape
 * either adds collision or carves it away (so a baked mountain can be refined — e.g. a cleaner gap cut).
 */
export interface ShapePoint {
  x: number;
  z: number;
}

export interface CollisionShape {
  /** Control points the spline passes through (world x/z). */
  points: ShapePoint[];
  /** Closed = a filled region; open = a wall of `thickness`. */
  closed: boolean;
  /** true = subtract collision (carve), false = add. */
  carve: boolean;
  /** Wall width in world units, for open paths. */
  thickness: number;
}

/** One Catmull-Rom coordinate for parameter t∈[0,1] across the p1→p2 segment (p0,p3 are the neighbours). */
function catmull(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

// World-space sampling step along a spline — fine enough that the rasterised edge is smooth at the
// grid's cell size, cheap enough to recompute live while dragging.
const SAMPLE_STEP = 1.0;

/**
 * Sample a shape's control points into a dense polyline tracing the smooth Catmull-Rom curve. Fewer than
 * two points returns the points as-is (a single dab / nothing). Used for BOTH rendering the path and
 * rasterising it, so the line you see is exactly the collision you get.
 */
export function sampleSpline(points: ShapePoint[], closed: boolean): ShapePoint[] {
  const n = points.length;
  if (n < 2) return points.slice();
  const out: ShapePoint[] = [];
  const segments = closed ? n : n - 1;
  for (let i = 0; i < segments; i++) {
    const p0 = points[closed ? (i - 1 + n) % n : Math.max(0, i - 1)]!;
    const p1 = points[i % n]!;
    const p2 = points[(i + 1) % n]!;
    const p3 = points[closed ? (i + 2) % n : Math.min(n - 1, i + 2)]!;
    const steps = Math.max(2, Math.ceil(Math.hypot(p2.x - p1.x, p2.z - p1.z) / SAMPLE_STEP));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      out.push({ x: catmull(p0.x, p1.x, p2.x, p3.x, t), z: catmull(p0.z, p1.z, p2.z, p3.z, t) });
    }
  }
  if (closed) out.push({ ...out[0]! }); // close the ring
  else out.push({ ...points[n - 1]! }); // include the final endpoint
  return out;
}

/**
 * Compile the vector shapes into the grid: start from the base layer (the mesh-baked footprint, or
 * empty), then apply each shape in order — closed shapes fill their polygon, open shapes stroke a thick
 * band along the spline; carve shapes clear instead of set. Cheap enough to run live on every edit (the
 * base is a pre-snapshotted array, so only the shapes are re-rasterised).
 */
export function compileCollision(grid: CollisionGrid, base: Uint8Array | null, shapes: CollisionShape[]): void {
  if (base) grid.cells.set(base);
  else grid.cells.fill(0);
  for (const shape of shapes) {
    const poly = sampleSpline(shape.points, shape.closed);
    if (poly.length === 0) continue;
    if (shape.closed && poly.length >= 3) fillPolygon(grid, poly, !shape.carve);
    else strokePath(grid, poly, shape.thickness, !shape.carve);
  }
}

/** Scanline-fill a closed polygon (world coords) into the grid. */
function fillPolygon(grid: CollisionGrid, poly: ShapePoint[], blocked: boolean): void {
  let minRow = grid.height;
  let maxRow = 0;
  for (const p of poly) {
    minRow = Math.min(minRow, grid.rowOf(p.z));
    maxRow = Math.max(maxRow, grid.rowOf(p.z));
  }
  minRow = Math.max(0, minRow);
  maxRow = Math.min(grid.height - 1, maxRow);

  for (let row = minRow; row <= maxRow; row++) {
    const zc = grid.originZ + (row + 0.5) * grid.cellSize; // the scanline at this row's centre
    const xs: number[] = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]!;
      const b = poly[(i + 1) % poly.length]!;
      if ((a.z <= zc && b.z > zc) || (b.z <= zc && a.z > zc)) {
        xs.push(a.x + ((zc - a.z) / (b.z - a.z)) * (b.x - a.x));
      }
    }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const c0 = grid.colOf(xs[i]!);
      const c1 = grid.colOf(xs[i + 1]!);
      for (let col = c0; col <= c1; col++) grid.setBlocked(col, row, blocked);
    }
  }
}

/** Stamp a thick band of width `thickness` along a polyline (world coords) into the grid. */
function strokePath(grid: CollisionGrid, poly: ShapePoint[], thickness: number, blocked: boolean): void {
  const radCells = Math.max(0, Math.round(thickness / 2 / grid.cellSize));
  if (poly.length === 1) {
    stampDisc(grid, poly[0]!.x, poly[0]!.z, radCells, blocked);
    return;
  }
  for (let i = 0; i + 1 < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[i + 1]!;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const steps = Math.max(1, Math.ceil(len / (grid.cellSize * 0.5)));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      stampDisc(grid, a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, radCells, blocked);
    }
  }
}

/** Set/clear a filled disc of cells. */
function stampDisc(grid: CollisionGrid, x: number, z: number, radCells: number, blocked: boolean): void {
  const c0 = grid.colOf(x);
  const r0 = grid.rowOf(z);
  for (let dr = -radCells; dr <= radCells; dr++) {
    for (let dc = -radCells; dc <= radCells; dc++) {
      if (dc * dc + dr * dr <= radCells * radCells) grid.setBlocked(c0 + dc, r0 + dr, blocked);
    }
  }
}
