import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Health } from '@common/components/health';
import { WORKSHOP_REPAIR_RATE } from './combat';

/**
 * Free repair while the rig is parked in a safe (workshop) zone — reinforcing home base = safety +
 * repair. Restores `current` toward `max` at `WORKSHOP_REPAIR_RATE` per second; a no-op when not safe or
 * already full. `safe` is passed in (the workshop-zone gate `main` already computes) rather than imported,
 * so camps stays ignorant of the workshop feature. A scrap-cost repair is a clean later economy sink.
 */
export function repairSystem(world: World, rig: EntityId, safe: boolean, dt: number): void {
  if (!safe) return;
  const h = world.get(rig, Health);
  if (!h) return;
  h.current = Math.min(h.max, h.current + WORKSHOP_REPAIR_RATE * dt);
}
