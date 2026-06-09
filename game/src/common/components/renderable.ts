import { defineComponent } from '@core/component';
import type { TierId } from '@common/parts/tiers';

/**
 * A description of how to draw an entity. Deliberately a plain data description (not a
 * Three.js object) so the simulation stays free of any rendering dependency — the render
 * layer turns this into an Object3D and owns that object, not the World.
 *
 * Three variants:
 * - `box`      — a primitive box (grey-box / placeholder era).
 * - `model`    — a real 3D asset (GLB) referenced by a stable `assetId`. The render layer
 *                loads, caches, and clones it. By convention (see docs/asset-style.md) a model
 *                GLB has its origin at the *base-centre*, so it sits on the ground at y=0.
 *                `scale` uniformly resizes the model (default 1) — to reuse one authored asset at
 *                a different size without re-authoring the GLB. `tint` washes the model's materials
 *                toward a colour (the part's tier finish — docs/part-identity-spec.md §3), so the same
 *                grey-box GLB reads as a different material grade by looking; omitted = the GLB's own
 *                colours. `headTint` is the same for an articulated asset's socket-attached head (the
 *                Reclaimer's bucket), so a composed tool can wear a different grade on its head than its
 *                base — each sub-part its own tier; ignored by non-articulated assets. `headAssetId`
 *                names WHICH head GLB rides the wrist socket (the Reclaimer's swappable head — a bucket
 *                or a stump-healer); omitted ⇒ the default bucket. Ignored by non-articulated assets.
 * - `assembly` — a COMPOSED product (an engine, a container) drawn as its positioned sub-parts via the
 *                shared assembler (`@shared/assembler`, the same path the viewer composes by — §2b).
 *                `groupId` is the product-group/recipe id; `tiers` maps each sub-part id to its grade, so
 *                each piece wears its own tier finish and a mixed-tier build reads as a mix. `scale`
 *                uniformly resizes as for `model`.
 */
export type Renderable =
  | { shape: 'box'; size: { x: number; y: number; z: number }; color: number }
  | { shape: 'model'; assetId: string; scale?: number; tint?: number; headTint?: number; headAssetId?: string }
  | { shape: 'assembly'; groupId: string; tiers: Record<string, TierId>; scale?: number };

export const Renderable = defineComponent<Renderable>('Renderable');
