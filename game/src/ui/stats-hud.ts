import type { World } from '../core/world';
import type { EntityId } from '../core/types';
import { Renderable } from '../components/renderable';
import { mountedEngines } from '../systems/engine';
import { rigPerformance } from '../systems/drive';

/**
 * The rig stat readout (top-left). A pure projection of the world, like the renderer: it reads the
 * rig's capabilities each frame and writes text, owning no truth. The point is legibility of the
 * build — mount an engine and you immediately see top speed / acceleration climb, so the benefit of
 * what you just bolted on is obvious.
 *
 * It only rewrites the DOM when the text actually changes (which, since these are capability stats,
 * is only when you mount/unmount an engine) — so it costs nothing per frame while you just drive.
 */
export class StatsHud {
  private last = '';

  constructor(private readonly el: HTMLElement) {}

  update(world: World, rig: EntityId): void {
    const text = this.compose(world, rig);
    if (text !== this.last) {
      this.el.textContent = text;
      this.last = text;
    }
  }

  private compose(world: World, rig: EntityId): string {
    const perf = rigPerformance(world, rig);

    const labels = mountedEngines(world, rig).map((e) => {
      const r = world.get(e, Renderable);
      return r && r.shape === 'model' ? engineLabel(r.assetId) : 'engine';
    });
    const type = labels.length === 0 ? '— none (no drive)' : groupLabels(labels);

    // torque is the raw engine attribute; acceleration / move speed are what survives after the
    // rig's weight drags on it — so you can see weight biting and torque fighting back.
    return [
      'RIG',
      `  type          ${type}`,
      `  weight        ${fmt(perf.weight)}`,
      `  torque        ${fmt(perf.torque)}`,
      `  acceleration  ${fmt(perf.acceleration)} u/s²`,
      `  move speed    ${fmt(perf.topSpeed)} u/s`,
      `  reverse       ${fmt(perf.reverse)} u/s`,
    ].join('\n');
  }
}

/** Group engine labels → e.g. "Mk1 + Mk2", "Mk2 ×2". */
function groupLabels(labels: string[]): string {
  const counts = new Map<string, number>();
  for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
  return [...counts.entries()]
    .map(([label, n]) => (n > 1 ? `${label} ×${n}` : label))
    .join(' + ');
}

/** 'engine-mk1' → 'Mk1'. Falls back to the raw id for anything unrecognised. */
function engineLabel(assetId: string): string {
  const tail = assetId.replace(/^engine-/, '');
  return tail ? tail.charAt(0).toUpperCase() + tail.slice(1) : assetId;
}

function fmt(n: number): string {
  return n.toFixed(1);
}
