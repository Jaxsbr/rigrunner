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

## M1 — Loose scrap collection (the resource spine) · `pending`

**What:** Scrap pieces scattered across the world, blending into the terrain; **driving over them
collects them**. A low-importance, high-volume currency — you need a lot, you can't get it all at
once, it's a continuous little target while exploring. Spends on upgrades/parts. Needs a HUD readout.

**Why first:** It's the economy everything else spends against, and it's the simplest standalone
loop ("drive, collect, see the number grow").

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
