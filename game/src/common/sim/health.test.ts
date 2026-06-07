import { describe, it, expect } from 'vitest';
import { World } from '@core/world';
import { Health } from '@common/components/health';
import { spawnRig, chassisToRig } from '@features/mounting/rig';
import { composeProduct } from '@common/sim/assembly';
import { chassisRecipeForSize } from '@common/parts/recipes';
import { chassisParts } from '@features/chassis/chassis';
import { rigMaxHealth } from './health';

describe('rigMaxHealth + Health on the rig', () => {
  it('a rusty 1×3 starter rig has the base 100 HP, full', () => {
    const world = new World();
    const rig = spawnRig(world);
    const h = world.get(rig, Health)!;
    expect(h.max).toBe(100);
    expect(h.current).toBe(100);
  });

  it('a higher-grade chassis tanks more — iron 1×3 scales by the tier multiplier (1.8×)', () => {
    const world = new World();
    const iron = chassisToRig(world, composeProduct(world, chassisRecipeForSize('1x3'), chassisParts('1x3'), 'iron'));
    expect(rigMaxHealth(world, iron)).toBe(180); // 100 × 1.8
    expect(world.get(iron, Health)!.max).toBe(180);
  });

  it('a bigger chassis is a sturdier base — the 3×5 hauler out-tanks the 1×3 scout', () => {
    const world = new World();
    const hauler = chassisToRig(world, composeProduct(world, chassisRecipeForSize('3x5'), chassisParts('3x5')));
    expect(rigMaxHealth(world, hauler)).toBe(160);
  });
});
