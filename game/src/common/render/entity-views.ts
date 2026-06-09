import * as THREE from 'three';
import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { Renderable } from '@common/components/renderable';
import { ModelLoader } from '@shared/model-loader';
import { tintModel } from '@shared/model-tint';
import { assembleProduct } from '@shared/assembler';
import type { TierId } from '@common/parts/tiers';
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
      const r = world.get(e, Renderable)!;
      const sig = renderSig(r);
      let obj = this.cache.get(e);
      // Rebuild when the Renderable itself changed (not just the Transform): a chassis kit deploying
      // into a rig swaps its `model` crate for the composed `assembly` rig, so the cached crate object
      // must be discarded and recreated from the new Renderable — otherwise the deck would render as a
      // crate forever. The Renderable is otherwise stable per entity, so this is a no-op the rest of the time.
      if (obj && obj.userData['renderSig'] !== sig) {
        this.scene.remove(obj);
        this.cache.delete(e);
        obj = undefined;
      }
      if (!obj) {
        obj = this.createObject(r);
        obj.userData['renderSig'] = sig;
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
    if (r.shape === 'assembly') return this.createAssembly(r.groupId, r.tiers, r.scale ?? 1);
    if (r.shape === 'model') return this.createModel(r.assetId, r.scale ?? 1, r.tint, r.headTint, r.headAssetId);
    return this.createBox(r);
  }

  /**
   * A COMPOSED product (engine, container) drawn as its positioned sub-parts through the SHARED
   * assembler — the same path the viewer composes by, so a build reads identically in the world and in
   * the viewer (`docs/part-identity-spec.md` §2b). Like `createModel`, the entity gets a stable Group
   * immediately (a placeholder until the async compose resolves), so the cache/positioning logic never
   * waits on I/O; the composed whole swaps in on load. Base-centre origin → restY 0.
   */
  private createAssembly(groupId: string, tiers: Record<string, TierId>, scale: number): THREE.Object3D {
    const group = new THREE.Group();
    group.userData['restY'] = 0;
    group.userData['wheels'] = []; // composed engines/containers have none — animateWheels no-ops
    group.userData['reclaimer'] = null;
    group.scale.setScalar(scale);

    const placeholder = placeholderMesh();
    group.add(placeholder);

    assembleProduct(groupId, tiers, this.models)
      .then((assembled) => {
        if (!assembled) return; // not a composing product (shouldn't reach here) — keep the placeholder
        group.remove(placeholder);
        group.add(assembled.group);
        enableShadows(assembled.group);
        // A composed chassis exposes its instanced Wheel units as `wheel*` nodes (one per corner socket);
        // collect them so animateWheels spins them and the deploy animator splays + spins them up. Empty
        // for engines/containers (no wheels) — animateWheels then no-ops, as before.
        const wheels: THREE.Object3D[] = [];
        assembled.group.traverse((o) => {
          if (o.name.startsWith('wheel')) wheels.push(o);
        });
        group.userData['wheels'] = wheels;
      })
      .catch((err: unknown) => {
        console.warn(`[assets] could not compose product '${groupId}', showing placeholder:`, err);
      });

    return group;
  }

  private createBox(r: Extract<Renderable, { shape: 'box' }>): THREE.Mesh {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(r.size.x, r.size.y, r.size.z),
      new THREE.MeshStandardMaterial({ color: r.color }),
    );
    mesh.userData['restY'] = r.size.y / 2; // sit the box on the ground
    enableShadows(mesh);
    return mesh;
  }

  /**
   * A model entity gets a stable Group immediately (so the cache/positioning logic never
   * waits on I/O). A placeholder fills it until the GLB loads; on success the real model
   * swaps in. Origin convention: base-centre → restY 0 (the model sits on the ground).
   */
  private createModel(assetId: string, scale = 1, tint?: number, headTint?: number, headAssetId?: string): THREE.Object3D {
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
        // Wash the model toward its tier finish before any view-owned children (the storage fill) are
        // added, so only the model itself takes the grade colour, not the scrap inside it.
        if (tint !== undefined) tintModel(instance, tint);
        group.add(instance);
        enableShadows(instance);
        // Collect spin-able parts: any node named `wheel*` (rig.py keeps them unjoined so they
        // survive as addressable nodes). Empty for assets without wheels — animateWheels no-ops.
        const wheels: THREE.Object3D[] = [];
        instance.traverse((o) => {
          if (o.name.startsWith('wheel')) wheels.push(o);
        });
        group.userData['wheels'] = wheels;

        // An articulated arm gets its head parented onto the wrist socket and a motion rig built
        // over its joint_* nodes (the same node-name contract the viewer drives). The head is a
        // second async load; it rides the socket, so it inherits the arm's pose and needs no entity
        // of its own. WHICH head GLB it loads is `headAssetId` (the swappable head — the digging bucket
        // or the stump-healer), defaulting to the bucket. The rig lands in userData for animateReclaimer.
        if (isArticulated(assetId)) {
          const headId = headAssetId ?? BUCKET_ASSET;
          void this.models
            .load(headId)
            .then((headTemplate) => {
              const head = headTemplate.clone(true);
              // The head wears its OWN sub-part's tier finish, independent of the arm's.
              if (headTint !== undefined) tintModel(head, headTint);
              enableShadows(head);
              const rig = new ReclaimerRig(instance, head);
              rig.idle(0); // hold the resting idle pose until the first animator tick
              group.userData['reclaimer'] = rig;
            })
            .catch((err: unknown) => {
              console.warn(`[assets] could not load '${headId}' head for '${assetId}':`, err);
            });
        }
      })
      .catch((err: unknown) => {
        console.warn(`[assets] could not load model '${assetId}', showing placeholder:`, err);
      });

    return group;
  }
}

/**
 * A stable signature of a Renderable — changes only when the *drawing* changes (model swap/resize, a
 * composition's tier mix, or a box's size/colour), not when the entity merely moves. `sync` rebuilds an
 * entity's object when its signature changes, so a live swap (the chassis-kit crate → the composed rig on
 * deploy) is reflected.
 */
function renderSig(r: Renderable): string {
  if (r.shape === 'model') return `model:${r.assetId}:${r.scale ?? 1}:${r.tint ?? ''}:${r.headTint ?? ''}:${r.headAssetId ?? ''}`;
  if (r.shape === 'assembly') {
    // A per-sub-part tier change must rebuild the composed object, so fold the whole tier map into the
    // signature (sorted, so key order can't spuriously churn it).
    const tiers = Object.entries(r.tiers).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join(',');
    return `assembly:${r.groupId}:${r.scale ?? 1}:${tiers}`;
  }
  return `box:${r.color}:${r.size.x},${r.size.y},${r.size.z}`;
}

/** Let every Mesh under an object cast and receive the sun's real shadows (so parts ground and
 *  shadow one another). Called on each loaded model/composition; the cheap blob stains stay as
 *  their own decoration on top. */
function enableShadows(obj: THREE.Object3D): void {
  obj.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
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
