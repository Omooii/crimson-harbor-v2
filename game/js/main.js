// Boot + game loop + input + menus. Wires every system together and exposes
// window.__game for the playtest harness.
import { G, player, SHOT, WEAPONS, resetRun } from './state.js';
import { $, clamp, fmtMoney } from './utils.js';
import { buildWorld, updateWorld, world } from './world.js';
import { spawnTraffic, spawnParked, updateTraffic } from './vehicles.js';
import { spawnPeds, updatePeds } from './pedestrians.js';
import { initPolice, updatePolice, clearPolice } from './police.js';
import { initMissions, startMission, updateMissions } from './missions.js';
import { initPlayer, updatePlayer, updateCamera, doPunch, doShoot, switchWeapon, useCrew } from './player.js';
import { initHUD, updateHUD } from './hud.js';
import { saveGame, loadGame, hasSave, applySave } from './save.js';
import { initShots, stageShot } from './shots.js';
import { updateAudio, resumeAudio, setMuted, sfxClick, sfxHorn, audioState } from './audio.js';

const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87cdef);
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(10, 4, 108);

buildWorld(scene);
spawnTraffic(scene);
spawnParked(scene);
spawnPeds(scene);
initPolice(scene);
initMissions(scene);
initPlayer(scene, camera);
initHUD();
initShots(scene);

const input = { forward: false, back: false, left: false, right: false, sprint: false, handbrake: false, interact: false };
let mouseDown = false, armed = false, overShown = false, lastMissionsDone = 0;

function clearInput() {
  for (const k of Object.keys(input)) input[k] = false;
  mouseDown = false;
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') e.preventDefault();
  resumeAudio();
  if (!G.started) return;
  if (e.code === 'Escape') { if (!G.over) togglePause(); return; }
  if (G.paused || G.over) return;
  switch (e.code) {
    case 'KeyW': input.forward = true; break;
    case 'KeyS': input.back = true; break;
    case 'KeyA': input.left = true; break;
    case 'KeyD': input.right = true; break;
    case 'ShiftLeft': case 'ShiftRight': input.sprint = true; break;
    case 'Space': input.handbrake = true; break;
    case 'KeyE': if (!e.repeat) input.interact = true; break;
    case 'KeyF': if (!e.repeat) { armed = true; doPunch(); } break;
    case 'KeyQ': if (!e.repeat) { armed = true; useCrew(0); } break;
    case 'KeyR': if (!e.repeat) { armed = true; useCrew(1); } break;
    case 'KeyT': if (!e.repeat) { armed = true; useCrew(2); } break;
    case 'KeyM': if (!e.repeat) setMuted(!G.muted); break;
    case 'KeyH': if (!e.repeat) sfxHorn(); break;
    default:
      if (/^Digit[1-7]$/.test(e.code)) { armed = true; switchWeapon(Number(e.code.slice(5)) - 1); }
  }
});
window.addEventListener('keyup', (e) => {
  switch (e.code) {
    case 'KeyW': input.forward = false; break;
    case 'KeyS': input.back = false; break;
    case 'KeyA': input.left = false; break;
    case 'KeyD': input.right = false; break;
    case 'ShiftLeft': case 'ShiftRight': input.sprint = false; break;
    case 'Space': input.handbrake = false; break;
  }
});
window.addEventListener('mousemove', (e) => {
  if (!G.started || G.paused || G.over || G.shotCam) return;
  if (e.movementX) G.camYaw -= e.movementX * 0.0024;
  if (e.movementY) G.camPitch = clamp(G.camPitch + e.movementY * 0.002, 0.05, 1.1);
});
canvas.addEventListener('mousedown', (e) => {
  resumeAudio();
  if (!G.started || G.paused || G.over) return;
  if (!armed) { armed = true; return; } // first click focuses; later clicks shoot
  if (e.button === 0) { mouseDown = true; doShoot(); }
});
window.addEventListener('mouseup', () => { mouseDown = false; });
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function startGame(fromSave) {
  resetRun();
  if (fromSave) { const d = loadGame(); if (d) applySave(d); }
  $('title-menu').style.display = 'none';
  $('hud').style.display = 'block';
  G.started = true;
  resumeAudio();
  startMission(G.missionIndex);
  camera.position.set(player.x - Math.sin(G.camYaw) * 7, player.y + 3.4, player.z - Math.cos(G.camYaw) * 7);
  sfxClick();
}

function togglePause() {
  if (!G.started || G.over) return;
  G.paused = !G.paused;
  if (G.paused) { clearInput(); $('pause-menu').style.display = 'flex'; }
  else { $('pause-menu').style.display = 'none'; $('stats-screen').style.display = 'none'; }
  sfxClick();
}

function showStats() {
  const s = G.stats;
  $('stats-body').innerHTML =
    '<div class="stat-row"><span>Missions completed</span><b>' + G.missionsDone + ' / 8</b></div>' +
    '<div class="stat-row"><span>Money earned</span><b>' + fmtMoney(s.earned) + '</b></div>' +
    '<div class="stat-row"><span>Cash on hand</span><b>' + fmtMoney(G.money) + '</b></div>' +
    '<div class="stat-row"><span>Reputation</span><b>' + G.rp.toLocaleString('en-US') + ' RP</b></div>' +
    '<div class="stat-row"><span>Shots fired</span><b>' + s.shots + '</b></div>' +
    '<div class="stat-row"><span>Shots hit</span><b>' + s.hits + '</b></div>' +
    '<div class="stat-row"><span>Punches thrown</span><b>' + s.punches + '</b></div>' +
    '<div class="stat-row"><span>Pedestrians down</span><b>' + s.pedsDown + '</b></div>' +
    '<div class="stat-row"><span>Distance driven</span><b>' + Math.round(s.driven) + ' m</b></div>' +
    '<div class="stat-row"><span>Days in the city</span><b>' + G.day + '</b></div>';
  $('stats-screen').style.display = 'flex';
}

function showOver() {
  $('over-title').textContent = G.over === 'busted' ? 'BUSTED' : 'WASTED';
  $('over-sub').textContent = G.over === 'busted'
    ? 'Harbor PD caught up with you. $200 bail paid — the crew got you out.'
    : 'Rook went down hard. The crew dragged you back to the safehouse.';
  $('over-screen').style.display = 'flex';
}

function respawn() {
  const wasBusted = G.over === 'busted';
  if (player.inCar && player.car) { G.parked.push(player.car); player.car.speed = 0; }
  player.inCar = false; player.car = null;
  player.x = 10; player.z = 100; player.y = 0; player.heading = 1.1;
  player.group.visible = true;
  clearPolice();
  G.wanted = 0; G.wantedHeat = 0; G.bustT = 0;
  G.health = 100; G.armour = 50;
  if (wasBusted) G.money = Math.max(0, G.money - 200);
  G.over = false; overShown = false;
  $('over-screen').style.display = 'none';
  sfxClick();
}

$('btn-new').addEventListener('click', () => startGame(false));
$('btn-continue').addEventListener('click', () => startGame(true));
$('btn-resume').addEventListener('click', togglePause);
$('btn-pause-stats').addEventListener('click', showStats);
$('btn-stats-close').addEventListener('click', () => { $('stats-screen').style.display = 'none'; });
$('btn-pause-save').addEventListener('click', (e) => {
  saveGame();
  e.target.textContent = 'SAVED ✓';
  setTimeout(() => { e.target.textContent = 'SAVE GAME'; }, 1200);
});
$('btn-pause-mute').addEventListener('click', (e) => {
  setMuted(!G.muted);
  e.target.textContent = G.muted ? 'UNMUTE' : 'MUTE';
});
$('btn-pause-quit').addEventListener('click', () => location.reload());
$('btn-respawn').addEventListener('click', respawn);
if (hasSave()) $('btn-continue').style.display = 'block';

// Screenshot staging: skip the menu, arrange the scene, hold the camera.
if (SHOT) {
  $('title-menu').style.display = 'none';
  $('hud').style.display = 'block';
  G.started = true;
  stageShot(SHOT);
  if (G.shotCam) camera.position.copy(G.shotCam.pos);
  setTimeout(() => { window.__shotReady = true; }, 700);
}

window.__game = { G, player, world, scene, audioState };
window.__ready = true;

let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (G.started && !G.paused && !G.over) {
    G.time += dt;
    G.clock += dt / 120;
    if (G.clock >= 24) { G.clock -= 24; G.day++; }
    G.dialogueT -= dt; G.bannerT -= dt; G.hurtT -= dt;
    G.boostT = Math.max(0, G.boostT - dt);
    for (const c of G.crew) c.cd = Math.max(0, c.cd - dt);
    if (G.health > 0 && G.health < 100 && G.wanted === 0) G.health = Math.min(100, G.health + 2 * dt);
    if (mouseDown && WEAPONS[G.weapon].auto) doShoot();
    updatePlayer(dt, input);
    updateTraffic(dt);
    updatePeds(dt);
    updatePolice(dt);
    updateMissions(dt);
    updateWorld(dt, scene);
    updateAudio(dt);
    updateHUD(dt);
    updateCamera(dt);
    if (G.missionsDone !== lastMissionsDone) { lastMissionsDone = G.missionsDone; saveGame(); }
    if (G.health <= 0 && !G.over) G.over = 'wasted';
  } else if (!G.started) {
    const t = now / 1000;
    camera.position.set(30 + Math.cos(t * 0.05) * 115, 58, 60 + Math.sin(t * 0.05) * 115);
    camera.lookAt(-40, 0, 80);
    updateWorld(dt, scene);
  }
  if (G.over && !overShown) { showOver(); overShown = true; }
  renderer.render(scene, camera);
}
requestAnimationFrame(loop);
