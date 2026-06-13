import { fileURLToPath } from 'node:url';
import { writeFileSync, readFileSync } from 'node:fs';
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
 * Dev-only map endpoint for the editor (`npm run dev:editor`), reading + writing the committed map
 * straight from/to disk under `maps/`:
 *   GET  /__map?file=<name>  → the current file contents (always fresh from disk — the editor loads via
 *                              this, NOT a bundled import, so it never sees a stale cached map and Save
 *                              doesn't HMR-reload it).
 *   POST /__map  {file,data} → write `data` to that file.
 * The filename is reduced to its basename, so a request can only ever touch `maps/` — never escape it.
 * `apply: 'serve'` keeps it out of the production build entirely.
 */
const MAPS_DIR = r('./src/app/scenarios/maps');
function mapEndpoint(): Plugin {
  return {
    name: 'rr-map-endpoint',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__map', (req, res, next) => {
        const path = (f: string): string => `${MAPS_DIR}/${basename(f)}`;
        if (req.method === 'GET') {
          const file = new URL(req.url ?? '', 'http://x').searchParams.get('file') ?? 'real-game.map.json';
          try {
            res.setHeader('content-type', 'application/json');
            res.end(readFileSync(path(file), 'utf8'));
          } catch (e) { res.statusCode = 500; res.end(String(e)); }
          return;
        }
        if (req.method !== 'POST') return next();
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          try {
            const { file, data } = JSON.parse(body) as { file: string; data: unknown };
            writeFileSync(path(file), JSON.stringify(data));
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
  plugins: [mapEndpoint()],
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
