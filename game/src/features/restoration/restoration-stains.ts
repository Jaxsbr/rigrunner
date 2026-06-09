import type * as THREE from 'three';
import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { RestorableSite } from '@common/components/restorable-site';
import { GroundStainField, type StainPalette, type BlotchLayer, type StainCluster } from '@common/render/ground-stains';
import { Healable } from './healable';

/**
 * The restoration patch: a spread of living green — moss + grass — laid flat under a cleared-site stump,
 * the visual inverse of the oil/rust pollution the scrap pile and camp leave. Where contamination marks
 * blighted ground, this marks ground returning to life. It rides the SAME shared decal engine
 * (`@common/render/ground-stains`); this layer owns only the green palette + mix + lifecycle.
 *
 * Two felt cause→effects carry it:
 *   - a stump exists → a faint patch of greenery already shows (the land beginning to heal on its own);
 *   - the player grows the stump into a tree → the patch DEEPENS with `Healable.growth`, lush by full
 *     growth — so the heal pays off on the ground as well as overhead.
 * Variation is the engine's (each blotch a random size/ovalness/orientation/shade), so no two patches
 * look alike. The fade-out is driven by noticing the site is gone (the pile-stains pattern), not a sim
 * signal — a one-way projection of the world.
 */

const FADE_IN_EASE = 1.4;     // ease toward the growth-scaled target (snappy enough to track a live grow)
const FADE_OUT_EASE = 0.3;    // slow fade if a site ever vanishes (~3 s), never a pop
const RESTING_GREEN = 0.35;   // how strong the patch reads at growth 0 — a faint start, not bare dirt

type GreenKind = 'moss' | 'grass';

/** Per-kind canvas tones (NOT the GLB palette): living greens that pop off the dusty tan ground — moss a
 *  deeper shade tight under the stump, grass a lighter spread. Derived from `nature_green` (#50A336),
 *  kept muted so it reads as regrowth, not neon. No wet sheen — nothing here is a slick. */
const GREEN_PALETTE: StainPalette<GreenKind> = {
  moss: { core: '70,86,44', mid: '86,102,56', pool: '50,64,34', sheen: false },
  grass: { core: '104,118,62', mid: '126,140,82', pool: '82,96,50', sheen: false },
};

/**
 * Moss pools tight under the stump; grass spreads out past it; a faint outer bleed tapers into the
 * ground (~4 m). Smaller and tighter than the camp/pile blight — a single stump's worth of regrowth.
 */
const GREEN_MIX: BlotchLayer<GreenKind>[] = [
  { kind: 'moss', count: 2, spread: 1.6, minR: 1.0, maxR: 1.8, minOp: 0.6, maxOp: 0.82 },
  { kind: 'grass', count: 3, spread: 3.0, minR: 1.2, maxR: 2.2, minOp: 0.42, maxOp: 0.62 },
  { kind: 'grass', count: 2, spread: 4.0, minR: 1.6, maxR: 2.6, minOp: 0.22, maxOp: 0.36 },
];

export class RestorationStains {
  private readonly field: GroundStainField<GreenKind>;
  private readonly stains = new Map<EntityId, StainCluster>();

  constructor(scene: THREE.Scene) {
    this.field = new GroundStainField(scene, GREEN_PALETTE);
  }

  /** Reconcile a green patch per cleared-site stump: ease it toward its growth-scaled strength while the
   *  site stands, fade it out once the site is gone, dispose it when invisible. */
  sync(world: World, dt: number): void {
    for (const s of world.query(RestorableSite, Transform)) {
      const stain = this.stains.get(s) ?? this.spawn(s, world);
      const growth = world.get(s, Healable)?.growth ?? 0;
      const target = RESTING_GREEN + (1 - RESTING_GREEN) * growth; // faint at rest, lush as the tree grows
      this.field.ease(stain, target, dt * FADE_IN_EASE);
    }
    for (const [id, stain] of this.stains) {
      if (world.isAlive(id) && world.has(id, RestorableSite)) continue; // still owned — handled above
      this.field.ease(stain, 0, dt * FADE_OUT_EASE);
      if (stain.progress <= 0.001) {
        this.field.dispose(stain);
        this.stains.delete(id);
      }
    }
  }

  private spawn(s: EntityId, world: World): StainCluster {
    const t = world.get(s, Transform)!;
    const stain = this.field.build({ x: t.x, z: t.z }, GREEN_MIX);
    this.stains.set(s, stain);
    return stain;
  }
}
