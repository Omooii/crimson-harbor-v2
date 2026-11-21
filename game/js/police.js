// Harbor PD: the wanted system, pursuit cruisers with visible states, and
// the police helicopter with its spotlight. Also owns busted/wasted.
import { G, player, rng } from './state.js';
import { clamp, dist, pick, wrapAngle } from './utils.js';
import { ROAD_POINTS, collideCircle, groundHeightAt } from './world.js';
import { makeCarMesh } from './vehicles.js';
import { sfxSirenBurst } from './audio.js';

let sceneRef = null;
let prevWanted = 0;
let spawnT = 0;
const ROLES = ['Pursuit', 'Flanking', 'Ramming', 'Roadblock', 'Firing'];

export function initPolice(scene) { sceneRef = scene; }

export function addHeat(n) {
  G.wantedHeat = clamp(G.wantedHeat + n, 0, 100);
  const w = Math.min(5, Math.floor(G.wantedHeat / 20));
  if (w > G.wanted) {
    G.wanted = w;
    G.banner = w >= 3 ? 'HARBOR PD HELICOPTER INBOUND' : 'WANTED LEVEL ' + w;
    G.bannerT = 2.5;
    sfxSirenBurst();
  }
  G.unseenT = 0;
}

export function scrubStar() {
  G.wanted = Math.max(0, G.wanted - 1);
  G.wantedHeat = G.wanted * 20;
}

function spawnPoint() {
  for (let tries = 0; tries < 12; tries++) {
    const [x, z] = pick(rng, ROAD_POINTS);
    const d = dist(x, z, player.x, player.z);
    if (d > 55 && d < 110) return [x, z];
  }
  return [player.x + 70, player.z];
}

function spawnCruiser() {
  const [x, z] = spawnPoint();
  const group = makeCarMesh({ name: 'Interceptor', color: 0xf2f2f2 }, true);
  group.position.set(x, 0, z);
  sceneRef.add(group);
  const c = {
    x, z, heading: Math.atan2(player.x - x, player.z - z), speed: 0,
    role: 'Pursuit', hp: 100, group, stuckT: 0, fireT: 0,
  };
  G.police.push(c);
  return c;
}

function spawnHeli() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 5), new THREE.MeshLambertMaterial({ color: 0x1a2a44 }));
  g.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2, 0.9, 2), new THREE.MeshLambertMaterial({ color: 0x9fd8ff }));
  cab.position.set(0, 0.3, 1.2); g.add(cab);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 0.3), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  rotor.position.y = 1; g.add(rotor);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 3.4), new THREE.MeshLambertMaterial({ color: 0x1a2a44 }));
  tail.position.set(0, 0.3, -3.6); g.add(tail);
  const spotMat = new THREE.MeshBasicMaterial({ color: 0xfff6b0, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(7, 40, 16, 1, true), spotMat);
  cone.position.y = -20; cone.rotation.x = Math.PI; // apex up at the heli
  g.add(cone);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff6b0 }));
  bulb.position.y = -1; g.add(bulb);
  sceneRef.add(g);
  G.heli = { group: g, rotor, angle: 0, x: player.x, z: player.z };
}

export function clearPolice() {
  for (const c of G.police) sceneRef.remove(c.group);
  G.police.length = 0;
  if (G.heli) { sceneRef.remove(G.heli.group); G.heli = null; }
}

function updateHeli(dt) {
  const h = G.heli;
  h.angle += dt * 0.35;
  const r = 26;
  h.x = player.x + Math.cos(h.angle) * r;
  h.z = player.z + Math.sin(h.angle) * r;
  h.group.position.set(h.x, 38, h.z);
  h.group.lookAt(player.x, 0, player.z);
  h.rotor.rotation.y += dt * 25;
  // Keep the spotlight cone aimed at the player.
  h.group.children.forEach(() => {});
}

export function updatePolice(dt) {
  // Staged screenshots hold their formation: no chasing, no spawning, no bust.
  if (G.shotCam) {
    G.inSight = G.wanted > 0;
    for (const c of G.police) {
      const flash = Math.sin(G.time * 12 + c.x) > 0;
      if (c.group.userData.barL) {
        c.group.userData.barL.material.color.setHex(flash ? 0xff2222 : 0x550000);
        c.group.userData.barR.material.color.setHex(flash ? 0x000055 : 0x2244ff);
      }
    }
    if (G.heli) G.heli.rotor.rotation.y += dt * 25;
    return;
  }
  // New stars bring instant backup so a response is never empty.
  if (G.wanted > prevWanted) {
    const want = Math.min(2 + G.wanted, 6);
    while (G.police.length < Math.min(want, 2)) spawnCruiser();
  }
  prevWanted = G.wanted;

  const desired = G.wanted > 0 ? Math.min(2 + G.wanted, 6) : 0;
  spawnT -= dt;
  if (G.police.length < desired && spawnT <= 0) { spawnCruiser(); spawnT = 1; }
  if (G.wanted === 0 && G.police.length > 0) {
    // Heat's off: units peel away one by one.
    spawnT -= dt;
    if (spawnT <= 0) {
      const c = G.police.pop();
      sceneRef.remove(c.group);
      spawnT = 0.8;
    }
  }
  if (G.wanted >= 3 && !G.heli) spawnHeli();
  if (G.wanted < 3 && G.heli) { sceneRef.remove(G.heli.group); G.heli = null; }
  if (G.heli) updateHeli(dt);

  // Are we seen? Any unit close, or the heli overhead.
  let nearest = 1e9;
  for (const c of G.police) nearest = Math.min(nearest, dist(c.x, c.z, player.x, player.z));
  G.inSight = (G.wanted > 0 && nearest < 60) || (G.heli !== null && G.heli.group.visible);

  // Wanted decays only while unseen.
  if (G.wanted > 0 && !G.inSight) {
    G.unseenT += dt;
    if (G.unseenT > 4) { G.unseenT = 0; scrubStar(); }
  } else G.unseenT = 0;

  const pSpeed = player.inCar ? Math.abs(player.carSpeed) : G.playerSpeed;
  for (const c of G.police) {
    const d = dist(c.x, c.z, player.x, player.z);
    if (c.hp <= 0) { c.role = 'Disabled'; c.speed = 0; continue; }
    // Caught: a unit sitting on a stationary player ends the run.
    if (d < 8 && pSpeed < 1.5 && G.wanted > 0) {
      c.speed = 0; c.role = 'Roadblock';
    } else if (d > 45) { c.role = 'Pursuit'; }
    else if (G.wanted >= 3 && d < 25) { c.role = 'Firing'; }
    else if (d < 16) { c.role = 'Ramming'; }
    else { c.role = 'Flanking'; }

    if (c.role !== 'Roadblock' && c.role !== 'Disabled') {
      const want = Math.atan2(player.x - c.x, player.z - c.z);
      const turn = clamp(wrapAngle(want - c.heading), -2.2 * dt, 2.2 * dt);
      c.heading += turn;
      const top = 26 + G.wanted * 1.5;
      c.speed += clamp(top - c.speed, -20 * dt, 12 * dt);
      const nx = c.x + Math.sin(c.heading) * c.speed * dt;
      const nz = c.z + Math.cos(c.heading) * c.speed * dt;
      const [rx, rz] = collideCircle(nx, nz, 2.1);
      if (Math.hypot(rx - nx, rz - nz) > 0.05) { c.speed *= 0.5; c.stuckT += dt; }
      else c.stuckT = 0;
      c.x = rx; c.z = rz;
      if (c.stuckT > 2) { // back out of a dead end
        c.x -= Math.sin(c.heading) * 6; c.z -= Math.cos(c.heading) * 6;
        c.heading += Math.PI / 2; c.stuckT = 0;
      }
      // Ram the player's car when close behind it.
      if (player.inCar && d < 5) {
        player.car.condition = Math.max(0, player.car.condition - 6 * dt);
        player.carSpeed *= (1 - 0.4 * dt);
      }
    }
    // Firing units chip the player's health at close range.
    if (c.role === 'Firing' && d < 30) {
      c.fireT -= dt;
      if (c.fireT <= 0) {
        c.fireT = 0.5;
        damagePlayer(3);
      }
    }
    c.group.position.set(c.x, groundHeightAt(c.x, c.z), c.z);
    c.group.rotation.y = c.heading;
    const flash = Math.sin(G.time * 12 + c.x) > 0;
    if (c.group.userData.barL) {
      c.group.userData.barL.material.color.setHex(flash ? 0xff2222 : 0x550000);
      c.group.userData.barR.material.color.setHex(flash ? 0x000055 : 0x2244ff);
    }
    const spin = c.speed * 0.06;
    for (const w of c.group.userData.wheels) w.rotation.x += spin;
  }

  // Busted: standing still with a unit on top of you.
  if (G.wanted > 0 && !G.over && nearest < 6 && pSpeed < 1.5) {
    G.bustT += dt;
    if (G.bustT > 2.5) { G.over = 'busted'; G.bustT = 0; }
  } else G.bustT = 0;
}

export function damagePlayer(n) {
  if (G.over) return;
  let rest = n;
  if (G.armour > 0) {
    const absorbed = Math.min(G.armour, rest * 0.6);
    G.armour -= absorbed; rest -= absorbed;
  }
  G.health = Math.max(0, G.health - rest);
  G.hurtT = 0.35;
  if (G.health <= 0) G.over = 'wasted';
}

export function damagePolice(car, dmg) {
  car.hp -= dmg;
  if (car.hp <= 0) {
    car.hp = 0; car.role = 'Disabled'; car.speed = 0;
    addHeat(20);
  }
}
