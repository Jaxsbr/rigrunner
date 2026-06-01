import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * The shared scaffolding for a self-contained three.js widget that renders into its own canvas
 * inside a host element — a scene + camera + renderer + `OrbitControls` + a standard three-light rig
 * + a start/stop render loop + resize/dispose plumbing. It owns NO content: callers add their own
 * objects to `scene` and frame `camera` however they like. It exists so the page's small 3D widgets
 * (the part `model-portrait`, the `deck-view` staging deck, and any future one) don't each re-fork
 * the same canvas/renderer/lights/loop boilerplate — that drift is what this consolidates.
 *
 * Each widget coexists with the others and with the game's main canvas: separate scene, separate
 * loop, no shared GL state. `start()` after the host is visible, `stop()` when hidden (so a hidden
 * widget burns no frames), `dispose()` on teardown.
 *
 * The light rig (ambient + key + fill) is fixed and identical across widgets on purpose: a part must
 * read the SAME here as it does in-game and in the viewer, so the lighting is not a per-widget knob.
 */
export interface ThreeCanvas {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly controls: OrbitControls;
  readonly canvas: HTMLCanvasElement;
  /** Re-read the host's size and resize the renderer/camera — call after the host becomes visible. */
  resize(): void;
  /** Begin the render loop. Idempotent. */
  start(): void;
  /** Pause the render loop. Idempotent. */
  stop(): void;
  /** Tear down the loop, controls, renderer and canvas. Runs `onDispose` first to free widget state. */
  dispose(): void;
}

export interface ThreeCanvasOptions {
  fov?: number; // vertical FOV (default 45)
  near?: number; // default 0.05
  far?: number; // default 500
  autoRotate?: boolean; // orbit auto-spin (default false)
  autoRotateSpeed?: number; // default 1.6
  /** Called after each resize (camera aspect already updated) — e.g. to re-fit framing. */
  onResize?: () => void;
  /** Called at the start of dispose, before controls/renderer/canvas are torn down — free GPU state. */
  onDispose?: () => void;
}

/** Create a three.js widget host: canvas appended to `host`, with a lit scene + orbit camera + loop. */
export function createThreeCanvas(host: HTMLElement, opts: ThreeCanvasOptions = {}): ThreeCanvas {
  const canvas = document.createElement('canvas');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  canvas.style.touchAction = 'none'; // let OrbitControls own drag gestures
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(opts.fov ?? 45, 1, opts.near ?? 0.05, opts.far ?? 500);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.autoRotate = opts.autoRotate ?? false;
  controls.autoRotateSpeed = opts.autoRotateSpeed ?? 1.6;

  // Standard three-light rig — ambient base + a key sun + a soft fill, matching the viewer so a part
  // reads identically across every widget.
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(5, 10, 7);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffffff, 0.25);
  fill.position.set(-6, 4, -5);
  scene.add(fill);

  let running = false;
  let rafId = 0;

  function resize(): void {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (w === 0 || h === 0) return; // host not laid out yet (e.g. still hidden)
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    opts.onResize?.();
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
    opts.onDispose?.();
    controls.dispose();
    renderer.dispose();
    canvas.remove();
  }

  return { scene, camera, renderer, controls, canvas, resize, start, stop, dispose };
}

/**
 * Dispose the geometry + material(s) of every mesh under `obj` — the GPU-resource cleanup a widget
 * runs on objects IT created (placeholder blocks, highlight slabs). Never call it on a `clone(true)`
 * of a cached `ModelLoader` template: such clones share their geometry + materials with the cache,
 * so disposing those would corrupt every other consumer — those clones are only removed, not freed.
 */
export function disposeObject(obj: THREE.Object3D): void {
  obj.traverse?.((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.geometry?.dispose();
      const mat = mesh.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose();
    }
  });
}
