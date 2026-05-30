// RIGRUNNER — prototype.
//
// Throwaway proof of concept. Built incrementally against ../docs/prototype-spec.md
// (the 28 checks). Optimize for *feeling whether the loop is fun*, not architecture.
//
// Progress:
//   Section A (build bay, checks 1-6): chassis + slot grid, four parts, drag/snap,
//   lift-out, one-per-slot, live silhouette.  <-- DONE
//
// Slotted parts are parented to `rig` (a group holding the chassis) so that when
// Section B adds driving, the whole rig moves as one body for free.

import * as THREE from 'three';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a);

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
camera.position.set(9, 11, 13);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// Lighting
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const sun = new THREE.DirectionalLight(0xffffff, 0.9);
sun.position.set(5, 10, 7);
scene.add(sun);

// The arena — flat plane + grid.
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 40),
  new THREE.MeshStandardMaterial({ color: 0x2b2b2b }),
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
scene.add(new THREE.GridHelper(40, 40, 0x444444, 0x333333));

// ---------------------------------------------------------------------------
// A.1 — the chassis + a visible grid of empty slots.
// ---------------------------------------------------------------------------

const CELL = 2;            // size of one slot cell
const GRID = 3;            // 3x3 grid of slots
const CHASSIS_TOP = 0.4;   // local y of the chassis deck (where parts sit)

// `rig` holds the chassis and any slotted parts. In the build bay it sits at the
// origin; Section B will drive it around and the slotted parts ride along.
const rig = new THREE.Group();
scene.add(rig);

const chassisSize = GRID * CELL + 0.4;
const chassis = new THREE.Mesh(
  new THREE.BoxGeometry(chassisSize, CHASSIS_TOP, chassisSize),
  new THREE.MeshStandardMaterial({ color: 0x555560 }),
);
chassis.position.y = CHASSIS_TOP / 2;
rig.add(chassis);

// Build the slot cells. Each slot has a local x/z on the deck, an occupant, and a
// little outline marker that highlights while dragging.
const slots = [];
const slotMarkers = new THREE.Group();
rig.add(slotMarkers);

for (let gx = 0; gx < GRID; gx++) {
  for (let gz = 0; gz < GRID; gz++) {
    const x = (gx - (GRID - 1) / 2) * CELL;
    const z = (gz - (GRID - 1) / 2) * CELL;

    const marker = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.PlaneGeometry(CELL * 0.92, CELL * 0.92)),
      new THREE.LineBasicMaterial({ color: 0x888888 }),
    );
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(x, CHASSIS_TOP + 0.01, z);
    slotMarkers.add(marker);

    slots.push({ x, z, occupant: null, marker });
  }
}

function setSlotHighlight(slot, on) {
  slot.marker.material.color.setHex(on ? 0x33ff88 : 0x888888);
}

// ---------------------------------------------------------------------------
// A.2 — four loose, distinguishable parts on the floor.
// ---------------------------------------------------------------------------
//
// Each part is a Group whose local origin is at its *base center* (bottom on y=0),
// so we can drop it on the floor (base at y=0) or on the deck (base at CHASSIS_TOP).

function makeEngine() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 1.0, 1.4),
    new THREE.MeshStandardMaterial({ color: 0xcc4422 }),
  );
  body.position.y = 0.5;
  g.add(body);
  // exhaust stacks so it reads as "engine"
  for (const dx of [-0.35, 0.35]) {
    const stack = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 0.7, 8),
      new THREE.MeshStandardMaterial({ color: 0x333333 }),
    );
    stack.position.set(dx, 1.3, -0.4);
    g.add(stack);
  }
  g.userData.type = 'engine';
  return g;
}

function makeContainer() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x3366cc });
  // four walls + floor, open top, so "fill" can be shown later (Section C)
  const w = 1.5, h = 1.4, t = 0.12;
  const floor = new THREE.Mesh(new THREE.BoxGeometry(w, t, w), mat);
  floor.position.y = t / 2;
  g.add(floor);
  for (const [ox, oz, sx, sz] of [
    [ w / 2, 0, t, w], [-w / 2, 0, t, w],
    [0,  w / 2, w, t], [0, -w / 2, w, t],
  ]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(sx, h, sz), mat);
    wall.position.set(ox, h / 2, oz);
    g.add(wall);
  }
  g.userData.type = 'container';
  return g;
}

function makeHarvester() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xccaa22 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.4, 1.0), mat);
  base.position.y = 0.2;
  g.add(base);
  // an angled arm reaching up and forward
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.6, 0.25), mat);
  arm.position.set(0, 0.9, 0.2);
  arm.rotation.x = -0.5;
  g.add(arm);
  const claw = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.2, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x886611 }),
  );
  claw.position.set(0, 1.55, 0.85);
  g.add(claw);
  g.userData.type = 'harvester';
  return g;
}

function makeGun() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x666666 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.7, 1.0), mat);
  body.position.y = 0.45;
  g.add(body);
  // barrel points +z = the part's local "forward"; Section B uses this for fire dir
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.14, 1.4, 10),
    new THREE.MeshStandardMaterial({ color: 0x222222 }),
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.6, 0.8);
  g.add(barrel);
  g.userData.type = 'gun';
  return g;
}

// Spawn the four parts on the floor in front of the chassis.
const FLOOR_Y = 0;
const partFactories = [makeEngine, makeContainer, makeHarvester, makeGun];
const parts = [];
partFactories.forEach((make, i) => {
  const part = make();
  const x = (i - (partFactories.length - 1) / 2) * 2.6;
  part.position.set(x, FLOOR_Y, 6.5);   // home spot on the floor
  part.userData.slot = null;            // which slot it occupies, or null
  scene.add(part);
  parts.push(part);
});

// ---------------------------------------------------------------------------
// A.3-A.6 — grab / drag / snap, lift-out, one-per-slot, live silhouette.
// ---------------------------------------------------------------------------

const CARRY_Y = 1.0;       // base height a part rides at while carried (lower = grounded feel)
const SNAP_DIST = 1.4;     // how close (in deck space) a drop must be to snap
const LIFT_DUR = 0.14;     // seconds — animated rise when grabbed
const DROP_DUR = 0.18;     // seconds — animated glide when released

const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const lerp = (a, b, t) => a + (b - a) * t;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
// The drag plane lives at the part's carried height so the cursor maps to xz there.
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -CARRY_Y);
const hitPoint = new THREE.Vector3();
const clock = new THREE.Clock();

// --- carry state -----------------------------------------------------------
let dragging = null;       // the part group currently held
const dragXZ = new THREE.Vector2();   // desired xz from the cursor
let liftT = 0;             // 0..1 progress of the grab rise
let grabFromY = 0;         // y the part started rising from

renderer.domElement.style.cursor = 'default';

// --- the carry shadow: a soft disc under the held part, on whatever surface it's
// over, that magnetizes onto the target tile so it's obvious where it'll land. ---
const shadow = new THREE.Mesh(
  new THREE.CircleGeometry(0.85, 24),
  new THREE.MeshBasicMaterial({
    color: 0x000000, transparent: true, opacity: 0.35,
    depthWrite: false,
  }),
);
shadow.rotation.x = -Math.PI / 2;
shadow.visible = false;
shadow.renderOrder = 1;
scene.add(shadow);

function updatePointer(e) {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
}

function freeSlot(part) {
  if (part.userData.slot) {
    part.userData.slot.occupant = null;
    part.userData.slot = null;
  }
}

// Find the nearest *empty* slot to a world x/z, within SNAP_DIST. Because the rig
// sits at the origin in the build bay, world x/z == deck-local x/z here.
function nearestEmptySlot(wx, wz) {
  let best = null, bestD = SNAP_DIST;
  for (const slot of slots) {
    if (slot.occupant) continue;
    const d = Math.hypot(slot.x - wx, slot.z - wz);
    if (d < bestD) { bestD = d; best = slot; }
  }
  return best;
}

const halfChassis = chassisSize / 2;
function surfaceYAt(x, z) {
  // The shadow sits on the deck when over the chassis, otherwise on the floor.
  const overDeck = Math.abs(x) <= halfChassis && Math.abs(z) <= halfChassis;
  return (overDeck ? CHASSIS_TOP : FLOOR_Y) + 0.02;
}

// Animate a part gliding from its current position to a target (used on drop).
function glideTo(part, tx, ty, tz, onDone) {
  part.userData.tween = {
    fromX: part.position.x, fromY: part.position.y, fromZ: part.position.z,
    toX: tx, toY: ty, toZ: tz, t: 0, onDone,
  };
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || mode !== 'build' || rigHome) return;   // grabbing is a left-click BUILD action
  updatePointer(e);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(parts, true);
  if (!hits.length) return;

  // Walk up to the part Group we registered.
  let obj = hits[0].object;
  while (obj && !parts.includes(obj)) obj = obj.parent;
  if (!obj) return;

  dragging = obj;
  dragging.userData.tween = null;     // cancel any in-flight drop glide
  freeSlot(dragging);                 // A.4 — lifting a slotted part frees its slot
  scene.attach(dragging);             // live in world space while carried
  dragXZ.set(dragging.position.x, dragging.position.z);
  grabFromY = dragging.position.y;    // rise animates from wherever it sat
  liftT = 0;
  shadow.visible = true;
  renderer.domElement.style.cursor = 'grabbing';
});

renderer.domElement.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  updatePointer(e);
  raycaster.setFromCamera(pointer, camera);
  if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
    dragXZ.set(hitPoint.x, hitPoint.z);   // y is driven by the lift animation
  }
});

renderer.domElement.addEventListener('pointerup', () => {
  if (!dragging) return;
  const part = dragging;
  dragging = null;
  shadow.visible = false;
  renderer.domElement.style.cursor = 'default';
  for (const slot of slots) setSlotHighlight(slot, false);

  const target = nearestEmptySlot(part.position.x, part.position.z);
  if (target) {
    // A.3 — reserve the slot now, then glide into it and parent to the rig on arrival.
    target.occupant = part;
    part.userData.slot = target;
    glideTo(part, target.x, CHASSIS_TOP, target.z, () => {
      rig.add(part);                   // parented to the rig — rides along when driving
      part.position.set(target.x, CHASSIS_TOP, target.z);
      part.rotation.set(0, 0, 0);
      // B.9-11 — a gun faces OUTWARD from the rig centre, so placement = fire
      // direction: front→forward, rear→back, left/right→outward to the sides.
      if (part.userData.type === 'gun') {
        const len = Math.hypot(target.x, target.z);
        const dx = len > 0.001 ? target.x / len : 0;
        const dz = len > 0.001 ? target.z / len : -1;   // centre slot → forward
        part.rotation.y = Math.atan2(dx, dz);
      }
    });
  } else {
    // A.4 — no empty slot in range: glide down to the floor where it is.
    glideTo(part, part.position.x, FLOOR_Y, part.position.z, () => {
      part.rotation.set(0, 0, 0);
    });
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------------------
// SECTION B — driving & directionality (checks 7-11).
// ---------------------------------------------------------------------------
//
// Two modes: BUILD (drag parts; rig parked at the origin) and DRIVE (WASD throttle
// + steer; Space fires every slotted gun in the direction it faces). Tab toggles.
// Entering BUILD homes the rig back to the workshop origin so the build-bay drag
// math (world xz == deck-local xz) stays valid — a stand-in for Section F's pad.

let mode = 'build';

const hud = document.createElement('div');
hud.style.cssText =
  'position:fixed;top:12px;left:12px;font:13px/1.5 monospace;color:#ddd;white-space:pre;' +
  'background:rgba(0,0,0,0.45);padding:8px 11px;border-radius:6px;pointer-events:none;';
document.body.appendChild(hud);
function updateHud() {
  hud.textContent = mode === 'build'
    ? 'MODE: BUILD\ndrag parts to (re)fit\nTab → drive'
    : 'MODE: DRIVE\nWASD move · Space fire\nTab → build';
}
updateHud();

// Driving feel (Section D will modulate these by weight; constant for now).
const ACCEL = 16, MAX_FWD = 12, MAX_REV = 6, FRICTION = 12, TURN = 2.3;
const TURN_FULL = 5;   // speed at which steering reaches full authority
const keys = Object.create(null);
let speed = 0;        // signed scalar: + forward, - reverse
let heading = 0;      // rig yaw in radians
let rigHome = null;   // homing tween used when returning to BUILD

// Camera: fixed azimuth, but adjustable zoom (out only) and pitch, both eased toward
// targets so motion is smooth. The starting offset defines the *closest* view.
const baseOffset = new THREE.Vector3(9, 11, 13);
const camRadius0 = baseOffset.length();
const camHoriz = new THREE.Vector2(baseOffset.x, baseOffset.z).normalize();
const camPitch0 = Math.asin(baseOffset.y / camRadius0);
const CAM_RADIUS_MAX = camRadius0 * 1.8;   // zoom out only — never closer than default
const CAM_PITCH_MAX = camPitch0 + 0.42;    // tilt a bit more overhead, never top-down
let camRadius = camRadius0, camRadiusTarget = camRadius0;
let camPitch = camPitch0, camPitchTarget = camPitch0;

function hasEngine() {
  return slots.some((s) => s.occupant && s.occupant.userData.type === 'engine');
}

function setMode(next) {
  mode = next;
  updateHud();
  if (mode === 'build') {
    speed = 0;
    for (const k in keys) keys[k] = false;
    const yaw = Math.atan2(Math.sin(heading), Math.cos(heading)); // shortest path to 0
    rigHome = { fromX: rig.position.x, fromZ: rig.position.z, fromYaw: yaw, t: 0 };
  }
}

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'tab') { e.preventDefault(); setMode(mode === 'build' ? 'drive' : 'build'); return; }
  if (mode !== 'drive') return;
  if (k === ' ') { if (!e.repeat) fireAllGuns(); return; }
  keys[k] = true;
});
window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

// Wheel zooms OUT only (default distance is the floor). Middle-drag tilts the pitch.
renderer.domElement.addEventListener('wheel', (e) => {
  e.preventDefault();
  camRadiusTarget = Math.max(camRadius0, Math.min(CAM_RADIUS_MAX, camRadiusTarget + e.deltaY * 0.02));
}, { passive: false });

let tilting = false;
renderer.domElement.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); }); // no autoscroll
renderer.domElement.addEventListener('pointerdown', (e) => { if (e.button === 1) tilting = true; });
window.addEventListener('pointermove', (e) => {
  if (!tilting) return;
  camPitchTarget = Math.max(camPitch0, Math.min(CAM_PITCH_MAX, camPitchTarget - e.movementY * 0.004));
});
window.addEventListener('pointerup', (e) => { if (e.button === 1) tilting = false; });

function updateCamera(dt) {
  const k = Math.min(1, dt * 8);   // eased smoothing toward targets
  camRadius += (camRadiusTarget - camRadius) * k;
  camPitch += (camPitchTarget - camPitch) * k;
  const cp = Math.cos(camPitch), sp = Math.sin(camPitch);
  camera.position.set(
    rig.position.x + camHoriz.x * cp * camRadius,
    rig.position.y + sp * camRadius,
    rig.position.z + camHoriz.y * cp * camRadius,
  );
  camera.lookAt(rig.position);
}

function updateDriving(dt) {
  // Homing back to the workshop origin when entering BUILD.
  if (rigHome) {
    rigHome.t = Math.min(1, rigHome.t + dt / 0.4);
    const e = easeOut(rigHome.t);
    rig.position.x = lerp(rigHome.fromX, 0, e);
    rig.position.z = lerp(rigHome.fromZ, 0, e);
    heading = lerp(rigHome.fromYaw, 0, e);
    rig.rotation.y = heading;
    if (rigHome.t >= 1) { rigHome = null; rig.position.set(0, 0, 0); heading = 0; }
    return;
  }
  if (mode !== 'drive') return;

  // B.7/B.8 — propulsion only happens with an engine slotted; otherwise coast to rest.
  if (hasEngine()) {
    if (keys['w']) speed += ACCEL * dt;
    else if (keys['s']) speed -= ACCEL * dt;
    else speed -= Math.sign(speed) * Math.min(Math.abs(speed), FRICTION * dt);
    speed = Math.max(-MAX_REV, Math.min(MAX_FWD, speed));
  } else {
    speed -= Math.sign(speed) * Math.min(Math.abs(speed), FRICTION * dt);
  }

  // Steering authority ramps with speed (smoothstep), so it fades in/out smoothly
  // instead of snapping full-lock at a crawl then cutting dead at a stop. Scales off
  // |speed| so forward and reverse both steer. Sharp-at-speed is preserved.
  const steer = (keys['a'] ? 1 : 0) - (keys['d'] ? 1 : 0);
  if (steer !== 0) {
    const t = Math.min(Math.abs(speed) / TURN_FULL, 1);
    const authority = t * t * (3 - 2 * t);   // smoothstep 0→1
    heading += steer * TURN * authority * dt;
    rig.rotation.y = heading;
  }

  // Advance along the rig's forward (local -z) by the current speed.
  rig.position.x += -Math.sin(heading) * speed * dt;
  rig.position.z += -Math.cos(heading) * speed * dt;
}

// --- guns & projectiles (B.9-11) -------------------------------------------
const projectiles = [];
const PROJ_SPEED = 26, PROJ_LIFE = 1.6;
const _q = new THREE.Quaternion();

function fireAllGuns() {
  for (const s of slots) {
    const part = s.occupant;
    if (!part || part.userData.type !== 'gun') continue;
    // Barrel forward is local +z; read it in world space so it respects both the
    // gun's slot facing AND the rig's current heading.
    part.getWorldQuaternion(_q);
    const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(_q).normalize();
    const muzzle = part.getWorldPosition(new THREE.Vector3());
    muzzle.y += 0.6;
    muzzle.addScaledVector(dir, 1.2);

    const proj = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xffdd55, emissive: 0x886600 }),
    );
    proj.position.copy(muzzle);
    scene.add(proj);
    projectiles.push({ mesh: proj, dir, life: PROJ_LIFE });
  }
}

function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.mesh.position.addScaledVector(p.dir, PROJ_SPEED * dt);
    p.life -= dt;
    if (p.life <= 0) {
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
      projectiles.splice(i, 1);
    }
  }
}

function updateCarry(dt) {
  if (dragging) {
    // Rise animates; xz tracks the cursor immediately.
    liftT = Math.min(1, liftT + dt / LIFT_DUR);
    dragging.position.x = dragXZ.x;
    dragging.position.z = dragXZ.y;
    dragging.position.y = lerp(grabFromY, CARRY_Y, easeOut(liftT));

    // Shadow: a real shadow cast straight down from the part onto the surface
    // below it. The green *tile* highlight (separate) shows which cell will snap.
    const target = nearestEmptySlot(dragXZ.x, dragXZ.y);
    for (const slot of slots) setSlotHighlight(slot, slot === target);
    shadow.position.set(dragXZ.x, surfaceYAt(dragXZ.x, dragXZ.y), dragXZ.y);
    // Tighter/darker as the part nears the surface would be nicer still, but the
    // part rides at a constant carry height, so a steady soft disc reads fine.
  }

  // Advance any drop glides.
  for (const part of parts) {
    const tw = part.userData.tween;
    if (!tw) continue;
    tw.t = Math.min(1, tw.t + dt / DROP_DUR);
    const e = easeOut(tw.t);
    part.position.set(
      lerp(tw.fromX, tw.toX, e),
      lerp(tw.fromY, tw.toY, e),
      lerp(tw.fromZ, tw.toZ, e),
    );
    if (tw.t >= 1) {
      part.userData.tween = null;
      if (tw.onDone) tw.onDone();
    }
  }
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);   // clamp to avoid jumps on refocus
  updateCarry(dt);
  updateDriving(dt);
  updateProjectiles(dt);
  updateCamera(dt);
  renderer.render(scene, camera);
}
animate();
