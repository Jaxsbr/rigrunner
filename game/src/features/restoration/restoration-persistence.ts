import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { Renderable } from '@common/components/renderable';
import { RestorableSite } from '@common/components/restorable-site';
import { Healable } from './healable';

/**
 * The durable half of a restored site — the stump a cleared pile or camp left, and how far it has been
 * grown back. Restoration owns this because it owns the stump-as-heal-target (`Healable`): a saved
 * stump comes back SETTLED at its `growth` (no rise-from-soil dissolve, which is a one-time clear
 * animation), and `restorationSystem` leaves that pre-set growth alone (it only tags a `Healable` onto
 * a site that lacks one). The tree-grower then poses the young tree off `growth` on the first frame, so
 * a half-grown tree reloads as a half-grown tree.
 */

/** The shared stump-with-sprout model both cleared piles and cleared camps leave behind. */
const STUMP_ASSET = 'camp-sprout';

export interface StumpSave {
  x: number;
  z: number;
  rotationY: number;
  /** What produced the site — `'scrap'` (a cleared pile) or `'camp'` — preserved on the `RestorableSite`. */
  kind: string;
  sourceLevel: number;
  /** 0→1 how far the stump has been grown back into a tree. */
  growth: number;
}

/** Describe every restorable stump in the world (from cleared piles and camps alike). */
export function describeStumps(world: World): StumpSave[] {
  const out: StumpSave[] = [];
  for (const s of world.query(RestorableSite, Transform)) {
    const site = world.get(s, RestorableSite)!;
    const t = world.get(s, Transform)!;
    const growth = world.get(s, Healable)?.growth ?? 0;
    out.push({ x: t.x, z: t.z, rotationY: t.rotationY, kind: site.kind, sourceLevel: site.sourceLevel, growth });
  }
  return out;
}

/** Respawn a settled stump from its save — its `growth` set, ungated, ready for `restorationSystem`. */
export function spawnStumpFromSave(world: World, d: StumpSave): EntityId {
  const e = world.createEntity();
  world.add(e, Transform, { x: d.x, z: d.z, y: 0, rotationY: d.rotationY });
  world.add(e, Renderable, { shape: 'model', assetId: STUMP_ASSET });
  world.add(e, RestorableSite, { x: d.x, z: d.z, kind: d.kind, sourceLevel: d.sourceLevel });
  world.add(e, Healable, { growth: d.growth, active: false });
  return e;
}
