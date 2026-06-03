import * as THREE from 'three';
import type { EntityId } from '@core/types';
import type { EntityViews } from './entity-views';

/**
 * Cursor → world queries: raycasting against entity objects (for build picking) and against a
 * horizontal plane (for the carry drag point). It rays from the camera through the cursor and
 * resolves hits back to entities via the EntityViews cache. The raycaster/scratch vectors are
 * reused to avoid per-call allocation.
 */
export class Picker {
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private readonly dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly hitPoint = new THREE.Vector3();

  constructor(
    private readonly camera: THREE.Camera,
    private readonly canvas: HTMLCanvasElement,
    private readonly views: EntityViews,
  ) {}

  /**
   * Raycast the cursor against the given entities' objects and return the entity hit (nearest
   * first), or null. Walks up from the hit mesh to the registered group so a click on any child
   * mesh resolves to its owning entity. The candidate list keeps build picking from ever
   * selecting scenery — the caller passes exactly the parts that are grabbable.
   */
  pickEntity(clientX: number, clientY: number, candidates: EntityId[]): EntityId | null {
    const owner = new Map<THREE.Object3D, EntityId>();
    const objs: THREE.Object3D[] = [];
    for (const id of candidates) {
      const o = this.views.get(id);
      if (o) {
        owner.set(o, id);
        objs.push(o);
      }
    }
    this.setRay(clientX, clientY);
    const hits = this.raycaster.intersectObjects(objs, true);
    if (hits.length === 0) return null;
    let o: THREE.Object3D | null = hits[0]!.object;
    while (o && !owner.has(o)) o = o.parent;
    return o ? owner.get(o)! : null;
  }

  /** Project the cursor onto a horizontal plane at height `planeY`; returns world x/z or null. */
  raycastPlane(clientX: number, clientY: number, planeY: number): { x: number; z: number } | null {
    this.setRay(clientX, clientY);
    this.dragPlane.constant = -planeY; // plane y = planeY, normal +Y
    if (!this.raycaster.ray.intersectPlane(this.dragPlane, this.hitPoint)) return null;
    return { x: this.hitPoint.x, z: this.hitPoint.z };
  }

  private setRay(clientX: number, clientY: number): void {
    const rect = this.canvas.getBoundingClientRect();
    this.ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.ndc, this.camera);
  }
}
