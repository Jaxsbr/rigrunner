import { describe, it, expect } from 'vitest';
import { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { Collider } from '@common/components/collider';
import { Part } from '@common/components/part';
import { Mount } from '@common/components/mount';
import { MountGrid } from '@common/components/mount-grid';
import { ScrapPile } from '@features/scrap/scrap-pile';
import { Digging } from '@features/scrap/digging';
import { Collectible } from '@features/scrap/collectible';
import { LootDrop } from '@common/components/loot-drop';
import { RestorableSite } from '@common/components/restorable-site';
import { Dissolving, DISSOLVE_DURATION } from '@features/scrap/dissolving';
import { scrapPileSystem, scrapRummageSystem, pileClearSystem } from './scrap-pile-system';

const FOV = (120 * Math.PI) / 180;

/** A rig at (x,z) with a collider; carries a MountGrid so it reads as a chassis. */
function rig(world: World, x: number, z: number, rotationY = 0): EntityId {
  const e = world.createEntity();
  world.add(e, Transform, { x, z, rotationY });
  world.add(e, Collider, { radius: 1.2 });
  world.add(e, MountGrid, { cols: 2, rows: 3, cellSize: 1, deckY: 0.66 });
  return e;
}

/** Mount a Reclaimer part on `rig`, posed at (x,z) facing `rotationY` (as the mounting system would). */
function reclaimer(world: World, rigId: EntityId, x: number, z: number, rotationY: number): EntityId {
  const e = world.createEntity();
  world.add(e, Part, { kind: 'reclaimer' });
  world.add(e, Mount, { rig: rigId, col: 0, row: 0, yaw: 0 });
  world.add(e, Transform, { x, z, rotationY });
  return e;
}

function pile(world: World, x: number, z: number, waves = 8): EntityId {
  const e = world.createEntity();
  world.add(e, Transform, { x, z, rotationY: 0 });
  world.add(e, ScrapPile, { radius: 4, fov: FOV, total: waves, remaining: waves, worked: 0, scrapScattered: 0, active: false });
  return e;
}

describe('scrapPileSystem (the gate)', () => {
  it('stays dormant without a mounted Reclaimer, even in range', () => {
    const world = new World();
    const r = rig(world, 0, 0);
    const p = pile(world, 0, -3); // dist 3 ≤ 4 + 1.2 → in range
    scrapPileSystem(world, r);
    expect(world.get(p, ScrapPile)!.active).toBe(false);
  });

  it('activates in range with the arm aimed at the pile', () => {
    const world = new World();
    const r = rig(world, 0, 0, 0);
    reclaimer(world, r, 0, 0, 0); // yaw 0 → front toward −Z
    const p = pile(world, 0, -3); // straight ahead, in range
    scrapPileSystem(world, r);
    expect(world.get(p, ScrapPile)!.active).toBe(true);
  });

  it('stays dormant when the Reclaimer faces away from the pile', () => {
    const world = new World();
    const r = rig(world, 0, 0, 0);
    reclaimer(world, r, 0, 0, 0); // front toward −Z…
    const p = pile(world, 0, 3);  // …but the pile is toward +Z (behind) — out of FOV
    scrapPileSystem(world, r);
    expect(world.get(p, ScrapPile)!.active).toBe(false);
  });

  it('stays dormant when aimed correctly but out of range', () => {
    const world = new World();
    const r = rig(world, 0, 0, 0);
    reclaimer(world, r, 0, 0, 0);
    const p = pile(world, 0, -10); // aimed, but dist 10 > 4 + 1.2
    scrapPileSystem(world, r);
    expect(world.get(p, ScrapPile)!.active).toBe(false);
  });

  it('stays dormant once reclaimed (mid-dissolve), even aimed in range', () => {
    const world = new World();
    const r = rig(world, 0, 0, 0);
    reclaimer(world, r, 0, 0, 0);
    const p = pile(world, 0, -3); // straight ahead, in range
    world.add(p, Dissolving, { elapsed: 0 }); // a reclaimed pile mid-dissolve
    scrapPileSystem(world, r);
    expect(world.get(p, ScrapPile)!.active).toBe(false);
  });
});

describe('scrapRummageSystem (hold-to-work)', () => {
  /** A world with the rig parked, Reclaimer aimed, and the gate already computed active. */
  function workableWorld(waves = 8): { world: World; r: EntityId; rec: EntityId; p: EntityId } {
    const world = new World();
    const r = rig(world, 0, 0, 0);
    const rec = reclaimer(world, r, 0, 0, 0);
    const p = pile(world, 0, -3, waves);
    scrapPileSystem(world, r); // sets p.active = true
    return { world, r, rec, p };
  }

  it('marks the Reclaimer Digging while working an active pile, clears it when released', () => {
    const { world, rec, p } = workableWorld();
    scrapRummageSystem(world, /* rig */ world.get(rec, Mount)!.rig, true, 0.1);
    expect(world.has(rec, Digging)).toBe(true);
    expect(world.get(p, ScrapPile)!.active).toBe(true); // unchanged by rummage

    scrapRummageSystem(world, world.get(rec, Mount)!.rig, false, 0.1);
    expect(world.has(rec, Digging)).toBe(false);
  });

  it('does not dig when the gate is not met (pile dormant)', () => {
    const { world, r, rec, p } = workableWorld();
    world.get(p, ScrapPile)!.active = false; // simulate facing away / out of range
    scrapRummageSystem(world, r, true, 0.5);
    expect(world.has(rec, Digging)).toBe(false);
    expect(world.get(p, ScrapPile)!.remaining).toBe(8); // untouched
  });

  it('drains one wave per interval and bursts scrap around the rig', () => {
    const { world, r, p } = workableWorld();
    // 0.45 s = one WAVE_INTERVAL → exactly one wave drained. rng 0.5 → a deterministic 2-piece burst
    // (scrap tier range 1–3) and the pile tracks what it scattered.
    const spawned = scrapRummageSystem(world, r, true, 0.45, () => 0.5);
    expect(world.get(p, ScrapPile)!.remaining).toBe(7);
    expect(spawned.length).toBe(2);
    expect(world.get(p, ScrapPile)!.scrapScattered).toBe(2);
    for (const s of spawned) expect(world.has(s, Collectible)).toBe(true);
  });

  it('resets partial wave progress when work stops mid-wave', () => {
    const { world, r, p } = workableWorld();
    scrapRummageSystem(world, r, true, 0.3); // < one interval → no wave yet, progress banked
    expect(world.get(p, ScrapPile)!.worked).toBeCloseTo(0.3, 5);
    scrapRummageSystem(world, r, false, 0.1); // released → progress reset
    expect(world.get(p, ScrapPile)!.worked).toBe(0);
  });

  it('begins the reclaim dissolve (not instant destroy) after enough work, stopping the dig', () => {
    const { world, r, rec, p } = workableWorld(2); // a shallow 2-wave pile
    // 1.0 s covers 2 whole waves (0.45 each) → pile emptied this frame.
    scrapRummageSystem(world, r, true, 1.0);
    expect(world.isAlive(p)).toBe(true);            // lingers — it dissolves rather than vanishing
    expect(world.has(p, Dissolving)).toBe(true);    // the dissolve clock has started
    expect(world.get(p, Dissolving)!.elapsed).toBe(0);
    expect(world.has(rec, Digging)).toBe(false);    // the dig stops on empty
    expect(world.get(p, ScrapPile)!.active).toBe(false); // disc cleared at once (popup freezes the gate)
  });

  it('leaves a RestorableSite stump (kind:scrap) at the pile position on reclaim', () => {
    const { world, r, p } = workableWorld(2);
    const pt = world.get(p, Transform)!;
    scrapRummageSystem(world, r, true, 1.0, () => 0.99); // emptied; rng fails the loot roll
    const sites = world.query(RestorableSite);
    expect(sites).toHaveLength(1);
    const site = world.get(sites[0]!, RestorableSite)!;
    expect(site.kind).toBe('scrap');
    expect(site.x).toBe(pt.x);
    expect(site.z).toBe(pt.z);
    expect(world.get(sites[0]!, Dissolving)).toBeDefined(); // the stump shares the heap's dissolve clock
  });

  it('pileClearSystem destroys the sunk heap and lands the risen stump when the clock completes', () => {
    const { world, r, p } = workableWorld(2);
    scrapRummageSystem(world, r, true, 1.0, () => 0.99); // empties → dissolve starts, stump spawned
    const stump = world.query(RestorableSite)[0]!;

    pileClearSystem(world, DISSOLVE_DURATION / 2); // mid-dissolve: both still present, clock advancing
    expect(world.isAlive(p)).toBe(true);
    expect(world.get(p, Dissolving)!.elapsed).toBeCloseTo(DISSOLVE_DURATION / 2, 5);
    expect(world.has(stump, Dissolving)).toBe(true);

    pileClearSystem(world, DISSOLVE_DURATION); // past the duration: heap gone, stump holds at rest
    expect(world.isAlive(p)).toBe(false);                 // the heap fully sank — despawned
    expect(world.isAlive(stump)).toBe(true);              // the stump persists as the restoration scar
    expect(world.has(stump, Dissolving)).toBe(false);     // its clock is shed — it holds risen
    expect(world.has(stump, RestorableSite)).toBe(true);
  });

  it('always queues a LootDrop on empty: finds on a winning roll, scrap-only on a miss', () => {
    // rng = 0 forces the 50% sub-part tier to drop → a LootDrop with finds AND scrap reported.
    const win = workableWorld(2);
    scrapRummageSystem(win.world, win.r, true, 1.0, () => 0);
    const wd = win.world.query(LootDrop);
    expect(wd).toHaveLength(1);
    const wdrop = win.world.get(wd[0]!, LootDrop)!;
    expect(wdrop.finds.length).toBeGreaterThan(0);
    expect(wdrop.scrap).toBeGreaterThan(0);

    // rng ≥ 0.5 → the sub-part roll fails → still a LootDrop, finds empty but scrap reported.
    const miss = workableWorld(2);
    scrapRummageSystem(miss.world, miss.r, true, 1.0, () => 0.99);
    const md = miss.world.query(LootDrop);
    expect(md).toHaveLength(1);
    const mdrop = miss.world.get(md[0]!, LootDrop)!;
    expect(mdrop.finds).toHaveLength(0);
    expect(mdrop.scrap).toBeGreaterThan(0);
  });
});
