# RIGRUNNER — Ideas & Brainstorms

A running log of **raw idea sessions** — thinking out loud, riffs, inspiration, "what if".

> ⚠️ **This is not committed direction.** Nothing here is decided. It's brain-dump material,
> captured so it isn't lost. Promote a thread to `CLAUDE.md` (the source of truth) only once it
> hardens into an actual decision. Compare with `observations.md`, which logs concrete findings
> from *building the prototype*; this file logs forward-looking ideas that may or may not happen.

Each session: dated, in Jaco's voice as faithfully as possible, organized into the threads that came up.

---

## 2026-06-02 — World/progression/restoration/tech: how it all fits (+ greenery, carry-over, fuel-as-signal)

**Mode:** brainstorm + synthesis, sparked by researching *Machine Mind* (Targem Games) and its
world/map approach. The connective overview that came out of it lives in its own doc —
[`world-progression-guidance.md`](world-progression-guidance.md) — this entry logs the **raw threads**
behind it. **Not committed.**

### Carry-over (meta-progression) candidates that feel prized
- **Workshop upgrades** — *hard* to acquire/unlock; a better workshop = **advanced alloy processing**
  + **more complex part manufacturing**. A prime thing to carry across sessions.
- **Rare/unique recipes** — basics via normal progression, **rares scavenged** across the phases and
  kept. (Same spirit as the 2026-06-01 recipe-rarity thread below.)

### Greenery trail — leave life behind you *(unsure: texture or mechanic?)*
The more you traverse, the more **greenery/plant life** you leave; more greenery → more **animal life
appears and moves**; greenery **lures life, including hostile life**. You can **ruin your own trail**
by driving back over it — *unless* you have a **gentle/preventive drivetrain** (upgradeable part).
- Worry: as a real mechanic this means *lots* of driving/reversing → fights fuel/distance balance →
  pushes toward a **huge map** → huge area to restore → very hard to balance.
- Alt: keep it **mostly cosmetic** (special hardware upgrade), still **lures animal life**, great
  visually, **decoupled from the progression gate**.

### Regeneration vs restoration — the thing I'm most unsure about
How does a roguelite **map regeneration** loop coexist with **permanent world-healing**? Undecided.
Leaning toward a **two-layer world** (persistent healed places + regenerating expedition ground), but
whether healing is truly permanent or can be **reclaimed if unprotected** is open.

### Fuel — a great teacher, maybe a poor gate
"Far travel + fuel management" as the **primary progression gate** feels **unexciting**. BUT fuel is a
great **mechanical-progression signal**: repeatedly running dry tells the player to invest in their
**energy system first** (before load / offense / defense). So: **fuel = signal, not gate.**

### Ancient-tree reclamation — the gate I'm leaning toward
A focal **ancient tree** + beautiful area, restored via **multiple quest steps**: restore **water** →
make **fertilizer** → erect **protection** (restoration *lures* malicious characters who attack the
tree). A run does **some** steps; the arc **survives across sessions**; **quest items are kept and
re-appliable** (if an area is ruined, re-apply rather than re-scavenge; finishing one quest reveals
the next requirement). Could be **one grand tree** or **multiple areas where reclaiming X unlocks
progression**. This (area reclamation) is the *exciting* gate vs. far-travel.

### Difficulty has three sources, all present
Rig progression (player gets stronger), world/environment **escalation**, and a **scaling enemy** that
forces **defensive** upgrading (not just offense). Getting stronger shouldn't trivialize the game.

---

## 2026-06-01 — Recipe rarity: basic (known/progression) vs special (loot-drop) recipes

**Mode:** brainstorm while building the recipe-driven bench (MW / PR P3 — engine + storage-container
recipes). Forward-looking texture, **not committed**.

### The idea
Two tiers of recipe, distinguished by how you get them and how good they are:
- **Basic recipes** — **known to the player** from the start or **discovered through progression**.
  The default way to build a thing. E.g. *(basic) storage container* — simple metals, **capacity =
  5 units**.
- **Special recipes** — **found in enemy loot drops**, and they **supersede** the basic recipe for
  that output. E.g. *hyper container* — advanced metals, **capacity = 50 units**. Same role, vastly
  better.

**The goal is the feeling:** finding a special recipe should be **very special and rare**, with a
**significant** benefit over the basic (the 5 → 50 jump is the *scale* of gap intended — not a +10%
tweak). The rarity and the payoff are the point; a common or marginal "special" recipe kills it.

### Tie-ins (this idea leans on already-captured threads)
- **Loot tables / enemy drops** (2026-05-30 session 2): medium enemy *vehicles* drop rare parts.
  Special recipes are a natural **rare-drop class** on those same tables.
- **Tiered components / footprint reclaim** (2026-05-30): a "hyper" doing 10× in the same footprint
  *is* the tier fantasy — a special recipe could be exactly how you **unlock a tier**.
- **Advanced metals** the hyper needs implies a **material/tier axis upstream** — overlaps the
  deferred *casing materials* + *production chain* (smelter/caster) in the spec's Deferred list.
- The **recipe selector** will have to distinguish basic vs special and stay usable as recipes
  multiply (observations #9).

### Open threads (flagged, not answered)
- Does a special recipe **replace** the basic in the picker, or **sit alongside** it as a separate,
  higher-tier output? ("supersede" leans toward outranking, but both might stay buildable.)
- **One-time unlock** (found once → known forever) vs **consumable** (a recipe you spend per craft)?
- How rare is rare? Drop-rate / gating so a special feels earned, not farmed.

---

## 2026-06-01 — Scene / game-mode architecture: deferred, with a revisit trigger

**Mode:** architecture decision captured while building MW Phase 1 / PR P1 (the workshop overlay).
Recording a deliberate *defer* so the question isn't lost — **not** a commitment to build it.

**The smell that prompted it.** `main.ts` is starting to accumulate mode-conditional branching in the
frame loop: `if (paused)` for input, `if (!paused)` for the sim block, `if (!paused)` for the
animators. Jaco asked whether — since we now have an "open-world" context and a "workshop" context —
this is the point to introduce **scenes** to manage them.

**Why "scenes" is the wrong abstraction here (the reasoning we agreed on).** A scene system
(Phaser/Unity-style) earns its place when you **swap between separate worlds** — load a level, tear
it down, load the next. That's not our shape:
- The workshop is spawned **into the same world** as everything else (`spawnWorkshop(world, …)`); the
  rig, scrap, platform and containers share one continuous space.
- You **drive into** the workshop zone — spatial proximity, not a transition; the camera follows the
  rig throughout.
- The overlay is a **DOM modal frozen over that one world** — the scene literally stays rendered
  underneath (the P1 design: skip sim, keep rendering).
- Inventory is deliberately on the **player singleton so it survives** rebuilds/chassis swaps (spec
  cross-cutting notes). The design *wants* one persistent world, not state torn down across scene
  boundaries.

So "open-world" and "workshop" aren't two scenes — they're **one world + a modal interface mode**.
Scene-swap machinery would fight the design (teardown/rebuild of state meant to persist; a second
render tree for a scene meant to stay visible).

**Decision: defer.** `main.ts` is the composition root **by design** — orchestration living there is
its job, not a leak. We have exactly **one** pause source today; one `if` is a case, not a pattern,
and the project rule is to let complexity earn its place (a second example reveals the real seam).

**Revisit trigger.** When a **second loop-mode** appears — a pause menu, a map/inspect screen, a
death/respawn state, or P6's mount-from-interface wanting its own mode — extract a small
**`GameMode` / sim-gate** concept (likely `stepSimulation()` + `renderFrame()` split, gated by a mode
enum), **not** Phaser-style scenes. Until then, ship as-is and let P2–P6 show where the loop hurts.

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

## 2026-05-31 — Workshop drain upgrade axes (captured while building the workshop)

Built the first workshop: a static 3×3 build fixture (home base) with the same mounting mechanism
as the rig, gated by a proximity zone the rig must park in. Storage containers dropped on it drain
their scrap into a player wallet (`SCRAP <n>` HUD). Two knobs were deliberately fixed for now but
left as obvious upgrade seams in `systems/workshop-drain.ts` — **captured, not committed:**

- **Drain RATE** — currently a flat `DRAIN_INTERVAL` (0.4 s per piece). A player-unlockable upgrade
  would shrink it so the workshop banks scrap faster. The constant is the seam.
- **Drain CONCURRENCY** — drain is **sequential** today (one container empties before the next
  starts). A player-unlockable upgrade would let N containers drain at once. The "drain the first
  non-empty container" loop is the seam (widen to first-N).

These are the natural first sinks for the scrap the wallet now banks — a "spend scrap to make the
workshop process faster / in parallel" loop — but neither is a committed mechanic. Add them only if
play shows the drain wait is a felt friction worth upgrading away.

---

## 2026-06-01 — Energy systems + the two engine paths

**Mode:** brainstorm / design riff while spec'ing the engine-composition feature
([`workshop-interface-spec.md`](workshop-interface-spec.md), milestone MW). Forward-looking texture
for that spec's Phase 2 — **not committed**. Energy is **not implemented at all yet**.

### The framing: the engine converts energy, it doesn't carry it
An engine on its own has no power — it gets it from a **separate energy-source component** bolted
onto the rig. The source physically only fits its matching engine: a battery has a **terminal/
socket** coupling, a fuel engine a **feed port**. The wrong source literally **won't snap** into the
wrong engine on the assembly bench. Compatibility becomes a *tactile* thing, not an error dialog —
which is exactly the "success = parts snap together" goal of the bench.

### Two energy paths, each with a real reason to exist (no dominant choice)

**⚡ Electric — Motor engine + Battery cell**
- High **power** (top speed), instant response, light, clean (recharges, no fuel logistics). The
  **maneuver / scout / combat** path.
- Weak **torque** (poor hauler), range-limited by capacity, bursts drain fast.
- **Special — the burst.** A good battery can *dump* energy in a spike → **boost** (short snappy
  sprint/dodge, or a weapon spike). A cheap battery only trickles at a steady rate → **no boost**.
  So *discharge/burst* is an upgrade axis distinct from *capacity*. (This is Jaco's "bad battery
  can't boost" idea.)

**⛽ Mechanical — Drive-block engine + Fuel reservoir (abstract, NOT petrol)**
- High **torque** (hauls heavy cargo), sustained raw output, but heavy and slow to respond. The
  **hauler / heavy** path.
- Consumes **fuel** — a consumable resource to replenish (logistics + a resource/scrap sink),
  weight, sluggish.
- **Special — overdrive/grind.** Not a snappy burst but a *sustained* heavy push: burn fuel faster
  to plow through, break free when overloaded, or ram. Electric = the *snap*; mechanical = the
  *grind*. Neither is strictly better.
- Fiction stays abstract/post-apocalyptic: fuel is a **reaction charge / fuel slug** (chemical or
  nuclear-ish — fuel cells), not literal petrol (Jaco explicitly dislikes petrol-engine feel). Opens
  **fuel grades** later (hotter slug = more output, faster burn).

Maps onto Jaco's example rigs: **mechanical + big storage = the hauler**; **battery + agility = the
combat rig**. Leans on the already-captured "multiple chassis for different jobs" idea (2026-05-30) —
the point is you keep *both* rigs, so neither path needs to win.

### Engine internals — one slot grammar, type-specific parts
Same assembly vocabulary for both engines so the bench feels consistent; the parts differ by type.

| Slot | Electric | Mechanical | Tunes |
|---|---|---|---|
| **Casing** (already in spec) | shell + material | shell + material | weight, durability |
| **Converter core** *(type-defining)* | motor / coil (rotor + windings) | drive-block / turbine | power-vs-torque character |
| **Energy coupling** *(type-gated)* | terminal / socket | fuel feed port | **enforces compatibility** |
| **Regulator** *(special-ability axis)* | discharge controller | governor / injector | burst vs steady · sustain/overdrive |
| *(deferred) Cooling* | — | heat sink / vents | future — heat is a parked axis in `CLAUDE.md` |

Energy **sources** are their own rig components with their own upgrade axes:
- **Battery cell:** capacity (range/runtime) · discharge/burst (boost) · weight scales with capacity ·
  recharges.
- **Fuel reservoir + fuel:** tank capacity · feed rate (sustained torque) · fuel grade · consumed,
  must be refilled.

### What they look like (on-palette, archetype readable at a glance)
The win is **silhouette + colour telling you a rig's role from across the field.**
- **Electric — clean & glowing.** Compact cylindrical motor; exposed coil windings; **`glow_green`**
  energy accents; cool `rig_blue` cast; hums. Battery **reuses the tiered-storage tank visual** —
  translucent pane, green charge filling bottom-up, brighter when full, **flickers on discharge/
  boost**; charge lights along it.
- **Mechanical — grimy & heavy.** Bulkier, blocky, top-heavy; **`rust` + `dark_metal`**; visible
  pistons/turbine; vents + exhaust ports with heat shimmer; **`hazard_yellow`** markings. Fuel
  reservoir is a rugged drum/canister with hazard stripes and an **amber/rust fuel-level window**
  (deliberately *not* green — the colour contrast is the tell).
- **The coupling is visible:** a glowing conduit/cable (electric) vs a fuel hose (mechanical) running
  source→engine — doubles as the "components should visually connect" idea (observations #3).

### Open threads (flagged, not answered)
- **Battery recharge model** — workshop-only? regenerative while driving/braking? Changes how
  range-anxious the electric path feels.
- **Does fuel weight drop as it burns?** A tank that lightens as it empties would tie fuel straight
  into the weight-tradeoff pillar (laden→light over a run).
- **Hybrids** — probably *not* early; the clean either/or is what creates the two-rig identity.
  Resist until play asks.

### Update 2026-06-01 (later) — parts of this firmed into decisions
Jaco confirmed direction, so some of the above moved from raw idea → committed-for-the-milestone and
into the reworked spec ([`workshop-interface-spec.md`](workshop-interface-spec.md), milestone MW):
- **Decided:** the four-slot engine grammar (casing · converter core · energy coupling · regulator);
  **two** engine/energy types (electric, mechanical); **no hybrids** — a chassis is locked to one
  energy type (mounting a conflicting type won't snap; remove first to swap).
- **Decided (near-future, not this milestone):** the energy-type lock will extend to *other*
  components — energy weapons need an electric chassis; some mechanical weapons (e.g. a rotating
  turret motor) need a mechanical chassis. Flagged "soon rather than later," but out of MW scope.
- **Deferred for MW (Jaco's call, to cut scope):** the **energy *source* components** (battery cell,
  fuel reservoir) and all **fuel/charge consumption** — for the milestone, a completed engine just
  runs on *unlimited* energy; only its *type* (electric vs mechanical) shapes behaviour. The richer
  energy economy (capacity, discharge/burst boost, fuel grades, recharge) stays raw above.
- **Still raw (unchanged above):** visuals/identifiability direction, the boost-vs-overdrive special
  abilities, and the open threads — kept as texture to draw on, not built yet.

---

## 2026-06-01 — Workshop-only re-fitting & where collected parts live

**Mode:** brainstorm/observation while testing MW / P5 (composed engines + the inventory→world
bridge). Two threads surfaced. **Not committed** — captured to revisit once the workshop
**staging grid** (the spec'd follow-up) is in and we can feel them.

### Thread 1 — rig re-fitting only makes sense inside the workshop
A side-effect we noticed: the build interaction now always snaps a grabbed rig part back to a deck
cell — you can no longer dump a part loose in the field; it only moves between cells on the rig.
That was **not intentional**, but the more Jaco sat with it, the more it reads as the *right*
boundary: **you shouldn't be able to reconfigure your rig out in the field.** Re-fitting is a
workshop activity.

**The idea:** make it a real rule — **rig reconfiguration (grab/move/mount/unmount of rig parts) is
allowed only while the rig is parked in a workshop zone.** Outside the zone the build is frozen: the
rig is whatever you drove out with. A clean, teachable constraint that gives the workshop more
meaning and makes "park to re-fit" a deliberate beat.
- **Felt cost:** a bad build can't be salvaged mid-run — you live with it until you limp home. That's
  on-pillar (the run teaches the bay) but worth feeling before committing.
- **Scope when built:** small — gate the build-controller's grab/drop on the same `WorkshopZone.active`
  flag the overlay tab already uses. Self-contained; flagged as a likely **follow-up PR** (Jaco's call
  was "capture for now, revisit once the staging grid lands").

### Thread 2 — how does a player *collect* parts, and where do they go?
Open question raised by the inventory work: when the player gets a part — e.g. **looting an enemy
drop** (a rare part) — **where does it land?** Two shapes:
- **(a) Straight to inventory.** Simple, "magic backpack" — the part just appears in the abstract
  inventory the workshop browses. Cheap, but unphysical and free.
- **(b) A physical carry mechanism on the rig.** Parts must be hauled home in a **salvage/cargo
  module** mounted on the rig (like containers carry scrap) — capacity-limited, weighs you down,
  and **only what you physically carried back enters the inventory** at the workshop. On-pillar: it
  ties looting into the weight/build tradeoff and the build→run loop.

**Wrinkle:** collected parts can be **sub-parts** (a casing, a core) *or* **whole products** (a
complete engine, a container) — the carry mechanism (if any) has to handle both. Leaning toward (b)
in spirit (physical, costed) but it's unbuilt and unscoped; (a) may be the pragmatic first cut.

### Note — sub-parts are barred from the staging grid (for now)
The staging-grid spec only lets **assembled/mountable products** move between inventory and the
workshop deck; **loose sub-parts cannot** (a lone casing has no standalone use on a deck). Captured
here as a **possible future unbar** — e.g. a workshop *fixture* that consumes raw sub-parts off the
deck (smelter/caster territory) might want them there. Not a reason to allow it yet.
