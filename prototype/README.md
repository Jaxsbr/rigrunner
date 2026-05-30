# prototype/

Phase 1 proof-of-concept code. **Throwaway-acceptable** — no architectural standards, patterns, or
tests required. The only goal is to prove the core loop is fun (see
[`../docs/prototype-spec.md`](../docs/prototype-spec.md)).

Launch: `npm run dev:prototype` (from the repo root).

`src/main.js` currently stands up the Three.js canvas and the empty arena. Build the 28 spec checks
on top of it. When the loop is proven fun, this code becomes the *reference* for the real game in
`../game/` — it is not promoted as-is.
