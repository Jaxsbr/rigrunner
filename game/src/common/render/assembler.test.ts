import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import type { ModelLoader } from '@shared/model-loader';
import { assembleProduct } from '@shared/assembler';

/**
 * The shared assembler composes a product from its sub-parts by snapping each child onto the host's
 * `socket_<slot>` empties. These tests drive it with a FAKE loader (synthetic hosts whose named empties
 * stand in for the GLB sockets), so the composition logic — socket lookup, instancing across a numbered
 * family, per-sub-part grading, and the graceful skips — is verified without real GLBs or a GPU.
 */

/** A loader that hands back fresh synthetic templates per assetId; a missing id rejects (→ placeholder). */
function fakeLoader(make: Record<string, () => THREE.Object3D>): ModelLoader {
  return {
    load: (id: string): Promise<THREE.Object3D> =>
      make[id] ? Promise.resolve(make[id]!()) : Promise.reject(new Error(`no fake model for '${id}'`)),
  } as unknown as ModelLoader;
}

/** A stand-in host: a group carrying the named socket empties a real host GLB would export. */
function hostWith(...socketNames: string[]): THREE.Object3D {
  const g = new THREE.Group();
  g.name = 'host';
  for (const n of socketNames) {
    const s = new THREE.Object3D();
    s.name = n;
    g.add(s);
  }
  return g;
}

const childMesh = (): THREE.Object3D =>
  new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshStandardMaterial({ color: 0xffffff }));

describe('assembleProduct', () => {
  it('snaps each engine sub-part onto its host socket, host first, each at its own tier', async () => {
    const loader = fakeLoader({
      'e-casing': () => hostWith('socket_core', 'socket_coupling', 'socket_regulator'),
      'e-core': childMesh,
      'e-coupling': childMesh,
      'e-regulator': childMesh,
    });

    const res = await assembleProduct(
      'electric-engine',
      { 'e-casing': 'iron', 'e-core': 'rusty', 'e-coupling': 'iron', 'e-regulator': 'rusty' },
      loader,
    );

    expect(res).not.toBeNull();
    expect(res!.items.map((i) => i.subPartId)).toEqual(['e-casing', 'e-core', 'e-coupling', 'e-regulator']);
    // Each child parented under exactly its socket (origin snapped to the attach point).
    for (const s of ['socket_core', 'socket_coupling', 'socket_regulator']) {
      expect(res!.group.getObjectByName(s)!.children).toHaveLength(1);
    }
    expect(res!.items.find((i) => i.subPartId === 'e-casing')!.tier).toBe('iron'); // the host
    expect(res!.items.find((i) => i.subPartId === 'e-core')!.tier).toBe('rusty');
    expect(res!.items.every((i) => i.isRealModel)).toBe(true);
  });

  it('instances a single child model across a numbered socket family (the chassis-style stations)', async () => {
    // The storage child maps to `socket_rim`; a host exposing only `socket_rim_0/1` (no exact match)
    // exercises the instanced-family path — the one shared model is placed at every station.
    const loader = fakeLoader({
      'container-shell': () => hostWith('socket_rim_0', 'socket_rim_1'),
      'container-rim': childMesh,
    });

    const res = await assembleProduct('storage', {}, loader);

    expect(res!.items.map((i) => i.subPartId)).toEqual(['container-shell', 'container-rim']); // one logical child
    expect(res!.group.getObjectByName('socket_rim_0')!.children).toHaveLength(1);
    expect(res!.group.getObjectByName('socket_rim_1')!.children).toHaveLength(1); // instanced at both
  });

  it('skips a child whose socket the host does not expose (no clipping at the origin)', async () => {
    const loader = fakeLoader({
      'container-shell': () => new THREE.Group(), // host with no sockets at all
      'container-rim': childMesh,
    });

    const res = await assembleProduct('storage', {}, loader);

    expect(res!.items.map((i) => i.subPartId)).toEqual(['container-shell']); // rim left off, not dropped at 0,0,0
  });

  it('falls back to a tinted placeholder for a child whose GLB fails to load, still composed', async () => {
    const loader = fakeLoader({
      'e-casing': () => hostWith('socket_core', 'socket_coupling', 'socket_regulator'),
      // 'e-core' intentionally absent → its load rejects
      'e-coupling': childMesh,
      'e-regulator': childMesh,
    });

    const res = await assembleProduct('electric-engine', {}, loader);

    expect(res!.items.find((i) => i.subPartId === 'e-core')!.isRealModel).toBe(false);
    expect(res!.group.getObjectByName('socket_core')!.children).toHaveLength(1); // placeholder still attached
  });

  it('composes a chassis from its per-size Frame host + Wheel/Suspension units instanced per corner', async () => {
    // The 1×3 Frame exposes 6 axle + 6 suspension corner stations; the single Wheel and Suspension units
    // each instance onto every one of their family's stations (the chassis-style numbered sockets).
    const corners = (prefix: string): string[] => [0, 1, 2, 3, 4, 5].map((i) => `${prefix}_${i}`);
    const loader = fakeLoader({
      'frame-1x3': () => hostWith(...corners('socket_axle'), ...corners('socket_susp')),
      'wheel-axle-1x3': childMesh,
      'suspension-steering-1x3': childMesh,
    });

    const res = await assembleProduct('chassis-1x3', { 'frame-1x3': 'iron', 'wheel-axle-1x3': 'rusty' }, loader);

    expect(res).not.toBeNull();
    // One logical part each (host first), even though the wheel/suspension render at six stations apiece.
    expect(res!.items.map((i) => i.subPartId)).toEqual(['frame-1x3', 'wheel-axle-1x3', 'suspension-steering-1x3']);
    for (const s of corners('socket_axle')) expect(res!.group.getObjectByName(s)!.children).toHaveLength(1);
    for (const s of corners('socket_susp')) expect(res!.group.getObjectByName(s)!.children).toHaveLength(1);
    expect(res!.items.find((i) => i.subPartId === 'frame-1x3')!.tier).toBe('iron'); // the host wears its own grade
    expect(res!.items.find((i) => i.subPartId === 'wheel-axle-1x3')!.tier).toBe('rusty');
  });

  it('returns null for products that do not compose via the assembler (the Reclaimer)', async () => {
    const loader = fakeLoader({});
    expect(await assembleProduct('reclaimer', {}, loader)).toBeNull();
    expect(await assembleProduct('not-a-product', {}, loader)).toBeNull();
  });
});
