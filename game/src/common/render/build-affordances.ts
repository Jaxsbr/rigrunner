import * as THREE from 'three';
import type { CellPose } from '@core/geometry';

/**
 * The build-mode affordances: the snap-target cell highlight and the carry shadow. Both are pure
 * view polish (no game truth) that the build controller toggles each frame to show where a carried
 * part will land. They live together because they cooperate visually — the shadow sits just above
 * the highlight so it composites cleanly over the glow.
 */

// The pad's base geometry: a single 1 m cell inset 0.05 m on every side, so it glows just inside the
// cell rather than touching the grid lines. A multi-cell pad (below) keeps the same inset off its
// region's outer edge.
const PAD_CELL = 0.9;
export class BuildAffordances {
  // Filled, glowing pad on the cell a carried part will snap into — a glowing pad rather than a
  // faint outline, so it reads as eager to accept the part. The group holds a fill + a bright
  // border; the fill material and the visible-since timestamp drive the breathing pulse and the
  // grow-in pop when it lands on a (new) cell.
  private readonly cellHighlight: THREE.Group;
  private readonly cellHighlightFill: THREE.MeshBasicMaterial;
  private cellHighlightShownAt = 0; // performance.now() the pad last landed on a (new) cell
  private cellHighlightX = 0;       // last cell centre, so a hop to a different cell replays the pop
  private cellHighlightZ = 0;
  private readonly carryShadow: THREE.Mesh;

  constructor(scene: THREE.Scene) {
    // glow_green FILLED square + bright border, laid flat. depthWrite off + a renderOrder keep it
    // from z-fighting the deck and let it glow over the surface. Pulse applied in showCellHighlight.
    this.cellHighlight = new THREE.Group();
    this.cellHighlightFill = new THREE.MeshBasicMaterial({
      color: 0x59ff9f, transparent: true, opacity: 0.4, depthWrite: false,
    });
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(PAD_CELL, PAD_CELL), this.cellHighlightFill);
    fill.renderOrder = 2;
    const border = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.PlaneGeometry(PAD_CELL, PAD_CELL)),
      new THREE.LineBasicMaterial({ color: 0x9dffc8, transparent: true, opacity: 0.95, depthWrite: false }),
    );
    border.renderOrder = 3;
    this.cellHighlight.add(fill, border);
    this.cellHighlight.rotation.x = -Math.PI / 2;
    this.cellHighlight.visible = false;
    scene.add(this.cellHighlight);

    // Carry shadow: a soft dark disc on the surface beneath a carried part, so the lift reads.
    this.carryShadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.45, 24),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 }),
    );
    this.carryShadow.rotation.x = -Math.PI / 2;
    this.carryShadow.visible = false;
    scene.add(this.carryShadow);
  }

  /**
   * The resting pad span, in metres, for a part's deck `footprint`. A multi-cell part (the 2×2
   * chassis kit) lights its WHOLE region, not just the centre cell: an N×M footprint spans N×M cells,
   * and the pad keeps the same 0.05 m inset off the region's outer edge that a single cell gets
   * (`PAD_CELL` = 1 − 0.1). So 1×1 → 0.9, 2×2 → 1.9. Pure maths, unit-tested.
   */
  static padMeters(footprint: { cols: number; rows: number }): { x: number; z: number } {
    const inset = 1 - PAD_CELL;
    return { x: footprint.cols - inset, z: footprint.rows - inset };
  }

  /**
   * Show the snap-target highlight at the given world pose (the footprint REGION's centre), sized to
   * `footprint` so a multi-cell part lights all the cells it will occupy — or hide it when null. The
   * pad breathes (opacity + scale) so the cell looks alive and eager to take the part, and grows
   * in with a quick pop the moment it lands on a (new) cell — a clear "this cell will accept it"
   * reaction, not a static marker. Both effects are pure view polish driven off the clock.
   */
  showCellHighlight(pose: CellPose | null, footprint: { cols: number; rows: number } = { cols: 1, rows: 1 }): void {
    if (!pose) {
      if (this.cellHighlight.visible) this.cellHighlightShownAt = 0; // reset so the pop replays next time
      this.cellHighlight.visible = false;
      return;
    }
    const now = performance.now();
    // Replay the pop whenever it first appears OR hops to a different cell (cells are 1 m apart),
    // so every time the part moves over a new cell that cell visibly reacts.
    const hopped = Math.hypot(pose.x - this.cellHighlightX, pose.z - this.cellHighlightZ) > 0.5;
    if (!this.cellHighlight.visible || hopped) this.cellHighlightShownAt = now;
    this.cellHighlight.visible = true;
    this.cellHighlightX = pose.x;
    this.cellHighlightZ = pose.z;
    this.cellHighlight.position.set(pose.x, pose.y + 0.02, pose.z);

    // Steady breathing pulse (~1.1 Hz): a gentle in/out so the pad always looks active. Settled
    // scale stays at 0.94–1.0 so the 0.9 m pad never reaches the 1 m cell edge.
    const t = now / 1000;
    const breathe = 0.5 + 0.5 * Math.sin(t * 7); // 0..1
    // Appear-pop: a quick grow-IN from small over ~180 ms when it lands on a (new) cell. It scales
    // UP toward the settled size (never past it), so the cell springs to grab the part without the
    // pad ever rendering larger than the cell on arrival.
    const age = (now - this.cellHighlightShownAt) / 180;
    const growIn = age >= 1 ? 1 : 1 - Math.pow(1 - age, 3); // easeOutCubic 0..1

    const settled = 0.94 + breathe * 0.06; // 0.94–1.0
    const scale = settled * (0.7 + 0.3 * growIn); // 70%→100% of settled on arrival, max = settled
    // Stretch the unit pad to the footprint's region (1×1 leaves it unchanged), then apply the
    // breathing/pop on top. The pad is rotated flat about X and turned by the part's facing below;
    // the only multi-cell part is the square 2×2 kit, so the per-axis stretch reads the same either way.
    const pad = BuildAffordances.padMeters(footprint);
    this.cellHighlight.scale.set((scale * pad.x) / PAD_CELL, (scale * pad.z) / PAD_CELL, 1);
    this.cellHighlight.rotation.set(-Math.PI / 2, 0, pose.rotationY);
    this.cellHighlightFill.opacity = (0.3 + breathe * 0.3) * (0.55 + 0.45 * growIn); // brighten as it grows in
  }

  /**
   * Show the carry shadow on the surface beneath a carried part (or hide it when null). `y` is
   * that surface's height — the rig's deck when the part hovers over it, the floor otherwise — so
   * the shadow climbs onto the blue platform instead of staying on the ground.
   *
   * Sits a touch ABOVE the cell highlight (which is at +0.02): when a part hovers over its snap
   * cell both land on the same deck, and lifting the shadow lets it composite cleanly on top of the
   * glowing pad instead of z-fighting it.
   */
  showCarryShadow(at: { x: number; z: number; y: number } | null): void {
    if (!at) {
      this.carryShadow.visible = false;
      return;
    }
    this.carryShadow.visible = true;
    this.carryShadow.position.set(at.x, at.y + 0.06, at.z);
  }
}
