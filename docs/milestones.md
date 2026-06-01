# RIGRUNNER — Milestones

Candidate milestones for the **official game**, discovered while building by exploration.

> ⚠️ **Pending & movable.** We have no committed roadmap yet (see `CLAUDE.md` → "build by
> discovery"). These are the ideas from `docs/ideas.md` that have firmed up enough to *aim at* — but
> scope, order, and inclusion can all still change. Nothing here is a promise. When a milestone is
> genuinely settled or delivered, reflect that in its status and, if it becomes core, in `CLAUDE.md`.

**Status legend:** `pending` (candidate, not started) · `active` (in progress) · `done` · `parked`.

---

## How these fit together

They form a rough dependency chain rather than a flat list: a **scrap economy** funds upgrades →
upgrades (tools) **unlock scrap piles** → combat-capable rigs **clear looter camps** → cleared camps
enable **world restoration** (the tree) → restoring a whole map drives **progression**. The "heal the
world / bring nature back" vision (in `ideas.md`) is the through-line they all serve.

---

## M1 — Loose scrap collection (the resource spine) · `active`

**What:** Scrap pieces scattered across the world, blending into the terrain; **driving over them
collects them**. A low-importance, high-volume currency — you need a lot, you can't get it all at
once, it's a continuous little target while exploring. Spends on upgrades/parts. Needs a HUD readout.

**Why first:** It's the economy everything else spends against, and it's the simplest standalone
loop ("drive, collect, see the number grow").

**Status (PR #2, `cc356d6`):** The *collection* half is in — scrap scatters in a ring, driving the
rig (chassis or any mounted part) over a piece sweeps it into mounted `Storage`, atomic per-piece and
gated on having a tank bolted on, with a HUD readout and a visible fill fraction. **Still open before
M1 is `done`:** a *spend sink* (scrap currently has no destination — no upgrade/part purchase yet),
plus the deferred polish from the commit — **laden weight** (cargo makes the rig heavier, the felt
tradeoff), collect FX, and a run lifecycle/reset frame.

---

## MW — Workshop interface, parts inventory & engine composition · `pending`

**What:** Two phases. **Phase 1** — an **openable workshop interface** (a tab appears in the workshop
zone; clicking it opens a game-freezing overlay) + a **generic parts inventory** on the player and an
**assembly bench**: browse owned parts, inspect them (details + rotatable 3D portrait, reusing the
viewer's display), and drag parts freely between **inventory** and **bench**. **Phase 2** — **engine
composition**: engines are **assembled from four parts** (casing · converter core · energy coupling ·
regulator) in **two energy types** (electric / mechanical) — 8 parts total — and **mounted on a
chassis** under a **no-hybrid type-lock** (a rig is locked to one energy type; a conflicting engine
won't snap until you remove the incumbent). The placeholder Mk1/Mk2 engines are retired in favour of
the two composed types.

**Why:** Turns the workshop from "a second mounting grid that banks scrap" into a place you *work in*.
Engine composition replaces the single Mk1→Mk2 choice with two distinct build identities (electric =
snappy/scout/combat; mechanical = heavy hauler) that keep weight central and serve the **physical
composition** pillar — success and *incompatibility* are both felt as parts snapping (or refusing to).

**Decided (2026-06-01):** the four-slot grammar, the two types, and the no-hybrid type-lock. The lock
will later extend to other components (energy weapons → electric chassis; some mechanical weapons →
mechanical chassis) — near-future, not MW.

**Deferred for MW (scope cut):** the energy **source** components (battery cell, fuel reservoir) and
all **fuel/charge consumption** — a completed engine runs on **unlimited** energy; only its *type*
shapes behaviour. The boost/overdrive special-ability *activation*, casing materials, and the
production chain (smelter/caster) are also deferred. (All captured in `ideas.md`, 2026-06-01.)

**Done when (verify in-game):** with the 8 parts granted to inventory, build **both** a complete
electric and a complete mechanical engine on the bench, store them, **mount one and drive** with
type-correct feel, and confirm the **cross-type mount is blocked** until the first engine is removed.

**Spans many PRs** (deliberately — see the spec). Ship Phase 1 first, feel it, then build Phase 2.

**Depends on:** the existing workshop zone + mounting (done). Acquiring parts could become M1's
still-open **spend sink** (a future production chain spends scrap to make parts).

**Full spec:** [`workshop-interface-spec.md`](workshop-interface-spec.md) — known-parts list, engine
types, the type-lock rule, per-PR scope/files, and manual-test checklists.

---

## M2 — Scrap piles: interact-to-rummage, tool-gated · `pending`

**What:** Distinct from loose scrap — **not** auto-collected. Press a **special key to rummage/dig**,
yielding rewards from a **loot table** (faulty parts, rare parts, ordinary scrap). Each pile is
**gated behind a required component** (drill / claw / digger / etc.): unusable until the rig is
upgraded to have the tool.

**Why:** Introduces interaction-gating as progression and the first **loot-table** system. A visible
"locked until you build the right thing" hook that rewards upgrading.

**Depends on:** M1 (scrap as reward), and the parts/upgrade system to own the gating tools.

---

## M3 — Looter camps & enemies · `pending`

**What:** Bandits surviving around a structure, hostile to the player.
- **Small units** — tiny people/robots firing projectiles; easy nuisance; drive-over or shoot.
- **Medium enemies** — *vehicles* that can kill you (scaled by level/armor); parts resemble the
  player's but less built-up/custom. Drop **loot** (scrap, sometimes unique parts) via **loot
  tables** (typical-mob vs rare drops).

**Why:** Activates the "flee-or-fight" pillar against real threats and makes combat builds matter.

**Depends on:** the rig's weapon/defense parts; reuses the loot-table system from M2.

---

## M4 — World restoration vertical slice: the ancient tree · `pending`

**What:** Some camps sit around an **ancient tree** the bandits pollute, preventing its growth.
Clear the camp — possibly plus a **small quest** to provide what the tree needs — and the tree
**grows**, visibly **restoring that patch of world**. The first concrete proof of the "heal the
world" pillar: clear corruption → nurture nature → the world heals.

**Why:** This is the heart of the game's identity (restoration over endless scrapping). Worth a
deliberate vertical slice to find out whether the restoration fantasy actually lands.

**Depends on:** M3 (clearing a camp). Introduces quests and persistent world-state change.

---

## M5 — Map clearing → progression · `pending`

**What:** Clearing an entire map's obstacles/challenges/corruption **unlocks progression** to a new
level / new map. Restoration is the through-line of progression, not just side content.

**Why:** Turns the per-area restoration beats into a game-length arc and answers "what's it all for."

**Depends on:** enough of M1–M4 to make "a map" meaningfully clearable.
