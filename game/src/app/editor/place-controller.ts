import * as THREE from 'three';
import type { Picker } from '@common/render/picker';
import { ModelLoader } from '@shared/model-loader';
import { placementKind, nextWind, snapWind, WIND_STEP, type PlacementKind } from '../world-map/placement';
import type { PlacementStore, PlacementRecord } from './placement-store';

/**
 * The editor's PLACE mode: drop / select / move / rotate / delete authored placements against the world.
 * It shares the canvas with the paint tool — only the active mode responds (`setActive`) — so left/right
 * click means "place / select" here and "paint / erase" there, with no clash.
 *
 * Interactions:
 *  - LEFT-click empty ground → drop the active palette kind at the cursor, facing the current heading.
 *  - LEFT-click a placement → select it; drag → move it (and everything it spawned) rigidly.
 *  - `[` / `]` → rotate the selection (or, with nothing selected, the next-drop heading) by one 8-wind step.
 *  - Delete / Backspace → remove the selection. Escape → deselect.
 *  - Round-robin: when on, each drop auto-advances the heading through the 8 winds (N,NE,…,NW).
 *
 * A translucent GHOST of the active kind tracks the cursor so you preview the drop; a ring highlights the
 * current selection. The collision bake is the store's job (auto-bake on drop/move/rotate).
 */
export class PlaceController {
  private active = false;
  private activeKind: PlacementKind = 'workshop';
  private rotation = 0; // the heading the next drop uses (radians, snapped to a wind)
  private roundRobin = false;

  private selected: PlacementRecord | null = null;
  private dragging = false;
  private dragLast: { x: number; z: number } | null = null;

  private readonly models = new ModelLoader();
  private ghost: THREE.Object3D | null = null;
  private ghostKind: string | null = null; // which kind the current ghost models, to avoid reloading
  private ghostToken = 0; // guards async ghost loads against a kind switch mid-load
  private readonly ring: THREE.Line;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly scene: THREE.Scene,
    private readonly picker: Picker,
    private readonly store: PlacementStore,
    /** Surface a one-line status (what was placed/removed) to the toolbar. */
    private readonly onStatus: (msg: string) => void = () => {},
  ) {
    this.ring = makeSelectionRing();
    this.ring.visible = false;
    scene.add(this.ring);
    this.loadGhost(this.activeKind);

    canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
    canvas.addEventListener('pointerup', (e) => this.onPointerUp(e));
    canvas.addEventListener('pointerleave', () => { if (this.ghost) this.ghost.visible = false; });
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
  }

  /** Enter/leave place mode. Leaving hides the ghost + selection ring and drops any in-flight drag. */
  setActive(active: boolean): void {
    this.active = active;
    if (!active) {
      this.dragging = false;
      if (this.ghost) this.ghost.visible = false;
      this.ring.visible = false;
    } else if (this.selected) {
      this.showRing(this.selected);
    }
  }

  /** The palette picked a kind — load its ghost and place it next. */
  setKind(kind: PlacementKind): void {
    this.activeKind = kind;
    this.loadGhost(kind);
  }

  setRoundRobin(on: boolean): void {
    this.roundRobin = on;
  }

  private onPointerDown(e: PointerEvent): void {
    if (!this.active || e.button !== 0) return;
    const ground = this.picker.raycastPlane(e.clientX, e.clientY, 0);
    if (!ground) return;
    this.canvas.setPointerCapture(e.pointerId);

    // Clicking an existing placement selects it (and arms a drag); empty ground drops a new one.
    const hit = this.picker.pickEntity(e.clientX, e.clientY, this.store.candidateEntities());
    const rec = hit !== null ? this.store.recordForEntity(hit) : null;
    if (rec) {
      this.select(rec);
      this.dragging = true;
      this.dragLast = ground;
      if (this.ghost) this.ghost.visible = false;
      return;
    }

    const placed = this.store.add(this.activeKind, ground.x, ground.z, this.rotation);
    this.select(placed);
    const label = placementKind(this.activeKind)?.label ?? this.activeKind;
    if (this.roundRobin) {
      this.rotation = nextWind(this.rotation);
      this.updateGhostRotation();
      this.onStatus(`Placed ${label} · next faces ${windName(this.rotation)} (round-robin)`);
    } else {
      this.onStatus(`Placed ${label}`);
    }
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.active) return;
    const ground = this.picker.raycastPlane(e.clientX, e.clientY, 0);
    if (!ground) return;

    if (this.dragging && this.selected && this.dragLast) {
      this.store.translate(this.selected, ground.x - this.dragLast.x, ground.z - this.dragLast.z);
      this.dragLast = ground;
      this.showRing(this.selected);
      return;
    }

    if (this.ghost) {
      this.ghost.visible = true;
      this.ghost.position.set(ground.x, 0, ground.z);
    }
  }

  private onPointerUp(e: PointerEvent): void {
    if (e.button !== 0 || !this.dragging) return;
    this.dragging = false;
    this.dragLast = null;
    void this.store.recompute(); // finalise the moved placement's footprint
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (!this.active) return;
    if (e.key === '[' || e.key === ']') {
      this.rotation = e.key === ']' ? nextWind(this.rotation) : snapWind(this.rotation - WIND_STEP);
      if (this.selected) this.store.setRotation(this.selected, this.rotation);
      this.updateGhostRotation();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (!this.selected) return;
      const label = placementKind(this.selected.placement.kind)?.label ?? this.selected.placement.kind;
      this.store.remove(this.selected);
      this.selected = null;
      this.ring.visible = false;
      this.onStatus(`Removed ${label}`);
    } else if (e.key === 'Escape') {
      this.selected = null;
      this.ring.visible = false;
    }
  }

  private select(rec: PlacementRecord): void {
    this.selected = rec;
    this.rotation = snapWind(rec.placement.rotationY); // continue rotating from what's selected
    this.showRing(rec);
    this.updateGhostRotation();
  }

  private showRing(rec: PlacementRecord): void {
    this.ring.visible = true;
    this.ring.position.set(rec.placement.x, 0.2, rec.placement.z);
  }

  // ── The cursor ghost ─────────────────────────────────────────────────────────────────────────────

  private loadGhost(kind: PlacementKind): void {
    const assetId = placementKind(kind)?.ghostAssetId ?? kind;
    if (this.ghostKind === assetId && this.ghost) return;
    const token = ++this.ghostToken;
    this.models
      .load(assetId)
      .then((template) => {
        if (token !== this.ghostToken) return; // the kind changed again before this resolved
        if (this.ghost) this.scene.remove(this.ghost);
        const obj = template.clone(true);
        ghostify(obj);
        obj.visible = false;
        obj.rotation.y = this.rotation;
        this.scene.add(obj);
        this.ghost = obj;
        this.ghostKind = assetId;
      })
      .catch(() => {/* unknown asset — leave the previous ghost; the palette only offers real assets */});
  }

  private updateGhostRotation(): void {
    if (this.ghost) this.ghost.rotation.y = this.rotation;
  }
}

/** A cyan ground ring marking the selected placement. Drawn over everything, like the brush cursor. */
function makeSelectionRing(): THREE.Line {
  const pts: THREE.Vector3[] = [];
  const R = 2.4;
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * R, 0, Math.sin(a) * R));
  }
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color: 0x5cf0ff, depthTest: false, depthWrite: false, transparent: true }),
  );
  line.renderOrder = 1003;
  return line;
}

/** Make a cloned model read as a translucent preview WITHOUT touching the shared template materials. */
function ghostify(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const src = mesh.material;
    const clone = (m: THREE.Material): THREE.Material => {
      const c = m.clone();
      c.transparent = true;
      c.opacity = 0.45;
      c.depthWrite = false;
      return c;
    };
    mesh.material = Array.isArray(src) ? src.map(clone) : clone(src);
  });
}

const WIND_NAMES = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
/** Name the wind a heading snaps to — for the round-robin status line. */
function windName(rotationY: number): string {
  return WIND_NAMES[Math.round(snapWind(rotationY) / WIND_STEP) % 8] ?? 'N';
}
