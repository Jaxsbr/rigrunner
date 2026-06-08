import type * as THREE from 'three';
import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { GroundStainField, type StainPalette, type BlotchLayer, type StainCluster } from '@common/render/ground-stains';
import { ScrapPile } from './scrap-pile';

/**
 * The scrap pile's pollution: a layered oil + rust contamination laid flat under the heap and bleeding
 * out past it, so a junk pile reads as a blight on the land — the same contamination language the looter
 * camps carry, scaled to the pile. Pure view polish (it owns only the decals + their eased opacity,
 * reading the sim purely to know which piles still exist). It carries the core loop's cause→effect:
 *   - a pile stands → its pools hold, marking the heap as polluted ground
 *   - the pile is fully rummaged (its entity destroyed) → the pools fade out = the land slowly heals,
 *     the stump left behind standing in cleaner earth
 *
 * The fade-out is driven by *noticing the pile is gone* (the loose-scrap-stains pattern), not by any sim
 * signal: while a pile entity is alive its cluster holds at full (it stays full through the reclaim
 * dissolve, which sinks the heap); once the entity is destroyed the cluster eases to zero and is disposed.
 * That keeps the rummage/clear seams untouched — this layer is a one-way projection of the world.
 *
 * The decal mechanics are the shared `@common/render` `GroundStainField`; this layer owns only the pile's
 * CONFIG (an oil + rust mix, NO scorch — nothing here is burned) and its lifecycle. Unlike the camp's
 * ~14 m war-camp blight, the pile bleeds to a tighter ~9–10 m — a junk heap is messy, not scorched.
 */

const FADE_OUT_EASE = 0.22; // slow heal once the heap is gone (~10 s), never a pop

type PileKind = 'oil' | 'rust';

/** Per-kind canvas tones (NOT the GLB palette): oil is a near-black wet slick, rust a saturated
 *  discoloured patch that pops off the dusty ground. (Same tones the camp mess uses — contamination
 *  reads the same wherever it sits; each feature owns its own mix/reach.) */
const PILE_PALETTE: StainPalette<PileKind> = {
  oil: { core: '8,10,12', mid: '14,16,18', pool: '4,5,6', sheen: true },
  rust: { core: '120,62,28', mid: '92,50,26', pool: '66,34,16', sheen: false },
};

/**
 * Oil pools tight under the heap; rust discolouration spreads out past it; a faint outer bleed reaches
 * ~9–10 m and tapers into the ground. Fewer, smaller layers than the camp — a pile is a smaller blight.
 */
const PILE_MIX: BlotchLayer<PileKind>[] = [
  // Dark oily core right under the heap (its footprint is ~4–5 m).
  { kind: 'oil', count: 2, spread: 2.4, minR: 1.4, maxR: 2.4, minOp: 0.78, maxOp: 0.92 },
  // Rust discolouration spreading out past the heap.
  { kind: 'rust', count: 3, spread: 4.6, minR: 1.6, maxR: 2.8, minOp: 0.46, maxOp: 0.7 },
  // Faint outer bleed — large soft patches reaching ~9–10 m and tapering into the ground.
  { kind: 'oil', count: 2, spread: 6.4, minR: 2.2, maxR: 3.2, minOp: 0.22, maxOp: 0.4 },
  { kind: 'rust', count: 2, spread: 7.2, minR: 2.4, maxR: 3.4, minOp: 0.18, maxOp: 0.34 },
];

export class ScrapPileStains {
  private readonly field: GroundStainField<PileKind>;
  private readonly stains = new Map<EntityId, StainCluster>();

  constructor(scene: THREE.Scene) {
    this.field = new GroundStainField(scene, PILE_PALETTE);
  }

  /** Reconcile a contamination cluster per pile: snap it in while the pile stands, ease it out once the
   *  pile entity is gone, dispose it when invisible. */
  sync(world: World, dt: number): void {
    // 1. Every live pile holds a full cluster — a standing blight.
    for (const p of world.query(ScrapPile, Transform)) {
      const stain = this.stains.get(p) ?? this.spawn(p, world);
      this.field.ease(stain, 1, 1); // snap to full
    }
    // 2. Any cluster whose pile is gone fades out (the land healing), then is disposed once invisible.
    for (const [id, stain] of this.stains) {
      if (world.isAlive(id) && world.has(id, ScrapPile)) continue; // still owned — handled above
      this.field.ease(stain, 0, dt * FADE_OUT_EASE);
      if (stain.progress <= 0.001) {
        this.field.dispose(stain);
        this.stains.delete(id);
      }
    }
  }

  private spawn(p: EntityId, world: World): StainCluster {
    const t = world.get(p, Transform)!;
    const stain = this.field.build({ x: t.x, z: t.z }, PILE_MIX);
    this.stains.set(p, stain);
    return stain;
  }
}
