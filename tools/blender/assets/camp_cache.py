"""
camp-cache — the loot container a looter camp guards (part of the level-1 camp silhouette). A sturdy
banded crate in rust + dark metal with a hazard-yellow lock, reading as "the prize" the guards ring.
Front-toward +Y (the lock faces forward).

A static single-mesh prop (~1.5 m footprint). World decoration, not a part — no tier, no collider.
"""

import rr_style as rr


def build():
    body = rr.beveled_box("cache_body", size=(1.40, 1.40, 1.10), mat="rust", location=(0.0, 0.0, 0.55))
    lid = rr.beveled_box("cache_lid", size=(1.48, 1.48, 0.14), mat="dark_metal", location=(0.0, 0.0, 1.17))
    band_a = rr.beveled_box("cache_band_a", size=(1.46, 0.12, 1.14), mat="dark_metal", location=(0.0, -0.45, 0.55))
    band_b = rr.beveled_box("cache_band_b", size=(1.46, 0.12, 1.14), mat="dark_metal", location=(0.0, 0.45, 0.55))
    lock = rr.beveled_box("cache_lock", size=(0.26, 0.12, 0.30), mat="hazard_yellow", location=(0.0, 0.72, 0.62))
    return rr.join([body, lid, band_a, band_b, lock], "camp-cache")
