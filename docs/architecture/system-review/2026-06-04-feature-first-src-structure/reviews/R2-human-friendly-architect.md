# Review R2 — The Human-Friendly Software Architect

> **Reviewer lens:** long-term human maintainability. Sound module boundaries, dependency
> direction that points downhill, simplicity, and *not paying complexity costs before they're
> earned*. Skeptical of restructures that add ceremony without proven pain — and equally skeptical
> of letting a flat pile rot.
> **Proposal under review:** `docs/architecture/feature-first-structure-proposal.md` (Option B).
> **Date:** 2026-06-04
>
> **Verdict: (b) ALTER Option B.** The organizing axis is right and the pain is real and present —
> this is not premature structure. But the proposal, executed verbatim, plants a dependency-direction
> inversion on its very first refactor, and it omits the single change (path aliases) that converts
> the dominant *ongoing* maintenance cost from "paid forever" to "paid once." Three alterations fix
> both; none changes the shape of B. Crucially, I land **softer than the other four briefs on the
> "promote-everything-now" instinct** — see §4 and §6.

---

## 1. Is this restructure earned, or is it ceremony? (It is earned)

My default posture is to resist restructures. A move that rewrites ~300 import lines must clear a
high bar: the pain it removes has to be *present and felt*, not anticipated. I checked the bar against
the live code, and Option B clears it.

**The pain is present, not hypothetical.** The flat role-folders already exhibit the textbook
layer-first decay:

- `systems/` is 25 files with no internal grouping; `components/` is 28. To touch one mechanic
  (scrap) you read across five flat piles and pick the relevant 4–6 out of each. That is the exact
  "understand everything to change anything" failure mode, and it is live today, not projected.
- The cheapest move in a flat folder — for a human *or* an agent — is "add one more file to the
  pile." There is **no written placement rule anywhere** in the repo (Synthesis C confirmed this:
  `CLAUDE.md` never enumerates `game/src/` subfolders, `AGENTS.md` stops at the app boundary, and
  `implement-feature` has zero placement guidance). The directory structure is the *only* placement
  signal, and right now it answers "where does a new scrap struct go?" with silence. Entropy is the
  path of least resistance.

**The architecture underneath is genuinely clean** (verified): `core/world.ts` is component-major
storage with zero game knowledge; systems are free functions; `view.ts` is a strict projection that
owns no truth. So this is *purely a grouping problem* — the code is well-written, it is just filed
by the wrong axis. That is the cheapest kind of restructure to make and the safest: no logic changes,
just relocation, with TypeScript catching every miss.

**On "premature":** the test I apply is *do the proposed folders map to code that exists, or to code
we imagine?* Every slice in §3 (`drive/ engine/ mounting/ scrap/ storage/ workshop/ economy/ hud/`)
maps to files on disk today. Zero speculative folders are created (`combat/`, `restoration/`,
`sanctuary/`, `energy/` arrive only with their code). This is the discipline I most want to see in a
build-by-discovery project: **B locks only the organizing axis for code that already exists.** That
is not front-loading complexity — it is removing a recurring tax. I am satisfied it is earned.

I therefore reject **(a) approve-as-is** only because of execution-completeness gaps (§3–§4), and I
reject **(c) alternative** outright: the flat status quo is the thing actively rotting, Option A still
smears each mechanic across role folders, and Option C leaves render/UI role-sliced — which is
exactly where the Three.js coupling will keep accumulating. There is no maintainability case for a
diverging axis. The axis is correct.

---

## 2. The dependency-direction question (animators / `view.ts`) — the one that actually matters to me

This is the heart of my lens, so I read the real files rather than trusting the digest.

**Confirmed in code.** `render/view.ts:14` imports all four animators by name
(`animateWheels, animateStorageFill, animateReclaimer, animateScrapPile` from `./animators`), and
exposes one thin delegate each (`view.ts:55–58`). `main.ts:232–235` calls them per-frame *through*
those delegates (`view.animateWheels(world, dt)` …). `render/animators.ts` is a genuine 4-way
grab-bag: the four functions share no state and never call each other (verified) — wheels=drive,
storage-fill=storage, reclaimer=mounting, scrap-pile=scrap.

**Why the proposal's wording is a real defect, not a nitpick.** §3 says each animator moves into its
feature and "`common/render/view.ts` calls them." If `view.ts` stays in `common/render/` and imports
`features/drive/...`, `features/scrap/...`, etc., then **the shared tier imports the feature tier** —
the precise inversion the whole three-tier model exists to forbid. And it lands on the *first* refactor
the proposal names. For a maintainability reviewer this is the worst possible place to introduce a
violation: the structure's first act would contradict its own central rule, and (this project being
agent-driven) the first agent to execute the migration would faithfully reproduce the inversion
because the spec told it to.

**The fix is small and I verified it is mechanically clean.** The animator delegates in `view.ts`
only forward `(world, dt)` plus the privately-owned `this.views` (the `EntityViews` cache). There are
two honest resolutions:

- **(preferred) Elevate the per-frame dispatch into `main.ts`.** Strip the four `animateX` methods
  from `RenderView`; expose the `EntityViews` handle (or pass it once at construction) and call the
  four animators directly from `main.ts:232–235`, which is *already* the composition root and the
  only legitimate cross-feature importer. `view.ts` then holds only feature-import-free methods
  (`sync`, `follow`, `syncWorkshopZones`, `syncInteractionHints`, `syncScrapStains`, `render`) and
  stays cleanly in `common/render/` as a pure projection. This is the cleanest tier story and the one
  I recommend the ADR record.
- **(acceptable) Callback injection.** `view.ts` holds a `FrameCallback[]`; `main.ts` collects each
  feature's animator and injects them at startup. Lower-friction, but it leaves a (typed, generic)
  per-frame hook in `common/` — fine, but slightly more machinery than elevating the loop.

Either keeps the arrow pointing downhill. The non-negotiable is that **one is chosen and written into
the ADR before any file moves**, replacing the proposal's loose "view.ts calls them." The same fix
applies to `zone-overlays.ts` / `interaction-hints.ts`, which each read `WorkshopZone` **and**
`ScrapPile` (two features) — they cannot live cleanly in one feature, so split them per-feature and
wire from `main.ts`, *or* promote a generic proximity-zone read-interface to `common/`. I lean
**split per-feature** here (fewer new shared abstractions; see §4).

This is the single correction the board must lock. It is the reason I cannot vote (a).

---

## 3. Path aliases: pay the move cost once, not forever (the dominant *ongoing* cost)

I verified the ground truth: `game/tsconfig.json` has `moduleResolution: "bundler"`, `include:
["src"]`, **no `baseUrl`, no `paths`**; there is **no `game/vite.config.ts`**; every import in
`game/src` is relative. I also confirmed the depth reality the proposal glosses: a file moving from
`src/ui/` (depth 1) to `src/features/workshop/` (depth 2) changes its `../../../shared/` import to
`../../../../shared/` — so the proposal's "every other file is a move, not a rewrite" is **false under
the no-alias regime**. A move *is* a rewrite of every relative path in the file and in every consumer.

For my lens this is the more important of the two alterations, because it is about the cost that
*recurs*. The one-time migration churn (~300 compiler-checked edits) I am not worried about —
TypeScript catches every miss, nothing fails silently, it is a bad afternoon, not a risk. What I care
about is the *roadmap*: combat, restoration, MP tiers, the eventual Sanctuary — every one of those is
new files and new moves, and under the relative-path regime each move re-pays depth-churn forever,
and each `../../../../` chain is a place an agent miscounts silently.

Adding `@core` / `@common` / `@features` / `@shared` (a `tsconfig` `paths` block + a ~10-line
`game/vite.config.ts`, both natively supported by `moduleResolution: "bundler"` + Vite 6, no new
packages) does three things I value:

1. **Converts the dominant ongoing cost from "forever" to "once."** Imports decouple from physical
   depth; future moves stop cascading path edits.
2. **Resolves the "two kinds of shared" hazard at every import site.** `@shared` *always* means the
   repo-root cross-app folder (the four game files that reach it — `deck-view`, `workshop-overlay`,
   `articulation`, `entity-views` — confirmed); `@common` *always* means the in-game kernel. In a
   bare diff, `common/render/stage.ts` and repo-root `shared/three-canvas.ts` are easy to confuse;
   `@common` vs `@shared` makes the distinction unmissable.
3. **Makes the tier invariant greppable / lint-enforceable.** A `@features/...` import inside a
   `@common/...` file is an instantly visible red flag — the exact inversion §2 is about.

**Sequencing:** bundle aliases into the first migration PR as step 0 (so the import rewrite is paid
once, not twice). I am genuinely agnostic between "prerequisite PR" and "bundled" — both are fine;
the only wrong answer is omitting them, which the proposal currently does.

---

## 4. Where I diverge from the other reviewers: resist promoting `common/` members ahead of need

All four synthesis briefs lean (b), and I agree on direction. But each of them carries a
*promote-it-now* instinct that my lens flags. "Duplication is cheaper than the wrong abstraction" and
the Rule of Three are not slogans to me — they are the guardrail against `common/` quietly becoming
the kitchen sink the whole "strict tier" premise is meant to prevent. The strictness of `common/`
is the entire value of separating it from a loose `shared/`; if we relax the admission gate during
the migration "to be tidy," we have already lost it. So I want to be more conservative than the room
on three specific promotions:

### 4a. `collision.ts` — do NOT promote to `common/sim/` yet (I diverge from S-A, S-B, S-D)

I checked the consumers directly. `systems/collision.ts` is imported by exactly two files:
`main.ts` (the composition root, which *runs* the system) and `scrap-collection.ts` (the only feature
that consumes `CollisionPair`). **Collision has one feature consumer today: scrap.** The briefs argue
"promote now because combat will be its second consumer." That is a speculative promotion — combat
has no folder, no code, and no committed date. Promoting a one-consumer module to the kernel *because
a future mechanic might use it* is exactly the move "complexity earns its place" tells us not to make.

The code itself even documents the right posture: collision's header says "what a collision *means*
is decided entirely by the consumer (scrap collection today, **projectile damage later**)." The
seam is already designed to be reused without being relocated — the function is a pure read of the
World that returns data. **Recommendation: leave `collision.ts` in `features/scrap/` for the pilot,
and promote it to `common/sim/` in the *same PR that introduces combat* — i.e. when its second
consumer actually exists.** This costs one trivial move later (a move the alias regime makes
depth-free anyway) and keeps the kernel honestly minimal. The pilot's `./collision` import simply
stays a same-folder sibling — *simpler*, not harder. The briefs treat "decide it now to avoid
re-churn" as the win; with aliases there is no re-churn to avoid, so the conservative call is free.

> This is a genuine disagreement with S-A item 4, S-B §1.1, and S-D §2.3. I am not persuaded that
> avoiding one future trivial move justifies seeding the kernel with a single-feature primitive today.

### 4b. `weight.ts` — promote now (I agree with the room)

`weight` is different and I support promoting it. Fan-in 5 from real code, and it is *the one proven
tradeoff axis* — the literal center of the game's design. It is cross-feature today (storage, drive,
hud, engine all touch it). It has earned the kernel. No divergence here.

### 4c. The pure half of `assembly.ts` — promote, but for the *honest* reason (refining S-D)

S-D is right that all of `assembly.ts` cannot sit in `features/workshop/`, and right about the seam.
I verified the forcing fact: `composeProduct`/`buildProduct`/`sumPartStats`/`resolveEnergyType` are
pure compute, and `content/engines.ts` + `content/containers.ts` (which become `features/engine/` and
`features/storage/`) consume the pure half *today*. So leaving all of `assembly.ts` in `workshop/`
plants a `features/engine → features/workshop` edge on day one — a real sideways arrow B forbids,
caused by *shipped* code, not by a future milestone. **This promotion is earned** (≥2 cross-feature
consumers, already): carve the pure compute to `common/sim/assembly.ts`, keep the inventory+bench
interaction (`assemble`, `dismantle`, `isBenchComplete`, `assembleVerdict`, `benchEnergyType`,
`acceptsType`) in `features/workshop/`. I support this *because the consumers exist now* — the same
test that makes me reject promoting collision makes me accept promoting this. Do it at migration.

### 4d. `EnginePart` — promote to `common/parts/`, but correct the *reason* (correcting S-A/S-C)

S-A and S-C justify promoting `engine-part`/`spawnEnginePart` by an "undeclared `scrap→engine`
edge." I traced it and the framing is slightly off: **`spawnEnginePart` lives on
`content/parts-catalog.ts`** (verified, line 200), which the proposal *already* sends to
`common/parts/`. So the scrap loot-overlay call to `spawnEnginePart` is a scrap→`common/parts` edge —
downhill and legal — the moment the catalog moves. There is no scrap→engine leak to fix there.

The `EnginePart` *component* (`components/engine-part.ts`) is a separate question, and it *should*
go to `common/parts/` — but for the honest reason: its importers are `parts-catalog`, `shop`,
`assembly`, and `workshop-overlay` (verified) — it is **part-definition vocabulary**, the kernel's
spine, not engine-feature-local data. It earns `common/parts/` on its own merits (it is catalog
vocabulary used across the kernel and workshop), not because of a scrap edge. Net effect on the
checklist is the same — promote `EnginePart` to `common/parts/` — but the rule we write down should
be "this IS shared catalog vocabulary," not "we're patching a leak," so the next agent applies the
*correct* admission test.

**The standing rule that protects all of this.** Whatever we promote, the gate must be written into
the graduating ADR as a *standing* rule, not a one-time snapshot, because a solo dev has no code
review to catch drift: *a module belongs in `common/` only when it has ≥2 distinct **feature**
consumers AND carries no feature-specific semantics; otherwise it stays in its feature; promote on the
Rule of Three, not on speculation.* Post-migration, back it with ESLint `import/no-restricted-paths`
(also enforcing the inward-only invariant: `core`/`common` never import `features`). I would make the
lint rule a fast-follow PR right after the structure settles — not a prerequisite (it would lint a
tree mid-migration) and not indefinitely deferred (with no reviewer, the structure is the only thing
keeping `common/` honest).

---

## 5. The single-owner ADRs survive, and `common/` should *strengthen* them

My lens worries about restructures fragmenting hard-won single-owner rules. Both survive intact:

- **ADR-001** (`mounting.ts` is the sole owner of grid-snap + closest-cell scan): Option B moves the
  whole file to `features/mounting/mounting.ts`. The single owner is preserved; nothing is
  re-implemented. I would *strengthen* it: restate the single-owner rule in a `features/mounting/`
  per-feature note (a capability the flat `systems/` folder cannot host — a `systems/CLAUDE.md` would
  describe 25 unrelated files), so an agent editing the slice cannot miss it.
- **ADR-002** (one `shared/three-canvas.ts` host): lives at the repo root, outside `game/src/`.
  Option B does not touch it and creates no second host. The four game files that reach it just gain
  one `../` (or become `@shared/...` under aliases). No fragmentation.

This is also where I most strongly endorse Synthesis C's per-feature `CLAUDE.md` idea — not as
ceremony, but because it is the one place the single-owner rules become *legible at the point of
edit*. A flat folder structurally cannot carry per-mechanic guidance; a feature folder can. That is a
maintainability gain the flat layout simply cannot offer.

---

## 6. On "complexity earns its place" — B passes, *if* we hold the line on promotions

The discovery-mode discipline is the thing I most want to protect, and B respects it: it creates zero
speculative folders and abstracts only what real code already shares. My one caution to the board is
that the *migration itself* is where the discipline is most at risk — not from the structure, but from
the very human urge to "tidy everything into `common/` while we're in here." §4 is my pushback on
exactly that. Promote `weight`, the pure `assembly` compute, and `EnginePart` (all have ≥2 real
consumers today). **Hold** `collision` in `scrap/` until combat gives it a second consumer. The
difference between those two calls *is* "complexity earns its place" in practice — and getting it
right during the migration is what keeps `common/` a strict kernel rather than a tidier kitchen sink.

On deferred architecture: I agree with S-B and S-D that B must **not** anticipate scenes or add a
`modes/` tier. `main.ts` today is one `World` + one `paused` flag + one frame loop — the correct
"one world + modal mode" shape. When the Restoration Sanctuary eventually forces a `GameMode` split,
that is a *composition-root* change in `main.ts`, not a slice restructure. B accommodates it without
building it. Resisting the temptation to pre-build that tier is the same discipline as resisting the
collision promotion.

---

## 7. Recommendation and exact ALTER payload

**(b) ALTER Option B.** The axis is right, the pain is present, the migration is cheap and mechanical,
and the single-owner ADRs survive. Four concrete changes, ordered for execution. None changes B's
shape.

| # | Change | Why (maintainability) | My stance vs the room |
|---|---|---|---|
| 0 | **Add path aliases** `@core`/`@common`/`@features`/`@shared` (tsconfig `paths` + ~10-line `game/vite.config.ts`) in the first PR. | Pays the import rewrite *once*; kills future depth-churn; disambiguates `common/` vs repo-root `shared/` at every site; makes tier violations greppable. | Agree with all briefs. |
| 1 | **Resolve the animator/`view.ts` direction BEFORE any file moves:** strip the four `animateX` delegates from `RenderView`, call the animators directly from `main.ts:232–235` (the composition root). Same treatment for `zone-overlays.ts`/`interaction-hints.ts` (split per-feature, wire from `main.ts`). Write the chosen resolution into the ADR. | Prevents a `common→features` tier inversion on day one — the proposal's first refactor would otherwise break its own central rule. | Agree; I prefer **elevate-to-`main.ts`** over callback injection (cleanest tier story, least machinery in `common/`). |
| 2 | **Promote the *earned* shared code at migration:** pure-compute half of `assembly.ts` → `common/sim/assembly.ts`; `weight.ts` → `common/sim/`; `EnginePart` component → `common/parts/` (as catalog vocabulary). Extract `mountedStorages` to `features/storage/` (it's a storage query living in scrap). | Each already has ≥2 real cross-feature consumers today — promotion is earned, not speculative; removes day-one sideways edges. | Agree on *what*; I correct S-A/S-C's "scrap→engine leak" framing — `EnginePart` earns `common/` as shared vocabulary, and `spawnEnginePart` already rides the catalog. |
| 3 | **Do NOT promote `collision.ts` yet — hold it in `features/scrap/`; promote to `common/sim/` in the PR that introduces combat (its real second consumer).** Write the standing `common/` admission rule (≥2 distinct feature consumers, no feature semantics; Rule of Three) + inward-only invariant into the ADR; back with ESLint `import/no-restricted-paths` as a fast-follow. | A one-consumer primitive does not belong in the kernel. Aliases make the later move free, so there is no re-churn to "avoid" by promoting early. This keeps `common/` strict. | **Diverge** from S-A/S-B/S-D, which promote collision now. This is my one substantive disagreement with the board. |

**Pilot:** scrap first, as proposed — it is the most self-contained, headless-testable slice (3 tests
run with no DOM/Three.js). The clean ordering: (i) aliases, (ii) extract `mountedStorages`,
(iii) leave collision in scrap, (iv) resolve the animator direction, (v) move scrap. Then
economy → storage → engine → drive → mounting → workshop → hud.

**Doc hygiene in the migration PR (small, agents are misled without it):** fix the already-stale
`tools/blender/build_asset.py` (`game/src/content/assets.ts` → `shared/assets.ts`); update
`blender-asset` SKILL.md step 4 (`content/` → `features/<feature>/`); add the one-line "where new code
goes" placement rule to `AGENTS.md` and the `implement-feature` skill (it does not exist today, and
deleting the role folders removes the only implicit placement signal an agent has); record the
three-tier layout + the `common/` vs `shared/` distinction in the graduating ADR. `CLAUDE.md`'s
directory map stops at `game/` level and needs no surgery.

---

## 8. Why not (a), why not (c)

**Not (a):** approving as-is approves a known day-one tier inversion (§2) and an unenforced admission
rule (§4), and ships the dominant ongoing cost (depth-churn) unaddressed (§3). The direction is right;
the *plan* is incomplete. That is the textbook (b).

**Not (c):** there is no maintainability case for a diverging axis. The flat status quo is the thing
rotting; Option A still smears each mechanic across role folders; Option C leaves render/UI
role-sliced exactly where Three.js coupling pain accumulates. Feature-first is the lower-ceremony
choice at this size, not the heavier one. The axis is correct — I only want the migration executed
with the conservative discipline that keeps `common/` a strict kernel and not a tidier junk drawer.
