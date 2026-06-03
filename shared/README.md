# shared/

Modules used by **both** the game (`game/`) and the asset viewer (`viewer/`) live here — today the
colour palette (`palette.json`), the `assetId → GLB URL` registry (`assets.ts`), the GLTF
load+cache helper (`model-loader.ts`), and a few small render/portrait helpers.

Rule: sharing is **explicit, never implicit**. `game/` and `viewer/` never import directly from
each other — anything both need is promoted into `shared/` deliberately.
