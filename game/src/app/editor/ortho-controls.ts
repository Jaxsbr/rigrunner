import * as THREE from 'three';

// Wheel-zoom bounds (world half-height shown). MIN is tight enough to work individual cells / place a
// single scrap piece precisely; MAX frames the whole ~290-across disc with margin.
const MIN_VIEW = 4;
const MAX_VIEW = 320;

/**
 * The map editor's camera: a top-down ORTHOGRAPHIC view, so a cell maps to the same screen size edge to
 * edge (no perspective skew) — painting is precise everywhere, which is the whole point of the editor.
 * A tilt toggle swings to an oblique angle to check the paint against the 3-D mountain art, then back.
 *
 * Controls: WASD / arrows pan, middle-drag pans, wheel zooms, `T` toggles tilt. The focus is a point on
 * the ground; the camera rides above it (top-down) or pulled back-and-up (tilted), always looking at it.
 */
export class OrthoControls {
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 4000);
  private readonly focus = new THREE.Vector3(0, 0, 0);
  private viewSize = 165; // world half-height shown — the disc is ~290 across, so this frames it with margin
  private tilted = false;
  private readonly keys: Record<string, boolean> = Object.create(null);
  private panning = false;

  constructor(canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      this.keys[e.key.toLowerCase()] = true;
      if (e.key.toLowerCase() === 't') this.tilted = !this.tilted;
    });
    window.addEventListener('keyup', (e) => { this.keys[e.key.toLowerCase()] = false; });

    // Middle-button drag pans; the wheel zooms. (Left/right buttons belong to the paint controller.)
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button === 1) { this.panning = true; canvas.setPointerCapture(e.pointerId); e.preventDefault(); }
    });
    canvas.addEventListener('pointerup', (e) => { if (e.button === 1) this.panning = false; });
    canvas.addEventListener('pointermove', (e) => {
      if (!this.panning) return;
      const perPx = (this.viewSize * 2) / window.innerHeight; // world units per screen pixel
      this.focus.x -= e.movementX * perPx;
      this.focus.z -= e.movementY * perPx;
    });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.viewSize = Math.min(MAX_VIEW, Math.max(MIN_VIEW, this.viewSize * (e.deltaY > 0 ? 1.1 : 0.9)));
    }, { passive: false });

    this.applyFrustum();
    this.update(0);
  }

  /** Step the WASD/arrow pan and re-aim the camera. Call once per frame. */
  update(dt: number): void {
    const pan = this.viewSize * 0.9 * dt; // pan speed scales with zoom, so it feels constant on screen
    if (this.keys['a'] || this.keys['arrowleft']) this.focus.x -= pan;
    if (this.keys['d'] || this.keys['arrowright']) this.focus.x += pan;
    if (this.keys['w'] || this.keys['arrowup']) this.focus.z -= pan;
    if (this.keys['s'] || this.keys['arrowdown']) this.focus.z += pan;

    // The orthographic zoom lives entirely in the frustum bounds, so re-derive them each frame — that's
    // what makes a wheel change to `viewSize` actually take effect.
    this.applyFrustum();

    if (this.tilted) {
      // Oblique: pulled back along +z and up, looking down at the focus — to read the art's relief.
      this.camera.up.set(0, 1, 0);
      this.camera.position.set(this.focus.x, this.viewSize * 1.4, this.focus.z + this.viewSize * 1.2);
    } else {
      // Straight down. up = −z so screen-up is world −z (north stays consistent as you pan).
      this.camera.up.set(0, 0, -1);
      this.camera.position.set(this.focus.x, 1000, this.focus.z);
    }
    this.camera.lookAt(this.focus.x, 0, this.focus.z);
    this.camera.updateMatrixWorld();
  }

  /** Re-derive the orthographic frustum from the current zoom + window aspect. */
  applyFrustum(): void {
    const aspect = window.innerWidth / window.innerHeight;
    this.camera.left = -this.viewSize * aspect;
    this.camera.right = this.viewSize * aspect;
    this.camera.top = this.viewSize;
    this.camera.bottom = -this.viewSize;
    this.camera.updateProjectionMatrix();
  }

  resize(): void {
    this.applyFrustum();
  }

  /** World units per screen pixel at the current zoom — for screen-constant pick radii / hit tests. */
  get worldPerPixel(): number {
    return (this.viewSize * 2) / window.innerHeight;
  }
}
