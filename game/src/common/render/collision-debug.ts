import * as THREE from 'three';
import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { Collider } from '@common/components/collider';
import { Solid } from '@common/components/solid';

/**
 * A toggleable debug overlay that draws every `Collider`'s footprint as a wireframe cylinder cage, so the
 * collision shapes the sim actually uses are visible in the world. Colour tells the two roles apart:
 *   - RED   — a `Solid` collider that BLOCKS movers (workshop, shop, scrap pile, camp cache, grown tree).
 *   - CYAN  — a plain collider with no `Solid`: a pass-through footprint (the rig's own chassis, loose
 *             scrap, enemy guards, projectiles). Seeing both makes "what blocks vs. what I drive over" plain.
 * The cage radius is the exact `Collider.radius`, centred on the entity's Transform at ground level (the
 * sim is planar, so the footprint is a circle extruded to a readable height — not a true sphere).
 *
 * Generic render INFRASTRUCTURE (ADR-003 §4): it reads only `@common` components and knows nothing about
 * any feature. Off by default; `toggle()` is wired to a debug key in `app/bootstrap`. While off it holds no
 * scene objects. Drawn over everything (depth test off) so a footprint stays visible even inside its mesh.
 */

const SOLID_COLOR = 0xff5555;     // blocking
const PASS_COLOR = 0x33ddff;      // pass-through
const CAGE_HEIGHT = 1.2;          // how tall the extruded footprint reads (purely visual; the sim is planar)
const RADIAL_SEGMENTS = 32;       // smoothness of the top/bottom rings
const VERTICALS = 8;              // upright struts connecting the rings

/** A cylinder-cage line geometry of the given radius: a ring at the base, a ring at the top, and struts. */
function cageGeometry(radius: number): THREE.BufferGeometry {
  const pts: number[] = [];
  const ring = (y: number): void => {
    for (let i = 0; i < RADIAL_SEGMENTS; i++) {
      const a0 = (i / RADIAL_SEGMENTS) * Math.PI * 2;
      const a1 = ((i + 1) / RADIAL_SEGMENTS) * Math.PI * 2;
      pts.push(Math.cos(a0) * radius, y, Math.sin(a0) * radius, Math.cos(a1) * radius, y, Math.sin(a1) * radius);
    }
  };
  ring(0);
  ring(CAGE_HEIGHT);
  for (let i = 0; i < VERTICALS; i++) {
    const a = (i / VERTICALS) * Math.PI * 2;
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    pts.push(x, 0, z, x, CAGE_HEIGHT, z);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return geo;
}

interface Cage {
  lines: THREE.LineSegments;
  radius: number; // the radius the geometry was built for — rebuilt if the collider's radius changes
}

export class CollisionDebug {
  private readonly cages = new Map<EntityId, Cage>();
  private enabled = false;

  constructor(private readonly scene: THREE.Scene) {}

  /** Flip the overlay; returns the new state. Turning it off clears every cage from the scene. */
  toggle(): boolean {
    this.enabled = !this.enabled;
    if (!this.enabled) this.clear();
    return this.enabled;
  }

  /** Reconcile the cage set with every collider in the world this frame. A no-op while disabled. */
  sync(world: World): void {
    if (!this.enabled) return;
    const seen = new Set<EntityId>();
    for (const e of world.query(Transform, Collider)) {
      seen.add(e);
      this.upsert(world, e);
    }
    for (const [id, cage] of this.cages) {
      if (!seen.has(id)) {
        this.dispose(id, cage);
      }
    }
  }

  /** Create-or-update one entity's cage: rebuild on a radius change, follow its Transform, recolour by Solid. */
  private upsert(world: World, e: EntityId): void {
    const t = world.get(e, Transform)!;
    const radius = world.get(e, Collider)!.radius;
    let cage = this.cages.get(e);
    if (!cage || cage.radius !== radius) {
      if (cage) this.dispose(e, cage);
      const lines = new THREE.LineSegments(
        cageGeometry(radius),
        new THREE.LineBasicMaterial({ depthTest: false, depthWrite: false, transparent: true }),
      );
      lines.renderOrder = 999; // over the world, so a footprint shows even inside its own mesh
      this.scene.add(lines);
      cage = { lines, radius };
      this.cages.set(e, cage);
    }
    cage.lines.position.set(t.x, 0, t.z);
    (cage.lines.material as THREE.LineBasicMaterial).color.setHex(world.has(e, Solid) ? SOLID_COLOR : PASS_COLOR);
  }

  private dispose(id: EntityId, cage: Cage): void {
    this.scene.remove(cage.lines);
    cage.lines.geometry.dispose();
    (cage.lines.material as THREE.Material).dispose();
    this.cages.delete(id);
  }

  private clear(): void {
    for (const [id, cage] of this.cages) this.dispose(id, cage);
  }
}
