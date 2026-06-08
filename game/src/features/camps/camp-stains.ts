import type * as THREE from 'three';
import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { GroundStainField, type StainPalette, type BlotchLayer, type StainCluster } from '@common/render/ground-stains';
import { Camp } from './camp';

/**
 * The camp's environmental mess: a dense, layered contamination laid flat under each camp and BLEEDING
 * OUT past its structures — dark oil pools (with a wet sheen), charred scorch, and rust-discoloured
 * ground — scattered and overlapped so the earth clearly reads as polluted and fought-over, the blight
 * reaching well beyond the buildings rather than sitting between them. Pure view polish (it owns only the
 * decals + their eased opacity, reading the sim to know each camp's state). It carries the core loop's
 * cause→effect:
 *   - a camp stands (`GUARDED`/`DISARMABLE`) → its pools hold, marking it as a blight on the land
 *   - the camp is `CLEARED` → they fade out together = the world visibly cleans up as the camp dissolves
 *
 * The decal mechanics (canvas blobs, cluster build/ease/dispose, texture pool) are the shared
 * `@common/render` `GroundStainField`; this layer owns only the camp's CONFIG (its colour mix + reach)
 * and lifecycle. The lasting marker (the sprout) is a separate, persistent `RestorableSite` prop; these
 * pools are the impermanent contamination that the clean-up wipes away.
 */

const FADE_OUT_EASE = 0.25; // slow clean-up creep once cleared (~12 s), never a pop

type CampKind = 'oil' | 'scorch' | 'rust';

/** Per-kind canvas tones: oil is a near-black wet slick, scorch is charred warm-dark, rust is a saturated
 *  discoloured patch that pops off the dusty ground. */
const CAMP_PALETTE: StainPalette<CampKind> = {
  oil: { core: '8,10,12', mid: '14,16,18', pool: '4,5,6', sheen: true },
  scorch: { core: '24,20,16', mid: '34,30,24', pool: '12,10,8', sheen: false },
  rust: { core: '120,62,28', mid: '92,50,26', pool: '66,34,16', sheen: false },
};

/**
 * The mess is a MIX of pool kinds at varied reach, layered so the contamination is heaviest under the
 * camp and BLEEDS OUT well past its structures (debris sit out to ~5 m). Dark oil + scorch pool tight at
 * the core; rust discolouration spreads wider; large faint patches reach furthest and taper into the
 * ground.
 */
const CAMP_MIX: BlotchLayer<CampKind>[] = [
  // Dense, dark core — heavy contamination right under/around the camp's structures.
  { kind: 'oil', count: 3, spread: 3.6, minR: 1.6, maxR: 3.0, minOp: 0.82, maxOp: 0.95 },
  { kind: 'scorch', count: 3, spread: 4.6, minR: 1.6, maxR: 3.0, minOp: 0.66, maxOp: 0.86 },
  // Discolouration spreading OUT past the buildings.
  { kind: 'rust', count: 4, spread: 7.2, minR: 2.2, maxR: 3.8, minOp: 0.5, maxOp: 0.74 },
  // Faint outer bleed — large, soft patches that reach well beyond the camp and taper into the ground.
  { kind: 'oil', count: 2, spread: 8.5, minR: 3.0, maxR: 4.6, minOp: 0.26, maxOp: 0.44 },
  { kind: 'rust', count: 3, spread: 9.5, minR: 3.4, maxR: 5.2, minOp: 0.2, maxOp: 0.4 },
];

export class CampStains {
  private readonly field: GroundStainField<CampKind>;
  private readonly stains = new Map<EntityId, StainCluster>();

  constructor(scene: THREE.Scene) {
    this.field = new GroundStainField(scene, CAMP_PALETTE);
  }

  /** Reconcile a contamination cluster per camp; ease it out once the camp is cleared, dispose it when gone. */
  sync(world: World, dt: number): void {
    for (const c of world.query(Camp, Transform)) {
      const stain = this.stains.get(c) ?? this.spawn(c, world);
      const cleared = world.get(c, Camp)!.state === 'cleared';
      this.field.ease(stain, cleared ? 0 : 1, cleared ? dt * FADE_OUT_EASE : 1); // snap in, fade out
    }
    for (const [id, stain] of this.stains) {
      if (world.isAlive(id) && world.has(id, Camp)) continue;
      this.field.dispose(stain); // the camp entity itself is gone — drop its decals
      this.stains.delete(id);
    }
  }

  private spawn(c: EntityId, world: World): StainCluster {
    const t = world.get(c, Transform)!;
    const stain = this.field.build({ x: t.x, z: t.z }, CAMP_MIX);
    this.stains.set(c, stain);
    return stain;
  }
}
