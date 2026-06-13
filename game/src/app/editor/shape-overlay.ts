import * as THREE from 'three';
import { sampleSpline, type CollisionShape } from '@features/terrain/collision-shapes';

/**
 * Renders the editable vector collision shapes over the scene: each path as its smooth spline line, with
 * a draggable marker on every control point. The red grid wash underneath shows the COMPILED collision;
 * these crisp lines are the resolution-independent source you actually edit. Rebuilt on every change
 * (few shapes/points, so cheap), drawn depth-test-off so it sits over the terrain.
 */

const ADD_COLOR = 0x39d7ff;      // a path that adds collision
const CARVE_COLOR = 0xff8a3d;    // a path that carves it away
const DRAWING_COLOR = 0x76ff8a;  // the path currently being drawn
const POINT_COLOR = 0xffffff;
const SELECTED_COLOR = 0xffe04d;

export class ShapeOverlay {
  private readonly group = new THREE.Group();

  constructor(scene: THREE.Scene) {
    this.group.renderOrder = 1000;
    scene.add(this.group);
  }

  /** Rebuild the lines + point handles for the current shapes. `pointRadius` is world-size for a marker. */
  sync(
    shapes: CollisionShape[],
    selected: { shape: number; point: number } | null,
    drawingIndex: number | null,
    pointRadius: number,
  ): void {
    for (const child of [...this.group.children]) {
      this.group.remove(child);
      disposeObject(child);
    }

    shapes.forEach((shape, si) => {
      const poly = sampleSpline(shape.points, shape.closed);
      if (poly.length >= 2) {
        const geo = new THREE.BufferGeometry().setFromPoints(poly.map((p) => new THREE.Vector3(p.x, 0.14, p.z)));
        const color = si === drawingIndex ? DRAWING_COLOR : shape.carve ? CARVE_COLOR : ADD_COLOR;
        const line = new THREE.Line(geo, lineMat(color));
        line.renderOrder = 1000;
        this.group.add(line);
      }
      shape.points.forEach((p, pi) => {
        const isSel = selected !== null && selected.shape === si && selected.point === pi;
        const marker = new THREE.Mesh(
          new THREE.SphereGeometry(isSel ? pointRadius * 1.6 : pointRadius, 12, 8),
          new THREE.MeshBasicMaterial({ color: isSel ? SELECTED_COLOR : POINT_COLOR, depthTest: false, depthWrite: false, transparent: true }),
        );
        marker.position.set(p.x, 0.16, p.z);
        marker.renderOrder = 1001;
        this.group.add(marker);
      });
    });
  }
}

function lineMat(color: number): THREE.LineBasicMaterial {
  return new THREE.LineBasicMaterial({ color, depthTest: false, depthWrite: false, transparent: true });
}

function disposeObject(o: THREE.Object3D): void {
  const any = o as THREE.Mesh | THREE.Line;
  any.geometry?.dispose();
  const m = any.material;
  if (Array.isArray(m)) m.forEach((x) => x.dispose());
  else m?.dispose();
}
