import { type GameSnapshot, SNAPSHOT_VERSION } from './snapshot';

/**
 * The real game's save slot — a single serialized `GameSnapshot` in `localStorage`. This is the
 * concrete half of Phase 0's unifying insight: a "saved game" and a "persistent real world" are the
 * same thing, and the front-door menu is just what picks which to enter
 * (`real-world-and-progression-spec.md`). Only the real game touches this; the sandbox never persists.
 *
 * The snapshot's shape (what's durable, how it's described) lives in `snapshot.ts`; this file is only
 * the localStorage read/write around it. `SNAPSHOT_VERSION` gates evolution: an older save whose
 * version doesn't match is read as "no save" rather than hydrated into a mismatched shape.
 */

const SAVE_KEY = 'rigrunner.save';

/** Whether `localStorage` exists — false under headless tests, so persistence no-ops there. */
function store(): Storage | null {
  return typeof localStorage !== 'undefined' ? localStorage : null;
}

/** Persist the real game's snapshot, overwriting the single slot. No-op without `localStorage`. */
export function saveGame(snapshot: GameSnapshot): void {
  const s = store();
  if (!s) return;
  s.setItem(SAVE_KEY, JSON.stringify(snapshot));
}

/**
 * Load the saved snapshot, or `null` if there is none / it is unreadable / its version is unrecognised.
 * Returning `null` on any doubt keeps the caller's "Continue" path honest — a corrupt or stale slot
 * falls back to a fresh start rather than hydrating garbage.
 */
export function loadGame(): GameSnapshot | null {
  const s = store();
  if (!s) return null;
  const raw = s.getItem(SAVE_KEY);
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as GameSnapshot;
    if (parsed?.version !== SNAPSHOT_VERSION) return null;
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
