import * as THREE from 'three';

/** The exact grid-aligned world rectangle the brush will paint (cell-snapped). */
export interface BrushRect {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

/**
 * The brush-tip cursor: a SQUARE outline snapped to the exact cells the brush will paint — so you see
 * precisely which cells the next paint/erase covers (size 1 = a single cell). Follows the cursor, hides
 * when it leaves the canvas. Pure view; drawn over everything (depth-test off).
 */
export class BrushCursor {
  private readonly square: THREE.Line;

  constructor(scene: THREE.Scene) {
    // A unit square (corners at ±0.5) on the ground, scaled + positioned to the painted rect per move.
    const c = [
      new THREE.Vector3(-0.5, 0, -0.5),
      new THREE.Vector3(0.5, 0, -0.5),
      new THREE.Vector3(0.5, 0, 0.5),
      new THREE.Vector3(-0.5, 0, 0.5),
      new THREE.Vector3(-0.5, 0, -0.5),
    ];
    this.square = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(c),
      new THREE.LineBasicMaterial({ color: 0xffffff, depthTest: false, depthWrite: false, transparent: true }),
    );
    this.square.position.y = 0.18;
    this.square.renderOrder = 1002;
    this.square.visible = false;
    scene.add(this.square);
  }

  /** Outline the cell-snapped rectangle the brush will paint, or hide it (`rect === null`). */
  set(rect: BrushRect | null): void {
    if (!rect) { this.square.visible = false; return; }
    this.square.visible = true;
    this.square.position.x = (rect.minX + rect.maxX) / 2;
    this.square.position.z = (rect.minZ + rect.maxZ) / 2;
    this.square.scale.set(rect.maxX - rect.minX, 1, rect.maxZ - rect.minZ);
  }
}
