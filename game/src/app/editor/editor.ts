import { World } from '@core/world';
import { Stage } from '@common/render/stage';
import { EntityViews } from '@common/render/entity-views';
import { Picker } from '@common/render/picker';
import { seedStaticWorld } from '../scenarios/real-game';
import { getWorldGrid } from '@features/terrain/world-grid';
import type { CollisionMap } from '@features/terrain/collision-grid';
import { OrthoControls } from './ortho-controls';
import { PaintOverlay } from './paint-overlay';
import { PaintController } from './paint-controller';
import { EditorUI } from './editor-ui';
import { bakeMountainFootprint } from './mesh-bake';

// Where the committed map lives, relative to the maps dir the dev write-endpoint guards.
const MAP_FILE = 'real-game.map.json';

/**
 * The map editor — launched by `npm run dev:editor`. It seeds the real game's STATIC world (ground +
 * mountain mesh + shops) as a backdrop, then lets you paint the static collision grid against it from a
 * top-down ortho view and save it straight to the committed map file. No driving sim runs — the editor is
 * authoring, not play. (`docs/specs/map-editor-spec.md`.)
 */
export function startEditor(): void {
  const canvas = document.querySelector<HTMLCanvasElement>('#view')!;

  // The backdrop world: the same static scaffolding the real game lays (and it loads the committed grid
  // into a WorldGrid, which is exactly the grid we edit).
  const world = new World();
  seedStaticWorld(world);
  const grid = getWorldGrid(world)!;

  const stage = new Stage(canvas);
  const views = new EntityViews(stage.scene);
  const controls = new OrthoControls(canvas);
  const picker = new Picker(controls.camera, canvas, views);
  const overlay = new PaintOverlay(stage.scene, grid);

  const ui = new EditorUI({
    onBake: () => {
      const ok = bakeMountainFootprint(world, views, stage.scene, grid);
      overlay.redraw();
      ui.setStatus(ok ? 'Baked the wall from the mountain mesh. Refine by painting, then Save.'
                      : 'Mountain mesh not loaded yet — try again in a moment.');
    },
    onSave: () => {
      void saveMap(grid.toMap(), ui);
    },
  });

  const paint = new PaintController(canvas, picker, grid, overlay, () => ui.setBrush(paint.brushRadius));

  window.addEventListener('resize', () => {
    stage.resize();
    controls.resize();
  });

  let last = performance.now();
  function frame(now: number): void {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    views.sync(world); // render the static backdrop (loads the mountain GLB on first frames)
    controls.update(dt);
    stage.render(controls.camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/** POST the map to the dev write-endpoint, which writes it to the committed file. Dev-only. */
async function saveMap(map: CollisionMap, ui: EditorUI): Promise<void> {
  ui.setStatus('Saving…');
  try {
    const res = await fetch('/__map', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ file: MAP_FILE, data: map }),
    });
    ui.setStatus(res.ok ? `Saved ${MAP_FILE} ✓` : `Save failed: ${res.status} ${await res.text()}`);
  } catch (e) {
    ui.setStatus(`Save failed: ${String(e)}`);
  }
}
