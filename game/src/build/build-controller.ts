import type { World } from '../core/world';
import type { EntityId } from '../core/types';
import type { RenderView } from '../render/view';
import { Transform } from '../components/transform';
import { MountGrid } from '../components/mount-grid';
import { Part } from '../components/part';
import { Mount } from '../components/mount';
import { MountFacing } from '../components/mount-facing';
import { Carried } from '../components/carried';
import {
  nearestFreeCell,
  cellWorldPose,
  resolveLocalYaw,
  worldToRigLocal,
  isOverDeck,
  mountPart,
  unmountPart,
} from '../systems/mounting';

/**
 * The build interaction: grab → preview → drop → connect, ported from the prototype but driving
 * ECS state instead of a scene graph. Left-drag a part to lift it; while held it follows the
 * cursor and the nearest free deck cell highlights; release over that cell to mount it, or over
 * open ground to drop it loose. Re-grabbing a mounted part unmounts it — so parts move freely
 * between cells (and, later, between rigs).
 *
 * It straddles the three layers like the composition root does: it reads pointer events (input),
 * asks the view to raycast/draw affordances (render), and mutates the World (sim). The actual
 * attach/detach + ride-along lives in systems/mounting; this controller only choreographs it.
 */

const CARRY_Y = 1.5;     // height a held part floats at (clears the deck lips at 0.74)
const LIFT_DUR = 0.14;   // seconds for the grab rise
const DROP_DUR = 0.14;   // seconds for a loose drop to settle on the ground
const SNAP_DIST = 0.7;   // rig-local metres: how close to a cell counts as "over" it
const CARRY_TURN = 12;   // how fast a held part eases toward its resting yaw

interface Glide {
  part: EntityId;
  fromX: number; fromY: number; fromZ: number;
  toX: number; toY: number; toZ: number;
  t: number;
}

export interface BuildController {
  update(dt: number): void;
  dispose(): void;
}

/**
 * @param rig the rig whose deck parts snap onto. A single rig today; generalising to "the rig
 *            nearest the drop point" later is a change here only, since attachment is just data.
 */
export function createBuildController(
  world: World,
  view: RenderView,
  canvas: HTMLCanvasElement,
  rig: EntityId,
): BuildController {
  let carried: EntityId | null = null;
  let grabFromY = 0;
  let dragX = 0;
  let dragZ = 0;
  const glides: Glide[] = [];

  function cancelGlide(part: EntityId): void {
    const i = glides.findIndex((g) => g.part === part);
    if (i >= 0) glides.splice(i, 1);
  }

  function beginCarry(part: EntityId): void {
    cancelGlide(part);
    if (world.has(part, Mount)) unmountPart(world, part); // lifting a mounted part frees its cell
    const t = world.get(part, Transform)!;
    grabFromY = t.y ?? 0;
    dragX = t.x;
    dragZ = t.z;
    world.add(part, Carried, { liftT: 0 });
    carried = part;
    canvas.style.cursor = 'grabbing';
  }

  function dropCarry(): void {
    if (carried === null) return;
    const part = carried;
    carried = null;
    canvas.style.cursor = '';
    view.showCellHighlight(null);
    view.showCarryShadow(null);
    world.remove(part, Carried);

    const cell = nearestFreeCell(world, rig, dragX, dragZ, SNAP_DIST);
    if (cell) {
      // Connect: mount on the cell at the facing the preview was showing — recompute from the
      // same inputs so the dropped facing matches exactly what the player saw.
      const grid = world.get(rig, MountGrid)!;
      const local = worldToRigLocal(world.get(rig, Transform)!, dragX, dragZ);
      const yaw = resolveLocalYaw(world.get(part, MountFacing), grid, cell.col, cell.row, local.lx, local.lz);
      mountPart(world, part, rig, cell.col, cell.row, yaw);
    } else {
      // No free cell under the cursor: settle loose on the ground where it was released.
      const t = world.get(part, Transform)!;
      glides.push({
        part,
        fromX: t.x, fromY: t.y ?? CARRY_Y, fromZ: t.z,
        toX: dragX, toY: 0, toZ: dragZ,
        t: 0,
      });
    }
  }

  const onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0) return; // left-button only; middle is the camera orbit
    const hit = view.pickEntity(e.clientX, e.clientY, world.query(Part));
    if (hit === null) return;
    e.preventDefault();
    beginCarry(hit);
  };

  const onPointerMove = (e: PointerEvent): void => {
    if (carried === null) return;
    const p = view.raycastPlane(e.clientX, e.clientY, CARRY_Y);
    if (p) {
      dragX = p.x;
      dragZ = p.z;
    }
  };

  const onPointerUp = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    dropCarry();
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);

  return {
    update(dt: number): void {
      // Advance loose-drop glides (a held part never glides; it tracks the cursor directly).
      for (let i = glides.length - 1; i >= 0; i--) {
        const g = glides[i]!;
        g.t = Math.min(1, g.t + dt / DROP_DUR);
        const e = easeOut(g.t);
        const t = world.get(g.part, Transform);
        if (!t) { glides.splice(i, 1); continue; }
        t.x = lerp(g.fromX, g.toX, e);
        t.y = lerp(g.fromY, g.toY, e);
        t.z = lerp(g.fromZ, g.toZ, e);
        if (g.t >= 1) glides.splice(i, 1);
      }

      if (carried === null) return;

      const c = world.get(carried, Carried)!;
      c.liftT = Math.min(1, c.liftT + dt / LIFT_DUR);
      const t = world.get(carried, Transform)!;
      t.x = dragX;
      t.z = dragZ;
      t.y = lerp(grabFromY, CARRY_Y, easeOut(c.liftT));

      // Preview the snap: highlight the nearest free cell and ease the part toward the exact yaw
      // its MountFacing rule will give it on that cell — so the held part visibly turns to show how
      // it will sit before you let go. No cell in reach → just align to the rig and hide the marker.
      const rigT = world.get(rig, Transform)!;
      const grid = world.get(rig, MountGrid)!;
      const local = worldToRigLocal(rigT, dragX, dragZ);
      const cell = nearestFreeCell(world, rig, dragX, dragZ, SNAP_DIST);
      const pose = cell ? cellWorldPose(rigT, grid, cell.col, cell.row) : null;
      view.showCellHighlight(pose);

      // Shadow rides onto the deck when the part hovers over the platform, else sits on the floor.
      const shadowY = isOverDeck(grid, local.lx, local.lz) ? grid.deckY : 0;
      view.showCarryShadow({ x: dragX, z: dragZ, y: shadowY });

      const facing = world.get(carried, MountFacing);
      const localYaw = cell ? resolveLocalYaw(facing, grid, cell.col, cell.row, local.lx, local.lz) : 0;
      const desiredYaw = rigT.rotationY + localYaw;
      const d = Math.atan2(Math.sin(desiredYaw - t.rotationY), Math.cos(desiredYaw - t.rotationY));
      t.rotationY += d * Math.min(1, dt * CARRY_TURN);
    },

    dispose(): void {
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    },
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}
