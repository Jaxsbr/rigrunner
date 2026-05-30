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

// The workshop pad at the origin. Driving back onto it closes the loop by re-entering
// BUILD (Section F). The rig also homes here whenever it enters BUILD.
const PAD_RADIUS = 5;
const padDisc = new THREE.Mesh(
  new THREE.CircleGeometry(PAD_RADIUS, 48),
  new THREE.MeshStandardMaterial({ color: 0x243447, roughness: 0.9 }),
);
padDisc.rotation.x = -Math.PI / 2;
padDisc.position.y = 0.02;
scene.add(padDisc);
const padRing = new THREE.Mesh(
  new THREE.RingGeometry(PAD_RADIUS - 0.25, PAD_RADIUS, 48),
  new THREE.MeshBasicMaterial({ color: 0x3fa7c0, side: THREE.DoubleSide }),
);
padRing.rotation.x = -Math.PI / 2;
padRing.position.y = 0.03;
scene.add(padRing);

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
  // Inner fill indicator — a scrap-coloured block that grows upward as the
  // container fills (Section C). Anchored at the container floor.
  const fillMaxH = h - t;
  const fillMesh = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.78, fillMaxH, w * 0.78),
    new THREE.MeshStandardMaterial({ color: 0xc8a24a, roughness: 1 }),
  );
  fillMesh.scale.y = 0.0001;
  fillMesh.position.y = t;
  fillMesh.visible = false;
  g.add(fillMesh);
  g.userData.type = 'container';
  // Fill is a *view* of the shared cargo pool (see Section C), not its own state.
  g.userData.fillMesh = fillMesh;
  g.userData.fillBaseY = t;       // bottom of the cavity
  g.userData.fillMaxH = fillMaxH; // full-height of the fill block
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
const partFactories = [makeEngine, makeContainer, makeContainer, makeHarvester, makeGun];
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
const CARRY_TURN = 12;     // how fast a held part eases to its previewed orientation

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
  refreshCargo();   // container count may have changed → re-render the fill view
}

// Convert a world x/z into the rig's local DECK coordinates. The rig only yaws and
// translates (never pitches/rolls), so local x/z is all the slot math needs — and it
// stays correct no matter where the rig is or how it's rotated. This is the change
// that lets placement work in place and made the mode toggle unnecessary.
const _deck = new THREE.Vector3();
function worldToDeck(wx, wz) {
  rig.updateMatrixWorld();
  _deck.set(wx, 0, wz);
  rig.worldToLocal(_deck);
  return _deck;          // .x and .z are deck-local
}

// Nearest *empty* slot to a DECK-LOCAL x/z, within SNAP_DIST.
function nearestEmptySlot(lx, lz) {
  let best = null, bestD = SNAP_DIST;
  for (const slot of slots) {
    if (slot.occupant) continue;
    const d = Math.hypot(slot.x - lx, slot.z - lz);
    if (d < bestD) { bestD = d; best = slot; }
  }
  return best;
}

const halfChassis = chassisSize / 2;
function surfaceYAt(wx, wz) {
  // Shadow sits on the deck when the cursor is over the (possibly rotated) chassis,
  // otherwise on the floor — tested in deck-local space.
  const l = worldToDeck(wx, wz);
  const overDeck = Math.abs(l.x) <= halfChassis && Math.abs(l.z) <= halfChassis;
  return (overDeck ? CHASSIS_TOP : FLOOR_Y) + 0.02;
}

// Animate a part gliding from its current position+yaw to a target (used on drop).
// Yaw eases along the shortest angular path so orientation never snaps.
function glideTo(part, tx, ty, tz, toYaw, onDone) {
  const fromYaw = part.rotation.y;
  const delta = Math.atan2(Math.sin(toYaw - fromYaw), Math.cos(toYaw - fromYaw));
  part.userData.tween = {
    fromX: part.position.x, fromY: part.position.y, fromZ: part.position.z,
    toX: tx, toY: ty, toZ: tz,
    fromYaw, toYaw: fromYaw + delta, t: 0, onDone,
  };
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;         // left-click grabs a part; other buttons drive camera
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
  dragging.rotation.set(0, 0, 0);     // carry upright/aligned regardless of rig yaw
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

  const l = worldToDeck(part.position.x, part.position.z);
  const target = nearestEmptySlot(l.x, l.z);
  if (target) {
    // A.3 — reserve the slot, parent to the rig NOW (preserving world pose), then glide
    // into place in the rig's local frame so it aligns to the deck even when rotated.
    target.occupant = part;
    part.userData.slot = target;
    rig.attach(part);                  // become a rig child — rides along when driving
    // B.9-11 — a gun faces OUTWARD from the rig centre (front→forward, rear→back,
    // sides→outward); every other part just aligns to the deck. Computed in local space.
    let toYaw = 0;
    if (part.userData.type === 'gun') {
      const len = Math.hypot(target.x, target.z);
      const dx = len > 0.001 ? target.x / len : 0;
      const dz = len > 0.001 ? target.z / len : -1;   // centre slot → forward
      toYaw = Math.atan2(dx, dz);
    }
    glideTo(part, target.x, CHASSIS_TOP, target.z, toYaw, () => {
      part.position.set(target.x, CHASSIS_TOP, target.z);
      part.rotation.set(0, toYaw, 0);
    });
  } else {
    // A.4 — no empty slot in range: glide down to the floor (world space) where it is.
    glideTo(part, part.position.x, FLOOR_Y, part.position.z, 0, () => {
      part.rotation.set(0, 0, 0);
    });
  }
  refreshCargo();   // container count may have changed → re-render the fill view
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
// No modes: driving (WASD throttle + steer; Space fires every slotted gun in the
// direction it faces) is ALWAYS live, and parts can be (re)fitted at any time by
// dragging them. Placement is computed in the rig's LOCAL frame, so it stays correct
// wherever the rig is and however it's rotated — which is what lets the mode toggle
// and the rotation-resetting "home" step go away entirely.

const hud = document.createElement('div');
hud.style.cssText =
  'position:fixed;top:12px;left:12px;font:13px/1.5 monospace;color:#ddd;white-space:pre;' +
  'background:rgba(0,0,0,0.45);padding:8px 11px;border-radius:6px;pointer-events:none;';
document.body.appendChild(hud);
function updateHud() {
  const cargo = `Cargo: ${Math.round(scrapHeld)} / ${cargoCapacity()}`;
  const hull = `Hull: ${Math.round(rigHealth)}%`;
  hud.textContent =
    `WASD drive · Space fire · hold E harvest · R reset\n` +
    `drag parts to (re)fit anytime · the floor is safe — the pack waits past its edge\n${cargo}\n${hull}`;
}
// First HUD paint happens in refreshCargo() once the cargo model is defined (Section C).

// Driving feel (Section D will modulate these by weight; constant for now).
const ACCEL = 16, MAX_FWD = 12, MAX_REV = 6, FRICTION = 12, TURN = 2.3;
const TURN_FULL = 5;   // speed at which steering reaches full authority

// SECTION D — the weight tradeoff (checks 18-21), felt not displayed. Each non-engine
// part and each unit of cargo adds "load"; load scales down acceleration, top speed
// and turn authority. An engine-only rig has zero load (factor 1.0 = nippy).
const PART_MASS = { engine: 0, container: 1.0, harvester: 0.6, gun: 0.8 };
const CARGO_MASS_PER_UNIT = 0.015;   // a full 100-unit container ≈ 1.5 part-masses
const LOAD_K = 0.28;                 // how hard load bites
function loadFactor() {
  let extra = 0;
  for (const s of slots) if (s.occupant) extra += PART_MASS[s.occupant.userData.type] || 0;
  extra += scrapHeld * CARGO_MASS_PER_UNIT;
  return 1 / (1 + extra * LOAD_K);   // 1.0 = empty engine-only rig; smaller = heavier
}
const keys = Object.create(null);
let speed = 0;        // signed scalar: + forward, - reverse
let heading = 0;      // rig yaw in radians
let rigHealth = 100;  // hull integrity (Section E)
let rigFlash = 0;     // red damage flash, decays to 0

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

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === ' ') { e.preventDefault(); if (!e.repeat) fireAllGuns(); return; }
  if (k === 'r') { if (!e.repeat) resetRun(); return; }   // respawn nodes, empty cargo
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
  // SECTION D — load scales acceleration, top speed and turn authority down as the
  // rig gets heavier (parts + cargo). An engine-only rig drives at the full values.
  const lf = loadFactor();
  const accel = ACCEL * lf, maxFwd = MAX_FWD * lf, maxRev = MAX_REV * lf, turn = TURN * lf;

  // B.7/B.8 — propulsion only happens with an engine slotted; otherwise coast to rest.
  if (hasEngine()) {
    if (keys['w']) speed += accel * dt;
    else if (keys['s']) speed -= accel * dt;
    else speed -= Math.sign(speed) * Math.min(Math.abs(speed), FRICTION * dt);
    speed = Math.max(-maxRev, Math.min(maxFwd, speed));
  } else {
    speed -= Math.sign(speed) * Math.min(Math.abs(speed), FRICTION * dt);
  }

  // Steering authority ramps with speed (smoothstep) and shrinks with load, so a heavy
  // rig turns wider. Scales off |speed| so forward and reverse both steer.
  const steer = (keys['a'] ? 1 : 0) - (keys['d'] ? 1 : 0);
  if (steer !== 0) {
    const t = Math.min(Math.abs(speed) / TURN_FULL, 1);
    const authority = t * t * (3 - 2 * t);   // smoothstep 0→1
    heading += steer * turn * authority * dt;
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

    // B.24 — a projectile that reaches an enemy damages it.
    let hit = false;
    for (const en of enemies) {
      const ex = en.group.position.x - p.mesh.position.x;
      const ez = en.group.position.z - p.mesh.position.z;
      if (Math.hypot(ex, ez) < ENEMY_HIT_RADIUS) {
        hit = true;
        en.hp -= 1;
        en.flash = 1;
        if (en.hp <= 0) {
          scene.remove(en.group);
          enemies.splice(enemies.indexOf(en), 1);
        }
        break;
      }
    }

    if (hit || p.life <= 0) {
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
      projectiles.splice(i, 1);
    }
  }
}

// ---------------------------------------------------------------------------
// SECTION C — harvesting: the tactile transformation (checks 12-17).
// ---------------------------------------------------------------------------
//
// Drive a rig with a harvester arm up to a scrap node: the node visibly depletes
// and a slotted container visibly fills. Gates: no arm → nothing happens; no
// container → nothing is collected (the node won't deplete); full container →
// collection stops.

const HARVEST_RANGE = 4.5;   // how close the rig must get to a node
const HARVEST_RATE = 22;     // scrap moved per second
const CONTAINER_CAP = 100;   // how much a container holds

function firstOfType(type) {
  for (const s of slots) {
    if (s.occupant && s.occupant.userData.type === type) return s.occupant;
  }
  return null;
}

// Scrap nodes on the plane (B.12). Two sizes so the whole section is testable in
// one run: the small one drains fully (14); the big one fills the container to its
// cap with scrap to spare (17).
const nodes = [];
function makeScrapNode(x, z, amount) {
  const radius = 1.3;
  const mesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(radius, 0),
    new THREE.MeshStandardMaterial({ color: 0x8a7f6a, flatShading: true, roughness: 1 }),
  );
  mesh.position.set(x, radius * 0.85, z);
  scene.add(mesh);
  nodes.push({ mesh, amount, max: amount });
}
makeScrapNode(-9, -9, 60);    // small — drain to nothing (check 14)
makeScrapNode(10, 6, 120);    // large — fills a single container to cap (check 17),
                              // and 60+120 fits two containers so both fully drain

function updateNodeVisual(node) {
  const f = node.amount / node.max;               // shrink as it depletes
  node.mesh.scale.setScalar(Math.max(0.06, f));
  node.mesh.visible = node.amount > 0.001;
}

// Render a single container to a fill fraction (0..1). Purely a view.
function setContainerFillFrac(c, frac) {
  const fm = c.userData.fillMesh;
  fm.visible = frac > 0.001;
  fm.scale.y = Math.max(0.0001, frac);
  fm.position.y = c.userData.fillBaseY + (c.userData.fillMaxH * frac) / 2;
}

// A beam from the harvester to the node it's working — "the arm engages".
const harvestBeam = new THREE.Line(
  new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
  new THREE.LineBasicMaterial({ color: 0xffdd55 }),
);
harvestBeam.visible = false;
scene.add(harvestBeam);

// Harvesting is an explicit *held* command (hold E while in range). Release stops.
// (Left-click is now reserved for grabbing parts; see observation #5 for the rationale
// behind it being a held command rather than proximity auto-harvest.)
function slottedContainers() {
  return slots
    .filter((s) => s.occupant && s.occupant.userData.type === 'container')
    .map((s) => s.occupant);
}

// --- the cargo pool: ONE source of truth -----------------------------------
// All scrap the rig is carrying is a single number. Capacity is just how many
// containers are slotted. Containers are a *view* that fill in order from the pool.
// This is deliberately the dumbest possible model — the prototype's job is to prove
// the loop, not to build a real inventory system (that's Phase 2).
let scrapHeld = 0;
const cargoCapacity = () => slottedContainers().length * CONTAINER_CAP;

function renderCargo() {
  let rem = scrapHeld;
  for (const c of slottedContainers()) {      // slotted ones fill in order
    const f = Math.max(0, Math.min(CONTAINER_CAP, rem));
    setContainerFillFrac(c, f / CONTAINER_CAP);
    rem -= f;
  }
  for (const p of parts) {                     // loose containers read as empty
    if (p.userData.type === 'container' && !p.userData.slot) setContainerFillFrac(p, 0);
  }
}

function refreshCargo() { renderCargo(); updateHud(); }

function resetRun() {                          // sandbox affordance: make it re-testable
  scrapHeld = 0;
  rigHealth = 100;
  rigFlash = 0;
  for (const n of nodes) { n.amount = n.max; updateNodeVisual(n); }
  spawnEnemies();
  refreshCargo();
}

function updateHarvest(dt) {
  harvestBeam.visible = false;
  if (!keys['e']) return;                     // hold E to engage the harvester

  const harv = firstOfType('harvester');
  if (!harv) return;                          // 13 — no arm, no harvest
  const cap = cargoCapacity();
  if (cap === 0) return;                      // 16 — no container, nowhere to store it
  if (scrapHeld >= cap - 0.0001) return;      // 17 — cargo full

  // The first node in range that still has scrap.
  let node = null;
  for (const n of nodes) {
    if (n.amount <= 0) continue;
    const dx = n.mesh.position.x - rig.position.x;
    const dz = n.mesh.position.z - rig.position.z;
    if (Math.hypot(dx, dz) <= HARVEST_RANGE) { node = n; break; }
  }
  if (!node) return;

  // Move scrap node → pool. The pool's render fills containers in order (15),
  // so multiple containers fill one-by-one for free.
  const take = Math.min(HARVEST_RATE * dt, node.amount, cap - scrapHeld);
  node.amount -= take;                        // 14 — node shrinks
  scrapHeld += take;
  updateNodeVisual(node);
  refreshCargo();

  const from = harv.getWorldPosition(new THREE.Vector3());
  from.y += 1.4;
  harvestBeam.geometry.setFromPoints([from, node.mesh.position.clone()]);
  harvestBeam.visible = true;
}

refreshCargo();   // first paint, now that the cargo model + parts exist

// ---------------------------------------------------------------------------
// SECTION E — flee-or-fight (checks 22-25).
// ---------------------------------------------------------------------------
//
// A pack of enemies lurks beyond the edge of the large dark floor (the "platform").
// They only wake and chase once the rig DRIVES OFF the floor into the wilderness.
// Their speed sits BETWEEN a light rig's top speed and a heavy rig's, so the build
// decides the outcome: a light rig outruns them (23); a gunned rig fights them off
// (24); a heavy rig with no gun gets swarmed & damaged (25).

const ENEMY_SPEED = 9;        // between light (~10.3) and heavy (~8) rig top speeds
const ENEMY_HP = 3;           // projectile hits to kill one
const ENEMY_CATCH = 3.2;      // contact distance at which it damages the hull
const ENEMY_DPS = 22;         // hull damage/sec per touching enemy (swarm capped below)
const ENEMY_HIT_RADIUS = 1.4; // projectile hit test radius
const ENEMY_COUNT = 10;       // how many lurk in the pack
const ENEMY_RING = 30;        // how far out they spawn — beyond the dark floor's edge
const ENEMY_MAX_GANG = 3;     // cap on simultaneous attackers' damage, so a pile-up isn't instant death
const FLOOR_HALF = 20;        // the dark floor (the "platform") spans ±20 — PlaneGeometry(40,40)

const enemies = [];

function makeEnemyGroup() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xcc2222, flatShading: true, roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.95, 1.9, 5), mat);
  body.position.y = 0.95;
  g.add(body);
  const spike = new THREE.Mesh(
    new THREE.ConeGeometry(0.4, 0.9, 4),
    new THREE.MeshStandardMaterial({ color: 0x661111, flatShading: true }),
  );
  spike.position.y = 1.9;
  g.add(spike);
  g.userData.mat = mat;
  return g;
}

function spawnEnemies() {
  for (const en of enemies) scene.remove(en.group);
  enemies.length = 0;
  for (let i = 0; i < ENEMY_COUNT; i++) {
    const ang = (i / ENEMY_COUNT) * Math.PI * 2 + 0.3;   // ring them around the arena
    const g = makeEnemyGroup();
    g.position.set(Math.cos(ang) * ENEMY_RING, 0, Math.sin(ang) * ENEMY_RING);
    scene.add(g);
    enemies.push({ group: g, mat: g.userData.mat, hp: ENEMY_HP, flash: 0 });
  }
}

function damageRig(amount) {
  rigHealth = Math.max(0, rigHealth - amount);
  rigFlash = 1;
  updateHud();
}

// "On the platform" = anywhere on the large dark floor. The whole floor is the safe
// zone; the pack only wakes once the rig drives off the floor's edge.
function rigOnPlatform() {
  return Math.abs(rig.position.x) <= FLOOR_HALF && Math.abs(rig.position.z) <= FLOOR_HALF;
}

function updateEnemies(dt) {
  const safe = rigOnPlatform();     // on the floor → enemies idle (22: only attack off-floor)
  let touching = 0;
  for (const en of enemies) {
    if (!safe) {
      // B.22 — chase the rig.
      const dx = rig.position.x - en.group.position.x;
      const dz = rig.position.z - en.group.position.z;
      const d = Math.hypot(dx, dz) || 1;
      en.group.position.x += (dx / d) * ENEMY_SPEED * dt;
      en.group.position.z += (dz / d) * ENEMY_SPEED * dt;
      en.group.rotation.y = Math.atan2(dx, dz);   // face the rig
      if (d < ENEMY_CATCH) touching++;            // B.25 — caught
    }
    if (en.flash > 0) {                           // white-hot flash when shot
      en.flash = Math.max(0, en.flash - dt * 4);
      en.mat.emissive.setRGB(en.flash, en.flash * 0.3, 0);
    }
  }
  if (touching > 0) damageRig(ENEMY_DPS * Math.min(touching, ENEMY_MAX_GANG) * dt);
}

function updateRigFlash(dt) {
  if (rigFlash > 0) rigFlash = Math.max(0, rigFlash - dt * 3);
  chassis.material.emissive.setRGB(rigFlash * 0.6, 0, 0);
}

spawnEnemies();

function updateCarry(dt) {
  if (dragging) {
    // Rise animates; xz tracks the cursor immediately.
    liftT = Math.min(1, liftT + dt / LIFT_DUR);
    dragging.position.x = dragXZ.x;
    dragging.position.z = dragXZ.y;
    dragging.position.y = lerp(grabFromY, CARRY_Y, easeOut(liftT));

    // Shadow: a real shadow cast straight down from the part onto the surface
    // below it. The green *tile* highlight (separate) shows which cell will snap.
    const l = worldToDeck(dragXZ.x, dragXZ.y);
    const target = nearestEmptySlot(l.x, l.z);
    for (const slot of slots) setSlotHighlight(slot, slot === target);

    // Preview the resting orientation while still in the air: over a valid slot the
    // part eases to align with the (possibly rotated) deck — and a gun pre-aims to its
    // outward facing. Off the deck it eases back to its upright, world-aligned pose.
    let desiredYaw = 0;
    if (target) {
      let localYaw = 0;
      if (dragging.userData.type === 'gun') {
        const len = Math.hypot(target.x, target.z);
        const dx = len > 0.001 ? target.x / len : 0;
        const dz = len > 0.001 ? target.z / len : -1;   // centre slot → forward
        localYaw = Math.atan2(dx, dz);
      }
      desiredYaw = rig.rotation.y + localYaw;            // world yaw aligning with the deck
    }
    const curYaw = dragging.rotation.y;
    const dYaw = Math.atan2(Math.sin(desiredYaw - curYaw), Math.cos(desiredYaw - curYaw));
    dragging.rotation.y = curYaw + dYaw * Math.min(1, dt * CARRY_TURN);

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
    part.rotation.y = lerp(tw.fromYaw, tw.toYaw, e);
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
  updateHarvest(dt);
  updateEnemies(dt);
  updateRigFlash(dt);
  updateCamera(dt);
  renderer.render(scene, camera);
}
animate();
