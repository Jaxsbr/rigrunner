import { World } from '@core/world';
import { Stage } from '@common/render/stage';
import { EntityViews } from '@common/render/entity-views';
import { Picker } from '@common/render/picker';
import { seedStaticWorld } from '../scenarios/real-game';
import { getWorldGrid } from '@features/terrain/world-grid';
import { OrthoControls } from './ortho-controls';
import { PaintOverlay } from './paint-overlay';
import { PaintController } from './paint-controller';
import { BrushCursor } from './brush-cursor';
import { EditorUI } from './editor-ui';
import { bakeMountainFootprint } from './mesh-bake';

const MAP_FILE = 'real-game.map.json';

/**
 * The map editor — `npm run dev:editor`. It seeds the real game's static world as a backdrop, then lets
 * you paint the collision grid directly against it from a top-down ortho view: LEFT-drag paints, RIGHT
 * erases, the brush-tip cursor shows where, and Bake fills the wall from the mountain mesh. Save writes
 * the grid straight to the committed map. No driving sim runs. (`docs/specs/map-editor-spec.md`.)
 */
export function startEditor(): void {
  const canvas = document.querySelector<HTMLCanvasElement>('#view')!;

  const world = new World();
  seedStaticWorld(world);
  const grid = getWorldGrid(world)!; // the committed map, loaded into a WorldGrid — exactly what we edit

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
    (worldPos, radius) => brush.set(worldPos, radius),
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

  /** POST the painted grid to the dev write-endpoint, which writes the committed map file. */
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
