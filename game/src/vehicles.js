// vehicles.js — car meshes and arcade driving physics. A car is a group
// of boxes (body, cabin, four wheels, plus a kind-specific extra) driven
// by one shared physics step: throttle, steering, handbrake, drag and
// building collision. Heading 0 faces +z (south); forward is
// (sin(heading), cos(heading)).
(function () {
  'use strict';

  var cfg = window.CH.config;
  var util = window.CH.util;

  var wheelGeo = null;
  var wheelMat = null;

  function wheelParts() {
    if (!wheelGeo) {
      wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.34, 10);
      wheelGeo.rotateZ(Math.PI / 2);
      wheelMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1e });
    }
    return { geo: wheelGeo, mat: wheelMat };
  }

  // Build the visible car. Returns {group, wheels, steerWheels, lights}.
  function buildCarMesh(kind, bodyColor) {
    var wp = wheelParts();
    var group = new THREE.Group();
    var bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
    var glassMat = new THREE.MeshLambertMaterial({ color: 0x1e2c3a });
    var trimMat = new THREE.MeshLambertMaterial({ color: 0x2a2a30 });

    var body;
    var cabin;
    if (kind === 'truck') {
      body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.5, 5.4), bodyMat);
      body.position.y = 0.95;
      group.add(body);
      var cargo = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.3, 2.6), trimMat);
      cargo.position.set(0, 2.2, -0.9);
      group.add(cargo);
      cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 1.4), glassMat);
      cabin.position.set(0, 1.9, 1.7);
      group.add(cabin);
    } else if (kind === 'sports') {
      body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.7, 4.6), bodyMat);
      body.position.y = 0.62;
      group.add(body);
      cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 2.0), glassMat);
      cabin.position.set(0, 1.2, -0.2);
      group.add(cabin);
      var spoiler = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 0.5), trimMat);
      spoiler.position.set(0, 1.05, -2.2);
      group.add(spoiler);
    } else {
      body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.85, 4.6), bodyMat);
      body.position.y = 0.78;
      group.add(body);
      cabin = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.7, 2.2), glassMat);
      cabin.position.set(0, 1.5, -0.2);
      group.add(cabin);
    }

    // Headlights: two small warm glows at the front.
    var lightMat = new THREE.MeshLambertMaterial({
      color: 0xfff2c0, emissive: 0xffe9a0, emissiveIntensity: 0.7
    });
    [-0.75, 0.75].forEach(function (dx) {
      var lamp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.12), lightMat);
      lamp.position.set(dx, 0.82, 2.32);
      group.add(lamp);
    });

    var lights = null;
    if (kind === 'taxi') {
      var sign = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.32, 0.4),
        new THREE.MeshLambertMaterial({ color: 0xfff6c8, emissive: 0xa89000, emissiveIntensity: 0.5 })
      );
      sign.position.set(0, 2.0, -0.2);
      group.add(sign);
    }
    if (kind === 'police') {
      var bar = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.18, 0.5), trimMat);
      bar.position.set(0, 1.98, -0.2);
      group.add(bar);
      var redMat = new THREE.MeshLambertMaterial({ color: 0xff2a2a, emissive: 0xff0000, emissiveIntensity: 1 });
      var blueMat = new THREE.MeshLambertMaterial({ color: 0x2a6aff, emissive: 0x0044ff, emissiveIntensity: 1 });
      var lr = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.3, 0.4), redMat);
      lr.position.set(-0.45, 2.15, -0.2);
      group.add(lr);
      var lb = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.3, 0.4), blueMat);
      lb.position.set(0.45, 2.15, -0.2);
      group.add(lb);
      lights = { red: redMat, blue: blueMat };
    }

    var wheels = [];
    var steerWheels = [];
    [[-1.0, 1.55], [1.0, 1.55], [-1.0, -1.55], [1.0, -1.55]].forEach(function (p, i) {
      var w = new THREE.Mesh(wp.geo, wp.mat);
      w.position.set(p[0], 0.42, p[1]);
      group.add(w);
      wheels.push(w);
      if (i < 2) steerWheels.push(w);
    });

    return { group: group, wheels: wheels, steerWheels: steerWheels, lights: lights };
  }

  // Paint jobs: every kind except taxi and police comes in several
  // colours, so the traffic reads as many different cars, not clones.
  var PAINT = {
    sedan: [0x7a8ba0, 0x9a8a7a, 0x5a7a5a, 0x8a6a9a, 0xb0b0b0, 0x3a5a8a],
    sports: [0xc0392b, 0x2a6ac0, 0xe8e4da, 0x1c1c22, 0x2a9a6a],
    truck: [0x9a6b4f, 0x6b8a9a, 0xe8e4da],
    taxi: [0xf2b705],
    police: [0x1c2733]
  };

  function createCar(scene, kind, x, z, heading, colorOverride) {
    var spec = cfg.cars[kind];
    var color;
    if (colorOverride !== undefined) {
      color = colorOverride;
    } else {
      var paints = PAINT[kind] || [spec.body];
      color = paints[Math.floor(Math.random() * paints.length)];
    }
    var mesh = buildCarMesh(kind, color);
    mesh.group.position.set(x, 0, z);
    mesh.group.rotation.y = heading;
    scene.add(mesh.group);
    return {
      kind: kind,
      spec: spec,
      group: mesh.group,
      wheels: mesh.wheels,
      steerWheels: mesh.steerWheels,
      lights: mesh.lights,
      x: x,
      z: z,
      heading: heading,
      speed: 0,
      steer: 0,
      radius: 2.3,
      condition: 100, // bodywork: crashes wear it down, repair restores it
      dead: false
    };
  }

  function removeCar(scene, car) {
    scene.remove(car.group);
    car.dead = true;
  }

  // One physics step. input: {throttle (-1..1), steer (-1..1),
  // handbrake, nitro}. Returns {hit} — true when the car struck a
  // building this step. A battered car is slower; nitro buys speed back.
  function drive(car, dt, input, onCrash) {
    var spec = car.spec;
    var throttle = input.throttle || 0;
    var steer = input.steer || 0;
    var handbrake = !!input.handbrake;
    var nitro = !!input.nitro;
    var condF = car.condition < 30 ? 0.55 : car.condition < 60 ? 0.8 : 1;
    var topSpeed = spec.topSpeed * condF * (nitro ? 1.45 : 1);
    var accel = spec.accel * (nitro ? 1.6 : 1);

    // Longitudinal: accelerate, brake, drag.
    if (throttle > 0) {
      car.speed += accel * throttle * dt;
    } else if (throttle < 0) {
      if (car.speed > 0.5) car.speed += accel * 1.6 * throttle * dt; // braking
      else car.speed += accel * 0.55 * throttle * dt; // reversing
    }
    var drag = handbrake ? 1.9 : 0.55;
    car.speed -= car.speed * drag * dt;
    var maxReverse = -spec.topSpeed * 0.35;
    car.speed = util.clamp(car.speed, maxReverse, topSpeed);

    // Steering: sharper at low speed, impossible standing still.
    var spdFactor = util.clamp(Math.abs(car.speed) / 7, 0, 1);
    var turn = spec.turn * (handbrake ? 1.5 : 1) * spdFactor;
    if (car.speed < 0) turn = -turn;
    car.heading += steer * turn * dt;
    car.steer = util.lerp(car.steer, steer, Math.min(1, dt * 8));

    // Move and collide.
    var nx = car.x + Math.sin(car.heading) * car.speed * dt;
    var nz = car.z + Math.cos(car.heading) * car.speed * dt;
    var res = window.CH.city.collideCircle(nx, nz, car.radius);
    var hit = res.hit;
    if (hit && Math.abs(car.speed) > 5) {
      if (onCrash) onCrash(car);
      car.speed *= 0.35;
    } else if (hit) {
      car.speed *= 0.6;
    }
    car.x = res.x;
    car.z = res.z;

    // Keep out of the water: the harbour edge is a wall of air.
    if (window.CH.city.isWater(car.x, car.z)) {
      car.x = util.clamp(car.x, cfg.bounds.minX, cfg.harborX + 2);
      car.z = util.clamp(car.z, cfg.bounds.minZ, cfg.seaZ - 2);
      car.speed *= 0.5;
    }

    syncMesh(car, dt);
    return { hit: hit };
  }

  // Push the mesh to match the physics state; spin and steer the wheels.
  function syncMesh(car, dt) {
    car.group.position.set(car.x, 0, car.z);
    car.group.rotation.y = car.heading;
    var spin = (car.speed * dt) / 0.42;
    for (var i = 0; i < car.wheels.length; i++) {
      car.wheels[i].rotation.x += spin;
    }
    for (var j = 0; j < car.steerWheels.length; j++) {
      car.steerWheels[j].rotation.y = car.steer * 0.45;
    }
  }

  function setPose(car, x, z, heading) {
    car.x = x;
    car.z = z;
    car.heading = heading;
    car.speed = 0;
    syncMesh(car, 0);
  }

  // Flash a police light bar: phase 0..1 alternates red and blue.
  function flashLights(car, phase) {
    if (!car.lights) return;
    var on = phase < 0.5;
    car.lights.red.emissiveIntensity = on ? 2.2 : 0.15;
    car.lights.blue.emissiveIntensity = on ? 0.15 : 2.2;
  }

  window.CH = window.CH || {};
  window.CH.vehicles = {
    createCar: createCar,
    removeCar: removeCar,
    drive: drive,
    setPose: setPose,
    flashLights: flashLights
  };
})();
