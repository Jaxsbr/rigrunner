import type { CollisionMap } from '@features/terrain/collision-grid';

/**
 * The world-map's authored LAYOUT layer — which structures, props, camps, and piles seed the world and
 * where. This sits beside the painted collision raster (`@features/terrain/collision-grid`) in the same
 * committed map file: the editor (`app/editor`) writes both, the real-game scenario (`app/scenarios`)
 * reads them. Positions that used to be hard-coded in the scenario now live here as data, so the world
 * is authored in the editor rather than edited in TypeScript.
 *
 * This module is pure DATA — the kind catalog + a couple of geometry helpers. It deliberately imports NO
 * feature spawners (that cross-feature wiring is the composition root's job, in `spawn-placements.ts`), so
 * both the editor and the scenario can read the catalog without pulling every feature into their graph.
 */

/** A single authored layout entry: one `kind` dropped at (x,z), facing `rotationY` about +Y. */
export interface Placement {
  kind: PlacementKind;
  x: number;
  z: number;
  /** Heading in radians about +Y (0 = the kind's authored-forward; see the 8-wind helpers below). */
  rotationY: number;
}

/**
 * The committed world-map document: the collision raster the GAME loads, plus the authored layout. It is
 * a superset of `CollisionMap`, so `CollisionGrid.fromMap(worldMap)` loads the wall unchanged.
 *
 * `blocked` is the single source of truth for collision — the exact bytes the editor saved. The editor
 * loads it verbatim (no re-derivation), the brush edits it directly, and a placed structure's auto-baked
 * footprint is stamped INTO it; so what you see in the editor is what the game loads, always.
 */
export interface WorldMap extends CollisionMap {
  /** The authored layout — every structure/prop/camp/pile the world seeds, by kind + transform. */
  placements?: Placement[];
}

/** How the game seeds a kind, which fixes whether it is part of a save (`real-game.ts` splits on this). */
export type Persistence =
  /** Fixed scaffolding: seeded by `seedStaticWorld` on New Game AND Continue; never saved. */
  | 'static'
  /** Starting progress: seeded by `seedNewGameContent` on New Game only, then saved/restored by the snapshot. */
  | 'progress';

/** Palette grouping (purely organisational — the dispatch keys off `category` + `id`). */
export type PlacementCategory = 'structure' | 'camp' | 'scrap' | 'decoration';

/** One catalog row: everything the palette + ghost + dispatch + collision bake need, with no feature code. */
export interface PlacementKindDef {
  /** Stable id stored in the map and dispatched on. */
  id: string;
  /** Palette label. */
  label: string;
  category: PlacementCategory;
  persistence: Persistence;
  /** The GLB shown as the cursor ghost (a representative model for composite kinds like a camp). */
  ghostAssetId: string;
  /** Uniform ghost + footprint scale (default 1). */
  ghostScale?: number;
  /**
   * Whether placing/moving this kind bakes its mesh footprint into the static collision grid. Solid
   * structures bake (you can't drive through them); drive-through decoration and the sprawling camp do
   * not (a camp already blocks via its cache collider, and baking the whole camp would wall off the loot).
   */
  autoBake?: boolean;
  /** Camps only: which `CAMP_LEVELS` row to spawn. */
  level?: number;
}

/**
 * The placeable kinds. Decoration kinds use their `assetId` as the id (they spawn a plain `Renderable`);
 * structures/camps/scrap use a logical id the dispatch maps to a feature spawner. The mountain range is
 * intentionally absent: it is the singleton the wall collision is baked from, seeded in code, not freely
 * placed (a future addition once the bake learns to follow a moved range).
 */
export const PLACEMENT_KINDS: readonly PlacementKindDef[] = [
  // ── Structures (fixed scaffolding; solid, so their footprint bakes into the wall) ───────────────
  { id: 'workshop', label: 'Workshop', category: 'structure', persistence: 'static', ghostAssetId: 'workshop', autoBake: true },
  { id: 'shop', label: 'World shop', category: 'structure', persistence: 'static', ghostAssetId: 'shop', autoBake: true },

  // ── Camps (starting progress; saved/restored — the layout here is only the New-Game seed) ────────
  { id: 'camp-1', label: 'Camp · Lv1', category: 'camp', persistence: 'progress', ghostAssetId: 'camp-cache', level: 1 },
  { id: 'camp-2', label: 'Camp · Lv2', category: 'camp', persistence: 'progress', ghostAssetId: 'camp-cache', level: 2 },

  // ── Scrap piles (starting progress; a solid heap, so it bakes) ───────────────────────────────────
  { id: 'scrap-pile', label: 'Scrap pile', category: 'scrap', persistence: 'progress', ghostAssetId: 'scrap-pile-a', autoBake: true },

  // ── Decoration props (drive-through scenery; never baked) ────────────────────────────────────────
  { id: 'yard-crate', label: 'Crate', category: 'decoration', persistence: 'static', ghostAssetId: 'yard-crate' },
  { id: 'yard-drum', label: 'Drum', category: 'decoration', persistence: 'static', ghostAssetId: 'yard-drum' },
  { id: 'yard-parts', label: 'Parts heap', category: 'decoration', persistence: 'static', ghostAssetId: 'yard-parts' },
  { id: 'yard-pallet', label: 'Pallet', category: 'decoration', persistence: 'static', ghostAssetId: 'yard-pallet' },
  { id: 'yard-plant', label: 'Plant', category: 'decoration', persistence: 'static', ghostAssetId: 'yard-plant' },
  { id: 'tent', label: 'Tent', category: 'decoration', persistence: 'static', ghostAssetId: 'tent' },
  { id: 'debris-crate', label: 'Debris crate', category: 'decoration', persistence: 'static', ghostAssetId: 'debris-crate' },
  { id: 'debris-heap', label: 'Debris heap', category: 'decoration', persistence: 'static', ghostAssetId: 'debris-heap' },
  { id: 'camp-firepit', label: 'Firepit', category: 'decoration', persistence: 'static', ghostAssetId: 'camp-firepit' },
  { id: 'camp-sprout', label: 'Sprout', category: 'decoration', persistence: 'static', ghostAssetId: 'camp-sprout' },
];

/** A placeable kind's id — the values stored in `Placement.kind`. */
export type PlacementKind = (typeof PLACEMENT_KINDS)[number]['id'] | (string & {});

const KIND_BY_ID = new Map<string, PlacementKindDef>(PLACEMENT_KINDS.map((k) => [k.id, k]));

/** The catalog row for a kind, or undefined if the map names a kind the catalog no longer knows. */
export function placementKind(id: string): PlacementKindDef | undefined {
  return KIND_BY_ID.get(id);
}

// ── 8-wind rotation (the round-robin placement heading) ────────────────────────────────────────────

/** One compass step: 45° in radians. The 8 winds are N,NE,E,SE,S,SW,W,NW = 0,45,…,315°. */
export const WIND_STEP = Math.PI / 4;

/** Advance a heading one 8-wind step, wrapping a full turn — the round-robin auto-rotate between drops. */
export function nextWind(rotationY: number): number {
  return snapWind(rotationY + WIND_STEP);
}

/** Snap an arbitrary heading to the nearest of the 8 winds (radians), normalised to [0, 2π). */
export function snapWind(rotationY: number): number {
  const k = Math.round(rotationY / WIND_STEP);
  return (((k % 8) + 8) % 8) * WIND_STEP;
}
