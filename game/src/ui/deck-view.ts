import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ModelLoader } from '../../../shared/model-loader';
import { MODEL_ASSETS } from '../../../shared/assets';
import type { EntityId } from '../core/types';
import { cellLocalOffset } from '../systems/mounting';

/**
 * A live 3D view of the workshop deck and the products staged on it — the centrepiece of the
 * workshop interface's "Workshop Deck" tab. It mirrors the real workshop entity: the workshop GLB at
 * the origin, plus every part mounted on its grid drawn at its cell pose. It is a PROJECTION — the
 * overlay hands it a snapshot of world state (`render`) and it draws it; it never mutates the world.
 *
 * Unlike `shared/model-portrait` (a single-GLB turntable), this composes several models into one
 * deck-local scene and supports the staging interactions: `localPointAt` raycasts the cursor onto
 * the deck plane (so the overlay can resolve the nearest free cell while dragging a product in),
 * `highlight` shows where a drop will land, and a clean click on a staged product reports it through
 * `onSelect` (so the player can inspect / unstage / dismantle it). It owns its own canvas, camera,
 * lights, `OrbitControls` (drag-to-orbit, auto-rotate off — it's a workspace, not a showcase) and
 * render loop, coexisting with the frozen main scene and the inspect portrait.
 *
 * Deck-local frame: the workshop sits at the origin with no rotation, so a cell's position is just
 * its `cellLocalOffset` (lx → x, lz → z) at the deck height — the same frame the raycast returns, so
 * cursor → cell math needs no world-transform round-trip.
 */
export interface DeckGrid {
  cols: number;
  rows: number;
  cellSize: number;
  deckY: number;
}

export interface DeckPart {
  entity: EntityId;
  assetId: string;
  col: number;
  row: number;
  yaw: number;
}

export interface DeckSnapshot {
  workshopAssetId: string;
  grid: DeckGrid;
  parts: readonly DeckPart[];
  /** The currently-selected staged product (highlighted), or null. */
  selected: EntityId | null;
}

export interface DeckView {
  /** Rebuild the rendered deck from a world-state snapshot. */
  render(snapshot: DeckSnapshot): void;
  /** Raycast a screen point onto the deck plane → deck-local {lx, lz}, or null if it misses. */
  localPointAt(clientX: number, clientY: number): { lx: number; lz: number } | null;
  /** Show a drop highlight on a cell (green when ok, rust when refused), or clear with null. */
  highlight(cell: { col: number; row: number } | null, ok?: boolean): void;
  resize(): void;
  start(): void;
  stop(): void;
  dispose(): void;
}

export interface DeckViewOptions {
  /** Fired on a clean click: the staged product entity hit, or null when empty deck was clicked. */
  onSelect(entity: EntityId | null): void;
}

const CLICK_THRESHOLD = 4; // px of pointer travel below which a press counts as a click (vs an orbit)

export function createDeckView(host: HTMLElement, opts: DeckViewOptions): DeckView {
  const canvas = document.createElement('canvas');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  canvas.style.touchAction = 'none';
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 500);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.autoRotate = false;

  // Lighting mirrors the portrait/viewer so a staged part reads the same here as in-game.
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(5, 10, 7);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffffff, 0.25);
  fill.position.set(-6, 4, -5);
  scene.add(fill);

  const holder = new THREE.Group(); // workshop + staged-part models live here, rebuilt per render
  scene.add(holder);

  // Drop/selection highlight — one reusable thin slab repositioned over the target cell.
  const highlightMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.35, depthWrite: false });
  const highlightMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.06, 1), highlightMat);
  highlightMesh.visible = false;
  scene.add(highlightMesh);

  const models = new ModelLoader();
  const ownedRoots = new Set<THREE.Object3D>(); // placeholders WE built (disposed); GLB clones share cache
  let token = 0; // bumped each render() so a late async load from a stale snapshot is dropped
  let grid: DeckGrid = { cols: 3, rows: 3, cellSize: 1, deckY: 0.2 };
  let framed = false;
  let running = false;
  let rafId = 0;

  function cellCenter(col: number, row: number): { x: number; z: number } {
    const off = cellLocalOffset(grid, col, row);
    return { x: off.lx, z: off.lz };
  }

  function disposeObject(obj: THREE.Object3D): void {
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

  function clearHolder(): void {
    for (const child of [...holder.children]) {
      holder.remove(child);
      if (ownedRoots.has(child)) {
        disposeObject(child);
        ownedRoots.delete(child);
      }
    }
  }

  /** A neutral placeholder block for a model that's missing or still loading. */
  function placeholder(size: number, color: number): THREE.Object3D {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size, size, size),
      new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.2 }),
    );
    mesh.position.y = size / 2;
    return mesh;
  }

  /** Add a model (or placeholder) at a deck position, tagging it with its entity for picking. */
  function addModel(assetId: string, x: number, y: number, z: number, yaw = 0, entity?: EntityId): void {
    const myToken = token;
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = yaw;
    if (entity !== undefined) group.userData['entity'] = entity;
    holder.add(group);

    if (!(assetId in MODEL_ASSETS)) {
      const block = placeholder(0.7, 0x6b6b6b);
      ownedRoots.add(block);
      group.add(block);
      return;
    }
    models
      .load(assetId)
      .then((template) => {
        if (myToken !== token) return; // a newer render() superseded this
        group.add(template.clone(true));
      })
      .catch(() => {
        if (myToken !== token) return;
        const block = placeholder(0.7, 0x6b6b6b);
        ownedRoots.add(block);
        group.add(block);
      });
  }

  /** Frame the orbit camera on the whole deck — angled top-down, like the in-world workshop shot. */
  function frame(): void {
    const extent = Math.max(grid.cols, grid.rows) * grid.cellSize;
    const center = new THREE.Vector3(0, grid.deckY, 0);
    const dist = extent * 1.9 + 1.5;
    controls.target.copy(center);
    camera.position.copy(center).add(new THREE.Vector3(0.55, 1.0, 0.85).normalize().multiplyScalar(dist));
    controls.update();
    framed = true;
  }

  function render(snapshot: DeckSnapshot): void {
    token++;
    grid = snapshot.grid;
    clearHolder();

    addModel(snapshot.workshopAssetId, 0, 0, 0); // the deck itself, at the origin
    for (const p of snapshot.parts) {
      const c = cellCenter(p.col, p.row);
      addModel(p.assetId, c.x, grid.deckY, c.z, p.yaw, p.entity);
    }

    // Selected staged product → a soft blue highlight on its cell (distinct from the drop highlight).
    const sel = snapshot.selected;
    const selPart = sel !== null ? snapshot.parts.find((p) => p.entity === sel) : undefined;
    if (selPart) {
      const c = cellCenter(selPart.col, selPart.row);
      highlightMat.color.setHex(0x2f6f9f);
      highlightMesh.scale.set(grid.cellSize, 1, grid.cellSize);
      highlightMesh.position.set(c.x, grid.deckY + 0.04, c.z);
      highlightMesh.visible = true;
    } else {
      highlightMesh.visible = false;
    }

    if (!framed) frame();
  }

  function highlight(cell: { col: number; row: number } | null, ok = true): void {
    if (!cell) {
      highlightMesh.visible = false;
      return;
    }
    const c = cellCenter(cell.col, cell.row);
    highlightMat.color.setHex(ok ? 0x59ff9f : 0x8a4b2f);
    highlightMesh.scale.set(grid.cellSize, 1, grid.cellSize);
    highlightMesh.position.set(c.x, grid.deckY + 0.04, c.z);
    highlightMesh.visible = true;
  }

  // ── Raycasting: deck plane (for drop targeting) and part picking (for selection) ──────────────
  const raycaster = new THREE.Raycaster();
  const deckPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // y = deckY, set per-call

  function ndc(clientX: number, clientY: number): THREE.Vector2 | null {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
  }

  function localPointAt(clientX: number, clientY: number): { lx: number; lz: number } | null {
    const p = ndc(clientX, clientY);
    if (!p) return null;
    raycaster.setFromCamera(p, camera);
    deckPlane.constant = -grid.deckY; // plane y = deckY
    const hit = raycaster.ray.intersectPlane(deckPlane, new THREE.Vector3());
    return hit ? { lx: hit.x, lz: hit.z } : null;
  }

  /** The staged-product entity under a screen point, or null — walks up to the entity-tagged group. */
  function pickEntity(clientX: number, clientY: number): EntityId | null {
    const p = ndc(clientX, clientY);
    if (!p) return null;
    raycaster.setFromCamera(p, camera);
    for (const hit of raycaster.intersectObjects(holder.children, true)) {
      let o: THREE.Object3D | null = hit.object;
      while (o) {
        const e = o.userData['entity'];
        if (typeof e === 'number') return e;
        o = o.parent;
      }
    }
    return null;
  }

  // Click-vs-orbit: OrbitControls handles drags; a press that barely moves is a selection click.
  let downX = 0;
  let downY = 0;
  let downValid = false;
  const onDown = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    downX = e.clientX;
    downY = e.clientY;
    downValid = true;
  };
  const onUp = (e: PointerEvent): void => {
    if (e.button !== 0 || !downValid) return;
    downValid = false;
    if (Math.hypot(e.clientX - downX, e.clientY - downY) >= CLICK_THRESHOLD) return; // it was an orbit
    opts.onSelect(pickEntity(e.clientX, e.clientY));
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);

  function resize(): void {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
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
    highlightMesh.geometry.dispose();
    highlightMat.dispose();
    controls.dispose();
    renderer.dispose();
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointerup', onUp);
    canvas.remove();
  }

  return { render, localPointAt, highlight, resize, start, stop, dispose };
}
