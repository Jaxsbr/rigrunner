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
 * For now only the parts that have a real model are worth tuning; every other sub-part renders as the
 * same placeholder cube, so its framing can't be judged until its model lands — set those on review as
 * each model is created.
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
  // Tuned against the real models via the Playwright review workflow. The rest default until modelled.
  'reclaimer-bucket': { zoom: 0.35 }, // a small scoop — read it as small, not screen-filling
  'reclaimer-arm': { zoom: 0.7 }, // a mid-size tool, a touch pulled back from full-frame
};

/** The view settings for an id — the per-id override merged over the defaults. */
export function viewFor(id: string): PartView {
  return { ...DEFAULT_VIEW, ...PART_VIEWS[id] };
}
