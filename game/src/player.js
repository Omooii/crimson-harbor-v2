// The player on foot: camera-relative movement, entering and stealing
// cars, punching and shooting, and health. Driving itself lives in
// vehicles.js; this file owns everything the player does outside a car.
(function () {
  var CH = window.CH;
  var CONFIG = CH.CONFIG;

  function createPlayer(scene, pedsApi, startX, startZ) {
    var group = pedsApi.buildPedMesh(null, { shirt: 0x1f8a8a, pants: 0x2f3542, skin: 0xf2c89b });
    // A cap so the player reads at a glance.
    var cap = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.44), new THREE.MeshStandardMaterial({ color: 0xc9403a, roughness: 0.8 }));
    cap.position.y = 2.0;
    group.add(cap);
    group.position.set(startX, 0, startZ);
    scene.add(group);
    return {
      group: group,
      heading: 0,
      mode: 'foot', // 'foot' | 'car'
      car: null,
      health: CONFIG.player.maxHealth,
      armed: false,
      walkPhase: 0,
      punchTimer: 0,
      shotTimer: 0,
      speed: 0,
      dead: false,
    };
  }

  function updateOnFoot(player, dt, input, world, events) {
    var cfg = CONFIG.player;
    var fwd = input.drive();
    var strafe = -input.steer();
    var camYaw = world.camYaw || 0;
    // WASD moves relative to the camera.
    var mx = Math.sin(camYaw) * fwd + Math.cos(camYaw) * strafe;
    var mz = Math.cos(camYaw) * fwd - Math.sin(camYaw) * strafe;
    var mag = Math.sqrt(mx * mx + mz * mz);
    var running = input.run();
    var top = running ? cfg.runSpeed : cfg.walkSpeed;
    if (mag > 0.01) {
      mx /= mag;
      mz /= mag;
      var wantHeading = Math.atan2(mx, mz);
      var dh = CH.angleDiff(wantHeading, player.heading);
      player.heading += CH.clamp(dh, -CONFIG.player.turnRate * dt, CONFIG.player.turnRate * dt);
      player.speed = CH.damp(player.speed, top, 8, dt);
    } else {
      player.speed = CH.damp(player.speed, 0, 10, dt);
    }
    player.group.position.x += Math.sin(player.heading) * player.speed * dt;
    player.group.position.z += Math.cos(player.heading) * player.speed * dt;
    world.city.resolveCircle(player.group.position, 0.9);
    player.group.rotation.y = player.heading;
    player.walkPhase += dt * (2 + player.speed * 1.4);
    var swing = Math.sin(player.walkPhase) * 0.6 * CH.clamp(player.speed / cfg.walkSpeed, 0, 1.2);
    var limbs = player.group.userData.limbs;
    limbs.legL.rotation.x = swing;
    limbs.legR.rotation.x = -swing;
    limbs.armL.rotation.x = -swing * 0.7;
    limbs.armR.rotation.x = swing * 0.7;
    player.group.position.y = Math.abs(Math.sin(player.walkPhase)) * 0.06;
    player.punchTimer -= dt;
    player.shotTimer -= dt;

    // Q draws or holsters the pistol.
    if (input.consume('q') && !player.dead) {
      player.armed = !player.armed;
    }
    // Combat: F or click shoots when armed, punches otherwise.
    if ((input.consume('f') || input.consumeClick()) && player.shotTimer <= 0 && !player.dead) {
      player.shotTimer = cfg.shotCooldown;
      if (player.armed) {
        fireShot(player, world, events);
      } else {
        punch(player, world, events);
      }
    }
  }

  function fireShot(player, world, events) {
    var origin = player.group.position;
    var dirX = Math.sin(world.camYaw || 0);
    var dirZ = Math.cos(world.camYaw || 0);
    events.push({ type: 'shot', x: origin.x, z: origin.z });
    // Aim assist: the nearest living target roughly ahead of the camera.
    var best = null;
    var bestScore = Infinity;
    function consider(tx, tz, obj, kind) {
      var dx = tx - origin.x;
      var dz = tz - origin.z;
      var d = Math.sqrt(dx * dx + dz * dz);
      if (d > 45 || d < 0.5) return;
      var along = (dx * dirX + dz * dirZ) / d;
      if (along < 0.86) return;
      var score = d + (1 - along) * 30;
      if (score < bestScore) { bestScore = score; best = { obj: obj, kind: kind, d: d }; }
    }
    world.pedestrians.peds.forEach(function (ped) {
      if (!ped.dead) consider(ped.group.position.x, ped.group.position.z, ped, 'ped');
    });
    world.police.cops.forEach(function (cop) {
      if (!cop.dead) consider(cop.group.position.x, cop.group.position.z, cop, 'cop');
    });
    world.cars.forEach(function (car) {
      if (!car.dead && car !== player.car) consider(car.group.position.x, car.group.position.z, car, 'car');
    });
    if (best) {
      var hitX = origin.x + dirX * best.d;
      var hitZ = origin.z + dirZ * best.d;
      events.push({ type: 'hit', x: hitX, z: hitZ });
      if (best.kind === 'ped') {
        world.pedestrians.hurtPed(best.obj, CONFIG.player.shotDamage, origin.x, origin.z, events);
        world.police.addWanted(CONFIG.wanted.killPed, events);
      } else if (best.kind === 'cop') {
        world.police.hurtCop(best.obj, CONFIG.player.shotDamage, events);
        world.police.addWanted(CONFIG.wanted.hitCop, events);
      } else {
        best.obj.damage += CONFIG.player.shotDamage;
        if (best.obj.damage >= CONFIG.car.maxDamage) CH.killCar(best.obj, events);
        if (best.obj.kind === 'police') world.police.addWanted(CONFIG.wanted.hitCop, events);
      }
    } else {
      world.police.addWanted(CONFIG.wanted.shoot, events);
    }
    events.push({ type: 'tracer', x: origin.x, z: origin.z, dx: dirX, dz: dirZ, len: best ? best.d : 40 });
  }

  function punch(player, world, events) {
    var origin = player.group.position;
    var range = CONFIG.player.punchRange;
    var hit = null;
    var best = Infinity;
    world.pedestrians.peds.forEach(function (ped) {
      if (ped.dead) return;
      var d = CH.dist(origin.x, origin.z, ped.group.position.x, ped.group.position.z);
      if (d < range && d < best) { best = d; hit = ped; }
    });
    events.push({ type: 'punch', x: origin.x, z: origin.z });
    if (hit) {
      world.pedestrians.hurtPed(hit, CONFIG.player.punchDamage, origin.x, origin.z, events);
      world.police.addWanted(CONFIG.wanted.hitPed, events);
    }
  }

  function nearestCar(player, cars, maxDist) {
    var origin = player.group.position;
    var best = null;
    var bestD = maxDist;
    cars.forEach(function (car) {
      if (car.dead) return;
      var d = CH.dist(origin.x, origin.z, car.group.position.x, car.group.position.z);
      if (d < bestD) { bestD = d; best = car; }
    });
    return best;
  }

  function enterCar(player, car, world, events) {
    var stolen = car.driver === 'traffic' || car.driver === null;
    car.driver = 'player';
    player.car = car;
    player.mode = 'car';
    player.group.visible = false;
    car.group.position.y = 0;
    events.push({ type: 'enterCar' });
    if (stolen) world.police.addWanted(CONFIG.wanted.stealCar, events);
    if (world.missions) world.missions.onEnterCar(car, events);
  }

  function exitCar(player, world, events) {
    var car = player.car;
    if (!car) return;
    player.car = null;
    player.mode = 'foot';
    var side = 2.6;
    player.group.position.set(
      car.group.position.x + Math.cos(car.heading) * side,
      0,
      car.group.position.z - Math.sin(car.heading) * side
    );
    world.city.resolveCircle(player.group.position, 0.9);
    player.heading = car.heading;
    player.group.rotation.y = player.heading;
    player.group.visible = true;
    car.driver = null;
    car.vx *= 0.4;
    car.vz *= 0.4;
    events.push({ type: 'enterCar' });
  }

  function damagePlayer(player, amount, world, events) {
    if (player.dead) return;
    player.health -= amount;
    events.push({ type: 'hurt' });
    if (player.health <= 0) {
      player.health = 0;
      player.dead = true;
      events.push({ type: world.wanted > 0 ? 'busted' : 'wasted' });
    }
  }

  CH.createPlayer = createPlayer;
  CH.updateOnFoot = updateOnFoot;
  CH.nearestCar = nearestCar;
  CH.enterCar = enterCar;
  CH.exitCar = exitCar;
  CH.damagePlayer = damagePlayer;
})();
