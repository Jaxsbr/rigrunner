import { defineComponent } from '@core/component';

/**
 * Marks a ground mover that presses a tread trail into the terrain as it travels — the rig and the
 * camp guards both carry it. It is pure shared vocabulary between "things that move on the ground"
 * (set by the rig assembly and the camp spawner) and the track-mark render layer (which queries it),
 * so the renderer never needs to know what a rig or an enemy is.
 *
 * `width` is the full cross-track span of the mark (roughly the wheel/track gauge): a broad rig leaves
 * a wide ribbon, a small guard a narrow one.
 *
 * This is the seam an earned restoration "life-trail" part will later extend — the same emitter, given
 * a richer descriptor (a style/tier, a consumed resource), is how driving will green the ground rather
 * than just scuff it. Today it carries only the cosmetic gauge; nothing reads it but the renderer.
 */
export interface TrackEmitter {
  width: number;
}

export const TrackEmitter = defineComponent<TrackEmitter>('TrackEmitter');
