# RIGRUNNER — 3D Asset Style

The visual + technical contract every 3D asset follows so the world looks like one game and
drops into the engine with zero per-asset fiddling. The code that *enforces* this is
[`tools/blender/rr_style.py`](../tools/blender/rr_style.py) — this doc is the human-readable
half. **Keep the two in sync**; if they ever disagree, the kit is authoritative.

> Status: living. The art direction is still being discovered (see `docs/ideas.md`). These
> are the *technical* conventions that hold regardless of where the look lands; the palette
> will evolve, the contract (scale/orientation/origin/export) should not.

---

## Look (where we're aiming)

Post-apocalyptic **but healing**: a dusty scrap wasteland you gradually bring back to life
(see the world vision in `docs/ideas.md`). Chunky, readable, low-poly industrial shapes
with a catch-light bevel — grey-box-honest now, growing real detail over time. The
signature **RIGRUNNER blue** marks containers and player-built parts; **neon green** means
energy / powered / "filling"; **living green** means restoration.

## Palette — the only colours assets may use

Single source of truth: [`shared/palette.json`](../shared/palette.json) (`name → {hex, use,
emissive?}`). `tools/blender/rr_style.py` reads it to build `PALETTE`/`_EMISSIVE` for Blender,
and the TS side imports it for the viewer swatches + future game UI — so Blender and the app can
never drift. Assets reference colours by name (shared materials, so the same name = the same
material everywhere). The table below mirrors the JSON; **edit the JSON to change a colour.**

| Name | Hex | Use |
|------|-----|-----|
| `scrap_grey` | `#6B6B6B` | default wasteland metal |
| `dark_metal` | `#2F3133` | frames, recesses, undersides |
| `rust` | `#8A4B2F` | weathering, decay, hazard edges |
| `hazard_yellow` | `#D9A521` | warnings, accents, markings |
| `rig_blue` | `#2F6F9F` | **signature** — containers + player-built parts |
| `glow_green` | `#59FF9F` | emissive — energy, tier fill, powered lights |
| `nature_green` | `#4C8F3A` | restoration — foliage, regrowth |
| `bone_white` | `#CDC6B8` | bleached structures, old plastic |

Need a colour that isn't here? Add a key to `shared/palette.json` (one place) — never an
ad-hoc material.

## The contract (these do not change)

| Property | Rule | Why |
|----------|------|-----|
| **Scale** | 1 Blender unit = 1 metre = **1 grid cell**. Author at real size. | Parts slot onto the grid without rescaling. |
| **Forward** | Model the asset's **front facing Blender −Y**. After export it faces **+Z** in three.js (local +Z = forward in-game). | Directional parts (guns, drills) aim correctly. |
| **Up** | Blender is Z-up; export converts to glTF/three **Y-up** automatically (`export_yup=True`). | Matches three.js. |
| **Origin** | **Base-centre** (centre of footprint, on the ground plane). | Sits on `y=0` in-game with no offset; the render layer sets `restY=0` for models. |
| **Finish** | Smooth-shade + weighted normals + a small (~3 cm) **bevel**; low-poly. | Uniform "chunky industrial" read; bevels catch light. |
| **Format** | **GLB**, single file, materials embedded, modifiers baked, no cameras/lights. | One-file runtime load via `GLTFLoader`. |
| **Naming** | `kebab-case` filename = the **assetId** (`scrap-container.glb` → `'scrap-container'`). | One name from Blender → file → registry → component. |
| **Budget** | Grey-box era: keep it low (≈ hundreds–low-thousands of tris per prop). Revisit when we do a real art pass. | Performance + honest placeholder quality. |

## How an asset reaches the screen (the seam)

```
tools/blender/assets/<name>.py   build() using rr_style helpers
        │  blender --background --python tools/blender/build_asset.py -- <name>
        ▼
game/public/assets/<name>.glb    (committed; Vite serves it at /assets/<name>.glb in both apps)
        │  register one line
        ▼
shared/assets.ts                 '<name>': '/assets/<name>.glb'   (one registry, game + viewer)
        │  reference from content/components
        ▼
Renderable { shape: 'model', assetId: '<name>' }
        │  render layer loads + caches + clones (shared/model-loader.ts), origin base-centre
        ▼
on screen.  (A magenta wireframe cube = asset missing or not registered.)
```

Inspect any asset in isolation with the **asset viewer**: `npm run dev:viewer`. It reads the same
`shared/assets.ts` registry, so a newly-registered asset shows up there automatically.

## Validation checklist (before committing an asset)

- [ ] Built **only** from `rr_style` helpers + `PALETTE` colours (no stray materials).
- [ ] Real-world scale — footprint matches its intended grid-cell count.
- [ ] Front faces **−Y** in Blender; confirmed it faces **+Z / "forward"** in-game.
- [ ] Origin at **base-centre**; rests cleanly on the ground (no floating / sinking).
- [ ] Exported GLB opens in-game (no magenta placeholder), correct finish + colours.
- [ ] Tri-count reasonable for a grey-box prop.
- [ ] assetId registered in `shared/assets.ts`; filename = assetId.

The `blender-asset` skill walks this end-to-end.
