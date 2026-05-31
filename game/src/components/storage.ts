import { defineComponent } from '../core/component';

/**
 * The capability to *contain* a quantity of resource, up to a capacity. A storage container is an
 * entity with Storage (+ Part, so it mounts onto a rig's deck like any other part).
 *
 * `amount` lives on the entity itself, which is the whole point: a container is a stateful vessel
 * that carries its own contents wherever it goes. Mounting/unmounting only rewrites the Mount
 * component, never this one — so taking a half-full container off the rig and dropping it in the
 * world preserves its exact contents, and re-mounting it brings them back. (This is the per-vessel
 * model the prototype deferred — see observations #6/#7.)
 *
 * The render layer reads `amount/capacity` to draw the fill rising inside the container; it owns no
 * truth, this component is the source of truth for how full the vessel is.
 */
export interface Storage {
  amount: number;
  capacity: number;
}

export const Storage = defineComponent<Storage>('Storage');
