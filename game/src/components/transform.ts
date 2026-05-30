import { defineComponent } from '../core/component';

/** Where a thing is and which way it faces. Forward is -z (matches the renderer). */
export interface Transform {
  x: number;
  z: number;
  rotationY: number;
}

export const Transform = defineComponent<Transform>('Transform');
