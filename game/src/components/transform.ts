import { defineComponent } from '../core/component';

/**
 * Where a thing is and which way it faces. Forward is -z (matches the renderer).
 *
 * Driving is planar — the movement system only ever touches x/z/rotationY. `y` is an optional
 * vertical offset for things that genuinely sit at a height: a part resting on a rig's deck, or
 * lifted in the air while carried. When omitted the render layer falls back to the asset's
 * resting height (a model sits on the ground at y=0), so existing ground-level entities are
 * unaffected.
 */
export interface Transform {
  x: number;
  z: number;
  rotationY: number;
  y?: number;
}

export const Transform = defineComponent<Transform>('Transform');
