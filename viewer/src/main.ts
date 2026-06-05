import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ModelLoader } from '../../shared/model-loader';
import { MODEL_ASSETS } from '../../shared/assets';
import { tintModel } from '../../shared/model-tint';
import {
  TIERS,
  tierOf,
  DEFAULT_TIER,
  type TierId,
  PART_IDENTITIES,
  type PartIdentity,
  partIdentity,
  PRODUCT_GROUPS,
  productGroup,
  type ProductGroup,
} from '../../shared/part-identity';
import paletteData from '../../shared/palette.json';
import { ReclaimerRig, isArticulated } from './articulation';

/**
 * RIGRUNNER asset viewer — a standalone tool to inspect the game's assets in isolation, outside the
 * game. It reads the SAME registry, model loader, palette, and part-identity roster the game uses
 * (`shared/`), so what you see here is exactly what the game would render.
 *
 * Three tabs:
 *  - "Parts"   — the Phase-1.5 verification surface (`docs/part-identity-spec.md`). Inspect any
 *                sub-part at any tier, or compose a product from a freely-chosen tier-per-sub-part
 *                mix and view it as a whole. The tier pickers are driven by the TIERS data, so they
 *                gain a row automatically as tiers are added. Unmodelled sub-parts show a tinted
 *                placeholder block (flagged "no model") — exactly what the coverage check fails on.
 *  - "Assets"  — every registered GLB on its own (turntable preview), the raw-asset view.
 *  - "Palette" — the project colour swatches.
 *
 * It is built to be SCRIPTED, not just clicked: the URL hash addresses an exact view
 * (`#part=e-core&tier=iron`, `#product=steam-engine&tiers=s-boiler:rusty,...`, or `#<assetId>`), and
 * `window.__viewer` exposes the catalog, programmatic selection, a `settled()` promise, and a `state()`
 * snapshot (per-rendered-asset: real-model-or-placeholder, tris, plus a sampled dominant-palette
 * signature) — the hooks an agent/Playwright drives to baseline and check each part×tier.
 */

type PaletteEntry = { hex: string; use: string; emissive?: boolean };
const palette = paletteData as Record<string, PaletteEntry>;

// ── Three.js stage ────────────────────────────────────────────────────────────────────
const canvas = document.querySelector<HTMLCanvasElement>('#view')!;
const stage = document.querySelector<HTMLElement>('#stage')!;
const hud = document.querySelector<HTMLElement>('#hud')!;
const partctl = document.querySelector<HTMLElement>('#partctl')!;

const scene = new THREE.Scene();
const BG_COLOR = 0x1a1a1a;
scene.background = new THREE.Color(BG_COLOR);

const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 500);
camera.position.set(3, 2.4, 3.6);

// preserveDrawingBuffer so the canvas can be sampled (the dominant-palette signature) after a render.
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
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
const grid = new THREE.GridHelper(40, 40, 0x444444, 0x333333);
scene.add(grid);

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

const holder = new THREE.Group(); // the currently-displayed model(s) live here
scene.add(holder);

const models = new ModelLoader();

// The scene helpers hidden while sampling the dominant-palette signature, so the signal is the
// part(s) alone — not the ground/grid/forward arrow filling most of the frame.
const sceneHelpers: THREE.Object3D[] = [ground, grid, forward];

// ── What's on stage right now (drives the scripting hook's state()) ──────────────────────
type ViewMode = 'asset' | 'part' | 'product';
interface RenderedItem {
  assetId: string;
  tier: TierId | null; // null in asset mode (a raw GLB carries no tier)
  isRealModel: boolean; // a registered GLB loaded, vs. a stand-in placeholder block
  tris: number;
}
let mode: ViewMode = 'part';
let viewId = ''; // the part id, product-group id, or asset id currently shown
let rendered: RenderedItem[] = [];
let pedestalRef: THREE.Mesh | null = null; // a stand the articulated arm is raised onto

// A monotonically-increasing token so a slow load that has been superseded can bail out.
let token = 0;
// Resolves when the latest selection has finished loading + rendered a frame (the scripting hook).
let currentLoad: Promise<void> = Promise.resolve();

// ── Articulation playback (asset-mode Reclaimer dig demo) ────────────────────────────────
const clock = new THREE.Clock();
let rig: ReclaimerRig | null = null; // non-null only while an articulated asset ANIMATES (asset mode)
type ArmState = 'dig' | 'stow';
let armState: ArmState = 'dig';
let rigElapsed = 0;

/** A plain stand the arm sits on so its dig swings into free space instead of through the floor. */
function makePedestal(height: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, height, 0.85),
    new THREE.MeshStandardMaterial({ color: 0x2f3133, roughness: 0.8 }), // dark_metal
  );
  mesh.position.y = height / 2;
  return mesh;
}

/** Lift an object so its lowest point rests on the floor (y=0). Fixes attach-pivot heads (the bucket)
 *  whose body hangs below their origin; a no-op for base-centre assets. */
function restOnFloor(obj: THREE.Object3D): void {
  const minY = new THREE.Box3().setFromObject(obj).min.y;
  if (minY < -1e-4) obj.position.y -= minY;
}

// The asset-mode dig/stow control, shown only while an articulated asset is selected on the Assets tab.
const animBar = document.createElement('div');
animBar.id = 'animbar';
animBar.hidden = true;
const digBtn = document.createElement('button');
digBtn.className = 'animbtn';
digBtn.textContent = '⛏ Dig';
const stowBtn = document.createElement('button');
stowBtn.className = 'animbtn';
stowBtn.textContent = '↗ Stow';
animBar.append(digBtn, stowBtn);
stage.appendChild(animBar);

function setArmState(state: ArmState): void {
  armState = state;
  digBtn.classList.toggle('on', state === 'dig');
  stowBtn.classList.toggle('on', state === 'stow');
  if (!rig) return;
  if (state === 'stow') {
    rig.stow();
  } else {
    rigElapsed = 0;
    clock.getDelta();
  }
}
digBtn.addEventListener('click', () => setArmState('dig'));
stowBtn.addEventListener('click', () => setArmState('stow'));

/** Tear down any active animating rig and restore the default turntable behaviour. */
function clearRig(): void {
  rig = null;
  if (pedestalRef) {
    pedestalRef.geometry.dispose();
    (pedestalRef.material as THREE.Material).dispose();
    pedestalRef = null;
  }
  animBar.hidden = true;
  controls.autoRotate = true;
}

function resize(): void {
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h || 1;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

function clearStage(): void {
  for (const child of [...holder.children]) holder.remove(child);
  clearRig();
  rendered = [];
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

/** Frame the orbit camera on an object's bounds so any size of display fills the view nicely. */
function frame(obj: THREE.Object3D): THREE.Vector3 {
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z) * 0.5 || 1;
  const dist = radius / Math.sin((camera.fov * Math.PI) / 180 / 2) + radius;
  controls.target.copy(center);
  camera.position.copy(center).add(new THREE.Vector3(1, 0.75, 1.15).normalize().multiplyScalar(dist));
  controls.update();
  forward.setLength(Math.max(size.z, radius) + 0.8, 0.4, 0.25);
  return size;
}

/** A neutral ~1m placeholder block (with edges), shown for a sub-part that has no model yet. */
function makePlaceholder(): THREE.Object3D {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.9, 0.9),
    new THREE.MeshStandardMaterial({ color: 0x6b7077, roughness: 0.6, metalness: 0.2 }), // scrap-grey
  );
  mesh.position.y = 0.45;
  mesh.add(
    new THREE.LineSegments(
      new THREE.EdgesGeometry(mesh.geometry),
      new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }),
    ),
  );
  return mesh;
}

/**
 * Load a sub-part's model, washed toward its tier finish; fall back to a tinted placeholder block when
 * the asset isn't registered (or fails to load) — so an unmodelled part still reads as itself's grade.
 * Returns the object, whether it's a real GLB, and its triangle count.
 */
async function loadGraded(
  assetId: string,
  tier: TierId | null,
): Promise<{ obj: THREE.Object3D; isRealModel: boolean; tris: number }> {
  const tint = tier !== null ? tierOf(tier).finishColor : undefined;
  if (assetId in MODEL_ASSETS) {
    try {
      const obj = (await models.load(assetId)).clone(true);
      if (tint !== undefined) tintModel(obj, tint);
      return { obj, isRealModel: true, tris: countTris(obj) };
    } catch (err) {
      console.error(`failed to load '${assetId}', using placeholder`, err);
    }
  }
  const ph = makePlaceholder();
  if (tint !== undefined) tintModel(ph, tint);
  return { obj: ph, isRealModel: false, tris: 0 };
}

/** Lay objects out left→right on the floor, centred about the origin — the provisional compose layout
 *  (real per-product placement is Phase 2b; this is enough for spacing/cohesion feedback). */
function arrangeRow(objs: THREE.Object3D[], gap = 0.4): void {
  const widths = objs.map((o) => new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3()).x || 1);
  const total = widths.reduce((a, b) => a + b, 0) + gap * Math.max(0, objs.length - 1);
  let x = -total / 2;
  objs.forEach((o, i) => {
    const box = new THREE.Box3().setFromObject(o);
    const cx = box.getCenter(new THREE.Vector3()).x;
    o.position.x += x + widths[i]! / 2 - cx; // slide its centre to this slot's centre
    x += widths[i]! + gap;
    restOnFloor(o);
  });
}

// ── Selection entry points (also the scripting hook's programmatic API) ───────────────────

/** Begin a selection: bump the token (so stale loads bail), clear the stage, return this token. */
function beginSelect(): number {
  const t = ++token;
  clearStage();
  return t;
}

/** Finish a selection: frame, render one frame (so the buffer is sampleable), sync sidebar + hash. */
function finishSelect(): void {
  frame(holder);
  renderer.render(scene, camera);
  syncSidebar();
}

/** Show one raw GLB on its own (the Assets tab) — the original turntable behaviour, incl. articulation. */
async function selectAsset(assetId: string): Promise<void> {
  const t = beginSelect();
  mode = 'asset';
  viewId = assetId;
  partctl.hidden = true;
  hud.innerHTML = `<b>${assetId}</b> — loading…`;
  try {
    const template = await models.load(assetId);
    if (t !== token) return;
    const obj = template.clone(true);
    holder.add(obj);

    if (isArticulated(assetId)) {
      const bucket = (await models.load('reclaimer-bucket')).clone(true);
      if (t !== token) return;
      rig = new ReclaimerRig(obj, bucket);
      const dip = rig.measureDip();
      const lift = dip < 0 ? -dip + 0.05 : 0;
      if (lift > 0) {
        obj.position.y += lift;
        pedestalRef = makePedestal(lift);
        holder.add(pedestalRef);
      }
      controls.autoRotate = false;
      animBar.hidden = false;
      setArmState('dig');
    } else {
      restOnFloor(obj);
    }

    rendered = [{ assetId, tier: null, isRealModel: true, tris: countTris(obj) }];
    finishSelect();
    const size = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
    hud.innerHTML =
      `<b>${assetId}</b> &nbsp; ${size.x.toFixed(2)}×${size.y.toFixed(2)}×${size.z.toFixed(2)} m` +
      ` &nbsp; ${countTris(obj).toLocaleString()} tris` +
      (rig ? ` &nbsp; <span class="artic">articulated</span>` : '');
  } catch (err) {
    if (t !== token) return;
    hud.innerHTML = `<b>${assetId}</b> — failed to load (see console)`;
    console.error(err);
  }
}

/** Show a single sub-part at one tier (the Parts tab → a sub-part). */
async function selectPart(id: string, tier: TierId): Promise<void> {
  const ident = partIdentity(id);
  if (!ident) return selectAsset(id); // unknown id → best-effort raw asset
  const t = beginSelect();
  mode = 'part';
  viewId = id;
  hud.innerHTML = `<b>${ident.displayName}</b> — loading…`;
  const { obj, isRealModel, tris } = await loadGraded(ident.assetId, tier);
  if (t !== token) return;
  restOnFloor(obj);
  holder.add(obj);
  rendered = [{ assetId: ident.assetId, tier, isRealModel, tris }];
  renderPartCtl(ident, tier);
  finishSelect();
  setPartHud(ident, tier, obj, isRealModel);
}

/** Show a product composed from a tier-per-sub-part mix (the Parts tab → a product header). */
async function selectProduct(groupId: string, tiers: Map<string, TierId>): Promise<void> {
  const group = productGroup(groupId);
  if (!group) return;
  const t = beginSelect();
  mode = 'product';
  viewId = groupId;
  const members = group.subPartIds.map((sid) => partIdentity(sid)!).filter(Boolean);
  hud.innerHTML = `<b>${group.emoji} ${group.label}</b> — loading…`;

  // The Reclaimer is the one product whose sub-parts already compose physically: the bucket head rides
  // on the arm's wrist socket. Render it as that articulated whole (held static), each piece graded by
  // its own tier — the rest of the products lay their sub-parts out in a row until Phase 2b places them.
  if (groupId === 'reclaimer') {
    const armTier = tiers.get('reclaimer-arm') ?? DEFAULT_TIER;
    const headTier = tiers.get('reclaimer-bucket') ?? DEFAULT_TIER;
    const arm = await loadGraded('reclaimer-arm', armTier);
    const head = await loadGraded('reclaimer-bucket', headTier);
    if (t !== token) return;
    new ReclaimerRig(arm.obj, head.obj).stow(); // parents the head onto the socket + holds a static pose
    restOnFloor(arm.obj);
    holder.add(arm.obj);
    rendered = [
      { assetId: 'reclaimer-arm', tier: armTier, isRealModel: arm.isRealModel, tris: arm.tris },
      { assetId: 'reclaimer-bucket', tier: headTier, isRealModel: head.isRealModel, tris: head.tris },
    ];
  } else {
    const loaded = await Promise.all(
      members.map((m) => loadGraded(m.assetId, tiers.get(m.id) ?? DEFAULT_TIER)),
    );
    if (t !== token) return;
    arrangeRow(loaded.map((l) => l.obj));
    for (const l of loaded) holder.add(l.obj);
    rendered = members.map((m, i) => ({
      assetId: m.assetId,
      tier: tiers.get(m.id) ?? DEFAULT_TIER,
      isRealModel: loaded[i]!.isRealModel,
      tris: loaded[i]!.tris,
    }));
  }

  renderProductCtl(group, tiers);
  finishSelect();
  const missing = rendered.filter((r) => !r.isRealModel).length;
  hud.innerHTML =
    `<b>${group.emoji} ${group.label}</b> &nbsp; ${rendered.length} sub-parts` +
    ` &nbsp; ${rendered.reduce((a, r) => a + r.tris, 0).toLocaleString()} tris` +
    (missing ? ` &nbsp; <span class="artic">${missing} placeholder</span>` : '');
}

function setPartHud(ident: PartIdentity, tier: TierId, obj: THREE.Object3D, isRealModel: boolean): void {
  const size = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
  const grade = `${tierOf(tier).name} ${ident.displayName}`;
  hud.innerHTML =
    `<b>${grade}</b> &nbsp; ${size.x.toFixed(2)}×${size.y.toFixed(2)}×${size.z.toFixed(2)} m` +
    (isRealModel
      ? ` &nbsp; ${countTris(obj).toLocaleString()} tris`
      : ` &nbsp; <span class="artic">no model — placeholder</span>`);
}

// ── Tier-control overlay ──────────────────────────────────────────────────────────────────

/** A row of tier chips for one part; clicking a chip calls `onPick(tierId)`. */
function tierChips(active: TierId, onPick: (tier: TierId) => void): HTMLElement {
  const row = document.createElement('div');
  row.className = 'tiers';
  for (const tier of TIERS) {
    const chip = document.createElement('button');
    chip.className = 'tierchip' + (tier.id === active ? ' on' : '');
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = '#' + tier.finishColor.toString(16).padStart(6, '0');
    chip.append(dot, document.createTextNode(tier.name));
    chip.addEventListener('click', () => onPick(tier.id));
    row.appendChild(chip);
  }
  return row;
}

function renderPartCtl(ident: PartIdentity, tier: TierId): void {
  partctl.hidden = false;
  partctl.replaceChildren();
  const title = document.createElement('div');
  title.className = 'ctl-title';
  title.textContent = ident.displayName;
  const chips = tierChips(tier, (t) => void show({ mode: 'part', id: ident.id, tier: t }));
  partctl.append(title, chips);
}

function renderProductCtl(group: ProductGroup, tiers: Map<string, TierId>): void {
  partctl.hidden = false;
  partctl.replaceChildren();
  const title = document.createElement('div');
  title.className = 'ctl-title';
  title.textContent = `${group.emoji} ${group.label}`;
  partctl.append(title);
  for (const sid of group.subPartIds) {
    const ident = partIdentity(sid)!;
    const rowEl = document.createElement('div');
    rowEl.className = 'ctl-row';
    const label = document.createElement('span');
    label.className = 'ctl-label';
    label.textContent = ident.displayName;
    const chips = tierChips(tiers.get(sid) ?? DEFAULT_TIER, (t) => {
      const next = new Map(tiers);
      next.set(sid, t);
      void show({ mode: 'product', id: group.id, tiers: next });
    });
    rowEl.append(label, chips);
    partctl.appendChild(rowEl);
  }
}

// ── Sidebar ─────────────────────────────────────────────────────────────────────────────

const partsPane = document.querySelector<HTMLElement>('#pane-parts')!;
const assetPane = document.querySelector<HTMLElement>('#pane-assets')!;
const palettePane = document.querySelector<HTMLElement>('#pane-palette')!;

// Parts tab — products as collapsible-feeling groups: the header composes the whole, each sub-part row
// inspects one piece. Built once from the data; selection just toggles `.active` (see syncSidebar).
for (const group of PRODUCT_GROUPS) {
  const wrap = document.createElement('div');
  wrap.className = 'group';
  const head = document.createElement('div');
  head.className = 'group-head';
  head.dataset['group'] = group.id;
  head.innerHTML =
    `<span class="emoji">${group.emoji}</span><span>${group.label}</span>` +
    `<span class="compose">compose</span>`;
  head.addEventListener('click', () => void show({ mode: 'product', id: group.id, tiers: new Map() }));
  wrap.appendChild(head);
  for (const sid of group.subPartIds) {
    const ident = partIdentity(sid)!;
    const row = document.createElement('div');
    row.className = 'subpart';
    row.dataset['part'] = sid;
    const noModel = ident.assetId in MODEL_ASSETS ? '' : `<span class="nomodel">no model</span>`;
    row.innerHTML = `<span class="name">${ident.displayName}</span>${noModel}`;
    row.addEventListener('click', () => void show({ mode: 'part', id: sid, tier: DEFAULT_TIER }));
    wrap.appendChild(row);
  }
  partsPane.appendChild(wrap);
}

// Assets tab — every registered GLB on its own.
const assetIds = Object.keys(MODEL_ASSETS).sort();
for (const id of assetIds) {
  const row = document.createElement('div');
  row.className = 'item';
  row.dataset['id'] = id;
  row.innerHTML = `<span class="id">${id}</span>`;
  row.addEventListener('click', () => void show({ mode: 'asset', id }));
  assetPane.appendChild(row);
}

// Palette tab — the project swatches.
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

/** Reflect the current selection in the sidebar's active highlights. */
function syncSidebar(): void {
  partsPane.querySelectorAll('.group-head').forEach((el) =>
    el.classList.toggle('active', mode === 'product' && (el as HTMLElement).dataset['group'] === viewId),
  );
  partsPane.querySelectorAll('.subpart').forEach((el) =>
    el.classList.toggle('active', mode === 'part' && (el as HTMLElement).dataset['part'] === viewId),
  );
  assetPane.querySelectorAll('.item').forEach((el) =>
    el.classList.toggle('active', mode === 'asset' && (el as HTMLElement).dataset['id'] === viewId),
  );
}

// ── Tab switching ───────────────────────────────────────────────────────────────────────
function activateTab(pane: string): void {
  document.querySelectorAll('.tab').forEach((t) =>
    t.classList.toggle('active', (t as HTMLElement).dataset['pane'] === pane),
  );
  partsPane.hidden = pane !== 'parts';
  assetPane.hidden = pane !== 'assets';
  palettePane.hidden = pane !== 'palette';
}
document.querySelectorAll<HTMLButtonElement>('.tab').forEach((tab) => {
  tab.addEventListener('click', () => activateTab(tab.dataset['pane']!));
});

// ── Routing: the URL hash <-> a view, shareable and reloadable ────────────────────────────
type Route =
  | { mode: 'asset'; id: string }
  | { mode: 'part'; id: string; tier: TierId }
  | { mode: 'product'; id: string; tiers: Map<string, TierId> };

function parseTierList(raw: string | null): Map<string, TierId> {
  const map = new Map<string, TierId>();
  if (!raw) return map;
  for (const pair of raw.split(',')) {
    const [id, tier] = pair.split(':');
    if (id && tier) map.set(id, tier as TierId);
  }
  return map;
}

function routeToHash(route: Route): string {
  if (route.mode === 'part') return `part=${route.id}&tier=${route.tier}`;
  if (route.mode === 'product') {
    const group = productGroup(route.id);
    const pairs = (group?.subPartIds ?? [...route.tiers.keys()]).map(
      (sid) => `${sid}:${route.tiers.get(sid) ?? DEFAULT_TIER}`,
    );
    return `product=${route.id}&tiers=${pairs.join(',')}`;
  }
  return route.id;
}

function routeFromHash(): Route | null {
  const h = location.hash.slice(1);
  if (!h) return null;
  const params = new URLSearchParams(h);
  if (params.has('part')) {
    return { mode: 'part', id: params.get('part')!, tier: (params.get('tier') as TierId) || DEFAULT_TIER };
  }
  if (params.has('product')) {
    return { mode: 'product', id: params.get('product')!, tiers: parseTierList(params.get('tiers')) };
  }
  return { mode: 'asset', id: h };
}

/** The single entry point: render a route, keep the hash + active tab in sync, track the load promise. */
function show(route: Route): Promise<void> {
  const hash = routeToHash(route);
  if (location.hash.slice(1) !== hash) history.replaceState(null, '', `#${hash}`);
  activateTab(route.mode === 'asset' ? 'assets' : 'parts');
  currentLoad =
    route.mode === 'asset'
      ? selectAsset(route.id)
      : route.mode === 'part'
        ? selectPart(route.id, route.tier)
        : selectProduct(route.id, route.tiers);
  return currentLoad;
}

window.addEventListener('hashchange', () => {
  const route = routeFromHash();
  if (route) void show(route);
});

// ── Scripting hook — drive the viewer from an agent / Playwright ──────────────────────────

/**
 * Sample a dominant-palette signature of the current render: the characteristic colour of the part's
 * lit faces (scene helpers hidden so ground/grid don't swamp the signal). A cheap, GPU/AA-tolerant
 * signal a baseline can be approved against and later drift checked, per `docs/part-identity-spec.md`
 * Phase 1.5.
 *
 * Pixels are averaged weighted by luminance², so the bright faces that carry the tier finish dominate
 * over the part's many dark grey-box / shadow pixels — a flat mean is pulled to near-black by those and
 * barely separates one tier from another. The weighting makes a rusty part read brown and an iron part
 * blue-grey with real contrast (the signal a drift check keys off), not a near-background smudge.
 */
function sampleSignature(): string {
  const hidden = sceneHelpers.filter((h) => h.visible);
  for (const h of hidden) h.visible = false;
  renderer.render(scene, camera);
  const probe = document.createElement('canvas');
  probe.width = 64;
  probe.height = 64;
  const ctx = probe.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(renderer.domElement, 0, 0, 64, 64);
  const data = ctx.getImageData(0, 0, 64, 64).data;
  const bg = new THREE.Color(BG_COLOR);
  const bgR = Math.round(bg.r * 255);
  const bgG = Math.round(bg.g * 255);
  const bgB = Math.round(bg.b * 255);
  let r = 0;
  let g = 0;
  let b = 0;
  let wsum = 0;
  for (let i = 0; i < data.length; i += 4) {
    const R = data[i]!;
    const G = data[i + 1]!;
    const B = data[i + 2]!;
    if (Math.abs(R - bgR) < 8 && Math.abs(G - bgG) < 8 && Math.abs(B - bgB) < 8) continue; // skip bg
    const lum = 0.299 * R + 0.587 * G + 0.114 * B;
    const w = lum * lum; // favour lit faces (tier colour) over dark grey-box shadow
    r += R * w;
    g += G * w;
    b += B * w;
    wsum += w;
  }
  for (const h of hidden) h.visible = true;
  renderer.render(scene, camera);
  if (wsum === 0) return '#000000';
  const hex = (v: number): string => Math.round(v / wsum).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

interface ViewerHook {
  /** The data the agent enumerates over — the same rosters the UI is built from. */
  catalog: { tiers: typeof TIERS; parts: typeof PART_IDENTITIES; products: typeof PRODUCT_GROUPS };
  showAsset(id: string): Promise<void>;
  showPart(id: string, tier?: TierId): Promise<void>;
  showProduct(id: string, tiers?: Record<string, TierId>): Promise<void>;
  /** Resolves when the latest selection has finished loading + rendered a frame. */
  settled(): Promise<void>;
  /** A snapshot of what's on stage — per-asset {real model?, tris} plus the dominant-palette signature. */
  state(): {
    mode: ViewMode;
    id: string;
    items: RenderedItem[];
    totalTris: number;
    allModelsReal: boolean;
    signature: string;
  };
}

const hook: ViewerHook = {
  catalog: { tiers: TIERS, parts: PART_IDENTITIES, products: PRODUCT_GROUPS },
  showAsset: (id) => show({ mode: 'asset', id }),
  showPart: (id, tier = DEFAULT_TIER) => show({ mode: 'part', id, tier }),
  showProduct: (id, tiers = {}) => show({ mode: 'product', id, tiers: new Map(Object.entries(tiers)) }),
  settled: () => currentLoad,
  state: () => ({
    mode,
    id: viewId,
    items: rendered.map((r) => ({ ...r })),
    totalTris: rendered.reduce((a, r) => a + r.tris, 0),
    allModelsReal: rendered.length > 0 && rendered.every((r) => r.isRealModel),
    signature: sampleSignature(),
  }),
};
(window as unknown as { __viewer: ViewerHook }).__viewer = hook;

// ── Render loop ─────────────────────────────────────────────────────────────────────────
function tick(): void {
  const dt = clock.getDelta();
  if (rig && armState === 'dig') {
    rigElapsed += dt;
    rig.update(rigElapsed);
  }
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

// Open onto the hash's view if any, else the first sub-part so the Parts tab isn't empty.
const initial = routeFromHash() ?? { mode: 'part' as const, id: PART_IDENTITIES[0]!.id, tier: DEFAULT_TIER };
void show(initial);
