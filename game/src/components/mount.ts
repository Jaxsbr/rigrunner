import { defineComponent } from '../core/component';
import type { EntityId } from '../core/types';

/**
 * Present on a part that is currently mounted on a rig's deck. It records *which* rig and
 * *which cell* — the attachment is data, not a scene-graph parent, so a part can be moved
 * between cells or between rigs by simply rewriting (or removing) this component.
 *
 * The mounting system reads this every frame to place the part at its cell on the rig (so it
 * rides along as the rig drives). A loose part in the world has no Mount.
 *
 * `yaw` is the part's facing as a *local* offset from the rig's heading (radians). The mounting
 * system applies `rig.rotationY + yaw`, so the part turns with the rig but keeps the facing the
 * MountFacing rule chose when it was placed. 0 = deck-aligned.
 */
export interface Mount {
  rig: EntityId;
  col: number;
  row: number;
  yaw: number;
}

export const Mount = defineComponent<Mount>('Mount');
