import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Assembly } from '@common/components/assembly';
import { mountedEngines } from '@features/engine/engine';
import { rigPerformance } from '@features/drive/drive';

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

    // Label each mounted engine by its energy type (electric/mechanical) — every engine is now a
    // composed product carrying that type. A typeless engine (shouldn't occur) reads as 'engine'.
    const labels = mountedEngines(world, rig).map((e) => {
      const t = world.get(e, Assembly)?.type;
      return t ? cap(t) : 'engine';
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

/** Group engine labels → e.g. "Electric + Mechanical", "Electric ×2". */
function groupLabels(labels: string[]): string {
  const counts = new Map<string, number>();
  for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
  return [...counts.entries()]
    .map(([label, n]) => (n > 1 ? `${label} ×${n}` : label))
    .join(' + ');
}

/** 'electric' → 'Electric'. */
function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fmt(n: number): string {
  return n.toFixed(1);
}
