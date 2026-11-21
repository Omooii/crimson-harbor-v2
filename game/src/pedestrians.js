// Pedestrians: low-poly walkers on sidewalks and the beach. They stroll, chat in place,
// and run when gunfire or a speeding car comes near. Getting hit knocks them down.
import * as THREE from 'three';
import { ROADS } from './config.js';
import { mulberry32, pick } from './util.js';
import { collideCircle } from './city.js';
const SKINS = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
const SHIRTS = [0xe63946, 0x457b9d, 0x2a9d8f, 0xf4a261, 0x9b5de5, 0xefefef, 0x333333, 0x80b918];
const PANTS = [0x2b2d42, 0x3a3f4d, 0x5b4a3a, 0x1d3557];
const bodyGeo = new THREE.BoxGeometry(0.62, 0.85, 0.36);
const headGeo = new THREE.SphereGeometry(0.26, 8, 7);
const legGeo = new THREE.BoxGeometry(0.24, 0.8, 0.28);
const armGeo = new THREE.BoxGeometry(0.18, 0.7, 0.2);
function makePedMesh(rng) {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: pick(rng, SKINS) });
  const shirt = new THREE.MeshLambertMaterial({ color: pick(rng, SHIRTS) });
  const pants = new THREE.MeshLambertMaterial({ color: pick(rng, PANTS) });
  const hair = new THREE.MeshLambertMaterial({ color: pick(rng, [0x1c1c1c, 0x5b3a1e, 0x8a8d91, 0xd4a017]) });
  const body = new THREE.Mesh(bodyGeo, shirt); body.position.y = 1.2; g.add(body);
  const head = new THREE.Mesh(headGeo, skin); head.position.y = 1.85; g.add(head);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.27, 8, 6, 0, Math.PI * 2, 0, 1.2), hair);
  cap.position.y = 1.9; g.add(cap);
  const legL = new THREE.Mesh(legGeo, pants); legL.position.set(-0.17, 0.4, 0); g.add(legL);
  const legR = new THREE.Mesh(legGeo, pants); legR.position.set(0.17, 0.4, 0); g.add(legR);
  const armL = new THREE.Mesh(armGeo, shirt); armL.position.set(-0.42, 1.2, 0); g.add(armL);
  const armR = new THREE.Mesh(armGeo, shirt); armR.position.set(0.42, 1.2, 0); g.add(armR);
  g.userData = { legL, legR, armL, armR };
  return g;
}
export function initPedestrians(G, count) {
  const rng = mulberry32(G.seed + 77);
  G.peds = [];
  for (let i = 0; i < count; i++) {
    const beach = i % 3 === 0;
    let x, z;
    if (beach) { x = 226 + rng() * 32; z = -250 + rng() * 480; }
    else {
      const road = pick(rng, ROADS);
      const v = -240 + rng() * 480;
      if (rng() < 0.5) { x = v; z = road + (rng() < 0.5 ? 8 : -8); } else { x = road + (rng() < 0.5 ? 8 : -8); z = v; }
    }
    const mesh = makePedMesh(rng);
    mesh.position.set(x, 0, z);
    G.scene.add(mesh);
    const ped = {
      mesh, x, z, heading: rng() * Math.PI * 2, speed: 0,
      walkPhase: rng() * 6, state: beach && rng() < 0.4 ? 'idle' : 'walk',
      panic: 0, down: 0, hp: 100, targetX: x, targetZ: z, wait: rng() * 3,
    };
    mesh.userData.entity = { type: 'ped', ref: ped };
    G.peds.push(ped);
  }
}
function retarget(ped, rng) {
  const a = rng() * Math.PI * 2, d = 12 + rng() * 30;
  ped.targetX = Math.max(-260, Math.min(258, ped.x + Math.cos(a) * d));
  ped.targetZ = Math.max(-260, Math.min(258, ped.z + Math.sin(a) * d));
}
export function scarePeds(G, x, z, radius) {
  for (const p of G.peds) {
    if (p.down > 0) continue;
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < radius) { p.panic = 6; p.state = 'flee'; }
  }
}
export function updatePedestrians(G, dt) {
  const rng = G.rng;
  for (const p of G.peds) {
    if (p.down > 0) {
      p.down -= dt;
      p.mesh.rotation.x = -Math.PI / 2 * Math.min(1, (5 - p.down) * 4 + 0.2);
      if (p.down <= 0) { p.mesh.rotation.x = 0; p.mesh.position.y = 0; p.hp = 100; p.panic = 5; p.state = 'flee'; }
      continue;
    }
    let speed = 0;
    if (p.state === 'idle') {
      p.wait -= dt;
      if (p.wait <= 0) { p.state = 'walk'; retarget(p, rng); }
    } else if (p.state === 'flee') {
      p.panic -= dt;
      const away = Math.atan2(p.x - G.player.pos.x, p.z - G.player.pos.z);
      p.heading = away;
      speed = 5.2;
      if (p.panic <= 0) { p.state = 'walk'; retarget(p, rng); }
    } else {
      const dx = p.targetX - p.x, dz = p.targetZ - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.5) {
        if (rng() < 0.4) { p.state = 'idle'; p.wait = 2 + rng() * 5; }
        else retarget(p, rng);
      } else {
        p.heading = Math.atan2(dx, dz);
        speed = 1.6;
      }
    }
    // A speeding car nearby makes peds scatter.
    if (p.state === 'walk') {
      for (const c of G.cars) {
        if (Math.abs(c.speed) > 12 && Math.hypot(c.x - p.x, c.z - p.z) < 9) { p.state = 'flee'; p.panic = 5; break; }
      }
    }
    p.speed = speed;
    if (speed > 0) {
      const nx = p.x + Math.sin(p.heading) * speed * dt;
      const nz = p.z + Math.cos(p.heading) * speed * dt;
      const push = collideCircle(G, nx, nz, 0.5);
      if (push) { p.x = nx + push.x; p.z = nz + push.z; retarget(p, rng); }
      else { p.x = nx; p.z = nz; }
      p.walkPhase += dt * speed * 3.2;
    }
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.heading;
    const s = Math.sin(p.walkPhase) * (speed > 0 ? 0.55 : 0);
    const u = p.mesh.userData;
    u.legL.rotation.x = s; u.legR.rotation.x = -s; u.armL.rotation.x = -s * 0.7; u.armR.rotation.x = s * 0.7;
  }
}
// Damage a ped at point (x,z) within radius; returns the ped hit (or null).
export function hitPed(G, x, z, radius, dmg) {
  for (const p of G.peds) {
    if (p.down > 0) continue;
    if (Math.hypot(p.x - x, p.z - z) < radius) {
      p.hp -= dmg;
      if (p.hp <= 0) { p.down = 5; p.mesh.position.y = 0.3; }
      else { p.panic = 5; p.state = 'flee'; }
      return p;
    }
  }
  return null;
}
