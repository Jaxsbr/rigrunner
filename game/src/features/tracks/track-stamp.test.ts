import { describe, it, expect } from 'vitest';
import { planStamps } from './track-stamp';

/** The unit travel direction a yaw encodes (forward = −z): direction = (−sin, −cos). */
function dirOf(yaw: number): { x: number; z: number } {
  return { x: -Math.sin(yaw), z: -Math.cos(yaw) };
}

describe('planStamps', () => {
  it('lays nothing until a full step has been travelled, keeping the anchor put to accumulate', () => {
    const plan = planStamps(0, 0, 0.4, 0, 1);
    expect(plan.stamps).toHaveLength(0);
    expect(plan.nextX).toBe(0); // anchor unchanged — the 0.4 carries into the next frame
    expect(plan.nextZ).toBe(0);
  });

  it('lays exactly one mark at one step and advances the anchor to it', () => {
    const plan = planStamps(0, 0, 1, 0, 1);
    expect(plan.stamps).toHaveLength(1);
    expect(plan.stamps[0]!.x).toBeCloseTo(1);
    expect(plan.stamps[0]!.z).toBeCloseTo(0);
    expect(plan.nextX).toBeCloseTo(1);
    expect(plan.nextZ).toBeCloseTo(0);
  });

  it('lays evenly-spaced marks across a long straight move (one per whole step)', () => {
    const plan = planStamps(0, 0, 3.2, 0, 1, 100); // floor(3.2 / 1) = 3 marks
    expect(plan.stamps).toHaveLength(3);
    expect(plan.stamps.map((s) => s.x)).toEqual([1, 2, 3].map((n) => expect.closeTo(n)));
    // The anchor stops at the last mark, so the 0.2 remainder carries forward (spacing stays even).
    expect(plan.nextX).toBeCloseTo(3);
  });

  it('orients each mark along the travel axis', () => {
    const plan = planStamps(0, 0, 2, 2, 1); // moving +x +z (a 45° diagonal)
    const dir = dirOf(plan.stamps[0]!.yaw);
    const inv = Math.SQRT1_2;
    expect(dir.x).toBeCloseTo(inv);
    expect(dir.z).toBeCloseTo(inv);
  });

  it('curves: each mark takes the direction of its own segment', () => {
    const along = planStamps(0, 0, 5, 0, 1, 100);
    expect(dirOf(along.stamps[0]!.yaw).x).toBeCloseTo(1); // travelling +x → marks point +x
    const turned = planStamps(5, 0, 5, 5, 1, 100);
    expect(dirOf(turned.stamps[0]!.yaw).z).toBeCloseTo(1); // now +z → the trail bends with the path
  });

  it('treats an implausibly large jump as a teleport: no streak, anchor snaps to the destination', () => {
    const plan = planStamps(0, 0, 50, 50, 1, 3); // a deploy/respawn reseat, not driving
    expect(plan.stamps).toHaveLength(0);
    expect(plan.nextX).toBe(50);
    expect(plan.nextZ).toBe(50);
  });
});
