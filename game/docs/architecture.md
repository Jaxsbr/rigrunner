# RIGRUNNER — Architecture & Principles

The standing contract for the **official game** (in `game/`). Agents read this before
writing game code and apply these principles **by default** — they are not optional
style preferences, they are how we keep the system from fusing into a coupled mess.

> If a change would violate a principle here, the change is wrong or the principle is —
> resolve it explicitly (update this doc), don't quietly break it.

---

## Where we are

- This is a **fresh build**, not an extension of `prototype/`. The prototype proved the
  core loop is fun; it is **reference only** and nothing is promoted as-is. Its hard-won
  lessons live in [`../../docs/observations.md`](../../docs/observations.md) and are
  baked into the principles below.
- We **do not have a full MVP, theme, or target yet.** We build by **discovery through
  implementation**: make a small mechanism we enjoy → flesh it out → let a concept
  emerge from the mechanisms. Architecture's job is therefore to make change cheap and
  keep mechanisms from welding together before we know which ones survive.
- Verification is built in from line one: small, testable units + cloud PR review skills
  tuned to flag bad patterns. Treat review findings as gates, not suggestions.

---

## North-star principles

Read these every time. The rest of the doc expands them.

1. **Composability over inheritance.** Behaviour is composed from small capabilities, not inherited from a class tree.
2. **Low coupling, high cohesion.** Depend on contracts, not concretes. One reason to change per module.
3. **Simulation is the single source of truth.** Rendering and input are edges, never owners of state.
4. **SOLID where it earns its place; DRY without the wrong abstraction.**
5. **Deterministic, testable logic.** Side effects at the edges.
6. **Inheritance sparingly, and only for a true `is-a`.**

---

## 1. Composability over inheritance — the core model

This is the load-bearing decision. We model the world as **entities composed of
capabilities**, operated on by **systems** — not as a hierarchy of classes.

- **Entity** — an identity + a set of components. It "is" nothing in particular; it is
  whatever capabilities it currently holds.
- **Component (capability)** — one small, single-responsibility unit that owns its own
  data and represents one ability. Mix-and-match onto any entity.
- **System** — logic that operates over every entity possessing the relevant
  components. Behaviour lives here, keyed by capability presence — not buried in methods
  on a class.

### Worked example — the rig

Capabilities (each composable onto anything):

| Capability    | Means "this thing can…"                                   |
|---------------|-----------------------------------------------------------|
| `Transform`   | exist somewhere (position/rotation)                       |
| `Platform`    | **host** other entities — exposes anchor slots + a footprint/size + hosting rules |
| `Storage`     | **contain** a quantity of a resource, up to a capacity    |
| `Propulsion`  | provide drive force (the "engine")                        |
| `Extraction`  | harvest from a source (the "arm")                         |
| `Armament`    | fire in a facing direction (the "gun")                    |
| `Damageable`  | take damage / hold integrity                              |

Then:

- A **rig** is just an entity with `Transform` + `Platform` (and gains drivability once
  something with `Propulsion` is hosted on it).
- A **container part** is an entity with `Transform` + `Storage`.
- A **gun** is `Transform` + `Armament`; an **engine** is `Transform` + `Propulsion`; etc.

### The property that makes this worth it: capabilities stack

`Platform` is just a capability — so **a container can also have `Platform`** and thereby
*store cargo AND host parts on top of it*. Hosting is defined entirely by the `Platform`
component (its slots), independent of what the host fundamentally "is." That gives us,
for free:

- **Recursive builds / stacking** — parts on platforms on containers on the rig.
- **Customizable platforms** — the base structure is itself just an entity with a
  `Platform`; we vary its slots/size over time without touching any class hierarchy.
- **New part types & future capabilities** (drive terrain, sensors, shields, …) drop in
  as new components + systems, hostable anywhere a `Platform` exposes a slot. No
  rewrites, no `class Gun extends Part extends Entity`.

### Rules of thumb

- A capability = **one responsibility**, and **owns its own data**.
- Capabilities **do not reach into each other's internals** — a system coordinates them
  (e.g. a hosting system reads `Platform` + a child's `Transform`; it doesn't let
  `Storage` poke `Propulsion`).
- Prefer **"has-a capability"** over **"is-a type."** If you're about to write `extends`,
  stop and check whether a component composes the behaviour instead.

---

## 2. Low coupling, high cohesion

- **Depend on contracts (interfaces), not concrete implementations** (DIP). Systems take
  what they need as narrow interfaces, injected — not hard-wired singletons.
- **Communicate across seams**, not through reach-in. Prefer an **event bus / messages**
  or explicit **queried reads** of state over one system holding a direct reference to
  another's guts.
- **One reason to change per module** (SRP). If a file changes for two unrelated
  reasons, it's two modules.
- **No circular dependencies.** If A needs B and B needs A, a contract or event is
  missing between them.

---

## 3. Simulation vs rendering vs input — a hard boundary

The prototype's worst bugs came from **state living in the view** (see observations #6
and #7 — cargo stuck in container meshes). We do not repeat that.

- **The simulation/game state is the single source of truth.** Systems mutate it.
- **Rendering (Three.js) is a *projection*** of state — it reads, it draws, it owns no
  game truth. We could replace the renderer without touching game logic.
- **Input is a *producer of intents*** — it maps device events to commands/intents that
  systems consume. It owns no game truth either.

These three layers never fuse. Benefit: logic runs and is tested **headless**, the
renderer stays dumb, and an entire class of "why is the data wrong" bug becomes
impossible by construction.

---

## 4. SOLID where it earns its place

We apply SOLID pragmatically, not religiously:

- **SRP, ISP, DIP** are the most load-bearing here — small single-purpose components and
  systems, narrow injected interfaces.
- **OCP/LSP** matter less for us *because we avoid deep hierarchies by design* — there's
  little to substitute or subclass. Don't manufacture hierarchies just to invoke them.

## 5. DRY — but never the wrong abstraction

De-duplicate genuine, single-source-of-truth **knowledge**. But a little duplication is
cheaper than a **wrong/early abstraction** that couples two things which merely look
alike. Rule: extract on the **third** confirmed occurrence, not the second hunch.

## 6. Inheritance — sparingly, deliberately

Not banned — defaulted against. Acceptable for a genuine, stable `is-a` with a shared
interface and **no need to recompose at runtime** (e.g. a tiny base for a family of
pure-data definitions, or extending a framework/library class). If you reach for
`extends`, **justify it in the PR**; the reviewer's default question is "why isn't this a
component?"

---

## Proposed module layout (`game/`)

Lightweight and will evolve — the point is the *direction of dependencies*: edges depend
on core, never the reverse.

```
game/
  src/
    core/        # entity, component/world registry, event bus, shared types — depends on nothing
    components/  # capability data definitions (Transform, Platform, Storage, …)
    systems/     # logic over components (Movement, Hosting, Harvest, Combat, …)
    render/      # Three.js view layer — reads state, draws; owns no game truth
    input/       # device events → intents
    content/     # concrete part/entity types described AS compositions of capabilities (data)
    main.ts      # composition root: wires systems, render, input together
  tests/         # (or *.test.ts alongside source)
```

`content/` is where a "gun" or "hauler chassis" is *defined as data* — a list of
capabilities with their parameters — not as a class. New parts are new data.

---

## Verification — built in, not bolted on

- **Logic is testable in isolation.** Systems are pure-ish (state in → state out);
  side effects (rendering, audio, DOM) stay at the edges. Each mechanism ships with
  tests for its system logic.
- **The renderer and input layers stay thin** enough that "we didn't test the view" is
  acceptable risk.
- **Cloud PR review skills run on changes** and are tuned to catch coupling, god-objects,
  deep inheritance, wrong-DRY, and leaked state. Findings are **gates**.
- Definition of "done" for a mechanism: clear component/system boundaries + tests +
  green review.

## Anti-patterns — reject in review

- God objects / classes that know about everything.
- Deep or speculative inheritance trees.
- One component reading/writing another component's internals directly.
- Renderer or input layer holding authoritative game state.
- Circular dependencies; hidden global mutable singletons.
- Premature/forced DRY that couples unrelated things.

---

## Settled foundations

1. **Language: TypeScript.** Types *are* part of this architecture — they're how we
   express the contracts that ISP/DIP rely on. (The prototype was plain JS deliberately;
   the official build is TS.)
2. **Component model: lightweight, hand-rolled ECS-flavoured.** Entities + data
   components + systems, kept as small as possible and validated by building the *first*
   mechanism — **no ECS framework dependency** up front. We adopt a library only if a
   concrete need proves the hand-rolled core insufficient, and we record that decision
   here if we do.

Everything is rendered with **Three.js** (view layer only) and bundled with **Vite**.
