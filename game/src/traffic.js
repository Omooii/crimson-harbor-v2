// Ambient traffic: cars cruising the road grid in lanes, braking for the
// car ahead, turning at intersections, wrapping at the map edge — plus
// parked cars along the kerb waiting to be stolen.
(function () {
  var CH = window.CH;
  var CONFIG = CH.CONFIG;

  function createTraffic(scene, city, rng) {
    var cars = [];
    var kinds = ['sedan', 'sedan', 'sedan', 'taxi', 'truck', 'sports'];
    var roads = CONFIG.roads;

    function spawnCruiser() {
      var road = roads[rng.int(0, roads.length - 1)];
      var alongX = rng.chance(0.5);
      var dir = rng.chance(0.5) ? 1 : -1;
      var lane = rng.chance(0.5) ? 3.2 : -3.2;
      var x, z, heading;
      if (alongX) {
        x = rng.range(-200, 200);
        z = road + lane;
        heading = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        x = road + lane;
        z = rng.range(-200, 200);
        heading = dir > 0 ? 0 : Math.PI;
      }
      var car = CH.makeCar(scene, rng.pick(kinds), x, z, heading);
      car.driver = 'traffic';
      car.cruise = rng.range(9, 13);
      car.axis = alongX ? 'x' : 'z';
      car.dir = dir;
      car.road = road;
      car.lane = lane;
      car.turnAt = null;
      cars.push(car);
      return car;
    }

    function spawnParked() {
      var road = roads[rng.int(0, roads.length - 1)];
      var alongX = rng.chance(0.5);
      var side = rng.chance(0.5) ? 1 : -1;
      var x, z, heading;
      if (alongX) {
        x = rng.range(-190, 190);
        z = road + side * 9.5;
        heading = side > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        x = road + side * 9.5;
        z = rng.range(-190, 190);
        heading = side > 0 ? 0 : Math.PI;
      }
      // Keep parked cars out of the mission target car spots and landmarks.
      var clear = Object.keys(CH.LANDMARKS).every(function (k) {
        var l = CH.LANDMARKS[k];
        return CH.dist(x, z, l.x, l.z) > 14;
      });
      if (!clear) return null;
      var car = CH.makeCar(scene, rng.pick(kinds), x, z, heading);
      car.driver = null;
      cars.push(car);
      return car;
    }

    for (var i = 0; i < CONFIG.traffic.count; i++) spawnCruiser();
    for (var j = 0; j < CONFIG.traffic.parked; j++) spawnParked();

    function carAhead(car, all) {
      var fx = Math.sin(car.heading);
      var fz = Math.cos(car.heading);
      var best = Infinity;
      for (var i = 0; i < all.length; i++) {
        var o = all[i];
        if (o === car || o.dead) continue;
        var dx = o.group.position.x - car.group.position.x;
        var dz = o.group.position.z - car.group.position.z;
        var ahead = dx * fx + dz * fz;
        var side = Math.abs(dx * fz - dz * fx);
        if (ahead > 0 && ahead < 11 && side < 2.6 && ahead < best) best = ahead;
      }
      return best;
    }

    function update(dt, world, events) {
      var all = world.cars;
      for (var i = 0; i < cars.length; i++) {
        var car = cars[i];
        if (car.driver !== 'traffic' || car.dead) continue;
        // At an intersection, sometimes turn onto the cross street.
        var px = car.group.position.x;
        var pz = car.group.position.z;
        var nearCross = roads.some(function (r) {
          return Math.abs((car.axis === 'x' ? px : pz) - r) < 1.2;
        });
        if (nearCross && !car.turnAt && rng.chance(0.25)) {
          car.turnAt = car.axis === 'x' ? px : pz;
          car.axis = car.axis === 'x' ? 'z' : 'x';
          car.dir = rng.chance(0.5) ? 1 : -1;
          car.road = roads.reduce(function (best, r) {
            var v = car.axis === 'x' ? pz : px;
            return Math.abs(r - v) < Math.abs(best - v) ? r : best;
          }, roads[0]);
          car.lane = rng.chance(0.5) ? 3.2 : -3.2;
        }
        if (car.turnAt !== null && Math.abs((car.axis === 'z' ? px : pz) - car.turnAt) > 6) car.turnAt = null;
        var targetHeading = car.axis === 'x'
          ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2)
          : (car.dir > 0 ? 0 : Math.PI);
        var steer = CH.clamp(CH.angleDiff(targetHeading, car.heading) * 2.2, -1, 1);
        var gap = carAhead(car, all);
        var throttle = gap < 11 ? 0 : 1;
        if (gap < 6) throttle = -1;
        // Ease toward the lane line.
        var laneCoord = car.axis === 'x' ? pz : px;
        var laneTarget = car.road + car.lane;
        var laneErr = laneTarget - laneCoord;
        steer += CH.clamp(laneErr * 0.12, -0.4, 0.4);
        CH.driveCar(car, dt, throttle, CH.clamp(steer, -1, 1), false, city, events);
        // Wrap at the map edge instead of driving into the sea.
        if (px > 205 || px < -205 || pz > 205 || pz < -205) {
          car.group.position.x = -px * 0.95;
          car.group.position.z = -pz * 0.95;
        }
        // Cap cruise speed.
        var sp = Math.sqrt(car.vx * car.vx + car.vz * car.vz);
        if (sp > car.cruise) {
          car.vx *= car.cruise / sp;
          car.vz *= car.cruise / sp;
        }
      }
    }

    return {
      cars: cars,
      update: update,
      spawnParked: spawnParked,
    };
  }

  CH.createTraffic = createTraffic;
})();
