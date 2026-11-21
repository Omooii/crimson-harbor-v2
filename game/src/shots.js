// Deterministic screenshot staging (?shot=drive|foot|chase|mission).
// Each shot sets a fixed golden-hour (or alive-night) scene: close police,
// helicopter spotlight, traffic, pedestrians, a late mission, big money,
// a ticking timer, and dialogue with a portrait — then freezes the sim
// so the frame is reproducible.
import { Car } from './vehicles.js';
import { CREW } from './missions.js';

function setMission(game, index, stage, timeLeft) {
  const m = game.missions;
  m.index = index; m.stage = stage; m.active = true; m.timeLeft = timeLeft;
  m.completed = m.completed.map((_, i) => i < index);
  game.updateMarker();
}

function farUnits(game, px, pz, heading) {
  // two extra units ahead, setting a roadblock — fills the police list to 6+
  const spots = [[26, -4], [48, 5]];
  const roles = ['ROADBLOCK', 'FIRING'];
  const css = ['HPD-18', 'HPD-55'];
  spots.forEach(([ahead, side], i) => {
    const x = px + Math.sin(heading) * ahead + Math.cos(heading) * side;
    const z = pz + Math.cos(heading) * ahead - Math.sin(heading) * side;
    const car = new Car(game.scene, x, z, heading + Math.PI, 'HPD Interceptor', 0xffffff, true);
    const lb = car.mesh.userData.lightBar;
    lb.red.color.setHex(0xff2222); lb.blue.color.setHex(0x001155);
    game.police.cruisers.push({ car, callsign: css[i], role: roles[i], bustedTimer: 0, ramBoost: 0 });
  });
}

function settle(game, px, pz, heliDx, heliDz, heliY) {
  // run the frozen police update a few times so the heli + beam settle,
  // then place the heli low and close so it is IN frame with its beam
  game.police.frozen = true;
  for (let i = 0; i < 30; i++) game.police.update(0.05, { x: px, z: pz, heading: 0, speed: 0 }, true);
  const h = game.police.heli;
  if (h) {
    h.x = px + (heliDx ?? 10); h.z = pz + (heliDz ?? -8); h.y = heliY ?? 27;
    game.police.updateHeli(0, px, pz);
  }
  game.world.update(0, new THREE.Vector3(px, 0, pz));
}

function finish(game, S, camPos, lookAt, dlg) {
  game.camera.position.set(...camPos);
  game.camera.lookAt(...lookAt);
  game.hud.hideCenter();
  if (dlg) {
    const c = CREW.find(c => c.id === dlg.crew);
    game.hud.showDialogue(c.name, dlg.line, c.portrait, 1e9);
  }
  game.hud.setWeapon(S.weapon, S.ammo[S.weapon]);
  game.updateHUD();
  game.shotFreeze = true;
}

function inCarAt(game, S, x, z, heading, speedKmh, damage) {
  const car = game.starterCar;
  car.x = x; car.z = z; car.heading = heading;
  car.mesh.position.set(x, 0, z); car.mesh.rotation.y = heading;
  game.player.x = x; game.player.z = z; game.player.heading = heading;
  game.enterCar(car);
  car.speed = speedKmh / 3.6; car.damage = damage; // after enterCar (it clamps speed)
}

export function stageShot(shot, game, S) {
  const W = game.world;
  if (shot === 'drive') {
    // COVER: golden-hour beach-road chase, final mission, 4 stars.
    W.time = 18.5;
    S.money = 27450; S.rp = 2480; S.hp = 78; S.armour = 45;
    S.weapon = 3; // SMG
    setMission(game, 3, 2, 92); // The Crimson Job, stage 3/3, 1:32 left
    inCarAt(game, S, 280, 60, Math.PI, 142, 18);
    game.police.setWanted(4);
    game.police.stageChase(280, 60, Math.PI, 3);
    farUnits(game, 280, 60, Math.PI);
    game.traffic.stageNear(280, 60, 5);
    game.peds.stageNear(280, 60, 6, false);
    game.peds.stageNear(330, 60, 6, true);
    settle(game, 280, 60, 12, -14, 20);
    finish(game, S, [280, 8, 92], [281, 2, 46],
      { crew: 'mara', line: 'Four stars and the whole harbor behind us — don\'t you dare slow down now!' });
  } else if (shot === 'foot') {
    // On foot in a busy market street at golden hour, mid/late mission, 3 stars.
    W.time = 18.35;
    S.money = 18300; S.rp = 1860; S.hp = 92; S.armour = 60;
    S.weapon = 2; // pistol
    setMission(game, 2, 1, 134); // Night Tide, stage 2/5, 2:14 left
    const p = game.player;
    p.x = -80; p.z = 80; p.heading = Math.PI;
    p.mesh.position.set(p.x, 0, p.z); p.mesh.rotation.y = p.heading;
    game.police.setWanted(3);
    game.police.stageChase(-80, 80, Math.PI, 3);
    farUnits(game, -80, 80, Math.PI);
    game.traffic.stageNear(-80, 80, 5);
    game.peds.stageNear(-80, 80, 12, false);
    settle(game, -80, 80, 10, -12, 18);
    finish(game, S, [-85, 4.8, 99], [-79, 3.5, 60],
      { crew: 'dex', line: 'Checkpoints are live and Harbor PD is already on us. Run the tide — no brakes!' });
  } else if (shot === 'chase') {
    // Second chase angle: downtown / north bridge, 5 stars, crew strip on.
    W.time = 18.55;
    S.money = 25800; S.rp = 2610; S.hp = 64; S.armour = 30;
    S.weapon = 4; // rifle
    setMission(game, 3, 2, 65); // final mission, 1:05 left
    inCarAt(game, S, 0, -210, Math.PI, 158, 31);
    game.police.setWanted(5);
    game.police.stageChase(0, -210, Math.PI, 4);
    farUnits(game, 0, -210, Math.PI);
    game.traffic.stageNear(0, -210, 4);
    game.peds.stageNear(0, -210, 8, false);
    game.hud.showCrewStrip(true);
    settle(game, 0, -210, 12, -14, 20);
    finish(game, S, [-8, 6.5, -185], [1, 4, -232],
      { crew: 'rosa', line: 'They\'re ramming us! Hold the line — the bridge is ours!' });
  } else if (shot === 'mission') {
    // Final mission at night — but ALIVE: lamps, neon, traffic, people, heli.
    W.time = 22.0;
    S.money = 31200; S.rp = 2940; S.hp = 71; S.armour = 55;
    S.weapon = 3; // SMG
    setMission(game, 3, 2, 58); // final mission, 0:58 left
    inCarAt(game, S, 0, 24, Math.PI, 121, 24);
    game.police.setWanted(5);
    game.police.stageChase(0, 24, Math.PI, 3);
    farUnits(game, 0, 24, Math.PI);
    game.traffic.stageNear(0, 24, 6);
    game.peds.stageNear(0, 24, 10, false);
    settle(game, 0, 24, 12, -14, 20);
    finish(game, S, [-8, 5.6, 47], [2, 4, 4],
      { crew: 'mara', line: 'Vault cash is in the trunk. Lighthouse, fifty-eight seconds — FLY!' });
  } else {
    // unknown shot: plain free-roam golden hour
    W.time = 18.4;
    game.shotFreeze = true;
  }
}
