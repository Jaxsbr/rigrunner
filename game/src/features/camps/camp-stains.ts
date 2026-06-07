import * as THREE from 'three';
import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { Camp } from './camp';

/**
 * The camp's environmental mess: one large dark smudge laid flat under each camp. Pure view polish (it
 * owns only the decal + its eased opacity, reading the sim to know each camp's state), mirroring the
 * loose-scrap `ScrapStains` at camp scale. It carries the core loop's cause→effect:
 *   - a camp stands (`GUARDED`/`DISARMABLE`) → its stain holds, marking it as a blight on the land
 *   - the camp is `CLEARED` → its stain fades out = the world visibly cleans up as you finish the camp
 *
 * Phase-1 minimal: a single blotch per camp, not the layered damage Phase 3 brings. Like every render
 * layer here it's a one-way projection — destroy it and the sim is untouched.
 */

const STAIN_Y = 0.02; // a hair above the ground so it composites without z-fighting
const STAIN_RADIUS = 6; // a big puddle — a camp marks far more ground than a scrap piece
const STAIN_MAX_OPACITY = 0.7;
const FADE_OUT_EASE = 0.25; // slow clean-up creep once cleared (~12 s), never a pop

interface Stain {
  mesh: THREE.Mesh;
  progress: number;
}

export class CampStains {
  private readonly stains = new Map<EntityId, Stain>();
  private texture: THREE.Texture | null = null;

  constructor(private readonly scene: THREE.Scene) {}

  /** Reconcile a decal per camp; ease it out once the camp is cleared, dispose it when invisible. */
  sync(world: World, dt: number): void {
    for (const c of world.query(Camp, Transform)) {
      const stain = this.stains.get(c) ?? this.spawn(c, world);
      const cleared = world.get(c, Camp)!.state === 'cleared';
      this.ease(stain, cleared ? 0 : 1, cleared ? dt * FADE_OUT_EASE : 1); // snap in, fade out
    }
    for (const [id, stain] of this.stains) {
      if (world.isAlive(id) && world.has(id, Camp)) continue;
      this.dispose(id, stain); // the camp entity itself is gone — drop its decal
    }
  }

  private spawn(c: EntityId, world: World): Stain {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(STAIN_RADIUS * 2, STAIN_RADIUS * 2),
      new THREE.MeshBasicMaterial({ map: this.blobTexture(), transparent: true, opacity: 0, depthWrite: false }),
    );
    mesh.rotation.set(-Math.PI / 2, 0, Math.random() * Math.PI);
    const t = world.get(c, Transform)!;
    mesh.position.set(t.x, STAIN_Y, t.z);
    this.scene.add(mesh);
    const stain: Stain = { mesh, progress: 0 };
    this.stains.set(c, stain);
    return stain;
  }

  private ease(stain: Stain, target: number, k: number): void {
    let p = stain.progress + (target - stain.progress) * Math.min(1, k);
    if (Math.abs(target - p) < 0.001) p = target;
    stain.progress = p;
    (stain.mesh.material as THREE.MeshBasicMaterial).opacity = p * STAIN_MAX_OPACITY;
    stain.mesh.visible = p > 0.001;
  }

  private dispose(id: EntityId, stain: Stain): void {
    this.scene.remove(stain.mesh);
    stain.mesh.geometry.dispose();
    (stain.mesh.material as THREE.Material).dispose();
    this.stains.delete(id);
  }

  /** A soft dark blotch, drawn once and shared by every camp stain. */
  private blobTexture(): THREE.Texture {
    if (this.texture) return this.texture;
    const S = 128;
    const canvas = document.createElement('canvas');
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d')!;
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0.0, 'rgba(34,28,22,0.85)');
    g.addColorStop(0.55, 'rgba(44,36,26,0.45)');
    g.addColorStop(1.0, 'rgba(44,36,26,0.0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
    ctx.fill();
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.texture = tex;
    return tex;
  }
}
