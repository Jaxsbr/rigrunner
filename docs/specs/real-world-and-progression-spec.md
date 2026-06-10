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

### Phase 0 — Game-state boundary + front-door menu + persistence · `pending`
The **enabler** — unblocks everything by giving testing its own room.
- A **game/save** vs **sandbox** distinction; a menu: **New Game · Continue · Sandbox**.
- **Persistence:** serialize/restore the real game's state — wallet, inventory, rig config, **and
  world-content state** (which piles are cleared, which camps fell, which stumps are healed + their growth).
- The **sandbox keeps** every grant-myself-anything testing affordance used today; the **real game gets none**.
- **Technical seam:** deciding what "game state" *is* (which ECS components serialize). The restoration slice
  already stores `growth` in `Healable` and emits `RestorableSite`, so the world-state half is "serialize the
  relevant components" — the seam exists, the scope is defining its boundary.
- **The win:** stop vandalizing the starting experience to test.

### Phase 1 — The designed cold-open · `pending`
Now that testing lives in the sandbox, craft the canonical **New Game** in peace.
- Starting rig, starting resources, the small **curated opening map**, scrap layout, first reachable camp.
- **Deliverable:** a deliberately **legible opening situation** — when the player spawns, one obvious first
  action, and the world pulls them toward it. *Not a tutorial yet* (that's Phase 4).

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
Lead the player down the now-defined spine.
- Speech bubbles, arrows, objective prompts, the story thread.
- **Last on purpose:** a separate concern from building mechanisms; you can't guide a player down a spine
  that doesn't exist yet. It rides on top of Phases 1–3.

---

## §4. Dependency shape

```
Phase 0  game-state boundary + menu + persistence   ← unblocks everything
   │
Phase 1  designed cold-open (real world, crafted)    ← Phase 0 lets you craft in peace
   │     (Phase 2 DESIGN sketched here, in parallel — the opening teaches rung 1)
Phase 2  progression spine + restoration's PURPOSE   ← keystone; region-gate impl lands with Phase 3
   │
Phase 3  map + regions + harder enemies              ← where restoration-as-gate cashes out
   │
Phase 4  onboarding / guidance / story               ← rides on a defined path
```

---

## §5. Reconcile later (do not rewrite unilaterally)

- [`../world-progression-guidance.md`](../world-progression-guidance.md): the **"persistent vs roguelike"**
  open fork now **leans persistent**; the **separate Restoration Sanctuary** is **superseded-leaning** (the
  persistent world absorbs its job). Reconcile that doc deliberately when these harden — flagged here, not
  silently rewritten.
- [`../milestones.md`](../milestones.md): when a phase firms up, promote it to a milestone entry (carved into a
  deliberately-minimum first cut), the way Options A–D were.
