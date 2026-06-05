/**
 * Material TIERS — the in-game kernel's view of the rarity axis. The canonical table lives in
 * `shared/part-identity.ts` so the game and the asset viewer read one source of truth (the viewer's
 * tier pickers are driven by the same list — `docs/part-identity-spec.md` §4a / Phase 1.5). This
 * module is the `@common/parts/tiers` surface the game imports it through; adding a tier is still a
 * single data row, now in `shared/`.
 *
 * See `@shared/part-identity` for the full doc: tiers multiply a part's catalog BASE attributes at
 * resolve time (`resolvePartStats` in `@common/sim/assembly`) and give it a finish colour, never
 * spawning separate catalog rows or GLBs per tier (the anti-explosion guardrail).
 */
export { TIERS, DEFAULT_TIER, tierOf, type Tier, type TierId } from '@shared/part-identity';
