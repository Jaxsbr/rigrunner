import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { EnginePart } from '@common/parts/engine-part';
import {
  PARTS_CATALOG,
  type PartDef,
  type PartSlot,
} from '@common/parts/parts-catalog';
import { TIERS, type TierId } from '@common/parts/tiers';
import type { Recipe } from '@common/parts/recipes';
import { defOf, resolveEnergyType } from '@common/sim/assembly';
import { inventoryItems, removeFromInventory } from '@features/economy/inventory';
import { benchSlots, placeOnBench } from './bench';
import { acceptsChassisPart } from './assembly';

const TIER_RANK: ReadonlyMap<TierId, number> = new Map(TIERS.map((tier, index) => [tier.id, index]));

export interface RecipeSlotNeed {
  slot: PartSlot;
  label: string;
  def: PartDef | null;
  onBench: EntityId | null;
  owned: readonly EntityId[];
}

export interface AutoFillEntry {
  slot: PartSlot;
  entity: EntityId;
}

export interface AutoFillPlan {
  entries: readonly AutoFillEntry[];
  missingSlots: readonly PartSlot[];
  complete: boolean;
}

function tierRank(tier: TierId): number {
  return TIER_RANK.get(tier) ?? 0;
}

function partTier(world: World, entity: EntityId): TierId {
  return world.get(entity, EnginePart)?.tier ?? TIERS[0]!.id;
}

function comparePartTierDesc(world: World, a: EntityId, b: EntityId): number {
  return tierRank(partTier(world, b)) - tierRank(partTier(world, a));
}

function benchPartDefs(world: World): PartDef[] {
  return Object.values(benchSlots(world))
    .filter((entity): entity is EntityId => entity !== null)
    .map((entity) => defOf(world, entity))
    .filter((def): def is PartDef => def !== null);
}

function canJoinPlannedBench(recipe: Recipe, plannedDefs: readonly PartDef[], def: PartDef): boolean {
  if (!acceptsChassisPart(recipe, def)) return false;
  return !resolveEnergyType([...plannedDefs, def]).mismatch;
}

export function recipeDefsForSlot(recipe: Recipe, slot: PartSlot): PartDef[] {
  return PARTS_CATALOG.filter((def) => def.slot === slot && acceptsChassisPart(recipe, def));
}

export function recipeDefForSlot(recipe: Recipe, slot: PartSlot): PartDef | null {
  return recipeDefsForSlot(recipe, slot)[0] ?? null;
}

export function recipeSlotNeeds(world: World, recipe: Recipe): RecipeSlotNeed[] {
  const slots = benchSlots(world);
  const inv = inventoryItems(world);
  return recipe.slots.map(({ slot, label }) => {
    const defs = recipeDefsForSlot(recipe, slot);
    const defIds = new Set(defs.map((def) => def.id));
    const owned = inv
      .filter((entity) => {
        const part = world.get(entity, EnginePart);
        return part ? defIds.has(part.id) : false;
      })
      .sort((a, b) => comparePartTierDesc(world, a, b));

    return {
      slot,
      label,
      def: defs[0] ?? null,
      onBench: slots[slot] ?? null,
      owned,
    };
  });
}

export function planAutoFillBench(world: World, recipe: Recipe): AutoFillPlan {
  const slots = benchSlots(world);
  const inv = inventoryItems(world);
  const used = new Set<EntityId>();
  const plannedDefs = benchPartDefs(world);
  const entries: AutoFillEntry[] = [];
  const missingSlots: PartSlot[] = [];

  for (const { slot } of recipe.slots) {
    if (slots[slot] !== null && slots[slot] !== undefined) continue;

    const candidates = inv
      .filter((entity) => !used.has(entity))
      .filter((entity) => {
        const def = defOf(world, entity);
        return def && def.slot === slot && canJoinPlannedBench(recipe, plannedDefs, def);
      })
      .sort((a, b) => comparePartTierDesc(world, a, b));

    const picked = candidates[0];
    if (picked === undefined) {
      missingSlots.push(slot);
      continue;
    }

    const def = defOf(world, picked);
    if (!def) {
      missingSlots.push(slot);
      continue;
    }

    used.add(picked);
    plannedDefs.push(def);
    entries.push({ slot, entity: picked });
  }

  return {
    entries,
    missingSlots,
    complete: missingSlots.length === 0,
  };
}

export function autoFillBench(world: World, recipe: Recipe): AutoFillPlan {
  const plan = planAutoFillBench(world, recipe);
  for (const { slot, entity } of plan.entries) {
    if (!placeOnBench(world, slot, entity)) continue;
    removeFromInventory(world, entity);
  }
  return plan;
}

export function ownedCountForPart(world: World, partId: string): number {
  return inventoryItems(world).filter((entity) => world.get(entity, EnginePart)?.id === partId).length;
}

export function tierCountForPart(world: World, partId: string, tier: TierId): number {
  return inventoryItems(world).filter((entity) => {
    const part = world.get(entity, EnginePart);
    return part?.id === partId && part.tier === tier;
  }).length;
}
