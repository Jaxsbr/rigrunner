import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MODEL_ASSETS } from './assets';

/**
 * Loads GLB model templates by `assetId`, caching the promise per id so a model is fetched
 * and parsed at most once. Callers `.clone(true)` the returned template if they need their
 * own instance (the game does, one clone per entity); the viewer shows the template directly.
 *
 * Shared by the game's render layer and the asset viewer so both resolve assets the same way
 * (via `shared/assets.ts`) and neither re-implements GLTF loading.
 */
export class ModelLoader {
  private readonly loader = new GLTFLoader();
  private readonly cache = new Map<string, Promise<THREE.Object3D>>();

  /** Promise of the loaded template scene for `assetId`. Rejects if the id isn't registered. */
  load(assetId: string): Promise<THREE.Object3D> {
    let template = this.cache.get(assetId);
    if (!template) {
      const url = MODEL_ASSETS[assetId];
      template = url
        ? this.loader.loadAsync(url).then((gltf) => gltf.scene)
        : Promise.reject(
            new Error(`Unknown model assetId '${assetId}' — register it in shared/assets.ts`),
          );
      this.cache.set(assetId, template);
    }
    return template;
  }
}
