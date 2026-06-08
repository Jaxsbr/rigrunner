import * as THREE from 'three';
import { createGroundTexture } from './ground-texture';

/**
 * The stage: the scene, renderer, fixed lighting and ground that everything else draws into.
 * It owns the shared `scene` (collaborators add their meshes to it) and the WebGL surface, and
 * does the actual draw. It knows nothing about entities, the camera state, or game truth — it is
 * the bare canvas the rest of the render layer composes onto.
 */
export class Stage {
  readonly scene = new THREE.Scene();
  private readonly renderer: THREE.WebGLRenderer;

  constructor(canvas: HTMLCanvasElement) {
    this.scene.background = new THREE.Color(0x1a1a1a);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.resize();

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.position.set(5, 10, 7);
    this.scene.add(sun);

    // A weathered dusty-dirt floor — tiled procedural texture (dust swells, grime, grit) over a
    // lighter wasteland base so loose scrap (grey/rust) reads against it. Matte: it catches the sun
    // without specular glare.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshStandardMaterial({
        map: createGroundTexture(this.renderer.capabilities.getMaxAnisotropy()),
        roughness: 1,
        metalness: 0,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);
  }

  render(camera: THREE.Camera): void {
    this.renderer.render(this.scene, camera);
  }

  /** Match the drawing buffer to the window. (Camera aspect is the OrbitCamera's concern.) */
  resize(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
