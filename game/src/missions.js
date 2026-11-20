// The story: four missions for Mara and the Harbor Garage, with a gold
// start marker between jobs, a glowing beacon on the current objective,
// a timer on the delivery run, and a scripted heat spike for the finale.
(function () {
  var CH = window.CH;
  var MISSIONS = CH.MISSIONS;
  var LANDMARKS = CH.LANDMARKS;

  function createMissions(scene, city) {
    // The beacon: a light pillar, a spinning diamond and a ground ring.
    var beacon = new THREE.Group();
    var pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 2.2, 30, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd24d, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false })
    );
    pillar.position.y = 15;
    var diamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.6),
      new THREE.MeshBasicMaterial({ color: 0xffd24d })
    );
    diamond.position.y = 7;
    var ring = new THREE.Mesh(
      new THREE.RingGeometry(3.4, 4.4, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd24d, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.15;
    beacon.add(pillar);
    beacon.add(diamond);
    beacon.add(ring);
    beacon.visible = false;
    scene.add(beacon);

    var state = {
      active: null, // { def, step }
      timer: 0,
      targetCar: null,
      storyDone: false,
      heatPrimed: false,
    };

    function setBeacon(x, z, colorHex) {
      beacon.visible = true;
      beacon.position.set(x, 0, z);
      pillar.material.color.set(colorHex);
      diamond.material.color.set(colorHex);
      ring.material.color.set(colorHex);
    }

    function hideBeacon() { beacon.visible = false; }

    function objective(world) {
      if (state.storyDone) return { text: 'Free roam — Crimson Harbor is yours', target: null, kind: null };
      if (!state.active) {
        var next = MISSIONS[world.missionsDone];
        var start = LANDMARKS.garage;
        return { text: 'Drive to the gold marker to start: ' + next.title, target: { x: start.x, z: start.z }, kind: 'start' };
      }
      var step = state.active.def.steps[state.active.step];
      var target = step.target ? LANDMARKS[step.target] : null;
      var text = step.text;
      if (step.kind === 'timed') text += ' — ' + Math.max(0, Math.ceil(state.timer)) + 's';
      return { text: text, target: target ? { x: target.x, z: target.z } : null, kind: step.kind };
    }

    function startMission(world, events, id) {
      var def = MISSIONS[id - 1];
      state.active = { def: def, step: 0 };
      state.heatPrimed = false;
      events.push({ type: 'missionStart', title: def.title, brief: def.brief });
      if (def.id === 2) spawnTargetCar(world);
      if (def.id === 4) state.heatPrimed = false;
    }

    function spawnTargetCar(world) {
      if (state.targetCar && !state.targetCar.dead) return;
      var m = LANDMARKS.marina;
      var car = CH.makeCar(world.scene, 'sports', m.x, m.z, Math.PI / 2, 0xc22a22);
      car.driver = null;
      state.targetCar = car;
      world.cars.push(car);
    }

    function completeMission(world, events) {
      var def = state.active.def;
      world.cash += def.reward;
      world.missionsDone += 1;
      state.active = null;
      state.targetCar = null;
      events.push({ type: 'missionComplete', title: def.title, reward: def.reward });
      if (world.missionsDone >= MISSIONS.length) {
        state.storyDone = true;
        events.push({ type: 'storyComplete' });
      }
      events.push({ type: 'save' });
    }

    function failMission(world, events, reason) {
      state.active = null;
      state.targetCar = null;
      events.push({ type: 'missionFail', reason: reason });
    }

    function onEnterCar(car, events) {
      if (!state.active) return;
      var step = state.active.def.steps[state.active.step];
      if (step.kind === 'steal' && car === state.targetCar) {
        advanceStep(this.world, events);
      }
    }

    function advanceStep(world, events) {
      state.active.step += 1;
      if (state.active.step >= state.active.def.steps.length) {
        completeMission(world, events);
      } else {
        var next = state.active.def.steps[state.active.step];
        if (next.kind === 'timed') state.timer = next.seconds;
        if (next.kind === 'heat' && !state.heatPrimed) {
          state.heatPrimed = true;
          world.wanted = 3;
          events.push({ type: 'wantedUp', stars: 3 });
        }
      }
    }

    function update(dt, world, events) {
      // Spin the beacon diamond; bob it gently.
      if (beacon.visible) {
        diamond.rotation.y += dt * 2;
        diamond.position.y = 7 + Math.sin(world.time * 1.5) * 0.5;
      }
      var player = world.player;
      var pos = CH.playerPos(world);
      var px = pos.x;
      var pz = pos.z;

      if (!state.active) {
        if (state.storyDone || world.missionsDone >= MISSIONS.length) {
          hideBeacon();
          return;
        }
        // Between jobs: the gold marker at the garage starts the next one.
        var start = LANDMARKS.garage;
        setBeacon(start.x, start.z, 0xffd24d);
        if (CH.dist(px, pz, start.x, start.z) < 10) {
          startMission(world, events, world.missionsDone + 1);
        }
        return;
      }

      var step = state.active.def.steps[state.active.step];
      var target = step.target ? LANDMARKS[step.target] : null;
      if (target) setBeacon(target.x, target.z, step.kind === 'heat' ? 0xff4444 : 0x35d0ff);
      else hideBeacon();

      if (step.kind === 'timed') {
        state.timer -= dt;
        if (state.timer <= 0) {
          failMission(world, events, 'Out of time — the client walked.');
          return;
        }
      }
      if (step.kind === 'heat') {
        if (world.wanted === 0 && state.heatPrimed) advanceStep(world, events);
        return;
      }
      if (step.kind === 'steal') {
        // Completes through onEnterCar; keep the beacon on the car.
        if (state.targetCar) setBeacon(state.targetCar.group.position.x, state.targetCar.group.position.z, 0xff4444);
        if (state.targetCar && state.targetCar.dead) spawnTargetCar(world);
        return;
      }
      if (step.kind === 'deliverCar') {
        if (player.car === state.targetCar && target && CH.dist(px, pz, target.x, target.z) < 12) {
          advanceStep(world, events);
        }
        return;
      }
      // Plain goto.
      if (target && CH.dist(px, pz, target.x, target.z) < 10) {
        if (step.kind === 'goto' && state.active.def.id === 3 && state.active.step === 0) {
          events.push({ type: 'pickup' });
        }
        advanceStep(world, events);
      }
    }

    var api = {
      state: state,
      objective: objective,
      startMission: startMission,
      onEnterCar: onEnterCar,
      update: update,
    };
    api.attachWorld = function (world) { api.world = world; };
    return api;
  }

  CH.createMissions = createMissions;
})();
