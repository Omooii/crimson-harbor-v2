// Kai Mercer on foot and behind the wheel: movement, punching, hitscan shooting, weapon
// slots, entering and stealing cars, and taking damage.
import * as THREE from 'three';
import { WEAPONS } from './config.js';
import { clamp, TAU } from './util.js';
import { collideCircle } from './city.js';
import { driveCar } from './vehicles.js';
import { hitPed, scarePeds } from './pedestrians.js';

export function makePlayerMesh() {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xe0ac69 });
  const jacket = new THREE.MeshLambertMaterial({ color: 0xc1121f });
  const pants = new THREE.MeshLambertMaterial({ color: 0x1d3557 });
  const hair = new THREE.MeshLambertMaterial({ color: 0x1c1c1c });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.9, 0.4), jacket); body.position.y = 1.22; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8), skin); head.position.y = 1.9; g.add(head);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 6, 0, TAU, 0, 1.1), hair); cap.position.y = 1.95; g.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.85, 0.3), pants); legL.position.set(-0.18, 0.42, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.18; g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.22), jacket); armL.position.set(-0.45, 1.22, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.45; g.add(armR);
  g.userData = { legL, legR, armL, armR, body };
  return g;
}
export function createPlayer(G) {
  const mesh = makePlayerMesh();
  G.scene.add(mesh);
  return {
    mesh, pos: new THREE.Vector3(-150, 0, -120), heading: 0, speed: 0,
    health: 100, armour: 0, money: 0, rp: 0, rank: 1, wanted: 0,
    weapon: 0, ammo: WEAPONS.map((w) => ({ mag: w.mag, reserve: w.reserve })),
    fireCd: 0, punchCd: 0, car: null, walkPhase: 0, punchAnim: 0,
    invuln: 0, wantedTimer: 0, busted: 0,
  };
}
export function healPlayer(G, hp, armour) {
  const p = G.player;
  p.health = clamp(p.health + hp, 0, 100);
  p.armour = clamp(p.armour + armour, 0, 100);
}
export function damagePlayer(G, dmg, source) {
  const p = G.player;
  if (p.invuln > 0 || G.screen !== 'play' || G.shot) return;
  const absorbed = Math.min(p.armour, dmg * 0.6);
  p.armour -= absorbed;
  p.health -= (dmg - absorbed);
  G.hudFlash = 0.5;
  if (p.health <= 0) { p.health = 0; G.endGame('WASTED', 'Kai went down in ' + G.districtName + '. The Harbor keeps moving.'); }
}
function nearestCar(G, maxD) {
  let best = null, bd = maxD;
  for (const c of G.cars) {
    if (c === G.player.car || c.dead) continue;
    const d = Math.hypot(c.x - G.player.pos.x, c.z - G.player.pos.z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
export function enterCar(G, car) {
  const p = G.player;
  p.car = car;
  car.parked = false;
  if (car.driver) { car.driver = null; const i = G.traffic.indexOf(car); if (i >= 0) G.traffic.splice(i, 1); }
  p.mesh.visible = false;
  G.stats.carsStolen++;
  G.audio.blip(520, 0.1, 'triangle', 0.25);
  if (car.kind === 'police') G.police.addWanted(1);
}
export function exitCar(G) {
  const p = G.player;
  const car = p.car;
  if (!car) return;
  const side = car.heading + Math.PI / 2;
  p.pos.set(car.x + Math.sin(side) * 2.4, 0, car.z + Math.cos(side) * 2.4);
  p.heading = car.heading;
  p.car = null;
  p.mesh.visible = true;
  p.mesh.position.copy(p.pos);
}
function shoot(G) {
  const p = G.player;
  if (p.weapon === 0) { punch(G); return; } // fists: clicking throws a punch
  const w = WEAPONS[p.weapon];
  if (p.fireCd > 0) return;
  if (w.mag !== Infinity && p.ammo[p.weapon].mag <= 0) {
    G.notify('OUT OF AMMO — press R to reload');
    p.fireCd = 0.3;
    return;
  }
  p.fireCd = w.rate;
  if (w.mag !== Infinity) p.ammo[p.weapon].mag--;
  G.stats.shotsFired++;
  G.audio.shot();
  // Muzzle flash + tracer from the gun toward the crosshair ray.
  const origin = p.car ? new THREE.Vector3(p.car.x, 1.6, p.car.z) : p.pos.clone().add(new THREE.Vector3(0, 1.5, 0));
  const dir = new THREE.Vector3();
  G.camera.getWorldDirection(dir);
  if (p.car) { dir.set(Math.sin(p.car.heading), 0, Math.cos(p.car.heading)); }
  G.particles.burst(origin.x + dir.x, origin.y, origin.z + dir.z, 4, [1, 0.8, 0.3], 3, 0.12, 1.4);
  const ray = new THREE.Raycaster(origin, dir, 0.1, w.range);
  const targets = [];
  for (const ped of G.peds) if (ped.down <= 0) targets.push(ped.mesh);
  for (const c of G.cars) if (c !== p.car) targets.push(c.mesh);
  for (const cop of G.police.foot) targets.push(cop.mesh);
  const hits = ray.intersectObjects(targets, true);
  // Tracer line endpoint: first hit or max range.
  const end = hits.length ? hits[0].point : origin.clone().add(dir.clone().multiplyScalar(w.range));
  G.particles.spawn((origin.x + end.x) / 2, (origin.y + end.y) / 2, (origin.z + end.z) / 2, 0, 0, 0, 0.08, 1, 0.9, 0.4, 1.1, 0);
  if (hits.length) {
    let obj = hits[0].object;
    while (obj && !obj.userData.entity) obj = obj.parent;
    const ent = obj ? obj.userData.entity : null;
    if (ent) {
      if (ent.type === 'ped') {
        const ped = ent.ref;
        ped.hp -= w.dmg;
        if (ped.hp <= 0) { ped.down = 5; ped.mesh.position.y = 0.3; }
        else { ped.panic = 5; ped.state = 'flee'; }
        G.police.addWanted(1);
        G.stats.pedsHit++;
      } else if (ent.type === 'car') {
        ent.ref.damage += w.dmg * 0.8;
        G.particles.burst(end.x, end.y, end.z, 6, [1, 0.7, 0.2], 4, 0.4, 1.2);
        if (ent.ref.kind === 'police') G.police.addWanted(1);
      } else if (ent.type === 'cop') {
        const cop = ent.ref;
        cop.hp -= w.dmg;
        if (cop.hp <= 0) { cop.down = 6; cop.mesh.rotation.x = -Math.PI / 2; G.police.addWanted(1); }
      }
    }
  }
  scarePeds(G, p.pos.x, p.pos.z, 25);
  if (p.wanted === 0) G.police.addWanted(1);
}
function punch(G) {
  const p = G.player;
  if (p.punchCd > 0) return;
  p.punchCd = 0.45; p.punchAnim = 0.3;
  G.audio.punch();
  const fx = p.pos.x + Math.sin(p.heading) * 1.6, fz = p.pos.z + Math.cos(p.heading) * 1.6;
  const ped = hitPed(G, fx, fz, 2.2, 34);
  if (ped) { G.police.addWanted(1); G.stats.pedsHit++; return; }
  for (const cop of G.police.foot) {
    if (cop.down > 0) continue;
    if (Math.hypot(cop.x - fx, cop.z - fz) < 2.2) {
      cop.hp -= 34;
      if (cop.hp <= 0) { cop.down = 6; cop.mesh.rotation.x = -Math.PI / 2; }
      G.police.addWanted(1);
      return;
    }
  }
}
export function updatePlayer(G, dt) {
  const p = G.player, input = G.input;
  p.fireCd = Math.max(0, p.fireCd - dt);
  p.punchCd = Math.max(0, p.punchCd - dt);
  p.punchAnim = Math.max(0, p.punchAnim - dt);
  p.invuln = Math.max(0, p.invuln - dt);
  // Weapon switching.
  if (input.hit('Digit1')) p.weapon = 0;
  if (input.hit('Digit2')) p.weapon = 1;
  if (input.hit('Digit3')) p.weapon = 2;
  if (input.hit('KeyR')) {
    const w = WEAPONS[p.weapon], a = p.ammo[p.weapon];
    if (w.mag !== Infinity && a.reserve > 0) {
      const need = w.mag - a.mag, take = Math.min(need, a.reserve);
      a.mag += take; a.reserve -= take;
      G.audio.blip(440, 0.08, 'square', 0.15);
    }
  }
  if (p.car) {
    // Driving.
    const { steer, throttle } = input.axis();
    const handbrake = input.down('Space');
    const impact = driveCar(G, p.car, throttle, steer, handbrake, dt);
    p.pos.set(p.car.x, 0, p.car.z);
    p.heading = p.car.heading;
    G.stats.distanceDriven += Math.abs(p.car.speed) * dt;
    if (impact > 10) {
      G.audio.crash();
      G.particles.burst(p.car.x, 1, p.car.z, 10, [1, 0.7, 0.2], 5, 0.5, 1.5);
      if (impact > 18) damagePlayer(G, (impact - 18) * 1.2, 'crash');
      G.shake = Math.min(0.6, impact * 0.02);
      if (p.car.damage >= 100) { G.notify('CAR WRECKED — find another ride'); exitCar(G); return; }
    }
    if (handbrake && Math.abs(p.car.speed) > 8 && Math.random() < 0.5) {
      G.particles.smoke(p.car.x - Math.sin(p.car.heading) * 2, 0.4, p.car.z - Math.cos(p.car.heading) * 2);
    }
    if (p.car.dead) { G.notify('CAR WRECKED — find another ride'); exitCar(G); return; }
    if (input.down('ShiftLeft') || input.down('ShiftRight')) {
      // Nitro: brief top-speed boost.
      p.car.speed = Math.min(p.car.def.top * 1.25, p.car.speed + 22 * dt);
      if (Math.random() < 0.4) G.particles.fire(p.car.x - Math.sin(p.car.heading) * 2.4, 0.6, p.car.z - Math.cos(p.car.heading) * 2.4);
    }
    // Exiting ends the driving update: the code below reads p.car, which is null now.
    if (input.hit('KeyE')) { exitCar(G); return; }
    if (input.mouseClicked || (input.mouseDown && WEAPONS[p.weapon].auto)) shoot(G);
    // Run over peds.
    for (const ped of G.peds) {
      if (ped.down > 0) continue;
      if (Math.hypot(ped.x - p.car.x, ped.z - p.car.z) < 1.8 && Math.abs(p.car.speed) > 4) {
        ped.down = 5; ped.mesh.position.y = 0.3;
        G.police.addWanted(1); G.stats.pedsHit++;
        G.audio.crash();
      }
    }
    return;
  }
  // On foot: move relative to the camera yaw.
  const { steer, throttle } = input.axis();
  const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
  const speed = sprint ? 7.5 : 4.6;
  const yaw = G.camYaw;
  let mx = 0, mz = 0;
  if (throttle !== 0 || steer !== 0) {
    mx = Math.sin(yaw) * throttle + Math.sin(yaw + Math.PI / 2) * steer;
    mz = Math.cos(yaw) * throttle + Math.cos(yaw + Math.PI / 2) * steer;
    const len = Math.hypot(mx, mz);
    mx /= len; mz /= len;
    p.heading = Math.atan2(mx, mz);
  }
  const moving = throttle !== 0 || steer !== 0;
  const nx = p.pos.x + mx * speed * dt * (moving ? 1 : 0);
  const nz = p.pos.z + mz * speed * dt * (moving ? 1 : 0);
  const push = collideCircle(G, nx, nz, 0.55);
  if (push) { p.pos.x = nx + push.x; p.pos.z = nz + push.z; }
  else { p.pos.x = nx; p.pos.z = nz; }
  p.pos.x = clamp(p.pos.x, -272, 262); p.pos.z = clamp(p.pos.z, -272, 262);
  if (moving) { p.walkPhase += dt * speed * 2.2; G.stats.distanceWalked += speed * dt; }
  p.mesh.position.copy(p.pos);
  p.mesh.rotation.y = p.heading;
  const s = Math.sin(p.walkPhase) * (moving ? 0.6 : 0);
  const u = p.mesh.userData;
  u.legL.rotation.x = s; u.legR.rotation.x = -s;
  u.armL.rotation.x = -s * 0.7; u.armR.rotation.x = s * 0.7;
  if (p.punchAnim > 0) u.armR.rotation.x = -1.9;
  // Interact: nearest car (a mission-start prompt takes priority over entering).
  const near = nearestCar(G, 4.5);
  G.nearCar = near;
  if (near && input.hit('KeyE') && !G.interactText.includes('Start mission')) enterCar(G, near);
  if (input.hit('KeyF')) punch(G);
  if (input.mouseClicked || (input.mouseDown && WEAPONS[p.weapon].auto)) shoot(G);
  if (input.hit('Space')) { /* jump: small hop for feel */ p.mesh.position.y = 0.35; setTimeout(() => { p.mesh.position.y = 0; }, 160); }
}
