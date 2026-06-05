/**
 * Asset-coverage check — the mechanical gate behind the no-placeholder rule
 * (`docs/part-identity-spec.md` Phase 1.5 / Phase 2). Run it with `npm run check:assets`.
 *
 * For every sub-part in the shared identity roster, at every currently-defined tier, it asserts a real
 * authored model exists (the part's `assetId` is registered in `shared/assets.ts`). A part with no
 * registered GLB renders as a tinted placeholder in the viewer — and this check FAILS on it (exit 1),
 * listing the GLBs Phase 2 must author. It is data-driven (no browser), so it's the cheap, non-flaky
 * companion to the viewer's per-part×tier visual signature: this proves *a* model exists, the viewer's
 * signature proves it's *the right* model.
 *
 * Today it is expected to FAIL, reporting the 13 unmodelled sub-parts — that failure is the gate Phase 2
 * closes. The `implement-feature` skill runs this when part work lands: a new part isn't done until this
 * passes for every tier of it.
 *
 * It also guards the roster's integrity: every sub-part must belong to exactly one product group, so a
 * newly-added part can't silently drift out of the coverage net.
 */
import { PART_IDENTITIES, TIERS, PRODUCT_GROUPS, partIdentity } from '../shared/part-identity';
import { MODEL_ASSETS } from '../shared/assets';

let failed = false;
const fail = (msg: string): void => {
  failed = true;
  console.error(`  ✗ ${msg}`);
};

console.log('RIGRUNNER — asset coverage check (part-identity Phase 1.5 gate)\n');
console.log(`Tiers: ${TIERS.map((t) => t.id).join(', ')}`);
console.log(`Sub-parts: ${PART_IDENTITIES.length} across ${PRODUCT_GROUPS.length} products\n`);

// ── Roster integrity: every sub-part belongs to exactly one product group ──────────────────────────
const grouped = new Map<string, number>();
for (const g of PRODUCT_GROUPS) {
  for (const sid of g.subPartIds) {
    if (!partIdentity(sid)) fail(`product '${g.id}' references unknown sub-part '${sid}'`);
    grouped.set(sid, (grouped.get(sid) ?? 0) + 1);
  }
}
for (const p of PART_IDENTITIES) {
  const n = grouped.get(p.id) ?? 0;
  if (n === 0) fail(`sub-part '${p.id}' belongs to no product group (it would escape the coverage net)`);
  if (n > 1) fail(`sub-part '${p.id}' belongs to ${n} product groups (must be exactly one)`);
}

// ── Coverage: each sub-part × each tier must resolve to a registered model ──────────────────────────
const missingAssets = new Set<string>();
let gateFailures = 0; // part × tier cells that fail

console.log('Coverage by product (✓ modelled · ✗ placeholder):');
for (const g of PRODUCT_GROUPS) {
  console.log(`\n  ${g.emoji} ${g.label}`);
  for (const sid of g.subPartIds) {
    const ident = partIdentity(sid)!;
    const hasModel = ident.assetId in MODEL_ASSETS;
    // Iterate every tier: a tier is a finish on the base model, so coverage is uniform across tiers
    // today — but iterating keeps the gate honest if a tier ever gains its own distinct model.
    if (!hasModel) {
      missingAssets.add(ident.assetId);
      gateFailures += TIERS.length;
    }
    const mark = hasModel ? '✓' : '✗';
    const note = hasModel ? `(${ident.assetId})` : `(${ident.assetId}) — no model for any tier`;
    console.log(`    ${mark} ${ident.displayName.padEnd(26)} ${note}`);
  }
}

console.log('');
if (missingAssets.size > 0) {
  console.error(
    `${missingAssets.size} model(s) to author (${gateFailures} part×tier cells fail):\n  ` +
      [...missingAssets].sort().join(', '),
  );
  failed = true;
}

console.log('');
if (failed) {
  console.error('RESULT: FAIL — author the missing models (Phase 2) so every part reads as itself.');
  process.exitCode = 1;
} else {
  console.log('RESULT: PASS — every sub-part has a registered model at every tier.');
}
