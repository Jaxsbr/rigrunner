import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { Collectible } from '@features/scrap/collectible';
import { Collider } from '@common/components/collider';
import { Renderable } from '@common/components/renderable';
import { ScrapPile } from '@features/scrap/scrap-pile';

/**
 * Loose scrap: a small bit of debris the rig collects by simply driving over it (see
 * systems/scrap-collection). It is NOT a part — you don't grab or mount it — so it has no Part;
 * it's just a Collectible with a physical footprint sitting in the world.
 *
 * It renders the dedicated `loose-scrap` GLB (a hand-sized cluster of junk), distinct from the big
 * rummageable `scrap-pile` heap the Reclaimer works. Loose scrap is both scattered across the field
 * at startup and BURST out of a pile as it's rummaged — the rummage feeds the same drive-over
 * collection loop M1 already owns.
 */
const SCRAP_RADIUS = 0.4;  // forgiving pickup footprint — easy to sweep up while driving
const SCRAP_VALUE = 1;     // each piece adds 1 to storage (cap 4 ⇒ 4 pieces fill a container)

/** Spawn one piece of loose scrap at a world position, facing a (cosmetic) yaw. */
export function spawnScrap(world: World, x: number, z: number, rotationY = 0): EntityId {
  const e = world.createEntity();
  world.add(e, Transform, { x, z, rotationY });
  world.add(e, Collectible, { value: SCRAP_VALUE });
  world.add(e, Collider, { radius: SCRAP_RADIUS });
  world.add(e, Renderable, { shape: 'model', assetId: 'loose-scrap' });
  return e;
}

/**
 * Scatter `count` pieces of loose scrap at random positions in a ring `minR`..`maxR` around a
 * centre point. Each gets a random facing so the field doesn't read as a regular pattern. Returns
 * the spawned ids. The seam shared by the startup field (centred on the origin) and a pile's
 * rummage burst (centred on the rig).
 */
export function scatterScrapAround(
  world: World,
  cx: number,
  cz: number,
  count: number,
  minR: number,
  maxR: number,
): EntityId[] {
  const ids: EntityId[] = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = minR + Math.random() * (maxR - minR);
    const x = cx + Math.cos(angle) * radius;
    const z = cz + Math.sin(angle) * radius;
    ids.push(spawnScrap(world, x, z, Math.random() * Math.PI * 2));
  }
  return ids;
}

/**
 * Scatter `count` pieces around the ORIGIN in a ring `minR`..`maxR` — the startup field, close
 * enough to find at once, far enough that collecting is an activity you drive out for, and clear of
 * the rig/parts that sit near the centre.
 */
export function scatterScrap(
  world: World,
  count: number,
  minR = 6,
  maxR = 18,
): EntityId[] {
  return scatterScrapAround(world, 0, 0, count, minR, maxR);
}

// ── The rummageable pile ───────────────────────────────────────────────────────────────────────

const PILE_RADIUS = 4.0;                 // metres from centre the rig must reach to work it (tunable)
const PILE_FOV = (120 * Math.PI) / 180;  // the arm must have the pile within this full field-of-view
const PILE_WAVES = 8;                    // waves of scrap the heap holds (≈ how long hold-to-work runs)

// The three pile-mesh variants (one seeded generator, scrap_pile.py); a spawn picks one at random so
// piles don't all look the same. Each is a distinct silhouette + tone — see scrap-pile-polish-spec.md.
const PILE_VARIANTS = ['scrap-pile-a', 'scrap-pile-b', 'scrap-pile-c'] as const;

/**
 * Spawn a rummageable scrap pile at a world position — a big junk heap the Reclaimer digs into. It
 * mirrors the workshop's proximity model (a gated zone, no Collider — proximity, not collisions,
 * governs the interaction) but adds the Reclaimer + facing gate (see components/scrap-pile.ts). The
 * heap renders one of the three `scrap-pile-*` variant GLBs (picked by `rng`); the render layer shrinks
 * it as `remaining` falls, then sinks it on reclaim while a stump rises in its place.
 */
export function spawnScrapPile(world: World, x: number, z: number, rotationY = 0, rng: () => number = Math.random): EntityId {
  const e = world.createEntity();
  world.add(e, Transform, { x, z, rotationY });
  world.add(e, ScrapPile, {
    radius: PILE_RADIUS,
    fov: PILE_FOV,
    total: PILE_WAVES,
    remaining: PILE_WAVES,
    worked: 0,
    scrapScattered: 0,
    active: false,
  });
  const assetId = PILE_VARIANTS[Math.floor(rng() * PILE_VARIANTS.length)] ?? PILE_VARIANTS[0];
  world.add(e, Renderable, { shape: 'model', assetId });
  return e;
}

// ── Persistence (the durable half of a pile) ─────────────────────────────────────────────────────

/** A standing pile's saved state — enough to respawn it exactly (variant + how dug-down it is). */
export interface PileSave {
  x: number;
  z: number;
  rotationY: number;
  assetId: string;
  total: number;
  remaining: number;
}

/**
 * Describe every pile still worth saving — those still standing. A fully-rummaged pile (`remaining`
 * gone, mid-dissolve) is omitted: it is already represented by the stump it rose into (a
 * `RestorableSite`, saved on the restoration side), so saving the spent heap too would double it.
 */
export function describeScrapPiles(world: World): PileSave[] {
  const out: PileSave[] = [];
  for (const e of world.query(ScrapPile, Transform)) {
    const pile = world.get(e, ScrapPile)!;
    if (pile.remaining <= 0) continue;
    const t = world.get(e, Transform)!;
    const r = world.get(e, Renderable);
    out.push({
      x: t.x,
      z: t.z,
      rotationY: t.rotationY,
      assetId: r && r.shape === 'model' ? r.assetId : PILE_VARIANTS[0],
      total: pile.total,
      remaining: pile.remaining,
    });
  }
  return out;
}

/** A single loose-scrap piece's saved state — its exact spot and worth. */
export interface LooseScrapSave {
  x: number;
  z: number;
  rotationY: number;
  value: number;
}

/**
 * Describe every loose-scrap piece lying in the world right now — the actual remaining pieces, so a
 * reload restores exactly what was on the ground (no more, no less). This is NOT a re-scatter: the
 * initial field and any pile-burst scrap you didn't sweep up persist as themselves, so the world keeps
 * what you left — and because it's the real remaining set, a reload can't farm a fresh field.
 */
export function describeLooseScrap(world: World): LooseScrapSave[] {
  const out: LooseScrapSave[] = [];
  for (const e of world.query(Collectible, Transform)) {
    const t = world.get(e, Transform)!;
    out.push({ x: t.x, z: t.z, rotationY: t.rotationY ?? 0, value: world.get(e, Collectible)!.value });
  }
  return out;
}

/** Respawn one loose-scrap piece from its save at its exact spot. */
export function spawnLooseScrapFromSave(world: World, d: LooseScrapSave): EntityId {
  const e = spawnScrap(world, d.x, d.z, d.rotationY);
  world.get(e, Collectible)!.value = d.value;
  return e;
}

/** Respawn a pile from its save — deterministic (the saved variant + dig-down), unlike the random spawn. */
export function spawnScrapPileFromSave(world: World, d: PileSave): EntityId {
  const e = world.createEntity();
  world.add(e, Transform, { x: d.x, z: d.z, rotationY: d.rotationY });
  world.add(e, ScrapPile, {
    radius: PILE_RADIUS,
    fov: PILE_FOV,
    total: d.total,
    remaining: d.remaining,
    worked: 0,
    scrapScattered: 0,
    active: false,
  });
  world.add(e, Renderable, { shape: 'model', assetId: d.assetId });
  return e;
}
