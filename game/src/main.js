// Crimson Harbor — entry point. Wires the renderer, the world, the HUD and the screens,
// runs the game loop, and handles title / pause / stats / wasted flows and autosave.
import * as THREE from 'three';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { buildCity } from './city.js';
import { initTraffic, updateTraffic } from './traffic.js';
import { initPedestrians, updatePedestrians } from './pedestrians.js';
import { createPlayer, updatePlayer } from './player.js';
import { initPolice } from './police.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createMinimap } from './minimap.js';
import { createCamera } from './camera.js';
import { createParticles } from './particles.js';
import { stageShot, shotAutopilot } from './shots.js';
import { loadSave, writeSave, clearSave, hasSave } from './save.js';
import { mulberry32 } from './util.js';
import { MISSIONS, RANK_RP } from './config.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');
const SEED = parseInt(params.get('seed') || '7', 10) || 7;

// Software renderers (SwiftShader/llvmpipe) cannot afford antialiasing, shadows or
// supersampling in interactive play, so drop all three there — but keep full quality for
// the staged screenshots, where frame rate does not matter and the polish shows.
function isSoftwareGL() {
  try {
    const c = document.createElement('canvas');
    const g = c.getContext('webgl2') || c.getContext('webgl');
    const ext = g.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? String(g.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
    return /swiftshader|llvmpipe|softpipe|software/i.test(name);
  } catch { return false; }
}
const softwareGL = isSoftwareGL();
const NORENDER = params.get('norender') === '1'; // debug: run the logic without WebGL
const renderer = new THREE.WebGLRenderer({ antialias: !(softwareGL && !SHOT), powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
if (softwareGL && !SHOT) {
  renderer.shadowMap.enabled = false;
  renderer.setPixelRatio(1);
}
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.domElement.className = 'game';
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 180, 520);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 900);

const G = {
  scene, camera, renderer, seed: SEED, rng: mulberry32(SEED),
  shot: SHOT, screen: SHOT ? 'play' : 'title',
  cars: [], traffic: [], parked: [], peds: [],
  clockHour: 10, isNight: false, shake: 0, hudFlash: 0, interactText: '',
  missionsDone: [], mission: null, trust: {}, radioStation: 0,
  camYaw: 0, districtName: 'MARINA BAY', hudDirty: false,
  stats: { missionsPassed: 0, carsStolen: 0, shotsFired: 0, pedsHit: 0, distanceDriven: 0, distanceWalked: 0, moneyEarned: 0 },
  settings: { master: 0.8, music: 0.6, sfx: 0.9, shake: true, hint: true },
  nextMissionName() {
    const n = MISSIONS.find((m) => !G.missionsDone.includes(m.id));
    return n ? n.name : null;
  },
};
G.input = createInput();
G.audio = createAudio();
G.player = createPlayer(G);
G.police = initPolice(G);
G.missions = createMissions(G);
G.hud = createHud(G);
G.minimap = createMinimap();
G.particles = createParticles(G);
G.cameraCtl = createCamera(G);
G.notify = (t) => G.hud.notify(t);
G.banner = (t, s) => G.hud.banner(t, s);
G.showDialogue = (n, t, s) => G.hud.showDialogue(n, t, s);
G.showInteract = (t) => { G.interactText = t; };
G.hideInteract = () => { G.interactText = ''; };
G.endGame = (kind, sub) => {
  if (G.shot) return; // staged shots never end
  G.screen = 'end';
  document.getElementById('endtext').textContent = kind;
  document.getElementById('endsub').textContent = sub;
  showMenu('end');
  G.audio.fail();
};
buildCity(G);
initTraffic(G, 18);
initPedestrians(G, 30);
G.hud.init();

// Lights: sun + hemisphere; the sun swings with the in-game clock.
const sun = new THREE.DirectionalLight(0xfff2d9, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -90; sun.shadow.camera.right = 90;
sun.shadow.camera.top = 90; sun.shadow.camera.bottom = -90;
sun.shadow.camera.far = 400;
scene.add(sun); scene.add(sun.target);
const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x8a7a5a, 0.9);
scene.add(hemi);
const moon = new THREE.DirectionalLight(0x8fb4ff, 0.0);
scene.add(moon);
// The player's headlights at night: one spotlight, re-parented to the driven car.
const headlight = new THREE.SpotLight(0xfff6c9, 0, 70, 0.55, 0.6, 1.1);
const headTarget = new THREE.Object3D();
headTarget.position.set(0, 0, 25);
headlight.target = headTarget;
let headCar = null;
function updateSky() {
  const h = G.clockHour;
  const day = h >= 6 && h < 19.5;
  G.isNight = !day;
  // Sun angle: rises 06:00, sets 19:30.
  const t = day ? (h - 6) / 13.5 : 0;
  const ang = Math.PI * (0.08 + t * 0.84);
  const px = G.player.pos.x, pz = G.player.pos.z;
  sun.position.set(px + Math.cos(ang) * 140, Math.sin(ang) * 160 + 20, pz + 60);
  sun.target.position.set(px, 0, pz);
  sun.intensity = day ? 2.4 + Math.sin(ang) * 0.6 : 0;
  moon.position.set(px - 80, 120, pz - 60);
  moon.intensity = day ? 0 : 0.85;
  hemi.intensity = day ? 0.9 : 0.55;
  const sky = day ? new THREE.Color(0x87ceeb) : new THREE.Color(0x0b1026);
  const dusk = h >= 17 && h < 19.5;
  if (dusk) sky.setHex(0xf4a261).lerp(new THREE.Color(0x87ceeb), (19.5 - h) / 2.5);
  scene.background = sky;
  scene.fog.color = sky;
  // Streetlights + neon at night.
  for (const l of G.lamps) l.material = G.isNight ? G.lampMat : G.lampOff;
  if (G.beacon) G.beacon.material.color.setHex(G.isNight ? 0xff2e63 : 0x881122);
}
// Water shimmer + boat bob.
function updateWater(t) {
  if (!G.water) return;
  G.water[0].material.opacity = 0.9 + Math.sin(t * 0.7) * 0.03;
  if (G.boats) for (let i = 0; i < G.boats.length; i++) {
    G.boats[i].position.y = 0.4 + Math.sin(t * 0.8 + i) * 0.15;
    G.boats[i].rotation.z = Math.sin(t * 0.6 + i * 2) * 0.02;
  }
}

const $ = (id) => document.getElementById(id);
function showMenu(name) {
  for (const id of ['title', 'settings', 'pause', 'stats', 'end']) $(id).classList.toggle('show', id === name);
  $('hud').style.display = G.screen === 'play' ? 'block' : 'none';
  if (name === 'title') { G.screen = 'title'; $('hud').style.display = 'none'; }
}
function startGame(fresh) {
  G.audio.ensure();
  if (fresh) {
    clearSave();
    const p = G.player;
    Object.assign(p, { money: 250, rp: 0, rank: 1, health: 100, armour: 0, wanted: 0, weapon: 0 });
    p.ammo = [{ mag: Infinity, reserve: Infinity }, { mag: 12, reserve: 96 }, { mag: 30, reserve: 180 }];
    G.missionsDone = []; G.mission = null; G.trust = {};
    G.police.clearAll();
    G.missions.fail();
    p.pos.set(-150, 0, -120); p.heading = Math.PI / 2; p.car = null; p.mesh.visible = true;
    p.mesh.position.copy(p.pos);
    G.clockHour = 10;
  } else {
    const s = loadSave();
    if (s) {
      const p = G.player;
      p.money = s.money; p.rp = s.rp; p.rank = s.rank;
      p.health = s.health; p.armour = s.armour; p.wanted = s.wanted;
      p.pos.set(s.x, 0, s.z); p.heading = s.heading;
      p.ammo = s.ammo; p.weapon = s.weapon;
      G.missionsDone = s.missionsDone || []; G.trust = s.trust || {};
      G.clockHour = s.hour || 10; G.radioStation = s.radio || 0;
      Object.assign(G.stats, s.stats || {});
      p.mesh.position.copy(p.pos);
    }
  }
  G.screen = 'play';
  showMenu('');
  G.cameraCtl.snap();
  if (fresh) {
    G.showDialogue('GUS HARLOW', 'Kai! You are out. Get yourself to my shop — I have got work, and the Harbor has not waited for anyone.', 8);
    G.banner('CRIMSON HARBOR', 'A new life starts at Harlow Auto Works');
  }
  writeSave(G);
}
function openStats() {
  const s = G.stats, p = G.player;
  const rows = [
    ['Missions passed', s.missionsPassed + ' / 4'],
    ['Cash', '$' + Math.floor(p.money).toLocaleString('en-US')],
    ['Rank', p.rank + ' · ' + p.rp.toLocaleString('en-US') + ' RP'],
    ['Cars stolen', s.carsStolen],
    ['Shots fired', s.shotsFired],
    ['Pedestrians hit', s.pedsHit],
    ['Distance driven', (s.distanceDriven / 1000).toFixed(1) + ' km'],
    ['Distance walked', (s.distanceWalked / 1000).toFixed(1) + ' km'],
    ['Wanted level', p.wanted + ' / 5'],
    ['District', G.districtName + ' · Trust ' + (G.trust[G.districtName] ?? 50)],
  ];
  $('statgrid').innerHTML = rows.map((r) => '<div class="srow"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>').join('');
  showMenu('stats');
}
// Menu wiring.
$('btncontinue').disabled = !hasSave() && !SHOT;
$('btncontinue').addEventListener('click', () => startGame(false));
$('btnnew').addEventListener('click', () => startGame(true));
$('btnsettings').addEventListener('click', () => showMenu('settings'));
$('btnsettingsback').addEventListener('click', () => showMenu(G.screen === 'play' || G.screen === 'pause' ? 'pause' : 'title'));
$('btnresume').addEventListener('click', () => { G.screen = 'play'; showMenu(''); });
$('btnpauseset').addEventListener('click', () => showMenu('settings'));
$('btnquit').addEventListener('click', () => { writeSave(G); G.screen = 'title'; showMenu('title'); $('btncontinue').disabled = !hasSave(); });
$('btnstatsback').addEventListener('click', () => { G.screen = 'play'; showMenu(''); });
$('btnrespawn').addEventListener('click', () => {
  const p = G.player;
  p.health = 100; p.armour = 0; p.wanted = 0; p.invuln = 3;
  if (p.car) { p.car = null; p.mesh.visible = true; }
  p.pos.set(-150, 0, -120); p.heading = Math.PI / 2;
  p.mesh.position.copy(p.pos);
  G.police.clearAll();
  G.missions.fail();
  G.screen = 'play'; showMenu('');
  G.cameraCtl.snap();
});
for (const [id, key] of [['volmaster', 'master'], ['volmusic', 'music'], ['volsfx', 'sfx']]) {
  $(id).addEventListener('input', (e) => {
    G.settings[key] = e.target.value / 100;
    G.audio.setVolumes({ master: G.settings.master, music: G.settings.music, sfx: G.settings.sfx });
  });
}
$('optshake').addEventListener('change', (e) => { G.settings.shake = e.target.checked; });
$('opthint').addEventListener('change', (e) => { G.settings.hint = e.target.checked; $('hint').style.display = G.settings.hint && !G.shot ? 'block' : 'none'; });

// Shot mode: hide the controls hint, skip the title, stage the scene.
if (SHOT) {
  $('hint').style.display = 'none';
  $('hud').style.display = 'block';
  G.screen = 'play';
  showMenu('');
  stageShot(SHOT, G);
  updateSky();
} else {
  $('btncontinue').disabled = !hasSave();
}

// Debug handle for playtests (read-only state + a ready flag).
window.__game = {
  get screen() { return G.screen; },
  get wanted() { return G.player.wanted; },
  get money() { return G.player.money; },
  get health() { return G.player.health; },
  get inCar() { return !!G.player.car; },
  get carName() { return G.player.car ? G.player.car.def.name : null; },
  get carDamage() { return G.player.car ? G.player.car.damage : 0; },
  get speed() { return G.player.car ? G.player.car.speed : 0; },
  get x() { return G.player.pos.x; },
  get z() { return G.player.pos.z; },
  get heading() { return G.player.heading; },
  get camYaw() { return G.camYaw; },
  get mission() { return G.mission ? { id: G.mission.def.id, stage: G.mission.stage, timer: G.mission.timer, name: G.mission.def.name } : null; },
  get marker() { return G.mission ? G.mission.def.stages[G.mission.stage] : (G.missions.marker && G.missions.marker.visible ? { x: G.missions.marker.position.x, z: G.missions.marker.position.z } : null); },
  get missionsDone() { return G.missionsDone.slice(); },
  get policeCount() { return G.police.cars.length + G.police.foot.length + (G.police.heli ? 1 : 0); },
  get heli() { return !!G.police.heli; },
  get ammo() { return G.player.ammo.map((a) => ({ mag: a.mag, reserve: a.reserve })); },
  get weapon() { return G.player.weapon; },
  get clockHour() { return G.clockHour; },
  get isNight() { return G.isNight; },
  get nearCar() { return G.nearCar ? G.nearCar.def.name : null; },
  get missionCar() { return G.missions.markerCar ? { x: G.missions.markerCar.x, z: G.missions.markerCar.z } : null; },
};
window.__ready = false;

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

let last = performance.now();
let saveTimer = 0;
let hudTimer = 1; // start past the threshold so the HUD draws on the first frame
let hudDrawn = false;
function loop(now) {
  requestAnimationFrame(loop);
  // try/finally: a single update error must never leave the pressed-key set dirty,
  // or the same key would fire again next frame (e.g. re-entering a just-exited car).
  try {
  // Clamp both ways: right after a navigation the first rAF timestamp can sit seconds
  // behind performance.now(), and a negative dt would run every timer backwards.
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
  last = now;
  const input = G.input;
  const screenAtStart = G.screen;
  // Esc / Tab toggle out of pause and stats from anywhere.
  if (G.screen === 'stats' && (input.hit('Escape') || input.hit('Tab'))) { G.screen = 'play'; showMenu(''); }
  if (G.screen === 'pause' && input.hit('Escape')) { G.screen = 'play'; showMenu(''); }
  if (G.screen === 'play') {
    // In-game clock: 1 game hour per 4 real minutes.
    G.clockHour = (G.clockHour + dt / 240) % 24;
    updateSky();
    updateWater(now / 1000);
    G.interactText = '';
    if (!G.shot) G.missions.update(dt); // first: its prompt wins over the car prompt
    if (G.shot) shotAutopilot(G, dt);
    else updatePlayer(G, dt);
    updateTraffic(G, dt);
    updatePedestrians(G, dt);
    G.police.update(dt);
    G.particles.update(dt);
    // Car prompt when on foot near a car (missions may override via interactText).
    if (!G.interactText && G.nearCar && !G.player.car) {
      G.interactText = 'Press <b>E</b> — Get in the ' + G.nearCar.def.name;
    }
    // Radio station switch + rank ups.
    if (input.hit('KeyQ')) {
      G.radioStation = (G.radioStation + 1) % 3;
      G.notify('RADIO — ' + ['HARBOR FM 101.2', 'WAVE RADIO 88.4', 'STATIC FM 93.9'][G.radioStation]);
    }
    if (input.hit('KeyM')) { G.audio.radioOn = !G.audio.radioOn; G.notify(G.audio.radioOn ? 'Radio on' : 'Radio off'); }
    const p = G.player;
    while (p.rank < RANK_RP.length && p.rp >= RANK_RP[p.rank]) {
      p.rank++;
      G.banner('RANK UP', 'You are now Rank ' + p.rank + ' — the Harbor knows your name');
      G.audio.jingle();
    }
    // Only (re-)open pause/stats on a key pressed while already playing: the same
    // Escape that resumes from pause must not instantly pause again.
    if ((input.hit('Escape') || input.hit('KeyP')) && screenAtStart === 'play') { G.screen = 'pause'; showMenu('pause'); writeSave(G); }
    if (input.hit('Tab') && screenAtStart === 'play') { G.screen = 'stats'; openStats(); }
    // Headlights follow the driven car at night.
    if (G.player.car && G.isNight) {
      if (headCar !== G.player.car) {
        headCar = G.player.car;
        headCar.mesh.add(headlight); headlight.position.set(0, 1.6, 2.2);
        headCar.mesh.add(headTarget);
      }
      headlight.intensity = 220;
    } else headlight.intensity = 0;
    G.cameraCtl.update(dt);
    // The HUD and minimap refresh at 10 Hz: text and dots do not need every frame,
    // and DOM + canvas writes are the most expensive work per frame on weak machines.
    hudTimer += dt;
    if (hudTimer >= 0.1 || !hudDrawn) {
      G.hud.update(hudTimer);
      G.minimap.draw(G);
      hudTimer = 0;
      hudDrawn = true;
    }
    G.audio.update(dt, G);
    saveTimer += dt;
    if (saveTimer > 12) { saveTimer = 0; writeSave(G); }
    // End-of-frame: parked car damage smoke.
    for (const c of G.cars) {
      if (c.dead && Math.random() < 0.3) G.particles.smoke(c.x, 1.2, c.z);
      else if (c.damage > 70 && Math.random() < 0.1) G.particles.smoke(c.x, 1.2, c.z);
    }
  } else if (G.screen === 'title') {
    updateSky();
    updateWater(now / 1000);
    updateTraffic(G, dt);
    updatePedestrians(G, dt);
    G.particles.update(dt);
    G.cameraCtl.update(dt);
  }
  if (!G.settings.shake) G.shake = 0;
  if (!NORENDER) renderer.render(scene, camera);
  if (!window.__ready) window.__ready = true;
  } finally { G.input.endFrame(); }
}
requestAnimationFrame(loop);
