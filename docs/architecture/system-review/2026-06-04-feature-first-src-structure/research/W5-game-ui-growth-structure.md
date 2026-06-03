# W5 — Game UI Code Structure Under Growth

**Reviewer role:** Web researcher — game UI code structure under growth  
**Branch under review:** idea/feature-first-structure  
**Proposal:** `docs/architecture/feature-first-structure-proposal.md` (Option B)  
**Date:** 2026-06-04

---

## 1. The concrete problem this research addresses

`game/src/ui/workshop-overlay.ts` is 1,012 lines. It is the largest file in the codebase.
`game/src/ui/deck-view.ts` is a healthy 274 lines and already extracted; the remaining
four UI files (`loot-overlay.ts`, `stats-hud.ts`, `wallet-hud.ts`) are small (25–166 lines)
and in good shape.

The size of `workshop-overlay.ts` is not accidental bloat — the file is well-structured
internally, with six named sections separated by banner comments:

```
// ── Tabs (262–283)
// ── DOM construction (285–501)
// ── Parts Shop (502–617)
// ── Deck / 3D staging view (693–738)
// ── Drag-and-drop: inventory ↔ bench, inventory → deck (740–938)
// ── helpers (940–1012)
```

That internal structure is the solution trying to happen. The file already knows
its own pieces; they are not yet separated into separate classes or modules.

`observations.md` #9 and #10 document the UX pain: the recipe picker will not scale past
a handful of recipes; the overlay is "text-heavy and confusing"; the bench mixes the
build-workflow view with the inspect view. A workshop-UX pass and the MP (part-identity
tiers/specials) milestone are pending. This research asks: **when that pass comes, does
Option B's per-feature UI placement help or fragment this overlay?**

---

## 2. The cross-feature import profile of `workshop-overlay.ts`

The file currently imports from:

| Source path | Feature domain |
|---|---|
| `core/world`, `core/types` | ECS engine |
| `components/engine-part`, `assembly`, `part`, `mount`, `mount-grid`, `renderable`, `inventory`, `wallet`, `bench` | common kernel |
| `content/parts-catalog`, `recipes`, `part-shop`, `product-visual` | workshop / economy content |
| `systems/assembly`, `systems/staging`, `systems/shop`, `systems/mounting` | workshop, mounting, economy |
| `shared/model-portrait`, `shared/model-loader` | repo-root shared |
| `render/articulation` | common render |
| `./deck-view` | sibling UI |

This profile tells the truth about what `workshop-overlay` *is*: it is a **hub** that
assembles a view over all three workshop sub-features — Bench (assembly), Deck (staging +
mounting), and Shop (economy). It reaches into mounting via `closestFreeCellLocal` and
`systems/mounting`, into economy via `wallet` and `systems/shop`, and into engine assembly
via `systems/assembly`. It is, structurally, a multi-feature aggregator.

That cross-feature reach is not accidental coupling; it reflects the reality that the
workshop is RIGRUNNER's **hub screen** — the one place where build, assemble, stage,
buy, and sell converge. This has direct implications for how decomposition should be
approached, discussed in §5.

---

## 3. External research findings

### 3.1 Feature-Sliced Design: where large multi-feature UI lives

Feature-Sliced Design (FSD) is the best-developed public methodology for the exact
problem of "where does this UI go?" when code has grown feature-first. The core rule:
dependencies flow downward only; a module in a layer can only import from layers strictly
below it.
([Feature-Sliced Design — Layers](https://feature-sliced.design/docs/reference/layers))

FSD defines a **Widgets** layer for "large self-sufficient blocks of UI." The guidance
is precise: if a block makes up most of the interesting content on a screen *and is never
reused across pages*, it should **not** be a widget — it should live inside that page.
Widgets are most useful when reused across multiple pages or when a page has multiple
large independent blocks that compose independently.
([Feature-Sliced Design — UI Architecture Patterns](https://feature-sliced.design/blog/ui-architecture-patterns))

FSD also addresses where primitive UI elements live versus feature-specific ones:
- Primitives with no business logic → `shared/ui`  
- Entity representations reused across features → `entities/*/ui`  
- Feature-specific interaction UI → `features/*/ui`  
- Page-level compositions that span multiple features → `widgets/*/ui`

The implication for Option B: the **workshop overlay as a whole** is analogous to an
FSD "widget" — a composition that orchestrates several features (bench/assembly,
deck/staging, shop/economy). Individual tab renderers (`renderBenchPanel`, `renderShop`,
`renderDeck`) that only touch their own feature's data are analogous to FSD "features"
and can live in their feature slice.

The directional-dependency rule from FSD maps cleanly onto Option B's rule: features
can depend on `common/`, but features cannot import from each other. `workshop-overlay`
as a composition root is the one place that *should* import across features — and that
is exactly what Option B's `main.ts` (the composition root) already does.

### 3.2 The Mediator / Gateway pattern for multi-feature UI

GDQuest's tutorial on the Mediator pattern in Godot describes the problem directly:
when entity placement, crafting, work, and inventory systems all hold references to UI
nodes, any refactoring breaks multiple systems. The solution: a single gateway object
that centralises communication between game systems and the interface. Sub-panels expose
only the interface the gateway needs; systems connect to the gateway, not to individual
sub-nodes.
([GDQuest — The Mediator Pattern](https://www.gdquest.com/tutorial/godot/design-patterns/mediator/))

The gateway provides:
- **Forwarding getters/setters** — the mediator exposes properties that delegate
  transparently to child panels without exposing their internal structure.
- **Signal/callback bubbling** — rather than having systems connect to multiple child
  signals, the mediator re-emits them; one callback surface for callers.
- **Helper functions** — complex operations spanning panels (`add_to_inventory()` that
  handles both quickbar and player inventory) become single mediator methods.

This maps directly to `WorkshopOverlay`'s current design: `main.ts` calls
`setZoneActive(active)` and the constructor once — it has no knowledge of tabs, bench,
deck, or shop. The overlay itself is already the mediator. Decomposing it internally
into sub-panel classes (BenchPanel, ShopPanel, DeckPanel) without changing this external
contract would be a **pure internal refactor** — no callers change.

### 3.3 The Game Component pattern: decompose by domain, communicate through parent state

Robert Nystrom's *Game Programming Patterns* Component chapter establishes the pattern
of decomposing a monolithic game object by identifying domain boundaries, extracting into
focused component classes, and keeping shared state in the container.
([Game Programming Patterns — Component](https://gameprogrammingpatterns.com/component.html))

For `workshop-overlay.ts`, the domain boundaries are already drawn by its section
comments. The three mechanisms for component communication are:
1. **Shared container state** — simplest; child panels read the parent's `selected`,
   `tab`, `open`, and `world` fields.
2. **Direct references between siblings** — e.g. a `ShopPanel` that needs to call
   `refreshInventory()` on the inventory rail. Creates coupling but is explicit.
3. **Callbacks through the container** — child panel signals an intent (e.g.
   `onBuyComplete(entity)`) and the container handles the cross-panel side effects
   (refresh inventory + select the new item).

The pattern warns against over-engineering for simple cases, but the current 1,012-line
class is clearly large enough to benefit — the benchmark from Nystrom is that components
earn their place when a monolith starts accumulating "this method for rendering" and
"this method for physics" in a single class.

### 3.4 Unity community: UI as a pure projection, decomposed by slot responsibility

A Unity Discussions thread on inventory system decoupling
([Unity Discussions — Inventory System Architecture](https://discussions.unity.com/t/architecture-using-an-inventory-system-to-learn-how-to-decouple-my-code/601566))
recommends:
- **Each slot handler manages its own drag-drop logic** — the granular responsibility,
  not a monolithic drag system.
- **A shared dragging icon maintained by the UI root** — the ghost element is cross-slot
  shared state; it belongs in the container, not a slot.
- **Panel components pull data from inventory on demand** — UI should *pull* reactively:
  state-change events prompt each panel to call the query functions it needs.
- **Event-driven refresh** — fire events when state changes; panels subscribe and
  refresh by querying current state. This is the "UI as projection" property.

The event-driven observation is notable: RIGRUNNER's `WorkshopOverlay.refresh()` already
does this. It is called on every state mutation and re-queries the `World` directly. The
pattern is correct; what's missing is that `refresh()` currently triggers a full repaint
of every panel regardless of what changed. When the shop changes, the bench is
re-rendered; when the bench changes, the shop is re-rendered. Sub-panel extraction would
allow targeted invalidation — `refreshBench()` without `refreshShop()`.

### 3.5 ECS and GUI: pure projection is the right default, mutations are a special case

The Leafwing Studios article on ECS-backed GUI frameworks identifies the core tension:
UI as a pure read-only projection of ECS state is clean, but UI that *drives* mutations
(buy, assemble, dismantle) needs a distinct pattern — typically queueing events or
calling system functions, not directly mutating components.
([Leafwing Studios — ECS GUI Framework](https://www.leafwing-studios.com/blog/ecs-gui-framework/))

`WorkshopOverlay` already correctly separates these: it reads `World` by querying
components (`inventoryItems`, `getWallet`, `stagedProducts`) and mutates `World` only
through system functions (`assemble`, `dismantle`, `stageProduct`, `buyPart`). No direct
component mutation happens inside the UI class. This is the correct pattern; splitting
into sub-panels must preserve it.

### 3.6 Feature-first dependency rule applied to UI: features own their display, not cross-feature layout

The FSD UI Architecture Patterns article articulates a rule that directly bears on the
Option B decision:
> "Dependencies go **down**, never sideways — ensuring UI components can't accidentally
> pull in cross-feature business concerns."

If each tab of the workshop were a truly independent feature's UI (e.g. "the economy
feature owns its ShopPanel"), then it would be correct to put `ShopPanel` in
`features/economy/`. But the rule for what belongs in a feature slice is *single-feature
ownership*. The shop is the intersection of economy (Wallet, buyPart), inventory
(Inventory, grant), and content (PART_SHOP_STOCK, parts-catalog). It is legitimately
cross-feature; it belongs in the workshop feature, not in economy.

---

## 4. What the research says about Option B's per-feature UI placement

Option B places each feature's UI in its vertical slice:

```
features/
  scrap/     → loot-overlay.ts
  economy/   → wallet-hud.ts
  workshop/  → workshop-overlay.ts  deck-view.ts
  hud/       → stats-hud.ts
```

This placement is well-supported by the research findings:

| UI file | Feature domain | Option B placement | Assessment |
|---|---|---|---|
| `loot-overlay.ts` | Pure scrap feature — only reads scrap state | `features/scrap/` | Correct; single-feature |
| `wallet-hud.ts` | Pure economy readout — only reads Wallet | `features/economy/` | Correct; single-feature |
| `stats-hud.ts` | Cross-cutting (engine + drive) | `features/hud/` | Correct; the `hud/` slice is the acknowledged cross-cutter |
| `workshop-overlay.ts` | Multi-feature hub (assembly + staging + economy) | `features/workshop/` | Correct; workshop is the hub feature that legitimately aggregates |
| `deck-view.ts` | Pure deck rendering — only reads staging state | `features/workshop/` | Correct; workshop-local sub-view |

The research finding that matters: **a multi-feature UI hub does not fragment when it
moves into a feature slice — it fragments when its internals are incorrectly split across
multiple feature slices.** Moving `workshop-overlay.ts` into `features/workshop/` is
correct. What would be wrong is breaking the workshop overlay's three tab-renderers into
`features/economy/ShopPanel`, `features/mounting/DeckPanel`, and `features/engine/BenchPanel`
— because each of those panels imports from the others' data, and the dependency graph
would develop cross-feature sideways arrows. All three tabs belong in `features/workshop/`.

---

## 5. The workshop overlay decomposition question — how does Option B affect it?

The pending workshop-UX pass and the MP milestone will both push `workshop-overlay.ts`
to grow. The recipe selector needs to become a scrollable, filterable list. Part-identity
tiers and gold specials require new visual treatment per part chip. The bench inspect mode
and the build mode need clearer visual separation. New recipe categories are coming.

**Does Option B's structure help or hurt this growth?**

### It helps: the natural decomposition maps to the existing section structure

Option B does not prescribe internal class structure inside a feature slice. What it gives
is the right *home*: `features/workshop/` becomes a folder, and `workshop-overlay.ts`
can stay a single class *or* be internally refactored into:

```
features/workshop/
  workshop-overlay.ts       # coordinator: open/close, drag-and-drop root, tab switching
  bench-panel.ts            # bench + recipe picker + bench preview + assemble button
  shop-panel.ts             # buy/sell list against Wallet and PART_SHOP_STOCK
  deck-panel.ts             # identical to today's deck-view.ts call surface
  inventory-rail.ts         # item chip list + selection state
  item-chip.ts              # makeChip() extracted as a pure factory or class
  recipe-selector.ts        # future: scrollable/filterable recipe list replacing tab strip
```

This decomposition follows the existing `// ──` section boundaries. The key property
the research requires is preserved: each sub-panel only imports from `common/` and
systems below it; no sub-panel imports from a sibling panel directly; the
`workshop-overlay.ts` coordinator owns shared state (`selected`, `tab`, `drag`) and
passes it down or coordinates updates through callbacks.

The drag-and-drop system specifically needs to live in the coordinator: the ghost element
is cross-panel state (it can originate in the inventory rail and land in the bench or
deck), and `beginDrag`, `handlePointerMove`, `handlePointerUp`, `commitDrop`, and the
drop-highlight clearing all need to reference both the bench panel and the deck panel.
This matches the "shared dragging icon maintained by the UI root" finding from §3.4.

### It could fragment: if `common/render/view.ts` imports from `features/`

The proposal notes (§3, "the one real refactor") that splitting `render/animators.ts`
would require `common/render/view.ts` to call feature-local animators. The research
finding here is that **this dependency direction (shared tier importing features) is the
anti-pattern FSD explicitly prevents**. A `common/render/view.ts` that imports
`features/drive/driveAnimator.ts` violates the downward-only rule.

The solution is not to make `view.ts` import features, but to **invert the dependency**:
each feature's animator registers itself with a shared dispatch table, or `main.ts`
explicitly wires each animator into the view. Since `main.ts` is already the composition
root and the one file that legitimately imports across features, the wiring belongs there.
This keeps `common/render/` clean and avoids the fragmentation risk.

### The recipe-selector growth case is clean under Option B

When the recipe selector grows to a searchable scrolling list, it lives in
`features/workshop/recipe-selector.ts`. It imports from `common/parts/` (parts-catalog),
`features/workshop/` (the Recipe types and RECIPES constant), and the DOM. No cross-feature
imports needed. This is the easiest growth case.

### The part-identity tier visuals (MP milestone) require coordination

Tiers and gold specials (MP) affect how every part chip renders: colour, border, icon, or
label style. Under Option B, the item chip display logic lives in
`features/workshop/item-chip.ts` (or inside `makeChip()` in `workshop-overlay.ts`). The
tier/rarity data lives in `common/parts/parts-catalog.ts`. The rendering of tier
information is a workshop-UI concern, not a common concern, so it correctly stays in
`features/workshop/` and reads from `common/parts/`.

This growth case is also clean: the part chip knows the tier data via `partDef()` from
`common/parts/`; the visual treatment is local to the chip factory in the workshop feature.

---

## 6. Findings on "UI as pure projection" — is RIGRUNNER's workshop overlay correctly designed?

The file's own JSDoc (line 66–69) states:
> "The class reads and mutates the World only through the component model (`Inventory` +
> `Bench` + the assembly & staging systems), never a parallel store, so state survives
> close/reopen."

This is precisely the "pure projection" property: the overlay holds no game truth; it
reads truth from the World via system functions and re-renders. This is confirmed correct
by all research sources (§3.5). The pattern is not broken by Option B restructuring.

The one impurity worth noting: the overlay holds `selected: EntityId | null` and
`drag: DragState | null` as UI-local state. These are genuinely UI state (which chip is
highlighted, which chip is being dragged), not game state, and belong in the UI class.
The World knows nothing about them. This is correct and must remain intact through any
decomposition.

---

## 7. Summary of decision-bearing findings

1. **Moving `workshop-overlay.ts` into `features/workshop/` is correct** (supported by
   FSD, Mediator, and the Component pattern). The workshop is the hub feature that
   legitimately aggregates assembly, staging, and economy. It should not be split across
   feature slices.

2. **The file's existing section structure maps cleanly to sub-panel classes** that can
   be extracted *within* `features/workshop/` when the workshop-UX pass comes. This is
   an internal decomposition, not a cross-feature one. The coordinator retains
   drag-and-drop state and tab switching; panels own their own render logic.

3. **Do not put tab-specific UI in different feature slices.** `ShopPanel` is not purely
   an economy concern — it imports from inventory, wallet, parts-catalog, and shop
   systems. Splitting it into `features/economy/` would create sideways cross-feature
   arrows. It belongs in `features/workshop/`.

4. **The dependency-direction risk is in `common/render/view.ts`, not in the workshop UI.**
   If animators move into feature slices, the shared view must not import them directly.
   Wire them through `main.ts` (the composition root) or use a registration pattern.
   This is the one structural risk the proposal correctly identifies and the research
   confirms as the right call to make before migration.

5. **Option B's per-feature UI placement helps, not hurts, the workshop-UX pass** because
   it gives the workshop UI a *folder* rather than a flat file, making the natural
   sub-panel extraction easy without any cross-feature boundary violations.

6. **`stats-hud.ts` in `features/hud/` is the correct choice** for cross-cutting HUD
   readouts. The `hud/` slice is the acknowledged cross-cutting aggregator, analogous to
   FSD's widgets layer for "legitimately cross-feature display."

---

## 8. Recommendation

The research supports **Option (b): ALTER Option B** with one explicit addendum on UI:

> **Add to Option B's open boundary calls (§4 of the proposal):**
> "The workshop overlay's three tab-renderers (bench, shop, deck) all stay inside
> `features/workshop/` — they are not split into their respective feature slices —
> because each tab imports from multiple feature domains. Internal decomposition into
> sub-panel classes (BenchPanel, ShopPanel, etc.) within `features/workshop/` is the
> correct next step and maps to the file's existing section structure. The coordinator
> (`WorkshopOverlay`) retains drag-and-drop state and tab switching; it is the Mediator
> between `main.ts` and the workshop sub-panels."

This is not a rejection of Option B — it is a clarification that strengthens it. The
proposal already places `workshop-overlay` in `features/workshop/`; this addendum
explicitly pre-empts the temptation (for a human or an agent) to "move ShopPanel to
economy/ because it's about economy" when the workshop-UX pass arrives.

---

## Sources

- [Feature-Sliced Design — Layer Reference](https://feature-sliced.design/docs/reference/layers)
- [Feature-Sliced Design — UI Architecture Patterns](https://feature-sliced.design/blog/ui-architecture-patterns)
- [Feature-Sliced Design — Overview](https://feature-sliced.design/docs/get-started/overview)
- [GDQuest — The Mediator Pattern](https://www.gdquest.com/tutorial/godot/design-patterns/mediator/)
- [Game Programming Patterns — Component](https://gameprogrammingpatterns.com/component.html)
- [Unity Discussions — Inventory System Decoupling](https://discussions.unity.com/t/architecture-using-an-inventory-system-to-learn-how-to-decouple-my-code/601566)
- [Leafwing Studios — ECS GUI Framework](https://www.leafwing-studios.com/blog/ecs-gui-framework/)
- [Web Game Dev — ECS Architecture](https://www.webgamedev.com/code-architecture/ecs)
- [GameDev.net — In-game UI Architecture](https://gamedev.net/forums/topic/715010-in-game-ui-architecture/)
- [Feature-Sliced Design — Mastering FSD: Lessons from Real Projects (DEV)](https://dev.to/arjunsanthosh/mastering-feature-sliced-design-lessons-from-real-projects-2ida)
- [Vanilla JavaScript Components (Bunny AI / Medium)](https://medium.com/bunnyllc/vanilla-js-components-8d20c58b69f4)
