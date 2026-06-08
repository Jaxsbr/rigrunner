---
name: blender-asset
description: >-
  Create or update a style-consistent RIGRUNNER 3D asset (GLB) and wire it into the game.
  Use whenever asked to model / make / generate / import a 3D asset, part, prop, container,
  pickup, enemy, structure, or any game model for rigrunner — or to add a GLB to the game.
  Produces a procedurally-built, on-palette, correctly-scaled/oriented GLB and registers it
  so it renders. RIGRUNNER-specific.
---

# blender-asset

End-to-end pipeline for a RIGRUNNER 3D asset: **define → generate → export → register →
reference → validate**. Consistency is guaranteed by building every asset from the shared
style kit, never by re-describing the look.

## Read first (the contract)

- [`docs/asset-style.md`](../../../docs/asset-style.md) — palette, scale, orientation,
  origin, finish, export, naming. **The asset must obey this.**
- [`tools/blender/rr_style.py`](../../../tools/blender/rr_style.py) — the helpers you build
  with (`PALETTE`, `beveled_box`, `join`, `apply_style`, `finalize_and_export`, …).
- [`tools/blender/assets/scrap_pile.py`](../../../tools/blender/assets/scrap_pile.py)
  — the reference generator. Copy its shape.

Hard rules: **only palette colours** (defined in [`shared/palette.json`](../../../shared/palette.json),
the single source of truth `rr_style` loads — add a key there if you need a new one, never an
ad-hoc material); **only `rr_style` helpers**; real-world scale (1 unit = 1 grid cell); front
faces **−Y**; origin **base-centre**; keep it low-poly.

## Prerequisites

- Blender installed and on `PATH` (`blender --version`). On macOS it may live at
  `/Applications/Blender.app/Contents/MacOS/Blender` — use that full path if `blender`
  isn't found.
- For the *interactive* path only: the `blender` MCP server connected (Blender running with
  the blender-mcp addon's server started). The *headless* path below needs none of that and
  is preferred for committing assets.

## Procedure

### 1. Define the generator

Create `tools/blender/assets/<asset_name>.py` (snake_case; it maps to assetId
`<asset-name>`). Implement `build()` returning the finished object, using only `rr_style`
helpers and palette names. Compose from `beveled_box(...)` pieces and `join(...)` them.
Build the front facing −Y. Keep the footprint to whole grid cells.

Sanity-check syntax without Blender:
```bash
python3 -m py_compile tools/blender/assets/<asset_name>.py
```

### 2. Generate the GLB

**Headless (preferred):**
```bash
blender --background --python tools/blender/build_asset.py -- <asset_name>
# → game/public/assets/<asset-name>.glb
```

**Interactive (blender-mcp), same kit:** in the MCP `execute_code` tool. Blender's working
dir is **not** the repo root, so use **absolute paths**:
```python
import sys
sys.path.insert(0, "/ABS/PATH/TO/rigrunner/tools/blender")
for m in ("rr_style", "assets.<asset_name>", "assets"):
    sys.modules.pop(m, None)  # force a fresh import so edits take effect
import rr_style as rr
from assets.<asset_name> import build
rr.reset_scene()
rr.finalize_and_export(build(), "/ABS/PATH/TO/rigrunner/game/public/assets/<asset-name>.glb")
```
Use the interactive path when you need to eyeball/tweak in Blender (then
`get_viewport_screenshot`); use headless to produce the committed artifact reproducibly.

### 3. Register the assetId

Add one line to [`shared/assets.ts`](../../../shared/assets.ts) (the registry shared by the
game and the viewer):
```ts
'<asset-name>': '/assets/<asset-name>.glb',
```

### 4. Reference it

Give an entity a model Renderable, in the feature that spawns it — `game/src/features/<feature>/`
(e.g. a storage container in `features/storage/`, a workshop fixture in `features/workshop/`):
```ts
world.add(e, Renderable, { shape: 'model', assetId: '<asset-name>' });
```

### 5. Validate

```bash
npm run typecheck:game && npm run build:game   # registry + types compile, GLB bundles
```
Inspect the asset in isolation with the **viewer** (fastest visual check — it auto-lists
every registered asset and shows dimensions + tri-count + a +Z forward arrow):
```bash
npm run dev:viewer
```
Check against the **validation checklist** in `docs/asset-style.md`: correct scale/facing/origin,
on-palette, no **magenta wireframe cube** (that means the asset is missing or unregistered),
reasonable tri-count. (`npm run dev:game` confirms it in the real game too.)

## Notes & gotchas

- **Magenta wireframe cube in-game** = the GLB didn't load or the assetId isn't registered.
  Check step 3 and the file path/name.
- **Wrong facing** → fix the source orientation in the generator (front to −Y), don't rotate
  in the game.
- **Floating / sunken** → origin isn't base-centre; `finalize_and_export` handles this, so
  ensure you're going through it (or `set_origin_base_center`). **But beware the rotation gotcha:**
  `set_origin_base_center` grounds off the bound-box CORNERS, which *overestimate* the extent under a
  non-identity rotation — so a rotated object grounds too low and FLOATS. A `join()`ed asset inherits
  the first joined chunk's rotation, so a tilted first chunk floats the whole thing. Fix: bake the
  rotation into the mesh before grounding — `transform_apply(location=False, rotation=True, scale=False)`
  (see `scrap_pile.py`). Verify with the GLB's Y-min ≈ 0, not just by eye.
- **New colour needed** → add it to `rr_style.PALETTE` *and* the table in `docs/asset-style.md`.
- Editing an existing asset: change its generator and re-run step 2 (same name overwrites the
  GLB); no registry change needed.
