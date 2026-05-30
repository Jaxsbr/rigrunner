"""
Headless asset builder for RIGRUNNER.

Usage (from repo root):
    blender --background --python tools/blender/build_asset.py -- <asset_name> [out.glb]

`<asset_name>` is a module in tools/blender/assets/ (e.g. `scrap_container`). It must
define `build()` returning the finished object. This runner resets the scene, runs the
build, applies the origin/orientation conventions, and exports a GLB.

Default output: game/public/assets/<asset-name>.glb  (underscores → hyphens = the assetId).
After it writes, register the assetId in game/src/content/assets.ts.
"""

import importlib
import os
import sys

THIS_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(THIS_DIR, "..", ".."))
if THIS_DIR not in sys.path:
    sys.path.insert(0, THIS_DIR)

import rr_style  # noqa: E402  (path set above)


def _args_after_ddash() -> list[str]:
    return sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []


def main() -> None:
    args = _args_after_ddash()
    if not args:
        raise SystemExit("Provide an asset name, e.g. `-- scrap_container`")

    asset_name = args[0]
    asset_id = asset_name.replace("_", "-")
    out_path = (
        args[1]
        if len(args) > 1
        else os.path.join(REPO_ROOT, "game", "public", "assets", f"{asset_id}.glb")
    )
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    module = importlib.import_module(f"assets.{asset_name}")
    if not hasattr(module, "build"):
        raise SystemExit(f"assets/{asset_name}.py must define build()")

    rr_style.reset_scene()
    obj = module.build()
    rr_style.finalize_and_export(obj, out_path)

    print(f"[build_asset] wrote {out_path}")
    print(f"[build_asset] register in game/src/content/assets.ts as '{asset_id}'")


if __name__ == "__main__":
    main()
