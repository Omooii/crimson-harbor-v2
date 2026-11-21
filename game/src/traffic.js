// Ambient traffic: cars cruise the road grid, turn at intersections, brake for what is ahead,
// and flee when the player smashes into them.
import { ROADS, CARS } from './config.js';
import { mulberry32, pick, clamp } from './util.js';
import { spawnCar, driveCar } from './vehicles.js';
const KINDS = ['sedan', 'sedan', 'taxi', 'van', 'sports'];
const PAINT = [0x8fa3b8, 0xb8b0a3, 0x5a6b7c, 0x9c3848, 0x3f6d4e, 0xd8d3c3, 0x6b5b95, 0xc9c9c9];
export function initTraffic(G, count) {
  const rng = mulberry32(G.seed + 101);
  G.traffic = [];
  for (let i = 0; i < count; i++) {
    const alongX = rng() < 0.5;
    const road = pick(rng, ROADS);
    const v = -240 + rng() * 480;
    const dir = rng() < 0.5 ? 1 : -1;
    const kind = pick(rng, KINDS);
    const x = alongX ? v : road + (dir > 0 ? 3.2 : -3.2);
    const z = alongX ? road + (dir > 0 ? -3.2 : 3.2) : v;
    const heading = alongX ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    const car = spawnCar(G, kind, x, z, heading, pick(rng, PAINT));
    car.parked = false;
    car.driver = { alongX, road, dir, speed: 9 + rng() * 4, flee: 0, wait: 0 };
    G.traffic.push(car);
  }
  // Parked cars along curbs (stealable).
  G.parked = [];
  for (let i = 0; i < 14; i++) {
    const road = pick(rng, ROADS);
    const v = -230 + rng() * 460;
    const alongX = rng() < 0.5;
    const kind = pick(rng, KINDS.concat(['scooter', 'scooter']));
    const x = alongX ? v : road + 5.6;
    const z = alongX ? road + 5.6 : v;
    const car = spawnCar(G, kind, x, z, alongX ? Math.PI / 2 : 0, pick(rng, PAINT));
    car.parked = true;
    G.parked.push(car);
  }
}
function nearestRoad(v) {
  let best = ROADS[0], bd = 1e9;
  for (const r of ROADS) { const d = Math.abs(v - r); if (d < bd) { bd = d; best = r; } }
  return best;
}
export function updateTraffic(G, dt) {
  const rng = G.rng;
  for (const car of G.traffic) {
    if (car.dead) continue;
    const d = car.driver;
    // Something ahead? brake.
    const fx = car.x + Math.sin(car.heading) * 9, fz = car.z + Math.cos(car.heading) * 9;
    let blocked = false;
    for (const o of G.cars) {
      if (o === car) continue;
      if (Math.hypot(o.x - fx, o.z - fz) < 5) { blocked = true; break; }
    }
    if (!blocked && Math.hypot(G.player.pos.x - fx, G.player.pos.z - fz) < 4 && !G.player.car) blocked = true;
    let throttle = 0, steer = 0;
    if (d.wait > 0) { d.wait -= dt; }
    else if (blocked) { throttle = car.speed > 0.5 ? -1 : 0; }
    else {
      throttle = d.flee > 0 ? 1 : (car.speed < d.speed ? 0.7 : 0);
      // Steer onto the lane centre of the current road.
      const lane = d.alongX ? d.road + (d.dir > 0 ? -3.2 : 3.2) : d.road + (d.dir > 0 ? 3.2 : -3.2);
      const off = d.alongX ? lane - car.z : lane - car.x;
      const want = d.alongX ? (d.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (d.dir > 0 ? 0 : Math.PI);
      let dh = want - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
      steer = clamp(dh * 2 + off * 0.12 * d.dir, -1, 1);
      // At an intersection, sometimes turn onto the cross road.
      const cross = d.alongX ? car.x : car.z;
      const nr = nearestRoad(cross);
      if (Math.abs(cross - nr) < 1.2 && rng() < 0.012 && !d.flee) {
        d.alongX = !d.alongX; d.road = nr; d.dir = rng() < 0.5 ? 1 : -1;
      }
      // Turn around at the map edge.
      const along = d.alongX ? car.x : car.z;
      if (Math.abs(along) > 235) d.dir *= -1;
    }
    if (d.flee > 0) d.flee -= dt;
    const impact = driveCar(G, car, throttle, steer, false, dt);
    if (impact > 8) { d.flee = 6; G.audio.crash(); }
  }
}
export function fleeTraffic(G, x, z) {
  for (const car of G.traffic) {
    if (Math.hypot(car.x - x, car.z - z) < 30) car.driver.flee = 5;
  }
}
