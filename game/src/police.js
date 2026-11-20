// police.js — the wanted system: stars rise with every crime and fall
// when the player lies low. Pursuit cruisers chase the player by car,
// foot cops chase on foot, and a cop who catches a slow player on foot
// makes the bust.
(function () {
  'use strict';

  var cfg = window.CH.config;
  var util = window.CH.util;

  var wanted = 0;
  var lastCrimeAt = -100;
  var lastCrimeReason = {};
  var cruisers = [];
  var cops = [];
  var sceneRef = null;
  var rngRef = null;
  var hooks = {}; // onBusted(fine)
  var clock = 0;
  var busted = false;

  function wantedCount() {
    return wanted;
  }

  function setWanted(n) {
    wanted = util.clamp(Math.round(n), 0, 5);
  }

  // A crime raises the heat, but the same kind of crime cannot stack
  // faster than once every 4 seconds.
  function addWanted(n, reason) {
    var now = clock;
    if (reason && lastCrimeReason[reason] !== undefined && now - lastCrimeReason[reason] < 4) return;
    if (reason) lastCrimeReason[reason] = now;
    lastCrimeAt = now;
    setWanted(wanted + n);
  }

  function init(scene, rng, hookFns) {
    sceneRef = scene;
    rngRef = rng;
    hooks = hookFns || {};
    wanted = 0;
    cruisers = [];
    cops = [];
    busted = false;
  }

  function spawnCruiserNear(px, pz) {
    // Pick a road point 55-80 units from the player.
    for (var tries = 0; tries < 12; tries++) {
      var a = util.range(rngRef, 0, Math.PI * 2);
      var d = util.range(rngRef, 55, 80);
      var x = util.clamp(px + Math.cos(a) * d, -cfg.HALF + 8, cfg.HALF - 8);
      var z = util.clamp(pz + Math.sin(a) * d, -cfg.HALF + 8, cfg.HALF - 8);
      // Snap to the nearest road.
      var bestX = cfg.avenues[0];
      var bestZ = cfg.streets[0];
      var bd = 1e9;
      for (var i = 0; i < cfg.avenues.length; i++) {
        var dx = Math.abs(x - cfg.avenues[i]);
        if (dx < bd) { bd = dx; bestX = cfg.avenues[i]; }
        var dz = Math.abs(z - cfg.streets[i]);
        if (dz < bd) { bd = dz; bestZ = cfg.streets[i]; }
      }
      if (Math.abs(x - bestX) < Math.abs(z - bestZ)) x = bestX + 3.5;
      else z = bestZ + 3.5;
      var heading = Math.atan2(px - x, pz - z);
      var car = window.CH.vehicles.createCar(sceneRef, 'police', x, z, heading);
      cruisers.push(car);
      return;
    }
  }

  function buildCopMesh() {
    var group = new THREE.Group();
    var body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.34, 0.8, 3, 10),
      new THREE.MeshLambertMaterial({ color: 0x1c2f4a })
    );
    body.position.y = 1.18;
    group.add(body);
    var head = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 12, 10),
      new THREE.MeshLambertMaterial({ color: 0xd8a070 })
    );
    head.position.y = 1.9;
    group.add(head);
    var cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.3, 0.18, 10),
      new THREE.MeshLambertMaterial({ color: 0x101820 })
    );
    cap.position.y = 2.08;
    group.add(cap);
    var legMat = new THREE.MeshLambertMaterial({ color: 0x141c28 });
    var legGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.75, 6);
    var legL = new THREE.Mesh(legGeo, legMat);
    legL.position.set(-0.15, 0.38, 0);
    group.add(legL);
    var legR = new THREE.Mesh(legGeo, legMat);
    legR.position.set(0.15, 0.38, 0);
    group.add(legR);
    return { group: group, legL: legL, legR: legR };
  }

  function spawnCopNear(px, pz) {
    for (var tries = 0; tries < 10; tries++) {
      var a = util.range(rngRef, 0, Math.PI * 2);
      var d = util.range(rngRef, 14, 24);
      var x = px + Math.cos(a) * d;
      var z = pz + Math.sin(a) * d;
      var res = window.CH.city.collideCircle(x, z, 0.5);
      if (window.CH.city.isWater(res.x, res.z)) continue;
      var mesh = buildCopMesh();
      mesh.group.position.set(res.x, 0, res.z);
      sceneRef.add(mesh.group);
      cops.push({
        mesh: mesh, x: res.x, z: res.z,
        heading: Math.atan2(px - res.x, pz - res.z),
        speed: 0, phase: 0, catchT: 0
      });
      return;
    }
  }

  function removeCruiser(car) {
    window.CH.vehicles.removeCar(sceneRef, car);
    var i = cruisers.indexOf(car);
    if (i !== -1) cruisers.splice(i, 1);
  }

  function removeCop(cop) {
    sceneRef.remove(cop.mesh.group);
    var i = cops.indexOf(cop);
    if (i !== -1) cops.splice(i, 1);
  }

  // Screenshot staging: three cruisers right on the player's tail.
  function stageChase(px, pz, heading) {
    setWanted(3);
    var bx = Math.sin(heading);
    var bz = Math.cos(heading);
    var spots = [
      { d: 15, lat: -2.5 },
      { d: 26, lat: 3.0 },
      { d: 38, lat: -3.5 }
    ];
    for (var i = 0; i < spots.length; i++) {
      var s = spots[i];
      var x = px - bx * s.d - bz * s.lat;
      var z = pz - bz * s.d + bx * s.lat;
      var car = window.CH.vehicles.createCar(sceneRef, 'police', x, z, heading);
      car.speed = 22;
      cruisers.push(car);
    }
  }

  // The response list for the HUD: nearby units, nearest first.
  function units(px, pz) {
    var out = [];
    for (var i = 0; i < cruisers.length; i++) {
      out.push({
        label: 'Patrol ' + (i + 1),
        dist: Math.round(util.dist2(px, pz, cruisers[i].x, cruisers[i].z))
      });
    }
    for (var j = 0; j < cops.length; j++) {
      out.push({
        label: 'Foot unit',
        dist: Math.round(util.dist2(px, pz, cops[j].x, cops[j].z))
      });
    }
    out.sort(function (a, b) { return a.dist - b.dist; });
    return out.slice(0, 3);
  }

  function nearestPoliceDist(px, pz) {
    var best = Infinity;
    for (var i = 0; i < cruisers.length; i++) {
      best = Math.min(best, util.dist2(px, pz, cruisers[i].x, cruisers[i].z));
    }
    for (var j = 0; j < cops.length; j++) {
      best = Math.min(best, util.dist2(px, pz, cops[j].x, cops[j].z));
    }
    return best;
  }

  // Push two cars apart when they touch, trading some speed.
  function collideCars(a, b, onCrash) {
    var dx = b.x - a.x;
    var dz = b.z - a.z;
    var d = Math.sqrt(dx * dx + dz * dz);
    var min = a.radius + b.radius - 0.6;
    if (d >= min || d < 0.01) return;
    var nx = dx / d;
    var nz = dz / d;
    var overlap = (min - d) / 2;
    a.x -= nx * overlap;
    a.z -= nz * overlap;
    b.x += nx * overlap;
    b.z += nz * overlap;
    var closing = Math.abs(a.speed - b.speed);
    var tmp = a.speed;
    a.speed = b.speed * 0.7 + a.speed * 0.3;
    b.speed = tmp * 0.7 + b.speed * 0.3;
    if (closing > 8 && onCrash) onCrash(a);
  }

  function update(dt, player, playerCar, onCrash) {
    clock += dt;
    var px = player.x;
    var pz = player.z;

    // Wanted decay: lie low for a while and the heat cools off.
    if (wanted > 0 && clock - lastCrimeAt > 25 && nearestPoliceDist(px, pz) > 45) {
      setWanted(wanted - 1);
      lastCrimeAt = clock;
    }

    // Desired force for the current heat.
    var wantCruisers = wanted >= 1 ? Math.min(wanted, 4) : 0;
    var wantCops = wanted >= 2 ? Math.min(wanted - 1, 3) : 0;
    while (cruisers.length < wantCruisers) spawnCruiserNear(px, pz);
    while (cruisers.length > wantCruisers) removeCruiser(cruisers[cruisers.length - 1]);
    while (cops.length < wantCops) spawnCopNear(px, pz);
    while (cops.length > wantCops) removeCop(cops[cops.length - 1]);

    // Cruisers: pursue the player, lights flashing.
    var phase = (clock * 2.4) % 1;
    for (var i = 0; i < cruisers.length; i++) {
      var car = cruisers[i];
      window.CH.vehicles.flashLights(car, phase + i * 0.25);
      // Despawn a cruiser left far behind.
      if (util.dist2(px, pz, car.x, car.z) > 160) {
        window.CH.vehicles.setPose(car, px + util.range(rngRef, -70, 70), pz + util.range(rngRef, -70, 70), car.heading);
      }
      var desired = Math.atan2(px - car.x, pz - car.z);
      var steer = util.clamp(util.angleDiff(desired, car.heading) * 2.6, -1, 1);
      window.CH.vehicles.drive(car, dt, { throttle: 1, steer: steer, handbrake: false }, onCrash);
      if (playerCar) collideCars(car, playerCar, onCrash);
    }

    // Foot cops: run the player down on foot.
    for (var j = 0; j < cops.length; j++) {
      var cop = cops[j];
      var d = util.dist2(px, pz, cop.x, cop.z);
      if (d > 90) {
        removeCop(cop);
        j--;
        continue;
      }
      var want = Math.atan2(px - cop.x, pz - cop.z);
      cop.heading = util.angleLerp(cop.heading, want, Math.min(1, dt * 5));
      var spd = 6.8;
      var nx = cop.x + Math.sin(cop.heading) * spd * dt;
      var nz = cop.z + Math.cos(cop.heading) * spd * dt;
      var res = window.CH.city.collideCircle(nx, nz, 0.5);
      cop.x = res.x;
      cop.z = res.z;
      cop.phase += dt * 11;
      cop.mesh.group.position.set(cop.x, Math.abs(Math.sin(cop.phase)) * 0.06, cop.z);
      cop.mesh.group.rotation.y = cop.heading;
      cop.mesh.legL.rotation.x = Math.sin(cop.phase) * 0.7;
      cop.mesh.legR.rotation.x = -Math.sin(cop.phase) * 0.7;

      // The bust: a cop holds a slow player on foot.
      if (!player.inCar && d < 2.6 && player.speed < 3 && !busted) {
        cop.catchT += dt;
        if (cop.catchT > 2.2) {
          busted = true;
          if (hooks.onBusted) hooks.onBusted();
        }
      } else {
        cop.catchT = Math.max(0, cop.catchT - dt);
      }
    }
  }

  function resetAfterBust() {
    busted = false;
    wanted = 0;
    while (cruisers.length) removeCruiser(cruisers[0]);
    while (cops.length) removeCop(cops[0]);
    lastCrimeAt = clock;
  }

  function resetBustedFlag() {
    busted = false;
  }

  function isBusted() {
    return busted;
  }

  window.CH = window.CH || {};
  window.CH.police = {
    init: init,
    update: update,
    wanted: wantedCount,
    setWanted: setWanted,
    addWanted: addWanted,
    stageChase: stageChase,
    units: units,
    nearestPoliceDist: nearestPoliceDist,
    resetAfterBust: resetAfterBust,
    resetBustedFlag: resetBustedFlag,
    isBusted: isBusted,
    cruisers: function () { return cruisers; },
    cops: function () { return cops; }
  };
})();
