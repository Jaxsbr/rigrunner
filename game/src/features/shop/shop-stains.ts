import type * as THREE from 'three';
import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { GroundStainField, type StainPalette, type BlotchLayer, type StainCluster } from '@common/render/ground-stains';
import { WorldShop } from './world-shop';

/**
 * The shop's worked-ground staining: a small oil spill under the trade post, where parts get wrenched on
 * and grease drips. Deliberately MODEST — a shop reads as tended and alive, not a blight, so this is a
 * fraction of the scrap pile's pollution: a tight, low-opacity smudge that says "someone works here",
 * not a war-camp's scorched reach. Pure view polish on the shared `@common/render` `GroundStainField`;
 * it owns only the decals + their eased opacity, reading the sim purely to know which shops exist.
 *
 * A shop persists (it's seeded into the static world, never destroyed), so unlike the scrap pile this
 * holds its cluster at full for as long as the shop is alive; the fade-out branch only fires for the
 * unusual case of a shop entity going away, keeping the lifecycle symmetric with the other stain layers.
 */

const FADE_OUT_EASE = 0.22;

type ShopKind = 'oil' | 'rust';

/** Per-kind canvas tones (NOT the GLB palette): oil is a near-black wet slick; rust a faint discoloured
 *  patch. Same contamination language as the pile/camp, but laid down sparingly — this is a work spill. */
const SHOP_PALETTE: StainPalette<ShopKind> = {
  oil: { core: '8,10,12', mid: '14,16,18', pool: '4,5,6', sheen: true },
  rust: { core: '120,62,28', mid: '92,50,26', pool: '66,34,16', sheen: false },
};

/**
 * A tight oil smudge right under the work area with a faint rust bleed just past it — small reach, low
 * opacity. The whole mess sits inside the shop's footprint and barely creeps out: ordered, lived-in, not
 * a spreading blight.
 */
const SHOP_MIX: BlotchLayer<ShopKind>[] = [
  // The work spill — a tight, dark slick under the counter/pallet area.
  { kind: 'oil', count: 2, spread: 1.4, minR: 0.7, maxR: 1.2, minOp: 0.34, maxOp: 0.5 },
  // A faint rust discolouration bleeding just past it, tapering into the ground.
  { kind: 'rust', count: 2, spread: 2.4, minR: 0.9, maxR: 1.5, minOp: 0.16, maxOp: 0.28 },
];

export class ShopStains {
  private readonly field: GroundStainField<ShopKind>;
  private readonly stains = new Map<EntityId, StainCluster>();

  constructor(scene: THREE.Scene) {
    this.field = new GroundStainField(scene, SHOP_PALETTE);
  }

  /** Hold a full smudge under every live shop; ease out and dispose any whose shop entity is gone. */
  sync(world: World, dt: number): void {
    for (const s of world.query(WorldShop, Transform)) {
      const stain = this.stains.get(s) ?? this.spawn(s, world);
      this.field.ease(stain, 1, 1); // snap to full
    }
    for (const [id, stain] of this.stains) {
      if (world.isAlive(id) && world.has(id, WorldShop)) continue;
      this.field.ease(stain, 0, dt * FADE_OUT_EASE);
      if (stain.progress <= 0.001) {
        this.field.dispose(stain);
        this.stains.delete(id);
      }
    }
  }

  private spawn(s: EntityId, world: World): StainCluster {
    const t = world.get(s, Transform)!;
    const stain = this.field.build({ x: t.x, z: t.z }, SHOP_MIX);
    this.stains.set(s, stain);
    return stain;
  }
}
