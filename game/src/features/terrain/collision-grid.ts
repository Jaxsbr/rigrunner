import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { Collider } from '@common/components/collider';

/**
 * Static world collision as a painted occupancy grid — the technique that retires the primitive collider
 * ring for the bowl wall (see `docs/specs/map-editor-spec.md`). A smooth circle can't trace the mountain
 * mesh's irregular silhouette (it bulges into the drivable gaps AND falls short of the rock's outward
 * bulges); the grid IS the silhouette, so the gaps are exactly drivable and the rock exactly solid, and
 * one query blocks the rig and the camp guards alike.
 *
 * The grid is a coarse raster over the playable disc: a flat array of cells, each blocked (1) or clear
 * (0). It is authored in the map editor (`app/editor`), serialized into a committed map file, and loaded
 * at seed time. This module is the runtime half: the grid data structure + the de-penetration system that
 * pushes movers out of blocked cells.
 *
 * The grid covers the ridge only — the bowl interior, the exit gaps, and the thin band of ground beyond
 * the ridge stay clear; the far void past the map is held by `worldBoundsSystem`, not the grid. So out of
 * the grid's range reads as CLEAR (the world-end clamp is the outer backstop).
 */

/** Serialized, committed form of a collision grid — a small JSON document loaded at seed time. */
export interface CollisionMap {
  /** Bumped if the on-disk shape ever changes, so a loader can refuse an incompatible file. */
  version: 1;
  /** Cells across x / down z. */
  width: number;
  height: number;
  /** World units per cell — the raster resolution. */
  cellSize: number;
  /** World position of cell (col 0, row 0)'s minimum corner — the grid's lower-left in x/z. */
  originX: number;
  originZ: number;
  /**
   * Base64 of a BIT-PACKED `width·height` bitmap (8 cells per byte, row-major, LSB first): bit set =
   * blocked. Packing keeps the committed file small even at a fine cell size (a 580² grid is ~56 kB, not
   * ~450 kB) so authored detail stays cheap to store and bundle.
   */
  blocked: string;
}

// base64 ↔ a bit-packed cell array, via the platform `btoa`/`atob` (present in browsers and modern Node,
// so dev + tests agree). In memory cells stay one byte each (fast to read/paint); only the wire form packs.
function encodeCells(cells: Uint8Array): string {
  const bytes = new Uint8Array(Math.ceil(cells.length / 8));
  for (let i = 0; i < cells.length; i++) if (cells[i]) bytes[i >> 3]! |= 1 << (i & 7);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}
function decodeCells(b64: string, length: number): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(length);
  for (let i = 0; i < length; i++) out[i] = (bin.charCodeAt(i >> 3) >> (i & 7)) & 1;
  return out;
}

/**
 * A loaded collision grid: a blocked/clear raster over world x/z, with the world↔cell mapping and the
 * `isBlocked` query the movement systems sample. Mutable (the editor paints into it); `toMap()` serializes
 * the current state back out.
 */
export class CollisionGrid {
  readonly width: number;
  readonly height: number;
  readonly cellSize: number;
  readonly originX: number;
  readonly originZ: number;
  readonly cells: Uint8Array;

  constructor(opts: {
    width: number;
    height: number;
    cellSize: number;
    originX: number;
    originZ: number;
    cells?: Uint8Array;
  }) {
    this.width = opts.width;
    this.height = opts.height;
    this.cellSize = opts.cellSize;
    this.originX = opts.originX;
    this.originZ = opts.originZ;
    this.cells = opts.cells ?? new Uint8Array(opts.width * opts.height);
  }

  /** A blank grid sized to cover `[-radius, +radius]` on x and z at the given cell size (clear everywhere). */
  static blank(radius: number, cellSize: number): CollisionGrid {
    const side = Math.ceil((radius * 2) / cellSize);
    return new CollisionGrid({
      width: side,
      height: side,
      cellSize,
      originX: -radius,
      originZ: -radius,
    });
  }

  /** Rebuild a grid from its serialized map document. */
  static fromMap(map: CollisionMap): CollisionGrid {
    return new CollisionGrid({
      width: map.width,
      height: map.height,
      cellSize: map.cellSize,
      originX: map.originX,
      originZ: map.originZ,
      cells: decodeCells(map.blocked, map.width * map.height),
    });
  }

  /** Serialize to the committed map form. */
  toMap(): CollisionMap {
    return {
      version: 1,
      width: this.width,
      height: this.height,
      cellSize: this.cellSize,
      originX: this.originX,
      originZ: this.originZ,
      blocked: encodeCells(this.cells),
    };
  }

  colOf(x: number): number {
    return Math.floor((x - this.originX) / this.cellSize);
  }
  rowOf(z: number): number {
    return Math.floor((z - this.originZ) / this.cellSize);
  }
  /** True only for a column/row inside the grid. */
  inRange(col: number, row: number): boolean {
    return col >= 0 && col < this.width && row >= 0 && row < this.height;
  }

  /** Is the world point (x,z) in a blocked cell? Outside the grid reads as CLEAR — see the module note. */
  isBlocked(x: number, z: number): boolean {
    const col = this.colOf(x);
    const row = this.rowOf(z);
    if (!this.inRange(col, row)) return false;
    return this.cells[row * this.width + col] === 1;
  }

  /** Paint one cell (no-op out of range). */
  setBlocked(col: number, row: number, blocked: boolean): void {
    if (!this.inRange(col, row)) return;
    this.cells[row * this.width + col] = blocked ? 1 : 0;
  }
}

// A mover wholly inside a blocked region has no surface to push off, so it's ejected to the nearest cell
// face. A tiny epsilon keeps the normal well-defined when it sits exactly on a cell boundary.
const EPS = 1e-4;
// Movers without an explicit Collider (camp guards) get a small footprint so they stop at the rock face
// rather than half-clipping into it.
const DEFAULT_MOVER_RADIUS = 0.9;
// One resolve pass usually clears contact; a corner touching two blocked cells can need a second nudge.
const RESOLVE_PASSES = 2;

/**
 * Push each mover out of any blocked cell it overlaps — the grid analogue of `collision-response.ts`, and
 * deliberately the SAME feel: circle-vs-cell de-penetration that corrects POSITION only (never speed), so
 * the into-the-wall component is undone while the tangential part survives — the rig slides along the
 * mountain face instead of dead-stopping, exactly like every other solid in the game.
 *
 * `movers` is supplied by the caller (the active rig + the camp guards) — the only things that move and
 * must be walled; loose scrap and structures keep their own circle colliders and are untouched here. Pure
 * over the World, so it unit-tests headless.
 */
export function gridBlockSystem(world: World, grid: CollisionGrid, movers: Iterable<EntityId>): void {
  for (const e of movers) {
    const t = world.get(e, Transform);
    if (!t) continue;
    const r = world.get(e, Collider)?.radius ?? DEFAULT_MOVER_RADIUS;
    for (let pass = 0; pass < RESOLVE_PASSES; pass++) {
      if (!resolveOnce(grid, t, r)) break; // settled — nothing overlapped this pass
    }
  }
}

/** One de-penetration sweep over the blocked cells the mover's circle could touch; returns true if it moved it. */
function resolveOnce(grid: CollisionGrid, t: { x: number; z: number }, r: number): boolean {
  const minCol = grid.colOf(t.x - r);
  const maxCol = grid.colOf(t.x + r);
  const minRow = grid.rowOf(t.z - r);
  const maxRow = grid.rowOf(t.z + r);
  let moved = false;

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      if (!grid.inRange(col, row) || grid.cells[row * grid.width + col] !== 1) continue;

      // The cell's world AABB, and the closest point on it to the mover centre.
      const cx0 = grid.originX + col * grid.cellSize;
      const cz0 = grid.originZ + row * grid.cellSize;
      const cx1 = cx0 + grid.cellSize;
      const cz1 = cz0 + grid.cellSize;
      const closestX = Math.min(Math.max(t.x, cx0), cx1);
      const closestZ = Math.min(Math.max(t.z, cz0), cz1);

      const dx = t.x - closestX;
      const dz = t.z - closestZ;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue; // circle clear of this cell

      if (d2 > EPS) {
        // Outside-but-overlapping: de-penetrate along the contact normal — slide falls out for free.
        const d = Math.sqrt(d2);
        const pen = r - d;
        t.x += (dx / d) * pen;
        t.z += (dz / d) * pen;
      } else {
        // Centre is inside the cell: eject through the nearest face by the radius plus the depth to it.
        const left = t.x - cx0;
        const right = cx1 - t.x;
        const down = t.z - cz0;
        const up = cz1 - t.z;
        const m = Math.min(left, right, down, up);
        if (m === left) t.x = cx0 - r;
        else if (m === right) t.x = cx1 + r;
        else if (m === down) t.z = cz0 - r;
        else t.z = cz1 + r;
      }
      moved = true;
    }
  }
  return moved;
}
