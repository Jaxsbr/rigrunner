import type { EntityId } from './types';
import type { ComponentType } from './component';

/**
 * The World owns all entities and their components. It is the single source of truth
 * for simulation state — systems read and mutate it; rendering and input never own it.
 *
 * Storage is component-major (one map per component type), which makes `query` cheap and
 * keeps the model data-oriented rather than object-oriented.
 */
export class World {
  private nextId: EntityId = 1;
  private readonly alive = new Set<EntityId>();
  private readonly stores = new Map<string, Map<EntityId, unknown>>();

  createEntity(): EntityId {
    const id = this.nextId++;
    this.alive.add(id);
    return id;
  }

  destroyEntity(id: EntityId): void {
    this.alive.delete(id);
    for (const store of this.stores.values()) store.delete(id);
  }

  isAlive(id: EntityId): boolean {
    return this.alive.has(id);
  }

  add<T>(id: EntityId, type: ComponentType<T>, data: T): this {
    this.storeFor(type).set(id, data);
    return this;
  }

  get<T>(id: EntityId, type: ComponentType<T>): T | undefined {
    return this.storeFor(type).get(id) as T | undefined;
  }

  has(id: EntityId, type: ComponentType<unknown>): boolean {
    return this.storeFor(type).has(id);
  }

  remove(id: EntityId, type: ComponentType<unknown>): void {
    this.storeFor(type).delete(id);
  }

  /** Every living entity that has ALL of the given components. */
  query(...types: ComponentType<unknown>[]): EntityId[] {
    if (types.length === 0) return [...this.alive];

    // Walk the smallest store and check the rest — keeps queries near O(smallest).
    const stores = types.map((t) => this.storeFor(t));
    let smallest = stores[0]!;
    for (const s of stores) if (s.size < smallest.size) smallest = s;

    const result: EntityId[] = [];
    for (const id of smallest.keys()) {
      if (this.alive.has(id) && stores.every((s) => s.has(id))) result.push(id);
    }
    return result;
  }

  private storeFor(type: ComponentType<unknown>): Map<EntityId, unknown> {
    let store = this.stores.get(type.key);
    if (!store) {
      store = new Map<EntityId, unknown>();
      this.stores.set(type.key, store);
    }
    return store;
  }
}
