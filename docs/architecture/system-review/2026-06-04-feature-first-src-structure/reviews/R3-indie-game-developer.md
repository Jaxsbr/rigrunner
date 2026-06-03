# Review R3 — The Experienced Indie Game Developer

**Reviewer lens:** Ship a fun game with a tiny (here: one-human-plus-agents) team in discovery mode.
Optimize for iteration speed, a tight build→run→diagnose→build-better loop, and *not* letting
architecture work stall feature work. The question I keep asking: **is now the right TIME, given
"complexity earns its place," and does this structure help me find and tune game feel faster than
it costs me?**

**Proposal under review:** `docs/architecture/feature-first-structure-proposal.md` (Option B).
**Date:** 2026-06-04
**My vote: (b) ALTER Option B.** Approve the axis; gate it on a tight, shipping-first execution plan
so the restructure pays for itself inside one or two feature cycles instead of becoming a multi-day
detour that competes with the next playable.

---

## 1. The shipping context I'm judging this against (the facts that move my vote)

I went and looked at how this project actually ships, because that — not theory — decides whether a
restructure is timed right.

- **Velocity is extreme and feature-dense.** `git log` shows **~24 PRs between 2026-05-30 and
  2026-06-04** — roughly six days. PRs #5–#11 (the entire MW workshop: shell → inventory → bench →
  assembly → composed engines → type-lock → staging deck) landed in a *single day* (2026-06-01).
  Option C (the Reclaimer, five PRs + assets + articulation runtime) landed across 2026-06-03. This
  is a machine that turns design into playable code very fast. Anything that competes with that
  cadence for more than a beat or two is suspect by default.
- **The work is real game-feel work, not plumbing.** `docs/observations.md` is full of *felt*
  findings — steering ramp (#2), camera ease (#4), hold-to-harvest as the flee-or-fight seam (#5),
  the build/drive mode dissolving once the placement math went local-frame (#8), the workshop being
  "dense and clunky" (#10). This team's edge is tuning the loop. A restructure earns its place only
  if it makes the *next* round of that tuning faster.
- **There is no in-flight code work to collide with.** I checked: the only open PR is the proposal
  itself (#25). Every `feat/*` branch is already merged/stale. So a migration done *now* has a clean
  runway — no half-built feature it would force a painful rebase on. **This is the single best
  argument for timing it now rather than "later":** later, there will almost certainly be an
  in-flight `feat/combat-*` or `feat/part-identity-*` branch that a 280-line import rewrite would
  turn into a merge nightmare. The window where the tree is quiet is *now*.
- **The next big content change is already specced and partly decided.** `docs/part-identity-spec.md`
  Phase 0 (engine-vocabulary split + flavour-name strip) is **decided**; it touches
  `parts-catalog.ts`, `assembly.ts`, and the workshop overlay — exactly the files the migration also
  touches. That argues for sequencing: do the structural move *or* MP Phase 0 first and cleanly, not
  both interleaved.

So the timing question answers itself more favorably than I expected walking in. My skepticism as an
indie dev is usually "you're polishing the garage instead of building the car." Here the garage is
genuinely getting cramped (the active `systems/` and `components/` folders are 25 and 28 files), the
tree is momentarily empty, and the move is overwhelmingly mechanical. The risk isn't *whether* — it's
*how much ceremony we bolt on*.

---

## 2. Does the loop benefit? (Yes — and that's what tips me from "meh" to "do it")

The whole game is the build→run→diagnose→build-better beat. The thing that shortens that beat for a
solo dev (and the agents doing the typing) is: *when the run feels wrong, how fast can I open exactly
the code that owns the felt thing and change it?*

Today, "the rig felt like a slug when full" sends me into `components/storage.ts`,
`systems/weight.ts`, `systems/drive.ts`, `systems/movement.ts`, and a render file — picked out of
three flat piles. Under Option B that diagnosis opens `features/storage/`, `features/drive/`, and
`common/sim/weight.ts`. That is a real reduction in the time between "felt it" and "changed it,"
which is the loop the game's fun is made of. I don't need the literature for this — I've lived the
"which of five folders is the scrap render in" tax, and it's exactly the kind of friction that
quietly slows a tuning session.

The roadmap brief (S-D) is right that the headline test is **combat** (Option D): a brand-new feature
area with **no current folder** (confirmed — the only damage-adjacent file in `components/` is
`collider.ts`; there is no `Health`). Under the flat layout, "where does enemy AI / health / projectile
/ camp go?" is five separate per-file placement decisions into already-crowded piles. Under Option B
it's `features/combat/`, created when its code is written. For a discovery-mode project that will
*invent* combat by building it, having one obvious place to put the first messy version — and one
place to delete it from if it doesn't land — is exactly the cheap-to-try / cheap-to-throw-away
property I want. **Feature-deletion being local is underrated**; half of discovery is killing
mechanics that didn't earn their place, and the flat layout makes a clean kill harder.

So: the loop benefits, the next big feature (combat) lands clean, and the discovery posture
(add/kill mechanics cheaply) is *served*, not fought. That's enough for me to back the axis.

---

## 3. Where I diverge from / sharpen the other four reviewers

All four synthesis briefs landed on **(b) ALTER**, and I agree on the destination. But they wrote
from correctness/cost/agent/roadmap lenses; my job is the *shipping discipline* lens, and from that
seat a couple of their recommendations need a guardrail so the "ALTER" payload doesn't quietly grow
into the thing I'm most allergic to: a structural project that out-scopes the features it's supposed
to serve.

**3.1 — The migration must ship behind the same `implement-feature` discipline as a feature, in
small PRs, with the game playable after each.** The proposal already nails this with the
**scrap-first pilot**, and S-A confirms it's ~51 mechanical, TypeScript-caught edits across ~16 files
with 3 headless tests proving it green. *That* is the move I trust: prove the pattern on the most
self-contained slice, confirm `npm test` + a manual drive still work, then continue slice-by-slice.
What I will *not* sign off on is a single "big-bang move everything" PR. Not because the compiler
can't catch it — it can — but because a 280-line all-at-once diff is unreviewable by a human in the
loop and un-bisectable when *behavior* (not compilation) regresses. The animator split is logic, not
just paths; if a wheel stops spinning or the scrap pile stops slumping, I want that change isolated in
its own small PR. **Ship the restructure the way this project ships features: small, playable,
reversible.**

**3.2 — I am wary of the convention/enforcement payload growing faster than the structure.** S-B and
S-C want, before or during the migration: a written `common/` admission rule, an inward-only
invariant, ESLint `import/no-restricted-paths`, per-feature `CLAUDE.md` files, per-feature barrel
`index.ts`, path aliases, and a "where new code goes" rule in two docs. Each is individually
defensible. **Stacked, they are a second project.** My shipping-lens ruling on each:

  - **Path aliases (`@core`/`@common`/`@features`/`@shared`): YES, and bundle them into the pilot
    PR.** This is the one piece of "ceremony" that is actually a *velocity* investment, not a tax —
    it converts every future file move (and there will be many: combat, restoration, MP tiers) from a
    depth-churn rewrite into a no-op, and it kills the `common` vs repo-root `shared` confusion at the
    import site. It pays back inside the first post-migration feature. Non-negotiable for me.
  - **Animator/`view.ts` dependency-direction fix: YES, mandatory, and it's the *only* real refactor
    here.** Resolve it the simple way — strip the four `animateX` delegates off `RenderView`, call the
    animators directly from `main.ts` (already the composition root, 245 lines, the one broad
    importer). I do **not** want the callback-injection `FrameCallback[]` machinery (S-B's alt) unless
    the animation system actually grows to demand it — that's exactly the kind of speculative
    indirection "complexity earns its place" tells us to skip. Direct calls from `main.ts` are fewer
    lines, obvious, and trivially extended when combat adds its animator.
  - **`common/` admission rule + inward-only invariant written into the ADR: YES** — it's one
    paragraph and it's the thing that keeps `common/` from rotting into the junk drawer that kills
    feature-first. Cheap, high-leverage, do it.
  - **A one-line "where new code goes" rule in `AGENTS.md` and the `implement-feature` skill: YES,
    and this is more urgent than the other tracks made it sound.** I confirmed the gap directly:
    `implement-feature/SKILL.md` has **zero** placement guidance (grep for
    `components/|systems/|features/|placement` returns nothing). The role-folders are the *only*
    "where does this go" signal an agent currently pattern-matches. Delete them without writing the
    replacement and the very next feature agent has *less* guidance than today — a direct hit to
    iteration speed. This one-paragraph rule is part of the migration's definition of done, not a
    nice-to-have.
  - **ESLint `import/no-restricted-paths`: LATER, as a fast-follow, not a prerequisite.** The
    invariant matters; a CI config surface added *during* the structural move is scope creep that can
    stall the move. Document the rule now, lint it once the structure has settled (after the second or
    third slice migrates). Don't let a lint-config yak-shave block the playable.
  - **Per-feature `CLAUDE.md`: SEED, don't mandate.** Write one for the scrap pilot and one for
    `mounting/` (to re-anchor ADR-001's single-owner rule where an editing agent will actually see
    it). Do **not** require all eight slices to ship with a hand-written guide on day one — that's
    busywork that competes with features, and most slices' invariants are obvious from the code. Grow
    them when a slice earns documentation.
  - **Per-feature barrel `index.ts`: SKIP for now.** This is the most speculative item on the list.
    Barrels add an indirection layer and, in a TS/Vite project, a real risk of import cycles and
    fuzzier tree-shaking. With a single dev and a clean acyclic DAG, the cost (every new file edits a
    barrel) outweighs the benefit. Revisit only if cross-feature reach-into-internals actually starts
    happening. This is textbook "doesn't earn its place yet."

  Net: of the seven proposed additions, I'd ship **three** with the pilot (aliases, animator fix,
  ADR rule + placement-doc one-liner), **defer one** (ESLint), **seed one** (per-feature CLAUDE.md on
  two slices), and **drop one** (barrels). That keeps the "ALTER" payload proportional to the
  structure and stops it metastasizing into a second project.

**3.3 — I agree with S-D's one structural alteration (split `assembly.ts`), but I want it sequenced as
its own clean step, not smuggled into a slice move.** The pure-compute half (`sumPartStats`,
`resolveEnergyType`, `buildProduct`, `composeProduct`) is *already* consumed by `content/engines.ts`
and `content/containers.ts` (→ future `features/engine/`, `features/storage/`), so leaving all of
`assembly.ts` in `features/workshop/` plants a feature→feature edge on day one. That's real and I
back the fix. But it's a *logic* extraction (like the animator split), so it gets its own small PR —
not folded silently into the workshop slice move. Same ruling for the `spawnEnginePart` →
`common/parts/` promotion (called by scrap's `loot-overlay.ts`). These are the two genuine refactors
hiding inside "it's all just file moves"; isolate them so a regression is bisectable.

**3.4 — On the scene/Sanctuary question, I'm firmly with S-B and S-D: do NOT pre-build anything.** As
the dev who's been burned by premature scene systems, I'll be blunt: the temptation to add a `modes/`
or `scenes/` tier "for the Sanctuary" is exactly the architecture-astronautics this proposal should
*not* indulge. `main.ts` today is one `World` + one paused flag + one frame loop — the correct
"one world, modal interface mode" shape (Pacific Drive does the same). When the Restoration Sanctuary
actually ships as a second loop-mode, it grows `main.ts` into a mode dispatcher — a **composition-root
change, not a slice restructure**. Option B accommodates that later without anticipating it now. The
proposal already gets this right by *not* adding a modes tier; I'm just underlining that the board
must resist anyone arguing to add one "while we're in here." Build it when play demands it, per the
project's own creed.

---

## 4. Why not (a), and why not (c)

**Not (a) APPROVE-as-is** — but it's close, and I want to be honest about *why* it's not (a) from my
seat. The correctness reviewers reject (a) because the proposal's wording plants a tier inversion
(animators) on day one. My shipping-lens reason is adjacent but different: **as written, the proposal
doesn't say how to ship the migration without stalling features.** It names the scrap pilot (good)
but doesn't commit to (i) path aliases — without which every future feature pays depth-churn forever —
or (ii) the placement-doc one-liner, without which the next feature agent is *slower* post-migration
than today. Approving the prose as-is risks either a big-bang move or a convention pile-up, both of
which are exactly the failure modes a tiny team can't afford. The fix is small and the direction is
right, so it's (b), not a rejection.

**Not (c) ALTERNATIVE.** I went looking for a cheaper diverging direction a shipping-first dev would
prefer, and there isn't a good one:
  - *"Stay flat, you're moving too fast to reorganize"* — refuted by the active pain (25-file
    `systems/`, 28-file `components/`, the workshop-UX clunk in obs #10) *and* by the fact that the
    cost only grows: combat and MP both add files to those piles. Delay makes the move more
    expensive, not less, and guarantees it eventually collides with an in-flight branch (the tree is
    uniquely quiet *right now*).
  - *"Option C (group only the sim by feature)"* — strictly weaker for *my* purposes: it leaves
    `render/` and `ui/` role-sliced, which is exactly where the felt-tuning work lives (animators,
    the 1,012-line workshop overlay, scrap stains). The pain I most want to relieve is in the render/UI
    layer, and C doesn't touch it.
  - *"Lazy/incremental: only move a slice when you next touch it"* — tempting for a solo dev, but it
    leaves the codebase in a half-flat/half-feature limbo for an unbounded time, during which the
    placement rule is ambiguous (is scrap in `features/` or `components/`? both!) and agents
    pattern-match the wrong one. The clean-tree window argues for doing it deliberately and finishing
    it, slice by slice, over a short stretch — not letting it dribble.

There is no roadmap item that wants a *different* organizing axis, and no shipping argument for a
cheaper one that survives contact with the active pain. So (b).

---

## 5. My recommendation to the board (the shipping-first "ALTER" payload)

**(b) ALTER Option B.** Approve the axis. Execute it as a *feature-shaped* effort — small PRs, game
playable after each, the genuine refactors isolated — with a deliberately *trimmed* convention
payload so the restructure serves features instead of competing with them.

Ship-it checklist, in order, each a small reviewable PR:

1. **Aliases + animator fix + ADR rule + placement one-liner, then the scrap pilot — bundled as the
   first PR(s).** Path aliases (`@core`/`@common`/`@features`/`@shared`) as step 0; strip `animateX`
   off `RenderView` and call animators from `main.ts`; write the `common/` admission rule +
   inward-only invariant into the graduating ADR; add the one-line "where new code goes" rule to
   `AGENTS.md` **and** `implement-feature/SKILL.md`; seed `features/scrap/CLAUDE.md`. Verify with the
   3 headless scrap tests **and** a manual drive-and-rummage.
2. **The two genuine refactors as their own isolated PRs:** split `assembly.ts` (pure compute →
   `common/sim/`), and promote `spawnEnginePart`/`engine-part.ts` → `common/parts/`. Bisectable on
   their own.
3. **Remaining slices, one PR each:** economy → storage → engine → drive → mounting (seed
   `features/mounting/CLAUDE.md` here for ADR-001) → workshop → hud. Game playable after each.
4. **Fast-follow (not a blocker):** ESLint `import/no-restricted-paths` once the structure settles.
5. **Doc hygiene in the migration window:** fix the already-stale `tools/blender/build_asset.py`
   (`content/assets.ts` → `shared/assets.ts`) and `blender-asset` SKILL step 4 (`content/` →
   `features/<feature>/`).

Explicitly **DROP** from the payload (don't let them grow the project): per-feature barrels, mandatory
per-feature CLAUDE.md on all eight slices, and any `modes/`/`scenes/` tier.

**Confidence:** high. The axis is correct, the timing is genuinely good (extreme velocity + a momentarily
empty tree + a clean acyclic DAG), the cost is mechanical and compiler-verified, and the loop the game's
fun depends on gets shorter, not longer. My only real fight is keeping the ceremony proportional — which
is what the trimmed payload above enforces.

---

## Appendix — facts I verified myself for this review

```
~24 PRs in 6 days (git log 2026-05-30..2026-06-04); MW = 7 PRs in ONE day (2026-06-01)
Only open PR = #25 (this proposal). All feat/* branches merged/stale → clean tree for migration NOW.
Largest src files: ui/workshop-overlay.ts 1012, systems/mounting.ts 314, build/build-controller.ts 293,
                   ui/deck-view.ts 274, systems/assembly.ts 263, main.ts 245, content/parts-catalog.ts 204
systems/ = 25 files (incl. tests); components/ = 28 files — the active, crowded piles
No Health component (only components/collider.ts) → combat is a true new feature area, no folder today
implement-feature/SKILL.md: ZERO placement guidance (grep components/|systems/|features/|placement → empty)
part-identity-spec.md Phase 0 = DECIDED; touches parts-catalog.ts, assembly.ts, workshop overlay
                       → same files the migration touches → sequence them, don't interleave
```
