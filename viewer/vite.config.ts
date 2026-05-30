import { defineConfig } from 'vite';

/**
 * The asset viewer is its own Vite app (root = `viewer/`), but it deliberately reuses two
 * things from elsewhere in the repo:
 *  - `publicDir` points at `game/public`, so the viewer serves the exact same GLB files the
 *    game does (`/assets/*.glb`) — one source of truth for the asset files.
 *  - `server.fs.allow` is widened to the repo root so the viewer can import from `shared/`.
 */
export default defineConfig({
  publicDir: '../game/public',
  server: {
    fs: { allow: ['..'] },
  },
});
