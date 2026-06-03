import { defineComponent } from '../core/component';

/**
 * A description of how to draw an entity. Deliberately a plain data description (not a
 * Three.js object) so the simulation stays free of any rendering dependency — the render
 * layer turns this into an Object3D and owns that object, not the World.
 *
 * Two variants:
 * - `box`   — a primitive box (grey-box / placeholder era).
 * - `model` — a real 3D asset (GLB) referenced by a stable `assetId`. The render layer
 *             loads, caches, and clones it. By convention (see docs/asset-style.md) a model
 *             GLB has its origin at the *base-centre*, so it sits on the ground at y=0.
 *             `scale` uniformly resizes the model (default 1) — to reuse one authored asset at
 *             a different size without re-authoring the GLB.
 */
export type Renderable =
  | { shape: 'box'; size: { x: number; y: number; z: number }; color: number }
  | { shape: 'model'; assetId: string; scale?: number };

export const Renderable = defineComponent<Renderable>('Renderable');
