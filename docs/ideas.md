# RIGRUNNER — Ideas & Brainstorms

A running log of **raw idea sessions** — thinking out loud, riffs, inspiration, "what if".

> ⚠️ **This is not committed direction.** Nothing here is decided. It's brain-dump material,
> captured so it isn't lost. Promote a thread to `CLAUDE.md` (the source of truth) only once it
> hardens into an actual decision. Compare with `observations.md`, which logs concrete findings
> from *building the game*; this file logs forward-looking ideas that may or may not happen.

Each session: dated, in Jaco's voice as faithfully as possible, organized into the threads that came up.

---

## 2026-06-08 — Wheel/track marks on the terrain (the missing feel-win) + where we are / what's next

**Mode:** reacting to the game after a play session, taking stock of state and naming the most likely
next thing to build. **Not committed** — the concrete current-state findings are logged separately in
`observations.md` (#15–#17); this is the forward-looking design thinking, especially the *how would the
track mechanism work* part.

### Taking stock — what feels done, what's looming
- **Looter camps feel done.** Functional, they look decent, properly clearable, and trap-designable.
  As a *content + flee-or-fight* system it lands. (→ `observations.md` #15.)
- **The build is not balanced — at all.** Parts are simply *available*, and a few have enough scrap to
  buy. There's no balance and nothing is **gated behind progression** yet. Eventually this needs real
  balancing + a progression gate. I'm not designing that here — the shape of that gate is already
  captured (`world-progression-guidance.md` §4 progression / region-gating, and **MP** part-identity
  tiers). Logging it as the looming system, with the current-state gap in `observations.md` #16.

### The track marks — a simple thing that adds a lot, completely missing
Right now **anything that moves on wheels or tracks leaves nothing behind.** It should leave a **mark on
the terrain** — a track that **fades slowly** — so you can see where you drove. This is a *small* thing
that adds a **lot** to the feel, and it's totally absent. It's my pick for the **most likely next thing
to build** because the effort-to-payoff is lopsided in our favour.

**Start simple (v1):** purely a fading drive mark. As the rig moves, lay a trail of marks under the
wheels/tracks that ease out over a few seconds. No gameplay meaning — just "I was here, and the land
remembers for a moment." Cosmetic, like the scrap/camp stains already are.

**It's cheap because the seam already exists.** We already drop **fading radial ground decals** for
scrap seepage and camp mess — `features/scrap/scrap-stains.ts` and `features/camps/camp-stains.ts` are
render-layer collaborators that stamp canvas-texture decals on the ground and ease their opacity each
frame with zero gameplay coupling. A track-layer is the *same pattern*: a new render-side collaborator
(its own `features/tracks/` slice per ADR-003) that drops a decal behind the rig as it moves, reading
the rig's position/velocity off the drive movement seam (`features/drive/movement.ts`), alongside the
existing wheel-spin visual (`features/drive/wheel-spin.ts`). The scrap-stain spec even already lists a
**"residual scorch — a faint mark where you were"** as a captured extension (§7) — track marks are that
idea, made into a trail.

**The future version — the mark *attributes toward restoration*.** This is the part that matters for the
through-line. Per `world-progression-guidance.md` §3a (**earned, upgradeable, persistent life-trails**),
the mark eventually isn't a generic tyre scuff — it's **made through a specific part and/or a specific
resource you carry**, and laying it down **contributes to restoring the world**. So the same surface
spans both ends:
- **now:** an unconditional, fading "you drove here" mark — feel only;
- **later:** a *part-gated, resource-fed* trail that **persists** and **greens** the ground (soil →
  grass → blooms), an earned ability, not a default — exactly the life-trails reward.

This rhymes with the **Reclaimer through-line** (a durable instrument + a swappable head/feed): a generic
drive mark is the cheap rung; a restoration-grade trail is the same trail laid by a dedicated part
consuming a dedicated resource. Build the v1 mark so the *trail-emitter* is the seam a future
"life-trail emitter" part plugs into — don't build the gating/persistence/greening now.

**Open — the mechanism to determine:** how the trail is actually emitted and tuned. First guesses to
settle at build time:
- **Emission:** sample a decal every N units travelled (distance-based, so speed doesn't change spacing)
  vs. every M ms — distance-based likely reads better; per-wheel/track contact points vs. one mark under
  the rig centre.
- **Look:** two parallel tread bands vs. a single smudge; orient to heading; vary like the scrap stains
  do so it doesn't read as stamped copies.
- **Fade/lifetime:** how long a mark lingers before easing out (the scrap stains use ~8 s in, ~14 s out
  — a drive mark probably wants a shorter, snappier life so the trail reads as *recent*).
- **Budget:** a moving rig emits continuously — needs a ring-buffer / cap on live decals (or instanced
  batching, already flagged as the scrap-stain optimisation) so a long drive doesn't pile up draw calls.
- **The future fork:** is the restoration trail the *same emitter* upgraded (a tier on one system), or a
  *second* emitter that only exists once you own the part? Leaning same-system-upgraded, so v1's seam is
  literally what the part later drives.

**Status:** RAW idea. The v1 fading drive-mark is a strong candidate for a **deliberately-minimum**
near-term option (stands alone, worth it the day it ships, exposes a clean seam) — but **not promoted to
`milestones.md` yet**; it's the concrete visual seed of the already-listed *Earned, upgradeable,
persistent life-trails* skeleton milestone (guidance §3a). Promote when we commit to building it.

---

## 2026-06-05 — A built part should *look* like the parts it's made of (composed sub-part rendering)

**Mode:** reacting to the game, capturing a target. Sparked by playing the freshly-shipped MP **Phase 1**
tiers ([`part-identity-spec.md`](specs/part-identity-spec.md)): the per-piece tier **tint** is working, and on
the Reclaimer (two real assets — arm + bucket) I can clearly see an iron arm next to a rusty bucket. That
made me want the *whole* thing this points at. **Not committed** — this is the ideal I'm aiming for, and
it's a later, more polished job. For now the tint is a fine, easy stopgap that buys real progression.

### The target: a product is visibly a composition of its sub-parts
When I assemble several parts into one product, I'd love the assembled thing to be a **single asset built
from positioned, scaled sub-part models** — each sub-part **wearing its own tier material/finish** — so
it's obvious at a glance that this is *a whole made of multiple, individually-graded parts*. Not one
silhouette I recolour; an actual little assembly where each piece shines through with its own colour.

### The engine is the clearest example
An engine has a **frame** plus internals. So:
- The **frame** should *not* be a solid block — it's a **frame**: sides with big **holes** in it, open
  enough to see through to what's mounted inside. If the frame is rusty, it reads brown.
- The **internals** sit at **specific points** inside that frame, each **scaled to fit** its place — not
  floating, not random; located where it belongs in the whole.
- Each internal carries **its own tier**: say the frame is rusty (brown), one internal is iron (grey),
  another is some **green metal** — and you can **see all those colours at once**, distinct and obvious,
  through the open frame. The build reads as "an engine made of these specific, differently-graded parts."

That's the feeling: you look at a built engine and *read its bill of materials* — what it's made of and
how good each piece is — straight off the model.

### Why it's not now (and what makes it real work)
This is a **polish/art-pipeline activity**, not a quick swap. The hard parts are the *placement, scale,
and wear* of each sub-part **within** the whole: every product needs an authored layout (where each slot's
model sits inside the frame, at what size), and each sub-part needs its own model (the engine sub-parts
don't have assets yet, and we haven't even decided what a composed engine *looks* like). Until then,
falling back to a **simple tinted block/placeholder** for a missing sub-part asset is totally fine.

### Where it plugs in
- Directly continues **2026-05-30 → "Tier visuals and 'components should connect' may be one art system"**
  and **observation #3** (parts read as random blocks; adjacency should *connect*): the open-frame +
  located-internals idea is plausibly that same connective art system — the frame is the connective tissue,
  the internals are what it visibly holds.
- It's the richer end-state of **`part-identity-spec.md` §3** (the tier→material-finish visual cue). The
  shipped Phase-1 **flat tint** is the cheap first rung; **per-sub-part composed models** is the top of
  that same ladder. The render seam already resolves a tier *per sub-asset* (`assetTier`/`productTints`),
  so when sub-part assets and an authored layout exist, each piece wears its own grade with little new code.
- The **Reclaimer already does a tiny version of this** (arm asset + bucket asset, each its own tier) —
  living proof the direction works; the engine is the same idea with more pieces and an authored interior.

### Status
**Captured target, not a commitment.** Settling on the tint for now — it's easy and gives a bit of
progression. Revisit when we're doing the art pass and have a direction for what composed products
(starting with the engine) should actually look like.

---

## 2026-06-04 — Chassis tiers as the cap that makes part-tiers safe (+ refined energy identity, multiple rigs, cross-type viability)

**Mode:** design session, firming. Sparked by the drivetrain rebalance (milestone MD) and the worry
that the part-identity **tier** work (MP / [`part-identity-spec.md`](specs/part-identity-spec.md)) would
either be too weak to feel or strong enough to wreck the slow, deliberate pace we want. The shape
below feels like the missing constraint — but the open forks are real, so this stays **candidate,
not committed.**

### The worry that started it
Once parts have material **tiers** (rusty rim → iron shell → …), every tier wants to improve the rig
— including its **driving performance**. That's a trap: make the per-tier driving benefit **small**
enough not to wreck the gentle-scaling feel and the upgrade is boring; make it **large** enough to
feel rewarding and it breaks playability (back to snail→rocket). Tiers toward driving perf can't be
both meaningful and safe — *unless something caps the ceiling.*

### The resolution — the **chassis** is the envelope (the cap)
Introduce the **chassis** as a real, tiered thing that sets a **min/max number of engines** it can
run. The chassis — not the engine count — defines what's physically possible. Move the scaling lever
off **quantity** (how many engines) and onto **quality** (part tier), with the chassis as the hard
ceiling. Two equivalences pin the model:

- **1×-wide chassis + 1 engine  ==  2×-wide chassis + 2 engines** (same engine tier) → *same driving
  performance.* Going bigger and adding engines to match **does not** raise per-unit performance —
  the bigger rig just needs more engines to achieve the *same* feel (and in return carries more).
  Quantity/size doesn't multiply speed.
- **1×-wide chassis + 1 _iron_ engine  >  1×-wide chassis + 1 _rusty_ engine** → **tier (quality) is
  the dial.** Same chassis, same count, better part = better performance.

So a bigger chassis **requires** more engines just to operate (the "requirement for a larger rig");
engine **count scales with size to maintain** performance, it doesn't stack it; and **part tier** is
what actually moves the needle — capped by the chassis's "sensible maximum" for acceleration /
steering / top speed. This kills exponential engine-stacking and brings improvement back to *what
parts you fit*, not *how many*. It's also the piece that **unblocks MP** (tiers were dangerous
precisely because nothing capped their effect on driving — the chassis ceiling **is** that cap), and
it reframes MD's agreed "gentle, tunable diminishing returns" as **saturation toward a chassis
ceiling** — a more principled version of the same curve.

> On the earlier A/B fork (does engine *count* add performance, or is it just a requirement?): the
> equivalences answer it — count basically **scales with chassis size to hold performance flat**;
> it's a power *requirement*, not a speed multiplier. Tier is the lever. (Within one chassis, more
> engines still help up to its max — you need enough to move it.)

### Balance ranges — later, once tiers exist
Tune the **min/max rig driving performance** to stay in **realistic ranges for the game's vibe**
(slow, deliberate, time-to-think). Target: **entry-level driving = acceptable**, **max-tier = really
pleasurable** — a satisfying span, but both ends inside the deliberate-pace envelope. **Defer the
actual numbers** until more part tiers exist (can't tune the curve before the tiers it runs over
exist — and weight is still parked, see MD / Option A).

### Energy identity, refined (the two classes)
- **⛽ Mechanical = the hauler.** Heavy-load, **large** chassis; **low** acceleration and **low** top
  speed; **heavy energy user.** The build for **big haul trips** where **fuel is carefully planned.**
- **⚡ Electrical = the scout.** **Low-load** chassis; **high** acceleration and **high** top speed;
  **high mileage** (efficient / long-legged). The build for **fast offensive or scout** runs.

(Sharpens the 2026-06-02 "energy-as-class" thread: each type is a *class* with a chassis-size bias,
not just a stat tweak.)

### Multiple rigs vs. choose-one — leaning **multiple**
Leaning toward **letting the player own multiple rigs** (so they can experience both classes) rather
than forcing an up-front either/or. **This reverses the lean of the 2026-06-02 session**, which
floated *choose-a-class-from-the-start* as a clean replayability mechanism. Not decided — but the
current instinct is that a hauler *and* a scout in the stable is the more enjoyable shape (the
2026-05-30 "second chassis later" idea already points this way).

### Open question — can a type cross over? (electric hauler / mechanical scout)
If electric is "low-load / fast" and mechanical is "heavy / slow," can you ever make a viable
**electric hauler** or **mechanical scout** — and should you? Candidate answers (all raw):
- **Gold (special) engines** patch the weakness: a **gold electric** engine ships a **torque boost**
  (→ electric can haul); a **gold mechanical** engine ships a **fuel-efficiency boost** (→ mechanical
  can range/scout). Ties straight into MP's "specials = rare *gold parts*, not recipes."
- **Special fuel / energy** overcomes the shortcoming, at the cost of being **more expensive / more
  complicated to manufacture** (the tradeoff): **high-discharge batteries** for electric,
  **polished steam valves** for mechanical.
- Either way the principle is the same: the cross-over is **earned and costed**, never free — you pay
  (rarity or manufacture complexity) to break your class's natural limit.

### Housekeeping
- **Current rig is 2×3, not 3×3.** In this tier scheme 2×3 is a **large** chassis — the *starter*
  would be the smallest (size 1). (A stray "3×3" in the dev-seed comment is corrected in this PR.)

### Where this plugs in
- **Unblocks / reshapes MP** — the chassis cap is what makes tiered driving stats safe; gold-engine
  cross-over is MP's gold-part idea applied to engines.
- **Reframes MD** — the gentle diminishing-returns curve becomes saturation toward the chassis ceiling.
- **Pairs with** footprint-reclaim (2026-05-30 — better tier = same job, fewer cells), multiple
  chassis (2026-05-30), energy-as-class (2026-06-02), and the deferred fuel/energy-source economy
  (MW deferred / 2026-06-01).

### Open forks (flagged, not answered)
- **What unlocks the next chassis tier?** scrap cost · a restoration milestone · a found/salvaged
  chassis? (This is what makes it *progression*, not a shop SKU.)
- **Does cross-type viability exist at all**, and if so via gold engines, special fuel, or both?
- **Multiple rigs vs. choose-one** — leaning multiple, not locked.
- **The "flat near the cap" trap** — tiers must buy a *new* envelope (next chassis / freed cells /
  another axis), not just inch toward a ceiling already hit.

---

## 2026-06-03 — Part naming & lore: rarity-as-material tiers (rebrand the sub-parts)

**Mode:** raw idea, sparked by the workshop-UI density observation (`observations.md` #10) — the
sub-part names are confusing and text is doing all the work. **Not committed — needs a proper
brainstorm.**

**The itch:** the current sub-part names (Coilframe Casing, Motor Coil, Power Terminal, Discharge
Regulator, Drumframe Casing, Drive Block, Fuel Feed, Governor, Container Shell/Rim…) are a mouthful
and hard to parse at a glance. They describe *function* in flavour-text terms, but they don't tell
you **what tier / how good** a part is, and there's no visual hook to lean on.

**The idea:** do some **lore work and rebrand the parts around material tiers**, so a part's **name is
simple** and its **rarity is legible from the material** — and crucially that material maps to a
**visual cue** (colour / finish / sheen) so you read quality by *looking*, not reading.

- **Rough tier ladder (placeholder names):** **scrap parts → pure metal parts → alloy parts → infused
  metal parts.** Ascending rarity/quality. (Exact names/count TBD — this is the riff, not the spec.)
- **Why it helps:** ties directly into the loot table (Option C) and the future recipe-rarity work —
  a "scrap-tier core" vs an "alloy-tier core" reads instantly, and the loot UI / shop / bench all get
  a shared rarity language. It also gives the **asset pipeline a reason and a palette**: each tier is
  a finish, so even grey-box GLBs can carry tier by colour, which is exactly the disambiguation
  observation #10 says the text is currently forced to do alone.
- **Open threads for the brainstorm:** does the tier attach to the **material** (a casing comes in
  scrap/alloy/infused) or to **distinct part names per tier**? How many tiers? How does it interact
  with the **electric vs mechanical** type axis (orthogonal? or do tiers read differently per type?)?
  How does tier map to **stats** (flat better, or trade-offs)? And the **visual-cue system** — one
  palette of tier finishes shared across every part, defined once (like `rr_style`).

**Status:** PROMOTED (2026-06-03). This raw thread has been worked into a structured spec +
implementation plan — [`part-identity-spec.md`](specs/part-identity-spec.md) — after a follow-up brainstorm.
Key shifts from this raw entry: tiers are **per-sub-part + additive with a matched-set bonus** (not a
single product tier); "special" is reworked from a **rare recipe** to a **rare "gold" part variant**;
and the engine vocabularies **diverge** (electric: Casing/Core/Coupling/Regulator · steam:
Boiler/Piston/Driveshaft/Throttle) rather than sharing nouns. See the spec for the decided vs.
earn-their-place parts. Still pairs with the workshop-UX pass in `observations.md` #10.

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

## 2026-06-02 (cont.) — Separate the ancient tree into a Restoration Sanctuary (a sub-game)

A reframe of the restoration idea above. **The roguelike loop is not the mission — it's a means to an
end.** So restoration shouldn't live inside the part of the game that regenerates. *(Guidance updated
in [`world-progression-guidance.md`](world-progression-guidance.md).)*

### Pull the ancient tree out of the run
- The ancient tree / restoration area **doesn't need to render inside a run**. Make it a **separate,
  persistent area you visit from a menu** to *see* the restoration you've applied.
- So **no re-applying** quest items in-world. Instead you **earn special parts/upgrades/mechanisms in
  runs** and bring them to this area.
- Maybe it isn't even a hard roguelike — could be a **long-term persistent world** where being "out in
  the field" has a **penalty** that resolves back at the **workshop**, vs. restart-and-rebuild.
- The area should be **3D and beautiful**, with art of life that **gradually evolves and improves** over
  time. The slow gorgeous payoff.

### It's an ecosystem you solve (high intent)
- Problems over time = **life but lack of balance**: moles, rats, etc. You introduce things to regain
  balance.
- Interlocking: right **crops/plants** → better **soil / pH** → **thicker plants** → **rats target the
  tree less**. *Really complex ecosystem solving* — want to pour intent into this.

### Life-trails: earned, upgradeable, persistent
- Upside of separating the sanctuary: **tracks left in the world don't disappear** → satisfaction of
  trying to **cover the whole world** in life.
- Life-trails are **NOT default** — gained through **progression / special mechanisms**. The rig's
  tracks can be **upgraded over time**:
  - improve **soil quality** (darker, richer),
  - leave **grass**,
  - force **blooms and shrubs** randomly.
  More of it = the world looks better.
- Enemy camps → **tree stumps**; clear the enemies (once or repeatedly) and surround the stump with
  restored soil. Tracks **grow** → trees **drop fruit**, **flowers**, **lure new animal types**.

### Bring-from-main → apply-to-sanctuary IS the progression
- Enough world-restoration earns a reward, e.g. **bunnies** → move them **into the sanctuary** → new
  life for the ancient tree. (One small example of a big intended system.)
- The main game **generates** rewards; the sanctuary is where you **spend/apply** them — **that's how
  progression is tracked.** Almost a **sub/mini-game**.

This supersedes-leaning the earlier "drive over your trail and ruin it unless gentle drivetrain" idea
(trails now persist); that destructible variant is **parked, not deleted**.

## 2026-06-02 (cont. 2) — Energy identity: electric vs mechanical, both restorative

Layering on the existing engine duality (MW: electric vs mechanical, no-hybrid type-lock). Candidate.
*(Threaded into [`world-progression-guidance.md`](world-progression-guidance.md) §5.)*

### Both should be restorative — no "dirty" option
- I want **both** energy systems considered **restorative**.
- **Electric** = clean, environmentally safe.
- **Mechanical** = keep **high torque / more power**, but **avoid** fossil-fuel / air-pollution
  connotations. Think **steam power**, not petrol/exhaust. (Matches the "abstract reaction charge, not
  petrol" note from 2026-06-01.)
- The choice could be a bit **stigmatised**, but it shouldn't be moralised into good-vs-evil.

### Energy type as a class / build identity
- It's a **good option to let the player have multiple rigs** so he can experience both — players may
  enjoy **different rigs for different purposes**. But **acquiring multiple rigs should be very hard**
  vs. a single one.
- Alternatively, make it a **choice from the start**: mechanical (steam) vs electrical, which affects
  everything afterwards — **every unlock / progression and the rewards in the heart system** would be
  **specific to that energy type**. Like a **class / build type**: the player decides a direction.
- Once completed, they can **retry with a new build** → a clean **replayability** mechanism.

Not deciding multiple-rigs vs start-choice yet; they're not mutually exclusive.

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

**Mode:** brainstorm / brain dump while staring at an early build. Several loose threads, none committed.

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
Ran `npm run dev:game`. The `game/` build now shows a **flat floor** and a **vehicle ~2×3 tiles**
that looks really nice — it has **steering**, drives around freely, and the **camera follows well**.
A solid starting base. ("Starting base, yeah!")
*(Resolved 2026-05-30: `game/` is the official active build — CLAUDE.md updated.)*

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
([`workshop-interface-spec.md`](specs/workshop-interface-spec.md), milestone MW). Forward-looking texture
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
into the reworked spec ([`workshop-interface-spec.md`](specs/workshop-interface-spec.md), milestone MW):
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
