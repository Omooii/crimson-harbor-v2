// Screenshot staging: ?shot=<name> starts the game and deterministically
// arranges a scene (mission, wanted level, police, helicopter, clock, camera)
// so each screenshot shows the game at its best. Same code path as play.
import { G, player } from './state.js';
import { MISSIONS, startMission } from './missions.js';
import { makeCarMesh } from './vehicles.js';
import { clearPolice } from './police.js';
import { groundHeightAt } from './world.js';

let sceneRef = null;

export function initShots(scene) { sceneRef = scene; }

function putPlayerInCar(x, z, heading, modelIdx) {
  const car = G.parked.find((c) => c.model.name === ['Vortex GT', 'Comet Coupe', 'Sunset Sedan'][modelIdx]);
  const use = car || G.parked[0];
  const pi = G.parked.indexOf(use);
  if (pi !== -1) G.parked.splice(pi, 1);
  use.x = x; use.z = z; use.heading = heading; use.speed = 0; use.condition = 86;
  use.group.position.set(x, groundHeightAt(x, z), z);
  use.group.rotation.y = heading;
  player.car = use; player.inCar = true;
  player.x = x; player.z = z; player.heading = heading;
  return use;
}

function addCruiser(x, z, heading, role) {
  const group = makeCarMesh({ name: 'Interceptor', color: 0xf2f2f2 }, true);
  group.position.set(x, groundHeightAt(x, z), z);
  group.rotation.y = heading;
  sceneRef.add(group);
  const c = { x, z, heading, speed: 18, role, hp: 100, group, stuckT: 0, fireT: 1 };
  G.police.push(c);
  return c;
}

function addHeli(x, z, h) {
  // Spawn the real helicopter, then park it where the camera can see it.
  G.wanted = Math.max(G.wanted, 3);
  G.wantedHeat = G.wanted * 20;
  if (!G.heli) {
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
    cone.position.y = -20; cone.rotation.x = Math.PI;
    g.add(cone);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff6b0 }));
    bulb.position.y = -1; g.add(bulb);
    sceneRef.add(g);
    G.heli = { group: g, rotor, angle: 0, x, z };
  }
  G.heli.x = x; G.heli.z = z;
  G.heli.group.position.set(x, h || 34, z);
  G.heli.group.lookAt(player.x, 0, player.z);
}

function setShotMission(i, stage, timeLeft) {
  startMission(i);
  G.mission.stage = stage;
  G.mission.timeLeft = timeLeft;
  G.missionsDone = i;
}

// Fixed cinematic cameras: position + look target, in world space.
export function stageShot(name) {
  clearPolice();
  G.money = 52480; G.rp = 3400; G.day = 3; G.tune = 4;
  G.health = 100; G.armour = 80;
  G.crew.forEach((c) => { c.cd = 0; });
  if (name === 'drive') {
    // COVER: bright noon at the pier, wheel behind, big car, police flanking.
    G.clock = 12;
    setShotMission(7, 2, 47);
    putPlayerInCar(-48, 106, -1.4, 0);
    addCruiser(-58, 112, 0.4, 'Flanking');
    addCruiser(-44, 82, 2.6, 'Pursuit');
    addCruiser(-62, 84, 0.2, 'Ramming');
    addCruiser(-40, 88, 2.9, 'Flanking');
    addCruiser(-56, 122, 0.1, 'Roadblock');
    addCruiser(-66, 100, 2.7, 'Firing');
    G.wanted = 5; G.wantedHeat = 100;
    addHeli(-90, 66, 26);
    G.dialogue = { who: 'Sable', line: 'Boat\'s right there, Rook. Punch it!' };
    G.dialogueT = 999;
    G.shotCam = { pos: new THREE.Vector3(-36, 5, 114), look: new THREE.Vector3(-72, 6, 96) };
  } else if (name === 'foot') {
    // On foot on Harbor Blvd, traffic + peds, wheel in the distance.
    G.clock = 12;
    setShotMission(5, 1, 312);
    player.x = 16; player.z = 96; player.heading = 2.4; player.inCar = false; player.car = null;
    G.camYaw = 2.4;
    G.wanted = 3; G.wantedHeat = 60;
    addCruiser(24, 70, 3.1, 'Pursuit');
    addCruiser(16, 124, 0.1, 'Flanking');
    addCruiser(28, 110, 2.8, 'Ramming');
    addHeli(60, 60);
    G.dialogue = { who: 'Ivo', line: 'Cameras say three units on you. Move, Rook.' };
    G.dialogueT = 999;
    G.shotCam = { pos: new THREE.Vector3(22, 3.5, 106), look: new THREE.Vector3(-12, 2, 86) };
  } else if (name === 'chase') {
    // Bridge roadblock chase: gold beam, heli, six units.
    G.clock = 15;
    setShotMission(5, 0, 203);
    putPlayerInCar(-20, -120, Math.PI, 0);
    addCruiser(-24, -152, 0.1, 'Roadblock');
    addCruiser(-16, -152, -0.1, 'Roadblock');
    addCruiser(-20, -100, 3.1, 'Pursuit');
    addCruiser(-26, -108, 3.0, 'Flanking');
    addCruiser(-14, -108, 3.2, 'Ramming');
    addCruiser(-20, -92, 3.1, 'Firing');
    G.wanted = 4; G.wantedHeat = 80;
    addHeli(-42, -152, 26);
    G.dialogue = { who: 'Tess', line: 'Roadblock on the bridge! Ram through it!' };
    G.dialogueT = 999;
    G.shotCam = { pos: new THREE.Vector3(-6, 9, -96), look: new THREE.Vector3(-22, 4, -140) };
  } else if (name === 'night') {
    // Night on Ocean Drive: streetlight glows, lightbars, player car.
    G.clock = 20.5;
    setShotMission(4, 1, 158);
    putPlayerInCar(-50, 150, 0.2, 1);
    addCruiser(-46, 126, 0.1, 'Pursuit');
    addCruiser(-54, 172, 3.1, 'Flanking');
    addCruiser(-44, 168, 2.9, 'Ramming');
    addCruiser(-56, 132, 0.2, 'Firing');
    G.wanted = 3; G.wantedHeat = 60;
    addHeli(-64, 118, 20);
    G.dialogue = { who: 'Ivo', line: 'Night run, lights off. They\'ll never see us coming.' };
    G.dialogueT = 999;
    G.shotCam = { pos: new THREE.Vector3(-47, 5, 162), look: new THREE.Vector3(-56, 3, 138) };
  }
  G.banner = null; G.bannerT = 0;
}
