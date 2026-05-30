# game/public/assets

Runtime 3D assets (`.glb`) for the official game. Vite serves this folder at the site
root, so a file here named `scrap-pile.glb` is fetched at `/assets/scrap-pile.glb`.
The **asset viewer** (`npm run dev:viewer`) points its `publicDir` here too, so these same
files serve both apps.

**These are committed source assets** (not build output) — they belong in version control.

## Adding an asset

Prefer the `blender-asset` skill, which produces a style-consistent GLB and wires it up.
Manually, the contract is:

1. Drop the `.glb` here (kebab-case name = its `assetId`, e.g. `scrap-pile.glb`).
2. Register it in [`../../../shared/assets.ts`](../../../shared/assets.ts):
   `'scrap-pile': '/assets/scrap-pile.glb',`
3. Reference it from a component: `Renderable { shape: 'model', assetId: 'scrap-pile' }`.

## Conventions every GLB must follow

See [`../../../docs/asset-style.md`](../../../docs/asset-style.md). In short: 1 unit = 1
grid cell, **+Z = forward**, **origin at the base-centre** (so it rests on the ground at
y=0), real-world metric scale, `-Y up`/`+Z forward` glTF export, materials from the shared
palette. A magenta wireframe cube in-game means the asset failed to load or isn't
registered.
