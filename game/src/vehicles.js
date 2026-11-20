// Cars: the low-poly mesh builder (sedan, taxi, sports, truck, police)
// and the arcade driving model every car shares — player, traffic and
// police all drive on the same physics, with damage, smoke and explosions.
(function () {
  var CH = window.CH;
  var CONFIG = CH.CONFIG;

  var CAR_COLORS = [0xc9403a, 0x3a6ec9, 0xe8e8e8, 0x2f2f33, 0xd8a03c, 0x53a05a, 0x7a5ac9, 0x40b8c9, 0xd86a3c, 0x9fb8c8];
  var wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 12);
  var wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
  var glassMat = new THREE.MeshStandardMaterial({ color: 0x1c2f42, roughness: 0.15, metalness: 0.5 });
  var lightMat = new THREE.MeshStandardMaterial({ color: 0xfff6c8, emissive: 0xffedb0, emissiveIntensity: 0.9 });
  var tailMat = new THREE.MeshStandardMaterial({ color: 0x881111, emissive: 0x550000, emissiveIntensity: 0.6 });

  function buildCarMesh(kind, colorHex) {
    var group = new THREE.Group();
    var bodyMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.35, metalness: 0.35 });
    var isSports = kind === 'sports';
    var isTruck = kind === 'truck';
    var isPolice = kind === 'police';
    var bodyLen = isTruck ? 5.4 : isSports ? 4.4 : 4.6;
    var bodyWid = isTruck ? 2.3 : 2.0;
    var bodyH = isSports ? 0.62 : 0.78;
    var body = new THREE.Mesh(new THREE.BoxGeometry(bodyWid, bodyH, bodyLen), bodyMat);
    body.position.y = 0.62;
    body.castShadow = true;
    group.add(body);
    if (isPolice) {
      // White doors on a black body, GTA-style.
      var doors = new THREE.Mesh(new THREE.BoxGeometry(bodyWid + 0.04, bodyH * 0.8, bodyLen * 0.45), new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4 }));
      doors.position.y = 0.62;
      group.add(doors);
    }
    var cabin = new THREE.Mesh(new THREE.BoxGeometry(bodyWid * 0.82, 0.62, bodyLen * 0.45), glassMat);
    cabin.position.set(0, 1.28, isSports ? -0.2 : 0.1);
    cabin.castShadow = true;
    group.add(cabin);
    if (isSports) {
      var spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.1, 0.5), bodyMat);
      spoiler.position.set(0, 1.15, -bodyLen / 2 + 0.2);
      group.add(spoiler);
    }
    if (kind === 'taxi') {
      var sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.4), new THREE.MeshStandardMaterial({ color: 0xffe14d, emissive: 0xcc9900, emissiveIntensity: 0.7 }));
      sign.position.set(0, 1.72, 0.1);
      group.add(sign);
    }
    var wheels = [];
    [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(function (c) {
      var wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(c[0] * (bodyWid / 2 - 0.05), 0.42, c[1] * (bodyLen / 2 - 0.8));
      group.add(wheel);
      wheels.push(wheel);
    });
    // Headlights and tail lights.
    [[-0.7, 1], [0.7, 1]].forEach(function (p) {
      var hl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.1), lightMat);
      hl.position.set(p[0], 0.66, bodyLen / 2 + 0.02);
      group.add(hl);
      var tl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.1), tailMat);
      tl.position.set(p[0], 0.66, -bodyLen / 2 - 0.02);
      group.add(tl);
    });
    var lightBar = null;
    if (isPolice) {
      lightBar = new THREE.Group();
      var red = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.22, 0.4), new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff0000, emissiveIntensity: 2 }));
      red.position.x = -0.35;
      var blue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.22, 0.4), new THREE.MeshStandardMaterial({ color: 0x2244ff, emissive: 0x0033ff, emissiveIntensity: 2 }));
      blue.position.x = 0.35;
      lightBar.add(red);
      lightBar.add(blue);
      lightBar.position.set(0, 1.66, 0.1);
      group.add(lightBar);
      group.userData.redLight = red;
      group.userData.blueLight = blue;
    }
    group.userData.wheels = wheels;
    group.userData.lightBar = lightBar;
    return group;
  }

  function makeCar(scene, kind, x, z, heading, colorHex) {
    var group = buildCarMesh(kind, colorHex === undefined ? CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)] : colorHex);
    group.position.set(x, 0, z);
    group.rotation.y = heading;
    scene.add(group);
    return {
      group: group,
      kind: kind,
      heading: heading,
      vx: 0,
      vz: 0,
      speed: 0,
      steer: 0,
      damage: 0,
      dead: false,
      driver: null, // 'player' | 'traffic' | 'police' | null (parked)
      smokeTimer: 0,
      flashTimer: 0,
      radius: 2.3,
    };
  }

  // Arcade driving: engine force along the heading, lateral grip that
  // bleeds slide away, and a handbrake that kills the grip for drifts.
  function driveCar(car, dt, throttle, steerInput, handbrake, city, events) {
    if (car.dead) return;
    var cfg = CONFIG.car;
    var fx = Math.sin(car.heading);
    var fz = Math.cos(car.heading);
    var px = fz;
    var pz = -fx;
    var vf = car.vx * fx + car.vz * fz;
    var vl = car.vx * px + car.vz * pz;
    var accel = throttle >= 0 ? cfg.accel : cfg.brake;
    if (throttle < 0 && vf > 0.5) accel = cfg.brake;
    else if (throttle < 0) accel = cfg.reverseAccel;
    vf += throttle * accel * dt;
    vf -= vf * 0.35 * dt;
    if (throttle === 0) vf -= vf * 0.6 * dt;
    vf = CH.clamp(vf, -cfg.maxReverse, cfg.maxSpeed);
    var grip = handbrake ? cfg.handbrakeGrip : cfg.grip;
    vl *= Math.exp(-grip * dt);
    car.vx = fx * vf + px * vl;
    car.vz = fz * vf + pz * vl;
    car.speed = vf;
    var steerAuthority = CH.clamp(Math.abs(vf) / 9, 0, 1) * (vf < 0 ? -1 : 1);
    car.heading += steerInput * cfg.steerRate * steerAuthority * dt;
    car.steer = CH.damp(car.steer, steerInput, 8, dt);
    var oldX = car.group.position.x;
    var oldZ = car.group.position.z;
    car.group.position.x += car.vx * dt;
    car.group.position.z += car.vz * dt;
    var beforeX = car.group.position.x;
    var beforeZ = car.group.position.z;
    city.resolveCircle(car.group.position, car.radius);
    var pushed = CH.dist(beforeX, beforeZ, car.group.position.x, car.group.position.z);
    if (pushed > 0.05 && Math.abs(vf) > 3) {
      var impact = Math.abs(vf);
      car.vx *= 0.3;
      car.vz *= 0.3;
      car.damage += impact * 0.45;
      events.push({ type: 'crash', x: car.group.position.x, z: car.group.position.z, hard: impact > 16 });
      if (car.damage >= cfg.maxDamage) killCar(car, events);
    }
    car.group.rotation.y = car.heading;
    // Wheels: spin with speed, fronts yaw with steering.
    var wheels = car.group.userData.wheels;
    var spin = (vf * dt) / 0.42;
    for (var i = 0; i < wheels.length; i++) {
      wheels[i].rotation.x += spin;
      if (i < 2) wheels[i].rotation.y = car.steer * 0.42;
    }
    // Smoke when battered.
    if (car.damage > 55 && !car.dead) {
      car.smokeTimer -= dt;
      if (car.smokeTimer <= 0) {
        car.smokeTimer = 0.12;
        events.push({ type: 'smoke', x: car.group.position.x, z: car.group.position.z });
      }
    }
    // Police light bar strobes.
    if (car.kind === 'police') {
      car.flashTimer += dt;
      var on = Math.floor(car.flashTimer * 4) % 2 === 0;
      car.group.userData.redLight.material.emissiveIntensity = on ? 2.4 : 0.2;
      car.group.userData.blueLight.material.emissiveIntensity = on ? 0.2 : 2.4;
    }
  }

  function killCar(car, events) {
    if (car.dead) return;
    car.dead = true;
    car.vx = 0;
    car.vz = 0;
    events.push({ type: 'explosion', x: car.group.position.x, z: car.group.position.z });
    car.group.traverse(function (child) {
      if (child.isMesh && child.material && child.material.color) {
        child.material = child.material.clone();
        child.material.color.set(0x1c1c1c);
        child.material.emissiveIntensity = 0;
      }
    });
  }

  CH.buildCarMesh = buildCarMesh;
  CH.makeCar = makeCar;
  CH.driveCar = driveCar;
  CH.killCar = killCar;
  CH.CAR_COLORS = CAR_COLORS;
})();
