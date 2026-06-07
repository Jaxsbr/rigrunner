import * as THREE from 'three';
import type { World } from '@core/world';
import type { EntityViews } from '@common/render/entity-views';
import { Part } from '@common/components/part';
import { Mount } from '@common/components/mount';

/**
 * The trap arm's sim-driven render: a gentle idle sway of the disarm head, so a mounted trap arm reads
 * as a live tool rather than a frozen prop (the way the Reclaimer idles with a slow yaw sweep). The head
 * rides the Boom's `socket_head` node — the same socket the shared assembler seats the Disarm Head on —
 * so rocking that node rocks the head about the arm tip.
 *
 * Pure view polish — it owns only the eased angle and mutates nothing in the sim (the disarm puzzle is
 * the whole gameplay; the arm's motion is cosmetic). The node is found by name within the composed trap
 * arm (cached once it loads); before the GLBs compose it simply no-ops. Dispatched from `main.ts`.
 */

const SWAY_SPEED = 1.6; // radians/s of the idle oscillation's phase
const SWAY_AMPLITUDE = 0.12; // radians — a small, calm rock

let elapsed = 0;

export function animateTrapArm(views: EntityViews, world: World, dt: number): void {
  elapsed += dt;
  for (const w of world.query(Part, Mount)) {
    if (world.get(w, Part)!.kind !== 'trap-arm') continue;
    const obj = views.get(w);
    if (!obj) continue;

    // Find + cache the head node (the Boom's socket the Disarm Head seats on) once the arm composes;
    // null until then (no-ops before the GLBs load).
    let head = obj.userData['disarmHead'] as THREE.Object3D | null | undefined;
    if (head === undefined || head === null) {
      head = obj.getObjectByName('socket_head') ?? null;
      if (head) obj.userData['disarmHead'] = head;
    }
    if (!head) continue;

    head.rotation.x = Math.sin(elapsed * SWAY_SPEED) * SWAY_AMPLITUDE;
  }
}
