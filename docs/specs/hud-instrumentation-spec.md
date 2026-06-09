# RIGRUNNER — HUD pass: diegetic rig instrumentation (spec)

**What this is:** the design for upgrading the always-on run HUD — **selected rig**, **rig details**,
**HP**, and **boost level/cooldown** — from functional-but-plain readouts into a cohesive set of
**diegetic analog instruments**: gauges that read as physical kit bolted to the rig's dashboard.
Requested 2026-06-09 after boost shipped (the boost heat gauge had nowhere good to live). The visual
direction was chosen in a short design pass (§7).

> **Status:** **designed, not built.** A candidate plan, captured per "build by discovery" — it firms
> as we build it. Values/forms marked _(tune)_ are starting points. Scoped as a 3-PR pass (§6).

---

## 1. The problem — today's HUD, element by element

The HUD is DOM + inline CSS in `game/index.html`, driven by small per-element classes
(`features/hud/`, `features/chassis/chassis-bar.ts`, `features/economy/wallet-hud.ts`). The **modal
menus** (workshop, loot, disarm) are already polished — dark-glass terminal panels. The **always-on
run HUD** lags behind:

| Element | Today | Gap |
|---|---|---|
| **Selected rig** (`#chassis-bar`) | Chips: hotkey + size, active highlighted (top-left) | Functional, flat — reads as a debug toggle, not part of the rig |
| **Rig details** (`#stats`) | A raw `<pre>` **text dump** — type/accel/top speed/steer/load | The least-polished surface; a wall of monospace, no hierarchy or iconography |
| **HP** (`#health-bar`) | A real bar, green→red fill + number (bottom-left) | Plain; no damage feedback, doesn't read as an instrument |
| **Boost** | An **ASCII `[###----]` bar buried inside the `#stats` text** | A live combat resource hidden in a text block — not glanceable, easy to miss the overheat |

The boost mechanic especially deserves better: heat, redline, and the cool-down lockout are exactly
the kind of state an analog gauge communicates at a glance.

---

## 2. Direction — diegetic analog instruments

The run HUD becomes the rig's **dashboard**: worn-metal instrument plates, segmented/needle gauges,
riveted bezels, stencilled labels — styled to feel bolted to the machine, in the warm sun-baked
wasteland palette the world already wears. This is a deliberate split:

- **Always-on run HUD → diegetic rig instruments** (this spec).
- **Modal menus (workshop / loot / disarm) → stay clean dark-glass terminal.** They're "interfaces,"
  not part of the rig; leave them as-is. The two languages coexist by role.

> **Diegetic *feel*, screen-space build.** True in-world panels (rendered in 3D on the rig) are a much
> larger lift and are **out of scope**. We get the analog-instrument feel with **CSS** — layered
> gradients (brushed metal), inset/outset `box-shadow` (bevels, recesses), radial-gradient rivets,
> `conic-gradient`/SVG arcs (dials), `repeating-linear-gradient` (segments, hazard stripes). The
> existing workshop CSS already proves this vocabulary; we warm it up and round it into instruments.

---

## 3. The instrument kit (shared aesthetic contract)

One material + colour language so every gauge reads as the same dashboard. Tie the metals + zone
colours to `shared/palette.json` and [`docs/asset-style.md`](asset-style.md) so the HUD belongs to the
same art direction as the world.

- **Plate:** warm dark brushed metal (rust-tinged charcoal), a faint top sheen, a recessed inner
  shadow, **corner rivets**, and a thin **hazard-stripe** sliver as a header accent (the amber/charcoal
  motif already on the workshop header, warmed).
- **Labels:** stencilled, uppercase, low-contrast amber — like painted-on panel text. **Values:** a
  bright mono readout (the existing `ui-monospace`), so data pops off the plate.
- **State colours** (functional, reused everywhere): `ready/healthy` glow-green `#59ff9f`,
  `caution/heat` hazard-amber `#d9a521`, `danger/critical` red `#e0432a`, with rust `#8a4b2f` and
  rig-blue `#2f6f9f` as accents already in the palette. Energy-type glyphs ⚡/♨ and the tier finish
  swatch carry over from the parts UI.
- **Motion discipline:** everything eases (reuse the existing `.hidden` fade rigor — no popping).
  Honour `prefers-reduced-motion` for the pulses/alarms.

---

## 4. Per-element design

### 4.1 Vitals cluster — bottom-left (the headline, PR1)

The two **live combat resources**, HP and boost heat, sit **together** on one riveted dashboard plate
bottom-left, so they're read in a single glance without leaving the rig. Boost **graduates out of the
text dump** into its own real gauge.

```
 bottom-left
 ┌───────────────────────────────┐
 │  HP    ▟▓▓▓▓▓▓▓░░░   160/160   │   ← zoned gauge, needle/fill, value etched
 │  BOOST ◔ ▰▰▰▱▱▱▱  ‹redline›    │   ← heat gauge: cool→amber→RED redline + ⚠ lamp
 └───────────────────────────────┘
```

- **HP gauge** — a horizontal **segmented** gauge (or a semicircular arc dial — §8), zoned
  **green → amber → red** as HP drops, value etched on top. **Feedback:** a red **rim flash** + needle
  jerk on a hit; a slow **red pulse** at critical. (Today's bar already green→reds; this is the
  instrument skin + the damage feedback.)
- **Boost heat gauge** — the showpiece, and a perfect fit for an analog instrument (it *is* a
  pressure/temperature gauge on a steam/electric rig). It reads the `Boost` component
  (`heat`/`overheated`/`active`):
  - **ready** — cool, needle at rest in the green.
  - **boosting** — needle **climbs** through the amber as heat builds; the gauge glows warm.
  - **redline** — a marked **red zone** near the top; entering it warns.
  - **OVERHEAT** — needle **pegged** in the red, a red **⚠ OVERHEAT lamp** lights, the gauge reads
    locked; the lamp **stays lit while it cools** and clears only when the needle returns to cool —
    mirroring the sim's "cool all the way to 0 before re-arm" lockout exactly.
  - The shape teaches the mechanic: you *see* you're near redline and back off, or commit and eat the
    cool-down. Pairs with the boost FOV kick already in the engine.

### 4.2 Rig dash cluster — top-left, always-on (PR2)

Restructure `#stats` from a `<pre>` text string into a **riveted instrument plate** — the rig's stat
cluster, always visible so the build→run feedback loop ("mount an engine, watch it climb") stays felt.

```
 top-left
 ┌─ RIG ───────────────────┐
 │  ⚡ Electric ×1          │   ← energy glyph + name + count
 │  accel   4.9 u/s²        │
 │  top     7.3 / 12 u/s ▰▱ │   ← current / CEILING, tiny fill showing headroom
 │  steer   Centre          │
 │  load    4 / 24      ▰▱▱ │   ← small fill vs rated capacity
 └─────────────────────────┘
```

- **Top speed shows `current / ceiling`** with a small headroom fill — this makes the chassis ceiling
  (and "upgrade your wheels to raise it") legible right where the player feels it.
- Stencilled labels, mono values, energy glyph, the tier finish swatch when relevant. Grouped, scannable
  — the opposite of today's flat text block.

### 4.3 Chassis selector — top-left, above the dash (PR3)

Restyle `#chassis-bar` chips as a **physical selector**: each owned chassis a small metal plate with
its **embossed hotkey cap** (exists), size, and a role/energy glyph; the **active one back-lit** (a lit
indicator, green/amber) so "which rig am I driving" reads like a dashboard selector switch, not a tab.

### 4.4 Scrap wallet — top-right (PR3, minor)

Keep top-right; reskin as a **stamped metal tag** (scrap glyph ◈ + count) in the warm palette so it
stops clashing. Low effort, just harmonization.

---

## 5. Full-screen layout map

```
┌───────────────────────────────────────────────────────────────┐
│ [1·1x3 ◀][2·3x5]                                  ◈ 240 scrap  │  selector ↑left · wallet ↑right
│ ┌─ RIG ──────────────┐                                         │
│ │ ⚡ Electric ×1      │                                         │
│ │ accel 4.9           │                                         │
│ │ top   7.3 / 12 ▰▱   │                  (the rig, centre)      │
│ │ steer Centre        │                                         │
│ │ load  4 / 24 ▰▱▱    │                                         │
│ └─────────────────────┘                                        │
│                                                                 │
│ ┌─ HP ▓▓▓▓▓▓▓░ 160 ─┐                          ╭─ Hold E ─╮     │  vitals ↓left · prompts ↓centre
│ │  BOOST ▰▰▰▱ ready  │                          ╰──────────╯     │
│ └────────────────────┘                                         │
└───────────────────────────────────────────────────────────────┘
```

Corners are kept (familiar), each element re-skinned and the boost gauge promoted into the bottom-left
vitals cluster. Bottom-centre stays the proximity-prompt slot; the toast stays top-centre.

---

## 6. Phasing (each PR shippable on its own)

- **PR1 — Vitals cluster (HP + boost gauge).** Highest value: the live boost resource gets a real,
  glanceable gauge with the overheat lamp, paired with an HP gauge that finally reacts to damage. Move
  boost out of `#stats`.
- **PR2 — Rig dash cluster.** Restructure `#stats` into the diegetic instrument panel (incl.
  top-speed-vs-ceiling).
- **PR3 — Chassis selector + wallet harmonize.** Restyle the selector and scrap tag to match.

## 6a. Implementation seams

- **DOM/CSS:** restructure the run-HUD markup + styles in `game/index.html` (new bottom-left vitals
  container holding HP + boost; `#stats` becomes a structured panel, not a `<pre>`).
- **Components:**
  - `features/hud/stats-hud.ts` — biggest change: from building one text string to writing a structured
    instrument panel; **drop the ASCII boost line** (it moves to the vitals gauge).
  - `features/hud/health-hud.ts` — upgrade the bar to the HP instrument + damage feedback.
  - **new** `features/hud/boost-hud.ts` (or a combined `vitals-hud.ts`) — the boost heat gauge, reading
    the `Boost` component (`heat`/`overheated`/`active`) via `heatFraction`.
  - `features/chassis/chassis-bar.ts`, `features/economy/wallet-hud.ts` — reskin.
- **Leave the modal overlays alone** (workshop/loot/disarm keep the terminal language).
- Pull gauge zone colours + metals from `shared/palette.json` so the HUD is on-palette with the world.

## 7. Decision log (design pass, 2026-06-09)

1. **Visual style = diegetic analog instruments** (over elevate-the-terminal / bold-arcade) — the run
   HUD becomes the rig's dashboard; menus stay terminal.
2. **Vitals = a bottom-left HP + boost cluster**; boost graduates from ASCII-in-text to its own gauge.
3. **Rig detail = always-on compact stats** (the build→run feedback loop earns the permanent readout).

## 8. Open questions (captured, not blocking)

- **Gauge form:** analog **needle/arc dials** vs **segmented bars** for HP + boost. Arc dials read most
  "instrument"; segments are cheaper and very legible. Recommend prototyping both for the vitals and
  picking by feel.
- **Overheat alarm loudness:** lamp-only vs a brief screen-edge red flash. Recommend lamp + a subtle
  gauge glow first; escalate only if players miss the lockout.
- **Audio** (heat hiss while boosting, a clunk on overheat, a damage thud) — deferred; flagged as the
  natural companion to the visual gauges.
- **True 3D-diegetic** panels on the rig body — a future stretch beyond this screen-space pass.
