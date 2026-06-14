# `app/world-map/` — the authored world layout (placements)

The world's LAYOUT as data: which structures, props, camps, and scrap piles seed the world and where.
Positions that used to be hard-coded in `app/scenarios/real-game.ts` now live in the committed map file
(`app/scenarios/maps/real-game.map.json`), beside the painted collision raster — authored in the map
editor (`app/editor`), read by the scenario at seed time. See [`docs/specs/map-editor-spec.md`](../../../../docs/specs/map-editor-spec.md) (Phase B).

What's here:

- **`placement.ts`** — pure DATA: the `Placement {kind,x,z,rotationY}` record, the `WorldMap` document type
  (a superset of `CollisionMap` adding `placements`), the `PLACEMENT_KINDS` catalog (label,
  category, **persistence** static|progress, ghost `assetId`, `autoBake`, camp `level`), and the 8-wind
  rotation helpers (`nextWind`/`snapWind`). It imports NO feature spawners — both the editor and the
  scenario read the catalog without pulling every feature into their graph.
- **`spawn-placements.ts`** — the cross-feature DISPATCH: `spawnPlacement` routes one `kind` to its feature
  spawner (`spawnWorkshop`/`spawnWorldShop`/`spawnCamp`/`spawnScrapPile`, or a plain decoration model) and
  returns every entity it created; `spawnPlacements(world, list, persistence?)` seeds a filtered subset.

Single-owner / placement rules at the point of edit:

- **This is composition-root code (ADR-003).** `spawn-placements.ts` is the one place that imports across
  features to build placements — that's allowed only because `app/` is the composition root. Do NOT move the
  dispatch into a feature or `@common`; `@core`/`@common`/`features` must never import it.
- **Persistence is intrinsic to a kind, and it decides the seam.** `static` kinds seed in `seedStaticWorld`
  (New Game + Continue, never saved); `progress` kinds seed in `seedNewGameContent` (New Game only, then
  saved/restored by the snapshot). The map authors only the NEW-GAME layout — runtime mutations own the save.
  A camp/pile placement is a spawn-marker, not the saved entity (camps/piles persist via their own `*Save`).
- **`autoBake` is opt-in, and it means "solid".** Only kinds you can't drive through bake a collision
  footprint (workshop, shop, scrap pile). Decoration is drive-through by design (the shop-yard rule) and a
  camp blocks via its cache collider — neither bakes. Don't flip `autoBake` on a decoration prop.
- **Adding a kind = one catalog row + one dispatch case.** A new decoration prop is just a row (its `id` is
  its `assetId`); a new structure/camp/scrap kind also needs a `case` in `dispatch`. The ghost `assetId`
  must be a real entry in `shared/assets.ts` (the palette + the editor ghost + the bake all read it).
- **The map file is read two ways, deliberately.** The game bundle-imports it (a fresh process reads it
  fresh); the editor reads/writes it over the dev `/__map` endpoint and never bundle-imports it (so Save
  doesn't HMR-reload the editor). Keep this module map-free — it carries the TYPES, never the map import.
