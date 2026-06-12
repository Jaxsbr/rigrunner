/**
 * A small, fast **seeded** pseudo-random generator (mulberry32) — the one source for "deterministic
 * from a seed" scatter across features. Same seed ⇒ same stream every run, so a feature that seeds off a
 * stable input (a stump's id, a shop's world position) renders identically each load yet differs thing to
 * thing. Promoted to `common/sim` once three features wanted the identical generator (restoration's tree
 * growth, the shop yard, the shop's worn ground) — one tested implementation, no drifting copies.
 *
 * It is NOT cryptographic and not meant to be; it is cheap, stateless-per-call-after-seeding, and good
 * enough for visual scatter. Returns a function yielding values in `[0, 1)`.
 */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
