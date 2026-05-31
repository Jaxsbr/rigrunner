import type { World } from '../core/world';
import type { EntityId } from '../core/types';
import { Transform } from '../components/transform';
import { Part } from '../components/part';
import { EngineSpec } from '../components/engine-spec';
import type { EngineSpec as EngineSpecData } from '../components/engine-spec';
import { Weight } from '../components/weight';
import { MountFacing } from '../components/mount-facing';
import { Renderable } from '../components/renderable';

/**
 * Engine blueprints. An EngineDef is a complete, ready-to-spawn engine: which GLB draws it and
 * what performance it brings. Today we hand-author a small tier ladder (Mk1 = slow/weak starter,
 * Mk2 = faster/stronger). There is deliberately no "tier" field — tier isn't a game concept, just
 * how we're seeding the engine roster for now.
 *
 * Future direction: engines become CUSTOM — the player assembles sub-parts and the resulting
 * EngineSpec is computed from them. That replaces these literal blueprints with derived ones, but
 * `spawnEngine` and everything downstream (the drive system reads EngineSpec) stay exactly as they
 * are — the blueprint is just produced a different way.
 */
export interface EngineDef {
  assetId: string;
  spec: EngineSpecData;
  weight: number; // an engine is a heavy thing the rig must haul; better engine ⇒ heavier (for now)
}

/** Tier-1: the basic engine. Slow and weak, and light — the starting point. */
export const ENGINE_MK1: EngineDef = {
  assetId: 'engine-mk1',
  spec: { power: 8, torque: 11 },
  weight: 4,
};

/** Tier-2: faster and stronger than Mk1 (and visibly more illuminated) — but also heavier. */
export const ENGINE_MK2: EngineDef = {
  assetId: 'engine-mk2',
  spec: { power: 13, torque: 19 },
  weight: 7,
};

/**
 * Spawn an engine part loose in the world from a blueprint, ready to grab and mount. Like every
 * part it is a SET of capabilities: Part marks it grabbable + an engine, EngineSpec carries its
 * performance, MountFacing aims its glowing intake off the rig, and the GLB draws it.
 */
export function spawnEngine(world: World, def: EngineDef, x = 0, z = 0): EntityId {
  const e = world.createEntity();
  world.add(e, Transform, { x, z, rotationY: 0, y: 0 });
  world.add(e, Part, { kind: 'engine' });
  world.add(e, EngineSpec, { ...def.spec });
  world.add(e, Weight, { value: def.weight });
  world.add(e, MountFacing, { kind: 'specific', rule: 'outward' });
  world.add(e, Renderable, { shape: 'model', assetId: def.assetId });
  return e;
}
