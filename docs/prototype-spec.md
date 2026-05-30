# RIGRUNNER — Prototype Acceptance Spec

## Purpose

This prototype exists to answer one question: **is the core loop fun?**

> Build → Run → diagnose → Build better → Run farther.

We prove it with primitive shapes (grey boxes are fine) and placeholder assets. The prototype is
throwaway — no architecture, patterns, or tests are required. The only goal is to reach the moment
where a tester *thinks like a player*: "that run was too slow — let me swap a container for an
engine" — and then *feels* that decision pay off on the next run.

## How to read this

Each item is a thing a **player/tester can see or do**, written as a concrete pass/fail observation.
When all 28 pass, the loop is proven and the prototype is done. Build them roughly in order — each
section depends on the previous one.

Tech floor: **Three.js + Vite**, with **Blender MCP** used to generate the rudimentary part meshes
where a primitive box won't read clearly. Basic shapes and basic assets only.

---

## A. Build bay — physical composition

- [ ] **1.** See the chassis — a flat platform on an empty plane, with a visible grid of empty slots.
- [ ] **2.** See loose parts on the floor: an engine, a container, a harvester arm, a gun (each a distinguishable shape).
- [ ] **3.** Grab the engine and drag it onto a slot — it snaps into place; the slot is now occupied.
- [ ] **4.** Grab an already-slotted part, lift it (it detaches and follows the cursor), and drop it on the floor — it lands and the slot frees up.
- [ ] **5.** Try to slot two parts into the same cell — the second is rejected (or bumps the first off). One part per slot.
- [ ] **6.** Watch the silhouette change — adding/removing parts visibly grows/shrinks the rig in real time. No menus, no confirm buttons.

## B. Driving & directionality

- [ ] **7.** Slot an engine and press W/A/S/D — the whole rig (chassis + all slotted parts) drives as one body; the camera follows.
- [ ] **8.** Remove the engine and press W — the rig doesn't move (or barely crawls). Engine = propulsion.
- [ ] **9.** Slot a gun at the front, drive forward, fire — projectiles shoot in the direction of travel.
- [ ] **10.** Move the gun to a rear slot, drive forward, fire — projectiles now shoot backwards. Placement determines fire direction.
- [ ] **11.** Mount a gun on the left and one on the right, fire — each shoots outward in its own direction.

## C. Harvesting — the tactile transformation

- [ ] **12.** See a scrap node on the plane.
- [ ] **13.** Drive up to it with no harvester arm — nothing happens; you can't collect.
- [ ] **14.** Slot a harvester arm, drive up to the node — the arm engages and the node visibly shrinks/depletes until gone.
- [ ] **15.** Watch a slotted container visibly fill as the node depletes.
- [ ] **16.** Harvest with no container slotted — nothing is collected (nowhere to put it).
- [ ] **17.** Fill the container completely and keep harvesting — collection stops; the container is full.

## D. The weight tradeoff — *felt*, not displayed

- [ ] **18.** Drive an empty rig (engine only) — it's nippy: quick to top speed, tight turns.
- [ ] **19.** Add container + harvester + gun and drive — noticeably heavier: lower top speed, sluggish acceleration, wider turns.
- [ ] **20.** Fill the container with scrap and drive — slower still than when empty. Cargo has weight.
- [ ] **21.** Strip back to engine + arm only — fast again. The "fast scavenger vs heavy hauler" choice is real and reversible.

## E. Flee-or-fight — making the build matter

- [ ] **22.** Spawn an enemy that chases the rig — it drives toward you.
- [ ] **23.** In a light/fast build (engine + arm, no gun) — you can outrun it; fleeing is viable.
- [ ] **24.** In a heavy build (container + gun, slow) — it catches you, but the gun lets you fight it off.
- [ ] **25.** In a heavy build with no gun — you can neither flee nor fight; you get caught and damaged. (The teaching "bad build.")

## F. The loop closes

- [ ] **26.** Drive back onto the workshop pad with a full container — you re-enter build mode.
- [ ] **27.** Re-fit the rig based on what went wrong (e.g. "kept getting caught — swap a container for a gun").
- [ ] **28.** Drive out again and feel the difference your change made.

---

## Definition of done

The prototype is done when **all 28 checks pass** and a tester, somewhere around steps 22–27,
naturally diagnoses a run and re-fits with intent — and the re-fit visibly/felt-ly pays off. If grey
cubes deliver that, the game is worth building for real (Phase 2).

## Explicitly out of scope (do NOT build in the prototype)

To keep scope honest, the prototype is a flat plane, four parts, one enemy, one node type. None of
the following belong here — they make the game *bigger*, never *better at its core*:

- Procedural world generation, biomes, or chunk streaming
- Tech trees, part tiers, or part levels
- Resource types beyond "scrap"
- Real art, UI polish, audio, or menus
- Save/load, progression meta, or story
- Any tradeoff axis beyond **weight** (power, heat, balance, etc.)
