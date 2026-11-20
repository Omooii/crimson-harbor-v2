// pedestrians.js — the people on the sidewalks. They stroll from one
// sidewalk corner to the next, bob as they walk, and run when a gunshot
// goes off or a car bears down on them. A pedestrian hit hard by a car
// goes down, and the law notices.
(function () {
  'use strict';

  var cfg = window.CH.config;
  var util = window.CH.util;

  var peds = [];
  var sceneRef = null;
  var onPedHit = null; // set by main: (ped) => void

  var SHIRTS = [0xc75b39, 0x3a6b8a, 0x7a9a4a, 0xd8b13a, 0x8a5a9a, 0x4a9a8a, 0xe0e0e0, 0x2a2a3a];
  var SKINS = [0xf2c9a0, 0xd8a070, 0xa07048, 0x8a5a38, 0xf2d0b0];

  var bodyGeo = null;
  var headGeo = null;
  var legGeo = null;

  function buildPedMesh(shirt, skin) {
    if (!bodyGeo) {
      bodyGeo = new THREE.CapsuleGeometry(0.32, 0.75, 3, 8);
      headGeo = new THREE.SphereGeometry(0.24, 10, 8);
      legGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.7, 6);
    }
    var group = new THREE.Group();
    var body = new THREE.Mesh(bodyGeo, new THREE.MeshLambertMaterial({ color: shirt }));
    body.position.y = 1.15;
    group.add(body);
    var head = new THREE.Mesh(headGeo, new THREE.MeshLambertMaterial({ color: skin }));
    head.position.y = 1.85;
    group.add(head);
    var legMat = new THREE.MeshLambertMaterial({ color: 0x2e2c3a });
    var legL = new THREE.Mesh(legGeo, legMat);
    legL.position.set(-0.14, 0.35, 0);
    group.add(legL);
    var legR = new THREE.Mesh(legGeo, legMat);
    legR.position.set(0.14, 0.35, 0);
    group.add(legR);
    return { group: group, body: body, legL: legL, legR: legR };
  }

  // A random point on a sidewalk: just inside a block edge.
  function sidewalkPoint(rng) {
    var bx = util.pick(rng, cfg.blockCenters);
    var bz = util.pick(rng, cfg.blockCenters);
    var edge = Math.floor(rng() * 4);
    var inset = cfg.BLOCK / 2 - 1.5;
    var x = bx;
    var z = bz;
    if (edge === 0) { x = bx - inset; z = bz + util.range(rng, -inset, inset); }
    if (edge === 1) { x = bx + inset; z = bz + util.range(rng, -inset, inset); }
    if (edge === 2) { z = bz - inset; x = bx + util.range(rng, -inset, inset); }
    if (edge === 3) { z = bz + inset; x = bx + util.range(rng, -inset, inset); }
    return { x: x, z: z };
  }

  function spawnPed(scene, rng) {
    var p = sidewalkPoint(rng);
    var mesh = buildPedMesh(util.pick(rng, SHIRTS), util.pick(rng, SKINS));
    mesh.group.position.set(p.x, 0, p.z);
    scene.add(mesh.group);
    var ped = {
      mesh: mesh,
      x: p.x,
      z: p.z,
      heading: util.range(rng, 0, Math.PI * 2),
      speed: util.range(rng, 1.4, 2.4),
      target: sidewalkPoint(rng),
      state: 'walk', // walk | flee | down
      stateT: 0,
      walkPhase: util.range(rng, 0, Math.PI * 2),
      down: false
    };
    peds.push(ped);
    return ped;
  }

  function init(scene, rng, count) {
    sceneRef = scene;
    peds = [];
    for (var i = 0; i < count; i++) spawnPed(scene, rng);
  }

  function setOnPedHit(fn) {
    onPedHit = fn;
  }

  // A threat the peds react to: {x, z, kind: 'car'|'shot', radius}.
  function scare(x, z, radius) {
    for (var i = 0; i < peds.length; i++) {
      var ped = peds[i];
      if (ped.state === 'down') continue;
      if (util.dist2(ped.x, ped.z, x, z) < radius) {
        ped.state = 'flee';
        ped.stateT = 0;
        ped.fleeFrom = { x: x, z: z };
      }
    }
  }

  function knockDown(ped) {
    if (ped.state === 'down') return;
    ped.state = 'down';
    ped.stateT = 0;
    ped.mesh.group.rotation.x = Math.PI / 2;
    ped.mesh.group.position.y = 0.3;
    if (onPedHit) onPedHit(ped);
  }

  function update(dt, rng, playerCar) {
    for (var i = 0; i < peds.length; i++) {
      var ped = peds[i];
      ped.stateT += dt;
      if (ped.state === 'down') {
        if (ped.stateT > 7) {
          ped.state = 'flee';
          ped.stateT = 0;
          ped.fleeFrom = { x: ped.x + 1, z: ped.z };
          ped.mesh.group.rotation.x = 0;
          ped.mesh.group.position.y = 0;
        }
        continue;
      }
      var tx;
      var tz;
      var speed = ped.speed;
      if (ped.state === 'flee') {
        // Run directly away from the threat.
        var dx = ped.x - ped.fleeFrom.x;
        var dz = ped.z - ped.fleeFrom.z;
        var d = Math.sqrt(dx * dx + dz * dz) || 1;
        tx = ped.x + (dx / d) * 10;
        tz = ped.z + (dz / d) * 10;
        speed = 5.2;
        if (ped.stateT > 3.5) {
          ped.state = 'walk';
          ped.target = sidewalkPoint(rng);
        }
      } else {
        tx = ped.target.x;
        tz = ped.target.z;
        if (util.dist2(ped.x, ped.z, tx, tz) < 2.5) {
          ped.target = sidewalkPoint(rng);
          tx = ped.target.x;
          tz = ped.target.z;
        }
      }
      var desired = Math.atan2(tx - ped.x, tz - ped.z);
      ped.heading = util.angleLerp(ped.heading, desired, Math.min(1, dt * 6));
      var nx = ped.x + Math.sin(ped.heading) * speed * dt;
      var nz = ped.z + Math.cos(ped.heading) * speed * dt;
      var res = window.CH.city.collideCircle(nx, nz, 0.5);
      // Pedestrians stay out of the water too.
      if (!window.CH.city.isWater(res.x, res.z)) {
        ped.x = res.x;
        ped.z = res.z;
      }
      // Walk cycle: bob and swing the legs.
      ped.walkPhase += dt * speed * 3.2;
      var bob = Math.abs(Math.sin(ped.walkPhase)) * 0.06;
      ped.mesh.group.position.set(ped.x, bob, ped.z);
      ped.mesh.group.rotation.y = ped.heading;
      var swing = Math.sin(ped.walkPhase) * 0.55;
      ped.mesh.legL.rotation.x = swing;
      ped.mesh.legR.rotation.x = -swing;

      // Hit by the player's car?
      if (playerCar && Math.abs(playerCar.speed) > 4) {
        if (util.dist2(ped.x, ped.z, playerCar.x, playerCar.z) < 2.4) {
          knockDown(ped);
        }
      }
    }
  }

  function nearest(x, z, maxDist) {
    var best = null;
    var bestD = maxDist;
    for (var i = 0; i < peds.length; i++) {
      var p = peds[i];
      if (p.state === 'down') continue;
      var d = util.dist2(x, z, p.x, p.z);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  function all() {
    return peds;
  }

  window.CH = window.CH || {};
  window.CH.pedestrians = {
    init: init,
    update: update,
    scare: scare,
    knockDown: knockDown,
    nearest: nearest,
    all: all,
    setOnPedHit: setOnPedHit
  };
})();
