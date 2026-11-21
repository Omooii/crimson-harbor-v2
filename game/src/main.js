// Crimson Harbor — main game: boot, loop, input, player, camera, combat,
// crew abilities, wanted heat, missions, save/load, menus.
import { clamp, mulberry32, pick } from './util.js';
import { World, districtAt, streetAt } from './world.js';
import { Car, Traffic, CAR_NAMES } from './vehicles.js';
import { Pedestrians, makePersonMesh } from './people.js';
import { Police } from './police.js';
import { MissionEngine, MISSIONS, CREW } from './missions.js';
import { HUD, WEAPONS, rankFor } from './hud.js';
import { AudioEngine } from './audio.js';
import { stageShot } from './shots.js';

const SAVE_KEY = 'crimson-harbor-save-v5';
const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');

const S = {
  money: 1250, rp: 240, hp: 100, armour: 50,
  weapon: 0, ammo: [Infinity, Infinity, 120, 240, 90, 0],
  stats: { carsStolen: 0, copsEvaded: 0, distDriven: 0, distWalked: 0, shotsFired: 0, playTime: 0, topSpeed: 0, maxStars: 0 },
  boostUntil: 0, cooldowns: { mara: 0, dex: 0, rosa: 0 },
  paused: false, started: false, over: false, overTimer: 0,
};

class Game {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('app').appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 1500);
    this.camera.position.set(280, 8, 90);
    this.world = new World(this.scene);
    this.traffic = new Traffic(this.scene, this.world, 12);
    this.peds = new Pedestrians(this.scene, this.world, 26);
    this.audio = new AudioEngine();
    this.police = new Police(this.scene, this.world, this.audio);
    this.missions = new MissionEngine();
    this.hud = new HUD();
    this.keys = {};
    this.camMode = 0; this.camYaw = 0; this.camDist = [9.5, 13, 6][0];
    this.time = 0; this.saveTimer = 0; this.nextMissionTimer = 0;
    this.parked = [];
    this.tracer = null;
    this.setupPlayer();
    this.setupParkedCars();
    this.setupMarker();
    this.wireMenus();
    this.wireInput();
    this.wireMissions();
    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });
    // expose state for playtests
    window.__game = { S, game: this };
    if (SHOT) this.startShotMode();
    else this.showTitle();
    this.renderer.setAnimationLoop(() => this.loop());
  }
  setupPlayer() {
    this.player = {
      x: 280, z: 64, heading: Math.PI, speed: 0, inCar: false, car: null,
      mesh: makePersonMesh(mulberry32(1), { shirt: 0xd43a3a, pants: 0x2a3a5c, skin: 0xe8b48a, cap: true }),
    };
    this.player.mesh.position.set(280, 0, 64);
    this.scene.add(this.player.mesh);
    // starter car parked beside the player (within E range)
    this.starterCar = new Car(this.scene, 277.5, 60, Math.PI, 'Vortex GT', 0xd43a3a, false);
  }
  setupParkedCars() {
    const spots = [
      [160, -80, 0, 'Vortex GT', 0xffd166, 'target'],   // M2 steal target
      [-80, 96, Math.PI / 2, 'Coral Coupe', 0x4ecdc4, ''],
      [80, 96, -Math.PI / 2, 'Sunset Cruiser', 0xff8fab, ''],
      [-240, 144, 0, 'Pelican Van', 0x7fd1ff, ''],
      [240, -160, Math.PI, 'Midnight Falcon', 0x2a3a5c, ''],
    ];
    for (const [x, z, h, name, color, tag] of spots) {
      const c = new Car(this.scene, x, z, h, name, color, false);
      c.tag = tag;
      this.parked.push(c);
    }
  }
  setupMarker() {
    const g = new THREE.Group();
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 40, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd75e, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
    beam.position.y = 20; g.add(beam);
    const dia = new THREE.Mesh(new THREE.OctahedronGeometry(1.6),
      new THREE.MeshBasicMaterial({ color: 0xffd75e }));
    dia.position.y = 7; g.add(dia);
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.4, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd75e, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.15; g.add(ring);
    g.userData.dia = dia;
    g.visible = false;
    this.scene.add(g);
    this.marker = g;
  }
  wireMenus() {
    const play = () => { this.audio.init(); this.newGame(false); };
    document.getElementById('btn-play').onclick = play;
    document.getElementById('btn-continue').onclick = () => { this.audio.init(); this.loadGame() || this.newGame(false); };
    document.getElementById('btn-freeroam').onclick = () => { this.audio.init(); this.newGame(true); };
    document.getElementById('btn-resume').onclick = () => this.setPaused(false);
    document.getElementById('btn-save').onclick = () => { this.saveGame(); this.hud.centerMessage('GAME SAVED', 'Progress stored on this device', 2); };
    document.getElementById('btn-quit').onclick = () => { this.saveGame(); this.setPaused(false); this.showTitle(); };
  }
  wireInput() {
    addEventListener('keydown', e => {
      if (e.code === 'Tab') e.preventDefault();
      if (e.repeat) return;
      this.keys[e.code] = true;
      if (!S.started) return;
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (document.getElementById('stats').classList.contains('on')) this.hud.hideStats();
        else this.setPaused(!S.paused);
      }
      if (S.paused || S.over) return;
      if (e.code === 'Tab') {
        const on = document.getElementById('stats').classList.contains('on');
        if (on) this.hud.hideStats(); else this.hud.showStats({ money: S.money, rp: S.rp, missions: this.missions, stats: S.stats });
      }
      if (document.getElementById('stats').classList.contains('on')) return;
      if (e.code === 'KeyE') this.pressE();
      if (e.code === 'KeyF') this.attack();
      if (e.code === 'KeyQ') this.cycleWeapon(1);
      if (e.code === 'KeyR') { const s = this.audio.nextStation(); const l = this.audio.stationLabel(); this.hud.setRadio(l.name, l.line); }
      if (e.code === 'KeyM') this.startNextMission();
      if (e.code === 'KeyV') { this.camMode = (this.camMode + 1) % 3; this.camDist = [9.5, 14, 6.5][this.camMode]; }
      if (e.code === 'KeyZ') this.crewAbility('mara');
      if (e.code === 'KeyX') this.crewAbility('dex');
      if (e.code === 'KeyC') this.crewAbility('rosa');
      if (e.code.startsWith('Digit')) {
        const n = Number(e.code.slice(5));
        if (n >= 1 && n <= 6) this.selectWeapon(n - 1);
      }
    });
    addEventListener('keyup', e => { this.keys[e.code] = false; });
    // mouse: click to attack, drag to orbit camera
    let dragging = false, lx = 0;
    this.renderer.domElement.addEventListener('pointerdown', e => { dragging = true; lx = e.clientX; if (S.started && !S.paused) this.attack(); });
    addEventListener('pointermove', e => { if (dragging) { this.camYaw += (e.clientX - lx) * 0.005; lx = e.clientX; } });
    addEventListener('pointerup', () => { dragging = false; });
  }
  wireMissions() {
    const M = this.missions;
    M.onDialogue = (who, line, portrait) => this.hud.showDialogue(who, line, portrait, 5.5);
    M.onStart = (m, i) => { this.hud.centerMessage('MISSION ' + (i + 1) + ' — ' + m.name.toUpperCase(), 'Pay ' + m.pay.toLocaleString('en-US') + ' · ' + Math.floor(m.time / 60) + ' minutes', 3.5); };
    M.onComplete = (m, idx) => {
      S.money += m.pay; S.rp += Math.round(m.pay / 10);
      this.audio.cash();
      this.hud.centerMessage('MISSION PASSED', m.name + ' · +' + m.pay.toLocaleString('en-US'), 4);
      this.saveGame();
      this.nextMissionTimer = 4.5;
    };
    M.onFail = (m, reason) => {
      this.audio.fail();
      this.hud.centerMessage('MISSION FAILED', reason + ' — press M to retry', 4);
    };
    this.police.onBusted = () => this.busted();
    this.police.onWantedChange = (nw, old) => {
      if (nw === 0 && old > 0) { S.stats.copsEvaded++; S.rp += 50; this.hud.centerMessage('YOU LOST THEM', '+50 RP', 2.5); }
    };
  }
  showTitle() {
    S.started = false;
    document.getElementById('title').classList.add('on');
    document.getElementById('hud').classList.remove('on');
  }
  startGame() {
    S.started = true;
    document.getElementById('title').classList.remove('on');
    document.getElementById('hud').classList.add('on');
  }
  newGame(freeRoam) {
    S.money = 1250; S.rp = 240; S.hp = 100; S.armour = 50;
    S.ammo = [Infinity, Infinity, 120, 240, 90, 0]; S.weapon = 0;
    this.missions.completed = [false, false, false, false];
    this.missions.freeRoam = freeRoam;
    this.missions.index = -1; this.missions.active = false;
    this.police.setWanted(0); this.police.clearAll();
    this.startGame();
    if (!freeRoam) this.missions.start(0);
    else this.hud.centerMessage('FREE ROAM', 'Press M to start the next mission', 3);
  }
  startNextMission() {
    if (this.missions.active) { this.hud.centerMessage('MISSION IN PROGRESS', 'Finish the current job first', 2); return; }
    const n = this.missions.nextIndex;
    if (n === -1) { this.hud.centerMessage('ALL MISSIONS COMPLETE', 'The harbor is yours — free roam forever', 3); return; }
    this.missions.start(n);
  }
  setPaused(p) {
    S.paused = p;
    document.getElementById('pause').classList.toggle('on', p);
    if (p) document.getElementById('pause-info').textContent =
      `${rankFor(S.rp)} · $${S.money.toLocaleString('en-US')} · ${this.missions.completed.filter(Boolean).length}/4 missions complete`;
  }
  saveGame() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        money: S.money, rp: S.rp, hp: S.hp, armour: S.armour, ammo: S.ammo, weapon: S.weapon,
        completed: this.missions.completed, stats: S.stats,
        px: this.player.x, pz: this.player.z, time: this.world.time,
      }));
    } catch (e) {}
  }
  loadGame() {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (!d) return false;
      S.money = d.money; S.rp = d.rp; S.hp = d.hp; S.armour = d.armour;
      S.ammo = d.ammo; S.weapon = d.weapon;
      this.missions.completed = d.completed || [false, false, false, false];
      Object.assign(S.stats, d.stats || {});
      this.player.x = d.px ?? 280; this.player.z = d.pz ?? 64;
      this.world.time = d.time ?? 18.3;
      this.police.setWanted(0); this.police.clearAll();
      this.startGame();
      this.hud.centerMessage('SAVE LOADED', 'Welcome back to Crimson Harbor', 3);
      return true;
    } catch (e) { return false; }
  }
  startShotMode() {
    this.audio.init();
    this.newGame(true);
    this.hud.setHint(false);
    stageShot(SHOT, this, S);
    // let the world settle, then signal readiness
    setTimeout(() => { window.__shotReady = true; }, 900);
  }
  // --- interaction ---
  nearestCar(maxD) {
    const p = this.player;
    let best = null, bestD = maxD;
    const all = [...this.parked, this.starterCar, ...this.traffic.cars];
    for (const c of all) {
      if (c === p.car) continue;
      const d = Math.hypot(c.x - p.x, c.z - p.z);
      if (d < bestD) { best = c; bestD = d; }
    }
    return best;
  }
  pressE() {
    const p = this.player;
    // mission interact stage
    const m = this.missions, sd = m.stageDef;
    if (m.active && sd && sd.type === 'interact') {
      const d = Math.hypot(p.x - sd.x, p.z - sd.z);
      if (d < sd.r + 6) { // generous: driving up to the marker is enough
        this.audio.pickup();
        if (m.index === 3 && m.stage === 1) { this.police.setWanted(4); }
        m.advance();
        return;
      }
    }
    if (p.inCar) {
      // exit car
      const c = p.car;
      p.inCar = false; p.car = null; p.speed = 0;
      p.x = c.x + Math.cos(c.heading) * 3; p.z = c.z - Math.sin(c.heading) * 3;
      p.heading = c.heading;
      p.mesh.visible = true;
      p.mesh.position.set(p.x, 0, p.z);
      return;
    }
    const car = this.nearestCar(7);
    if (car) this.enterCar(car);
  }
  enterCar(car) {
    const p = this.player;
    p.inCar = true; p.car = car; p.mesh.visible = false;
    p.heading = car.heading;
    car.speed = Math.min(car.speed, 5);
    if (this.traffic.cars.includes(car)) {
      // stealing a traffic car
      this.traffic.cars.splice(this.traffic.cars.indexOf(car), 1);
      S.stats.carsStolen++;
      if (this.police.wanted === 0 && this.police.nearestDist(p.x, p.z) < 60) this.police.addHeat(8);
      this.traffic.spawn();
    }
    if (car.tag === 'target') {
      const m = this.missions;
      if (m.active && m.index === 1 && m.stage === 0) {
        this.police.setWanted(2);
        m.advance();
      }
    }
    this.audio.blip(440, 0.08, 0.12);
  }
  selectWeapon(i) {
    const w = WEAPONS[i];
    if (!w || w.locked) { if (w) this.hud.centerMessage(w.name + ' LOCKED', 'Unlock at ' + w.unlock, 1.5); return; }
    S.weapon = i;
    this.hud.setWeapon(i, S.ammo[i]);
    this.audio.blip(700, 0.05, 0.08);
  }
  cycleWeapon(d) {
    let i = S.weapon;
    for (let k = 0; k < 6; k++) { i = (i + d + 6) % 6; if (!WEAPONS[i].locked) break; }
    this.selectWeapon(i);
  }
  attack() {
    if (!S.started || S.paused || S.over) return;
    const w = WEAPONS[S.weapon];
    const p = this.player;
    const ox = p.inCar ? p.car.x : p.x, oz = p.inCar ? p.car.z : p.z;
    const oh = p.inCar ? p.car.heading : p.heading;
    if (w.ammo !== Infinity) {
      if (S.ammo[S.weapon] <= 0) { this.audio.blip(200, 0.06, 0.1); this.hud.centerMessage('OUT OF AMMO', w.name, 1); return; }
      S.ammo[S.weapon]--;
      this.hud.setWeapon(S.weapon, S.ammo[S.weapon]);
      S.stats.shotsFired++;
      this.audio.shot();
    } else this.audio.punch();
    // tracer
    this.showTracer(ox, oz, oh, w.range);
    // hit peds
    const ped = this.peds.hitTest(ox, oz, oh, w.range);
    if (ped) {
      ped.hp -= w.dmg;
      if (ped.hp <= 0) { this.peds.kill(ped); this.police.addHeat(10); }
      else ped.panic = 1;
    }
    // hit cars (incl. police)
    for (const c of [...this.traffic.cars, ...this.parked, ...this.police.cruisers.map(u => u.car)]) {
      if (c === p.car) continue;
      const dx = c.x - ox, dz = c.z - oz, d = Math.hypot(dx, dz);
      if (d > w.range) continue;
      const dot = (dx * Math.sin(oh) + dz * Math.cos(oh)) / Math.max(d, 0.001);
      if (dot > 0.9) {
        c.damage = Math.min(100, c.damage + w.dmg * 0.4);
        if (c.police) this.police.addHeat(14);
        else if (w.dmg > 20) this.police.addHeat(4);
        break;
      }
    }
    if (w.dmg >= 25) this.police.addHeat(2); // gunfire draws attention
  }
  showTracer(x, z, heading, range) {
    if (this.tracer) { this.scene.remove(this.tracer); }
    const g = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x, 1.4, z),
      new THREE.Vector3(x + Math.sin(heading) * range, 1.4, z + Math.cos(heading) * range),
    ]);
    this.tracer = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9 }));
    this.scene.add(this.tracer);
    setTimeout(() => { if (this.tracer) { this.scene.remove(this.tracer); this.tracer = null; } }, 70);
  }
  crewAbility(id) {
    const now = this.time;
    if (this.time < (S.cooldowns[id] || 0)) { this.hud.centerMessage('ABILITY RECHARGING', Math.ceil(S.cooldowns[id] - now) + 's left', 1.5); return; }
    S.cooldowns[id] = now + 30;
    const c = CREW.find(c => c.id === id);
    if (id === 'mara') { S.boostUntil = now + 10; this.hud.showDialogue(c.name, 'Slipstream! Floor it — I\'ve got the road tuned for you.', c.portrait, 3); }
    if (id === 'dex') { this.police.addHeat(-22); this.hud.showDialogue(c.name, 'Cameras looped, plates spoofed. You\'re a ghost — for now.', c.portrait, 3); }
    if (id === 'rosa') { S.armour = Math.min(100, S.armour + 50); this.hud.showDialogue(c.name, 'Adrenal\'s in. You\'re wearing the harbor now.', c.portrait, 3); }
    this.audio.pickup();
  }
  busted() {
    if (S.over) return;
    S.over = true; S.overTimer = 3;
    this.audio.fail();
    this.hud.centerMessage('BUSTED', 'Harbor PD got you — $500 bail', 3);
    S.money = Math.max(0, S.money - 500);
    this.police.setWanted(0); this.police.clearAll();
  }
  wasted() {
    if (S.over) return;
    S.over = true; S.overTimer = 3;
    this.audio.fail();
    this.hud.centerMessage('WASTED', 'The harbor claims another — $300 hospital bill', 3);
    S.money = Math.max(0, S.money - 300);
    this.police.setWanted(0); this.police.clearAll();
  }
  respawn() {
    S.over = false; S.hp = 100; S.armour = 50;
    const p = this.player;
    if (p.inCar) { p.inCar = false; p.car = null; p.mesh.visible = true; }
    p.x = 0; p.z = 40; p.heading = 0; p.speed = 0;
    p.mesh.position.set(p.x, 0, p.z);
    this.missions.fail('BUSTED');
    this.saveGame();
  }
  // --- per-frame ---
  loop() {
    // Fixed-timestep accumulator: game time tracks real time even when the
    // renderer runs slowly (e.g. software WebGL), so driving, timers and
    // police spawns never run in slow motion.
    const now = performance.now();
    const realDt = Math.min(0.25, this._last ? (now - this._last) / 1000 : 0.016);
    this._last = now;
    if (!S.paused) {
      this._acc = (this._acc || 0) + realDt;
      const step = 1 / 60;
      let n = 0;
      while (this._acc >= step && n < 30) { this.update(step); this._acc -= step; n++; }
      if (n === 30) this._acc = 0;
    }
    this.renderer.render(this.scene, this.camera);
  }
  update(dt) {
    this.time += dt;
    if (this.shotFreeze) { this.updateHUD(); this.hud.update(dt); return; }
    const p = this.player;
    if (S.started) {
      S.stats.playTime += dt;
      this.saveTimer += dt;
      if (this.saveTimer > 30) { this.saveTimer = 0; this.saveGame(); }
    }
    if (S.over) {
      S.overTimer -= dt;
      if (S.overTimer <= 0) this.respawn();
      return;
    }
    // world + ambient life
    const light = this.world.update(S.started ? dt : dt * 0.2, new THREE.Vector3(p.x, 0, p.z));
    this.traffic.update(dt, [{ x: p.x, z: p.z }, ...this.police.cruisers.map(u => u.car)]);
    this.peds.update(dt, p.inCar ? p.car : p);
    // missions
    this.missions.update(dt);
    if (this.nextMissionTimer > 0) {
      this.nextMissionTimer -= dt;
      if (this.nextMissionTimer <= 0 && !this.missions.active && this.missions.nextIndex >= 0) this.missions.start(this.missions.nextIndex);
    }
    // player movement
    if (S.started) {
      if (p.inCar) this.updateDriving(dt);
      else this.updateWalking(dt);
    }
    // police
    const pp = p.inCar ? { x: p.car.x, z: p.car.z, heading: p.car.heading, speed: p.car.speed } : { x: p.x, z: p.z, heading: p.heading, speed: 0 };
    this.police.update(dt, pp, p.inCar);
    S.stats.maxStars = Math.max(S.stats.maxStars, this.police.wanted);
    // police fire on foot at high wanted
    if (this.police.wanted >= 3 && !p.inCar) {
      const nd = this.police.nearestDist(p.x, p.z);
      if (nd < 30) this.damagePlayer(dt * 5);
    }
    // car collisions: player car vs traffic/police
    if (p.inCar) {
      for (const c of [...this.traffic.cars, ...this.police.cruisers.map(u => u.car)]) {
        p.car.bump(c, impact => {
          if (c.police) { this.police.addHeat(6); this.damagePlayer(impact * 0.4); }
          else if (impact > 8) this.police.addHeat(3);
          this.audio.blip(90, 0.1, 0.2, 'sawtooth');
        });
      }
      // running over peds
      for (const ped of this.peds.list) {
        if (ped.dead) continue;
        if (Math.hypot(ped.x - p.car.x, ped.z - p.car.z) < 2.4 && Math.abs(p.car.speed) > 3) {
          this.peds.kill(ped); this.police.addHeat(12);
        }
      }
      if (p.car.damage >= 100) {
        this.hud.centerMessage('CAR WRECKED', 'Find another ride', 2.5);
        p.inCar = false; p.car = null; p.mesh.visible = true;
        p.x += 3; p.mesh.position.set(p.x, 0, p.z);
      }
    }
    // mission stage checks
    this.checkMissionStages();
    // marker
    this.updateMarker();
    // camera
    this.updateCamera(dt);
    // audio engine
    this.audio.setEngine(p.inCar ? p.car.kmh : 0, p.inCar);
    // HUD
    this.updateHUD(light);
    this.hud.update(dt);
  }
  updateDriving(dt) {
    const p = this.player, c = p.car;
    const th = (this.keys['KeyW'] ? 1 : 0) + (this.keys['KeyS'] ? -1 : 0);
    // A turns left, D turns right: with forward=(sin h, cos h), increasing the
    // heading rotates toward +x, which is screen-left when facing +z.
    const st = (this.keys['KeyA'] ? 1 : 0) + (this.keys['KeyD'] ? -1 : 0);
    const boost = this.time < S.boostUntil ? 1.25 : 1;
    const before = { x: c.x, z: c.z };
    c.drive(dt, { throttle: th, steer: st, brake: !!this.keys['Space'] }, this.world);
    if (boost > 1 && th > 0) c.speed = Math.min(c.speed * (1 + dt * 0.4), 52);
    p.x = c.x; p.z = c.z; p.heading = c.heading;
    const moved = Math.hypot(c.x - before.x, c.z - before.z);
    S.stats.distDriven += moved;
    S.stats.topSpeed = Math.max(S.stats.topSpeed, c.kmh);
  }
  updateWalking(dt) {
    const p = this.player;
    const run = this.keys['ShiftLeft'] || this.keys['ShiftRight'];
    const sp = run ? 7.5 : 4.2;
    const fwd = (this.keys['KeyW'] ? 1 : 0) + (this.keys['KeyS'] ? -0.6 : 0);
    const turn = (this.keys['KeyA'] ? 1 : 0) + (this.keys['KeyD'] ? -1 : 0);
    p.heading += turn * 2.4 * dt;
    let moved = 0;
    if (fwd !== 0) {
      const nx = p.x + Math.sin(p.heading) * sp * fwd * dt;
      const nz = p.z + Math.cos(p.heading) * sp * fwd * dt;
      const [cx, cz] = this.world.collide(nx, nz, 0.7);
      moved = Math.hypot(cx - p.x, cz - p.z);
      p.x = cx; p.z = cz;
      S.stats.distWalked += moved;
    }
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.heading;
    const u = p.mesh.userData;
    if (moved > 0.001) {
      u.phase += dt * sp * 2.2;
      u.legL.rotation.x = Math.sin(u.phase) * 0.6;
      u.legR.rotation.x = -Math.sin(u.phase) * 0.6;
    } else { u.legL.rotation.x *= 0.8; u.legR.rotation.x *= 0.8; }
  }
  damagePlayer(n) {
    if (S.armour > 0) { const absorbed = Math.min(S.armour, n); S.armour -= absorbed; n -= absorbed; }
    S.hp -= n;
    if (S.hp <= 0) { S.hp = 0; this.wasted(); }
  }
  checkMissionStages() {
    const m = this.missions;
    if (!m.active) return;
    const sd = m.stageDef;
    const p = this.player;
    const px = p.inCar ? p.car.x : p.x, pz = p.inCar ? p.car.z : p.z;
    if (!sd) return;
    if (sd.type === 'drive' || sd.type === 'goto') {
      if (Math.hypot(px - sd.x, pz - sd.z) < sd.r) {
        this.audio.pickup();
        m.advance();
      }
    } else if (sd.type === 'escape') {
      if (this.police.wanted === 0) { this.audio.pickup(); m.advance(); }
    }
  }
  updateMarker() {
    const m = this.missions;
    const sd = m.active ? m.stageDef : null;
    if (!sd || sd.type === 'escape') { this.marker.visible = false; return; }
    this.marker.visible = true;
    this.marker.position.set(sd.x, 0, sd.z);
    this.marker.userData.dia.rotation.y += 0.03;
    this.marker.userData.dia.position.y = 7 + Math.sin(this.time * 2) * 0.8;
  }
  updateCamera(dt) {
    const p = this.player;
    const px = p.inCar ? p.car.x : p.x, pz = p.inCar ? p.car.z : p.z;
    const heading = p.inCar ? p.car.heading : p.heading;
    // camera yaw eases toward behind-player, plus manual orbit offset
    const targetYaw = heading + Math.PI + this.camYaw;
    let dy = targetYaw - this._camYawA;
    if (this._camYawA === undefined) this._camYawA = targetYaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this._camYawA += dy * Math.min(1, dt * (p.inCar ? 3.2 : 5));
    this.camYaw *= Math.pow(0.4, dt); // orbit offset decays
    const dist = this.camDist + (p.inCar ? Math.min(3, Math.abs(p.car.speed) * 0.06) : 0);
    const h = p.inCar ? 4.6 : 4.2;
    const cx = px + Math.sin(this._camYawA) * dist;
    const cz = pz + Math.cos(this._camYawA) * dist;
    this.camera.position.lerp(new THREE.Vector3(cx, h, cz), Math.min(1, dt * 6));
    this.camera.lookAt(px + Math.sin(heading) * 4, 1.6, pz + Math.cos(heading) * 4);
  }
  updateHUD(light) {
    const p = this.player;
    const px = p.inCar ? p.car.x : p.x, pz = p.inCar ? p.car.z : p.z;
    this.hud.setStars(this.police.wanted);
    this.hud.setWantedBanner(this.police.wanted > 0 && this.police.nearestDist(px, pz) < 45);
    this.hud.setMoney(S.money);
    this.hud.setRank(S.rp);
    this.hud.setClock(this.world.time);
    const m = this.missions.mission;
    const sd = this.missions.stageDef;
    const dist = sd ? Math.hypot(px - sd.x, pz - sd.z) : 0;
    this.hud.setTracker(m, this.missions.stage, this.missions.timeLeft, dist);
    this.hud.setDistrict(districtAt(px, pz), streetAt(px, pz), S.rp);
    this.hud.setPolice(this.police.unitList(px, pz), this.police.wanted);
    this.hud.setVitals(S.hp, S.armour);
    this.hud.setSpeed(p.inCar ? p.car.kmh : 0, p.inCar ? p.car.name : '', p.inCar ? 100 - p.car.damage : 0, p.inCar);
    const target = sd && sd.type !== 'escape' ? [sd.x, sd.z] : null;
    const policePos = this.police.cruisers.map(u => ({ callsign: u.callsign, x: u.car.x, z: u.car.z }));
    if (this.police.heli) policePos.push({ callsign: 'AIR-1', x: this.police.heli.x, z: this.police.heli.z });
    this.hud.drawMinimap(this.world, px, pz, p.heading, p.inCar, policePos, this.traffic.cars, target, this.peds.list);
  }
}

new Game();
