"""
mountain-range — the world's bounding wall as ONE continuous, noise-displaced ridge mesh (NOT a ring
of tiled props glued together). A jagged annular ridge that rings the playable disc: it rises from
flat ground at its inner+outer edges to a noisy crest along its centreline, so adjacent peaks are part
of one connected range with no object-to-object gaps. The only openings are the deliberate EXIT GAPS,
where the ridge ramps smoothly back down to ground so the rig can drive through.

Built procedurally as a polar grid (angle × radial band) with the crest height = a smooth radial bump
× layered Perlin noise (varied peaks all the way around) × a gap mask (flat at the exits). Flat-shaded
for a faceted, low-poly rock read; tinted in three bands by height (dark base → grey rock → pale
weathered tips). Placed ONCE at the origin in-game (the visual wall); a separate invisible collider
ring does the blocking (see features/terrain), so the mesh can be continuous while collision stays
circle-based.

GEOMETRY CONTRACT (must match features/terrain/mountain-ring.ts): the ridge centreline radius and the
exit-gap angles+width here are mirrored there so the visual ridge, the collider ring, and the camps
that guard the gaps all line up. Change them in both places (this is baked into the GLB at world size,
so a radius change means a rebuild).
"""

import math

import bmesh  # type: ignore
import bpy  # type: ignore
from mathutils import Vector, noise  # type: ignore
import rr_style as rr

R_WALL = 95.0          # ridge centreline radius (≡ MOUNTAIN_RING_RADIUS in TS)
BAND_HALF = 20.0       # the ridge spans R_WALL ± BAND_HALF; it's flat ground at those edges
PEAK = 24.0            # tallest crest height
N_THETA = 264          # angular segments around the ring (continuous, wraps)
N_RAD = 9              # radial segments across the band

# Exit gaps: ridge flattens to ground within ±GAP_HALF of each angle, ramping over SHOULDER. Mirror of
# the TS EXIT_GAPS — narrow choke points (point 4: exits were too wide).
GAP_ANGLES = [0.0, 2.3, 4.2]
GAP_HALF = 0.075       # ~14 m clear opening at r=95
SHOULDER = 0.13        # the ridge ramps down to the gap over this much arc (no cliff edge)


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


def _ridge(r):
    """A smooth radial bump: 0 at the band edges, 1 at the centreline — so the ridge rises from flat
    ground and settles back, rather than standing as a cliff-walled annulus."""
    t = (r - (R_WALL - BAND_HALF)) / (2 * BAND_HALF)  # 0..1 across the band
    if t <= 0.0 or t >= 1.0:
        return 0.0
    return math.sin(t * math.pi) ** 1.25


def _jag(theta, r):
    """Layered Perlin noise → varied crest heights around the ring (many distinct peaks, not one lump)."""
    x, y = math.cos(theta) * r, math.sin(theta) * r
    n = 0.55 + 0.55 * noise.noise(Vector((x * 0.045, y * 0.045, 0.0)))  # coarse — the big peaks
    n += 0.30 * noise.noise(Vector((x * 0.12, y * 0.12, 7.0)))          # finer crags on top
    return max(0.05, min(1.0, n))


def _height(theta, r):
    base = _ridge(r) * _gap_factor(theta)
    if base <= 0.0:
        return 0.0
    return base * PEAK * _jag(theta, r)


def build():
    """Build the continuous ridge ring as one flat-faceted, height-banded rock mesh."""
    bm = bmesh.new()
    verts = {}
    for i in range(N_THETA):
        theta = (i / N_THETA) * 2 * math.pi
        for j in range(N_RAD + 1):
            r = (R_WALL - BAND_HALF) + (2 * BAND_HALF) * (j / N_RAD)
            verts[(i, j)] = bm.verts.new((math.cos(theta) * r, math.sin(theta) * r, _height(theta, r)))

    # Three height bands → three material slots: dark base, grey rock, pale weathered tips.
    lo, hi = PEAK * 0.26, PEAK * 0.60
    for i in range(N_THETA):
        i2 = (i + 1) % N_THETA  # wrap the seam closed → one continuous loop
        for j in range(N_RAD):
            f = bm.faces.new([verts[(i, j)], verts[(i2, j)], verts[(i2, j + 1)], verts[(i, j + 1)]])
            f.smooth = False  # faceted rock, not smooth hills
            avg_z = sum(v.co.z for v in f.verts) / 4.0
            f.material_index = 0 if avg_z < lo else 1 if avg_z < hi else 2

    mesh = bpy.data.meshes.new("mountain-range")
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new("mountain-range", mesh)
    bpy.context.collection.objects.link(obj)
    for name in ("dark_metal", "scrap_grey", "bone_white"):
        obj.data.materials.append(rr.material(name))
    return obj
