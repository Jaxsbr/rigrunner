import * as THREE from 'three';
import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import type { EntityViews } from '@common/render/entity-views';
import { seededRng } from '@common/sim/rng';
import { Healable } from './healable';

/**
 * The growing-tree render: a procedural young tree that rises out of a healable stump as the player works
 * the stump-healer, posed each frame from the sim's `Healable.growth` (0→1). Pure view polish — it owns
 * only the meshes and reads `growth`, never writing it. Dispatched from `main.ts` (ADR-003 §4) so the
 * shared render tier imports no feature.
 *
 * The tree is built ONCE (a flat set of branch + leaf groups) and parented under the stump's own render
 * object, so it inherits the stump's pose (including the rise-from-soil animation). The growth value is
 * mapped across THREE stages, matching the felt beat of "I grew a tree":
 *   - Stage 1 (0 → 1/3): a single trunk shoots up from the stump top and thickens to ~¼ the stump's
 *     width, ending in a point, with two leaf nodes (mid + near-top) — the existing sprout growing.
 *   - Stage 2 (1/3 → 2/3): the trunk thickens to ~½ the stump and grows taller; a branch springs from
 *     each of the two nodes (up + outward), each carrying 2–3 leaf nodes.
 *   - Stage 3 (2/3 → 1): each of those nodes spreads into its own branch with 2–3 leaves — a young tree
 *     of ~15–20 leaves whose trunk never fully covers the stump.
 * A node's transitional leaf fades out as its child branch grows FROM it, so a leaf visibly "becomes" a
 * branch — the final foliage lives at the stage-3 twig tips. Branch azimuths fan around the trunk (golden
 * angle), so the crown reads balanced from any camera angle.
 *
 * The skeleton is seeded off the stump's entity id, so each tree is deterministic (stable frame-to-frame)
 * yet differs stump-to-stump.
 */

const STUMP_TOP_Y = 0.34;       // where the trunk emerges from the camp-sprout stump's cut top (model units)
const TREE_SCALE = 2.0;         // overall size of the young tree — built at unit scale, then scaled up as a
                                // whole about its base so a fully-grown tree reads as a real sapling, not a twig
const GOLDEN = 2.399963229728653; // golden angle (rad) — fans successive branches evenly around the trunk
const TRUNK_LEN = 1.15;
const TRUNK_BASE_R = 0.24;      // full trunk radius (~½ the ~0.48 stump radius) — reached only at growth 1

const BARK_COLOR = 0x7a4329;    // weathered-wood brown — the palette's rust, nudged darker/earthier for bark
const LEAF_COLOR = 0x6f8a3f;    // dusty sage-green — restoration foliage muted + warmed to sit in the
                                // sun-baked wasteland (the saturated nature_green popped as neon under the warm sun)

const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);
const easeOut = (t: number): number => 1 - (1 - t) * (1 - t);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** The growth window [start,end] each depth's branches extend over — the three stages. */
const WINDOW: ReadonlyArray<readonly [number, number]> = [
  [0.0, 0.33], // depth 0 — the trunk
  [0.33, 0.66], // depth 1 — branches off the trunk's nodes
  [0.66, 1.0], // depth 2 — twigs off those branches; the final foliage
];

interface Segment {
  group: THREE.Group; // posed by scaling along its local +Y (length) and x/z (thickness)
  start: number;
  end: number;
  trunk: boolean;
}

interface Leaf {
  group: THREE.Group;
  popStart: number;
  popEnd: number;
  size: number;
  /** A child branch whose growth fades this (transitional) leaf out, or undefined for a final leaf. */
  fade?: Segment;
}

interface Tree {
  root: THREE.Group;
  segments: Segment[];
  leaves: Leaf[];
}

const UP = new THREE.Vector3(0, 1, 0);

export class TreeGrower {
  private readonly trees = new Map<EntityId, Tree>();
  private readonly bark = new THREE.MeshStandardMaterial({ color: BARK_COLOR, roughness: 0.85, metalness: 0 });
  private readonly leafMat = new THREE.MeshStandardMaterial({ color: LEAF_COLOR, roughness: 0.8, metalness: 0, side: THREE.DoubleSide });
  private readonly leafGeo = new THREE.BoxGeometry(0.26, 0.03, 0.16); // a broad, flat leaf (broad face = local XZ)

  /** Build/pose a growing tree under each healable stump that has begun growing; dispose finished ones. */
  sync(views: EntityViews, world: World): void {
    // Drop trees whose stump is gone or no longer healable.
    for (const id of [...this.trees.keys()]) {
      if (!world.isAlive(id) || !world.has(id, Healable)) this.disposeTree(id);
    }
    for (const e of world.query(Healable)) {
      const growth = world.get(e, Healable)!.growth;
      if (growth <= 0.001) continue; // unhealed — the stump's own baked sprout is the resting state
      const host = views.get(e);
      if (!host) continue; // the stump's object hasn't been created yet (GLB still loading its group)
      let tree = this.trees.get(e);
      if (!tree) {
        tree = this.build(e);
        host.add(tree.root);
        this.trees.set(e, tree);
      }
      this.pose(tree, growth);
    }
  }

  /** Free a tree's per-branch geometries and detach it from the scene graph. Shared materials/leaf
   *  geometry are pooled across trees, so they are NOT disposed here. */
  private disposeTree(id: EntityId): void {
    const tree = this.trees.get(id);
    if (!tree) return;
    tree.root.removeFromParent();
    tree.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && mesh.geometry !== this.leafGeo) mesh.geometry.dispose();
    });
    this.trees.delete(id);
  }

  /** Construct the tree skeleton (a flat list of branch + leaf groups) for one stump. */
  private build(seed: EntityId): Tree {
    const rng = seededRng((seed + 1) * 2654435761);
    const root = new THREE.Group();
    const segments: Segment[] = [];
    const leaves: Leaf[] = [];

    const addBranch = (
      base: THREE.Vector3, dir: THREE.Vector3, length: number, baseR: number, tipR: number, trunk: boolean,
    ): Segment => {
      const geo = new THREE.CylinderGeometry(tipR, baseR, length, 6);
      geo.translate(0, length / 2, 0); // base at the group origin; the branch extends along +Y
      const mesh = new THREE.Mesh(geo, this.bark);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const group = new THREE.Group();
      group.add(mesh);
      group.position.copy(base);
      group.quaternion.setFromUnitVectors(UP, dir);
      root.add(group);
      const seg: Segment = { group, start: 0, end: 1, trunk }; // window filled in by the caller (`grow`)
      segments.push(seg);
      return seg;
    };

    const addLeaf = (pos: THREE.Vector3, lean: THREE.Vector3, popStart: number, popEnd: number, fade?: Segment): void => {
      const mesh = new THREE.Mesh(this.leafGeo, this.leafMat);
      mesh.castShadow = true;
      const group = new THREE.Group();
      group.add(mesh);
      group.position.copy(pos);
      group.quaternion.setFromUnitVectors(UP, lean);
      group.rotateY(rng() * Math.PI * 2); // spin the leaf around its outward axis so they don't all align
      group.scale.setScalar(0); // hidden until it pops
      root.add(group);
      leaves.push({ group, popStart, popEnd, size: 0.8 + rng() * 0.5, fade });
    };

    // An outward+upward direction at (azimuth, polar), blended with the parent's heading so children
    // continue the limb's general direction while fanning out. polar 0 = straight up; larger = more outward.
    const outward = (az: number, polar: number, parent: THREE.Vector3): THREE.Vector3 =>
      new THREE.Vector3(Math.sin(polar) * Math.cos(az), Math.cos(polar), Math.sin(polar) * Math.sin(az))
        .multiplyScalar(0.7)
        .addScaledVector(parent, 0.3)
        .normalize();

    // Recursively grow a branch and everything it carries, within the window for its depth.
    const grow = (
      base: THREE.Vector3, dir: THREE.Vector3, length: number, baseR: number, depth: number, parentAz: number,
    ): Segment => {
      const [start, end] = WINDOW[depth]!;
      const seg = addBranch(base, dir, length, baseR, baseR * 0.35, depth === 0);
      seg.start = start;
      seg.end = end;

      if (depth === 2) {
        // Terminal twig: a cluster of FINAL leaves along its upper length — the canopy.
        const n = 3 + Math.floor(rng() * 2); // 3–4
        for (let k = 0; k < n; k++) {
          const az = parentAz + k * GOLDEN + (rng() - 0.5) * 0.5;
          const lean = outward(az, 0.85 + rng() * 0.4, dir);
          const at = base.clone().addScaledVector(dir, length * (0.55 + 0.45 * rng()));
          addLeaf(at, lean, end - 0.14, end);
        }
        return seg;
      }

      // Interior branch: nodes that each spring a child branch (next stage) + a transitional leaf that
      // fades as that child grows. The trunk has exactly two nodes (mid + near-top), placed on opposite
      // sides; deeper branches carry 2–3, fanned by the golden angle.
      const nodes = depth === 0 ? 2 : 2 + Math.floor(rng() * 2);
      const childLen = length * 0.62;
      const childR = baseR * 0.55;
      for (let i = 0; i < nodes; i++) {
        const u = depth === 0 ? (i === 0 ? 0.5 : 0.86) : 0.45 + 0.45 * (nodes === 1 ? 0 : i / (nodes - 1));
        const nodePos = base.clone().addScaledVector(dir, length * u);
        const az = parentAz + (depth === 0 ? i * Math.PI : i * GOLDEN) + (rng() - 0.5) * 0.7;
        const cdir = outward(az, 0.8 + rng() * 0.35, dir);
        const childSeg = grow(nodePos, cdir, childLen, childR, depth + 1, az);
        addLeaf(nodePos.clone().addScaledVector(cdir, 0.06), cdir, end - 0.12, end, childSeg);
      }
      return seg;
    };

    const trunkDir = new THREE.Vector3((rng() - 0.5) * 0.12, 1, (rng() - 0.5) * 0.12).normalize();
    // Build with the trunk base at the local origin, then anchor the whole tree at the stump top and scale
    // it up about that base — so scaling changes its SIZE without lifting it off the stump.
    grow(new THREE.Vector3(0, 0, 0), trunkDir, TRUNK_LEN, TRUNK_BASE_R, 0, rng() * Math.PI * 2);
    root.position.set(0, STUMP_TOP_Y, 0);
    root.scale.setScalar(TREE_SCALE);

    return { root, segments, leaves };
  }

  /** Pose every branch + leaf for the current growth value. */
  private pose(tree: Tree, growth: number): void {
    for (const seg of tree.segments) {
      const p = easeOut(clamp01((growth - seg.start) / (seg.end - seg.start)));
      if (seg.trunk) {
        // The trunk reaches full LENGTH by the end of stage 1, then keeps THICKENING through stages 2–3
        // (~¼ → ~½ the stump's width), so the young tree visibly fattens as its crown fills out.
        const stage1 = easeOut(clamp01(growth / WINDOW[0]![1]));
        const later = clamp01((growth - WINDOW[0]![1]) / (1 - WINDOW[0]![1]));
        const rad = 0.5 * stage1 + 0.5 * later;
        seg.group.scale.set(rad, p, rad);
        seg.group.visible = p > 0.001;
      } else {
        const rxy = lerp(0.3, 1, p);
        seg.group.scale.set(rxy, p, rxy);
        seg.group.visible = p > 0.001;
      }
    }
    for (const leaf of tree.leaves) {
      let s = easeOut(clamp01((growth - leaf.popStart) / (leaf.popEnd - leaf.popStart)));
      if (leaf.fade) s *= 1 - clamp01((growth - leaf.fade.start) / (leaf.fade.end - leaf.fade.start));
      leaf.group.scale.setScalar(s * leaf.size);
      leaf.group.visible = s > 0.01;
    }
  }
}
