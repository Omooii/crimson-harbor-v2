// Vehicle factory (5 civilian kinds + police cruiser) and arcade driving physics.
import * as THREE from 'three';
import { CARS } from './config.js';
import { clamp, TAU } from './util.js';
import { collideCircle } from './city.js';

const bodyGeo = new THREE.BoxGeometry(1, 1, 1);
const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x151515 });
const glassMat = new THREE.MeshLambertMaterial({ color: 0x9fd8e8 });
const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2e2e });

export function makeCarMesh(kind, color) {
  const def = CARS[kind];
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: color ?? def.color });
  if (kind === 'scooter') {
    const body = new THREE.Mesh(bodyGeo, bodyMat); body.scale.set(0.7, 0.6, 2.0); body.position.y = 0.55; g.add(body);
    const seat = new THREE.Mesh(bodyGeo, wheelMat); seat.scale.set(0.5, 0.2, 0.9); seat.position.set(0, 0.95, -0.3); g.add(seat);
    const bar = new THREE.Mesh(bodyGeo, wheelMat); bar.scale.set(0.7, 0.12, 0.12); bar.position.set(0, 1.1, 0.85); g.add(bar);
    for (const z of [0.85, -0.85]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.18, 10), wheelMat);
      w.rotation.z = Math.PI / 2; w.position.set(0, 0.32, z); g.add(w);
    }
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 6), lightMat); head.position.set(0, 0.8, 1.05); g.add(head);
    return g;
  }
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.scale.set(def.wid, kind === 'van' ? 1.5 : 0.85, def.len); body.position.y = kind === 'van' ? 1.05 : 0.72; g.add(body);
  if (kind !== 'van') {
    const cab = new THREE.Mesh(bodyGeo, glassMat);
    cab.scale.set(def.wid * 0.86, 0.62, def.len * 0.5); cab.position.set(0, 1.4, kind === 'sports' ? -0.2 : -0.1); g.add(cab);
    const roof = new THREE.Mesh(bodyGeo, bodyMat);
    roof.scale.set(def.wid * 0.88, 0.12, def.len * 0.52); roof.position.set(0, 1.74, kind === 'sports' ? -0.2 : -0.1); g.add(roof);
  } else {
    const shield = new THREE.Mesh(bodyGeo, glassMat);
    shield.scale.set(def.wid * 0.9, 0.7, 0.15); shield.position.set(0, 1.5, def.len / 2 - 0.05); g.add(shield);
  }
  if (kind === 'sports') { const sp = new THREE.Mesh(bodyGeo, wheelMat); sp.scale.set(def.wid * 0.9, 0.1, 0.5); sp.position.set(0, 1.05, -def.len / 2 + 0.2); g.add(sp); }
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(bodyGeo, new THREE.MeshBasicMaterial({ color: 0xffe066 }));
    sign.scale.set(0.9, 0.3, 0.4); sign.position.set(0, 1.95, 0); g.add(sign);
  }
  if (kind === 'police') {
    const bar = new THREE.Mesh(bodyGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    bar.scale.set(1.2, 0.22, 0.5); bar.position.set(0, 1.92, -0.1); g.add(bar);
    const lb = new THREE.Mesh(bodyGeo, new THREE.MeshBasicMaterial({ color: 0xff0000 }));
    lb.scale.set(0.55, 0.24, 0.52); lb.position.set(-0.3, 1.92, -0.1); g.add(lb);
    const bb = new THREE.Mesh(bodyGeo, new THREE.MeshBasicMaterial({ color: 0x0044ff }));
    bb.scale.set(0.55, 0.24, 0.52); bb.position.set(0.3, 1.92, -0.1); g.add(bb);
    g.userData.lightbar = [lb, bb];
    const stripe = new THREE.Mesh(bodyGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    stripe.scale.set(def.wid + 0.02, 0.3, def.len * 0.8); stripe.position.y = 0.75; g.add(stripe);
  }
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(sx * (def.wid / 2 - 0.05), 0.38, sz * (def.len / 2 - 0.8));
    g.add(w);
  }
  for (const sx of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.1), lightMat);
    h.position.set(sx * (def.wid / 2 - 0.35), 0.75, def.len / 2 + 0.02); g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.1), tailMat);
    t.position.set(sx * (def.wid / 2 - 0.35), 0.75, -def.len / 2 - 0.02); g.add(t);
  }
  return g;
}

export function spawnCar(G, kind, x, z, heading, color) {
  const def = CARS[kind];
  const mesh = makeCarMesh(kind, color);
  mesh.position.set(x, 0, z); mesh.rotation.y = heading;
  G.scene.add(mesh);
  const car = {
    kind, def, mesh, x, z, heading, speed: 0, steer: 0,
    damage: 0, dead: false, parked: false, driver: null, hitCd: 0,
    radius: Math.max(def.len, def.wid) / 2,
    lightbarPhase: Math.random() * TAU,
  };
  mesh.userData.entity = { type: 'car', ref: car };
  mesh.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  G.cars.push(car);
  return car;
}
export function removeCar(G, car) {
  G.scene.remove(car.mesh);
  const i = G.cars.indexOf(car); if (i >= 0) G.cars.splice(i, 1);
}
// Arcade drive step: throttle -1..1, steer -1..1, handbrake bool. Returns impact speed (0 if none).
export function driveCar(G, car, throttle, steer, handbrake, dt) {
  if (car.dead) { throttle = 0; }
  const def = car.def;
  const grip = handbrake ? def.grip * 0.55 : def.grip;
  const maxF = def.top, maxR = 10;
  if (throttle > 0) car.speed += def.accel * throttle * dt * (car.speed < 0 ? 2.2 : 1);
  else if (throttle < 0) car.speed += (car.speed > 0.5 ? -def.accel * 2.4 : def.accel * 0.7) * dt;
  else car.speed -= car.speed * 0.55 * dt;
  if (handbrake) car.speed -= car.speed * 1.6 * dt;
  car.speed = clamp(car.speed, -maxR, maxF);
  const spd = Math.abs(car.speed);
  const steerTarget = steer * clamp(spd / 6, 0, 1) * (car.speed < 0 ? -1 : 1);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  car.heading += car.steer * grip * 0.055 * spd * dt * (handbrake ? 1.5 : 1);
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  let impact = 0;
  const r = car.radius * 0.72;
  car.hitCd -= dt;
  const push = collideCircle(G, nx, nz, r);
  if (push) {
    impact = spd;
    car.x = nx + push.x; car.z = nz + push.z;
    car.speed *= -0.25;
    // Damage only on a fresh impact: scraping along a wall must not shred the car.
    if (car.hitCd <= 0 && spd > 3) { car.damage += spd * 0.5; car.hitCd = 0.6; }
  } else {
    car.x = nx; car.z = nz;
  }
  // Car-car bumps.
  for (const other of G.cars) {
    if (other === car) continue;
    const dx = car.x - other.x, dz = car.z - other.z;
    const d = Math.hypot(dx, dz), min = (car.radius + other.radius) * 0.62;
    if (d < min && d > 0.01) {
      const pushD = (min - d) / 2, ux = dx / d, uz = dz / d;
      car.x += ux * pushD; car.z += uz * pushD;
      other.x -= ux * pushD; other.z -= uz * pushD;
      const rel = Math.abs(car.speed - other.speed);
      if (rel > 3 && car.hitCd <= 0) { impact = Math.max(impact, rel); car.damage += rel * 0.4; other.damage += rel * 0.4; car.hitCd = 0.6; }
      car.speed *= 0.7;
    }
  }
  // World bounds: beach and harbor edges are walls of water.
  car.x = clamp(car.x, -272, 262); car.z = clamp(car.z, -272, 262);
  if (car.damage >= 100 && !car.dead) { car.dead = true; car.speed = 0; }
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  // Police lightbar flash.
  if (car.kind === 'police' && car.mesh.userData.lightbar) {
    car.lightbarPhase += dt * 12;
    const on = Math.sin(car.lightbarPhase) > 0;
    car.mesh.userData.lightbar[0].material.color.setHex(on ? 0xff2222 : 0x550000);
    car.mesh.userData.lightbar[1].material.color.setHex(on ? 0x000055 : 0x2266ff);
  }
  return impact;
}
