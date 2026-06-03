import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { ReclaimerRig, isArticulated } from './articulation';

/**
 * A synthetic stand-in for the `reclaimer-arm` GLB: the parented chain of named handles the rig
 * drives, matching the contract in tools/blender/assets/reclaimer_arm.py. No GLB / WebGL needed —
 * THREE.Object3D is pure scene-graph maths, so the joint driver is testable in isolation.
 */
function makeArm(): THREE.Object3D {
  const base = new THREE.Object3D();
  base.name = 'reclaimer-arm';
  const yaw = new THREE.Object3D();
  yaw.name = 'joint_yaw';
  const boom = new THREE.Object3D();
  boom.name = 'joint_boom';
  const wrist = new THREE.Object3D();
  wrist.name = 'joint_wrist';
  const socket = new THREE.Object3D();
  socket.name = 'socket_wrist';
  base.add(yaw);
  yaw.add(boom);
  boom.add(wrist);
  wrist.add(socket);
  return base;
}

const makeBucket = (): THREE.Object3D => {
  const b = new THREE.Object3D();
  b.name = 'reclaimer-bucket';
  return b;
};

describe('isArticulated', () => {
  it('recognises the arm and nothing else', () => {
    expect(isArticulated('reclaimer-arm')).toBe(true);
    expect(isArticulated('reclaimer-bucket')).toBe(false);
    expect(isArticulated('rig')).toBe(false);
  });
});

describe('ReclaimerRig', () => {
  it('parents the bucket onto the wrist socket so it rides the arm', () => {
    const arm = makeArm();
    const bucket = makeBucket();
    new ReclaimerRig(arm, bucket);
    expect(arm.getObjectByName('socket_wrist')!.children).toContain(bucket);
  });

  it('falls back to the arm root when the socket node is missing', () => {
    const arm = makeArm();
    arm.getObjectByName('socket_wrist')!.removeFromParent();
    arm.getObjectByName('joint_wrist')!.removeFromParent(); // drop the fallback too
    const bucket = makeBucket();
    new ReclaimerRig(arm, bucket);
    expect(arm.children).toContain(bucket);
  });

  it('idle holds the stow pose and sways the yaw within its sweep', () => {
    const arm = makeArm();
    const rig = new ReclaimerRig(arm, makeBucket());
    const boom = arm.getObjectByName('joint_boom')!;
    const wrist = arm.getObjectByName('joint_wrist')!;
    const yaw = arm.getObjectByName('joint_yaw')!;

    // At t=0 the sway is zero; boom/wrist sit at their stow values.
    rig.idle(0);
    expect(boom.rotation.x).toBeCloseTo(1.0, 5); // stow boom
    expect(wrist.rotation.x).toBeCloseTo(-0.45, 5); // stow wrist
    expect(yaw.rotation.y).toBeCloseTo(0, 5);

    // Across many samples the yaw stays a small bounded sway and the stow pose never drifts.
    for (let i = 0; i < 50; i++) {
      rig.idle(i * 0.37);
      expect(Math.abs(yaw.rotation.y)).toBeLessThanOrEqual(0.12 + 1e-9);
      expect(boom.rotation.x).toBeCloseTo(1.0, 5);
    }
  });

  it('dig swings the boom between its rest and deepest-scoop poses', () => {
    const arm = makeArm();
    const rig = new ReclaimerRig(arm, makeBucket());
    const boom = arm.getObjectByName('joint_boom')!;

    // t=0 is the top of the cycle (rest); a quarter period later it bottoms out at the dig pose.
    rig.dig(0);
    expect(boom.rotation.x).toBeCloseTo(0.12, 5); // rest boom
    rig.dig(2.6 / 2); // half a period → deepest scoop
    expect(boom.rotation.x).toBeCloseTo(-0.62, 5); // dig boom

    // The whole cycle stays within [dig, rest].
    for (let i = 0; i < 60; i++) {
      rig.dig(i * 0.1);
      expect(boom.rotation.x).toBeGreaterThanOrEqual(-0.62 - 1e-9);
      expect(boom.rotation.x).toBeLessThanOrEqual(0.12 + 1e-9);
    }
  });

  it('drive at deploy 0 matches the stowed idle pose', () => {
    const arm = makeArm();
    const rig = new ReclaimerRig(arm, makeBucket());
    const boom = arm.getObjectByName('joint_boom')!;
    const wrist = arm.getObjectByName('joint_wrist')!;
    rig.drive(0, 0); // fully stowed
    expect(boom.rotation.x).toBeCloseTo(1.0, 5);   // stow boom
    expect(wrist.rotation.x).toBeCloseTo(-0.45, 5); // stow wrist
  });

  it('drive at deploy 1 matches the live dig cycle', () => {
    const arm = makeArm();
    const rig = new ReclaimerRig(arm, makeBucket());
    const boom = arm.getObjectByName('joint_boom')!;
    rig.drive(0, 1); // fully deployed, top of the cycle
    expect(boom.rotation.x).toBeCloseTo(0.12, 5);   // rest boom
    rig.drive(2.6 / 2, 1); // half a period → deepest scoop
    expect(boom.rotation.x).toBeCloseTo(-0.62, 5);  // dig boom
  });

  it('drive mid-deploy sits between stow and the dig cycle', () => {
    const arm = makeArm();
    const rig = new ReclaimerRig(arm, makeBucket());
    const boom = arm.getObjectByName('joint_boom')!;
    rig.drive(0, 0.5); // halfway out of stow toward the rest pose
    // boom blends stow(1.0) → rest(0.12) at t=0 → midpoint 0.56.
    expect(boom.rotation.x).toBeCloseTo((1.0 + 0.12) / 2, 5);
  });

  it('stow snaps to the static pose with no yaw offset', () => {
    const arm = makeArm();
    const rig = new ReclaimerRig(arm, makeBucket());
    rig.idle(1.23); // leave a yaw offset behind…
    rig.stow();
    expect(arm.getObjectByName('joint_yaw')!.rotation.y).toBe(0);
    expect(arm.getObjectByName('joint_boom')!.rotation.x).toBeCloseTo(1.0, 5);
  });
});
