// The Harbor PD: a 5-star wanted system, pursuing cruisers, foot cops who can bust the
// player, and a helicopter with a spotlight at high wanted levels.
import * as THREE from 'three';
import { ROADS } from './config.js';
import { clamp, pick } from './util.js';
import { spawnCar, removeCar, driveCar } from './vehicles.js';
import { damagePlayer } from './player.js';

const UNIT_NAMES = ['UNIT 7', 'UNIT 12', 'UNIT 3', 'UNIT 21', 'UNIT 9', 'UNIT 17'];
function makeCopMesh() {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xc68642 });
  const navy = new THREE.MeshLambertMaterial({ color: 0x1d3557 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x14161d });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.9, 0.4), navy); body.position.y = 1.22; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8), skin); head.position.y = 1.9; g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.18, 8), pants); cap.position.y = 2.08; g.add(cap);
  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.05), new THREE.MeshBasicMaterial({ color: 0xffd166 }));
  badge.position.set(0.16, 1.4, 0.22); g.add(badge);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.85, 0.3), pants); legL.position.set(-0.18, 0.42, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.18; g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.22), navy); armL.position.set(-0.45, 1.22, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.45; g.add(armR);
  g.userData = { legL, legR, armL, armR };
  return g;
}
function makeHeliMesh() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x1d3557 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 4.6), bodyMat); g.add(body);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.9, 1.2), new THREE.MeshLambertMaterial({ color: 0x9fd8e8 }));
  glass.position.set(0, 0.3, 2.0); g.add(glass);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.5), bodyMat); tail.position.set(0, 0.2, -4.2); g.add(tail);
  const rotor = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.BoxGeometry(11, 0.08, 0.4), new THREE.MeshLambertMaterial({ color: 0x14161d }));
  rotor.add(blade);
  const blade2 = blade.clone(); blade2.rotation.y = Math.PI / 2; rotor.add(blade2);
  rotor.position.y = 1.1; g.add(rotor);
  const skidL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 3.4), new THREE.MeshLambertMaterial({ color: 0x333333 }));
  skidL.position.set(-1.1, -1.1, 0); g.add(skidL);
  const skidR = skidL.clone(); skidR.position.x = 1.1; g.add(skidR);
  g.userData.rotor = rotor;
  return g;
}
export function initPolice(G) {
  const P = {
    cars: [], foot: [], heli: null, heliJam: 0, decayTimer: 0, spawnTimer: 0, unitCount: 0,
    addWanted(n) {
      const p = G.player;
      const before = p.wanted;
      p.wanted = clamp(p.wanted + n, 0, 5);
      if (p.wanted > before) {
        P.decayTimer = 0;
        G.notify(p.wanted >= 4 ? 'WANTED LEVEL ' + p.wanted + ' — AIR SUPPORT INBOUND' : 'WANTED LEVEL ' + p.wanted);
        if (p.wanted >= 2) G.audio.fail();
      }
    },
    setWanted(n) { G.player.wanted = clamp(n, 0, 5); P.decayTimer = 0; },
    spawnCruiser(x, z, heading) {
      const car = spawnCar(G, 'police', x, z, heading);
      car.driver = { unit: UNIT_NAMES[P.unitCount++ % UNIT_NAMES.length], role: 'PATROL' };
      P.cars.push(car);
      return car;
    },
    spawnFootCop(x, z) {
      const mesh = makeCopMesh();
      mesh.position.set(x, 0, z);
      G.scene.add(mesh);
      const cop = { mesh, x, z, heading: 0, hp: 100, down: 0, walkPhase: 0, shootCd: 1 + Math.random(), unit: UNIT_NAMES[P.unitCount++ % UNIT_NAMES.length] };
      mesh.userData.entity = { type: 'cop', ref: cop };
      P.foot.push(cop);
      return cop;
    },
    spawnHeli() {
      if (P.heli) return;
      const mesh = makeHeliMesh();
      const spot = new THREE.SpotLight(0xfff6c9, 0, 120, 0.45, 0.5, 1.2);
      spot.position.set(0, -1, 0);
      mesh.add(spot);
      const target = new THREE.Object3D();
      G.scene.add(target); spot.target = target;
      G.scene.add(mesh);
      P.heli = { mesh, spot, angle: 0, x: G.player.pos.x + 30, z: G.player.pos.z, y: 42 };
    },
    removeHeli() {
      if (!P.heli) return;
      G.scene.remove(P.heli.mesh);
      P.heli = null;
    },
    clearAll() {
      for (const c of P.cars) removeCar(G, c);
      for (const f of P.foot) G.scene.remove(f.mesh);
      P.cars = []; P.foot = [];
      P.removeHeli();
    },
    list() {
      const rows = [];
      for (const c of P.cars) {
        const d = Math.round(Math.hypot(c.x - G.player.pos.x, c.z - G.player.pos.z));
        rows.push({ name: c.driver.unit, role: 'PATROL', dist: d });
      }
      for (const f of P.foot) {
        if (f.down > 0) continue;
        const d = Math.round(Math.hypot(f.x - G.player.pos.x, f.z - G.player.pos.z));
        rows.push({ name: f.unit, role: 'FOOT', dist: d });
      }
      const sorted = rows.sort((a, b) => a.dist - b.dist);
      if (P.heli) sorted.unshift({ name: 'AIR-1', role: 'HELICOPTER', dist: Math.round(Math.hypot(P.heli.x - G.player.pos.x, P.heli.z - G.player.pos.z)) });
      return sorted.slice(0, 4);
    },
    update(dt) {
      const p = G.player;
      const wanted = p.wanted;
      P.heliJam = Math.max(0, P.heliJam - dt);
      // Desired force by wanted level.
      const wantCars = wanted === 0 ? 0 : wanted === 1 ? 1 : wanted === 2 ? 2 : wanted === 3 ? 3 : wanted === 4 ? 4 : 5;
      const wantFoot = wanted >= 3 && !p.car ? 2 : wanted >= 2 && !p.car ? 1 : 0;
      const wantHeli = wanted >= 4 && P.heliJam <= 0;
      // Spawn / despawn to match.
      P.spawnTimer -= dt;
      if (P.spawnTimer <= 0) {
        P.spawnTimer = 1.2;
        if (P.cars.length < wantCars) {
          const road = pick(G.rng, ROADS);
          const alongX = G.rng() < 0.5;
          const off = 55 + G.rng() * 45;
          const sx = alongX ? p.pos.x + (G.rng() < 0.5 ? off : -off) : road;
          const sz = alongX ? road : p.pos.z + (G.rng() < 0.5 ? off : -off);
          P.spawnCruiser(clamp(sx, -250, 250), clamp(sz, -250, 250), Math.atan2(p.pos.x - sx, p.pos.z - sz));
        }
        if (P.foot.length < wantFoot) {
          const a = G.rng() * Math.PI * 2;
          P.spawnFootCop(p.pos.x + Math.cos(a) * 22, p.pos.z + Math.sin(a) * 22);
        }
        while (P.cars.length > wantCars) { const c = P.cars.pop(); removeCar(G, c); }
        while (P.foot.length > wantFoot) { const f = P.foot.pop(); G.scene.remove(f.mesh); }
      }
      if (wantHeli && !P.heli) P.spawnHeli();
      if (!wantHeli && P.heli) P.removeHeli();
      // Cruisers pursue: aim at the player's predicted position, ram on contact.
      for (const car of P.cars) {
        if (car.dead) continue;
        const lead = 0.6;
        const tx = p.pos.x + (p.car ? Math.sin(p.car.heading) * p.car.speed * lead : 0);
        const tz = p.pos.z + (p.car ? Math.cos(p.car.heading) * p.car.speed * lead : 0);
        const want = Math.atan2(tx - car.x, tz - car.z);
        let dh = want - car.heading;
        while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
        const dist = Math.hypot(tx - car.x, tz - car.z);
        const throttle = dist > 4 ? 1 : 0.4;
        driveCar(G, car, throttle, clamp(dh * 2.2, -1, 1), Math.abs(dh) > 2.2, dt);
        // Ram damage to the player's car.
        if (p.car && Math.hypot(car.x - p.car.x, car.z - p.car.z) < 3.4 && Math.abs(car.speed) > 6) {
          p.car.damage += 4 * dt * Math.abs(car.speed) * 0.2;
          G.shake = Math.max(G.shake, 0.25);
        }
        if (car.damage >= 100 && !car.dead) { car.dead = true; }
      }
      // Foot cops run the player down; touching the player fills the bust meter.
      let touching = false;
      for (const cop of P.foot) {
        if (cop.down > 0) {
          cop.down -= dt;
          if (cop.down <= 0) { cop.mesh.rotation.x = 0; cop.hp = 100; }
          continue;
        }
        const dx = p.pos.x - cop.x, dz = p.pos.z - cop.z;
        const d = Math.hypot(dx, dz);
        cop.heading = Math.atan2(dx, dz);
        const spd = d > 14 ? 6.4 : 5.4;
        if (d > 1.6) {
          cop.x += Math.sin(cop.heading) * spd * dt;
          cop.z += Math.cos(cop.heading) * spd * dt;
          cop.walkPhase += dt * spd * 2.4;
        } else if (!p.car) touching = true;
        // Cops shoot when the player is armed and at range.
        cop.shootCd -= dt;
        if (cop.shootCd <= 0 && d < 45 && d > 6 && !p.car) {
          cop.shootCd = 1.4 + Math.random();
          G.particles.burst(cop.x, 1.4, cop.z, 3, [1, 0.8, 0.3], 2, 0.1, 1.2);
          if (Math.random() < 0.4) damagePlayer(G, 6, 'cop');
        }
        cop.mesh.position.set(cop.x, 0, cop.z);
        cop.mesh.rotation.y = cop.heading;
        const s = Math.sin(cop.walkPhase) * 0.55;
        cop.mesh.userData.legL.rotation.x = s; cop.mesh.userData.legR.rotation.x = -s;
      }
      if (touching && wanted > 0) {
        p.busted += dt;
        if (p.busted > 2.5) {
          p.busted = 0;
          G.endGame('BUSTED', 'Harbor PD took Kai in. The car is impounded — and so is $250 of his cash.');
          p.money = Math.max(0, p.money - 250);
          p.wanted = 0;
        }
      } else p.busted = Math.max(0, p.busted - dt * 2);
      // Helicopter circles overhead; spotlight at night. Shots override the orbit
      // (lower, wider, frozen) so the helicopter stays in frame.
      if (P.heli) {
        const h = P.heli;
        if (!G.shot) h.angle += dt * 0.35;
        const R = G.heliRadius || 26, Y = G.heliHeight || 42;
        h.x = p.pos.x + Math.cos(h.angle) * R;
        h.z = p.pos.z + Math.sin(h.angle) * R;
        h.y = Y;
        h.mesh.position.set(h.x, h.y, h.z);
        h.mesh.rotation.y = -h.angle;
        h.mesh.userData.rotor.rotation.y += dt * 22;
        h.spot.intensity = G.isNight ? 260 : 0;
        h.spot.target.position.set(p.pos.x, 0, p.pos.z);
      }
      // Wanted decay: out of every cop's sight for a while, lose a star.
      if (wanted > 0) {
        let nearest = 1e9;
        for (const c of P.cars) nearest = Math.min(nearest, Math.hypot(c.x - p.pos.x, c.z - p.pos.z));
        for (const f of P.foot) nearest = Math.min(nearest, Math.hypot(f.x - p.pos.x, f.z - p.pos.z));
        if (nearest > 55 || P.cars.length === 0) {
          P.decayTimer += dt;
          if (P.decayTimer > 18) { P.decayTimer = 0; p.wanted--; G.notify('WANTED LEVEL ' + p.wanted); }
        } else P.decayTimer = 0;
      }
    },
  };
  return P;
}
