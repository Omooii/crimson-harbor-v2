// player.js — the player on foot and behind the wheel: camera-relative
// movement, running, entering and leaving cars, fists and the pistol.
// Driving itself lives in vehicles.js; this file decides when the player
// is a pedestrian and when they are a driver.
(function () {
  'use strict';

  var cfg = window.CH.config;
  var util = window.CH.util;

  var state = null;
  var mesh = null;
  var pistolMesh = null;
  var sceneRef = null;
  var hooks = {}; // onEnterCar, onExitCar, onCrime, findCar, onShoot, onPunch

  var WALK_SPEED = 6;
  var RUN_SPEED = 10.5;

  function buildMesh() {
    var group = new THREE.Group();
    var body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.34, 0.8, 3, 10),
      new THREE.MeshLambertMaterial({ color: 0xc0392b })
    );
    body.position.y = 1.18;
    group.add(body);
    var head = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 12, 10),
      new THREE.MeshLambertMaterial({ color: 0xf2c9a0 })
    );
    head.position.y = 1.9;
    group.add(head);
    var legMat = new THREE.MeshLambertMaterial({ color: 0x2e3440 });
    var legGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.75, 6);
    var legL = new THREE.Mesh(legGeo, legMat);
    legL.position.set(-0.15, 0.38, 0);
    group.add(legL);
    var legR = new THREE.Mesh(legGeo, legMat);
    legR.position.set(0.15, 0.38, 0);
    group.add(legR);
    // The pistol: a small dark box in the right hand, shown only when drawn.
    pistolMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.16, 0.45),
      new THREE.MeshLambertMaterial({ color: 0x1a1a1e })
    );
    pistolMesh.position.set(0.42, 1.35, 0.3);
    pistolMesh.visible = false;
    group.add(pistolMesh);
    return { group: group, legL: legL, legR: legR };
  }

  function init(scene, x, z, heading, hookFns) {
    sceneRef = scene;
    hooks = hookFns || {};
    mesh = buildMesh();
    mesh.group.position.set(x, 0, z);
    mesh.group.rotation.y = heading;
    scene.add(mesh.group);
    state = {
      x: x,
      z: z,
      heading: heading,
      speed: 0,
      inCar: false,
      car: null,
      armed: false,
      punchCd: 0,
      shootCd: 0,
      walkPhase: 0,
      bustedT: 0
    };
    return state;
  }

  function setHooks(h) {
    hooks = h;
  }

  function setPose(x, z, heading) {
    state.x = x;
    state.z = z;
    state.heading = heading;
    state.speed = 0;
    mesh.group.position.set(x, 0, z);
    mesh.group.rotation.y = heading;
  }

  function show(on) {
    mesh.group.visible = on;
  }

  function enterCar(car) {
    state.inCar = true;
    state.car = car;
    state.speed = 0;
    show(false);
    if (hooks.onEnterCar) hooks.onEnterCar(car);
  }

  function exitCar() {
    if (!state.car) return;
    var car = state.car;
    // Step out on the driver's side.
    var sx = car.x + Math.cos(car.heading) * 2.6;
    var sz = car.z - Math.sin(car.heading) * 2.6;
    var res = window.CH.city.collideCircle(sx, sz, 0.5);
    state.inCar = false;
    state.car = null;
    setPose(res.x, res.z, car.heading);
    show(true);
    if (hooks.onExitCar) hooks.onExitCar(car);
  }

  function punch() {
    if (state.punchCd > 0) return;
    state.punchCd = 0.4;
    window.CH.audio.punch();
    // Hit the nearest person in front of the player.
    var fx = Math.sin(state.heading);
    var fz = Math.cos(state.heading);
    var target = null;
    var bestD = 2.4;
    var peds = window.CH.pedestrians.all();
    for (var i = 0; i < peds.length; i++) {
      var p = peds[i];
      if (p.state === 'down') continue;
      var dx = p.x - state.x;
      var dz = p.z - state.z;
      var d = Math.sqrt(dx * dx + dz * dz);
      if (d < bestD && (dx * fx + dz * fz) / (d || 1) > 0.4) {
        bestD = d;
        target = p;
      }
    }
    if (target) {
      window.CH.pedestrians.knockDown(target);
      if (hooks.onCrime) hooks.onCrime(1, 'assault');
    }
    if (hooks.onPunch) hooks.onPunch(state.x + fx * 1.5, state.z + fz * 1.5);
  }

  function shoot() {
    if (state.shootCd > 0) return;
    state.shootCd = 0.32;
    window.CH.audio.gunshot();
    var fx = Math.sin(state.heading);
    var fz = Math.cos(state.heading);
    var mx = state.x + fx * 1.2;
    var mz = state.z + fz * 1.2;
    if (hooks.onShoot) hooks.onShoot(mx, mz, fx, fz);
    window.CH.pedestrians.scare(state.x, state.z, 30);
    if (hooks.onCrime) hooks.onCrime(1, 'shooting');
    // Hit the nearest person roughly in the line of fire.
    var target = null;
    var bestD = 26;
    var peds = window.CH.pedestrians.all();
    for (var i = 0; i < peds.length; i++) {
      var p = peds[i];
      if (p.state === 'down') continue;
      var dx = p.x - state.x;
      var dz = p.z - state.z;
      var d = Math.sqrt(dx * dx + dz * dz);
      if (d < bestD && (dx * fx + dz * fz) / (d || 1) > 0.93) {
        bestD = d;
        target = p;
      }
    }
    if (target) window.CH.pedestrians.knockDown(target);
  }

  function update(dt, input, cameraYaw) {
    state.punchCd = Math.max(0, state.punchCd - dt);
    state.shootCd = Math.max(0, state.shootCd - dt);

    if (state.inCar) {
      // Driving is handled by main.js through vehicles.drive; here we only
      // watch for the exit key and keep the player's position on the car.
      if (input.tapped('enter')) exitCar();
      if (state.car) {
        state.x = state.car.x;
        state.z = state.car.z;
        state.heading = state.car.heading;
        state.speed = Math.abs(state.car.speed);
      }
      return;
    }

    // On foot: camera-relative movement.
    var fwdX = Math.sin(cameraYaw);
    var fwdZ = Math.cos(cameraYaw);
    // Screen-right when looking along the camera's forward direction.
    var rightX = -Math.cos(cameraYaw);
    var rightZ = Math.sin(cameraYaw);
    var mx = 0;
    var mz = 0;
    if (input.held('forward')) { mx += fwdX; mz += fwdZ; }
    if (input.held('back')) { mx -= fwdX; mz -= fwdZ; }
    if (input.held('right')) { mx += rightX; mz += rightZ; }
    if (input.held('left')) { mx -= rightX; mz -= rightZ; }
    var moving = mx !== 0 || mz !== 0;
    var topSpeed = input.held('run') ? RUN_SPEED : WALK_SPEED;
    if (moving) {
      var len = Math.sqrt(mx * mx + mz * mz);
      mx /= len;
      mz /= len;
      state.heading = util.angleLerp(state.heading, Math.atan2(mx, mz), Math.min(1, dt * 12));
      state.speed = util.lerp(state.speed, topSpeed, Math.min(1, dt * 8));
    } else {
      state.speed = util.lerp(state.speed, 0, Math.min(1, dt * 10));
    }
    var nx = state.x + Math.sin(state.heading) * state.speed * dt;
    var nz = state.z + Math.cos(state.heading) * state.speed * dt;
    var res = window.CH.city.collideCircle(nx, nz, 0.5);
    if (!window.CH.city.isWater(res.x, res.z)) {
      state.x = res.x;
      state.z = res.z;
    }

    // Walk cycle.
    state.walkPhase += dt * state.speed * 1.6;
    var bob = state.speed > 0.5 ? Math.abs(Math.sin(state.walkPhase)) * 0.05 : 0;
    mesh.group.position.set(state.x, bob, state.z);
    mesh.group.rotation.y = state.heading;
    var swing = state.speed > 0.5 ? Math.sin(state.walkPhase) * 0.6 : 0;
    mesh.legL.rotation.x = swing;
    mesh.legR.rotation.x = -swing;

    // Actions.
    if (input.tapped('weapon')) {
      state.armed = !state.armed;
      pistolMesh.visible = state.armed;
      window.CH.audio.click();
    }
    if (input.tapped('action')) {
      if (state.armed) shoot();
      else punch();
    }
    if (input.tapped('enter') && hooks.findCar) {
      var car = hooks.findCar(state.x, state.z);
      if (car) enterCar(car);
    }
  }

  function getState() {
    return state;
  }

  window.CH = window.CH || {};
  window.CH.player = {
    init: init,
    setHooks: setHooks,
    update: update,
    getState: getState,
    setPose: setPose,
    show: show,
    enterCar: enterCar,
    exitCar: exitCar
  };
})();
