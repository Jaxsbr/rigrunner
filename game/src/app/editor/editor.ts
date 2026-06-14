import { World } from '@core/world';
import { Stage } from '@common/render/stage';
import { EntityViews } from '@common/render/entity-views';
import { Picker } from '@common/render/picker';
import { seedStaticStructures } from '../scenarios/static-structures';
import { CollisionGrid } from '@features/terrain/collision-grid';
import type { WorldMap } from '../world-map/placement';
import { OrthoControls } from './ortho-controls';
import { PaintOverlay } from './paint-overlay';
import { PaintController } from './paint-controller';
import { BrushCursor } from './brush-cursor';
import { EditorUI } from './editor-ui';
import { PlacementStore } from './placement-store';
import { PlaceController } from './place-controller';
import { bakeMountainFootprint } from './mesh-bake';

const MAP_FILE = 'real-game.map.json';

/**
 * The map editor — `npm run dev:editor`. It seeds the map-free backdrop (mountain mesh + bench) and loads
 * the committed map FRESH FROM DISK over the dev endpoint (never a bundled import), so it always sees the
 * latest map and saving it doesn't HMR-reload the editor. Two modes share the canvas:
 *
 *  - PAINT — LEFT-drag paints collision, RIGHT erases; Bake re-derives the wall from the mountain mesh.
 *  - PLACE — drop / move / rotate / delete the authored layout (structures, props, camps, piles).
 *
 * Collision is ONE authoritative grid — the exact `blocked` bytes on disk. The editor loads it verbatim
 * (no re-derivation, so it always shows what you saved), the brush edits it directly (an erase sticks),
 * and a placed solid kind's footprint is stamped into it. Save writes that grid + the placement list.
 * "Bake from mesh" is destructive (it replaces the painted wall) so it asks first. No driving sim runs.
 * (`docs/specs/map-editor-spec.md`.)
 */
export async function startEditor(): Promise<void> {
  const canvas = document.querySelector<HTMLCanvasElement>('#view')!;

  const world = new World();
  seedStaticStructures(world); // mountain mesh + bench — the map-free backdrop the layout sits in

  // The collision grid, fetched live from disk and loaded VERBATIM — what you saved is what you see.
  const map = await loadMap();
  const grid = CollisionGrid.fromMap(map);

  const stage = new Stage(canvas);
  const views = new EntityViews(stage.scene);
  const controls = new OrthoControls(canvas);
  const picker = new Picker(controls.camera, canvas, views);
  const wash = new PaintOverlay(stage.scene, grid);
  const brush = new BrushCursor(stage.scene);

  // The authored layout: spawn the map's placements as entities + stamp/un-stamp their footprints.
  const store = new PlacementStore(world, grid, () => wash.redraw());
  store.load(map.placements ?? []);

  // `ui` is referenced by the controllers' callbacks before it's constructed, so bind it lazily.
  let ui: EditorUI;
  const place = new PlaceController(canvas, stage.scene, picker, store, (m) => ui.setStatus(m));
  const paint = new PaintController(
    canvas, picker, grid, wash,
    (rect) => brush.set(rect),
    () => ui.setBrush(paint.brushRadius),
  );

  ui = new EditorUI({
    onMode: (mode) => {
      paint.setActive(mode === 'paint');
      place.setActive(mode === 'place');
    },
    onBake: () => {
      // Destructive: this REPLACES the painted collision with the mountain mesh footprint, so confirm
      // first — a stray click must never wipe hand-painted work. On confirm, re-derive the wall then
      // re-stamp the placement footprints so structures stay solid.
      if (!confirm('Bake from mesh REPLACES the painted collision with the mountain mesh footprint, '
                 + 'discarding hand-painted edits. Continue?')) {
        ui.setStatus('Bake cancelled — your painted collision is untouched.');
        return;
      }
      const ok = bakeMountainFootprint(world, views, stage.scene, grid);
      wash.redraw();
      void store.restampAll();
      ui.setStatus(ok ? 'Baked the wall from the mountain mesh. Refine by painting, then Save.'
                      : 'Mountain mesh not loaded yet — try again in a moment.');
    },
    onSave: () => { void saveMap(); },
    onThicker: () => paint.setBrush(paint.brushRadius + 1),
    onThinner: () => paint.setBrush(paint.brushRadius - 1),
    onPickKind: (kind) => place.setKind(kind),
    onRoundRobin: (on) => place.setRoundRobin(on),
  });
  ui.setBrush(paint.brushRadius);

  window.addEventListener('resize', () => { stage.resize(); controls.resize(); });

  let last = performance.now();
  function frame(now: number): void {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    views.sync(world);
    controls.update(dt);
    stage.render(controls.camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /** Read the committed map fresh from disk via the dev GET endpoint. */
  async function loadMap(): Promise<WorldMap> {
    const res = await fetch(`/__map?file=${MAP_FILE}`);
    return (await res.json()) as WorldMap;
  }

  /** POST the map — the collision grid as `blocked` (verbatim) plus the authored layout. */
  async function saveMap(): Promise<void> {
    ui.setStatus('Saving…');
    try {
      const data: WorldMap = {
        ...grid.toMap(),
        placements: store.placements(),
      };
      const res = await fetch('/__map', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ file: MAP_FILE, data }),
      });
      ui.setStatus(res.ok ? `Saved ${MAP_FILE} ✓` : `Save failed: ${res.status} ${await res.text()}`);
    } catch (e) {
      ui.setStatus(`Save failed: ${String(e)}`);
    }
  }
}
