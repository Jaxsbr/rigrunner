import { defineComponent } from '@core/component';

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
 *             a different size without re-authoring the GLB. `tint` washes the model's materials
 *             toward a colour (the part's tier finish — docs/part-identity-spec.md §3), so the same
 *             grey-box GLB reads as a different material grade by looking; omitted = the GLB's own
 *             colours. `headTint` is the same for an articulated asset's socket-attached head (the
 *             Reclaimer's bucket), so a composed tool can wear a different grade on its head than its
 *             base — each sub-part its own tier; ignored by non-articulated assets.
 */
export type Renderable =
  | { shape: 'box'; size: { x: number; y: number; z: number }; color: number }
  | { shape: 'model'; assetId: string; scale?: number; tint?: number; headTint?: number };

export const Renderable = defineComponent<Renderable>('Renderable');
