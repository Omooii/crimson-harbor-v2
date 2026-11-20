// Boot and the one loop: the world advances in fixed 1/60 s steps, the
// renderer paints what is there, and events flow from the systems into
// sound, particles, the camera and the HUD. Screens: title (with the
// living city behind it), play, paused, busted and wasted.
//
// ?seed=N fixes the city. ?shot=drive|foot|chase|mission stages that scene
// and sets window.__shotReady when it is ready to capture.
(function () {
  var CH = window.CH;
  var STEP = 1 / 60;
  var MAX_FRAME = 0.25;

  var params = new URLSearchParams(window.location.search);
  var shotName = params.get('shot');
  var seedParam = Number.parseInt(params.get('seed') || '', 10);
  var seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);
  var save = CH.loadSave();
  if (save && save.seed !== undefined && !params.has('seed')) seed = save.seed;

  var rng = CH.createRandom(seed);
  var renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  document.getElementById('app').appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 900);

  var city = CH.createCity(scene, rng);
  var particles = CH.createParticles(scene);
  var traffic = CH.createTraffic(scene, city, rng);
  var pedestrians = CH.createPedestrians(scene, city, rng);
  var police = CH.createPolice(scene, city, rng, pedestrians);
  var missions = CH.createMissions(scene, city);
  var player = CH.createPlayer(scene, pedestrians, 36, 120);
  var input = CH.createInput();
  var audio = CH.createAudio();
  var hud = CH.createHud();
  var minimap = CH.createMinimap();
  var cameraRig = CH.createCamera(camera);

  var world = {
    scene: scene,
    city: city,
    rng: rng,
    seed: seed,
    time: 0,
    mode: shotName ? 'play' : 'title',
    player: player,
    cars: traffic.cars,
    pedestrians: pedestrians,
    traffic: traffic,
    police: police,
    missions: missions,
    particles: particles,
    input: input,
    audio: audio,
    cameraRig: cameraRig,
    events: [],
    wanted: 0,
    cash: CH.CONFIG.cash.start,
    missionsDone: 0,
    camYaw: 0,
    shot: null,
    autosaveTimer: 0,
  };
  police.attachWorld(world);
  missions.attachWorld(world);
  window.__world = world;

  // Tracers: short-lived lines from muzzle to impact.
  var tracers = [];
  function spawnTracer(x, z, dx, dz, len) {
    var geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x, 1.4, z),
      new THREE.Vector3(x + dx * len, 1.4, z + dz * len),
    ]);
    var line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9 }));
    scene.add(line);
    tracers.push({ line: line, life: 0.09 });
  }

  var damageFlash = document.getElementById('damageFlash');
  function flashDamage() {
    damageFlash.classList.remove('show');
    void damageFlash.offsetWidth;
    damageFlash.classList.add('show');
    setTimeout(function () { damageFlash.classList.remove('show'); }, 220);
  }

  function drainEvents() {
    var events = world.events;
    for (var i = 0; i < events.length; i++) {
      var e = events[i];
      if (e.type === 'shot') {
        audio.shot();
        particles.burst(e.x, 1.4, e.z, 4, { color: 0xffe08a, speed: 3, life: 0.2 });
      } else if (e.type === 'punch') {
        audio.punch();
      } else if (e.type === 'crash') {
        audio.crash(e.hard);
        particles.burst(e.x, 1, e.z, e.hard ? 14 : 6, { color: 0xffcc66, speed: 6, life: 0.5 });
        cameraRig.addShake(e.hard ? 0.5 : 0.2);
      } else if (e.type === 'explosion') {
        audio.explosion();
        particles.burst(e.x, 1.5, e.z, 60, { color: 0xff7722, speed: 12, life: 1.1 });
        particles.burst(e.x, 2.5, e.z, 30, { color: 0x333333, speed: 5, life: 1.6, up: 5 });
        cameraRig.addShake(1.1);
      } else if (e.type === 'smoke') {
        particles.spawn(e.x, 1.2, e.z, { vx: 0, vy: 2, vz: 0, life: 1.1, color: 0x555555, grav: 1 });
      } else if (e.type === 'hit') {
        particles.burst(e.x, 1, e.z, 8, { color: 0xffcc66, speed: 5, life: 0.4 });
      } else if (e.type === 'hurt') {
        flashDamage();
      } else if (e.type === 'wantedUp') {
        audio.wantedUp();
      } else if (e.type === 'missionStart') {
        hud.showBanner(e.title.toUpperCase(), e.brief, 4.5);
        audio.pickup();
      } else if (e.type === 'missionComplete') {
        hud.showBanner('MISSION COMPLETE', e.title + '  +$' + e.reward, 4);
        audio.missionDone();
      } else if (e.type === 'missionFail') {
        hud.showBanner('MISSION FAILED', e.reason, 4);
        audio.missionFail();
      } else if (e.type === 'storyComplete') {
        hud.showBanner('STORY COMPLETE', 'Crimson Harbor is yours now. Free roam!', 6);
      } else if (e.type === 'pickup') {
        hud.showBanner('PACKAGE SECURED', "Now deliver it to Mara's Office.", 3);
        audio.pickup();
      } else if (e.type === 'enterCar') {
        audio.enterCar();
      } else if (e.type === 'tracer') {
        spawnTracer(e.x, e.z, e.dx, e.dz, e.len);
      } else if (e.type === 'busted' || e.type === 'wasted') {
        endRun(e.type);
      } else if (e.type === 'save') {
        writeSave();
      }
    }
    events.length = 0;
  }

  function writeSave() {
    var pp = CH.playerPos(world);
    CH.storeSave({
      seed: seed,
      cash: world.cash,
      missionsDone: world.missionsDone,
      storyDone: missions.state.storyDone,
      px: pp.x,
      pz: pp.z,
      heading: player.heading,
      health: player.health,
      muted: audio.isMuted(),
    });
  }

  function applySave(data) {
    world.cash = data.cash;
    world.missionsDone = data.missionsDone;
    missions.state.storyDone = !!data.storyDone;
    player.group.position.set(data.px || 36, 0, data.pz || 120);
    player.heading = data.heading || 0;
    player.group.rotation.y = player.heading;
    player.health = data.health || 100;
    if (data.muted) audio.setMuted(true);
  }

  var overlays = {
    title: document.getElementById('titleScreen'),
    pause: document.getElementById('pauseScreen'),
    end: document.getElementById('endScreen'),
    endTitle: document.getElementById('endTitle'),
    endSub: document.getElementById('endSub'),
    hudRoot: document.getElementById('hud'),
  };

  function showOnly(name) {
    overlays.title.style.display = name === 'title' ? 'flex' : 'none';
    overlays.pause.style.display = name === 'pause' ? 'flex' : 'none';
    overlays.end.style.display = name === 'end' ? 'flex' : 'none';
    overlays.hudRoot.style.display = name === 'play' || name === 'pause' ? 'block' : 'none';
  }

  function startGame(fromSave) {
    audio.unlock();
    if (fromSave && save) applySave(save);
    world.mode = 'play';
    showOnly('play');
    cameraRig.snapTo(world);
    if (!fromSave && world.missionsDone === 0 && !missions.state.active) {
      missions.startMission(world, world.events, 1);
    }
  }

  function endRun(kind) {
    if (world.mode !== 'play') return;
    var fine = kind === 'busted' ? CH.CONFIG.cash.bustFine : CH.CONFIG.cash.wastedFine;
    world.cash = Math.max(0, world.cash - fine);
    world.wanted = 0;
    overlays.endTitle.textContent = kind === 'busted' ? 'BUSTED' : 'WASTED';
    overlays.endSub.textContent = kind === 'busted'
      ? 'The Harbor Precinct holds you overnight. Fine: $' + fine + '.'
      : 'You wake up at St. Coral Hospital. Bill: $' + fine + '.';
    world.mode = kind;
    showOnly('end');
    writeSave();
  }

  function respawn() {
    var spot = world.mode === 'busted' ? CH.LANDMARKS.precinct : CH.LANDMARKS.hospital;
    if (player.car) {
      player.car.driver = null;
      player.car = null;
    }
    player.mode = 'foot';
    player.dead = false;
    player.health = CH.CONFIG.player.maxHealth;
    player.group.visible = true;
    player.group.position.set(spot.x, 0, spot.z);
    player.heading = 0;
    player.group.rotation.y = 0;
    world.mode = 'play';
    showOnly('play');
    cameraRig.snapTo(world);
  }

  document.getElementById('startBtn').addEventListener('click', function () { startGame(false); });
  var continueBtn = document.getElementById('continueBtn');
  if (save && save.missionsDone !== undefined) {
    continueBtn.style.display = 'inline-block';
    continueBtn.addEventListener('click', function () { startGame(true); });
  }
  document.getElementById('respawnBtn').addEventListener('click', respawn);
  document.getElementById('resumeBtn').addEventListener('click', function () {
    world.mode = 'play';
    showOnly('play');
  });
  document.getElementById('muteBtn').addEventListener('click', function () {
    audio.unlock();
    audio.setMuted(!audio.isMuted());
    document.getElementById('muteBtn').textContent = audio.isMuted() ? 'Sound: Off' : 'Sound: On';
  });
  document.getElementById('pauseMuteBtn').addEventListener('click', function () {
    audio.setMuted(!audio.isMuted());
    document.getElementById('pauseMuteBtn').textContent = audio.isMuted() ? 'Sound: Off' : 'Sound: On';
  });

  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  function collideCars(dt) {
    var cars = world.cars;
    for (var i = 0; i < cars.length; i++) {
      var a = cars[i];
      if (a.dead) continue;
      for (var j = i + 1; j < cars.length; j++) {
        var b = cars[j];
        if (b.dead) continue;
        var ax = a.group.position.x;
        var az = a.group.position.z;
        var bx = b.group.position.x;
        var bz = b.group.position.z;
        var dx = bx - ax;
        var dz = bz - az;
        var d2 = dx * dx + dz * dz;
        var min = 3.0;
        if (d2 < min * min && d2 > 0.0001) {
          var d = Math.sqrt(d2);
          var push = (min - d) / 2;
          var nx = dx / d;
          var nz = dz / d;
          a.group.position.x -= nx * push;
          a.group.position.z -= nz * push;
          b.group.position.x += nx * push;
          b.group.position.z += nz * push;
          var rel = Math.abs((a.vx - b.vx) * nx + (a.vz - b.vz) * nz);
          var swap = (a.vx * nx + a.vz * nz - (b.vx * nx + b.vz * nz)) * 0.5;
          a.vx -= nx * swap;
          a.vz -= nz * swap;
          b.vx += nx * swap;
          b.vz += nz * swap;
          if (rel > 5) {
            a.damage += rel * 0.4;
            b.damage += rel * 0.4;
            world.events.push({ type: 'crash', x: (ax + bx) / 2, z: (az + bz) / 2, hard: rel > 14 });
            if (a.damage >= CH.CONFIG.car.maxDamage) CH.killCar(a, world.events);
            if (b.damage >= CH.CONFIG.car.maxDamage) CH.killCar(b, world.events);
          }
        }
      }
    }
  }

  function collideCarsWithPeds() {
    var cars = world.cars;
    pedestrians.peds.forEach(function (ped) {
      if (ped.dead || ped.state === 'down') return;
      var px = ped.group.position.x;
      var pz = ped.group.position.z;
      for (var i = 0; i < cars.length; i++) {
        var car = cars[i];
        if (car.dead) continue;
        var speed = Math.sqrt(car.vx * car.vx + car.vz * car.vz);
        if (speed < 3) continue;
        var d = CH.dist(px, pz, car.group.position.x, car.group.position.z);
        if (d < 2.4) {
          // Only the player's car kills: traffic bumps a ped down (20 damage)
          // so the city does not empty itself out on its own.
          var dmg = car.driver === 'player' ? 40 + speed * 2 : 20;
          pedestrians.hurtPed(ped, dmg, car.group.position.x, car.group.position.z, world.events);
          if (car.driver === 'player') {
            police.addWanted(ped.dead ? CH.CONFIG.wanted.killPed : CH.CONFIG.wanted.hitPed, world.events);
          }
          car.vx *= 0.85;
          car.vz *= 0.85;
          break;
        }
      }
    });
  }

  function step(dt) {
    world.time += dt;
    if (world.mode === 'title') {
      // The living city behind the title: traffic and pedestrians move.
      traffic.update(dt, world, world.events);
      pedestrians.update(dt, world, world.events);
      particles.update(dt);
      var orbit = world.time * 0.05;
      camera.position.set(Math.sin(orbit) * 130, 62, Math.cos(orbit) * 130);
      camera.lookAt(0, 4, 0);
      world.events.length = 0;
      return;
    }
    if (world.mode === 'pause') {
      if (input.consume('p') || input.consume('Escape')) {
        world.mode = 'play';
        showOnly('play');
      }
      input.endFrame();
      return;
    }
    if (world.mode !== 'play') return;

    // Pause and mute.
    if (input.consume('p') || input.consume('Escape')) {
      world.mode = 'pause';
      showOnly('pause');
      return;
    }
    if (input.consume('m')) audio.setMuted(!audio.isMuted());

    // Enter / exit cars.
    if (input.consume('e') && !player.dead) {
      if (player.mode === 'foot') {
        var near = CH.nearestCar(player, world.cars, 4.5);
        if (near) CH.enterCar(player, near, world, world.events);
      } else {
        CH.exitCar(player, world, world.events);
      }
    }

    if (player.mode === 'car' && player.car) {
      if (player.car.dead) {
        CH.exitCar(player, world, world.events);
        player.health = Math.max(1, player.health - 20);
      } else if (!world.shot || !world.shot.auto) {
        CH.driveCar(player.car, dt, input.drive(), input.steer(), input.handbrake(), city, world.events);
      }
    } else {
      CH.updateOnFoot(player, dt, input, world, world.events);
    }

    traffic.update(dt, world, world.events);
    pedestrians.update(dt, world, world.events);
    police.update(dt, world, world.events);
    missions.update(dt, world, world.events);
    collideCars(dt);
    collideCarsWithPeds();
    particles.update(dt);
    CH.updateAutoDrive(dt, world);
    CH.updateShotTimer(dt, world);

    // Tracers fade fast.
    for (var t = tracers.length - 1; t >= 0; t--) {
      tracers[t].life -= dt;
      tracers[t].line.material.opacity = Math.max(0, tracers[t].life / 0.09);
      if (tracers[t].life <= 0) {
        scene.remove(tracers[t].line);
        tracers[t].line.geometry.dispose();
        tracers[t].line.material.dispose();
        tracers.splice(t, 1);
      }
    }

    // Sound follows the game.
    var driveSpeed = player.mode === 'car' && player.car ? Math.abs(player.car.speed) : 0;
    var sirenNear = police.copCars.some(function (c) {
      var pp = CH.playerPos(world);
      return !c.dead && CH.dist(c.group.position.x, c.group.position.z, pp.x, pp.z) < 70;
    });
    audio.update(dt, driveSpeed, sirenNear && world.wanted > 0);

    var pp = CH.playerPos(world);
    city.followShadows(pp.x, pp.z);
    cameraRig.update(dt, world, input);
    hud.update(dt, world);
    minimap.draw(world);
    drainEvents();

    world.autosaveTimer += dt;
    if (world.autosaveTimer > CH.CONFIG.autosaveSeconds) {
      world.autosaveTimer = 0;
      writeSave();
    }
    input.endFrame();
  }

  var last = performance.now();
  var acc = 0;
  var firstFrame = true;
  function loop(now) {
    requestAnimationFrame(loop);
    var frame = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    acc += frame;
    var steps = 0;
    // MAX_FRAME / STEP = 15: on a slow machine the game still catches up
    // a full clamped frame instead of falling permanently behind.
    while (acc >= STEP && steps < 15) {
      step(STEP);
      acc -= STEP;
      steps++;
    }
    if (steps === 15) acc = 0;
    renderer.render(scene, camera);
    if (firstFrame) {
      firstFrame = false;
      window.__gameReady = true;
    }
  }

  if (shotName) {
    showOnly('play');
    world.mode = 'play';
    CH.stageShot(shotName, world);
    drainEvents();
  } else {
    showOnly('title');
  }
  cameraRig.snapTo(world);
  requestAnimationFrame(loop);
})();
