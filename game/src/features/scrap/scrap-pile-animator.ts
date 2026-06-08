import type { World } from '@core/world';
import type { EntityViews } from '@common/render/entity-views';
import { ScrapPile } from './scrap-pile';
import { Dissolving } from './dissolving';

/**
 * Scrap's sim-driven render: shrink a pile toward its remaining depth as hold-to-work drains waves
 * off it, so the heap visibly slumps — depletion is watched, not a counter (pillar 4). Like the other
 * animators it READS a sim component (ScrapPile) each frame and eases a view-owned scale, owning no
 * game truth. Dispatched from `main.ts` so the shared render tier never imports a feature (ADR-003 §4).
 */

// A rummaged pile visibly shrinks as it empties. It never quite vanishes before the sim destroys it
// on empty, so it bottoms out at a floor fraction rather than at zero.
const PILE_SHRINK_FLOOR = 0.35;  // an emptying heap shrinks to this fraction of its full size
const PILE_SHRINK_EASE = 5;      // how fast the shown size glides to the real fraction (per second)

/**
 * Shrink each scrap pile toward its `remaining / total` depth: a wave's whole-unit drop reads as a
 * graceful settle. Uniform scale about the base-centre origin keeps the heap grounded as it shrinks.
 */
export function animateScrapPile(views: EntityViews, world: World, dt: number): void {
  for (const [id, obj] of views.objects) {
    const pile = world.isAlive(id) ? world.get(id, ScrapPile) : undefined;
    if (!pile) continue;
    if (world.has(id, Dissolving)) continue; // a reclaimed pile is owned by the clear animator (sink+shrink)

    const frac = pile.total > 0 ? Math.max(0, Math.min(1, pile.remaining / pile.total)) : 0;
    const target = PILE_SHRINK_FLOOR + (1 - PILE_SHRINK_FLOOR) * frac;

    let shown = (obj.userData['pileScale'] as number) ?? target; // start AT the current depth on spawn
    shown += (target - shown) * Math.min(1, dt * PILE_SHRINK_EASE);
    obj.userData['pileScale'] = shown;
    obj.scale.setScalar(shown);
  }
}
