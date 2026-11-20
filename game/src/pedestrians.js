// Pedestrians: low-poly walkers on the sidewalks with a procedural walk
// cycle. They stroll between sidewalk waypoints, flee from gunfire and
// wanted players, and go down when hit — which is how the player earns
// wanted stars the messy way.
(function () {
  var CH = window.CH;
  var CONFIG = CH.CONFIG;

  var SHIRTS = [0xd84f4f, 0x4f7ad8, 0x53a05a, 0xe8d84f, 0xd87ab0, 0x7ad8d0, 0xe8e8e8, 0x8a6ac9];
  var PANTS = [0x2f3542, 0x3a4a5a, 0x5a4a3a, 0x222222, 0x4a5a2f];
  var SKINS = [0xf2c89b, 0xc98a5a, 0x8a5a34, 0xe8b088, 0x6a4226];

  function buildPedMesh(rng, fixed) {
    var group = new THREE.Group();
    var shirt = fixed ? fixed.shirt : SHIRTS[rng.int(0, SHIRTS.length - 1)];
    var pants = fixed ? fixed.pants : PANTS[rng.int(0, PANTS.length - 1)];
    var skin = fixed ? fixed.skin : SKINS[rng.int(0, SKINS.length - 1)];
    var shirtMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.85 });
    var pantsMat = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.9 });
    var skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 });

    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirtMat);
    torso.position.y = 1.08;
    torso.castShadow = true;
    group.add(torso);
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.42, 0.38), skinMat);
    head.position.y = 1.68;
    group.add(head);
    var hair = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.14, 0.42), new THREE.MeshStandardMaterial({ color: 0x2a1c12, roughness: 1 }));
    hair.position.y = 1.92;
    group.add(hair);
    function limb(w, h, d, mat, x, y) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, 0);
      group.add(m);
      return m;
    }
    var legL = limb(0.24, 0.72, 0.26, pantsMat, -0.17, 0.36);
    var legR = limb(0.24, 0.72, 0.26, pantsMat, 0.17, 0.36);
    var armL = limb(0.18, 0.62, 0.2, shirtMat, -0.42, 1.1);
    var armR = limb(0.18, 0.62, 0.2, shirtMat, 0.42, 1.1);
    group.userData.limbs = { legL: legL, legR: legR, armL: armL, armR: armR, torso: torso };
    return group;
  }

  function createPedestrians(scene, city, rng) {
    var peds = [];
    var roads = CONFIG.roads;

    function sidewalkPoint() {
      var road = roads[rng.int(0, roads.length - 1)];
      var alongX = rng.chance(0.5);
      var side = rng.chance(0.5) ? 1 : -1;
      if (alongX) return { x: rng.range(-195, 195), z: road + side * 10.5 };
      return { x: road + side * 10.5, z: rng.range(-195, 195) };
    }

    function spawnPed() {
      var at = sidewalkPoint();
      var group = buildPedMesh(rng);
      group.position.set(at.x, 0, at.z);
      scene.add(group);
      var ped = {
        group: group,
        heading: rng.range(0, Math.PI * 2),
        speed: rng.range(1.6, 2.6),
        state: 'walk',
        target: sidewalkPoint(),
        walkPhase: rng.range(0, Math.PI * 2),
        downTimer: 0,
        health: 100,
        dead: false,
        fadeTimer: 0,
      };
      peds.push(ped);
      return ped;
    }

    for (var i = 0; i < CONFIG.peds.count; i++) spawnPed();

    function hurtPed(ped, amount, fromX, fromZ, events) {
      if (ped.dead) return;
      ped.health -= amount;
      events.push({ type: 'hit', x: ped.group.position.x, z: ped.group.position.z });
      if (ped.health <= 0) {
        ped.dead = true;
        ped.state = 'dead';
        ped.fadeTimer = 9;
        ped.group.rotation.x = Math.PI / 2;
        ped.group.position.y = 0.3;
      } else {
        ped.state = 'down';
        ped.downTimer = 1.6;
        ped.group.rotation.x = Math.PI / 2;
        ped.group.position.y = 0.3;
      }
    }

    function update(dt, world, events) {
      var player = world.player;
      for (var i = peds.length - 1; i >= 0; i--) {
        var ped = peds[i];
        if (ped.dead) {
          ped.fadeTimer -= dt;
          if (ped.fadeTimer <= 0) {
            scene.remove(ped.group);
            peds.splice(i, 1);
            spawnPed();
          }
          continue;
        }
        if (ped.state === 'down') {
          ped.downTimer -= dt;
          if (ped.downTimer <= 0) {
            ped.state = 'flee';
            ped.group.rotation.x = 0;
            ped.group.position.y = 0;
            ped.fleeTimer = 5;
          }
          continue;
        }
        var px = ped.group.position.x;
        var pz = ped.group.position.z;
        // Flee when the player is wanted and close, or after being hit.
        var pp = CH.playerPos(world);
        var threatNear = world.wanted > 0 && CH.dist(px, pz, pp.x, pp.z) < 22;
        if (threatNear && ped.state !== 'flee') {
          ped.state = 'flee';
          ped.fleeTimer = 4;
        }
        var speed = ped.speed;
        var target = ped.target;
        if (ped.state === 'flee') {
          ped.fleeTimer -= dt;
          var away = Math.atan2(px - pp.x, pz - pp.z);
          target = { x: px + Math.sin(away) * 30, z: pz + Math.cos(away) * 30 };
          speed = 7;
          if (ped.fleeTimer <= 0) {
            ped.state = 'walk';
            ped.target = sidewalkPoint();
          }
        }
        var wantHeading = Math.atan2(target.x - px, target.z - pz);
        var dh = CH.angleDiff(wantHeading, ped.heading);
        ped.heading += CH.clamp(dh, -3.2 * dt, 3.2 * dt);
        ped.group.position.x += Math.sin(ped.heading) * speed * dt;
        ped.group.position.z += Math.cos(ped.heading) * speed * dt;
        city.resolveCircle(ped.group.position, 0.6);
        ped.group.rotation.y = ped.heading;
        ped.walkPhase += dt * speed * 1.6;
        var swing = Math.sin(ped.walkPhase) * 0.55;
        var limbs = ped.group.userData.limbs;
        limbs.legL.rotation.x = swing;
        limbs.legR.rotation.x = -swing;
        limbs.armL.rotation.x = -swing * 0.7;
        limbs.armR.rotation.x = swing * 0.7;
        ped.group.position.y = Math.abs(Math.sin(ped.walkPhase)) * 0.05;
        if (ped.state === 'walk' && CH.dist(px, pz, target.x, target.z) < 2) {
          ped.target = sidewalkPoint();
        }
      }
    }

    return { peds: peds, update: update, hurtPed: hurtPed, buildPedMesh: buildPedMesh };
  }

  CH.createPedestrians = createPedestrians;
})();
