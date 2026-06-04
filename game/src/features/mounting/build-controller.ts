import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import type { RenderView } from '@common/render/view';
import { Transform } from '@common/components/transform';
import { MountGrid } from '@common/components/mount-grid';
import { Part } from '@common/components/part';
import { Mount } from '@common/components/mount';
import { MountFacing } from '@common/components/mount-facing';
import { DriveControl } from '@features/drive/drive-control';
import { Carried } from '@features/mounting/carried';
import { deployChassis } from '@features/mounting/rig';
import { ownedCount, MAX_OWNED } from '@features/chassis/ownership';
import {
  nearestMountTarget,
  cellWorldPose,
  resolveLocalYaw,
  worldToRigLocal,
  isOverDeck,
  partAtCell,
  partFootprint,
  mountPart,
  unmountPart,
  canMountPartOn,
  withinEngineCapacity,
} from '@features/mounting/mounting';

/**
 * The build interaction: grab → preview → drop → connect, driving ECS state rather than a scene
 * graph directly. Left-drag a part to lift it; while held it follows the
 * cursor and the nearest free deck cell highlights; release over that cell to mount it, or over
 * open ground to drop it loose. Re-grabbing a mounted part unmounts it — so parts move freely
 * between cells (and, later, between rigs).
 *
 * It straddles the three layers like the composition root does: it reads pointer events (input),
 * asks the view to raycast/draw affordances (render), and mutates the World (sim). The actual
 * attach/detach + ride-along lives in systems/mounting; this controller only choreographs it.
 */

// A held part floats a fixed clearance ABOVE whichever deck it's currently over — not at a fixed
// world height — so the hover gap reads the same on the tall rig deck (0.66) and the low workshop
// deck (0.20), and the part visibly drops as it crosses from rig to workshop. 0.84 over the 0.66
// rig deck reproduces the original 1.5 world height (which cleared the 0.74 deck lips).
const CARRY_CLEARANCE = 0.84;
// The cursor is projected onto this fixed world plane to read drag x/z — a stable parallax
// reference that does NOT move with the deck below, so dragging across decks doesn't shift the
// snap point. (Matches the rig's hover height: rig deckY 0.66 + CARRY_CLEARANCE.)
const CARRY_PLANE_Y = 1.5;
const LIFT_DUR = 0.14;   // seconds for the grab rise
const DROP_DUR = 0.14;   // seconds for a drop to settle (loose on the ground, or back to its cell)
const SNAP_DIST = 0.7;   // rig-local metres: how close to a cell counts as "over" it
const CARRY_TURN = 12;   // how fast a held part eases toward its resting yaw
const DEPLOY_HOLD = 0.4; // seconds a dropped chassis kit sits as a crate after landing, before it
                         // assembles into a rig — the visible "it lands, then unpacks" beat

/** Where a part came from, captured at grab so an invalid drop can send it back rather than loose. */
interface PrevMount {
  target: EntityId;
  col: number;
  row: number;
  yaw: number;
}

interface Glide {
  part: EntityId;
  fromX: number; fromY: number; fromZ: number;
  toX: number; toY: number; toZ: number;
  t: number;
  // When set, the part is gliding BACK to a deck cell (an invalid drop returning to origin); it is
  // mounted there on arrival. Absent for a loose drop, which just settles on the ground.
  remount?: PrevMount;
  // When set, this is a chassis kit landing on open ground: on arrival it begins the deploy hold
  // (sits as a crate), then assembles into a rig. Mutually exclusive with `remount`.
  deploy?: boolean;
}

/** A chassis kit that has landed and is sitting as a crate before it assembles into a rig. */
interface Deploy {
  part: EntityId;
  t: number; // 0→1 over DEPLOY_HOLD
}

export interface BuildController {
  update(dt: number): void;
  dispose(): void;
}

/**
 * @param getRig the player's ACTIVE rig — always a mount target, read fresh each frame so the build
 *            interaction follows whichever chassis the player currently controls (the `1`/`2`
 *            selection). Other targets (workshops) are supplied by `stagingTargets`, so generalising
 *            mounting to more decks needed no new wiring here: attachment is just data.
 * @param stagingTargets the active workshop decks a carried part may be staged onto this frame
 *            (rig parked in range). Injected by `main.ts` (from `@features/workshop/staging`) so
 *            mounting does NOT import workshop — the dependency points downhill (ADR-003 inward rule).
 */
export function createBuildController(
  world: World,
  view: RenderView,
  canvas: HTMLCanvasElement,
  getRig: () => EntityId,
  stagingTargets: () => EntityId[],
): BuildController {
  let carried: EntityId | null = null;
  let grabFromY = 0;
  let dragX = 0;
  let dragZ = 0;
  let prevMount: PrevMount | null = null; // the cell the carried part was on before lifting, if any
  const glides: Glide[] = [];
  const deploys: Deploy[] = []; // chassis kits landed and counting down to assembling into a rig

  /**
   * The decks the carried `part` may snap onto this frame: the rig, plus any workshop whose
   * proximity zone is currently active (rig parked in range). A dormant workshop is excluded, so
   * its cells never highlight and a part dropped over it glides to the ground instead — the gate
   * that makes "park to transfer" mean something. workshopZoneSystem owns the `active` flag.
   *
   * Two policies gate the rig as a target (and ONLY the rig — a workshop is a type-agnostic,
   * uncapped staging surface that must accept any and all parts at once, e.g. an electric AND a
   * mechanical engine side by side while you swap which is on the rig):
   *   - the no-hybrid type-lock (`canMountPartOn`): a chassis commits to one energy type, so a
   *     cross-type engine can't snap onto it;
   *   - the engine-capacity cap (`withinEngineCapacity`): the deck accepts at most `engineMax`
   *     engines (2 on a 1×3, 6 on a 3×5).
   * Either failing drops the rig from the target list, leaving the carried part no free cell, so the
   * drop returns to origin / settles loose — the tactile "won't snap" refusal.
   *
   * A chassis KIT is the exception: it isn't a module you mount ONTO the rig (it BECOMES a rig), so
   * the rig is never its target — only active workshops are. Dropped clear of any deck, it assembles
   * into a rig (see `dropCarry`).
   */
  function mountTargets(part: EntityId): EntityId[] {
    const targets: EntityId[] = [];
    const rig = getRig();
    const isChassis = world.get(part, Part)?.kind === 'chassis';
    if (!isChassis && canMountPartOn(world, rig, part) && withinEngineCapacity(world, rig, part)) {
      targets.push(rig);
    }
    for (const w of stagingTargets()) targets.push(w); // staging accepts any part — no locks
    return targets;
  }

  function cancelGlide(part: EntityId): void {
    const i = glides.findIndex((g) => g.part === part);
    if (i >= 0) glides.splice(i, 1);
  }

  /** Abandon a part's in-progress deploy (re-grabbing a landing/holding crate cancels it). */
  function cancelDeploy(part: EntityId): void {
    const i = deploys.findIndex((d) => d.part === part);
    if (i >= 0) deploys.splice(i, 1);
  }

  function beginCarry(part: EntityId): void {
    cancelGlide(part);
    cancelDeploy(part);
    // Remember where it was mounted (before we free the cell) so an invalid drop returns it here.
    const m = world.get(part, Mount);
    prevMount = m ? { target: m.rig, col: m.col, row: m.row, yaw: m.yaw } : null;
    if (m) unmountPart(world, part); // lifting a mounted part frees its cell
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
    const from = prevMount; // capture before we clear carry state
    carried = null;
    prevMount = null;
    canvas.style.cursor = '';
    view.showCellHighlight(null);
    view.showCarryShadow(null);
    world.remove(part, Carried);

    const t = world.get(part, Transform)!;
    const cell = nearestMountTarget(world, mountTargets(part), dragX, dragZ, SNAP_DIST, partFootprint(world, part));
    if (cell) {
      // Connect: mount on the winning deck's cell at the facing the preview was showing — recompute
      // from the same inputs (and the SAME target) so the dropped facing matches what the player saw.
      const grid = world.get(cell.target, MountGrid)!;
      const local = worldToRigLocal(world.get(cell.target, Transform)!, dragX, dragZ);
      const yaw = resolveLocalYaw(world.get(part, MountFacing), grid, cell.col, cell.row, local.lx, local.lz);
      mountPart(world, part, cell.target, cell.col, cell.row, yaw);
      return;
    }

    // A chassis kit dropped clear of any deck is the "haul it out" payoff. While the player owns
    // fewer than the cap, the crate LANDS on the ground and stays a crate (this glide), then a short
    // beat later assembles into a new drivable rig (the deploy on glide arrival). At the cap, it's
    // refused like any rejected move and falls through to the return-to-origin handling below — so
    // it glides back to the workshop deck rather than deploying a third chassis.
    if (world.get(part, Part)?.kind === 'chassis' && ownedCount(world) < MAX_OWNED) {
      glides.push({
        part,
        fromX: t.x, fromY: t.y ?? CARRY_PLANE_Y, fromZ: t.z,
        toX: dragX, toY: 0, toZ: dragZ,
        t: 0,
        deploy: true,
      });
      return;
    }

    // Not over a free cell. If the part came off a deck, send it BACK to that cell (a rejected
    // move returns to origin, like an inventory slot) rather than dumping it loose in the world.
    const back = from && returnPose(from);
    if (from && back) {
      glides.push({
        part,
        fromX: t.x, fromY: t.y ?? CARRY_PLANE_Y, fromZ: t.z,
        toX: back.x, toY: back.y, toZ: back.z,
        t: 0,
        remount: from,
      });
      return;
    }

    // It was loose to begin with (no origin cell): settle on the ground where it was released.
    glides.push({
      part,
      fromX: t.x, fromY: t.y ?? CARRY_PLANE_Y, fromZ: t.z,
      toX: dragX, toY: 0, toZ: dragZ,
      t: 0,
    });
  }

  /**
   * The world pose of the cell a part should glide back to, or null if it can't return there
   * (its deck is gone, or the cell is somehow occupied again). Computed from the deck's CURRENT
   * transform so it returns to the right spot even if the rig nudged while carrying.
   */
  function returnPose(from: PrevMount): { x: number; y: number; z: number } | null {
    if (!world.isAlive(from.target)) return null;
    const grid = world.get(from.target, MountGrid);
    const platformT = world.get(from.target, Transform);
    if (!grid || !platformT) return null;
    if (partAtCell(world, from.target, from.col, from.row)) return null; // cell taken — can't return
    const pose = cellWorldPose(platformT, grid, from.col, from.row);
    return { x: pose.x, y: pose.y, z: pose.z };
  }

  const onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0) return; // left-button only; middle is the camera orbit
    // Grab any part — but never a drivable rig. A chassis kit (a composed `Part{kind:'chassis'}`
    // staged on the workshop) IS grabbable, so the player can haul it out into the world; the rig is
    // the same kind but carries `DriveControl`, marking it the foundation you stand on, not a module
    // to lift off itself. So: grabbable unless it's a chassis that has already become a rig.
    const grabbable = world.query(Part).filter((p) => {
      if (world.get(p, Part)!.kind !== 'chassis') return true;
      return world.get(p, DriveControl) === undefined;
    });
    const hit = view.pickEntity(e.clientX, e.clientY, grabbable);
    if (hit === null) return;
    e.preventDefault();
    beginCarry(hit);
  };

  const onPointerMove = (e: PointerEvent): void => {
    if (carried === null) return;
    const p = view.raycastPlane(e.clientX, e.clientY, CARRY_PLANE_Y);
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
      // Advance drop glides (a held part never glides; it tracks the cursor directly). A glide is
      // either a loose settle to the ground or a return to a deck cell — the latter mounts the part
      // on arrival, handing it back to the mounting system to ride from there.
      for (let i = glides.length - 1; i >= 0; i--) {
        const g = glides[i]!;
        g.t = Math.min(1, g.t + dt / DROP_DUR);
        const e = easeOut(g.t);
        const t = world.get(g.part, Transform);
        if (!t) { glides.splice(i, 1); continue; }
        t.x = lerp(g.fromX, g.toX, e);
        t.y = lerp(g.fromY, g.toY, e);
        t.z = lerp(g.fromZ, g.toZ, e);
        if (g.t >= 1) {
          if (g.remount) {
            mountPart(world, g.part, g.remount.target, g.remount.col, g.remount.row, g.remount.yaw);
          } else if (g.deploy) {
            deploys.push({ part: g.part, t: 0 }); // crate has landed — begin the deploy hold
          }
          glides.splice(i, 1);
        }
      }

      // Advance landed chassis kits: each sits as a crate for DEPLOY_HOLD, then assembles into a
      // drivable, owned rig where it landed (deployChassis swaps the crate model for the chassis and
      // registers ownership). The land glide + this hold are the visible "it lands, then unpacks"
      // beat; PR3b replaces the hold with the authored unfold without changing this seam.
      for (let i = deploys.length - 1; i >= 0; i--) {
        const d = deploys[i]!;
        d.t = Math.min(1, d.t + dt / DEPLOY_HOLD);
        if (d.t >= 1) {
          const t = world.get(d.part, Transform);
          if (t) deployChassis(world, d.part, t.x, t.z);
          deploys.splice(i, 1);
        }
      }

      if (carried === null) return;

      const rig = getRig(); // the active rig — the fallback deck for the carry preview below

      const c = world.get(carried, Carried)!;
      c.liftT = Math.min(1, c.liftT + dt / LIFT_DUR);
      const t = world.get(carried, Transform)!;
      t.x = dragX;
      t.z = dragZ;

      // Preview the snap: find the nearest free cell across every live deck (rig + active
      // workshops), highlight it, and ease the part toward the exact yaw its MountFacing rule will
      // give it there — so the held part visibly turns to show how it will sit before you let go.
      // No cell in reach → align to the rig and hide the marker (and the shadow falls to the floor).
      const fp = partFootprint(world, carried);
      const cell = nearestMountTarget(world, mountTargets(carried), dragX, dragZ, SNAP_DIST, fp);
      const targetT = world.get(cell?.target ?? rig, Transform)!;
      const grid = world.get(cell?.target ?? rig, MountGrid)!;
      const local = worldToRigLocal(targetT, dragX, dragZ);
      // The highlight (and, below, the held part) sit at the footprint CENTRE, so a 2×2 kit previews
      // over its whole region rather than anchored to a corner.
      const pose = cell
        ? cellWorldPose(targetT, grid, cell.col + (fp.cols - 1) / 2, cell.row + (fp.rows - 1) / 2)
        : null;
      view.showCellHighlight(pose);

      // Float a fixed clearance above the deck below (the chosen target's, or the rig's when none),
      // so the hover gap is constant across decks and the part drops as it crosses to the lower
      // workshop deck — rather than hanging at one world height regardless of what's beneath it.
      t.y = lerp(grabFromY, grid.deckY + CARRY_CLEARANCE, easeOut(c.liftT));

      // Shadow rides onto a deck when the part hovers over it, else sits on the floor. `grid`/`local`
      // are the chosen target's when a cell is in reach, the rig's otherwise — so it reads correctly
      // over the rig even when its deck is full and no cell highlights.
      const shadowY = isOverDeck(grid, local.lx, local.lz) ? grid.deckY : 0;
      view.showCarryShadow({ x: dragX, z: dragZ, y: shadowY });

      const facing = world.get(carried, MountFacing);
      const localYaw = cell ? resolveLocalYaw(facing, grid, cell.col, cell.row, local.lx, local.lz) : 0;
      const desiredYaw = targetT.rotationY + localYaw;
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
