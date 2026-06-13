import { World } from '@core/world';
import { Stage } from '@common/render/stage';
import { EntityViews } from '@common/render/entity-views';
import { Picker } from '@common/render/picker';
import { seedStaticWorld } from '../scenarios/real-game';
import { getWorldGrid } from '@features/terrain/world-grid';
import type { CollisionMap } from '@features/terrain/collision-grid';
import { compileCollision, type CollisionShape } from '@features/terrain/collision-shapes';
import rawMap from '../scenarios/maps/real-game.map.json';
import { OrthoControls } from './ortho-controls';
import { PaintOverlay } from './paint-overlay';
import { ShapeOverlay } from './shape-overlay';
import { ShapeTool } from './shape-tool';
import { EditorUI } from './editor-ui';
import { bakeMountainFootprint } from './mesh-bake';

const MAP_FILE = 'real-game.map.json';

/**
 * The map editor — `npm run dev:editor`. It seeds the real game's static world as a backdrop, then lets
 * you author collision as VECTOR shapes (spline paths drawn + bent by dragging points) over the
 * mesh-baked base. The shapes compile live into the collision grid (the red wash); Save writes the
 * compiled grid the game loads plus the editable shapes the editor re-opens. No driving sim runs.
 * (`docs/specs/map-editor-spec.md`.)
 */
export function startEditor(): void {
  const canvas = document.querySelector<HTMLCanvasElement>('#view')!;

  const world = new World();
  seedStaticWorld(world);
  const grid = getWorldGrid(world)!; // loaded from the committed map (its `blocked`)

  const stage = new Stage(canvas);
  const views = new EntityViews(stage.scene);
  const controls = new OrthoControls(canvas);
  const picker = new Picker(controls.camera, canvas, views);
  const wash = new PaintOverlay(stage.scene, grid); // the compiled-collision preview
  const shapeOverlay = new ShapeOverlay(stage.scene);

  // Authoring state. The base layer is the mesh-baked footprint; shapes are drawn on top. Reconstruct
  // both from the committed map's editable `source` if present, else treat the loaded grid AS the base
  // (a legacy/first-bake map = pure footprint, no shapes yet).
  const map = rawMap as unknown as CollisionMap;
  const shapes: CollisionShape[] = map.source ? structuredClone(map.source.shapes) : [];
  let base: Uint8Array | null = map.source ? null : grid.cells.slice();
  let bakedFromMesh = map.source ? map.source.bakedFromMesh : true;
  let needsBake = map.source ? map.source.bakedFromMesh : false; // a sourced map re-bakes once the mesh loads

  const recompile = (): void => {
    compileCollision(grid, base, shapes);
    wash.redraw();
  };

  const ui = new EditorUI({
    onToggleMode: () => tool.setMode(tool.getMode() === 'draw' ? 'edit' : 'draw'),
    onToggleCarve: () => tool.toggleCarve(),
    onThicker: () => tool.setThickness(tool.displayThickness + 1),
    onThinner: () => tool.setThickness(Math.max(1, tool.displayThickness - 1)),
    onDelete: () => tool.deleteSelected(),
    onBake: () => {
      const ok = bakeMountainFootprint(world, views, stage.scene, grid);
      if (ok) { base = grid.cells.slice(); bakedFromMesh = true; needsBake = false; recompile(); }
      ui.setStatus(ok ? 'Baked the wall from the mountain. Draw shapes to refine, then Save.'
                      : 'Mountain mesh not loaded yet — try again in a moment.');
    },
    onSave: () => { void saveMap(); },
  });

  const tool = new ShapeTool(canvas, picker, controls, shapes, shapeOverlay, recompile, () =>
    ui.refresh({ mode: tool.getMode(), carve: tool.displayCarve, thickness: tool.displayThickness, shapes: shapes.length }),
  );

  recompile();
  ui.refresh({ mode: tool.getMode(), carve: tool.displayCarve, thickness: tool.displayThickness, shapes: shapes.length });

  window.addEventListener('resize', () => { stage.resize(); controls.resize(); });

  let last = performance.now();
  function frame(now: number): void {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    views.sync(world); // draws the backdrop; loads the mountain GLB over the first frames
    // A re-opened, mesh-based map rebuilds its base once the GLB has loaded, then compiles the shapes on it.
    if (needsBake && bakeMountainFootprint(world, views, stage.scene, grid)) {
      base = grid.cells.slice();
      needsBake = false;
      recompile();
    }
    controls.update(dt);
    tool.refreshOverlay(); // keep handles screen-sized as the view zooms
    stage.render(controls.camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /** Compile to the grid, then POST both the grid (for the game) and the editable shapes (for re-opening). */
  async function saveMap(): Promise<void> {
    recompile(); // make sure the grid matches the shapes
    const data: CollisionMap = { ...grid.toMap(), version: 2, source: { bakedFromMesh, shapes } };
    ui.setStatus('Saving…');
    try {
      const res = await fetch('/__map', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ file: MAP_FILE, data }),
      });
      ui.setStatus(res.ok ? `Saved ${MAP_FILE} ✓ (${shapes.length} shapes)` : `Save failed: ${res.status} ${await res.text()}`);
    } catch (e) {
      ui.setStatus(`Save failed: ${String(e)}`);
    }
  }
}
