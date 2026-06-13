import * as THREE from 'three';
import { createGroundTexture } from './ground-texture';

/**
 * The textured playable floor is a finite DISC of radius `WORLD_RADIUS` centred on the origin; past
 * its edge there is only the black void (the scene background) — the hand-authored map has an end, and
 * the rig is held inside it by `worldBoundsSystem` (features/terrain). The disc extends BEYOND the
 * bounding mountain ridge (`MOUNTAIN_RING_RADIUS`, ~95), so worked ground shows under and past the
 * peaks rather than dropping to void at them. Shared so the floor, the world-end clamp, and the ridge
 * can't drift apart.
 */
export const WORLD_RADIUS = 128;

/**
 * The stage: the scene, renderer, fixed lighting and ground that everything else draws into.
 * It owns the shared `scene` (collaborators add their meshes to it) and the WebGL surface, and
 * does the actual draw. It knows nothing about entities, the camera state, or game truth — it is
 * the bare canvas the rest of the render layer composes onto.
 */
export class Stage {
  readonly scene = new THREE.Scene();
  private readonly renderer: THREE.WebGLRenderer;
  private readonly sun: THREE.DirectionalLight;

  constructor(canvas: HTMLCanvasElement) {
    // The void beyond the map's edge: black. The world is a hand-authored finite disc (not procedurally
    // endless), so past the worked ground there is nothing — a hard world-end the rig can't cross.
    this.scene.background = new THREE.Color(0x000000);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // Khronos Neutral tone mapping: compresses the bright sun-lit faces gracefully WITHOUT the
    // saturation/hue drift ACES inflicts — colours stay vivid instead of washing out.
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.resize();

    // Image-based lighting: a warm sky↔dirt gradient, so the (90%-metallic) scrap reflects a real
    // environment instead of rendering near-black against the void. This is what gives metal its body
    // and makes surfaces visibly catch the light; the direct sun adds the moving glint on top.
    this.scene.environment = buildEnvironment(this.renderer);
    this.scene.environmentIntensity = 1.0;

    // Sun-baked desert light, deliberately NOT flat white (white + vertical reads as "overcast").
    // A warm golden key, placed far up the (24,32,20) axis so it reads as a distant sun and frames a
    // shadow that follows the camera (see syncSunToFocus). It casts the scene's real shadows.
    this.sun = new THREE.DirectionalLight(0xffe3ad, 1.5);
    this.sun.position.copy(SUN_OFFSET);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04; // chunky beveled geometry — a generous normal bias kills acne
    const sc = this.sun.shadow.camera;
    sc.near = 1;
    sc.far = 110;
    sc.left = sc.bottom = -42;
    sc.right = sc.top = 42;
    this.scene.add(this.sun, this.sun.target);

    // Hemisphere fill: a COOL sky above and warm bounced dirt below — that warm/cool split is what
    // makes daylight read rich instead of a monochrome sepia wash, and lets blues/greens stay vivid.
    // A faint warm ambient lifts the floor. Both sit low now the environment carries the soft fill.
    this.scene.add(new THREE.HemisphereLight(0xbcd6ff, 0xc08a52, 0.6));
    this.scene.add(new THREE.AmbientLight(0xfff4e3, 0.15));

    // A weathered dusty-dirt floor — tiled procedural texture (dust swells, grime, grit) over a warm
    // sandy base so loose scrap (grey/rust) reads against it. Near-matte: it catches the sun with a
    // faint sheen and receives the rig's and scrap's cast shadows.
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(WORLD_RADIUS, 128),
      new THREE.MeshStandardMaterial({
        map: createGroundTexture(this.renderer.capabilities.getMaxAnisotropy()),
        roughness: 0.92,
        metalness: 0,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  render(camera: THREE.Camera): void {
    this.syncSunToFocus(camera);
    this.renderer.render(this.scene, camera);
  }

  /**
   * Keep the sun — and thus its shadow frustum — centred on the ground point the camera looks at, so
   * a tight, crisp shadow map follows the action instead of being stretched thin across the whole
   * field. Derived purely from the camera the stage already draws with (project its forward ray onto
   * the ground plane), so the stage stays ignorant of entities and camera state.
   */
  private syncSunToFocus(camera: THREE.Camera): void {
    camera.getWorldDirection(_forward);
    if (_forward.y < -1e-4) {
      _focus.copy(camera.position).addScaledVector(_forward, -camera.position.y / _forward.y);
    } else {
      _focus.set(0, 0, 0);
    }
    this.sun.position.copy(_focus).add(SUN_OFFSET);
    this.sun.target.position.copy(_focus);
    this.sun.target.updateMatrixWorld();
  }

  /** Match the drawing buffer to the window. (Camera aspect is the OrbitCamera's concern.) */
  resize(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

// The sun's fixed offset from the focus point: high and to one side, so it reads as a distant
// golden sun and rakes a directional shadow across the scene.
const SUN_OFFSET = new THREE.Vector3(24, 32, 20);
const _forward = new THREE.Vector3();
const _focus = new THREE.Vector3();

/**
 * Build the scene's reflection/IBL environment: a warm sky→horizon→dirt gradient, PMREM-filtered so
 * the metallic scrap has a believable, on-palette surrounding to mirror. Returned as a texture for
 * `scene.environment`; the generator and source canvas are disposed once baked.
 */
function buildEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const src = gradientEquirect();
  const target = pmrem.fromEquirectangular(src);
  src.dispose();
  pmrem.dispose();
  return target.texture;
}

/** A vertical sky↔ground gradient as an equirectangular texture: cool sky up top, warm dirt below. */
function gradientEquirect(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0.0, '#cddef3'); // zenith — cool daylight sky
  g.addColorStop(0.46, '#e8d7b6'); // warm haze approaching the horizon
  g.addColorStop(0.52, '#c7a677'); // horizon — sun-baked dust
  g.addColorStop(1.0, '#80603f'); // nadir — warm ground (kept fairly light so downward-facing metal reads)
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const tex = new THREE.CanvasTexture(canvas);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
