import * as THREE from 'three';
import type { World } from '../core/world';
import type { EntityId } from '../core/types';
import { Transform } from '../components/transform';
import { Renderable } from '../components/renderable';
import { ModelLoader } from '../../../shared/model-loader';

/**
 * The view layer. It is a *projection* of the simulation: it reads Transform/Renderable
 * from the World and draws objects, but owns no game truth. The object cache below is view
 * state only — destroy the renderer and the simulation is unaffected.
 */
export class RenderView {
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly objects = new Map<EntityId, THREE.Object3D>();
  private readonly camOffset = new THREE.Vector3(9, 11, 13);

  private readonly models = new ModelLoader();

  constructor(canvas: HTMLCanvasElement) {
    this.scene.background = new THREE.Color(0x1a1a1a);

    this.camera = new THREE.PerspectiveCamera(50, this.aspect(), 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.resize();

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.position.set(5, 10, 7);
    this.scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshStandardMaterial({ color: 0x2b2b2b }),
    );
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);
    this.scene.add(new THREE.GridHelper(80, 80, 0x444444, 0x333333));

    window.addEventListener('resize', () => this.resize());
  }

  /** Reconcile objects with the current set of renderable entities, then update them. */
  sync(world: World): void {
    for (const e of world.query(Transform, Renderable)) {
      let obj = this.objects.get(e);
      if (!obj) {
        obj = this.createObject(world.get(e, Renderable)!);
        this.scene.add(obj);
        this.objects.set(e, obj);
      }
      const t = world.get(e, Transform)!;
      obj.position.set(t.x, (obj.userData['restY'] as number) ?? 0, t.z);
      obj.rotation.y = t.rotationY;
    }

    for (const [id, obj] of this.objects) {
      if (!world.isAlive(id)) {
        this.scene.remove(obj);
        this.objects.delete(id);
      }
    }
  }

  follow(t: Transform): void {
    this.camera.position.set(t.x + this.camOffset.x, this.camOffset.y, t.z + this.camOffset.z);
    this.camera.lookAt(t.x, 0, t.z);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private createObject(r: Renderable): THREE.Object3D {
    return r.shape === 'model' ? this.createModel(r.assetId) : this.createBox(r);
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
  private createModel(assetId: string): THREE.Object3D {
    const group = new THREE.Group();
    group.userData['restY'] = 0;

    const placeholder = this.placeholderMesh();
    group.add(placeholder);

    this.models
      .load(assetId)
      .then((template) => {
        group.remove(placeholder);
        group.add(template.clone(true));
      })
      .catch((err: unknown) => {
        console.warn(`[assets] could not load model '${assetId}', showing placeholder:`, err);
      });

    return group;
  }

  /** Magenta wireframe cube = "asset loading or missing" — an obvious dev signal. */
  private placeholderMesh(): THREE.Mesh {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0xff00ff, wireframe: true }),
    );
    mesh.position.y = 0.5;
    return mesh;
  }

  private aspect(): number {
    return window.innerWidth / window.innerHeight;
  }

  private resize(): void {
    this.camera.aspect = this.aspect();
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
