import * as THREE from 'three';
import type { World } from '../core/world';
import { Velocity } from '../components/velocity';
import { Storage } from '../components/storage';
import { Digging } from '../components/digging';
import { ScrapPile } from '../components/scrap-pile';
import type { EntityViews } from './entity-views';
import type { ReclaimerRig } from './articulation';

/**
 * Sim-driven, per-object animations: each READS a sim component every frame and drives a
 * view-owned mesh, owning no game truth. They iterate the EntityViews cache and quietly no-op for
 * any object whose entity lacks the component they care about.
 */

/** Hub radius the rig's wheels were authored at (rig.py WHEEL_R) — converts m/s → rad/s. */
const WHEEL_RADIUS = 0.33;

// Storage fill block dimensions — kept in step with the tank cavity in tools/blender/assets/storage.py
// (OUTER 1.0, WALL_T 0.10, HEIGHT 0.90, CAVITY 0.80). The block sits just inside the walls, on the
// cavity floor, and stops below the raised rim collar.
const STORAGE_FLOOR_TOP = 0.10;   // interior floor (top of the carved base = WALL_T)
const STORAGE_FILL_W = 0.74;      // a touch inside the 0.80 m cavity
const STORAGE_FILL_MAX_H = 0.66;  // full-height of the fill, stopping just below the rim collar
const STORAGE_FILL_EASE = 7;      // how fast the shown level glides to the real fraction (per second)

/**
 * Code-driven wheel spin: roll each model's wheels about their axle (local X) at the owning
 * entity's speed. Deliberately not a baked glTF animation — tying it to Velocity keeps the
 * spin locked to the felt tradeoff, so a heavier, slower rig visibly turns its wheels slower.
 */
export function animateWheels(views: EntityViews, world: World, dt: number): void {
  for (const [id, obj] of views.objects) {
    const wheels = obj.userData['wheels'] as THREE.Object3D[] | undefined;
    if (!wheels || wheels.length === 0) continue;
    const vel = world.isAlive(id) ? world.get(id, Velocity) : undefined;
    if (!vel) continue;
    // Roll without slipping: v = ω·r about the axle (local X). Forward is −Z (movement.ts),
    // so a positive speed needs a negative dθ for the wheel tops to track the direction of travel.
    const dTheta = -(vel.speed * dt) / WHEEL_RADIUS;
    for (const w of wheels) w.rotation.x += dTheta;
  }
}

/**
 * Show how full each storage container is: a scrap-coloured block rising inside the open-top
 * cube. Like animateWheels, this READS a sim component (Storage) each frame and drives a
 * view-owned mesh — the World owns the truth (amount/capacity), the block is a disposable
 * projection. The block is a child of the container group, so it rides, turns, and (for any
 * scaled container) scales along with it for free. Works whether the container is mounted or
 * dropped loose, so a container always shows the cargo it's carrying.
 *
 * The level is *eased* toward the Storage fraction rather than snapped: when a piece of scrap
 * lands, amount jumps by a whole unit, but the block glides up to the new level over a few
 * frames so the fill reads as a graceful rise (and drains gracefully too). Purely cosmetic
 * smoothing — the displayed fraction is view state in userData, never game truth.
 */
export function animateStorageFill(views: EntityViews, world: World, dt: number): void {
  for (const [id, obj] of views.objects) {
    const storage = world.isAlive(id) ? world.get(id, Storage) : undefined;
    if (!storage) continue;

    const target = Math.max(0, Math.min(1, storage.amount / storage.capacity));

    let fill = obj.userData['fill'] as THREE.Mesh | undefined;
    if (!fill) {
      // Sized to sit just inside the cube cavity authored in tools/blender/assets/storage.py
      // (0.84 m interior, floor top at 0.08 m). Created at full height; we scale Y to the fraction.
      fill = new THREE.Mesh(
        new THREE.BoxGeometry(STORAGE_FILL_W, STORAGE_FILL_MAX_H, STORAGE_FILL_W),
        new THREE.MeshStandardMaterial({ color: 0x6b6b6b }), // scrap_grey
      );
      obj.add(fill);
      obj.userData['fill'] = fill;
      obj.userData['fillFrac'] = target; // start AT the current level (no spurious rise on spawn)
    }

    // Ease the displayed level toward the real fraction; snap when within a hair to settle it.
    let shown = obj.userData['fillFrac'] as number;
    shown += (target - shown) * Math.min(1, dt * STORAGE_FILL_EASE);
    if (Math.abs(target - shown) < 0.001) shown = target;
    obj.userData['fillFrac'] = shown;

    fill.visible = shown > 0.001;
    fill.scale.y = Math.max(0.0001, shown);
    // Anchor the block's base at the container floor; its top climbs as it fills.
    fill.position.y = STORAGE_FLOOR_TOP + (STORAGE_FILL_MAX_H * shown) / 2;
  }
}

/** How fast the arm deploys / retracts, in deploy-units per second (≈0.4 s for the full travel). */
const DEPLOY_RATE = 2.5;

/**
 * Drive each Reclaimer's articulated arm. Like the others this owns no game truth — it advances a
 * view-owned motion rig (built in EntityViews when the arm GLB loads, stored in userData) by the
 * frame's dt. It READS the sim's `Digging` marker (set on a Reclaimer by scrapRummageSystem while
 * the player works a pile) and ramps a view-side `deploy` factor toward 1 while digging, 0 while
 * idle — so the arm smoothly DEPLOYS out of its stowed scan to dig and RETRACTS back when work
 * stops. The blend lives in ReclaimerRig.drive; the ramp is the only view state here.
 */
export function animateReclaimer(views: EntityViews, world: World, dt: number): void {
  for (const [id, obj] of views.objects) {
    const rig = obj.userData['reclaimer'] as ReclaimerRig | null | undefined;
    if (!rig) continue;
    const elapsed = ((obj.userData['reclaimerElapsed'] as number) ?? 0) + dt;
    obj.userData['reclaimerElapsed'] = elapsed;

    const target = world.isAlive(id) && world.has(id, Digging) ? 1 : 0;
    let deploy = (obj.userData['reclaimerDeploy'] as number) ?? 0;
    const step = dt * DEPLOY_RATE;
    deploy += Math.sign(target - deploy) * Math.min(step, Math.abs(target - deploy)); // linear ramp
    obj.userData['reclaimerDeploy'] = deploy;

    rig.drive(elapsed, deploy);
  }
}

// A rummaged pile visibly shrinks as it empties. It never quite vanishes before the sim destroys it
// on empty, so it bottoms out at a floor fraction rather than at zero.
const PILE_SHRINK_FLOOR = 0.35;  // an emptying heap shrinks to this fraction of its full size
const PILE_SHRINK_EASE = 5;      // how fast the shown size glides to the real fraction (per second)

/**
 * Shrink each scrap pile toward its `remaining / total` depth: as hold-to-work drains waves off the
 * heap, it visibly slumps — the depletion is watched, not a counter (pillar 4). Like the storage
 * fill this READS a sim component (ScrapPile) each frame and eases a view-owned scale, so a wave's
 * whole-unit drop reads as a graceful settle. Uniform scale about the base-centre origin keeps the
 * heap grounded as it shrinks.
 */
export function animateScrapPile(views: EntityViews, world: World, dt: number): void {
  for (const [id, obj] of views.objects) {
    const pile = world.isAlive(id) ? world.get(id, ScrapPile) : undefined;
    if (!pile) continue;

    const frac = pile.total > 0 ? Math.max(0, Math.min(1, pile.remaining / pile.total)) : 0;
    const target = PILE_SHRINK_FLOOR + (1 - PILE_SHRINK_FLOOR) * frac;

    let shown = (obj.userData['pileScale'] as number) ?? target; // start AT the current depth on spawn
    shown += (target - shown) * Math.min(1, dt * PILE_SHRINK_EASE);
    obj.userData['pileScale'] = shown;
    obj.scale.setScalar(shown);
  }
}
