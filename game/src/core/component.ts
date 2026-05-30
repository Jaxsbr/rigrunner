/**
 * A component is a single capability's data. `ComponentType<T>` is a typed key used to
 * store and retrieve that data on an entity — the data type `T` rides along with the key
 * so the World API stays fully typed without any runtime type info.
 *
 * Composition over inheritance: entities gain abilities by HAVING components, never by
 * BEING a subclass. Define one per capability; keep each to a single responsibility.
 */
export interface ComponentType<T> {
  readonly key: string;
  /** phantom marker so two ComponentTypes with different T aren't assignable */
  readonly _t?: T;
}

export function defineComponent<T>(key: string): ComponentType<T> {
  return { key };
}
