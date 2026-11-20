// The wanted system and the police who enforce it: stars earned by crime,
// pursuit cars that chase and ram, foot cops who chase and bust, and the
// heat that cools off only when no cop can see the player.
(function () {
  var CH = window.CH;
  var CONFIG = CH.CONFIG;

  function createPolice(scene, city, rng, pedsApi) {
    var copCars = [];
    var cops = [];
    var unseenTimer = 0;

    function addWanted(n, events) {
      var world = this.world;
      var before = world.wanted;
      world.wanted = CH.clamp(world.wanted + n, 0, CONFIG.wanted.max);
      if (world.wanted > before) {
        events.push({ type: 'wantedUp', stars: world.wanted });
        unseenTimer = 0;
      }
    }

    function spawnCopCarNear(world, events) {
      var p = CH.playerPos(world);
      var spot = { x: 0, z: 0 };
      for (var tries = 0; tries < 12; tries++) {
        city.randomRoadPoint(spot);
        var d = CH.dist(spot.x, spot.z, p.x, p.z);
        if (d > 35 && d < 90) break;
      }
      var heading = Math.atan2(p.x - spot.x, p.z - spot.z);
      var car = CH.makeCar(scene, 'police', spot.x, spot.z, heading, 0x1c1c22);
      car.driver = 'police';
      copCars.push(car);
      world.cars.push(car);
      return car;
    }

    function spawnFootCop(world) {
      var p = CH.playerPos(world);
      var group = pedsApi.buildPedMesh(null, { shirt: 0x1f2a5a, pants: 0x1a1a22, skin: 0xe8b088 });
      var hat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.44), new THREE.MeshStandardMaterial({ color: 0x1f2a5a, roughness: 0.8 }));
      hat.position.y = 1.98;
      group.add(hat);
      var a = rng.range(0, Math.PI * 2);
      group.position.set(p.x + Math.sin(a) * 12, 0, p.z + Math.cos(a) * 12);
      scene.add(group);
      var cop = {
        group: group,
        heading: 0,
        health: 60,
        dead: false,
        walkPhase: 0,
        punchTimer: 0,
        closeTimer: 0,
      };
      cops.push(cop);
      return cop;
    }

    function hurtCop(cop, amount, events) {
      if (cop.dead) return;
      cop.health -= amount;
      if (cop.health <= 0) {
        cop.dead = true;
        cop.group.rotation.x = Math.PI / 2;
        cop.group.position.y = 0.3;
        events.push({ type: 'hit', x: cop.group.position.x, z: cop.group.position.z });
      }
    }

    function update(dt, world, events) {
      var player = world.player;
      var wanted = world.wanted;
      var wantCars = CONFIG.police.carsByStars[wanted] || 0;
      // Field the right number of pursuit cars.
      var live = copCars.filter(function (c) { return !c.dead; }).length;
      if (live < wantCars && world.time % 1 < dt * 2) spawnCopCarNear(world, events);
      if (wanted === 0) {
        // Heat off: pursuit cars peel away and despawn at range.
        copCars.forEach(function (car) {
          if (!car.dead) car.driver = 'leaving';
        });
      }
      var pos = CH.playerPos(world);
      var px = pos.x;
      var pz = pos.z;
      var seen = false;

      for (var i = copCars.length - 1; i >= 0; i--) {
        var car = copCars[i];
        if (car.dead) continue;
        var cx = car.group.position.x;
        var cz = car.group.position.z;
        var d = CH.dist(cx, cz, px, pz);
        if (d < 55) seen = true;
        if (car.driver === 'leaving') {
          CH.driveCar(car, dt, 1, 0, false, city, events);
          if (d > 120) {
            scene.remove(car.group);
            copCars.splice(i, 1);
            var wi = world.cars.indexOf(car);
            if (wi !== -1) world.cars.splice(wi, 1);
          }
          continue;
        }
        // Pursuit: steer at the player, ram on contact.
        var lead = 0.35;
        var txp = px + (player.car ? player.car.vx * lead : 0);
        var tzp = pz + (player.car ? player.car.vz * lead : 0);
        var wantHeading = Math.atan2(txp - cx, tzp - cz);
        var steer = CH.clamp(CH.angleDiff(wantHeading, car.heading) * 2.4, -1, 1);
        var throttle = d > 6 ? 1 : 0.4;
        CH.driveCar(car, dt, throttle, steer, false, city, events);
        var sp = Math.sqrt(car.vx * car.vx + car.vz * car.vz);
        if (sp > CONFIG.police.chaseSpeed) {
          car.vx *= CONFIG.police.chaseSpeed / sp;
          car.vz *= CONFIG.police.chaseSpeed / sp;
        }
        if (d < 4.5 && player.mode === 'car' && player.car && !player.car.dead) {
          player.car.damage += CONFIG.police.ramDamage * dt * 3;
          if (player.car.damage >= CONFIG.car.maxDamage) CH.killCar(player.car, events);
        }
        // On foot and cornered: a cop gets out to chase.
        if (d < 7 && player.mode === 'foot' && cops.filter(function (c) { return !c.dead; }).length < 2 && rng.chance(dt * 0.5)) {
          spawnFootCop(world);
        }
      }

      // Foot cops chase, punch, and bust a cornered player.
      for (var j = cops.length - 1; j >= 0; j--) {
        var cop = cops[j];
        if (cop.dead) continue;
        var ccx = cop.group.position.x;
        var ccz = cop.group.position.z;
        var cd = CH.dist(ccx, ccz, px, pz);
        if (cd < 26) seen = true;
        if (wanted === 0) {
          // No heat: the cop gives up and walks off.
          cop.group.position.x += Math.sin(cop.heading) * 2 * dt;
          cop.group.position.z += Math.cos(cop.heading) * 2 * dt;
          if (cd > 60) {
            scene.remove(cop.group);
            cops.splice(j, 1);
          }
          continue;
        }
        var wantH = Math.atan2(px - ccx, pz - ccz);
        cop.heading += CH.clamp(CH.angleDiff(wantH, cop.heading), -4 * dt, 4 * dt);
        var runSpeed = 7.5;
        cop.group.position.x += Math.sin(cop.heading) * runSpeed * dt;
        cop.group.position.z += Math.cos(cop.heading) * runSpeed * dt;
        city.resolveCircle(cop.group.position, 0.7);
        cop.group.rotation.y = cop.heading;
        cop.walkPhase += dt * 11;
        var swing = Math.sin(cop.walkPhase) * 0.6;
        var limbs = cop.group.userData.limbs;
        limbs.legL.rotation.x = swing;
        limbs.legR.rotation.x = -swing;
        limbs.armL.rotation.x = -swing * 0.7;
        limbs.armR.rotation.x = swing * 0.7;
        cop.punchTimer -= dt;
        if (cd < 2.2 && player.mode === 'foot' && !player.dead) {
          cop.closeTimer += dt;
          if (cop.punchTimer <= 0) {
            cop.punchTimer = 0.8;
            CH.damagePlayer(player, 9, world, events);
          }
          if (cop.closeTimer > CONFIG.police.bustSeconds) {
            events.push({ type: 'busted' });
            cop.closeTimer = 0;
          }
        } else {
          cop.closeTimer = Math.max(0, cop.closeTimer - dt * 2);
        }
      }

      // Heat decay: unseen for long enough, lose a star.
      if (wanted > 0) {
        if (seen) {
          unseenTimer = 0;
        } else {
          unseenTimer += dt;
          if (unseenTimer > CONFIG.police.loseSeconds) {
            unseenTimer = 0;
            world.wanted -= 1;
            events.push({ type: 'wantedDown', stars: world.wanted });
          }
        }
      }
    }

    var api = {
      copCars: copCars,
      cops: cops,
      addWanted: addWanted,
      hurtCop: hurtCop,
      update: update,
      spawnCopCarNear: spawnCopCarNear,
    };
    // addWanted needs the world; main.js sets it after creating the world.
    api.attachWorld = function (world) { api.world = world; };
    return api;
  }

  CH.createPolice = createPolice;
})();
