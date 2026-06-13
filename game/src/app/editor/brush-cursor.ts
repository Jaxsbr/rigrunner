import * as THREE from 'three';

/**
 * The brush-tip cursor: a ring on the ground at the mouse position, sized to the exact disc the brush
 * will paint — so you always see WHERE and HOW BIG the next paint/erase will be. Follows the cursor, hides
 * when it leaves the canvas. Pure view; drawn over everything (depth-test off).
 */
export class BrushCursor {
  private readonly ring: THREE.Line;

  constructor(scene: THREE.Scene) {
    const pts: THREE.Vector3[] = [];
    const SEG = 48;
    for (let i = 0; i <= SEG; i++) {
      const a = (i / SEG) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a), 0, Math.sin(a))); // unit circle, scaled per-frame
    }
    this.ring = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0xffffff, depthTest: false, depthWrite: false, transparent: true }),
    );
    this.ring.position.y = 0.18;
    this.ring.renderOrder = 1002;
    this.ring.visible = false;
    scene.add(this.ring);
  }

  /** Place the ring at a ground point with the given world radius, or hide it (`world === null`). */
  set(world: { x: number; z: number } | null, radiusWorld: number): void {
    if (!world) { this.ring.visible = false; return; }
    this.ring.visible = true;
    this.ring.position.x = world.x;
    this.ring.position.z = world.z;
    this.ring.scale.set(radiusWorld, 1, radiusWorld);
  }
}
