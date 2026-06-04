/**
 * Registry of 3D model assets — shared by the game and the asset viewer.
 *
 * Maps a stable `assetId` (referenced by `Renderable { shape: 'model' }`) to a URL served
 * from a `public/` dir at runtime. This is the single source of truth for asset paths — no
 * other code hard-codes a GLB path. The GLB files live in `game/public/assets/`; the viewer
 * app points its Vite `publicDir` at the same folder, so one path string works in both apps.
 *
 * To add an asset: drop the `.glb` into `game/public/assets/` and add one line here. The
 * `blender-asset` skill does both steps for you.
 */
export const MODEL_ASSETS: Record<string, string> = {
  // The player's rig foundation, in two chassis sizes (the 1×3 scout is the starter; the 3×5 is the
  // hauler). Both keep unjoined `wheel_*` nodes the render layer spins, and a deck top of 0.66 that
  // matches each chassis recipe's MountGrid.deckY so mounted parts sit on the visible deck.
  'chassis-1x3': '/assets/chassis-1x3.glb',
  'chassis-3x5': '/assets/chassis-3x5.glb',
  // The packed 2×2 chassis-kit — how a built-but-not-yet-deployed chassis shows on the workshop deck
  // and while it's carried; `chassisToRig` swaps it for the unfolded chassis GLB once it's hauled out.
  'chassis-kit': '/assets/chassis-kit.glb',
  'scrap-pile': '/assets/scrap-pile.glb',
  'loose-scrap': '/assets/loose-scrap.glb',
  'storage': '/assets/storage.glb',
  'engine-mk1': '/assets/engine-mk1.glb',
  'engine-mk2': '/assets/engine-mk2.glb',
  'workshop': '/assets/workshop.glb',
  // The Reclaimer (Option C): an articulated arm (named joint_* nodes + a socket_wrist attach
  // point) and its swappable unearthing-bucket head. See docs/asset-style.md "Articulated assets".
  'reclaimer-arm': '/assets/reclaimer-arm.glb',
  'reclaimer-bucket': '/assets/reclaimer-bucket.glb',
};

/** Resolve an assetId to its URL, or `undefined` if it isn't registered. */
export function assetUrl(assetId: string): string | undefined {
  return MODEL_ASSETS[assetId];
}
