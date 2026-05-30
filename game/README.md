# game/  (the official project)

This is the home of the **official game**. The prototype proved the core loop is fun; this is the
fresh, to-standard build — `../prototype/` is *reference only*, never a foundation to extend.

**Read first: [`docs/architecture.md`](docs/architecture.md).** It is the standing contract for how
we build here — composability over inheritance, low coupling, simulation-as-source-of-truth, and
testable-by-design. Apply those principles by default on every change.

## How we work here

We don't have a full MVP or theme yet. We build by **discovery through implementation**: make a
small mechanism we enjoy → flesh it out → let a concept emerge. Architecture exists to keep that
exploration from welding into a coupled mess — see the architecture doc.

Same tech baseline as the prototype (Three.js + Vite; TypeScript proposed — see the doc), launched
independently via `npm run dev:game`. Genuinely reusable modules are promoted into `../shared/`
explicitly — the two apps never reach into each other's directories.
