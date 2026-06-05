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
  // The packed 2×2 chassis-kit — how a built-but-not-yet-deployed chassis shows on the workshop deck
  // and while it's carried; `chassisToRig` composes the deployed rig from the chassis sub-parts (the
  // per-size Frame + instanced Wheel/Suspension units) once it's hauled out.
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

  // Part-identity sub-parts (part-identity-spec.md Phase 2) — every catalog sub-part gets its own
  // authored model, so a Core reads as a core and a Boiler as a boiler in the shop, inventory inspect,
  // bench, and the asset viewer. Each id matches a PART_IDENTITIES.assetId in shared/part-identity.ts.
  // ⚡ Electric engine — clean/cool cast (rig_blue + scrap_grey + glow_green).
  'e-casing': '/assets/e-casing.glb',
  'e-core': '/assets/e-core.glb',
  'e-coupling': '/assets/e-coupling.glb',
  'e-regulator': '/assets/e-regulator.glb',
  // ♨ Steam engine — warm/industrial cast (rust + scrap_grey + dark_metal + hazard_yellow).
  's-boiler': '/assets/s-boiler.glb',
  's-piston': '/assets/s-piston.glb',
  's-driveshaft': '/assets/s-driveshaft.glb',
  's-throttle': '/assets/s-throttle.glb',
  // 📦 Storage container — the rig_blue cargo body + its hazard_yellow rim collar.
  'container-shell': '/assets/container-shell.glb',
  'container-rim': '/assets/container-rim.glb',
  // 🛞 Chassis sub-parts. The Frame splits per size — each is the host: a full mounting deck carrying the
  // `socket_axle_<i>`/`socket_susp_<i>` corner stations. The Wheel + Suspension are one shared unit each,
  // instanced at every station, so one model fits both the 1 m and 3 m tracks (the frame owns the spacing).
  'frame-1x3': '/assets/frame-1x3.glb',
  'frame-3x5': '/assets/frame-3x5.glb',
  'wheel-axle': '/assets/wheel-axle.glb',
  'suspension-steering': '/assets/suspension-steering.glb',
};

/** Resolve an assetId to its URL, or `undefined` if it isn't registered. */
export function assetUrl(assetId: string): string | undefined {
  return MODEL_ASSETS[assetId];
}
