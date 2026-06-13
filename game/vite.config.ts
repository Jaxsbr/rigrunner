import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';

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

/**
 * Dev-only write endpoint for the map editor (`npm run dev:editor`). The editor POSTs `{ file, data }`
 * to `/__map`; this writes `data` (the collision map JSON) to that file under the committed maps dir.
 * The filename is reduced to its basename, so a POST can only ever write inside `maps/` — never escape
 * it. `apply: 'serve'` keeps it out of the production build entirely.
 */
const MAPS_DIR = r('./src/app/scenarios/maps');
function mapWriteEndpoint(): Plugin {
  return {
    name: 'rr-map-write',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__map', (req, res, next) => {
        if (req.method !== 'POST') return next();
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          try {
            const { file, data } = JSON.parse(body) as { file: string; data: unknown };
            writeFileSync(`${MAPS_DIR}/${basename(file)}`, JSON.stringify(data));
            res.statusCode = 200;
            res.end('ok');
          } catch (e) {
            res.statusCode = 500;
            res.end(String(e));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [mapWriteEndpoint()],
  // The editor writes the committed map back to disk on Save; that file is an imported module, so a
  // naive watcher would HMR-reload the page mid-save (aborting the Save fetch → "failed to fetch", and
  // wiping the editor session). Ignore the maps dir: the editor already holds the grid in memory, and
  // the game picks up a new map on its next (manual) launch.
  server: { watch: { ignored: [`${MAPS_DIR}/**`] } },
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
