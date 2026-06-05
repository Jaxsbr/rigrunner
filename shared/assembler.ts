import * as THREE from 'three';
import type { ModelLoader } from './model-loader';
import { MODEL_ASSETS } from './assets';
import { tintModel } from './model-tint';
import {
  DEFAULT_TIER,
  partIdentity,
  productComposition,
  tierOf,
  type TierId,
} from './part-identity';

/**
 * The shared product ASSEMBLER (`docs/part-identity-spec.md` §2b) — the ONE place a composed product is
 * built from its sub-parts, used by BOTH the game and the asset viewer. Given a product group and a tier
 * per sub-part, it loads the host model, finds its `socket_<slot>` empties by name (the convention in
 * `docs/asset-style.md` "Assembly sockets"), and snaps each child sub-part onto its socket — every piece
 * washed toward its OWN tier finish. Because both apps render a composed product through this same
 * function, a build reads identically in the viewer and in the world (the parity the descriptor in
 * `shared/part-identity.ts` exists to guarantee).
 *
 * It generalises the Reclaimer's `socket_wrist` head-attach to every product. The Reclaimer itself keeps
 * its own `ReclaimerRig` (it also animates), and the chassis renders as its whole functional GLB for now
 * — both are intentionally NOT in `PRODUCT_COMPOSITION`, so `assembleProduct` returns null for them and
 * the caller falls back to a single GLB.
 */

/** One sub-part in a composed product — what it is, the grade it wears, and whether a real GLB loaded. */
export interface AssembledItem {
  subPartId: string;
  assetId: string;
  tier: TierId;
  /** A registered GLB loaded, vs. a stand-in placeholder block (the coverage gap the viewer flags). */
  isRealModel: boolean;
  /** Triangle count of the (logical) piece — a render stat the viewer surfaces; 0 for a placeholder. */
  tris: number;
}

export interface Assembled {
  /** The composed whole — the host model with every child snapped onto its socket. Base-centre origin
   *  (the host's), so the caller adds it to a scene and it rests on the ground like any model. */
  group: THREE.Object3D;
  /** Each rendered piece (host first, then children in descriptor order), for HUD/coverage reporting. */
  items: AssembledItem[];
}

/** A neutral grade-washable block, shown for a sub-part whose GLB is missing or fails to load. */
function placeholderBlock(): THREE.Object3D {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.6, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x6b7077, roughness: 0.6, metalness: 0.2 }),
  );
  mesh.position.y = 0.3;
  return mesh;
}

/** Triangles in an object's geometry (whole subtree) — the render stat surfaced per composed piece. */
function countTris(obj: THREE.Object3D): number {
  let tris = 0;
  obj.traverse((node) => {
    const mesh = node as THREE.Mesh;
    const g = mesh.isMesh ? (mesh.geometry as THREE.BufferGeometry | undefined) : undefined;
    if (g) tris += g.index ? g.index.count / 3 : (g.attributes['position']?.count ?? 0) / 3;
  });
  return Math.round(tris);
}

/** Load a sub-part's model, cloned and washed to its tier finish; a tinted placeholder on a miss. */
async function loadGraded(
  assetId: string,
  tier: TierId,
  loader: ModelLoader,
): Promise<{ obj: THREE.Object3D; isRealModel: boolean; tris: number }> {
  const tint = tierOf(tier).finishColor;
  if (assetId in MODEL_ASSETS) {
    try {
      const obj = (await loader.load(assetId)).clone(true);
      tintModel(obj, tint);
      return { obj, isRealModel: true, tris: countTris(obj) };
    } catch {
      // fall through to a placeholder so one bad GLB doesn't sink the whole composed product
    }
  }
  const ph = placeholderBlock();
  tintModel(ph, tint);
  return { obj: ph, isRealModel: false, tris: 0 };
}

/**
 * The attach points on a host for a child's socket name. An exact match (`socket_rim`) is a single
 * attach; otherwise the numbered family `socket_<name>_<i>` (`socket_axle_0`, `_1`, …) — the
 * instanced-stations case — returned in index order so a child is placed at each station deterministically.
 */
function findSockets(host: THREE.Object3D, name: string): THREE.Object3D[] {
  const exact = host.getObjectByName(name);
  if (exact) return [exact];
  const prefix = `${name}_`;
  const family: Array<{ idx: number; obj: THREE.Object3D }> = [];
  host.traverse((o) => {
    if (!o.name.startsWith(prefix)) return;
    const idx = Number(o.name.slice(prefix.length));
    if (Number.isInteger(idx)) family.push({ idx, obj: o });
  });
  family.sort((a, b) => a.idx - b.idx);
  return family.map((f) => f.obj);
}

/**
 * Snap a product's child sub-parts onto an ALREADY-LOADED host model, each washed to its own tier, and
 * return the child items composed (the host is the caller's to account for). Where a host exposes a
 * numbered socket family for a child (`socket_axle_0..n`), the single child model is INSTANCED at every
 * station — the clones share the cached geometry/materials, so it's cheap and the logical part count is
 * unchanged (a purely visual repeat). A child whose socket the host doesn't expose is skipped rather than
 * dropped at the origin (where it would clip through the host); the gap shows as a missing piece.
 *
 * Exposed (not just used inside `assembleProduct`) so a surface that already loads the host itself can
 * compose onto it — the workshop inspect portrait loads the host through its own widget, then calls this.
 */
export async function attachSubParts(
  host: THREE.Object3D,
  groupId: string,
  tiers: Readonly<Record<string, TierId>>,
  loader: ModelLoader,
): Promise<AssembledItem[]> {
  const comp = productComposition(groupId);
  if (!comp) return [];
  const items: AssembledItem[] = [];
  for (const [subPartId, socketName] of Object.entries(comp.children)) {
    const ident = partIdentity(subPartId);
    if (!ident) continue;
    const sockets = findSockets(host, socketName);
    if (sockets.length === 0) continue; // host doesn't expose this socket — leave the child off
    const tier = tiers[subPartId] ?? DEFAULT_TIER;
    const { obj, isRealModel, tris } = await loadGraded(ident.assetId, tier, loader);
    sockets.forEach((socket, i) => {
      socket.add(i === 0 ? obj : obj.clone(true)); // one per station; extras are cheap cache-sharing clones
    });
    items.push({ subPartId, assetId: ident.assetId, tier, isRealModel, tris });
  }
  return items;
}

/**
 * Compose a whole product from its sub-parts: load the host, wash it to its tier, snap on every child.
 * Returns the composed group + an item per rendered piece — or `null` when the group has no composition
 * descriptor (the Reclaimer and chassis), so the caller can fall back to a single whole-product GLB.
 *
 * `tiers` maps each sub-part id to its grade; an absent sub-part defaults to the base tier.
 */
export async function assembleProduct(
  groupId: string,
  tiers: Readonly<Record<string, TierId>>,
  loader: ModelLoader,
): Promise<Assembled | null> {
  const comp = productComposition(groupId);
  if (!comp) return null;
  const hostIdent = partIdentity(comp.host);
  if (!hostIdent) return null;

  const hostTier = tiers[comp.host] ?? DEFAULT_TIER;
  const { obj: host, isRealModel, tris } = await loadGraded(hostIdent.assetId, hostTier, loader);
  const childItems = await attachSubParts(host, groupId, tiers, loader);
  return {
    group: host,
    items: [{ subPartId: comp.host, assetId: hostIdent.assetId, tier: hostTier, isRealModel, tris }, ...childItems],
  };
}
