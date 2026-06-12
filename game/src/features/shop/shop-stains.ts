import type * as THREE from 'three';
import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { GroundStainField, type StainPalette, type BlotchLayer, type StainCluster } from '@common/render/ground-stains';
import { WorldShop } from './world-shop';

/**
 * The shop's worked-ground grime: the oil, grease and rust ground into a busy trade post's YARD, where
 * deliveries get dragged, drums leak, and parts get wrenched on. It covers the whole yard footprint (the
 * props sit in it), so the shop reads as genuinely USED — not a sterile container, and not the scorched
 * war-blight of a camp either; this is the honest mess of a working place. Pure view polish on the shared
 * `@common/render` `GroundStainField`; it owns only the decals + their eased opacity, reading the sim
 * purely to know which shops exist.
 *
 * A shop persists (it's seeded into the static world, never destroyed), so unlike the scrap pile this
 * holds its cluster at full for as long as the shop is alive; the fade-out branch only fires for the
 * unusual case of a shop entity going away, keeping the lifecycle symmetric with the other stain layers.
 */

const FADE_OUT_EASE = 0.22;

type ShopKind = 'oil' | 'rust' | 'grime';

/** Per-kind canvas tones (NOT the GLB palette): oil is a near-black wet slick, rust a discoloured patch,
 *  grime a dusty mid-grey smear — the trodden-in dirt of a worked yard. */
const SHOP_PALETTE: StainPalette<ShopKind> = {
  oil: { core: '8,10,12', mid: '14,16,18', pool: '4,5,6', sheen: true },
  rust: { core: '120,62,28', mid: '92,50,26', pool: '66,34,16', sheen: false },
  grime: { core: '46,42,36', mid: '38,35,30', pool: '24,22,19', sheen: false },
};

/**
 * A layered yard grime reaching across the whole footprint (~5 m, matching the prop scatter): dark oil
 * slicks where drums and deliveries sit, rust discolouration spreading out, and a broad dusty-grime bleed
 * tying it all into trodden, worked ground. Far heavier than a lone spill — a shop stacking and hauling
 * goods all day leaves a real mess — but still short of the camp's scorched, contaminated reach.
 */
const SHOP_MIX: BlotchLayer<ShopKind>[] = [
  // Dark oil slicks — tight, high-opacity pools where drums/pallets are worked over.
  { kind: 'oil', count: 3, spread: 2.6, minR: 1.0, maxR: 1.8, minOp: 0.55, maxOp: 0.74 },
  // Rust discolouration spreading out across the yard.
  { kind: 'rust', count: 4, spread: 4.0, minR: 1.4, maxR: 2.4, minOp: 0.3, maxOp: 0.5 },
  // A broad dusty-grime smear tying the yard together — trodden, dragged-over ground.
  { kind: 'grime', count: 4, spread: 4.8, minR: 1.8, maxR: 2.8, minOp: 0.28, maxOp: 0.44 },
  // A faint outer oil bleed reaching the yard edge, tapering into the dust.
  { kind: 'oil', count: 2, spread: 5.4, minR: 2.0, maxR: 3.0, minOp: 0.16, maxOp: 0.3 },
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
      // Settle to full once (a fresh cluster builds at progress 0); a shop is static, so once it's there
      // re-asserting it every frame just rewrites every blotch's opacity to the same value. Skip that.
      if (stain.progress < 1) this.field.ease(stain, 1, 1);
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
