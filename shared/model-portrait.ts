import * as THREE from 'three';
import { ModelLoader } from './model-loader';
import { MODEL_ASSETS } from './assets';
import { createThreeCanvas, disposeObject } from './three-canvas';

/**
 * A small, self-contained turntable preview of a single GLB — the rotatable "portrait" the workshop
 * shows for the selected part. It builds on the shared `three-canvas` host (canvas, scene, camera,
 * lights, `OrbitControls`, render loop), adding only the single-model turntable content: gentle
 * auto-rotate + drag-to-spin, bounds-fit framing, and a ghost/build-target render mode.
 *
 * Generic on purpose — it knows only an `assetId` (resolved through the shared `MODEL_ASSETS`
 * registry + `ModelLoader`). When an asset is unregistered or fails to load, it shows a neutral
 * placeholder block (optionally tinted by the caller) so the widget is always populated — the part
 * GLBs don't exist yet in milestone MW, so the placeholder is what the player actually sees until
 * real assets land.
 */
export interface ModelPortrait {
  /**
   * Swap the displayed model. `null` clears it. `fallbackColor` tints the placeholder block.
   * `ghost: true` renders the model in flat desaturated grey — the "build target" silhouette shown
   * while a recipe is still incomplete, before the full-colour part exists.
   */
  show(assetId: string | null, opts?: { fallbackColor?: number; ghost?: boolean }): void;
  /** Re-read the host's size and resize the renderer — call after the host becomes visible. */
  resize(): void;
  /** Begin the render loop (call when the host is shown). Idempotent. */
  start(): void;
  /** Pause the render loop (call when the host is hidden) to stop burning frames. Idempotent. */
  stop(): void;
  /** Tear down the canvas, controls, renderer and GPU resources. */
  dispose(): void;
}

export interface ModelPortraitOptions {
  /** Gently spin the model on its own? Off by default — callers opt in (the viewer does). */
  autoRotate?: boolean;
}

/** Create a portrait widget that renders into a canvas appended to `host`. */
export function createModelPortrait(host: HTMLElement, opts: ModelPortraitOptions = {}): ModelPortrait {
  const cv = createThreeCanvas(host, {
    fov: 45,
    autoRotate: opts.autoRotate ?? false,
    onResize: () => {
      if (framed) frame(framed); // the tighter FOV dimension changed — re-fit so nothing crops
    },
    onDispose: () => {
      clearHolder();
      ghostMaterial?.dispose();
      ghostMaterial = null;
    },
  });
  const { scene, camera, controls } = cv;
  camera.position.set(2.4, 1.9, 2.8);
  controls.target.set(0, 0.5, 0);

  const holder = new THREE.Group(); // the currently-displayed model/placeholder lives here
  scene.add(holder);

  const models = new ModelLoader();
  let currentId: string | null = null; // what's requested (guards async races)
  let framed: THREE.Object3D | null = null; // the object the camera is framed on (re-fit on resize)

  // Resources the portrait CREATES itself (placeholder blocks) — disposed when cleared. A loaded
  // model is a `clone(true)` of the loader's cached template and SHARES its geometry + materials, so
  // disposing those would corrupt the cache for every other consumer; such clones are only removed.
  const ownedRoots = new Set<THREE.Object3D>();

  // One reusable flat-grey material — the "ghost" / build-target look. Applied by reference to a
  // loaded model's meshes (never disposed per-clear since it's shared across ghost renders); freed
  // once in dispose().
  let ghostMaterial: THREE.MeshStandardMaterial | null = null;
  function getGhostMaterial(): THREE.MeshStandardMaterial {
    return (ghostMaterial ??= new THREE.MeshStandardMaterial({
      color: 0x6b7077,
      roughness: 0.9,
      metalness: 0.0,
    }));
  }
  function applyGhost(obj: THREE.Object3D): void {
    const mat = getGhostMaterial();
    obj.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (mesh.isMesh) mesh.material = mat;
    });
  }

  function clearHolder(): void {
    for (const child of [...holder.children]) {
      holder.remove(child);
      if (ownedRoots.has(child)) {
        disposeObject(child); // only placeholders we built; model clones share cache resources
        ownedRoots.delete(child);
      }
    }
  }

  /**
   * Frame the orbit camera on an object's bounds so any size of asset sits fully in view with a
   * little breathing room. Accounts for BOTH the vertical and horizontal FOV (the horizontal one is
   * the tighter constraint in a narrow/tall pane), so a wide part never spills past the edges, and
   * pads the distance a touch so it's never edge-to-edge. Re-run on resize since the aspect changes.
   */
  function frame(obj: THREE.Object3D): void {
    framed = obj;
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z) * 0.5 || 1;
    const vFov = (camera.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * Math.max(camera.aspect, 0.0001));
    const fit = Math.max(radius / Math.sin(vFov / 2), radius / Math.sin(hFov / 2));
    const dist = fit * 1.25 + radius; // 1.25 = padding so the part isn't cropped to the frame
    controls.target.copy(center);
    camera.position
      .copy(center)
      .add(new THREE.Vector3(1, 0.75, 1.15).normalize().multiplyScalar(dist));
    controls.update();
  }

  /** A neutral placeholder block, shown when an asset is missing or fails to load. */
  function placeholder(color: number): THREE.Object3D {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.9, 0.9),
      new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.25 }),
    );
    mesh.position.y = 0.5;
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(mesh.geometry),
      new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }),
    );
    mesh.add(edges);
    return mesh;
  }

  function show(assetId: string | null, opts?: { fallbackColor?: number; ghost?: boolean }): void {
    currentId = assetId;
    framed = null;
    clearHolder();
    if (assetId === null) return;

    const ghost = opts?.ghost ?? false;
    // While ghosting, the placeholder block uses the ghost grey too, so a missing asset still reads
    // as a silhouette rather than a coloured box.
    const fallbackColor = ghost ? 0x6b7077 : (opts?.fallbackColor ?? 0x6b6b6b); // scrap_grey default

    const showPlaceholder = (): void => {
      const block = placeholder(fallbackColor);
      ownedRoots.add(block);
      holder.add(block);
      frame(block);
    };

    // Unregistered id → straight to the placeholder (the part GLBs aren't registered yet in MW).
    if (!(assetId in MODEL_ASSETS)) {
      showPlaceholder();
      return;
    }

    models
      .load(assetId)
      .then((template) => {
        if (currentId !== assetId) return; // a newer selection won the race
        const obj = template.clone(true);
        if (ghost) applyGhost(obj); // flat-grey build-target silhouette
        holder.add(obj);
        frame(obj);
      })
      .catch(() => {
        if (currentId !== assetId) return;
        showPlaceholder();
      });
  }

  return { show, resize: cv.resize, start: cv.start, stop: cv.stop, dispose: cv.dispose };
}
