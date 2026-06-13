"""
mountain-range — the world's bounding wall as ONE continuous, noise-displaced ridge mesh (NOT a ring
of tiled props). A jagged annular range that rings the playable disc; the only openings are the
deliberate EXIT GAPS, where the ridge sinks away so the rig can drive through.

KEY IDEA — the ridge EMERGES from under the floor. Its inner/outer feet (and the gaps) are modelled
BELOW ground (`SINK` metres under y=0), and faces that are fully buried are dropped, so:
  * the line where rock meets the floor is where the surface crosses y=0 — and because that crossing
    rides the height noise, it's an IRREGULAR, natural shoreline, not a perfect machined circle;
  * a gap is simply a stretch sunk under the floor → the floor shows straight through it, with no
    coplanar flat patch to z-fight and no stray geometry;
  * the noise floor is kept HIGH everywhere the ridge stands, so it never dips low enough to look
    passable where it isn't a real gap.
The band edges also wobble per-angle, so the range bulges in and out rather than tracing a clean ring.

Flat-shaded faceted stone, tinted in three height bands with the matte CLIFF tones (dry wasteland rock,
non-metallic — so it reads as stone against the black void, not dark metal). Placed ONCE at the origin
in-game (the visual wall); a separate invisible collider ring does the blocking (see features/terrain).

GEOMETRY CONTRACT (must match features/terrain/mountain-ring.ts): the ridge centreline radius and the
exit-gap angles+width here are mirrored there so the visual ridge, the collider ring (set to block at
the inner foot), and the camps that guard the gaps all line up.
"""

import math

import bmesh  # type: ignore
import bpy  # type: ignore
from mathutils import Vector, noise  # type: ignore
import rr_style as rr

R_WALL = 95.0          # ridge centreline radius (≡ MOUNTAIN_RING_RADIUS in TS)
BAND_HALF = 22.0       # nominal half-width of the ridge band, before the per-angle wobble below
PEAK = 26.0            # tallest crest height (above the floor)
SINK = 5.0             # the feet/gaps are modelled this far BELOW the floor, then buried faces dropped
N_THETA = 300          # angular segments around the ring (continuous, wraps)
N_RAD = 11             # radial segments across the band

# Exit gaps: the ridge sinks fully within ±GAP_HALF of each angle, ramping over SHOULDER. Mirror of the
# TS EXIT_GAPS — narrow choke points.
GAP_ANGLES = [0.0, 2.3, 4.2]
GAP_HALF = 0.075
SHOULDER = 0.14

# Export as-authored, NOT re-grounded to the lowest vertex: the feet are deliberately modelled BELOW
# y=0 (the `SINK`), and the default base-centre re-origin would lift them up to the floor, undoing the
# emerge-from-the-ground design. The mesh is already centred at the origin, so this just preserves z.
ARTICULATED = True


def _gap_factor(theta):
    """1 on the ridge, 0 inside a gap, a smooth ramp across the shoulder between."""
    f = 1.0
    for ga in GAP_ANGLES:
        d = abs(((theta - ga) + math.pi) % (2 * math.pi) - math.pi)
        if d < GAP_HALF:
            return 0.0
        if d < GAP_HALF + SHOULDER:
            f = min(f, (d - GAP_HALF) / SHOULDER)
    return f


def _band(theta):
    """The per-angle inner/outer foot radii — wobbled by low-frequency noise so the range bulges in and
    out around the ring (the feet are not concentric circles)."""
    c, s = math.cos(theta), math.sin(theta)
    nlo = noise.noise(Vector((c * 9.0, s * 9.0, 3.0)))   # -1..1, ~9 undulations around the ring
    nhi = noise.noise(Vector((c * 9.0, s * 9.0, 9.0)))
    inner = (R_WALL - BAND_HALF) + 6.0 * nlo
    outer = (R_WALL + BAND_HALF) + 8.0 * nhi
    return inner, outer


def _jag(x, y):
    """Layered Perlin noise → varied crest heights (many distinct peaks). Kept WELL above 0 so the ridge
    never dips to a passable-looking low where it isn't a real gap."""
    n = 0.70 + 0.55 * noise.noise(Vector((x * 0.045, y * 0.045, 0.0)))  # coarse — the big peaks
    n += 0.28 * noise.noise(Vector((x * 0.13, y * 0.13, 7.0)))          # finer crags
    return max(0.6, min(1.35, n))


def build():
    """Build the continuous ridge: an emerge-from-the-floor, height-banded, flat-faceted rock mesh."""
    bm = bmesh.new()
    verts = {}
    heights = {}
    for i in range(N_THETA):
        theta = (i / N_THETA) * 2 * math.pi
        inner, outer = _band(theta)
        gapf = _gap_factor(theta)
        for j in range(N_RAD + 1):
            frac = j / N_RAD                       # 0 at inner foot → 1 at outer foot
            r = inner + (outer - inner) * frac
            x, y = math.cos(theta) * r, math.sin(theta) * r
            bump = math.sin(frac * math.pi)        # 0 at the feet, 1 at the centreline
            z = PEAK * bump * gapf * _jag(x, y) - SINK  # feet/gaps land below the floor
            verts[(i, j)] = bm.verts.new((x, y, z))
            heights[(i, j)] = z

    lo, hi = PEAK * 0.30, PEAK * 0.62
    for i in range(N_THETA):
        i2 = (i + 1) % N_THETA  # wrap the seam closed → one continuous loop
        for j in range(N_RAD):
            corners = [(i, j), (i2, j), (i2, j + 1), (i, j + 1)]
            # Drop faces that are fully buried under the floor — the feet + the gaps. The opaque floor
            # covers the hole, so a gap reads as clean open ground and there's no z-fighting flat patch.
            if all(heights[c] < -0.6 for c in corners):
                continue
            f = bm.faces.new([verts[c] for c in corners])
            f.smooth = False  # faceted rock, not smooth hills
            avg_z = sum(heights[c] for c in corners) / 4.0
            f.material_index = 0 if avg_z < lo else 1 if avg_z < hi else 2

    mesh = bpy.data.meshes.new("mountain-range")
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new("mountain-range", mesh)
    bpy.context.collection.objects.link(obj)
    for name in ("cliff_low", "cliff_mid", "cliff_high"):
        obj.data.materials.append(rr.material(name))
    return obj
