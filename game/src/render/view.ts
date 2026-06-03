import type { World } from '../core/world';
import type { EntityId } from '../core/types';
import type { Transform } from '../components/transform';
import type { CameraIntent } from '../input/camera-input';
import { Stage } from './stage';
import { OrbitCamera } from './orbit-camera';
import { EntityViews } from './entity-views';
import { Picker } from './picker';
import { BuildAffordances } from './build-affordances';
import type { CellPose } from '../core/geometry';
import { ZoneOverlays } from './zone-overlays';
import { InteractionHints } from './interaction-hints';
import { ScrapStains } from './scrap-stains';
import { animateWheels, animateStorageFill, animateReclaimer, animateScrapPile } from './animators';

/**
 * The view layer's façade. It is a *projection* of the simulation: it reads state from the World
 * and draws, but owns no game truth — destroy it and the simulation is unaffected. Each concern
 * lives in its own collaborator (stage, camera, entity views, picker, affordances, zone overlays,
 * animators); this class only owns them and delegates, so the public surface the game and build
 * controller call stays in one small place while each piece can grow independently.
 */
export class RenderView {
  private readonly stage: Stage;
  private readonly orbit: OrbitCamera;
  private readonly views: EntityViews;
  private readonly picker: Picker;
  private readonly affordances: BuildAffordances;
  private readonly zones: ZoneOverlays;
  private readonly hints: InteractionHints;
  private readonly stains: ScrapStains;

  constructor(canvas: HTMLCanvasElement) {
    this.stage = new Stage(canvas);
    this.orbit = new OrbitCamera();
    this.views = new EntityViews(this.stage.scene);
    this.picker = new Picker(this.orbit.camera, canvas, this.views);
    this.affordances = new BuildAffordances(this.stage.scene);
    this.zones = new ZoneOverlays(this.stage.scene);
    this.hints = new InteractionHints(this.stage.scene);
    this.stains = new ScrapStains(this.stage.scene);

    window.addEventListener('resize', () => {
      this.stage.resize();
      this.orbit.resize();
    });
  }

  // ── per-frame projection ────────────────────────────────────────────────────────────────────
  sync(world: World): void { this.views.sync(world); }
  syncWorkshopZones(world: World): void { this.zones.sync(world); }
  syncInteractionHints(world: World, dt: number): void { this.hints.sync(world, dt); }
  syncScrapStains(world: World, dt: number): void { this.stains.sync(world, dt); }
  follow(t: Transform, intent: CameraIntent, dt: number): void { this.orbit.follow(t, intent, dt); }
  animateWheels(world: World, dt: number): void { animateWheels(this.views, world, dt); }
  animateStorageFill(world: World, dt: number): void { animateStorageFill(this.views, world, dt); }
  animateReclaimer(world: World, dt: number): void { animateReclaimer(this.views, world, dt); }
  animateScrapPile(world: World, dt: number): void { animateScrapPile(this.views, world, dt); }
  render(): void { this.stage.render(this.orbit.camera); }

  // ── build interaction (queried/toggled by the build controller) ─────────────────────────────
  pickEntity(clientX: number, clientY: number, candidates: EntityId[]): EntityId | null {
    return this.picker.pickEntity(clientX, clientY, candidates);
  }
  raycastPlane(clientX: number, clientY: number, planeY: number): { x: number; z: number } | null {
    return this.picker.raycastPlane(clientX, clientY, planeY);
  }
  showCellHighlight(pose: CellPose | null): void { this.affordances.showCellHighlight(pose); }
  showCarryShadow(at: { x: number; z: number; y: number } | null): void {
    this.affordances.showCarryShadow(at);
  }
}
