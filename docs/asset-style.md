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
| **Forward** | Model the asset's **front facing Blender +Y**. After export it faces **−Z** in three.js, which is the direction the rig drives (`systems/movement.ts`: forward = −z). | Directional parts (guns, drills) and the rig's bumper point the way it travels. |
| **Up** | Blender is Z-up; export converts to glTF/three **Y-up** automatically (`export_yup=True`). | Matches three.js. |
| **Origin** | **Base-centre** (centre of footprint, on the ground plane). | Sits on `y=0` in-game with no offset; the render layer sets `restY=0` for models. |
| **Finish** | Smooth-shade + weighted normals + a small (~3 cm) **bevel**; low-poly. | Uniform "chunky industrial" read; bevels catch light. |
| **Format** | **GLB**, single file, materials embedded, modifiers baked, no cameras/lights. | One-file runtime load via `GLTFLoader`. |
| **Naming** | `kebab-case` filename = the **assetId** (`scrap-pile.glb` → `'scrap-pile'`). | One name from Blender → file → registry → component. |
| **Budget** | Grey-box era: keep it low (≈ hundreds–low-thousands of tris per prop). Revisit when we do a real art pass. | Performance + honest placeholder quality. |

## Size language — what "small / medium / large" mean

Scale only means something **relative to an anchor**. Ours are the **1 m grid cell** and the
**rig** (the player vehicle: a compact buggy, **2 m × 3 m × 0.8 m** — a 2×3-cell footprint).
Build every asset against this ladder so sizes stay consistent instead of vibes-based. When you
make something, decide which row it's in *first*, then pick metres.

| Class | Footprint | Height | Reads as | Examples |
|-------|-----------|--------|----------|----------|
| **Pickup** | « 1 cell (~0.3 m) | ankle-low | a brick | loose scrap you drive over (M1) |
| **Small prop / part** | ~1 cell | knee–waist (0.5–1.2 m) | a bin | a gun, a barrel, a small crate |
| **Medium object** | 1.5–2 cells | up to ~rig height | a crate stack | scrap pile, a small enemy bot |
| **The rig** *(anchor)* | 2×3 cells | ~0.8 m body | a small buggy | the player |
| **Large structure** | 3+ cells | taller than the rig | a shack / tree | looter camp, the ancient tree |

Anchor = a compact, nimble scrap **buggy**: parts are small (~1 m), the world feels tight and
fast. Verify scale in the viewer (`npm run dev:viewer`) — the grid is 1 m cells and the HUD prints
the asset's metric dimensions, so you can read its class straight off.

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
