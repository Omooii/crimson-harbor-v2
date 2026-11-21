// Vehicles: the car mesh factory, traffic loops, parked cars, and the
// player car's driving physics (steer, brake, handbrake, condition).
import { G, player, rng } from './state.js';
import { clamp, dist, pick, wrapAngle } from './utils.js';
import { collideCircle, groundHeightAt } from './world.js';

export const MODELS = [
  { name: 'Vortex GT', color: 0xd21f2b, sporty: true },
  { name: 'Comet Coupe', color: 0xf5b301, sporty: false },
  { name: 'Sunset Sedan', color: 0x2b6fd6, sporty: false },
];

let sceneRef = null;
const bodyGeo = new THREE.BoxGeometry(2, 0.75, 4.4);
const cabinGeo = new THREE.BoxGeometry(1.7, 0.65, 2.1);
const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
const lightGeo = new THREE.BoxGeometry(0.4, 0.22, 0.1);

export function makeCarMesh(model, police = false) {
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: police ? 0xf2f2f2 : model.color });
  const body = new THREE.Mesh(bodyGeo, paint);
  body.position.y = 0.62; g.add(body);
  if (police) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.3, 4.42), new THREE.MeshLambertMaterial({ color: 0x1a2a44 }));
    stripe.position.y = 0.62; g.add(stripe);
  }
  const cabin = new THREE.Mesh(cabinGeo, new THREE.MeshLambertMaterial({ color: 0x18222e }));
  cabin.position.set(0, 1.28, -0.2); g.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 2.1), paint);
  roof.position.set(0, 1.62, -0.2); g.add(roof);
  if (model.sporty) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.1, 0.5), paint);
    wing.position.set(0, 1.15, -2.05); g.add(wing);
  }
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(wx, 0.38, wz); g.add(w); wheels.push(w);
  }
  const hl = new THREE.MeshBasicMaterial({ color: 0xfff6c0 });
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(lightGeo, hl); h.position.set(s * 0.65, 0.66, 2.21); g.add(h);
  }
  let barL = null, barR = null;
  if (police) {
    barL = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    barL.position.set(-0.4, 1.75, -0.2); g.add(barL);
    barR = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    barR.position.set(0.4, 1.75, -0.2); g.add(barR);
  }
  g.userData = { wheels, barL, barR };
  return g;
}

const LOOPS = [
  [[20, 20], [80, 20], [80, 80], [20, 80]],
  [[20, -40], [140, -40], [140, 20], [20, 20]],
  [[-50, 80], [80, 80], [80, 140], [-50, 140]],
  [[-50, -40], [-20, -40], [-20, 140], [-50, 140]],
];

export function spawnTraffic(scene) {
  sceneRef = scene;
  for (let li = 0; li < LOOPS.length; li++) {
    for (let k = 0; k < 3; k++) {
      const model = pick(rng, MODELS);
      const loop = LOOPS[li];
      const wp = Math.floor(rng() * loop.length);
      const [x, z] = loop[wp];
      const car = {
        x: x + (rng() - 0.5) * 2, z: z + (rng() - 0.5) * 2, heading: 0, speed: 9 + rng() * 3,
        loop, wp: (wp + 1) % loop.length, model, condition: 100, group: makeCarMesh(model),
        side: k % 2 ? 1 : -1, blockT: 0,
      };
      car.group.position.set(car.x, 0, car.z);
      scene.add(car.group);
      G.cars.push(car);
    }
  }
}

const PARKED_SPOTS = [
  { x: 24, z: 104, h: 0.15, model: 0, mine: true },   // Rook's Vortex GT (mission 1)
  { x: 16, z: 60, h: 3.1, model: 1, mine: false },
  { x: 84, z: 44, h: 0.1, model: 2, mine: false },
  { x: -46, z: 120, h: 0.05, model: 0, mine: false },
  { x: 24, z: -20, h: 3.2, model: 2, mine: false },
  { x: 144, z: 100, h: 0.1, model: 1, mine: false },
  { x: 76, z: 144, h: 1.6, model: 0, mine: false },
  { x: 136, z: -36, h: 1.55, model: 2, mine: false },
];

export function spawnParked(scene) {
  for (const s of PARKED_SPOTS) {
    const model = MODELS[s.model];
    const car = {
      x: s.x, z: s.z, heading: s.h, speed: 0, model, condition: 100,
      mine: s.mine, parked: true, group: makeCarMesh(model),
    };
    car.group.position.set(car.x, 0, car.z);
    car.group.rotation.y = car.heading;
    scene.add(car.group);
    G.parked.push(car);
  }
}

function syncCarMesh(car) {
  car.group.position.set(car.x, groundHeightAt(car.x, car.z), car.z);
  car.group.rotation.y = car.heading;
  const spin = car.speed * 0.06;
  for (const w of car.group.userData.wheels) w.rotation.x += spin;
}

export function updateTraffic(dt) {
  for (const c of G.cars) {
    let [tx, tz] = c.loop[c.wp];
    // Blocked for a while? Pull around the obstacle instead of waiting forever.
    if (c.blockT > 1.5) {
      tx += Math.cos(c.heading) * c.side * 5;
      tz += -Math.sin(c.heading) * c.side * 5;
    }
    const d = dist(c.x, c.z, tx, tz);
    if (d < 6) { c.wp = (c.wp + 1) % c.loop.length; continue; }
    const want = Math.atan2(tx - c.x, tz - c.z);
    c.heading += clamp(wrapAngle(want - c.heading), -1.4 * dt, 1.4 * dt);
    // Brake for the player's car ahead.
    let target = c.speed;
    let blocked = false;
    if (player.inCar && player.car) {
      const pd = dist(c.x, c.z, player.car.x, player.car.z);
      const ahead = Math.cos(wrapAngle(Math.atan2(player.car.x - c.x, player.car.z - c.z) - c.heading));
      if (pd < 9 && ahead > 0.5) { target = c.blockT > 1.5 ? 6 : 0; blocked = true; }
    }
    c.blockT = blocked ? c.blockT + dt : Math.max(0, c.blockT - dt * 0.5);
    c.speed += clamp(target - c.speed, -14 * dt, 6 * dt);
    c.x += Math.sin(c.heading) * c.speed * dt;
    c.z += Math.cos(c.heading) * c.speed * dt;
    syncCarMesh(c);
  }
}

// Player driving: arcade physics with a speed cap, handbrake and damage.
export function updatePlayerCar(dt, input) {
  const car = player.car;
  if (!car) return;
  const top = (G.boostT > 0 ? 62 : 44) * (car.condition <= 0 ? 0.25 : 1);
  const accel = G.boostT > 0 ? 20 : 14;
  if (input.handbrake) {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 30 * dt);
  } else if (input.forward) {
    car.speed += accel * dt;
  } else if (input.back) {
    car.speed -= (car.speed > 0.5 ? 26 : 10) * dt;
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 4 * dt);
  }
  car.speed = clamp(car.speed, -12, top);
  const spd = Math.abs(car.speed);
  const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  if (steer !== 0 && spd > 0.1) {
    const rate = 1.7 * clamp(1.15 - spd / 70, 0.35, 1.15);
    car.heading += steer * rate * dt * Math.sign(car.speed);
  }
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  const [rx, rz] = collideCircle(nx, nz, 2.1);
  const hitWall = Math.hypot(rx - nx, rz - nz) > 0.05;
  car.x = rx; car.z = rz;
  if (hitWall && spd > 4) {
    car.speed *= 0.35;
    car.condition = Math.max(0, car.condition - Math.min(10, spd * 0.4));
  }
  // Bump into other cars.
  for (const o of [...G.cars, ...G.parked, ...G.police]) {
    if (o === car) continue;
    const d = dist(car.x, car.z, o.x, o.z);
    if (d < 4.2 && d > 0.01) {
      const push = (4.2 - d) / 2;
      const px = (car.x - o.x) / d, pz = (car.z - o.z) / d;
      car.x += px * push; car.z += pz * push;
      if (spd > 3) { car.speed *= 0.6; car.condition = Math.max(0, car.condition - 4); }
      if (o.parked || G.cars.includes(o)) {
        o.x -= px * push; o.z -= pz * push;
        const [ox, oz] = collideCircle(o.x, o.z, 2.1);
        o.x = ox; o.z = oz;
        syncCarMesh(o);
      }
    }
  }
  player.carSpeed = car.speed;
  player.speedKmh = Math.abs(car.speed) * 3.6;
  G.carSpeed = car.speed;
  G.stats.driven += spd * dt;
  player.x = car.x; player.z = car.z; player.y = groundHeightAt(car.x, car.z);
  player.heading = car.heading;
  syncCarMesh(car);
}

export function nearestEnterableCar() {
  let best = null, bd = 4.6;
  for (const c of [...G.parked, ...G.cars]) {
    const d = dist(player.x, player.z, c.x, c.z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

export function enterCar(car) {
  const idx = G.cars.indexOf(car);
  if (idx !== -1) G.cars.splice(idx, 1); // stolen traffic car leaves the flow
  const pi = G.parked.indexOf(car);
  if (pi !== -1) G.parked.splice(pi, 1);
  player.car = car; player.inCar = true;
  player.x = car.x; player.z = car.z;
  return car.mine === true;
}

export function exitCar() {
  const car = player.car;
  if (!car) return;
  car.speed = 0;
  const sx = car.x + Math.cos(car.heading) * 3, sz = car.z - Math.sin(car.heading) * 3;
  const [rx, rz] = collideCircle(sx, sz, 0.5);
  player.x = rx; player.z = rz; player.y = groundHeightAt(rx, rz);
  player.inCar = false; player.car = null;
  player.carSpeed = 0; player.speedKmh = 0; G.carSpeed = 0;
  G.parked.push(car);
  car.parked = true;
}
