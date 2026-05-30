import { World } from './core/world';
import { spawnRig } from './content/rig';
import { Transform } from './components/transform';
import { DriveControl } from './components/drive-control';
import { movementSystem } from './systems/movement';
import { createDriveInput } from './input/drive-input';
import { createCameraInput } from './input/camera-input';
import { RenderView } from './render/view';

/**
 * Composition root. The ONLY place that knows about all three layers at once: it wires
 * input → simulation → render together. Each layer stays ignorant of the others.
 */
const canvas = document.querySelector<HTMLCanvasElement>('#view')!;

const world = new World();
const player = spawnRig(world);

const input = createDriveInput();
const cameraInput = createCameraInput(canvas);
const view = new RenderView(canvas);

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.05); // clamp to avoid jumps on refocus
  last = now;

  // input → intent → the player's control component (the seam)
  const intent = input.poll();
  const ctl = world.get(player, DriveControl)!;
  ctl.throttle = intent.throttle;
  ctl.steer = intent.steer;

  // simulation (the source of truth)
  movementSystem(world, dt);

  // render (reads state; owns no truth)
  view.follow(world.get(player, Transform)!, cameraInput.poll(), dt);
  view.sync(world);
  view.animateWheels(world, dt);
  view.render();

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
