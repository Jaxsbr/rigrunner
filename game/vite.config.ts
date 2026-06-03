import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * The game is its own Vite app (root = `game/`). The path aliases here are the import convention
 * for `game/src/` (ADR-003): they decouple import strings from physical folder depth — moving a
 * file between feature folders stops being a cascade of `../` rewrites — and disambiguate the
 * in-game kernel (`@common`) from the repo-root cross-app code (`@shared`).
 *
 *   @core     → game/src/core      ECS engine, zero game knowledge
 *   @common   → game/src/common    the strict domain kernel (shared components / parts / sim / render / input)
 *   @features → game/src/features  vertical slices, one folder per mechanic
 *   @shared   → ../shared          repo-root code shared by the game AND the viewer
 *
 * The same map feeds dev (`vite game`), production build (`vite build game`), and vitest
 * (`vitest run --root game`), so source and tests resolve identically. The matching `paths` block
 * lives in `game/tsconfig.json` for the typechecker.
 */
const r = (rel: string): string => fileURLToPath(new URL(rel, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@core': r('./src/core'),
      '@common': r('./src/common'),
      '@features': r('./src/features'),
      '@shared': r('../shared'),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
