import * as THREE from 'three';
import type { CollisionGrid } from '@features/terrain/collision-grid';

/**
 * The editor's collision visualisation: a translucent RED wash over every blocked cell, drawn onto a
 * low-resolution canvas (one texel per cell, nearest-filtered) so the grid reads as crisp painted squares
 * on the ground. It hugs the floor just above the texture and updates whenever a stroke marks the grid
 * dirty. Pure view — it reads the grid, never mutates it.
 */
export class PaintOverlay {
  private readonly canvas = document.createElement('canvas');
  private readonly ctx: CanvasRenderingContext2D;
  private readonly texture: THREE.CanvasTexture;
  private readonly img: ImageData; // reused each redraw — no per-stroke reallocation at fine resolutions
  readonly mesh: THREE.Mesh;

  constructor(scene: THREE.Scene, private readonly grid: CollisionGrid) {
    this.canvas.width = grid.width;
    this.canvas.height = grid.height;
    this.ctx = this.canvas.getContext('2d')!;
    this.img = this.ctx.createImageData(grid.width, grid.height);

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.magFilter = THREE.NearestFilter; // crisp cell edges, not a blur
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.colorSpace = THREE.SRGBColorSpace;

    const worldW = grid.width * grid.cellSize;
    const worldH = grid.height * grid.cellSize;
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(worldW, worldH),
      // Depth test OFF (like the collision-debug cages): the wash draws over EVERYTHING, so every painted
      // cell is visible even where the raised ridge mesh would otherwise occlude the ground beneath it —
      // the editor shows the true painted footprint, not just the silhouette rim.
      new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, depthTest: false, depthWrite: false }),
    );
    this.mesh.rotation.x = -Math.PI / 2; // lie flat on the ground
    // Centre the plane over the grid's world extent. Grid col→+x, row→+z; the plane's +z half is its
    // canvas bottom, so flipY stays default and rows map the natural way (verified against the cursor).
    this.mesh.position.set(grid.originX + worldW / 2, 0.06, grid.originZ + worldH / 2);
    this.mesh.renderOrder = 999; // drawn last, over the world, so the full footprint always reads
    scene.add(this.mesh);

    this.redraw();
  }

  /** Repaint the wash from the grid's current cells into the reused buffer. */
  redraw(): void {
    const data = this.img.data;
    const cells = this.grid.cells;
    for (let i = 0; i < cells.length; i++) {
      const p = i * 4;
      data[p] = 230;     // r
      data[p + 1] = 60;  // g
      data[p + 2] = 60;  // b
      data[p + 3] = cells[i] === 1 ? 150 : 0; // only blocked cells are visible
    }
    this.ctx.putImageData(this.img, 0, 0);
    this.texture.needsUpdate = true;
  }
}
