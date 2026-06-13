import * as THREE from 'three';
import type { World } from '@core/world';
import type { EntityViews } from '@common/render/entity-views';
import { Renderable } from '@common/components/renderable';
import { Transform } from '@common/components/transform';
import type { CollisionGrid } from '@features/terrain/collision-grid';
import { rasterizeFootprint } from '@features/terrain/footprint-bake';

// Standing rock is the surface above this world height; the sunk feet and gap floors (modelled below the
// floor in `mountain_range.py`, and visibly below y=0 in-game) fall under it, so the gaps stay drivable.
const FLOOR_EPS = 0.5;

/**
 * Re-bake the bowl wall's collision footprint from the loaded mountain mesh — the editor's "accurate seed
 * from the art". Clears the grid, then rasterizes every standing-rock triangle of the `mountain-range`
 * mesh (in WORLD space, so whatever transform the renderer applied is honoured) into blocked cells. The
 * result traces the real irregular silhouette; the human then refines edges by painting. Returns false if
 * the mesh isn't found / loaded yet.
 */
export function bakeMountainFootprint(
  world: World,
  views: EntityViews,
  scene: THREE.Scene,
  grid: CollisionGrid,
): boolean {
  scene.updateMatrixWorld(true);

  let obj: THREE.Object3D | undefined;
  for (const e of world.query(Renderable, Transform)) {
    const r = world.get(e, Renderable)!;
    if (r.shape === 'model' && r.assetId === 'mountain-range') {
      obj = views.get(e);
      break;
    }
  }
  if (!obj) return false;

  grid.cells.fill(0); // re-bake from scratch (discards any prior paint — it's a seed regenerate)

  const v = new THREE.Vector3();
  let baked = false;
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const geo = mesh.geometry as THREE.BufferGeometry;
    const pos = geo.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!pos) return;

    const positions = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(mesh.matrixWorld);
      positions[i * 3] = v.x;
      positions[i * 3 + 1] = v.y;
      positions[i * 3 + 2] = v.z;
    }
    const index = geo.index ? geo.index.array : null;
    rasterizeFootprint(grid, positions, index, FLOOR_EPS);
    baked = true;
  });
  return baked;
}
