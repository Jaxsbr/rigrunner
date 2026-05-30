# game/  (Phase 2 — placeholder)

This is the home of the **production game**. It is intentionally empty for now.

Work begins here only **after** the prototype proves the core loop is fun. At that point the game is
**rebuilt to high standards** — testable, maintainable, high-quality, upgradeable — using the
`../prototype/` code as a *reference and starting point*, not as a foundation to extend.

Same tech as the prototype (Three.js + Vite), launched independently via `npm run dev:game`.
Genuinely reusable modules are promoted into `../shared/` explicitly — the two apps never reach into
each other's directories.
