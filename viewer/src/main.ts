import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ModelLoader } from '../../shared/model-loader';
import { MODEL_ASSETS } from '../../shared/assets';
import paletteData from '../../shared/palette.json';

/**
 * RIGRUNNER asset viewer — a standalone tool to inspect any registered GLB in isolation,
 * outside the game. Reads the SAME registry, model loader, and palette the game uses
 * (`shared/`), so what you see here is exactly what the game would render.
 *
 * Two tabs: "Assets" (pick a model → turntable preview) and "Palette" (the project swatches).
 */

type PaletteEntry = { hex: string; use: string; emissive?: boolean };
const palette = paletteData as Record<string, PaletteEntry>;

// ── Three.js stage ────────────────────────────────────────────────────────────────────
const canvas = document.querySelector<HTMLCanvasElement>('#view')!;
const stage = document.querySelector<HTMLElement>('#stage')!;
const hud = document.querySelector<HTMLElement>('#hud')!;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a);

const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 500);
camera.position.set(3, 2.4, 3.6);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.autoRotate = true;
controls.autoRotateSpeed = 1.6;
controls.target.set(0, 0.5, 0);

scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const sun = new THREE.DirectionalLight(0xffffff, 0.9);
sun.position.set(5, 10, 7);
scene.add(sun);
const fill = new THREE.DirectionalLight(0xffffff, 0.25);
fill.position.set(-6, 4, -5);
scene.add(fill);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 40),
  new THREE.MeshStandardMaterial({ color: 0x2b2b2b }),
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
scene.add(new THREE.GridHelper(40, 40, 0x444444, 0x333333));

// A forward marker (-Z = "forward in-game": Blender +Y → -Z after export; movement.ts drives
// along -z) so facing is legible.
const forward = new THREE.ArrowHelper(
  new THREE.Vector3(0, 0, -1),
  new THREE.Vector3(0, 0.02, 0),
  2.2,
  0x59ff9f, // glow_green
  0.4,
  0.25,
);
scene.add(forward);

const holder = new THREE.Group(); // the currently-displayed model lives here
scene.add(holder);

const models = new ModelLoader();
let currentId: string | null = null;

function resize(): void {
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h || 1;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

function clearHolder(): void {
  for (const child of [...holder.children]) holder.remove(child);
}

function countTris(obj: THREE.Object3D): number {
  let tris = 0;
  obj.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.isMesh && mesh.geometry) {
      const g = mesh.geometry as THREE.BufferGeometry;
      tris += g.index ? g.index.count / 3 : g.attributes['position'].count / 3;
    }
  });
  return Math.round(tris);
}

/** Frame the orbit camera on an object's bounds so any size of asset fills the view nicely. */
function frame(obj: THREE.Object3D): { size: THREE.Vector3 } {
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z) * 0.5 || 1;
  const dist = radius / Math.sin((camera.fov * Math.PI) / 180 / 2) + radius;
  controls.target.copy(center);
  camera.position.copy(center).add(new THREE.Vector3(1, 0.75, 1.15).normalize().multiplyScalar(dist));
  controls.update();
  forward.setLength(Math.max(size.z, radius) + 0.8, 0.4, 0.25);
  return { size };
}

async function select(assetId: string): Promise<void> {
  currentId = assetId;
  document.querySelectorAll('.item').forEach((el) =>
    el.classList.toggle('active', (el as HTMLElement).dataset['id'] === assetId),
  );
  hud.innerHTML = `<b>${assetId}</b> — loading…`;
  clearHolder();
  try {
    const template = await models.load(assetId);
    if (currentId !== assetId) return; // a newer selection won the race
    const obj = template.clone(true);
    holder.add(obj);
    const { size } = frame(obj);
    hud.innerHTML =
      `<b>${assetId}</b> &nbsp; ${size.x.toFixed(2)}×${size.y.toFixed(2)}×${size.z.toFixed(2)} m` +
      ` &nbsp; ${countTris(obj).toLocaleString()} tris`;
  } catch (err) {
    hud.innerHTML = `<b>${assetId}</b> — failed to load (see console)`;
    console.error(err);
  }
}

// ── Sidebar: asset list ─────────────────────────────────────────────────────────────────
const assetPane = document.querySelector<HTMLElement>('#pane-assets')!;
const ids = Object.keys(MODEL_ASSETS).sort();
if (ids.length === 0) {
  assetPane.innerHTML = `<div class="empty">No assets registered yet.<br>Add one with the blender-asset skill.</div>`;
} else {
  for (const id of ids) {
    const row = document.createElement('div');
    row.className = 'item';
    row.dataset['id'] = id;
    row.innerHTML = `<span class="id">${id}</span>`;
    row.addEventListener('click', () => void select(id));
    assetPane.appendChild(row);
  }
}

// ── Sidebar: palette swatches ───────────────────────────────────────────────────────────
const palettePane = document.querySelector<HTMLElement>('#pane-palette')!;
for (const [name, entry] of Object.entries(palette)) {
  const row = document.createElement('div');
  row.className = 'swatch';
  row.innerHTML =
    `<span class="chip" style="background:${entry.hex}"></span>` +
    `<span class="meta">` +
    `<div class="name">${name}${entry.emissive ? ' <span class="em">(emissive)</span>' : ''}</div>` +
    `<div class="use">${entry.use}</div>` +
    `</span>` +
    `<span class="hex">${entry.hex}</span>`;
  palettePane.appendChild(row);
}

// ── Tab switching ───────────────────────────────────────────────────────────────────────
document.querySelectorAll<HTMLButtonElement>('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    const pane = tab.dataset['pane'];
    assetPane.hidden = pane !== 'assets';
    palettePane.hidden = pane !== 'palette';
  });
});

// ── Render loop ─────────────────────────────────────────────────────────────────────────
function tick(): void {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

// Auto-select the first asset so the viewer isn't empty on open.
if (ids.length > 0) void select(ids[0]!);
