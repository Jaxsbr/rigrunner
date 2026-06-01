import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ModelLoader } from './model-loader';
import { MODEL_ASSETS } from './assets';

/**
 * A small, self-contained turntable preview of a single GLB — the rotatable "portrait" the workshop
 * shows for the selected part. It owns its own canvas, scene, camera, lights, `OrbitControls`
 * (gentle auto-rotate + drag-to-spin) and render loop, so it can coexist with another live scene on
 * the page (e.g. the game's frozen main canvas) without sharing any state.
 *
 * Extracted from the asset viewer's preview core (`viewer/src/main.ts`) so the two don't fork: the
 * framing, lighting, and turntable feel live here once. Generic on purpose — it knows only an
 * `assetId` (resolved through the shared `MODEL_ASSETS` registry + `ModelLoader`). When an asset is
 * unregistered or fails to load, it shows a neutral placeholder block (optionally tinted by the
 * caller) so the widget is always populated — the part GLBs don't exist yet in milestone MW, so the
 * placeholder is what the player actually sees until real assets land.
 */
export interface ModelPortrait {
  /** Swap the displayed model. `null` clears it. `fallbackColor` tints the placeholder block. */
  show(assetId: string | null, opts?: { fallbackColor?: number }): void;
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
  const canvas = document.createElement('canvas');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  canvas.style.touchAction = 'none'; // let OrbitControls own drag gestures
  host.appendChild(canvas);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 500);
  camera.position.set(2.4, 1.9, 2.8);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.autoRotate = opts.autoRotate ?? false;
  controls.autoRotateSpeed = 1.6;
  controls.target.set(0, 0.5, 0);

  // Lighting mirrors the viewer so a part reads the same here as it would in-game.
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(5, 10, 7);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffffff, 0.25);
  fill.position.set(-6, 4, -5);
  scene.add(fill);

  const holder = new THREE.Group(); // the currently-displayed model/placeholder lives here
  scene.add(holder);

  const models = new ModelLoader();
  let currentId: string | null = null; // what's requested (guards async races)
  let framed: THREE.Object3D | null = null; // the object the camera is framed on (re-fit on resize)
  let running = false;
  let rafId = 0;

  function clearHolder(): void {
    for (const child of [...holder.children]) {
      holder.remove(child);
      child.traverse?.((node) => {
        const mesh = node as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry?.dispose();
          const mat = mesh.material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat?.dispose();
        }
      });
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

  function show(assetId: string | null, opts?: { fallbackColor?: number }): void {
    currentId = assetId;
    framed = null;
    clearHolder();
    if (assetId === null) return;

    const fallbackColor = opts?.fallbackColor ?? 0x6b6b6b; // scrap_grey by default

    // Unregistered id → straight to the placeholder (the part GLBs aren't registered yet in MW).
    if (!(assetId in MODEL_ASSETS)) {
      const block = placeholder(fallbackColor);
      holder.add(block);
      frame(block);
      return;
    }

    models
      .load(assetId)
      .then((template) => {
        if (currentId !== assetId) return; // a newer selection won the race
        const obj = template.clone(true);
        holder.add(obj);
        frame(obj);
      })
      .catch(() => {
        if (currentId !== assetId) return;
        const block = placeholder(fallbackColor);
        holder.add(block);
        frame(block);
      });
  }

  function resize(): void {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (w === 0 || h === 0) return; // host not laid out yet (e.g. still hidden)
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (framed) frame(framed); // the tighter FOV dimension changed — re-fit so nothing crops
  }

  function tick(): void {
    if (!running) return;
    controls.update();
    renderer.render(scene, camera);
    rafId = requestAnimationFrame(tick);
  }

  function start(): void {
    if (running) return;
    running = true;
    resize();
    rafId = requestAnimationFrame(tick);
  }

  function stop(): void {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function dispose(): void {
    stop();
    clearHolder();
    controls.dispose();
    renderer.dispose();
    canvas.remove();
  }

  return { show, resize, start, stop, dispose };
}
