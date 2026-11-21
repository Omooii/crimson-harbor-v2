// Cars: procedural meshes, arcade driving physics, and road traffic.
import { mulberry32, rand, pick, clamp } from './util.js';
import { ROADS, BEACH_X } from './world.js';

export const CAR_NAMES = ['Vortex GT', 'Sunset Cruiser', 'Coral Coupe', 'Pelican Van', 'Dune Runner', 'Harbor Taxi', 'Midnight Falcon', 'Wave Rider'];
const CAR_COLORS = [0xd43a3a, 0x2a6fd4, 0xffd166, 0x4ecdc4, 0xff8fab, 0x7fd1ff, 0xf2ead8, 0x9b5de5, 0x2f9e5f, 0xff6b35];

export function makeCarMesh(color, police) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: police ? 0xf2f2f2 : color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x14181f });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.75, 4.4), bodyMat);
  body.position.y = 0.62; body.castShadow = true; g.add(body);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.45, 0.7), bodyMat);
  nose.position.set(0, 0.5, 2.4); g.add(nose);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.62, 2.1), darkMat);
  cabin.position.set(0, 1.28, -0.25); cabin.castShadow = true; g.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 1.9), bodyMat);
  roof.position.set(0, 1.62, -0.25); g.add(roof);
  // wheels
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(wx, 0.38, wz); g.add(w); wheels.push(w);
  }
  // headlights + taillights
  const hlMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const sx of [-0.7, 0.7]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.1), hlMat);
    hl.position.set(sx, 0.62, 2.72); g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.1), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    tl.position.set(sx, 0.62, -2.22); g.add(tl);
  }
  if (police) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.3, 4.42), new THREE.MeshLambertMaterial({ color: 0x18202c }));
    stripe.position.y = 0.72; g.add(stripe);
    const bar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.x = -0.42; bar.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
    blue.position.x = 0.42; bar.add(blue);
    bar.position.set(0, 1.78, -0.25); g.add(bar);
    g.userData.lightBar = { red: red.material, blue: blue.material };
    // light glow sprite
    const glow = new THREE.Mesh(new THREE.SphereGeometry(1.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3344, transparent: true, opacity: 0.25 }));
    glow.position.set(0, 1.8, -0.25); g.add(glow);
    g.userData.glow = glow;
  }
  g.userData.wheels = wheels;
  return g;
}

export class Car {
  constructor(scene, x, z, heading, name, color, police) {
    this.mesh = makeCarMesh(color, police);
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
    scene.add(this.mesh);
    this.x = x; this.z = z; this.heading = heading;
    this.speed = 0; // m/s, signed
    this.name = name; this.police = !!police;
    this.damage = 0; // 0..100
    this.steer = 0;
    this.scene = scene;
    this.smoke = null;
  }
  get kmh() { return Math.abs(this.speed) * 3.6; }
  get pos() { return this.mesh.position; }
  // Arcade drive step. input: {throttle -1..1, steer -1..1, brake bool}
  drive(dt, input, world) {
    const topSpeed = (this.police ? 46 : 42) * (1 - this.damage / 220);
    const accel = input.throttle > 0 ? 16 : 22;
    this.speed += input.throttle * accel * dt;
    if (!input.throttle) this.speed *= Math.pow(0.35, dt); // drag
    if (input.brake) this.speed *= Math.pow(0.12, dt);
    this.speed = clamp(this.speed, -12, topSpeed);
    const grip = input.brake ? 1.25 : 1; // handbrake sharpens the turn
    const steerAmt = input.steer * clamp(Math.abs(this.speed) / 6, 0, 1) * 2.6 * grip;
    this.heading += steerAmt * dt * Math.sign(this.speed || 1);
    const nx = this.x + Math.sin(this.heading) * this.speed * dt;
    const nz = this.z + Math.cos(this.heading) * this.speed * dt;
    const [cx, cz] = world.collide(nx, nz, 2.3);
    if (Math.abs(cx - nx) > 0.01 || Math.abs(cz - nz) > 0.01) {
      // hit a building: lose speed, take damage
      if (Math.abs(this.speed) > 6) this.damage = Math.min(100, this.damage + Math.abs(this.speed) * 0.55);
      this.speed *= 0.35;
    }
    this.x = cx; this.z = cz;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    // wheel spin
    for (const w of this.mesh.userData.wheels) w.rotation.x += this.speed * dt / 0.38;
    // front wheel steer visual
    this.mesh.userData.wheels[0].rotation.y = this.mesh.userData.wheels[1].rotation.y = input.steer * 0.35;
    // smoke when heavily damaged
    if (this.damage > 55 && !this.smoke) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6), new THREE.MeshBasicMaterial({ color: 0x666666, transparent: true, opacity: 0.5 }));
      s.position.set(0, 1.4, 1.8); this.mesh.add(s); this.smoke = s;
    }
    if (this.smoke) this.smoke.scale.setScalar(1 + Math.sin(performance.now() / 120) * 0.25);
  }
  // simple circle bump between cars
  bump(other, onHit) {
    const dx = this.x - other.x, dz = this.z - other.z;
    const d = Math.hypot(dx, dz);
    if (d < 4.4 && d > 0.001) {
      const push = (4.4 - d) / 2;
      const ux = dx / d, uz = dz / d;
      this.x += ux * push; this.z += uz * push;
      other.x -= ux * push; other.z -= uz * push;
      const impact = Math.abs(this.speed - other.speed);
      if (impact > 4) {
        this.damage = Math.min(100, this.damage + impact * 0.4);
        other.damage = Math.min(100, this.damage + impact * 0.4);
        this.speed *= 0.6; other.speed *= 0.6;
        if (onHit) onHit(impact);
      }
      this.mesh.position.set(this.x, 0, this.z);
      other.mesh.position.set(other.x, 0, other.z);
    }
  }
  dispose() { this.scene.remove(this.mesh); }
}

export class Traffic {
  constructor(scene, world, count) {
    this.scene = scene; this.world = world;
    this.rng = mulberry32(777);
    this.cars = [];
    for (let i = 0; i < count; i++) this.spawn();
  }
  spawn() {
    const rng = this.rng;
    const alongX = rng() < 0.5;
    const road = pick(rng, [...ROADS, BEACH_X]);
    const dir = rng() < 0.5 ? 1 : -1;
    const t = rand(rng, -300, 300);
    const lane = (rng() < 0.5 ? -3.4 : 3.4);
    const x = alongX ? t : road + lane;
    const z = alongX ? road + lane : t;
    const heading = alongX ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    const car = new Car(this.scene, x, z, heading, pick(rng, CAR_NAMES), pick(rng, CAR_COLORS), false);
    car.traffic = { alongX, road, dir, speed: rand(rng, 8, 13) };
    car.speed = car.traffic.speed;
    this.cars.push(car);
    return car;
  }
  update(dt, obstacles) {
    for (const car of this.cars) {
      const tr = car.traffic;
      // slow if something is right ahead
      let target = tr.speed;
      const ax = Math.sin(car.heading), az = Math.cos(car.heading);
      for (const o of obstacles) {
        const dx = o.x - car.x, dz = o.z - car.z;
        const ahead = dx * ax + dz * az;
        const side = Math.abs(dx * az - dz * ax);
        if (ahead > 0 && ahead < 12 && side < 3) { target = 0; break; }
      }
      car.speed += (target - car.speed) * Math.min(1, dt * 2);
      car.x += ax * car.speed * dt;
      car.z += az * car.speed * dt;
      // wrap around the city
      if (car.x > 330 || car.x < -330 || car.z > 330 || car.z < -330) {
        const keep = this.cars.indexOf(car);
        car.dispose(); this.cars.splice(keep, 1); this.spawn();
        continue;
      }
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
      for (const w of car.mesh.userData.wheels) w.rotation.x += car.speed * dt / 0.38;
    }
  }
  // place N traffic cars near a point, on the nearest road, for screenshots
  stageNear(x, z, n) {
    const rng = mulberry32(4242);
    const [rx, rz] = this.world.nearestRoadPoint(x, z);
    const onAve = Math.abs(rx - x) < Math.abs(rz - z);
    let placed = 0;
    for (const car of this.cars) {
      if (placed >= n) break;
      const off = (placed - n / 2) * 14 + rand(rng, -3, 3);
      const lane = placed % 2 === 0 ? -3.4 : 3.4;
      if (onAve) { car.x = rx + lane; car.z = z + off; car.heading = off > 0 ? 0 : Math.PI; }
      else { car.x = x + off; car.z = rz + lane; car.heading = off > 0 ? Math.PI / 2 : -Math.PI / 2; }
      car.speed = 0; car.mesh.position.set(car.x, 0, car.z); car.mesh.rotation.y = car.heading;
      placed++;
    }
  }
}
