// The player: on-foot movement and camera, punching, shooting, weapon
// switching, and the three crew abilities (Q/R/T).
import { G, player, WEAPONS } from './state.js';
import { clamp, dist, lerp, wrapAngle } from './utils.js';
import { collideCircle, groundHeightAt } from './world.js';
import { makePersonMesh, nearestPed, damagePed, knockDown, scarePeds } from './pedestrians.js';
import { enterCar, exitCar, nearestEnterableCar, updatePlayerCar } from './vehicles.js';
import { addHeat, damagePolice, scrubStar } from './police.js';
import { sfxPunch, sfxShot } from './audio.js';
import { say } from './missions.js';

let sceneRef = null, cameraRef = null;
let gunMesh = null, tracer = null, tracerT = 0, muzzle = null;

export function initPlayer(scene, camera) {
  sceneRef = scene; cameraRef = camera;
  player.group = makePersonMesh(0xc0392b, 0x2c3e50, 0xe8b88a);
  scene.add(player.group);
  gunMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.5), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
  gunMesh.position.set(0.42, 1.0, 0.35);
  player.group.add(gunMesh);
  muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffe066 }));
  muzzle.position.set(0.42, 1.0, 0.7);
  muzzle.visible = false;
  player.group.add(muzzle);
  const tg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, 1)]);
  tracer = new THREE.Line(tg, new THREE.LineBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.9 }));
  tracer.visible = false;
  scene.add(tracer);
}

export function updateCamera(dt) {
  if (G.shotCam) {
    cameraRef.position.lerp(G.shotCam.pos, Math.min(1, dt * 3));
    cameraRef.lookAt(G.shotCam.look);
    return;
  }
  const distBack = player.inCar ? 11 : 7;
  const height = player.inCar ? 4.6 : 3.4;
  const cx = player.x - Math.sin(G.camYaw) * Math.cos(G.camPitch) * distBack;
  const cz = player.z - Math.cos(G.camYaw) * Math.cos(G.camPitch) * distBack;
  const cy = player.y + height + Math.sin(G.camPitch) * distBack * 0.7;
  cameraRef.position.x = lerp(cameraRef.position.x, cx, Math.min(1, dt * 8));
  cameraRef.position.y = lerp(cameraRef.position.y, cy, Math.min(1, dt * 8));
  cameraRef.position.z = lerp(cameraRef.position.z, cz, Math.min(1, dt * 8));
  if (cameraRef.position.y < player.y + 1.2) cameraRef.position.y = player.y + 1.2;
  cameraRef.lookAt(player.x + Math.sin(G.camYaw) * 4, player.y + 1.6, player.z + Math.cos(G.camYaw) * 4);
}

export function updatePlayer(dt, input) {
  G.fireT -= dt;
  player.punchT = Math.max(0, player.punchT - dt);
  if (tracerT > 0) { tracerT -= dt; if (tracerT <= 0) tracer.visible = false; }
  muzzle.visible = false;

  if (player.inCar) {
    updatePlayerCar(dt, input);
    player.group.visible = false;
    if (input.interact) { input.interact = false; exitCar(); player.group.visible = true; }
    return;
  }
  player.group.visible = true;
  if (input.interact) {
    input.interact = false;
    const car = nearestEnterableCar();
    if (car) {
      const mine = enterCar(car);
      if (!mine) { addHeat(20); say('Sable: Nice wheels. Hope the owner doesn\'t mind.'); }
      return;
    }
  }
  // Walk / sprint relative to the camera.
  const fwd = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
  const strafe = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const moving = fwd !== 0 || strafe !== 0;
  const base = input.sprint ? 7 : 4;
  const speed = base * (G.boostT > 0 ? 1.6 : 1);
  if (moving) {
    const dir = Math.atan2(
      Math.sin(G.camYaw) * fwd + Math.sin(G.camYaw + Math.PI / 2) * strafe,
      Math.cos(G.camYaw) * fwd + Math.cos(G.camYaw + Math.PI / 2) * strafe,
    );
    player.heading = dir;
    const nx = player.x + Math.sin(dir) * speed * dt;
    const nz = player.z + Math.cos(dir) * speed * dt;
    const [rx, rz] = collideCircle(nx, nz, 0.45);
    // Don't walk through cars: treat them as circles.
    let bx = rx, bz = rz;
    for (const c of [...G.parked, ...G.cars, ...G.police]) {
      const d = dist(bx, bz, c.x, c.z);
      if (d < 1.9 && d > 0.01) { bx = c.x + ((bx - c.x) / d) * 1.9; bz = c.z + ((bz - c.z) / d) * 1.9; }
    }
    player.x = bx; player.z = bz;
    G.playerSpeed = speed;
    player.walkPhase += dt * speed * 1.6;
  } else G.playerSpeed = 0;
  player.y = groundHeightAt(player.x, player.z);

  // Animate the figure.
  const u = player.group.userData;
  const s = moving ? Math.sin(player.walkPhase) * 0.55 : 0;
  u.lLeg.rotation.x = s; u.rLeg.rotation.x = -s;
  u.lArm.rotation.x = -s * 0.7; u.rArm.rotation.x = s * 0.7;
  if (player.punchT > 0) u.rArm.rotation.x = -1.6 * (player.punchT / 0.3);
  player.group.position.set(player.x, player.y, player.z);
  player.group.rotation.y = player.heading;
  gunMesh.visible = G.weapon >= 2;
}

export function doPunch() {
  if (player.inCar || player.punchT > 0) return;
  player.punchT = 0.3;
  G.stats.punches++;
  sfxPunch();
  const px = player.x + Math.sin(player.heading) * 1.6;
  const pz = player.z + Math.cos(player.heading) * 1.6;
  const ped = nearestPed(px, pz, 2.2);
  if (ped) {
    knockDown(ped);
    addHeat(30);
    say('Tess: Down he goes. Keep moving, Rook.');
  }
  const cop = G.police.find((c) => dist(c.x, c.z, player.x, player.z) < 3);
  if (cop) { damagePolice(cop, 10); addHeat(30); }
}

export function doShoot() {
  if (G.fireT > 0 || player.inCar) return;
  const w = WEAPONS[G.weapon];
  if (G.weapon < 2) { doPunch(); return; }
  G.fireT = w.rate;
  G.stats.shots++;
  sfxShot();
  muzzle.visible = true;
  tracerT = 0.08;
  const ox = player.x, oy = player.y + 1.4, oz = player.z;
  const dirX = Math.sin(G.camYaw), dirZ = Math.cos(G.camYaw);
  const pellets = w.pellets || 1;
  let endX = ox + dirX * 60, endZ = oz + dirZ * 60;
  for (let p = 0; p < pellets; p++) {
    const spread = (Math.random() - 0.5) * (pellets > 1 ? 0.14 : 0.02);
    const dx = Math.sin(G.camYaw + spread), dz = Math.cos(G.camYaw + spread);
    let bestD = 60, hit = null, hitCop = null;
    for (const ped of G.peds) {
      if (ped.down) continue;
      const vx = ped.x - ox, vz = ped.z - oz;
      const along = vx * dx + vz * dz;
      if (along < 0 || along > 60) continue;
      const perp = Math.abs(vx * dz - vz * dx);
      if (perp < 1.1 && along < bestD) { bestD = along; hit = ped; hitCop = null; }
    }
    for (const cop of G.police) {
      if (cop.hp <= 0) continue;
      const vx = cop.x - ox, vz = cop.z - oz;
      const along = vx * dx + vz * dz;
      if (along < 0 || along > 60) continue;
      const perp = Math.abs(vx * dz - vz * dx);
      if (perp < 2.2 && along < bestD) { bestD = along; hit = null; hitCop = cop; }
    }
    if (hit) {
      G.stats.hits++;
      const wasDown = hit.down;
      damagePed(hit, w.dmg);
      if (!wasDown && hit.down) addHeat(40);
      else addHeat(15);
      endX = hit.x; endZ = hit.z;
    } else if (hitCop) {
      G.stats.hits++;
      damagePolice(hitCop, w.dmg);
      endX = hitCop.x; endZ = hitCop.z;
    }
  }
  const pos = tracer.geometry.attributes.position;
  pos.setXYZ(0, ox, oy, oz);
  pos.setXYZ(1, endX, oy, endZ);
  pos.needsUpdate = true;
  tracer.visible = true;
  scarePeds(player.x, player.z, 30);
}

export function switchWeapon(i) {
  const w = WEAPONS[i];
  if (!w || !w.owned) return false;
  G.weapon = i;
  return true;
}

export function useCrew(i) {
  const c = G.crew[i];
  if (!c || c.cd > 0) return;
  if (i === 0) {
    G.boostT = 6; c.cd = c.cdMax;
    say('Sable: Hold on — full send!');
  } else if (i === 1) {
    if (G.wanted === 0) { say('Ivo: No heat to scrub. We\'re clean.'); return; }
    scrubStar(); c.cd = c.cdMax;
    say('Ivo: Cameras looped. One star gone.');
  } else if (i === 2) {
    if (G.armour >= 100) { say('Tess: Armour\'s already maxed.'); return; }
    G.armour = Math.min(100, G.armour + 50); c.cd = c.cdMax;
    say('Tess: Vest up. You\'re covered.');
  }
}
