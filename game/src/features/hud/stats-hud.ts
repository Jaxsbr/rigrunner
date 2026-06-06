import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Assembly } from '@common/components/assembly';
import { Chassis } from '@common/components/chassis';
import { rigLoad } from '@common/sim/weight';
import { mountedEngines } from '@features/engine/engine';
import { rigPerformance } from '@features/drive/drive';
import { engineDriveBias, type DriveBias } from '@features/drive/steering';

/**
 * The rig stat readout (top-left). A pure projection of the world, like the renderer: it reads the
 * rig's capabilities each frame and writes text, owning no truth. The point is legibility of the
 * build — mount an engine and you immediately see top speed / acceleration climb, so the benefit of
 * what you just bolted on is obvious; load up on scrap and watch them fall, so the cost of the cargo
 * is just as obvious.
 *
 * It only rewrites the DOM when the displayed text changes — on a mount/unmount, and now also as the
 * carried load shifts performance while you collect or dump scrap — so it costs nothing per frame
 * while the rig drives unladen and unchanged.
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

    // Performance is engine output scaled by weight (rigPerformance's mobility), so these move two
    // ways: mount another engine and they climb; load the rig with scrap and they fall. Steering
    // reads where the engines put the turn pivot (engineDriveBias) — shown only with a drive fitted,
    // so moving an engine front/back makes its handling effect legible back in the bay.
    return [
      'RIG',
      `  type          ${type}`,
      `  acceleration  ${fmt(perf.acceleration)} u/s²`,
      `  top speed     ${fmt(perf.topSpeed)} u/s`,
      `  reverse       ${fmt(perf.reverse)} u/s`,
      ...(labels.length > 0 ? [`  steering      ${biasLabel(engineDriveBias(world, rig))}`] : []),
      ...this.chassisLines(world, rig, labels.length),
    ].join('\n');
  }

  /**
   * The chassis readout: its size, how many engines are mounted against the size's allowed range
   * (flagged when under the minimum — a legal but under-powered build), and the live carried load
   * (mounted parts + cargo) against the rated capacity. The load number climbs as you collect scrap,
   * which is the same mass that drags the performance lines above. Capacity is a READOUT only —
   * nothing refuses an overload yet (that gate is a future system); the chassis's own
   * top-speed/turning stats don't affect driving yet either, so they're left off the readout rather
   * than shown as inert numbers. Empty when the rig has no Chassis.
   */
  private chassisLines(world: World, rig: EntityId, engineCount: number): string[] {
    const chassis = world.get(rig, Chassis);
    if (!chassis) return [];
    const { load, capacity } = rigLoad(world, rig);
    const under = engineCount < chassis.engineMin ? ' (under)' : '';
    return [
      'CHASSIS',
      `  size          ${chassis.size.replace('x', '×')}`,
      `  engines       ${engineCount} / ${chassis.engineMin}–${chassis.engineMax}${under}`,
      `  load          ${fmt(load)} / ${fmt(capacity)}`,
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

/** The drive bias as the handling it produces — how the rig pivots when steering. */
function biasLabel(bias: DriveBias): string {
  return { rear: 'Rear pivot', middle: 'Centre pivot', front: 'Front pivot' }[bias];
}

function fmt(n: number): string {
  return n.toFixed(1);
}
