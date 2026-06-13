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
 * Collision is two layers: `base` (the hand-painted wall) and `effective = base ∪ placement footprints`
 * (what the game loads + the wash shows). Save writes both plus the placement list. No driving sim runs.
 * (`docs/specs/map-editor-spec.md`.)
 */
export async function startEditor(): Promise<void> {
  const canvas = document.querySelector<HTMLCanvasElement>('#view')!;

  const world = new World();
  seedStaticStructures(world); // mountain mesh + bench — the map-free backdrop the layout sits in

  // The two collision layers, fetched live from disk. `effective` (the game's `blocked`) is the wash +
  // save surface; `base` (the editor's `baseBlocked`, falling back to `blocked` on a legacy map) is the
  // hand layer placement footprints union onto, so a moved/removed placement never orphans baked cells.
  const map = await loadMap();
  const effective = CollisionGrid.fromMap(map);
  const base = CollisionGrid.fromMap({ ...map, blocked: map.baseBlocked ?? map.blocked });

  const stage = new Stage(canvas);
  const views = new EntityViews(stage.scene);
  const controls = new OrthoControls(canvas);
  const picker = new Picker(controls.camera, canvas, views);
  const wash = new PaintOverlay(stage.scene, effective);
  const brush = new BrushCursor(stage.scene);

  // The authored layout: spawn the map's placements as entities + keep the bake honest as it changes.
  const store = new PlacementStore(world, base, effective, () => wash.redraw());
  store.load(map.placements ?? []);

  // `ui` is referenced by the controllers' callbacks before it's constructed, so bind it lazily.
  let ui: EditorUI;
  const place = new PlaceController(canvas, stage.scene, picker, store, (m) => ui.setStatus(m));
  const paint = new PaintController(
    canvas, picker, effective, wash,
    (rect) => brush.set(rect),
    () => ui.setBrush(paint.brushRadius),
    base, // mirror strokes into the hand layer so they survive the next recompute
  );

  ui = new EditorUI({
    onMode: (mode) => {
      paint.setActive(mode === 'paint');
      place.setActive(mode === 'place');
    },
    onBake: () => {
      // Re-derive the wall into the BASE layer, then re-union the placement footprints over it.
      const ok = bakeMountainFootprint(world, views, stage.scene, base);
      void store.recompute();
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

  /** POST the map — the effective grid as `blocked`, the hand layer as `baseBlocked`, plus the layout. */
  async function saveMap(): Promise<void> {
    ui.setStatus('Saving…');
    try {
      const data: WorldMap = {
        ...effective.toMap(),
        baseBlocked: base.toMap().blocked,
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
