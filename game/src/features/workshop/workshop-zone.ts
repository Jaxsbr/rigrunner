import { defineComponent } from '@core/component';

/**
 * Marks an entity (a workshop) as a PROXIMITY-GATED mount target: its MountGrid only becomes a
 * live place to drop parts while the player's rig is parked within reach. Carrying a part is done
 * by the cursor and ignores where the rig is, so this gate lives in the mount logic, not the carry
 * logic (see build-controller + systems/workshop-zone).
 *
 * `radius` is the interaction zone in metres, measured from the workshop centre. The test is
 * circle-vs-circle against the rig's own collider (so the rig "intersecting" the zone is enough —
 * you park beside the platform, you don't have to bullseye its centre).
 *
 * `active` is recomputed each frame by workshopZoneSystem from the rig's position; it's cached
 * here so both the build controller (is this grid a valid drop target?) and the render overlay
 * (dim grey vs. lit green) read one answer. View owns no truth — this flag is the truth.
 */
export interface WorkshopZone {
  radius: number;
  active: boolean;
}

export const WorkshopZone = defineComponent<WorkshopZone>('WorkshopZone');
