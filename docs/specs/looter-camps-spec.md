# RIGRUNNER — Looter Camps: enemies around a structure (spec + plan)

**What this is:** the design + phased implementation plan for **looter camps** — the game's first
**flee-or-fight** content and its first **enemy + combat** systems (the candidate **Option D** in
[`milestones.md`](../milestones.md)). It also plants the **trap-arm disarm** mechanic and the
**restoration handoff seam** that the world-restoration work (M4) later subscribes to. The high-level
intent + dependency chain stay in `milestones.md`; the worked decisions live here.

> **Status:** ✅ **Phase 1 built + merged** (PR #55, 2026-06-07) — a complete, playable level-1 camp,
> tuned across two playtests. ✅ **Phase 2 built + merged** (PR #56, 2026-06-07) — the trap arm + real
> disarm puzzle, replacing Phase 1's auto-success stub (decided in a 2026-06-07 grill), plus a "Press E"
> prompt + proximity ring added in playtest. ✅ **Phase 3 built** (2026-06-07) — the layered stain mess +
> scattered debris, and the on-clear teardown (structures sink, a stump rises out of the soil) that resolves
> the world-reacts beat + the restoration handoff (decided in a 2026-06-07 grill). **Phase 4 not started.**
> The design below was resolved in a 2026-06-06 grill session (every section is a decided answer, not a
> guess). Numbers (HP, damage, ranges, leash, costs) are **build-time tuning** unless called out. See §10
> for exactly what each phase shipped and the places it deviated from this plan as play demanded.

---

## Essence

A hostile **structure** ringed by simple **enemies** that shoot at you and an **environmental mess**
(stains, damage) — the first real *flee-or-fight*. You **fight or evade**; clearing all enemies, then
**disarming the camp's trap** with a trap arm, yields the loot. Clearing a camp leaves behind a
**stump / soil site** the world can later heal, and the **stains fade** as the camp is cleaned up.

---

## 1. The player-verb loop (one camp, end to end)

```
spot a camp  →  read its level (visual)  →  ENGAGE or EVADE
   engage:  shoot + ram enemies while dodging their fire  (flee-or-fight)
          →  all enemies cleared  →  DISARM the trap (skill puzzle, gated on a trap arm)
                 success → full loot · partial → common loot + damage risk · fail → no loot + damage
          →  loot screen → inventory  →  stains fade, a restorable stump remains
```

A camp you don't engage just sits there — a threat only if you drive into its enemies' range. **Evade
is a first-class option** (the flee half); a too-weak rig is taught to go back to the bay and build.

---

## 2. Combat primitives

The new generic kernel. Born inside this feature; promoted only when a second consumer earns it.

### 2.1 Rig health & death
- **`Health { current, max }`** on the rig. **`max` aggregates** like `effectiveRigWeight` does: a
  **chassis base** (tier-scaled in `chassisToRig`, the way `turning`/`braking` already are) **+ future
  armour/shield part contributions** (the seam — *not built now*). The chassis is the **defense
  envelope**; a better chassis tanks more.
- **Damage** lowers `current` (enemy projectile hits — §2.3). **Repair** is **free at the workshop**:
  parked in a workshop zone (already a safe zone — obs #8), `current` restores toward `max`. This
  reuses the workshop proximity gate and reinforces home-base = safety + repair. *(A scrap-cost repair
  is a clean later economy-sink seam — not now.)*
- **Death:** `current ≤ 0` → **full reset to the boot seed** (Wallet, Inventory, owned chassis, world
  all back to start). Nearly free to build (re-run the seed; an `R` reset already exists). **This is a
  deliberately-placeholder stake** — flagged to revisit (a softer "lose the run, keep the bank" is the
  likely real design) once combat feel is dialled. A minimal **health bar** in the HUD shows
  `current / max`.

### 2.2 Rig offense — two ways to clear
- **Mounted directional weapon (a part).** A new mountable weapon that **auto-fires at any enemy
  inside its forward cone + range**, reusing the exact `facingWithinFov` cone the Reclaimer gate uses.
  No fire button — you "aim" by orienting the rig/weapon. **Placement matters:** a front gun forces
  you to face the enemy (and eat fire); a rear/side gun lets you **flee and shoot**. Fire **rate**
  (cooldown) is a stat; **no ammo** in the first cut (like engines run on unlimited energy).
- **Ram.** Driving into a weak enemy kills/damages it on contact (reuses collision). **No rig
  self-damage** from ramming in the first cut — but ramming a ranged enemy still means eating its fire
  to close. (Ram self-damage vs tougher targets is a later tuning seam.)

### 2.3 Projectiles
- **One shared `Projectile { owner, team, … }`** for both the rig's weapon and enemy fire — so
  collision resolves rig→enemy and enemy→rig with the **same** code. Shots **travel** at a set speed
  (you can **dodge by driving**; your shots can miss a moving target). Readable tracers.
- **`collision.ts` is promoted to `@common/sim/collision`** here — its own header mandates the move
  "the day a second feature needs it … combat (projectile/enemy hits) is the expected one." This is
  that day. Projectile-vs-target hits run through it.

## 3. Enemies & AI

- Each enemy is its **own entity** with its **own `Health`** — you clear them one at a time; no respawn
  (clear once → the camp is clearable). Enemies do **not** move the rig's economy except via the camp's
  loot on clear.
- **Detection: range + arc, no occlusion.** An enemy engages when the rig is within a **detection
  radius** (and optionally a facing arc) — *"in line of sight" ≈ "in range"*; no raycast against props
  (the open field has no real sight-blockers yet). True-occlusion LOS (cover/peek) is a clean later
  seam.
- **State machine:** `GUARD` (at post) → `ENGAGE` (rig detected → fire travelling projectiles **and**
  pursue) → `RETREAT` (rig beyond a **leash distance measured from the camp**, not the post → return to
  post → back to `GUARD`). Pursuit + the camp-anchored leash are both **configured per level**.

## 4. The camp (a stateful objective)

- **`Camp { level, state }`** entity at a world position, **data-driven by `level`** (see §6). Its
  structure (container + tent for level 1), enemy roster, trap difficulty, and loot table all come from
  the level config.
- **State machine:** `GUARDED` (enemies alive; trap armed; stains present) → *(all enemies cleared)* →
  `DISARMABLE` → *(disarm attempted)* → `CLEARED` (loot granted per outcome; stains begin fading; a
  restorable stump is emitted). **Loot is gated on BOTH** all-enemies-cleared **and** a non-fail disarm.
- **Level read is visual-only:** the camp's composition (enemy type/count, camp size/silhouette)
  carries its level — **no HUD level label**. *(Design constraint for later: each new level must be
  visually distinct enough to read at a glance. Moot at one level.)*

## 5. The trap arm & disarm

- **A separate trap-arm part** (not a head-swap) — its own articulated, directional, **FOV-aimed** tool
  that **mirrors the Reclaimer's construction** (arm grammar + the mounting/articulation/aim it already
  uses), with its own **tier**. You can run a digger and a disarmer as distinct build choices. Bought
  in the **Parts Shop** and built/mounted like any part.
- **Disarm is a skill mini-game; tier sets difficulty (no separate RNG).** Concrete first puzzle: a
  **timing sweet-spot (lockpick)** — a marker sweeps a bar, press to land it in a target zone, for
  `N` rounds. **Tier sets zone WIDTH + round COUNT** (rusty = narrow zones, many rounds; top tier =
  wide / one round / effectively automatic). The disarm runs **parked + arm aimed at the camp**, in a
  **focused overlay that freezes the sim** — safe because disarm only happens **after** all enemies are
  dead (no threat mid-solve). *(The puzzle is one **pluggable** mechanic — a seam for puzzle variety
  later.)*
- **Outcome → reward (gated on how cleanly you solved):**
  | Outcome | Loot | Rig |
  |---|---|---|
  | **Success** (clean solve) | full camp loot (all eligible tiers) | unharmed |
  | **Partial** (mostly) | **common** tier only | **chance** of damage |
  | **Fail** (botched) | none | damage |

## 6. Difficulty levels (build only level 1)

- **`level` scalar → a data-driven `CAMP_LEVELS` table** mapping level → `{ enemy type, count, enemy
  HP/damage, detection radius, leash, camp structure + size, trap difficulty, loot table }`. A new
  level is a **new data row, no new code** — the scalable seam, mirroring how the loot table / part
  costs are already data-driven.
- **Level 1 (the only one built):** a **container + a small tent**, **two enemies** guarding. They
  shoot once the rig is in range; pursue up to the configured leash from the camp; retreat when it's
  exceeded.

## 7. Loot

- A data-driven **`CAMP_LOOT` table** (richer than the scrap pile's), rolled through the **shared
  loot-table roller** (`rollLoot`) — the seam Option C already built for exactly this reuse. The
  **disarm outcome gates which tiers are eligible** (§5). Finds are **granted to `Inventory` via the
  existing loot overlay** (`LootDrop` + `loot-overlay`) — the loot screen you already have. A **scrap**
  tier may grant straight to the `Wallet` (a camp isn't a heap, so no scatter-and-sweep). The **rare
  full-part / recipe tiers** stay the same committed **stubs** the pile table carries until their
  systems land.

## 8. Environmental mess & the restoration seam

- A camp carries **large stains + environment damage** (reuse/scale the `scrap-stains` fade system).
  On reaching `CLEARED` the **stains fade gradually** — the world visibly cleans up as you finish the
  camp.
- A **`RestorableSite { x, z, kind, sourceLevel }`** marker (a richer sibling of `ClearedGround`) is
  emitted on clear, with a **visible stump / soil prop**. **Nothing consumes it** — deliberately. This
  is the exact handoff the **restoration** work (M4 camp-to-restored-ground) subscribes to later: the
  camp publishes *"I'm cleared, here's a site,"* and knows nothing about restoration. *(Why a new
  marker, not bare `ClearedGround`: a camp stump is a deliberate, visible, investable feature, not just
  a "cleared earth" record.)*

---

## 9. Reuse map (what this leans on, what's new)

| Reuses (shipped) | New (this feature) |
|---|---|
| `facingWithinFov` (weapon arc, trap-arm aim) | `Health` + HUD health bar; death/reset |
| `collision.ts` → promote to `@common/sim/collision` | `Projectile` + projectile movement/hits |
| Arm grammar: mounting · articulation · FOV gate (Reclaimer) | Directional **weapon** part; **trap-arm** part |
| Loot table roller + `LootDrop` + loot-overlay | `Camp` + state machine; enemy + AI |
| `scrap-stains` fade; `ClearedGround` pattern | disarm puzzle (timing sweet-spot); `CAMP_LEVELS`/`CAMP_LOOT` |
| Parts Shop / `part-costs` (acquire weapon + trap arm) | `RestorableSite` marker + stump prop |
| Chassis stat → rig pipeline (`chassisToRig`) | camp stains/damage |
| Workshop safe zone (free repair) | |

**Placement (ADR-003):** one new **`features/camps/`** slice owns the camp, enemy, AI, weapon,
projectile, health, disarm, camp-stains, and restoration-site. **Promote `collision` to
`@common/sim`** (second consumer). Keep `Health` / `Projectile` / `Weapon` **in-feature** until a
second feature consumer earns a `@common` promotion (Rule of Three).

**Acquisition / bootstrap:** the weapon + trap arm are Parts-Shop buys (Option B's `part-costs`),
priced so **loose scrap + pile loot can afford the weapon *before* your first camp** — you can't loot
your way to the tool that lets you loot (the Reclaimer bootstrap rule). The trap arm is the higher
save-up goal.

---

## 10. Build phases (vertical-first — a thin whole camp, then enrich)

Each phase ships playable, tests green. Phase 1 is a **complete** level-1 camp; later phases deepen it.

- **Phase 1 — A thin whole camp, end to end. ✅ built + merged (PR #55, 2026-06-07).** `Health` + HUD
  bar; purchasable **auto-fire weapon** + ram; **`Projectile`** both ways (promote `collision`); two
  enemies with the detect → engage → pursue → retreat AI; dodge; **HP=0 → reset**; `Camp` + state
  machine driven by `CAMP_LEVELS[1]`; **all enemies cleared → loot screen → inventory** (`CAMP_LOOT`);
  **disarm STUBBED to auto-success** (no trap arm yet); minimal camp stains + a `RestorableSite` stub on
  clear. A full, rewarding, playable camp. Built as `features/camps/` (its own slice CLAUDE.md).

  **What shipped beyond / differently from the plan above** (decided during the build + two playtests —
  all build-time-tuning calls, none changing the design intent):
  - **`features/camps/` slice + kernel promotions (Rule of Three).** `collision` → `@common/sim/collision`,
    `facingWithinFov` → `@common/sim/fov`, the loot roller → `@common/sim/loot`, `SUB_PART_POOL` →
    `@common/parts`, `LootDrop` → `@common/components`. And **`Health` lives in `@common/components`**
    (not in-feature as §2.1 tentatively said): it's a rig-level aggregated stat with two consumers from
    day one (rig assembly sets it via `@common/sim/health` `rigMaxHealth`, combat spends it), like `Weight`.
  - **Death/reset is a page reload** that re-runs the boot seed (+ `R` for dev). §2.1's "an `R` reset
    already exists" was wrong, so it was built here.
  - **The weapon is a two-part product — `Mount` + `Barrel`** (the Reclaimer's arm+head grammar), not a
    single part: buying one sub-part to "assemble" a weapon read as pointless. Sets up barrel variety
    later. The barrel swivels on the Mount's `socket_barrel` node.
  - **Enemies are ranged kiters,** not chargers: they hold a `standoff` inside `fireRange` (< `detection`)
    and back off rather than ram — being overrun is the RIG's job (drive in). (First cut had them suicide
    into the rig; fixed in playtest #2.)
  - **Four camps, one per corner of the map** (not the single camp the plan implied) — this is the
    "multi-camp world placement" §11 deferred, brought forward as fixed placements (the *scaling-enemy*
    system stays deferred).
  - **Rig-pace + tier tuning (vs the Machine Mind reference).** The starting rusty rig couldn't out-pace
    the guards, so engine base pace was raised (electric 11/7 → 15/10, steam 7/16 → 10/22) and iron's
    tier **mult eased 2.2 → 1.8** so the lift didn't balloon iron (a `part-identity-spec` change, noted
    there). Combat numbers settled at: weapon 10 dmg @ **1.0 s**, proj 30 u/s, range 18, cone 50°; enemy
    6 dmg @ **3.0 s**, proj 24 u/s, detection 16 / fireRange 13 / standoff 10 / leash 28; workshop repair
    20 HP/s; `CAMP_LOOT` = 15–30 wallet scrap + 2–4 sub-parts. The finding + reference comparison are
    written up in `observations.md` #14.
  - **All assets authored** (no placeholders): `weapon-mount`, `weapon-barrel`, `enemy`, `tent`,
    `camp-cache` — each validated per-tier in the viewer (`check:assets` green).
  - **Parked as captured ideas** (not built): a speed-based **camera auto-zoom** (out while moving, in
    while settling), and a possible tighter base **turn-radius** for kiting.
- **Phase 2 — The trap arm + real disarm. ✅ built + merged (PR #56, 2026-06-07).** The trap-arm part (shop/build/mount);
  the **timing sweet-spot** puzzle; tier → difficulty; **success/partial/fail → loot + rig damage** —
  replacing the Phase-1 auto-success stub. Loot now gated behind a real disarm.

  **What shipped / decided at build time** (a 2026-06-07 grill resolved every open §12 item; all
  build-time-tuning calls, none changing the design intent):
  - **Composed trap arm — `trap-boom` (host) + `disarm-head` (tier-bearing)** — the Reclaimer/weapon
    arm+head grammar. The HEAD's tier sets difficulty; the boom is the reusable host (a future head = a
    new disarm tool, same boom). Both authored as real GLBs (`check:assets` green; per-tier viewer-validated).
  - **Proximity-only gate — NO FOV aim** (deviation from §5). Disarm is a safe, post-combat act, so
    aiming the arm at the camp would be ceremony; the gate is "DISARMABLE camp within range + a trap arm
    mounted." E opens the puzzle (the workshop's "E in zone" pattern). The arm still articulates (idle
    sway) for feel. A bottom-centre **"Press E" prompt** + a **proximity ring** light up in lockstep on
    that gate, matching the workshop/scrap-pile affordances. *(The grill first chose "no prompt"; that
    read as confusing in play, so the prompt + ring were added as a follow-up — both off the same gate.)*
  - **Commit model:** opening the overlay is free (Esc backs out, camp stays DISARMABLE); the **first
    Space commits** to the full N-round attempt. This reconciles *no-prompt* + *one-shot* so a habitual
    E never accidentally burns a camp.
  - **Outcome (play all N, tally hits):** all → success, ≥1 → partial, 0 → fail. **All three CLEAR the
    camp** (one-shot — a fail permanently loses that camp's loot); `RestorableSite` + stain-fade fire
    regardless, only loot + damage differ. (Refined §5's three-row table: success is the *clean* solve.)
  - **Difficulty (head tier):** rusty = 3 rounds × 16%-wide zone; iron = 1 round × 34% (≈ automatic).
    Marker bounces at a constant ~0.9 s/crossing; target zone random each round.
  - **Damage:** partial = 15 HP @ 50% chance; fail = 30 HP always. (Base rig 100 HP; free workshop repair.)
  - **Loot gating:** success = full table + 15–30 scrap; partial = **common-rarity tiers only + halved
    (8–15) scrap** (the reduced-scrap rule makes partial bite *today*, since rare/epic tiers are still
    disabled stubs — §7's tier-eligibility gating starts mattering once they enable); fail = nothing.
  - **Cost:** `trap-boom` 16 + `disarm-head` 20 = 36 rusty (iron ≈ 65) — on a par with the Reclaimer,
    a shop save-up (trap parts aren't in the lootable `SUB_PART_POOL`); the head is the dearer upgrade.
  - **Reuse:** loot still flows through the shared `LootDrop` + loot overlay (disarm → spoils popup);
    the grade + damage are surfaced via the existing HUD toast.
- **Phase 3 — Environmental mess + restoration polish. ✅ built (2026-06-07).** Large camp stains + damage
  that **fade** on clear/disarm; the **visible stump/soil prop** on the `RestorableSite`. The world-reacts beat.

  **What shipped / decided at build time** (a 2026-06-07 grill resolved every §12 Phase-3 item; all
  build-time-tuning calls, none changing the design intent):
  - **The standing-camp mess is layered, not one disc.** `camp-stains` became a cluster of varied blotches —
    oily seepage + burnt **scorch** — scattered at camp scale (a richer local copy of scrap's organic blob
    drawer; duplicated, not promoted — Rule of Three). Plus **scattered debris props** (decided to go beyond
    decals): three authored GLBs — `debris-crate`, `debris-heap`, `camp-firepit` — placed ~5 per camp by
    `camp-spawn` with random yaw + slight scale.
  - **On clear the whole camp DISSOLVES (the world-reacts beat).** Over ~9 s (`TEARDOWN_DURATION`, co-timed
    with the stain fade) the stains fade, the **structures + debris sink and shrink into the ground**, and a
    **`camp-stump` rises out of the soil** in their place — a dead stump on its own scarred-soil base, the
    lasting `RestorableSite` marker. **Decided beyond the literal spec:** the man-made structures *fade*
    (sink) rather than linger as ruins, so the land returns toward nature — the cleanest setup for the M4
    restoration (green returns). The stump self-grounds, so the big camp stain can fully fade.
  - **Architecture: sim-clocked, view-posed.** `Camp` gained a `tornDown` clock that `camp-system` advances
    once `CLEARED`; it despawns the TRANSIENT decor (a new `CampDecor` link) when the dissolve completes, but
    spares the stump (the one `CampDecor` that is also a `RestorableSite`). A `camp-teardown-animator` reads
    `tornDown` to sink/rise the meshes — render reads state, never mutates it. The camp entity persists (the
    stains + stump read off it).
  - **All level 1, hardcoded** — the mess/debris/stump are fixed visuals in the spawner/render, NOT new
    `CAMP_LEVELS` fields (Phase 4 designs each level's distinct look). All 4 props authored as real GLBs
    (no placeholders), each viewer-validated as a real model.
- **Phase 4 — More levels.** Author level 2+ as **data rows**, each visually distinct; (future) wire
  the **scaling-enemy** difficulty hook to the same `level`.

---

## 11. Deliberately NOT in scope

Vehicle/advanced enemy AI; enemy respawn; true line-of-sight occlusion; armour/shield parts (the
HP seam exists, unbuilt); scrap-cost repair; ram self-damage; the **restoration investment** itself
(only the site marker is emitted); the rare full-part / recipe loot tiers (stubs); the **scaling-enemy
system**; a softer death model (placeholder full-reset for now). *(Phase 1 did place **four fixed
level-1 camps**, one per corner — basic multi-camp placement; the procedural/scaling side stays out.)*

## 12. Open / tuning (decided at build time)

**Phase 1 resolved** (the live values are in §10's "what shipped" note + `features/camps/`): rig + enemy
HP, weapon/enemy damage + fire rate, projectile speeds, detection/fireRange/standoff/leash, weapon
costs, stain size/fade. The camp **does** grant wallet scrap (15–30) plus sub-parts. Workshop **HP
restore is over-time** (20 HP/s while parked).

**Phase 2 resolved** (live values in §10's Phase-2 "what shipped" note + `features/camps/disarm.ts`):
trap-arm **construction** (composed `trap-boom` + tier-bearing `disarm-head`), **costs** (16 + 20),
per-tier **round-count/zone-width** (rusty 3×16% / iron 1×34%), partial **damage chance** (15 @ 50%) +
fail damage (30), the gate (proximity-only, no FOV aim), the commit model, and the loot gating (partial
= common + halved scrap).

**Phase 3 resolved** (live values in §10's Phase-3 "what shipped" note + `features/camps/`): the layered
stain mess (oily + scorch blotches) + the debris set (`debris-crate`/`debris-heap`/`camp-firepit`, ~5 per
camp); the on-clear teardown (structures sink + shrink, stump rises) over `TEARDOWN_DURATION` (~9 s); the
decision that structures *fade* rather than linger; all hardcoded for level 1. Still open (Phase 4+): more
camp levels (each visually distinct + the scaling-enemy hook); the **restoration investment** that consumes
the `RestorableSite` + its stump.
