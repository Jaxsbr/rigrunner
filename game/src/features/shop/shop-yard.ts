import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { Renderable } from '@common/components/renderable';

/**
 * The shop's goods YARD: a scatter of small props (`yard-*` GLBs) spread 360° around a world shop so it
 * reads as a busy, lived-in trade post — crates of stock, fuel drums, half-unpacked component heaps, a
 * loaded delivery pallet, and one potted plant (the muted-green sign of life). The story is "people work
 * here: unpacking deliveries, batching shipments" — so the stuff fills the eight tiles AROUND the shop's
 * one tile, dense enough that you tiptoe between it to reach the counter.
 *
 * Why a scatter of separate props, not one baked asset: the layout can vary per shop (so two shops never
 * look identical) and the prop kit can grow without re-authoring the building. The props are plain
 * decoration entities (Transform + Renderable, no collider, no behaviour) — `view.sync` draws them, the
 * sim ignores them, and they're rebuilt with the shop each load (never persisted).
 *
 * Placement is in the shop's OWN frame — `forward` is the entrance direction, `side` is across it — then
 * mapped to world by the shop's `rotationY`, so the yard sits correctly for any facing and the cell right
 * in front of the counter is kept lighter (low props only) so the entrance stays legible. The whole layout
 * is driven by a position-seeded RNG, so a given shop's yard is identical every load yet differs shop to
 * shop.
 */

/** The tall/medium props that fill the yard; weighted so crates + drums dominate, pallets are rarer. */
const FILL_PROPS: ReadonlyArray<{ id: string; weight: number }> = [
  { id: 'yard-crate', weight: 0.32 },
  { id: 'yard-drum', weight: 0.26 },
  { id: 'yard-parts', weight: 0.24 },
  { id: 'yard-pallet', weight: 0.18 },
];

const CELL = 2.9;        // metres between cell centres — the ring of 8 tiles sits at ±CELL around the shop
const JITTER = 0.85;     // max random offset of a prop from its cell centre (organic, not grid-locked)
const SCATTER_LITTER = 4; // loose-scrap bits strewn as ground litter (dropped bits during unpacking)
const STRAGGLERS = 3;     // a few props spilled past the tight ring, so the yard edge isn't a clean square

/** A small, fast seeded RNG (mulberry32) so a shop's yard is deterministic from its position. */
function rngFor(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash a world position into a 32-bit seed (so two shops at different spots get different yards). */
function seedFor(x: number, z: number): number {
  return (Math.imul(Math.round(x * 100), 73856093) ^ Math.imul(Math.round(z * 100), 19349663)) >>> 0;
}

function pickWeighted(r: number): string {
  let acc = 0;
  for (const p of FILL_PROPS) {
    acc += p.weight;
    if (r <= acc) return p.id;
  }
  return FILL_PROPS[FILL_PROPS.length - 1]!.id;
}

/**
 * Scatter a shop's yard around (shopX, shopZ), oriented by the shop's `rotationY`. Spawns the prop
 * entities directly into `world`; returns the ids (handy for tests). Call once per shop, right after
 * `spawnWorldShop` places the building.
 */
export function spawnShopYard(world: World, shopX: number, shopZ: number, rotationY: number): EntityId[] {
  const rng = rngFor(seedFor(shopX, shopZ));
  const ids: EntityId[] = [];

  // The shop's local axes in world space: `forward` points out the entrance, `side` runs across it.
  const fwdX = -Math.sin(rotationY), fwdZ = -Math.cos(rotationY);
  const sideX = Math.cos(rotationY), sideZ = -Math.sin(rotationY);
  // Map a local (across, ahead) offset to a world (x,z).
  const toWorld = (across: number, ahead: number): [number, number] => [
    shopX + sideX * across + fwdX * ahead,
    shopZ + sideZ * across + fwdZ * ahead,
  ];

  const place = (across: number, ahead: number, assetId: string, scale: number, y = 0): void => {
    const [x, z] = toWorld(across, ahead);
    const e = world.createEntity();
    world.add(e, Transform, { x, z, y, rotationY: rng() * Math.PI * 2 });
    world.add(e, Renderable, { shape: 'model', assetId, scale });
    ids.push(e);
  };

  // One filler prop (with the odd stacked crate / loose-scrap litter) dropped near a cell centre.
  const dropFiller = (cAcross: number, cAhead: number, lowOnly: boolean): void => {
    const across = cAcross + (rng() - 0.5) * 2 * JITTER;
    const ahead = cAhead + (rng() - 0.5) * 2 * JITTER;
    if (lowOnly) {
      // In front of the counter: keep it low so the entrance reads — a parts heap or dropped scrap only.
      place(across, ahead, rng() < 0.5 ? 'yard-parts' : 'loose-scrap', 0.85 + rng() * 0.3);
      return;
    }
    const assetId = pickWeighted(rng());
    const scale = 0.82 + rng() * 0.36;
    place(across, ahead, assetId, scale);
    // A crate sometimes gets a second crate stacked on it (slightly smaller, offset, re-yawed).
    if (assetId === 'yard-crate' && rng() < 0.35) {
      place(across + (rng() - 0.5) * 0.2, ahead + (rng() - 0.5) * 0.2, 'yard-crate', scale * 0.82, 0.72 * scale);
    }
  };

  // The eight tiles around the shop's one tile (3×3 grid minus the centre). The cell directly in front of
  // the counter (ahead > 0, centred) is kept light + low so the entrance stays legible; every other cell
  // gets a denser cluster, so stuff wraps the whole shop.
  for (let da = -1; da <= 1; da++) {
    for (let db = -1; db <= 1; db++) {
      if (da === 0 && db === 0) continue; // the shop building sits here
      const frontCentre = da === 0 && db === 1;
      const count = frontCentre ? (rng() < 0.6 ? 1 : 0) : 2 + Math.floor(rng() * 2); // 2–3 per cell
      for (let i = 0; i < count; i++) dropFiller(da * CELL, db * CELL, frontCentre);
    }
  }

  // A few stragglers spilled past the ring so the yard's edge frays instead of ending on a clean square.
  for (let i = 0; i < STRAGGLERS; i++) {
    const ang = rng() * Math.PI * 2;
    const dist = CELL * 1.5 + rng() * CELL * 0.6;
    dropFiller(Math.cos(ang) * dist, Math.sin(ang) * dist, false);
  }

  // Loose ground litter — small scrap bits dropped while unpacking, strewn anywhere in the yard.
  for (let i = 0; i < SCATTER_LITTER; i++) {
    const ang = rng() * Math.PI * 2;
    const dist = CELL * (0.7 + rng() * 1.1);
    place(Math.cos(ang) * dist, Math.sin(ang) * dist, 'loose-scrap', 0.8 + rng() * 0.4);
  }

  // The one potted plant — the sign of life. Placed forward and deliberately MISALIGNED from the building
  // (off to one side, ahead of the corner), not flush to a wall, so it reads as set-out, not built-in.
  const plantSide = (rng() < 0.5 ? -1 : 1) * (1.7 + rng() * 0.5);
  place(plantSide, 2.0 + rng() * 0.6, 'yard-plant', 0.95 + rng() * 0.2);

  return ids;
}
