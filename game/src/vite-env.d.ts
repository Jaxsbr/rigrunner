/// <reference types="vite/client" />

/**
 * Vite injects `import.meta.env` at build/dev time. This reference pulls in its types so the
 * composition root can branch on `import.meta.env.MODE` — `'sandbox'` under `dev:sandbox` /
 * `build:sandbox` (`vite --mode sandbox`), anything else for the real game.
 */
