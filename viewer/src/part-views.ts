/**
 * Per-part default VIEW settings for the asset viewer — how a part is framed the moment you select it,
 * so it reads correctly on first sight instead of needing a zoom-out and a spin to make sense.
 *
 * Two knobs, both with sane defaults:
 *  - `zoom`   — on-screen scale relative to a fit-to-frame baseline (see below).
 *  - `facing` — yaw the part toward or away from the default 3/4 view.
 *
 * This is the configuration surface: edit a part's entry, reload the viewer, eyeball it (the Playwright
 * review workflow drives this — navigate to the part, screenshot, adjust). A part with no entry uses
 * `DEFAULT_VIEW`. Keyed by id — a sub-part's catalog id in the Parts tab, or a GLB's `assetId` in the
 * Assets tab (for parts whose two ids coincide, one entry covers both).
 *
 * Every catalog sub-part now has a real authored model (part-identity-spec.md Phase 2), so framing is
 * tunable for all of them. Most read well at the default fit-to-frame 3/4-from-behind view; entries are
 * added only where a part needs help — a control face that lives on the FRONT must yaw 180° to read, and
 * a large part (a 1 m crate, a wide casing) wants a pull-back so it isn't cropped.
 */
export interface PartView {
  /**
   * On-screen scale. `1` is the fit-to-frame baseline (the part's bounds fill the view, the viewer's
   * long-standing behaviour). `<1` pulls the camera back so the part reads smaller (e.g. a small scoop
   * you want to feel small, not screen-filling); `>1` pushes in so it reads larger. The camera distance
   * is the fit distance divided by this, so doubling `zoom` halves the apparent distance.
   */
  zoom: number;
  /**
   * Yaw applied to the part, in degrees about the vertical axis — `0` keeps its modelled orientation
   * (the default 3/4-from-behind view), `180` turns its front toward the camera. The green forward arrow
   * always points world-forward (in-game −Z), so a yawed part visibly faces off that axis. Uniform `0`
   * for the first pass — per-part facing gets dialled in later.
   */
  facing: number;
}

export const DEFAULT_VIEW: PartView = { zoom: 1, facing: 0 };

/**
 * Per-part overrides (merged over `DEFAULT_VIEW`). Values are eyeball-tuned in the viewer against the
 * real models; think of the relative scale as a game-POV glance — a small part reads small, a large one
 * (a future 3×5 chassis) nearly fills the frame.
 */
export const PART_VIEWS: Record<string, Partial<PartView>> = {
  // Tuned against the real models via the Playwright review workflow.
  'reclaimer-bucket': { zoom: 0.35 }, // a small scoop — read it as small, not screen-filling
  'stump-healer': { zoom: 0.35 }, // a small can-and-sprout head, framed like its sibling bucket
  'reclaimer-arm': { zoom: 0.7 }, // a mid-size tool, a touch pulled back from full-frame

  // ⚡ Electric engine — the Casing and Regulator carry their identity on the FRONT face (panel +
  // status light; dial + indicator lights), so yaw them to camera; both are wide enough to want a
  // pull-back. The Core/Coupling read from the default angle.
  'e-casing': { facing: 180, zoom: 0.7 },
  'e-regulator': { facing: 180, zoom: 0.75 },
  'e-coupling': { zoom: 0.82 },
  // ♨ Steam engine — the Boiler is a chunky 0.8 m tank; pull back so the whole capsule reads. The
  // Piston/Driveshaft/Throttle already fill the frame well.
  's-boiler': { zoom: 0.85 },
  // 📦 Storage — the Shell is a full 1 m crate, so pull well back to see the open hold; the Rim is
  // a touch wide.
  'container-shell': { zoom: 0.6 },
  'container-rim': { zoom: 0.88 },
  // 🛞 Chassis Frames — each is a full mounting deck (1×3 / 3×5 m), so pull well back to see the whole
  // deck + its corner stations; the 3×5 hauler is much larger.
  'frame-1x3': { zoom: 0.5 },
  'frame-3x5': { zoom: 0.32 },

  // Composed PRODUCTS (the Parts-tab product headers) — keyed by the product-group id. The engines yaw
  // their front to camera so the open frame's internals + status read; both are chunky open frames, so
  // pull back. Storage shows the shell+rim head-on. The chassis composes its Frame deck + per-corner
  // wheels + suspension — the 3×5 hauler is large, so pull well back.
  'electric-engine': { facing: 180, zoom: 0.55 },
  'steam-engine': { facing: 180, zoom: 0.5 },
  storage: { zoom: 0.6 },
  'chassis-1x3': { zoom: 0.5 },
  'chassis-3x5': { zoom: 0.32 },
};

/** The view settings for an id — the per-id override merged over the defaults. */
export function viewFor(id: string): PartView {
  return { ...DEFAULT_VIEW, ...PART_VIEWS[id] };
}
