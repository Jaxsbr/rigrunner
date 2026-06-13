import { defineComponent } from '@core/component';

/**
 * The capability to *contain* a quantity of resource, up to a capacity. A storage container is an
 * entity with Storage (+ Part, so it mounts onto a rig's deck like any other part).
 *
 * `amount` lives on the entity itself, which is the whole point: a container is a stateful vessel
 * that carries its own contents wherever it goes. Mounting/unmounting only rewrites the Mount
 * component, never this one — so taking a half-full container off the rig and dropping it in the
 * world preserves its exact contents, and re-mounting it brings them back. (This is the per-vessel
 * model — see observations #6/#7.)
 *
 * The render layer reads `amount/capacity` to draw the fill rising inside the container; it owns no
 * truth, this component is the source of truth for how full the vessel is.
 */
export interface Storage {
  amount: number;
  capacity: number;
}

export const Storage = defineComponent<Storage>('Storage');

/**
 * Scrap a single container holds. It lives with the `Storage` component because the capacity is
 * intrinsic to the storage capability, so every producer of a `Storage` stamps the same value: a
 * directly-spawned container (`@features/storage/containers`) AND an assembled storage product
 * (`@common/sim/assembly`). Promoted here from `containers.ts` at the ADR-003 migration so the shared
 * compute half can reach it without `common/` importing a feature.
 *
 * Loose scrap is collected in chunky, randomised pickups (a piece is worth 2–6, see
 * `@features/scrap/collectible`), and a piece is atomic — it lands whole or not at all (NO SPACE).
 * So the capacity clears the largest single piece with room to spare: ~3–4 pieces fill a container,
 * and NO SPACE fires when a chunky piece won't fit the leftover room — the cue to bank or add storage.
 */
export const CONTAINER_CAPACITY = 16;

