import * as THREE from 'three';
import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { Renderable } from '@common/components/renderable';
import { ModelLoader } from '@shared/model-loader';
import { isArticulated, ReclaimerRig, BUCKET_ASSET } from './articulation';

/**
 * The entity↔Object3D reconciler: the bridge from sim state to scene graph. Each frame `sync`
 * creates an Object3D for any newly-renderable entity, positions every object from its Transform,
 * and drops objects whose entity is gone. The `objects` map is pure view state — destroy it and
 * the simulation is untouched.
 *
 * It exposes the object cache (read-only) so the picker can resolve hits to entities and the
 * sim-driven animators can drive per-object meshes, without anyone else owning the lifecycle.
 */
export class EntityViews {
  private readonly cache = new Map<EntityId, THREE.Object3D>();
  private readonly models = new ModelLoader();

  constructor(private readonly scene: THREE.Scene) {}

  /** The live object cache, read-only — for picking and animation to iterate, not mutate. */
  get objects(): ReadonlyMap<EntityId, THREE.Object3D> {
    return this.cache;
  }

  /** The Object3D for an entity, or undefined if it has none (not renderable / not yet synced). */
  get(id: EntityId): THREE.Object3D | undefined {
    return this.cache.get(id);
  }

  /** Reconcile objects with the current set of renderable entities, then update them. */
  sync(world: World): void {
    for (const e of world.query(Transform, Renderable)) {
      let obj = this.cache.get(e);
      if (!obj) {
        obj = this.createObject(world.get(e, Renderable)!);
        this.scene.add(obj);
        this.cache.set(e, obj);
      }
      const t = world.get(e, Transform)!;
      // y is the entity's own height when it has one (a part on a deck, or lifted while carried);
      // otherwise fall back to the asset's resting height (a model sits on the ground at y=0).
      const restY = (obj.userData['restY'] as number) ?? 0;
      obj.position.set(t.x, t.y ?? restY, t.z);
      obj.rotation.y = t.rotationY;
    }

    for (const [id, obj] of this.cache) {
      if (!world.isAlive(id)) {
        this.scene.remove(obj);
        this.cache.delete(id);
      }
    }
  }

  private createObject(r: Renderable): THREE.Object3D {
    return r.shape === 'model' ? this.createModel(r.assetId, r.scale ?? 1) : this.createBox(r);
  }

  private createBox(r: Extract<Renderable, { shape: 'box' }>): THREE.Mesh {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(r.size.x, r.size.y, r.size.z),
      new THREE.MeshStandardMaterial({ color: r.color }),
    );
    mesh.userData['restY'] = r.size.y / 2; // sit the box on the ground
    return mesh;
  }

  /**
   * A model entity gets a stable Group immediately (so the cache/positioning logic never
   * waits on I/O). A placeholder fills it until the GLB loads; on success the real model
   * swaps in. Origin convention: base-centre → restY 0 (the model sits on the ground).
   */
  private createModel(assetId: string, scale = 1): THREE.Object3D {
    const group = new THREE.Group();
    group.userData['restY'] = 0;
    group.userData['wheels'] = []; // populated on load; animateWheels reads it (safe when empty)
    group.userData['reclaimer'] = null; // set on load for an articulated arm; animateReclaimer reads it
    // Uniform resize of the authored asset (base-centre origin, so it stays grounded). Lets one GLB
    // serve at multiple sizes when a caller passes Renderable.scale.
    group.scale.setScalar(scale);

    const placeholder = placeholderMesh();
    group.add(placeholder);

    this.models
      .load(assetId)
      .then((template) => {
        group.remove(placeholder);
        const instance = template.clone(true);
        group.add(instance);
        // Collect spin-able parts: any node named `wheel*` (rig.py keeps them unjoined so they
        // survive as addressable nodes). Empty for assets without wheels — animateWheels no-ops.
        const wheels: THREE.Object3D[] = [];
        instance.traverse((o) => {
          if (o.name.startsWith('wheel')) wheels.push(o);
        });
        group.userData['wheels'] = wheels;

        // An articulated arm gets its head parented onto the wrist socket and a motion rig built
        // over its joint_* nodes (the same node-name contract the viewer drives). The bucket is a
        // second async load; it rides the socket, so it inherits the arm's pose and needs no entity
        // of its own. The rig lands in userData for animateReclaimer to drive each frame.
        if (isArticulated(assetId)) {
          void this.models
            .load(BUCKET_ASSET)
            .then((bucketTemplate) => {
              const rig = new ReclaimerRig(instance, bucketTemplate.clone(true));
              rig.idle(0); // hold the resting idle pose until the first animator tick
              group.userData['reclaimer'] = rig;
            })
            .catch((err: unknown) => {
              console.warn(`[assets] could not load '${BUCKET_ASSET}' head for '${assetId}':`, err);
            });
        }
      })
      .catch((err: unknown) => {
        console.warn(`[assets] could not load model '${assetId}', showing placeholder:`, err);
      });

    return group;
  }
}

/** Magenta wireframe cube = "asset loading or missing" — an obvious dev signal. */
function placeholderMesh(): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0xff00ff, wireframe: true }),
  );
  mesh.position.y = 0.5;
  return mesh;
}
