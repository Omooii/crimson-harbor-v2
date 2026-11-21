// Wanted system: stars, pursuing cruisers (ram / flank / roadblock), and a
// helicopter with a visible spotlight beam at 3+ stars.
import { mulberry32, rand, pick, clamp } from './util.js';
import { Car } from './vehicles.js';
import { ROADS, BEACH_X } from './world.js';

const CALLSIGNS = ['HPD-12', 'HPD-07', 'HPD-23', 'HPD-31', 'HPD-04', 'HPD-18', 'HPD-42', 'AIR-1', 'HPD-09', 'HPD-55'];
const ROLES = ['RAMMING', 'FLANKING', 'PURSUIT', 'ROADBLOCK', 'CUTTING OFF', 'FIRING'];

export class Police {
  constructor(scene, world, audio) {
    this.scene = scene; this.world = world; this.audio = audio;
    this.rng = mulberry32(2026);
    this.wanted = 0;      // 0..5 stars
    this.heat = 0;        // 0..100; stars derive from heat
    this.hidden = 0;      // seconds unseen
    this.cruisers = [];   // {car, callsign, role, bustedTimer}
    this.heli = null;     // {group, beam, spot}
    this.busted = 0;      // busted progress 0..1
    this.spawnTimer = 0;
    this.frozen = false;  // screenshot mode: heli only, no spawn/AI
    this.onBusted = null;
    this.onWantedChange = null;
  }
  addHeat(n, reason) {
    const before = this.wanted;
    this.heat = clamp(this.heat + n, 0, 100);
    this.wanted = this.heat <= 0 ? 0 : this.heat < 12 ? 1 : this.heat < 30 ? 2 : this.heat < 52 ? 3 : this.heat < 76 ? 4 : 5;
    this.hidden = 0;
    if (this.wanted !== before && this.onWantedChange) this.onWantedChange(this.wanted, before);
    if (this.wanted > before) this.audio.starUp();
  }
  setWanted(stars) {
    this.heat = [0, 8, 22, 42, 64, 90][stars] || 0;
    this.wanted = stars;
  }
  desiredCruisers() { return this.wanted === 0 ? 0 : this.wanted === 1 ? 2 : this.wanted === 2 ? 3 : this.wanted === 3 ? 4 : 5; }
  spawnCruiser(px, pz) {
    const rng = this.rng;
    // spawn on a road 60–110 m from the player
    for (let tries = 0; tries < 12; tries++) {
      const road = pick(rng, [...ROADS, BEACH_X]);
      const alongX = rng() < 0.5;
      const t = clamp((alongX ? pz : px) + rand(rng, -110, 110), -300, 300);
      const x = alongX ? t : road, z = alongX ? road : t;
      if (Math.hypot(x - px, z - pz) < 55) continue;
      const heading = Math.atan2(px - x, pz - z);
      const car = new Car(this.scene, x, z, heading, 'HPD Interceptor', 0xffffff, true);
      const used = new Set(this.cruisers.map(c => c.callsign));
      let cs = pick(rng, CALLSIGNS);
      while (used.has(cs) || cs === 'AIR-1') cs = pick(rng, CALLSIGNS);
      this.cruisers.push({ car, callsign: cs, role: 'PURSUIT', bustedTimer: 0, ramBoost: 0 });
      return;
    }
  }
  makeHeli() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 5.2), new THREE.MeshLambertMaterial({ color: 0x1a2a44 }));
    body.castShadow = true; g.add(body);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.9, 1.6), new THREE.MeshLambertMaterial({ color: 0x9fd8ff }));
    glass.position.set(0, 0.3, 1.9); g.add(glass);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.5), new THREE.MeshLambertMaterial({ color: 0x1a2a44 }));
    tail.position.set(0, 0.2, -4.4); g.add(tail);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.08, 0.5), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    rotor.position.y = 1.1; g.add(rotor);
    const rotor2 = rotor.clone(); rotor2.rotation.y = Math.PI / 2; g.add(rotor2);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    lamp.position.set(0, -0.9, 1.5); g.add(lamp);
    g.userData = { rotor, rotor2 };
    this.scene.add(g);
    // spotlight beam: scene-level additive cone from heli down to the player
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const beam = new THREE.Mesh(new THREE.ConeGeometry(5.5, 46, 16, 1, true), beamMat);
    this.scene.add(beam);
    const spot = new THREE.Mesh(new THREE.CircleGeometry(7, 20), new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
    spot.rotation.x = -Math.PI / 2;
    this.scene.add(spot);
    return { group: g, beam, spot, x: 0, z: 0, y: 42, heading: 0 };
  }
  update(dt, player, inCar) {
    const px = player.x, pz = player.z;
    if (this.frozen) { this.updateHeli(dt, px, pz); return; }
    // heat decay when unseen
    const nearest = this.nearestDist(px, pz);
    if (this.wanted > 0) {
      if (nearest > 45 && this.heli === null) this.hidden += dt; else this.hidden = 0;
      if (this.hidden > 8) { this.addHeat(-dt * 6); }
      if (this.wanted === 0) this.clearAll();
    }
    // spawn / despawn cruisers
    this.spawnTimer -= dt;
    const want = this.desiredCruisers();
    if (this.cruisers.length < want && this.spawnTimer <= 0) {
      this.spawnCruiser(px, pz);
      this.spawnTimer = 1.2;
    }
    if (this.cruisers.length > want) {
      const extra = this.cruisers.pop();
      extra.car.dispose();
    }
    // heli at 3+ stars
    if (this.wanted >= 3 && !this.heli) {
      this.heli = this.makeHeli();
      this.heli.x = px + 30; this.heli.z = pz - 30;
    }
    if (this.wanted < 3 && this.heli) {
      this.scene.remove(this.heli.group); this.scene.remove(this.heli.beam); this.scene.remove(this.heli.spot);
      this.heli = null;
    }
    // siren
    this.audio.setSiren(this.wanted > 0 && this.cruisers.length > 0);
    // cruiser AI
    const t = performance.now() / 1000;
    let bustedNear = false;
    this.cruisers.forEach((u, i) => {
      const c = u.car;
      const dx = px - c.x, dz = pz - c.z;
      const dist = Math.hypot(dx, dz);
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - c.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      // roles: nearest rams, others flank / roadblock / pursue
      const sorted = [...this.cruisers].sort((a, b) => Math.hypot(a.car.x - px, a.car.z - pz) - Math.hypot(b.car.x - px, b.car.z - pz));
      const rank = sorted.indexOf(u);
      if (rank === 0) u.role = 'RAMMING';
      else if (rank === 1) u.role = 'FLANKING';
      else if (this.wanted >= 4 && rank === 2) u.role = 'FIRING';
      else if (rank === this.cruisers.length - 1 && dist > 60) u.role = 'ROADBLOCK';
      else u.role = 'PURSUIT';
      // flankers aim slightly ahead / to the side
      let target = wantHeading;
      if (u.role === 'FLANKING') {
        const side = i % 2 === 0 ? 1 : -1;
        const fx = px + Math.cos(player.heading || 0) * side * 8;
        const fz = pz - Math.sin(player.heading || 0) * side * 8;
        target = Math.atan2(fx - c.x, fz - c.z);
      }
      if (u.role === 'ROADBLOCK' && dist > 60) {
        const rx = px + Math.sin(player.heading || 0) * 30;
        const rz = pz + Math.cos(player.heading || 0) * 30;
        target = Math.atan2(rx - c.x, rz - c.z);
      }
      let tdh = target - c.heading;
      while (tdh > Math.PI) tdh -= Math.PI * 2;
      while (tdh < -Math.PI) tdh += Math.PI * 2;
      const throttle = dist > 4 ? 1 : 0.4;
      c.drive(dt, { throttle, steer: clamp(tdh * 1.6, -1, 1), brake: false }, this.world);
      // ram: extra push when very close
      if (dist < 6 && rank === 0) c.speed = Math.min(c.speed + dt * 10, 48);
      // light bar flash
      const lb = c.mesh.userData.lightBar;
      if (lb) {
        const on = Math.sin(t * 9 + i * 2) > 0;
        lb.red.color.setHex(on ? 0xff2222 : 0x550000);
        lb.blue.color.setHex(on ? 0x001155 : 0x2266ff);
        c.mesh.userData.glow.material.color.setHex(on ? 0xff3344 : 0x3366ff);
      }
      // busted: player slow/on foot and a cruiser right on them
      if (dist < 7 && (!inCar || Math.abs(player.speed || 0) < 1)) {
        u.bustedTimer += dt;
        if (u.bustedTimer > 2.2) bustedNear = true;
      } else u.bustedTimer = 0;
    });
    if (bustedNear && this.onBusted) this.onBusted();
    this.updateHeli(dt, px, pz);
  }
  updateHeli(dt, px, pz) {
    // heli follows player, spotlight on them
    if (!this.heli) return;
    const h = this.heli;
    const t = performance.now() / 1000;
    const tx = px + 14, tz = pz - 10;
    h.x += (tx - h.x) * Math.min(1, dt * 1.2);
    h.z += (tz - h.z) * Math.min(1, dt * 1.2);
    h.heading = Math.atan2(px - h.x, pz - h.z);
    h.group.position.set(h.x, h.y + Math.sin(t * 0.8) * 1.2, h.z);
    h.group.rotation.y = h.heading;
    h.group.userData.rotor.rotation.y += dt * 22;
    h.group.userData.rotor2.rotation.y += dt * 22;
    // aim the beam: cone from heli (apex) widening down to the player
    const hx = h.group.position.x, hy = h.group.position.y, hz = h.group.position.z;
    const dir = new THREE.Vector3(px - hx, -hy, pz - hz);
    const len = dir.length(); dir.normalize();
    h.beam.position.set((hx + px) / 2, hy / 2, (hz + pz) / 2);
    h.beam.scale.set(1, len / 46, 1);
    h.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().negate());
    h.spot.position.set(px, 0.35, pz);
  }
  nearestDist(px, pz) {
    let m = 1e9;
    for (const u of this.cruisers) m = Math.min(m, Math.hypot(u.car.x - px, u.car.z - pz));
    return m;
  }
  // HUD list: named units with roles + distances (heli included when present)
  unitList(px, pz) {
    const list = this.cruisers.map(u => ({
      callsign: u.callsign,
      role: u.role,
      dist: Math.round(Math.hypot(u.car.x - px, u.car.z - pz)),
    })).sort((a, b) => a.dist - b.dist);
    if (this.heli) list.push({ callsign: 'AIR-1', role: 'SPOTLIGHT', dist: Math.round(Math.hypot(this.heli.x - px, this.heli.z - pz)) });
    return list;
  }
  clearAll() {
    for (const u of this.cruisers) u.car.dispose();
    this.cruisers = [];
    if (this.heli) { this.scene.remove(this.heli.group); this.scene.remove(this.heli.beam); this.scene.remove(this.heli.spot); this.heli = null; }
    this.audio.setSiren(false);
  }
  // Stage cruisers right behind the player for screenshots
  stageChase(px, pz, heading, n) {
    this.clearAll();
    for (let i = 0; i < n; i++) {
      const back = 7 + i * 7;
      const side = (i % 2 === 0 ? -1 : 1) * (i === 0 ? 2.8 : 3.4);
      const x = px - Math.sin(heading) * back + Math.cos(heading) * side;
      const z = pz - Math.cos(heading) * back - Math.sin(heading) * side;
      const car = new Car(this.scene, x, z, heading, 'HPD Interceptor', 0xffffff, true);
      car.speed = 30;
      const cs = CALLSIGNS[i % CALLSIGNS.length];
      // alternate light-bar flash phase so the chase looks alive in a still
      const lb = car.mesh.userData.lightBar;
      if (lb) {
        const on = i % 2 === 0;
        lb.red.color.setHex(on ? 0xff2222 : 0x550000);
        lb.blue.color.setHex(on ? 0x001155 : 0x2266ff);
        car.mesh.userData.glow.material.color.setHex(on ? 0xff3344 : 0x3366ff);
      }
      this.cruisers.push({ car, callsign: cs, role: i === 0 ? 'RAMMING' : i === 1 ? 'FLANKING' : 'PURSUIT', bustedTimer: 0, ramBoost: 0 });
    }
    if (!this.heli) {
      this.heli = this.makeHeli();
      this.heli.x = px + 12; this.heli.z = pz - 14;
    }
  }
}
