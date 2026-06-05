import * as THREE from 'three';

/** How far a material's colour is washed toward the tier finish — enough to read the grade, not so
 *  far it flattens the grey-box shading/detail. Tunable against feel. */
const TINT_STRENGTH = 0.55;

/**
 * Wash a loaded model's materials toward a tint colour — the tier-finish visual cue
 * (`docs/part-identity-spec.md` §3), so the same grey-box GLB reads as a different material grade just
 * by looking. Used by every model render path (the world `entity-views`, the workshop `deck-view`, and
 * the inspect `model-portrait`) so a part's tier looks the same wherever it's shown.
 *
 * Each mesh's material(s) are CLONED before recolouring, so the loader's shared cached template — every
 * other instance of this GLB — is left untouched; the clone's base colour is then lerped toward the
 * tint, shifting its hue while keeping the shading. Call on a freshly-cloned model instance, before any
 * view-owned children (e.g. the storage fill block) are added, so only the model itself is recoloured.
 */
export function tintModel(model: THREE.Object3D, tint: number): void {
  const target = new THREE.Color(tint);
  const recolor = (m: THREE.Material): THREE.Material => {
    const clone = m.clone();
    const c = clone as THREE.Material & { color?: THREE.Color };
    if (c.color) c.color.lerp(target, TINT_STRENGTH);
    return clone;
  };
  model.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(recolor) : recolor(mesh.material);
  });
}
