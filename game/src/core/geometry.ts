/**
 * Shared geometry value types — pure shapes with no behaviour, the vocabulary both the systems
 * and render layers speak. Like `EntityId`, these belong in core because both layers consume them
 * and neither owns them: systems produces a pose, render draws it, and the single definition here
 * keeps the two in step by construction (no duplicated interface to drift).
 */

/** A pose in the world: planar position (x, z) + height (y) + facing (rotationY about the up axis). */
export interface CellPose {
  x: number;
  z: number;
  y: number;
  rotationY: number;
}
