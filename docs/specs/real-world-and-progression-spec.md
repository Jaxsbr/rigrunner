# RIGRUNNER — Real world & progression (spec skeleton + phased plan)

**What this is:** the phased plan for moving RIGRUNNER **from a sandbox-you-test-in to a
game-someone-plays** — a persistent real world separated from a free-for-all test world, a save/menu
front door, a committed **progression spine**, and the onboarding that leads a player down it. It is the
connective plan that several smaller mechanics (scrap, Reclaimer, camps, restoration) now plug into.

> **Status:** ✏️ **Skeleton — candidate, not started.** Captured from the **2026-06-10** session in
> [`../ideas.md`](../ideas.md) (read that for the voice/why). One real decision was made there — the
> **restoration-purpose call** (§2) — but the phases below are **candidate direction, deliberately movable**
> and **not yet promoted** into [`../milestones.md`](../milestones.md) or `CLAUDE.md`. This skeleton exists so
> the shape isn't lost and can be cut into deliberately-minimum slices when each phase is picked up.

---

## Why this exists (the problem it solves)

Every new world-interaction part (a Reclaimer + bucket to work a scrap pile; a stump-healer to heal a
stump) has to be **tested**, so the part gets shoved into the player's inventory / workshop / starting rig.
The result: **the starting experience is permanently in flux** and has never been *crafted* — it's always a
weird half-state deferred to "later." The fix is a clean **test world vs persistent real world** split, which
turns out to be the same foundation as **save persistence** and a **front-door menu**.

## The unifying insight

> **Test/real split + save persistence + a front-door menu are ONE foundation**, not three jobs: a notion of
> *a game/save* vs *the sandbox*, with a menu that picks which to enter.

Two consequences fall out of building a **persistent** real world:

- It **resolves** the long-open `world-progression-guidance.md` fork *"persistent vs roguelike world"* in
  favour of **persistent** (healed ground stays healed because the world is saved).
- It **dissolves** the need for a separate **Restoration Sanctuary** screen — restoration lives in the
  persistent world; **the world is the tracker.** (Sanctuary deferred indefinitely; see §2.)

---

## §1. The progression spine (the capability ladder)

The sequence each rung's reward unlocks the next rung's key:

> loose scrap → afford the **Reclaimer** → scrap piles (loot + cleared ground) → afford **combat** parts →
> **looter camps** (best loot + restorable sites) → **heal** a site → **(c)** the patch becomes a forward
> base / safe resource zone used immediately → enough healed ground in a region → **(a)** the gate to the
> next region opens.

**Every heal pays twice** — a local base *now* (c), a region unlock *later* (a). That two-timescale payoff is
what makes restoration something the player *wants* to do rather than a tax they're forced to pay.

---

## §2. The keystone decision — what restoration *gives* you

**Decided (2026-06-10): restoration's purpose = (a) restoration-as-the-gate PRIMARY, with (c)
territory/forward-bases sprinkled in.**

| | Role | Timescale | The player feeling |
|---|---|---|---|
| **(a) Gate** *(primary)* | Restore enough of a region to unlock the road to the next, harder region. The **world map** is the progression tracker. | Long arc | *"This is what it's all for."* |
| **(c) Territory** *(sprinkled)* | A healed patch becomes immediately useful — safe haven to park/re-fit, a **forward base** that shortens the run to the frontier, a renewable resource spot. Persistence makes a base **stay yours**. | Moment-to-moment | *"Worth healing THIS stump, right now."* |

**Why a+c, not pure-a:** pure-(a) risks reading as a **chore tax** ("green X% before you may pass"). (c) makes
each individual heal independently worthwhile, so the gate **accumulates from acts already worth doing**.

**(b) renewable-economy** (living rewards — fruit/animals as inputs/income) is **not chosen now** but is the
natural later layer on top; it does not conflict with a+c.

**Sanctuary:** **deferred indefinitely / superseded-leaning.** A persistent, menu-visited trophy screen has no
demonstrated pull; the persistent world absorbs its "where restoration accumulates and is shown" job. Revisit
only if a real need appears that the world map can't serve.

---

## §3. The phases (large; each contributes to the whole)

All `pending` / candidate / movable. Cut each into a deliberately-minimum first slice when picked up.

### Phase 0 — Game-state boundary + front-door menu + persistence · `done`
The **enabler** — unblocks everything by giving testing its own room.

**The split (launch-time, not a menu button):** `npm run dev:sandbox` boots straight into the
grant-everything test world; `npm run dev:game` opens a **New Game / Continue** menu, then the real game.
One Vite app, the command differs only by `--mode sandbox`. The old welded composition root is split into
an `app/` tier — `bootstrap` (the invariant engine + frame loop), `scenarios/` (`sandbox` keeps every dev
affordance; `real-game` is a clean, dev-grant-free cold-open), a `menu`, `snapshot`, and `persistence`.
The **win is delivered**: the real opening is no longer vandalised to test.

> **Note — the split presents as two npm commands, refining the original "New Game · Continue · Sandbox"
> menu** (2026-06-10 build session). The npm command picks game-vs-sandbox; the menu (inside `dev:game`) picks
> New-vs-Continue. So the menu shrank to two entries and `Sandbox` became its own command.

**Persistence — full, by semantic snapshot ([ADR-004](../architecture/adr-004-semantic-snapshot-persistence.md)).**
After an architectural decision (snapshot vs delta-over-reseed vs generic component dump → **snapshot**),
the save describes durable state in the game's own vocabulary and rebuilds the world through the real
constructors. Continue restores:

- **banked + unbanked scrap** (wallet + scrap sitting in any container, mounted or staged),
- the **inventory**, **every owned chassis with its mounted loadout** (each part's cell + facing yaw),
  products **staged on the workshop deck** (a container mid-drain), and parts **on the bench** mid-build
  — the full four-place conservation invariant, so an owned part is never dropped wherever it sat,
- **world content** — piles still standing (how dug-down), camps with only their **surviving guards**
  (a killed guard stays dead; a fully-cleared ring restores `disarmable`), stumps already healed (how
  grown), and the **loose-scrap pieces** lying in the world (the exact remaining set, not a re-scatter —
  the ground keeps what you left, and a reload can't farm a fresh field).

The reusable describe/rebuild kernel is `@common/sim/serialize`; each feature owns its own durable-state
description; `app/snapshot.ts` folds them into one `GameSnapshot` (versioned) and replays it. *Reset on
load by design:* rig HP/boost heat (a reload repairs), composed parts/kits dropped loose on the ground
(not on a rig/deck/bench/in inventory), and all transient/derived state.

- **The win:** stop vandalizing the starting experience to test. ✅
- **Carried forward (small, deliberate):** packed-kit crates left loose in the world and mid-combat
  progress aren't checkpointed — a save is never a half-fought fight.

### Phase 0.5 — World shops (split the shop UI + the first world shop) · `pending` *(precedes Phase 1)*
Pulled out into **its own spec** — [`world-shops-spec.md`](world-shops-spec.md) — and sequenced **before** the
cold-open, because the cold-open must be designed *around where you buy.* The shop leaves the workshop overlay
(buy/sell at home is too easy, and it adds to the workshop's bulk — [`../observations.md`](../observations.md)
#10) and becomes **world destinations themed by part tier** (rusty, iron…), with **partial/unique stock** and
**set-completion** as a progression lever — the concrete form of the *shop-unlock lever* from the 2026-06-11
session. **First slice (decided 2026-06-11):** the **UI split *and* the first rusty shop** (a short drive into
the safe bowl) ship together, so it's playable immediately. Full detail + open questions live in that spec;
**Phase 1 consumes its output** (the first bowl shop is the cold-open's first-purchase point).

### Phase 1 — The designed cold-open · `pending`
Now that testing lives in the sandbox, craft the canonical **New Game** in peace. Fleshed out **2026-06-11**
([`../ideas.md`](../ideas.md) for the voice/why); the calls below are **candidate direction, still movable.**

**The reframe (why this was blocked).** The worry was *"do we even have enough mechanics for a player to get
going on a cold world?"* — a new player can't tell that driving collects loose scrap, that a pile needs a
Reclaimer + facing + E, or that a camp can be fought/rammed/disarmed. The resolution: it isn't a **mechanics**
gap (every verb — collect, rummage, fight/ram, disarm, heal — is built and working; the starter rig already
mounts storage, and proximity prompts + a `Toast` exist). It's a **legibility** gap, and specifically
**capability-discovery**: today a prompt only fires *after* you own the tool and are aimed right, so an inert
object can never teach you what it needs. Phase 1 closes that hole.

**The three legible states (the core model).** Every interactive object (pile, camp, stump) should read
*without words* in three states. The middle one is the keystone new primitive:

| State | The player reads | Today |
|---|---|---|
| **INERT-but-interesting** | "something's here" — a silhouette/heap that pulls the eye | ✅ have it |
| **LOCKED** | in range, but *"you need X"* — the greyed-out-door cue | ❌ **the one new primitive** |
| **LIVE** | "do it now" — the existing Hold-E / disarm / heal prompt | ✅ have it |

The **LOCKED cue is a small, well-defined deliverable**: today, missing the tool → *nothing*; capable → a
**green circle + bottom-UI key hint**. LOCKED is the obvious sibling — intersecting but unable to act shows a
**faint dim-grey circle + the same bottom hint, reading "Needs Reclaimer…".** Same UI shape, three states.
The piece that turns every LOCKED into a *goal* is **the shop as catalog**: self-describing entries
("Reclaimer — digs scrap piles") let *browsing the shop* teach the whole possibility space.

**Teaching = arrangement, with one sanctioned popup.** Phase 1 teaches **silently, by arrangement** (spawn
placement, the LOCKED cue, the self-describing shop) — **not** by narration. The single exception: the first
time the player reaches a **shop** — the first rusty shop, a short drive into the bowl (shops now live in the
world, not at the workshop — see [`world-shops-spec.md`](world-shops-spec.md)) — it gets a **text popup**
introducing itself once. This redraws the **Phase 1 ↔ Phase 4 boundary**: *Phase 1 = teach by
**arrangement** (silent, world + shop); Phase 4 = teach by **narration** (text/arrows/story), an enhancement
layer on top of an opening that already works.* Phase 1 is allowed to teach — just not with words.

**The world — a safe bowl, contained by danger, with an outpost as the carrot.** The opening map is a small
**hub-centric bowl** — a *safe zone* with the workshop near the middle. Outside, enemy presence is
significant; the player is **free to drive out** with a weak rig (dodge if you can), the world just makes it
cost. Two deliberate scope calls (2026-06-11) shape its edges:

- **No fuel in Phase 1.** The bowl is contained by **danger alone** — no range-limit, no rescue-on-empty.
  (The fuel/rescue idea — run dry → auto-rescued to the workshop, forfeiting X scrap, which doubles as the
  "upgrade energy first" teacher — is **parked as the bowl's later, kinder second edge**, *not* Phase 1.)
- **The bowl wall is visual only.** A wreckage wall is great for *directing the eye*, but we have **no
  physical collision yet**, so it can't block. Real physical blockers are their own future job, not Phase 1.
- **The outpost IS a Phase 1 deliverable.** The bowl needs a *destination*. An **outpost** out in the danger —
  a **forward base** — is the carrot: the safe zone teaches the basics and funds upgrades → the outpost is the
  goal → reaching it safely needs the armour/weapons that funded it. This is the spine's **(c) territory /
  forward-base** payoff as the cold-open's pull. *Proposed minimum shape (so it isn't a new system):* the
  outpost = **the first cleared camp flipped into a forward base** — clearing it *establishes* a safe re-fit
  point near the frontier, reusing camps + the `cleared` signal + `RestorableSite` already shipped.
- **The pull is "find shops → unlock parts."** An outpost's reward is access to **new parts to buy**, realized
  through **world shops** ([`world-shops-spec.md`](world-shops-spec.md)) — distributed, tier-themed, with
  partial/unique stock. The first rusty shop sits in the bowl; **richer, higher-tier shops are out in the
  danger**, which is what draws the player onward. So the outpost and the shop are the same family — *a cleared
  outpost can **host** a world shop* — and "find shops to unlock parts" is the progression lever.

**What Phase 1 quietly contains: the spine's first traversal.** Because the outpost is the climax, the
cold-open is the opening *and* the spine's first arc: collect scrap → buy **Reclaimer** (rung 1) → work piles
→ buy **weapon/armour** (rung 2) → survive the danger gradient → **claim the outpost** (rung 3, the territory
payoff). This is more than "one obvious first action."

**Cold-open choreography (the first ~90 seconds).**
1. **Spawn inside a dense ring of loose scrap**, the home hub (workshop + the first shop nearby) a short drive
   away. First movement sweeps a piece → HUD ticks → *"I collect by driving."* (Rung 0 self-teaches; storage is
   already mounted.)
2. **One scrap pile sits on the path inward**, showing the **LOCKED "Needs Reclaimer"** cue as you pass. The
   question is planted.
3. **A short drive to the first rusty shop (in the bowl)** opens the shop UI (with its first-open popup), where
   the Reclaimer entry *answers* the question. Buy → mount → return → work the pile (rung 1). *(The workshop is
   for building/assembling/banking, not buying.)*
4. **A camp/outpost sits visible but farther out** — INERT silhouette = "later." Its threat teaches the
   stakes; a shop teaches the solution (a weapon). Clearing it establishes the outpost (rung 2 → 3).

**Deliverables (the firmed list).**
- **The LOCKED-state cue** — dim-grey circle on intersection + "Needs X…" bottom hint (mirrors the green/LIVE
  state). *The one genuinely-new bit of code.*
- **The designed cold-open seed** — starting rig/resources, the small bowl, scrap-ring spawn, the on-path
  pile, the danger gradient, the camp-that-becomes-the-outpost. (Replaces `real-game.ts`'s provisional seed.)
- **Starting-stake tuning** — lower it so loose-scrap collection is a *required* first step (see catch below).
- **The outpost** — the first cleared camp flips into a forward base that **hosts/unlocks a world shop**
  ([`world-shops-spec.md`](world-shops-spec.md)) — the first instance of shop-unlock-as-progression.
- *(Consumed from the Phase 0.5 world-shops slice, not built here):* the **shop UI**, **self-describing shop
  entries**, the **first-open popup**, and the **first bowl shop** — Phase 1 designs the cold-open *around* them.

**Tuning risks / catches to carry into the build.**
- **The danger gradient is the sole pacer.** With no fuel, "enemies between the bowl and the outpost are
  lethal to a starter rig" must do the gating work fuel-range would have shared — punchy enough to teach "gear
  up first," not so punishing it's just frustrating.
- **The starting stake over-funds rung 1.** `createPlayerStore(world, 100)` vs a **36**-scrap Reclaimer (arm
  24 + bucket 12) lets a new player skip the rung-0 collect lesson. Lower it to make collecting required.

**Open questions (resolve at build time).** The bowl's size + danger-gradient numbers; whether an outpost also
grants a closer re-fit point on top of hosting a shop; whether ramming is left as a pure emergent discovery
(lean: yes — the intended path, a bought weapon, is shop-taught). *Shop-side questions* (stock per shop,
set-completion gating, the shop↔outpost relationship) live in [`world-shops-spec.md`](world-shops-spec.md).

### Phase 2 — The progression spine + restoration's purpose · `pending` *(the keystone)*
Commit the §1 ladder; restoration purpose = §2 (a-primary + c-sprinkled).
- Mostly **design + tuning** (gating costs, drop tables, sequencing) plus some code (region gates).
- **Ordering note:** the *design* of Phase 2 should be **sketched before** building Phase 1's opening — the
  cold-open must teach the spine's **first rung** — even though Phase 2's *implementation* (region gates)
  lands later with Phase 3.

### Phase 3 — The discovery surface · `pending`
Give the player somewhere to progress *to*.
- A **map** (doubles as the restoration tracker from §2a), **multiple regions** gated by restoration,
  **scaling / harder enemies** as the difficulty source.
- **Cashes in** [`render-scaling-spec.md`](render-scaling-spec.md) — infrastructure written for exactly this.

### Phase 4 — Onboarding / guidance / story · `pending` *(deliberately last)*
Lead the player down the now-defined spine. **This is the *narration* layer** — the silent, teach-by-
*arrangement* legibility (the three-state cue, the self-describing shop, the cold-open choreography) lives in
**Phase 1**; Phase 4 adds words on top of an opening that already works for an attentive player.
- Speech bubbles, arrows, objective prompts, the story thread.
- **Last on purpose:** a separate concern from building mechanisms; you can't guide a player down a spine
  that doesn't exist yet. It rides on top of Phases 1–3.

---

## §4. Dependency shape

```
Phase 0    game-state boundary + menu + persistence   ← unblocks everything
   │
Phase 0.5  world shops (split shop UI + first shop)    ← shop leaves the workshop; the cold-open is built around it
   │
Phase 1    designed cold-open (real world, crafted)    ← buys at the first bowl shop; Phase 0 let you craft in peace
   │     (Phase 2 DESIGN sketched here, in parallel — the opening teaches rung 1)
Phase 2  progression spine + restoration's PURPOSE   ← keystone; region-gate impl lands with Phase 3
   │
Phase 3  map + regions + harder enemies              ← where restoration-as-gate cashes out
   │
Phase 4  onboarding / guidance / story               ← rides on a defined path
```

---

## §5. Where this connects

- [`../world-progression-guidance.md`](../world-progression-guidance.md): **reconciled (2026-06-10).** The
  guidance now states the persistent world, in-world restoration (no separate Sanctuary), and the
  (a)-gate + (c)-territory purpose as its current leaning; the Sanctuary and its ecosystem sub-game are
  marked superseded/parked there. This spec holds the *phased plan*; the guidance holds the *vision*.
- [`world-shops-spec.md`](world-shops-spec.md): the **shop's own spec** — sequenced **before Phase 1** (Phase
  0.5 above). It splits the shop UI out of the workshop and turns buying into **world destinations**; Phase 1
  consumes its first bowl shop. Holds the world-shop mechanics + open questions this spec defers to it.
- [`../milestones.md`](../milestones.md): when a phase firms up, promote it to a milestone entry (carved into a
  deliberately-minimum first cut), the way Options A–D were. **Phase 0** is the natural first promotion — it
  unblocks every other phase.
