# RIGRUNNER — Ideas & Brainstorms

A running log of **raw idea sessions** — thinking out loud, riffs, inspiration, "what if".

> ⚠️ **This is not committed direction.** Nothing here is decided. It's brain-dump material,
> captured so it isn't lost. Promote a thread to `CLAUDE.md` (the source of truth) only once it
> hardens into an actual decision. Compare with `observations.md`, which logs concrete findings
> from *building the prototype*; this file logs forward-looking ideas that may or may not happen.

Each session: dated, in Jaco's voice as faithfully as possible, organized into the threads that came up.

---

## 2026-05-30 — Tiered components, footprint reclaim, chassis builds

**Mode:** brainstorm / brain dump while staring at the prototype. Several loose threads, none committed.

**Note on where this sits:** `CLAUDE.md` deliberately *defers* "part tiers/levels" as a richer
tradeoff axis until the base loop proves fun. This session is texture for that parked axis — raw
inspiration to draw on later, explicitly **not** a decision to build tiers now.

### Modded-Minecraft tiered-storage as the model for tiers
The fantasy that always sells it in modded Minecraft: a **single block** holds an absurd amount, and
you can *see* its tier in the block itself.
- **Tier 1** — plain gray shell with a translucent green pane; contents fill bottom→top, a nice neon
  green flowing upward as the tank fills.
- **Tier 2** — same footprint, but the gray gains spaced-out green lights that flicker; ~4× capacity.
- **Tier 3** — rigid, bulkier framing with artistic edge detailing that reads as "special"; many×
  capacity.
What *makes the higher tier feel earned* is the disproportionate pile of crafting materials poured
into it. The block becomes precious. Having two or three of them house what used to take 50–60 blocks
is deeply rewarding.

### The real reward of a tier might be *footprint reclaim*, not raw capacity
Leaning toward this: on a scarce grid, the point of a higher tier isn't "more storage" in the
abstract — it's *the same job in one slot*. Jaco dislikes big, bulky, sprawling machines. So tiering
could collapse what used to take many cells into one or two, **freeing grid space for other
capability**. Compact, dense, special-feeling builds over bulky ones. (Applies to components in
general, not just storage — a higher-tier anything that does more in one slot.)

### Open question: what's the "absurd cost" that earns a tier?
In Minecraft the elaborate recipe is what makes the special block feel earned. The Rig Runner
equivalent is undecided. If tiers are cheap, the whole fantasy collapses into a vending machine.
Flagging, not answering.

### Tier visuals and "components should connect" may be one art system
The tier-3 ornate/bulky framing described above overlaps with observation #3 (adjacent components
should visually *connect*). Possibly the high-tier edge detailing/framing **is** the connective
tissue that bridges to neighbours — one art system, not two separate problems.

### Build identity: multi-purpose vehicle now, dedicated chassis later
- Early game: a single chassis/platform. You physically **swap parts** to repurpose it — a mining
  loadout vs a combat loadout — constructing the vehicle to fit the job at hand.
- Later: buy a **second chassis** and build dedicated, purpose-built vehicles per job.
- Knock-on: this leans hard on the already-flagged requirement that **containers/parts preserve
  their own state across attach/detach** (observations #6, #7). If repurposing-by-swapping is the
  core loop, detach/reattach happens constantly — per-part state stops being optional.

### Session context (status)
Ran `npm run dev:game`. The `game/` build now shows a **flat floor (larger than the prototype's)**
and a **vehicle ~2×3 tiles** that looks really nice — it has **steering**, drives around freely, and
the **camera follows well**. A solid starting base. ("Starting base, yeah!")
*(Resolved 2026-05-30: prototype declared complete; `game/` is now the official active build — CLAUDE.md updated.)*

---

## 2026-05-30 (session 2) — World vision: heal the world; scrap economy, looter camps, tree restoration

**Mode:** brainstorm / vision + mechanics riff from looking at example games. Still raw. The
mechanics that are firming up have been promoted to **candidate** status in `milestones.md` (still
pending, still movable — building by discovery).

### World vision: don't stay a scrapper — bring the world back to life
The inspiration games share a **post-apocalyptic look**: everything gray, dusty, desert-like, full of
scrap. You collect scrap and spend it on parts/upgrades. Jaco **likes** the scrap/metal economy and
the dependence on scrap + machinery + parts as your resource spine. What he **dislikes** is that you
remain *just a scrapper in a dead world forever*.

The thing he wants instead: **your main purpose is to fix the world, not merely fight and survive.**
You *start* scrappy and dependent on scrap to progress, but the point is restoration — and especially
**bringing nature back**: planting things, growing things, and protecting growing things that are
under threat. (Flagged as possibly a "vision cost" he wants to play with — i.e. aspirational, to be
tested.) This reframes the whole game from "survive the wasteland" to "heal the wasteland."

### Scrap economy — two distinct kinds of scrap
- **Loose scrap** — pieces scattered across the world that blend into the terrain; **driving over
  them collects them**. A *low-importance, high-volume* resource: you need a lot before it's useful,
  you can't grab it all at once, and it's a continuous little target as you drive around and explore.
  Pays for certain upgrades/parts.
- **Scrap piles** — *different*; they are **not** auto-collected. The player presses a **special key
  to interact** — rummage / dig through the pile — yielding **unique rewards** (faulty parts, rare
  parts, plus ordinary scrap), governed by a loot table. The hook: a pile is **gated behind special
  components** — you can't interact unless your rig has the right tool (drill / claw / digger / etc.).
  So a pile is a visually interesting spot that only becomes usable *after* you've upgraded your
  machine — interaction-gating as progression.

### Looter camps — enemies around a structure
Bandits surviving around some structure; hostile to you.
- **Small units** — tiny people / tiny robots that fire projectiles. Easy; a nuisance. You can drive
  over some, shoot others.
- **Medium enemies** — *vehicles*, which can actually **kill you** if you don't defend or evade,
  depending on their level/armor. Their parts resemble yours but **less built-up / less custom**.
  Destroying one drops **loot** (scrap, sometimes unique parts) via a **loot table** ("typical mob"
  drops vs rarer drops).

### Tree restoration — the first concrete "heal the world" beat
Some camps sit around an **ancient tree**. The bandits are hostile to the world and **pollute the
area, preventing the tree from growing**. Clearing the camp — possibly plus a **small quest** to
provide things that help the tree grow / set the area up — lets the tree grow and **restores that
patch of world**. This is a concrete example of *how* restoration works: clear corruption → nurture
nature → the world visibly heals.

### Map progression via clearing
Once an entire map's obstacles/challenges/corruption are cleared, that **unlocks progression** to a
new level / new map. Restoration is the through-line of progression, not just side content.
