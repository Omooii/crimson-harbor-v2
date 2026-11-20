// traffic.js — the city's other drivers and its parked cars. Moving cars
// follow the road grid: they drive from intersection to intersection,
// pick a new direction at each one, and brake for the car ahead. Parked
// cars sit by the curb; the player can steal any of them.
(function () {
  'use strict';

  var cfg = window.CH.config;
  var util = window.CH.util;

  var moving = []; // cars with a route
  var parked = []; // stationary cars the player can take
  var sceneRef = null;

  var TRAFFIC_COLORS = [0x7a8ba0, 0xb0b8c0, 0x3a4a5a, 0x8a3a3a, 0x4a6b4a, 0xd8d0c0, 0x5a5a6b, 0xc0a060];
  var KINDS = ['sedan', 'sedan', 'sedan', 'taxi', 'truck'];

  function roadEnds() {
    return { lo: -cfg.HALF, hi: cfg.HALF };
  }

  // Pick the next intersection for a car that just reached one.
  function nextTarget(car, rng) {
    var aves = cfg.avenues;
    var strs = cfg.streets;
    // Snap the car's current position to the nearest intersection.
    var ai = 0;
    var si = 0;
    var bestA = 1e9;
    var bestS = 1e9;
    for (var i = 0; i < aves.length; i++) {
      var da = Math.abs(car.x - aves[i]);
      if (da < bestA) { bestA = da; ai = i; }
      var ds = Math.abs(car.z - strs[i]);
      if (ds < bestS) { bestS = ds; si = i; }
    }
    // Directions the car may take from here (dx, dz in grid steps).
    var options = [];
    if (ai > 0) options.push([-1, 0]);
    if (ai < aves.length - 1) options.push([1, 0]);
    if (si > 0) options.push([0, -1]);
    if (si < strs.length - 1) options.push([0, 1]);
    // Prefer to keep going straight: weight the current direction double.
    var dir = car.gridDir || [1, 0];
    options.push(dir);
    options.push(dir);
    var choice = options[Math.floor(rng() * options.length)];
    car.gridDir = choice;
    var nx = aves[ai + choice[0]];
    var nz = strs[si + choice[1]];
    // Lane offset: right-hand traffic.
    var lx = 0;
    var lz = 0;
    if (choice[0] === 1) lz = 3.5; // eastbound: right side is south
    if (choice[0] === -1) lz = -3.5;
    if (choice[1] === 1) lx = -3.5; // southbound: right side is west
    if (choice[1] === -1) lx = 3.5;
    return { x: nx + lx, z: nz + lz };
  }

  function spawnMoving(scene, rng, count) {
    for (var i = 0; i < count; i++) {
      var kind = util.pick(rng, KINDS);
      var color = util.pick(rng, TRAFFIC_COLORS);
      var ave = util.pick(rng, cfg.avenues);
      var str = util.pick(rng, cfg.streets);
      var alongAvenue = rng() < 0.5;
      var x;
      var z;
      var heading;
      if (alongAvenue) {
        x = ave + (rng() < 0.5 ? 3.5 : -3.5);
        z = util.range(rng, -cfg.HALF + 20, cfg.HALF - 20);
        heading = x > ave ? Math.PI : 0; // northbound on the east lane
      } else {
        x = util.range(rng, -cfg.HALF + 20, cfg.HALF - 20);
        z = str + (rng() < 0.5 ? 3.5 : -3.5);
        heading = z > str ? Math.PI / 2 : -Math.PI / 2; // eastbound on the south lane
      }
      var car = window.CH.vehicles.createCar(scene, kind, x, z, heading, color);
      car.cruise = util.range(rng, 8, 12);
      car.gridDir = alongAvenue ? (heading === Math.PI ? [0, -1] : [0, 1]) : (heading === Math.PI / 2 ? [1, 0] : [-1, 0]);
      car.target = nextTarget(car, rng);
      car.wait = 0;
      moving.push(car);
    }
  }

  function spawnParked(scene, rng, count) {
    var tries = 0;
    while (parked.length < count && tries < 200) {
      tries++;
      var ave = util.pick(rng, cfg.avenues);
      var z = util.range(rng, -cfg.HALF + 30, cfg.HALF - 30);
      // Keep the mission taxi's avenue clear near the garage.
      if (Math.abs(ave - (-7)) < 1 && z > 40 && z < 110) continue;
      var side = rng() < 0.5 ? 1 : -1;
      var x = ave + side * 5.6;
      var kind = util.pick(rng, KINDS);
      var color = util.pick(rng, TRAFFIC_COLORS);
      var car = window.CH.vehicles.createCar(scene, kind, x, z, side > 0 ? Math.PI : 0, color);
      parked.push(car);
    }
  }

  // A specific parked car, placed by a mission (e.g. the Comet GT).
  function spawnParkedAt(scene, kind, x, z, heading, color) {
    var car = window.CH.vehicles.createCar(scene, kind, x, z, heading, color);
    parked.push(car);
    return car;
  }

  function init(scene, rng) {
    sceneRef = scene;
    moving = [];
    parked = [];
    spawnMoving(scene, rng, 12);
    spawnParked(scene, rng, 10);
  }

  function carAhead(car, others) {
    var fx = Math.sin(car.heading);
    var fz = Math.cos(car.heading);
    for (var i = 0; i < others.length; i++) {
      var o = others[i];
      if (o === car || o.dead) continue;
      var dx = o.x - car.x;
      var dz = o.z - car.z;
      var d = Math.sqrt(dx * dx + dz * dz);
      if (d > 12 || d < 0.01) continue;
      var dot = (dx * fx + dz * fz) / d;
      if (dot > 0.82) return d;
    }
    return Infinity;
  }

  function update(dt, rng, extraCars) {
    var all = moving.concat(parked).concat(extraCars || []);
    for (var i = 0; i < moving.length; i++) {
      var car = moving[i];
      var t = car.target;
      var d = util.dist2(car.x, car.z, t.x, t.z);
      if (d < 7) {
        car.target = nextTarget(car, rng);
        t = car.target;
      }
      var desired = Math.atan2(t.x - car.x, t.z - car.z);
      var steer = util.clamp(util.angleDiff(desired, car.heading) * 2.4, -1, 1);
      var ahead = carAhead(car, all);
      var throttle = 1;
      if (ahead < 11) throttle = 0.15;
      if (ahead < 6.5) throttle = -0.7;
      // Ease up to cruise speed, never beyond it.
      if (car.speed > car.cruise) throttle = Math.min(throttle, 0);
      window.CH.vehicles.drive(car, dt, { throttle: throttle, steer: steer, handbrake: false });
    }
  }

  // Put an existing car back on the street as a parked car (the player
  // stepped out of it).
  function parkCar(car) {
    if (parked.indexOf(car) === -1 && moving.indexOf(car) === -1) {
      parked.push(car);
    }
  }

  // The nearest parked car within maxDist of a point, or null.
  function nearestParked(x, z, maxDist) {
    var best = null;
    var bestD = maxDist;
    for (var i = 0; i < parked.length; i++) {
      var c = parked[i];
      if (c.dead) continue;
      var d = util.dist2(x, z, c.x, c.z);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  // Take a parked car out of the parked list (the player stole it).
  function takeParked(car) {
    var idx = parked.indexOf(car);
    if (idx !== -1) parked.splice(idx, 1);
  }

  function allCars() {
    return moving.concat(parked);
  }

  window.CH = window.CH || {};
  window.CH.traffic = {
    init: init,
    update: update,
    spawnParkedAt: spawnParkedAt,
    parkCar: parkCar,
    nearestParked: nearestParked,
    takeParked: takeParked,
    allCars: allCars,
    moving: function () { return moving; },
    parked: function () { return parked; }
  };
})();
