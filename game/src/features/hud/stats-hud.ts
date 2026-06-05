import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Assembly } from '@common/components/assembly';
import { Chassis } from '@common/components/chassis';
import { Weight } from '@common/components/weight';
import { totalRigWeight } from '@common/sim/weight';
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

    // Label each mounted engine by its energy type (electric/steam) — every engine is now a
    // composed product carrying that type. A typeless engine (shouldn't occur) reads as 'engine'.
    const labels = mountedEngines(world, rig).map((e) => {
      const t = world.get(e, Assembly)?.type;
      return t ? cap(t) : 'engine';
    });
    const type = labels.length === 0 ? '— none (no drive)' : groupLabels(labels);

    // Engine output IS the performance now (weight parked, no diminishing returns), so top speed and
    // acceleration are read straight off the rig — mount another engine and watch both climb.
    return [
      'RIG',
      `  type          ${type}`,
      `  acceleration  ${fmt(perf.acceleration)} u/s²`,
      `  top speed     ${fmt(perf.topSpeed)} u/s`,
      `  reverse       ${fmt(perf.reverse)} u/s`,
      ...this.chassisLines(world, rig, labels.length),
    ].join('\n');
  }

  /**
   * The chassis readout: its size, how many engines are mounted against the size's allowed range
   * (flagged when under the minimum — a legal but under-powered build), and the live carried load
   * against the rated capacity. Capacity is a READOUT only — nothing refuses an overload yet (weight
   * is parked); the chassis's own top-speed/turning stats don't affect driving yet either, so they're
   * left off the readout rather than shown as inert numbers. Empty when the rig has no Chassis.
   */
  private chassisLines(world: World, rig: EntityId, engineCount: number): string[] {
    const chassis = world.get(rig, Chassis);
    if (!chassis) return [];
    const ownWeight = world.get(rig, Weight)?.value ?? 0;
    const load = totalRigWeight(world, rig) - ownWeight; // mounted parts only — what's loaded ON the chassis
    const under = engineCount < chassis.engineMin ? ' (under)' : '';
    return [
      'CHASSIS',
      `  size          ${chassis.size.replace('x', '×')}`,
      `  engines       ${engineCount} / ${chassis.engineMin}–${chassis.engineMax}${under}`,
      `  load          ${fmt(load)} / ${fmt(chassis.loadCapacity)}`,
    ];
  }
}

/** Group engine labels → e.g. "Electric + Steam", "Electric ×2". */
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
