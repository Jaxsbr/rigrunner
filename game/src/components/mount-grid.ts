import { defineComponent } from '../core/component';

/**
 * A rig's mounting deck: the grid of cells parts can be slotted into. Pure geometry/tuning —
 * which cells are *occupied* is not stored here but derived by querying the parts whose Mount
 * points at this rig (see systems/mounting.ts), so there is one source of truth for occupancy
 * and no chance of the grid and the parts disagreeing.
 *
 * Cells are addressed by (col, row). Local layout, centred on the rig origin:
 *   - col 0..cols-1 runs across the rig's width (local X), col 0 = left.
 *   - row 0..rows-1 runs along the rig's length (local Z), row 0 = FRONT (toward -Z, the way
 *     the rig drives), row rows-1 = back.
 * The rig GLB authors a 2×3 deck (see tools/blender/assets/rig.py), so cols=2, rows=3.
 */
export interface MountGrid {
  cols: number;     // cells across the width (local X)
  rows: number;     // cells along the length (local Z); row 0 is the front
  cellSize: number; // metres per cell (1 cell == 1 grid unit)
  deckY: number;    // height of the deck surface a mounted part rests on
}

export const MountGrid = defineComponent<MountGrid>('MountGrid');
