import type { World } from '../core/world';
import type { EntityId } from '../core/types';
import { Transform } from '../components/transform';
import { Part } from '../components/part';
import type { PartKind } from '../components/part';
import { Mount } from '../components/mount';
import { MountGrid } from '../components/mount-grid';
import type { MountFacing } from '../components/mount-facing';

/**
 * Mounting: the seam that lets parts compose onto rigs. A part's attachment is pure data (a
 * Mount component naming a rig + cell), never a scene-graph parent — so the same part moves
 * between cells and between rigs by rewriting that data. This module owns:
 *
 *   - the grid geometry (where a cell sits, which cell a world point falls in),
 *   - occupancy queries derived from the parts themselves (no duplicated source of truth),
 *   - the mount/unmount mutators,
 *   - and `mountingSystem`, which each frame rides every mounted part to its cell on its rig.
 *
 * Everything here is pure over the World, so it runs and tests headless.
 */

/**
 * A pose in the world: planar position + height + facing. The render layer declares an identical
 * shape (render/build-affordances.ts) and the two are bridged by structural typing — deliberately,
 * so the renderer can draw a cell pose without importing anything from systems/. Same name on both
 * sides on purpose: they are the SAME concept, not two; keep them in step if a field changes.
 */
export interface CellPose {
  x: number;
  z: number;
  y: number;
  rotationY: number;
}

/** Local (rig-space) offset of a cell centre from the rig origin: lx across, lz along. */
export function cellLocalOffset(
  grid: MountGrid,
  col: number,
  row: number,
): { lx: number; lz: number } {
  return {
    lx: (col - (grid.cols - 1) / 2) * grid.cellSize,
    lz: (row - (grid.rows - 1) / 2) * grid.cellSize,
  };
}

/** World pose of a cell, given the owning rig's transform — rotates the cell offset by yaw. */
export function cellWorldPose(
  rig: Transform,
  grid: MountGrid,
  col: number,
  row: number,
): CellPose {
  const { lx, lz } = cellLocalOffset(grid, col, row);
  const c = Math.cos(rig.rotationY);
  const s = Math.sin(rig.rotationY);
  // Local→world Y-rotation (matches movement.ts: local -Z maps to world (-sin, -cos)).
  return {
    x: rig.x + lx * c + lz * s,
    z: rig.z - lx * s + lz * c,
    y: grid.deckY,
    rotationY: rig.rotationY,
  };
}

/** A world point expressed in the rig's local frame: lx across the width, lz along the length. */
export function worldToRigLocal(rig: Transform, wx: number, wz: number): { lx: number; lz: number } {
  const dx = wx - rig.x;
  const dz = wz - rig.z;
  const c = Math.cos(rig.rotationY);
  const s = Math.sin(rig.rotationY);
  return { lx: dx * c - dz * s, lz: dx * s + dz * c };
}

/** Is a rig-local point over the deck footprint at all? (Used to land the carry shadow on it.) */
export function isOverDeck(grid: MountGrid, lx: number, lz: number): boolean {
  return (
    Math.abs(lx) <= (grid.cols * grid.cellSize) / 2 &&
    Math.abs(lz) <= (grid.rows * grid.cellSize) / 2
  );
}

/** The part currently mounted in a rig's (col, row), or undefined if the cell is free. */
export function partAtCell(
  world: World,
  rig: EntityId,
  col: number,
  row: number,
): EntityId | undefined {
  for (const p of world.query(Part, Mount)) {
    const m = world.get(p, Mount)!;
    if (m.rig === rig && m.col === col && m.row === row) return p;
  }
  return undefined;
}

/** Does this rig have at least one mounted part of the given kind? (Drives the engine gate.) */
export function hasMountedPartKind(world: World, rig: EntityId, kind: PartKind): boolean {
  for (const p of world.query(Part, Mount)) {
    if (world.get(p, Mount)!.rig === rig && world.get(p, Part)!.kind === kind) return true;
  }
  return false;
}

/**
 * The nearest FREE cell on `platform` to a world point, within `maxDist` (local metres), with its
 * distance — or null if nothing is in reach. `platform` is any entity carrying a MountGrid (a rig
 * OR a workshop): mounting is grid-agnostic, so the same snap serves every deck. Mirrors the
 * prototype's forgiving snap: pick the closest empty cell the cursor hovers near, not pixel-precise.
 *
 * Private: the only caller is `nearestMountTarget`, which folds it across several decks. Callers
 * always go through that, even for a single deck (pass a one-element target list), so there is one
 * snap entry point rather than two near-identical ones.
 */
function nearestFreeCellOn(
  world: World,
  platform: EntityId,
  wx: number,
  wz: number,
  maxDist: number,
): { col: number; row: number; dist: number } | null {
  const grid = world.get(platform, MountGrid);
  const platformT = world.get(platform, Transform);
  if (!grid || !platformT) return null;

  const { lx, lz } = worldToRigLocal(platformT, wx, wz);
  let best: { col: number; row: number; dist: number } | null = null;
  let bestD = maxDist;
  for (let col = 0; col < grid.cols; col++) {
    for (let row = 0; row < grid.rows; row++) {
      if (partAtCell(world, platform, col, row)) continue;
      const off = cellLocalOffset(grid, col, row);
      const d = Math.hypot(off.lx - lx, off.lz - lz);
      if (d < bestD) {
        bestD = d;
        best = { col, row, dist: d };
      }
    }
  }
  return best;
}

/**
 * The nearest FREE cell to a world point ACROSS several mount targets, returning which platform
 * won alongside the cell — or null if none is in reach. This is the seam that lets a carried part
 * snap onto either the rig or an active workshop: the build controller passes every valid target
 * and the globally closest empty cell wins, so the player just drops near whichever deck they mean.
 * For a single deck, pass a one-element target list — there is no separate single-deck snap.
 */
export function nearestMountTarget(
  world: World,
  targets: EntityId[],
  wx: number,
  wz: number,
  maxDist: number,
): { target: EntityId; col: number; row: number } | null {
  let best: { target: EntityId; col: number; row: number; dist: number } | null = null;
  for (const target of targets) {
    const hit = nearestFreeCellOn(world, target, wx, wz, maxDist);
    if (hit && (!best || hit.dist < best.dist)) {
      best = { target, col: hit.col, row: hit.row, dist: hit.dist };
    }
  }
  return best ? { target: best.target, col: best.col, row: best.row } : null;
}

// ── Facing: the local yaw a part rests at on a cell, per its MountFacing composition ──────────
//
// All three return a yaw in the rig's LOCAL frame (offset from the rig heading). A part's FRONT
// is local −Z — the single "forward" convention shared with the game (movement.ts drives along
// −z), the asset export (Blender +Y → −Z), and the viewer's green arrow. At local yaw θ the front
// points in direction (−sin θ, −cos θ); so to aim the front at a target direction (dx, dz) we set
// θ = atan2(−dx, −dz).

/**
 * 'outward' rule: aim the part's front (−Z) away from the rig centre, but snapped to an ORTHOGONAL
 * direction — never a diagonal. We take the dominant axis of the cell's radial offset, so a cell
 * resolves to forward/back or to a side, whichever it leans toward more. On a corner the offset
 * is larger along the rig's long axis (rows span further than cols), so corners point
 * forward/back; an exact tie also favours forward/back (the long axis) over the sides.
 */
export function outwardLocalYaw(grid: MountGrid, col: number, row: number): number {
  const { lx, lz } = cellLocalOffset(grid, col, row);
  if (lx === 0 && lz === 0) return 0; // dead centre has no outward direction
  // Strictly-greater across → sideways; otherwise (incl. tie) along the length (forward/back).
  const [fx, fz] = Math.abs(lx) > Math.abs(lz) ? [Math.sign(lx), 0] : [0, Math.sign(lz)];
  return Math.atan2(-fx, -fz); // aim the front (−Z) along the snapped outward direction
}

/** 'flexible' rule: aim the part's front (−Z) at the cell edge the cursor leans toward (4 cardinals). */
export function leanLocalYaw(
  grid: MountGrid,
  col: number,
  row: number,
  cursorLx: number,
  cursorLz: number,
): number {
  const c = cellLocalOffset(grid, col, row);
  const dx = cursorLx - c.lx;
  const dz = cursorLz - c.lz;
  if (dx === 0 && dz === 0) return 0;
  // Snap to whichever axis the cursor leans along more → one of four cardinal facings.
  const [fx, fz] = Math.abs(dx) >= Math.abs(dz) ? [Math.sign(dx), 0] : [0, Math.sign(dz)];
  return Math.atan2(-fx, -fz); // aim the front (−Z) at the leaned edge
}

/**
 * The local yaw a part should rest at on (col, row), given its facing composition and where the
 * cursor sits (rig-local) — the single answer used for both the carried preview and the drop, so
 * what you see while hovering is exactly what you get when you release. No composition → 0.
 */
export function resolveLocalYaw(
  facing: MountFacing | undefined,
  grid: MountGrid,
  col: number,
  row: number,
  cursorLx: number,
  cursorLz: number,
): number {
  if (!facing) return 0;
  if (facing.kind === 'specific') return facing.rule === 'outward' ? outwardLocalYaw(grid, col, row) : 0;
  return leanLocalYaw(grid, col, row, cursorLx, cursorLz);
}

/** Attach a part to a rig cell at a local facing yaw (overwrites any existing Mount — i.e. moves it). */
export function mountPart(
  world: World,
  part: EntityId,
  rig: EntityId,
  col: number,
  row: number,
  yaw = 0,
): void {
  world.add(part, Mount, { rig, col, row, yaw });
}

/** Detach a part from whatever rig it was on, leaving it loose in the world. */
export function unmountPart(world: World, part: EntityId): void {
  world.remove(part, Mount);
}

/**
 * Ride every mounted part to its cell on its rig: rebuild the part's Transform from the rig's
 * transform + the cell pose. Run after movement (so rigs have moved this frame) and the part
 * follows for free — the data attachment doing the job a scene-graph parent would.
 */
export function mountingSystem(world: World): void {
  for (const part of world.query(Part, Mount, Transform)) {
    const m = world.get(part, Mount)!;
    if (!world.isAlive(m.rig)) {
      // Owning rig is gone — orphan the part rather than tracking a dead transform.
      world.remove(part, Mount);
      continue;
    }
    const rigT = world.get(m.rig, Transform);
    const grid = world.get(m.rig, MountGrid);
    if (!rigT || !grid) continue;

    const pose = cellWorldPose(rigT, grid, m.col, m.row);
    const t = world.get(part, Transform)!;
    t.x = pose.x;
    t.z = pose.z;
    t.y = pose.y;
    t.rotationY = pose.rotationY + m.yaw; // ride the rig's heading, keep the placed facing
  }
}
