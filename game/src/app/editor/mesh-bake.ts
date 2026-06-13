import * as THREE from 'three';
import type { World } from '@core/world';
import type { EntityViews } from '@common/render/entity-views';
import { Renderable } from '@common/components/renderable';
import { Transform } from '@common/components/transform';
import type { CollisionGrid } from '@features/terrain/collision-grid';
import { rasterizeFootprint } from '@features/terrain/footprint-bake';

// Standing geometry is the surface above this world height; sunk feet and gap floors (modelled below the
// floor in the asset scripts, and visibly below y=0 in-game) fall under it, so they never block. Tuned to
// the mountain's sunk gaps; tall structures (workshop, shop, scrap heap) stand well clear of it.
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
  return rasterizeObject(obj, grid, FLOOR_EPS);
}

/**
 * Bake a loaded GLB TEMPLATE's standing footprint into a grid at an arbitrary placement transform — the
 * map editor's auto-bake-on-placement (`placement-store.ts`). Unlike `bakeMountainFootprint` this reads a
 * loaded template directly (the placement's own model, fetched off the model loader), so it never depends
 * on the entity being rendered yet, and stamps it at (x,z) rotated `rotationY` and scaled. ADDITIVE: it
 * marks cells blocked, leaving the rest of the grid (the base layer + other footprints) untouched, so a
 * caller composes many placements into one effective grid.
 */
export function bakeTemplateFootprint(
  template: THREE.Object3D,
  grid: CollisionGrid,
  x: number,
  z: number,
  rotationY: number,
  scale = 1,
): boolean {
  template.updateMatrixWorld(true); // resolve the template's own local hierarchy into matrixWorld
  // The world placement: translate to (x,0,z), rotate about +Y, uniformly scale — the same transform the
  // renderer applies to the placement entity, so the baked footprint and the visible model agree.
  const place = new THREE.Matrix4().compose(
    new THREE.Vector3(x, 0, z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotationY),
    new THREE.Vector3(scale, scale, scale),
  );
  return rasterizeObject(template, grid, FLOOR_EPS, place);
}

/**
 * Rasterize every standing mesh under `obj` into the grid. `pre`, when given, is an extra WORLD transform
 * applied outside each mesh's own `matrixWorld` (the placement matrix for a template); without it the
 * mesh's `matrixWorld` is taken as-is (a mesh already positioned in the scene). The caller is responsible
 * for having updated the relevant matrices. Returns true if it rasterized at least one mesh.
 */
function rasterizeObject(obj: THREE.Object3D, grid: CollisionGrid, floorEps: number, pre?: THREE.Matrix4): boolean {
  const m = new THREE.Matrix4();
  const v = new THREE.Vector3();
  let baked = false;
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const geo = mesh.geometry as THREE.BufferGeometry;
    const pos = geo.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!pos) return;

    if (pre) m.multiplyMatrices(pre, mesh.matrixWorld);
    else m.copy(mesh.matrixWorld);

    const positions = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(m);
      positions[i * 3] = v.x;
      positions[i * 3 + 1] = v.y;
      positions[i * 3 + 2] = v.z;
    }
    rasterizeFootprint(grid, positions, geo.index ? geo.index.array : null, floorEps);
    baked = true;
  });
  return baked;
}
