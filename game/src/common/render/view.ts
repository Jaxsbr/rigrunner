import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import type { Transform } from '@common/components/transform';
import type { CameraIntent } from '@common/input/camera-input';
import { Stage } from './stage';
import { OrbitCamera } from './orbit-camera';
import { EntityViews } from './entity-views';
import { Picker } from './picker';
import { BuildAffordances } from './build-affordances';
import type { CellPose } from '@core/geometry';

/**
 * The view layer's façade — a PURE PROJECTION of the simulation: it reads state from the World and
 * draws, but owns no game truth (destroy it and the simulation is unaffected) and, per ADR-003 §4,
 * imports NO feature: it owns only the tier-generic collaborators (stage, camera, entity views,
 * picker, build affordances).
 *
 * The feature-coupled render — the sim-driven animators (wheel spin, storage fill, reclaimer, pile
 * slump) and the proximity overlays/hints/stains — is dispatched from the composition root
 * (`main.ts`), which constructs them against the `scene` / `entityViews` this façade exposes. That
 * keeps the shared render tier free of any inward-pointing import into `features/`.
 */
export class RenderView {
  private readonly stage: Stage;
  private readonly orbit: OrbitCamera;
  private readonly views: EntityViews;
  private readonly picker: Picker;
  private readonly affordances: BuildAffordances;

  constructor(canvas: HTMLCanvasElement) {
    this.stage = new Stage(canvas);
    this.orbit = new OrbitCamera();
    this.views = new EntityViews(this.stage.scene);
    this.picker = new Picker(this.orbit.camera, canvas, this.views);
    this.affordances = new BuildAffordances(this.stage.scene);

    window.addEventListener('resize', () => {
      this.stage.resize();
      this.orbit.resize();
    });
  }

  // ── seams the composition root wires feature render onto ──────────────────────────────────────
  /** The three.js scene, so `main.ts` can attach feature overlays/stains (ADR-003 §4). */
  get scene() { return this.stage.scene; }
  /** The per-entity view cache the sim-driven feature animators iterate (ADR-003 §4). */
  get entityViews(): EntityViews { return this.views; }

  // ── per-frame projection ────────────────────────────────────────────────────────────────────
  sync(world: World): void { this.views.sync(world); }
  follow(t: Transform, intent: CameraIntent, dt: number, retarget = false): void {
    this.orbit.follow(t, intent, dt, retarget);
  }
  render(): void { this.stage.render(this.orbit.camera); }

  // ── build interaction (queried/toggled by the build controller) ─────────────────────────────
  pickEntity(clientX: number, clientY: number, candidates: EntityId[]): EntityId | null {
    return this.picker.pickEntity(clientX, clientY, candidates);
  }
  raycastPlane(clientX: number, clientY: number, planeY: number): { x: number; z: number } | null {
    return this.picker.raycastPlane(clientX, clientY, planeY);
  }
  showCellHighlight(pose: CellPose | null, footprint?: { cols: number; rows: number }): void {
    this.affordances.showCellHighlight(pose, footprint);
  }
  showCarryShadow(at: { x: number; z: number; y: number } | null): void {
    this.affordances.showCarryShadow(at);
  }
}
