import { describe, it, expect } from 'vitest';
import { facingWithinFov } from './fov';

const FOV = (120 * Math.PI) / 180;

describe('facingWithinFov', () => {
  it('admits a target dead ahead (front is local −Z at yaw 0)', () => {
    // emitter at origin, yaw 0 → front points toward −Z; a target at −Z is straight ahead.
    expect(facingWithinFov(0, 0, 0, 0, -5, FOV)).toBe(true);
  });

  it('rejects a target behind the emitter', () => {
    expect(facingWithinFov(0, 0, 0, 0, 5, FOV)).toBe(false);
  });

  it('admits up to 60° off-axis and rejects beyond it (120° full FOV)', () => {
    // A target 59° off the −Z axis is inside; 61° is outside.
    const r = 5;
    const inAng = (59 * Math.PI) / 180;
    const outAng = (61 * Math.PI) / 180;
    // off-axis toward −Z: direction (−sin a, −cos a)
    expect(facingWithinFov(0, 0, 0, -Math.sin(inAng) * r, -Math.cos(inAng) * r, FOV)).toBe(true);
    expect(facingWithinFov(0, 0, 0, -Math.sin(outAng) * r, -Math.cos(outAng) * r, FOV)).toBe(false);
  });

  it('rotates the cone with the emitter yaw', () => {
    // Facing +X (yaw = −90° → front (−sin(−π/2),−cos(−π/2)) = (1, 0)); a target on +X is ahead, −X behind.
    const yaw = -Math.PI / 2;
    expect(facingWithinFov(0, 0, yaw, 5, 0, FOV)).toBe(true);
    expect(facingWithinFov(0, 0, yaw, -5, 0, FOV)).toBe(false);
  });
});
