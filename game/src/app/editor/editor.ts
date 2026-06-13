import { World } from '@core/world';
import { Stage } from '@common/render/stage';
import { EntityViews } from '@common/render/entity-views';
import { Picker } from '@common/render/picker';
import { seedStaticStructures } from '../scenarios/static-structures';
import { CollisionGrid, type CollisionMap } from '@features/terrain/collision-grid';
import { OrthoControls } from './ortho-controls';
import { PaintOverlay } from './paint-overlay';
import { PaintController } from './paint-controller';
import { BrushCursor } from './brush-cursor';
import { EditorUI } from './editor-ui';
import { bakeMountainFootprint } from './mesh-bake';

const MAP_FILE = 'real-game.map.json';

/**
 * The map editor — `npm run dev:editor`. It seeds the real game's static structures as a backdrop and
 * loads the collision map FRESH FROM DISK over the dev endpoint (never a bundled import), so it always
 * sees the latest map and saving it doesn't HMR-reload the editor. LEFT-drag paints, RIGHT erases, the
 * brush-tip square shows where; Bake fills the wall from the mountain mesh; Save writes the grid straight
 * to the committed file. No driving sim runs. (`docs/specs/map-editor-spec.md`.)
 */
export async function startEditor(): Promise<void> {
  const canvas = document.querySelector<HTMLCanvasElement>('#view')!;

  const world = new World();
  seedStaticStructures(world); // workshop, world shop, mountain mesh, bench — the backdrop, map-free

  // The grid we paint: fetched live from disk, so a re-opened editor reflects the last Save.
  const grid = CollisionGrid.fromMap(await loadMap());

  const stage = new Stage(canvas);
  const views = new EntityViews(stage.scene);
  const controls = new OrthoControls(canvas);
  const picker = new Picker(controls.camera, canvas, views);
  const wash = new PaintOverlay(stage.scene, grid);
  const brush = new BrushCursor(stage.scene);

  const ui = new EditorUI({
    onBake: () => {
      const ok = bakeMountainFootprint(world, views, stage.scene, grid);
      wash.redraw();
      ui.setStatus(ok ? 'Baked the wall from the mountain mesh. Refine by painting, then Save.'
                      : 'Mountain mesh not loaded yet — try again in a moment.');
    },
    onSave: () => { void saveMap(); },
    onThicker: () => paint.setBrush(paint.brushRadius + 1),
    onThinner: () => paint.setBrush(paint.brushRadius - 1),
  });

  const paint = new PaintController(
    canvas, picker, grid, wash,
    (rect) => brush.set(rect),
    () => ui.setBrush(paint.brushRadius),
  );
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
  async function loadMap(): Promise<CollisionMap> {
    const res = await fetch(`/__map?file=${MAP_FILE}`);
    return (await res.json()) as CollisionMap;
  }

  /** POST the painted grid to the dev endpoint, which writes the committed map file. */
  async function saveMap(): Promise<void> {
    ui.setStatus('Saving…');
    try {
      const res = await fetch('/__map', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ file: MAP_FILE, data: grid.toMap() }),
      });
      ui.setStatus(res.ok ? `Saved ${MAP_FILE} ✓` : `Save failed: ${res.status} ${await res.text()}`);
    } catch (e) {
      ui.setStatus(`Save failed: ${String(e)}`);
    }
  }
}
