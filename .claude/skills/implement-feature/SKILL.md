---
name: implement-feature
description: Implement a RIGRUNNER game feature or code change on a dedicated branch off origin/main, ending in a PR — never a direct commit to main. Use whenever asked to build, code, fix, refactor, or wire up anything in game/, shared/, viewer/, or tools/. Handles branch hygiene, tests, and PR creation. RIGRUNNER-specific.
---

# implement-feature — build a code change (branch → PR)

Use this for **writing/changing code** in `game/`, `shared/`, `viewer/`, or `tools/`. For
pure ideation/spec work, use `brainstorm` instead.

## The rule this skill exists to enforce

**Never commit or push to `main`.** Every code change starts on a fresh branch off
`origin/main` and lands via a PR (see CLAUDE.md → "Git workflow"). This prevents the
stale-branch and push-race failures we hit before. The flow below is mandatory.

## Flow

1. **Start clean, off `origin/main`.** The current branch may be stale or already merged —
   never assume. 
   ```sh
   git fetch origin
   git status                                   # working tree must be clean
   git switch -c feat/<short-slug> origin/main  # feat/, fix/, refactor/, chore/
   ```
   If the tree is dirty, resolve with Jaco before branching — don't carry someone else's
   uncommitted work onto a new branch.

2. **Orient before coding.** Read `CLAUDE.md` (source of truth), the relevant `docs/*-spec.md`
   if one exists, and the code you're touching. Match the surrounding style. Honour the
   architecture (ECS: data-only components, pure systems over `World`, render reads state and
   never mutates it). Keep `EngineSpec` and similar contracts intact.
   - **Where new code goes** ([ADR-003](../../../docs/architecture/adr-003-feature-first-src-structure.md)):
     `game/src/` is feature-first. Put new code in `features/<mechanic>/` (the slice it serves — a
     mechanic's component/system/content/render/UI live together). Promote to `common/` only when ≥2
     *features* need it and it carries no feature-specific semantics (otherwise duplicate — Rule of
     Three). `core/`+`common/` must never import `features/`; dispatch per-frame feature work from
     `main.ts`. Imports use aliases `@core`/`@common`/`@features`/`@shared` (cross-tier) and `./`
     (same-feature). Read any `features/<x>/CLAUDE.md` for that slice's single-owner rules.

3. **Build it to the project's standard** (Phase 2 = high standard: testable, maintainable).
   Let mechanics earn their place — don't add speculative complexity.
   - **Comment the present, not the diff.** Write every comment for a reader who has never seen the
     previous version. Describe what the code *is* and why — never what it *was*, what it *replaced*,
     or what it is *NOT*. Lines like *"the HUD prompt that replaced the old floating bubble"* or
     *"this is NOT a world-space label"* are **tombstone comments**: they only land for someone who
     saw the change, and decay into noise for everyone after. The migration story (what changed and
     why) belongs in the commit message / PR / ADR — that's what those are *for*; don't duplicate it
     into long-lived code. Keep *forward*-looking guards (*"don't switch to `display:none` — it
     pops"*): they help a fresh reader who might reach for that next. Cut *backward*-looking ones.
     **Test:** would the line make sense to someone reading the file cold? If it only lands if you
     remember the old code, delete it. (Same smell in `brainstorm`, for decided docs.)

4. **Verify before claiming done.** Run the tests and, where it matters, the app:
   ```sh
   npm test            # if the change has unit coverage
   npm run dev:game    # or dev:viewer — confirm the change actually works
   ```
   Report results faithfully — if something fails or was skipped, say so.

5. **Commit** with a conventional message (`feat(game): …`, `fix(render): …`). End with the
   Co-Authored-By trailer.

6. **Push the branch and open a PR** (account `Jaxsbr`):
   ```sh
   git push -u origin HEAD
   gh pr create --fill --base main
   ```
   Include what changed, why, and the manual-test steps in the PR body. Share the link.
   Don't merge unless Jaco asks — he self-merges (ruleset requires a PR but no approval).

7. **After merge**, clean up so branches don't go stale:
   ```sh
   git switch main && git pull --ff-only
   git branch -d feat/<short-slug>
   git fetch --prune
   ```

## Adding a part? It is not "done" until every tier is a real model, validated in the viewer

**No placeholders for a new part — ever.** If your change adds a part the player can *see* (it shows in
the shop, inventory inspect, the bench — anywhere a sub-part or product renders), the PR is **not
complete** until all three hold. This is the enforcement arm of
[`part-identity-spec.md`](../../../docs/specs/part-identity-spec.md) Phase 2 ("the tint stand-in retires; every
new part ships as a real authored asset"). Shipping a tinted placeholder and moving on is the exact
failure mode this rule exists to stop.

- [ ] **Every tier of the part has a real authored 3D model.** Author a GLB per tier with the
      `blender-asset` skill and register it (`shared/assets.ts`). A **full check covers all
      currently-defined `TIERS`**, not just the tier you happened to test — a new part missing a tier's
      model is incomplete. Do **not** ship a tinted placeholder cube and call it done.
- [ ] **The models ship in the same PR as the part.** Deliberately create the assets alongside the
      code that introduces the part — never "add the part now, model it later."
- [ ] **Every tier is validated in the viewer.** Run `npm run dev:viewer`, select the part, and confirm
      **each tier** renders as the model you expect (the per-sub-part + tier-combination preview —
      `part-identity-spec.md` Phase 1.5). It need not look perfect *in-game* yet, but it **must** read
      correctly in the viewer. Screenshot the viewer to verify; where Phase 1.5's **agent/Playwright check**
      exists, run it — its **coverage** assertion fails outright if any tier has no distinct model (the
      mechanical gate for this rule), and its **per-part×tier visual** check guards the render against an
      approved baseline.

## If your push to a feature branch is rejected as "behind"
The base moved. Rebase onto the fresh base, don't force a merge:
```sh
git fetch origin
git rebase origin/main
# resolve conflicts, then:
git push --force-with-lease
```

## Don'ts
- Don't commit or push to `main` (the pre-push hook + server ruleset reject it anyway).
- Don't reach across apps (game/ ↔ viewer/) — share only via `shared/`.
- Don't leave merged branches lying around — they cause the stale confusion we're fixing.
- Don't leave **tombstone comments** — code describes the present, not what it replaced or is *not*;
  the migration story goes in the commit/PR/ADR (see step 3).
- Don't ship a **placeholder** for a player-visible part and call it done — author a real model for
  every tier, in the same PR, and validate each in the viewer (see the new-part rule above). This is
  non-negotiable.
