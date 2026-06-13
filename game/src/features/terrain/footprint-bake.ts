import { CollisionGrid } from './collision-grid';

/**
 * Bake a mesh's standing-rock footprint into a collision grid — the "accurate seed from the art" the map
 * editor opens with. Given a mesh's world-space triangles, every cell the mesh covers ABOVE the floor is
 * marked blocked; the sunk feet and exit gaps (modelled below y=0 in `mountain_range.py`) fall under the
 * threshold and stay clear. The result traces the real, irregular silhouette — instantly better than the
 * circle ring it replaces — and the editor lets a human refine the edges by painting.
 *
 * Pure (grid in, grid mutated), so it runs the same whether the triangles come from the loaded three.js
 * mesh (the editor's Bake button) or a test fixture.
 */

/** A triangle's XZ projection vs a cell: sampled at sub-cell steps so no triangle ≥ a cell leaves a hole. */
const SUBSTEPS_PER_CELL = 2;

/** 2-D edge sign — >0 / <0 tells which side of edge (b→? from a,b) the point p lies on. */
function edgeSign(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  return (px - bx) * (az - bz) - (ax - bx) * (pz - bz);
}

/** Is (px,pz) inside the triangle (ax,az)(bx,bz)(cx,cz)? (Inclusive of edges.) */
function pointInTriangle(
  px: number, pz: number,
  ax: number, az: number, bx: number, bz: number, cx: number, cz: number,
): boolean {
  const d1 = edgeSign(px, pz, ax, az, bx, bz);
  const d2 = edgeSign(px, pz, bx, bz, cx, cz);
  const d3 = edgeSign(px, pz, cx, cz, ax, az);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos); // all same sign (or on an edge) → inside
}

/**
 * Mark every grid cell covered by a mesh triangle whose top stands above `floorEps`. Positions are a flat
 * world-space `[x,y,z, x,y,z, …]` array; `indices` lists triangle corners (or null for an unindexed soup
 * where every 3 vertices form a triangle). Conservative: a triangle is rasterized by sampling its XZ
 * bounding box at sub-cell resolution, so collision never leaks through a sliver the centre-test missed.
 */
export function rasterizeFootprint(
  grid: CollisionGrid,
  positions: ArrayLike<number>,
  indices: ArrayLike<number> | null,
  floorEps: number,
): void {
  const triCount = indices ? indices.length / 3 : positions.length / 9;
  const step = grid.cellSize / SUBSTEPS_PER_CELL;

  for (let tri = 0; tri < triCount; tri++) {
    const i0 = indices ? indices[tri * 3]! : tri * 3;
    const i1 = indices ? indices[tri * 3 + 1]! : tri * 3 + 1;
    const i2 = indices ? indices[tri * 3 + 2]! : tri * 3 + 2;

    const ax = positions[i0 * 3]!, ay = positions[i0 * 3 + 1]!, az = positions[i0 * 3 + 2]!;
    const bx = positions[i1 * 3]!, by = positions[i1 * 3 + 1]!, bz = positions[i1 * 3 + 2]!;
    const cx = positions[i2 * 3]!, cy = positions[i2 * 3 + 1]!, cz = positions[i2 * 3 + 2]!;

    // Standing rock only: the triangle's highest corner must clear the floor. Sunk feet / gap floors
    // (below y=0) and ground-level triangles drop out, so the gaps stay drivable.
    if (Math.max(ay, by, cy) <= floorEps) continue;

    const minX = Math.min(ax, bx, cx), maxX = Math.max(ax, bx, cx);
    const minZ = Math.min(az, bz, cz), maxZ = Math.max(az, bz, cz);

    for (let sx = minX; sx <= maxX + step; sx += step) {
      for (let sz = minZ; sz <= maxZ + step; sz += step) {
        if (pointInTriangle(sx, sz, ax, az, bx, bz, cx, cz)) {
          grid.setBlocked(grid.colOf(sx), grid.rowOf(sz), true);
        }
      }
    }
  }
}
