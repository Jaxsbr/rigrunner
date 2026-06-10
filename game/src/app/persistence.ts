/**
 * The real game's save slot — a single serialized `GameState` in `localStorage`. This is the
 * concrete half of Phase 0's unifying insight: a "saved game" and a "persistent real world" are the
 * same thing, and the front-door menu is just what picks which to enter
 * (`real-world-and-progression-spec.md`). Only the real game touches this; the sandbox never persists.
 *
 * Scope today: the **wallet** is the live, round-tripping proof of the New Game → play → Continue
 * pipeline. The durable spine the spec calls for — **world-content** (which piles are cleared, which
 * camps fell, which stumps are healed + their growth) and the **rig/inventory** — is the deliberate
 * next slice: both are composed-entity graphs (the rig) or re-spawned `RestorableSite` stumps (the
 * world), each its own serializer. `GameState.version` gates that growth: bumping it on a shape change
 * makes an older save read as "no save" rather than hydrating a stale shape.
 */
export interface GameState {
  /** Bumped whenever the serialized shape changes; an unrecognised version is treated as no save. */
  version: number;
  wallet: { scrap: number };
}

const SAVE_KEY = 'rigrunner.save';
export const SAVE_VERSION = 1;

/** Whether `localStorage` exists — false under headless tests, so persistence no-ops there. */
function store(): Storage | null {
  return typeof localStorage !== 'undefined' ? localStorage : null;
}

/** Persist the real game's state, overwriting the single slot. No-op without `localStorage`. */
export function saveGame(state: GameState): void {
  const s = store();
  if (!s) return;
  s.setItem(SAVE_KEY, JSON.stringify(state));
}

/**
 * Load the saved game, or `null` if there is none / it is unreadable / its version is unrecognised.
 * Returning `null` on any doubt keeps the caller's "Continue" path honest — a corrupt or stale slot
 * falls back to a fresh start rather than hydrating garbage.
 */
export function loadGame(): GameState | null {
  const s = store();
  if (!s) return null;
  const raw = s.getItem(SAVE_KEY);
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as GameState;
    if (parsed?.version !== SAVE_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Is there a loadable save? Drives whether the menu's Continue button is enabled. */
export function hasSave(): boolean {
  return loadGame() !== null;
}

/** Wipe the slot (e.g. a future "delete save" / "start over"). No-op without `localStorage`. */
export function clearSave(): void {
  store()?.removeItem(SAVE_KEY);
}
