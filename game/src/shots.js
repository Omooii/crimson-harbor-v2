// Screenshot staging behind ?shot=drive|foot|chase|mission&seed=7. Each scene sets the real
// game state (mission, wanted, money, time of day), places the player, police, traffic and
// pedestrians for a lively frame, then plays the real simulation forward so everything is
// mid-motion. Shot mode also keeps an autopilot driving so the chase never stalls.
import { MISSIONS } from './config.js';
import { driveCar, spawnCar } from './vehicles.js';
import { updateTraffic } from './traffic.js';
import { updatePedestrians, scarePeds } from './pedestrians.js';

function setMission(G, id, stage, timer) {
  const def = MISSIONS.find((m) => m.id === id);
  G.mission = { def, stage, timer };
  G.missions.active = G.mission;
  const s = def.stages[stage];
  G.missions.placeMarker(s.x, s.z);
}
function setStats(G, money, rp, rank, health, armour) {
  const p = G.player;
  p.money = money; p.rp = rp; p.rank = rank; p.health = health; p.armour = armour;
}
function putPlayerInCar(G, kind, x, z, heading, speed) {
  const car = spawnCar(G, kind, x, z, heading);
  car.speed = speed;
  G.player.car = car;
  G.player.mesh.visible = false;
  G.player.pos.set(x, 0, z);
  G.player.heading = heading;
  return car;
}
function movePedsNear(G, spots) {
  let i = 0;
  for (const p of G.peds) {
    if (i >= spots.length) break;
    p.x = spots[i][0]; p.z = spots[i][1];
    p.state = 'walk'; p.down = 0; p.panic = 0;
    p.targetX = p.x + (Math.random() - 0.5) * 20; p.targetZ = p.z + (Math.random() - 0.5) * 20;
    p.mesh.position.set(p.x, 0, p.z);
    i++;
  }
}
function nearestRoad(v) {
  let best = -210, bd = 1e9;
  for (let r = -210; r <= 210; r += 60) { const d = Math.abs(v - r); if (d < bd) { bd = d; best = r; } }
  return best;
}
function moveTrafficOnto(G, spots) {
  let i = 0;
  for (const c of G.traffic) {
    if (i >= spots.length) break;
    const [x, z, heading, speed] = spots[i];
    c.x = x; c.z = z; c.heading = heading; c.speed = speed;
    c.driver.alongX = Math.abs(Math.sin(heading)) > 0.5;
    c.driver.road = c.driver.alongX ? nearestRoad(z) : nearestRoad(x);
    c.driver.dir = c.driver.alongX ? (Math.sin(heading) > 0 ? 1 : -1) : (Math.cos(heading) > 0 ? 1 : -1);
    c.mesh.position.set(x, 0, z);
    i++;
  }
}
// Play the world forward `seconds` at 60 Hz with the player car on autopilot.
function simulate(G, seconds, laneX) {
  const dt = 1 / 60;
  const steps = Math.floor(seconds / dt);
  for (let i = 0; i < steps; i++) {
    const p = G.player;
    if (p.car) {
      const want = Math.atan2(laneX - p.car.x, 30);
      let dh = want - p.car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
      driveCar(G, p.car, 1, Math.max(-1, Math.min(1, dh * 2.5)), false, dt);
      p.pos.set(p.car.x, 0, p.car.z);
      p.heading = p.car.heading;
    }
    updateTraffic(G, dt);
    updatePedestrians(G, dt);
    G.police.update(dt);
    G.particles.update(dt);
  }
}
export function stageShot(name, G) {
  const p = G.player;
  G.clockHour = 11;
  G.shotLane = null;
  if (name === 'drive') {
    // COVER: bright beach-road chase, 4 stars, helicopter, mission 3 stage 3/4.
    G.clockHour = 11.4;
    setStats(G, 12480, 8200, 7, 86, 40);
    setMission(G, 3, 2, 134);
    putPlayerInCar(G, 'sports', 210, -60, 0, 26);
    G.police.setWanted(4);
    G.police.spawnCruiser(208, -92, 0).speed = 24;
    G.police.spawnCruiser(213, -78, 0).speed = 25;
    G.police.spawnHeli();
    G.heliRadius = 45; G.heliHeight = 16;
    moveTrafficOnto(G, [[206.8, 40, Math.PI, 11], [206.8, 110, Math.PI, 10], [213.2, 130, 0, 9]]);
    movePedsNear(G, [[230, -30], [236, -10], [228, 20], [242, 35], [232, 55], [246, 70], [225, 90], [238, 105]]);
    spawnCar(G, 'scooter', 219, -20, Math.PI / 2).parked = true;
    G.shotLane = 210;
    simulate(G, 2.2, 210);
    if (G.police.heli) G.police.heli.angle = 1.15; // heli ahead, clear of the HUD, in frame
  } else if (name === 'foot') {
    // On foot on the boardwalk, facing south-east: beach life ahead, traffic on the road
    // to the right, a call from Nadia.
    G.clockHour = 15.2;
    setStats(G, 4250, 2600, 4, 100, 25);
    setMission(G, 2, 0, 412);
    p.pos.set(219, 0, 20); p.heading = 0.35; p.car = null; p.mesh.visible = true;
    p.mesh.position.copy(p.pos); p.mesh.rotation.y = p.heading;
    G.police.setWanted(0);
    moveTrafficOnto(G, [[213.2, 25, 0, 10], [206.8, 75, Math.PI, 11], [213.2, 110, 0, 9]]);
    movePedsNear(G, [[222, 35], [230, 45], [226, 60], [234, 72], [221, 88], [238, 58], [228, 98], [242, 82], [224, 112], [232, 122]]);
    G.hud.showDialogue('NADIA CROSS', 'The case is at the Northgate meet, Kai. Get it back — and try not to start a war doing it.', 30);
    simulate(G, 1.2, 210);
  } else if (name === 'chase') {
    // Close pursuit at golden hour, Gus on the phone, 5 stars.
    G.clockHour = 17.5;
    setStats(G, 9100, 5400, 6, 72, 15);
    setMission(G, 3, 1, 268);
    putPlayerInCar(G, 'sedan', 150, -30, 0, 26);
    G.police.setWanted(5);
    G.police.spawnCruiser(150, -58, 0).speed = 26;
    G.police.spawnCruiser(146.5, -66, 0).speed = 25;
    G.police.spawnCruiser(153.5, -72, 0).speed = 24;
    G.police.spawnHeli();
    G.heliRadius = 45; G.heliHeight = 20;
    moveTrafficOnto(G, [[146.8, 50, Math.PI, 10], [153.2, 100, 0, 9]]);
    movePedsNear(G, [[142, -10], [158, 5], [141, 25], [159, 40]]);
    scarePeds(G, 150, -30, 40);
    G.hud.showDialogue('GUS HARLOW', 'They are all over you, kid — cut through the docks and lose them on the shore road!', 30);
    G.shotLane = 150;
    simulate(G, 1.2, 150);
    if (G.police.heli) G.police.heli.angle = 1.35; // heli over the road ahead, in frame
  } else if (name === 'mission') {
    // Final mission at night: docks, city lights, spotlight, 3 stars.
    G.clockHour = 22.1;
    setStats(G, 18900, 11800, 8, 94, 60);
    setMission(G, 4, 3, 189);
    putPlayerInCar(G, 'van', 30, 120, 0, 18);
    G.police.setWanted(3);
    G.police.spawnCruiser(28, 92, 0).speed = 20;
    G.police.spawnCruiser(33, 80, 0).speed = 21;
    moveTrafficOnto(G, [[26.8, 190, Math.PI, 8], [33.2, 200, 0, 9]]);
    movePedsNear(G, [[20, 230], [45, 240], [18, 200]]);
    G.shotLane = 30;
    simulate(G, 1.2, 30);
  } else {
    stageShot('drive', G);
    return;
  }
  G.cameraCtl.snap();
  G.hudDirty = true;
}
// Live autopilot: keeps the shot chase driving while the capture waits.
export function shotAutopilot(G, dt) {
  const p = G.player;
  if (!p.car || G.shotLane === null || G.shotLane === undefined) return;
  const want = Math.atan2(G.shotLane - p.car.x, 30);
  let dh = want - p.car.heading;
  while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
  driveCar(G, p.car, 1, Math.max(-1, Math.min(1, dh * 2.5)), false, dt);
  p.pos.set(p.car.x, 0, p.car.z);
  p.heading = p.car.heading;
  if (p.car.z > 250) { // loop back north so the chase never ends
    p.car.z = -240; p.car.x = G.shotLane;
    for (const c of G.police.cars) { c.z -= 480; }
  }
}
