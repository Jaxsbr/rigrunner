import { defineComponent } from '@core/component';

/**
 * The rotation composition: add it to a part to decide HOW the part chooses which way to face
 * when previewed and placed on a rig cell. Two behaviours, named for how they feel to the player:
 *
 *  - SPECIFIC — the part must face a direction dictated by its placement; the player doesn't get
 *    a free choice, the rule does. The only rule today is 'outward': the part's front (local −Z —
 *    an engine's glowing intake, a gun's barrel) points away from the rig's centre, snapped to an
 *    orthogonal direction (forward/back or a side — never a diagonal; corners favour forward/back,
 *    the rig's long axis). Because cells lean different ways from centre, the same part faces
 *    differently per cell — so the player discovers distinct intake/firing angles.
 *
 *  - FLEXIBLE — the part has no facing requirement; the player aims it. While a part hovers a
 *    cell, it turns to face whichever edge of that cell the cursor leans toward (left / right /
 *    front / back), snapping to that cardinal direction. You point it, then drop it.
 *
 * A part with NO MountFacing simply rests deck-aligned (zero local yaw offset).
 *
 * Convention: a part's meaningful "front" is its local −Z — the one forward direction shared by
 * the game (movement.ts drives along −z), the asset export (Blender +Y → −Z), and the viewer's
 * green arrow. Both behaviours rotate that front: outward points it off the rig, flexible points
 * it at the leaned cell edge. Author a directional part with its decorated face on local −Z.
 */
export type MountFacing =
  | { kind: 'specific'; rule: 'outward' }
  | { kind: 'flexible' };

export const MountFacing = defineComponent<MountFacing>('MountFacing');
