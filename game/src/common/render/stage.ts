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
    // A warm dusty-haze horizon, not a dead black void — the wasteland reaches past the ground plane
    // rather than dropping into a pit at the edges.
    this.scene.background = new THREE.Color(0x6a5942);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // Khronos Neutral tone mapping: compresses the bright sun-lit faces gracefully WITHOUT the
    // saturation/hue drift ACES inflicts — colours stay vivid instead of washing out.
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.resize();

    // Sun-baked desert light, deliberately NOT flat white (white + vertical reads as "overcast").
    // A warm golden key rakes across surfaces; the hemisphere fills shadows with a COOL sky above and
    // warm bounced dirt below — that warm/cool split is what makes daylight read rich instead of a
    // monochrome sepia wash, and lets blues/greens stay vivid. A faint warm ambient lifts the floor.
    const sun = new THREE.DirectionalLight(0xffe3ad, 1.5);
    sun.position.set(6, 8, 5);
    this.scene.add(sun);
    this.scene.add(new THREE.HemisphereLight(0xbcd6ff, 0xc08a52, 0.7));
    this.scene.add(new THREE.AmbientLight(0xfff4e3, 0.2));

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
