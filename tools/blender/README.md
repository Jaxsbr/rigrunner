# tools/blender — RIGRUNNER asset pipeline

Procedural, style-consistent 3D assets for the game. Consistency comes from one shared
style kit (`rr_style.py`) that every asset reuses — not from re-describing the look each
time. The full visual contract lives in [`../../docs/asset-style.md`](../../docs/asset-style.md).

```
tools/blender/
  rr_style.py            # THE style kit: palette, scale, builders, origin/orientation, export
  build_asset.py         # headless runner: blender --background --python build_asset.py -- <name>
  assets/
    __init__.py
    scrap_container.py    # reference asset generator (defines build())
```

## Two ways to run the exact same kit

**Headless / reproducible (preferred for committing assets):**

```bash
# from repo root; `blender` must be on PATH (or use the full .app path)
blender --background --python tools/blender/build_asset.py -- scrap_container
# → writes game/public/assets/scrap-container.glb
```

**Interactive via blender-mcp** (agent-driven modelling): import the kit inside the MCP
`execute_code` tool and call the same helpers —

```python
import sys; sys.path.insert(0, "tools/blender")   # repo-root-relative
import rr_style as rr
rr.reset_scene()
from assets.scrap_container import build
rr.finalize_and_export(build(), "game/public/assets/scrap-container.glb")
```

## Adding an asset

1. Copy `assets/scrap_container.py` → `assets/<your_asset>.py`; implement `build()` using
   only `rr_style` helpers + `PALETTE` colours.
2. Generate it (headless command above, or via MCP).
3. Register the assetId in [`../../shared/assets.ts`](../../shared/assets.ts).
4. Reference it: `Renderable { shape: 'model', assetId: '<your-asset>' }`.
5. Validate against the checklist in `docs/asset-style.md` (scale, facing, origin, tri-count) —
   the viewer (`npm run dev:viewer`) is the quickest visual check.

The `blender-asset` skill automates steps 1–5.

## Why procedural, not AI text-to-3D?

Text-to-3D drifts in style every generation and is hard to keep on-scale/on-palette.
Scripted geometry on a shared kit is deterministic, diffable, re-generatable, and uniform
by construction. AI generation, if used, is only for rough base shapes that then get
conformed to the kit.
