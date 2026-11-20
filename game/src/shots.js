// Screenshot staging: ?shot=drive|foot|chase|mission (with &seed=N) puts
// the game straight into a composed scene — no start screen, the camera
// settled, the action already running — and sets window.__shotReady when
// the frame is ready to capture. Drive and chase auto-drive so the shot
// catches the city in motion.
(function () {
  var CH = window.CH;

  var SHOT_TIME = { drive: 2.4, foot: 0.9, chase: 2.6, mission: 1.0 };

  function stageShot(name, world) {
    var player = world.player;
    var L = CH.LANDMARKS;
    world.shot = { name: name, timer: 0, ready: false };
    world.cash = 500;
    world.wanted = 0;

    if (name === 'drive') {
      // Westbound on the avenue at sunset, mission 1 live, doing 60.
      var car = CH.makeCar(world.scene, 'sports', 60, -30, -Math.PI / 2, 0x40b8c9);
      world.cars.push(car);
      player.group.position.set(60, 0, -30);
      CH.enterCar(player, car, world, world.events);
      car.vx = -24;
      world.wanted = 0;
      world.missions.startMission(world, world.events, 1);
      world.shot.auto = { lane: -30, axis: 'z', dir: -1 };
      // Life in frame: two cruisers ahead on the same avenue, two
      // pedestrians on the sidewalk the camera will pass.
      var placed = 0;
      world.cars.forEach(function (c) {
        if (c.driver !== 'traffic' || placed >= 2) return;
        var spot = placed === 0 ? { x: -8, z: -26.8 } : { x: -48, z: -33.2 };
        c.group.position.set(spot.x, 0, spot.z);
        c.heading = -Math.PI / 2;
        c.group.rotation.y = c.heading;
        c.axis = 'x';
        c.dir = -1;
        c.road = -30;
        c.lane = spot.z - (-30);
        c.vx = -c.cruise;
        c.vz = 0;
        placed++;
      });
      var pedSpots = [{ x: -18, z: -21 }, { x: 8, z: -39 }];
      pedSpots.forEach(function (s, i) {
        var ped = world.pedestrians.peds[i + 3];
        if (!ped) return;
        ped.group.position.set(s.x, 0, s.z);
        ped.target = { x: s.x - 40, z: s.z };
      });
    } else if (name === 'foot') {
      // On foot outside the Harbor Garage, the gold marker ahead.
      player.group.position.set(-63, 0, 100);
      player.heading = 0;
      player.group.rotation.y = 0;
      world.missions.startMission(world, world.events, 1);
      // A few pedestrians nearby for life.
      for (var i = 0; i < 3; i++) {
        var ped = world.pedestrians.peds[i];
        if (ped) {
          ped.group.position.set(-63 + (i - 1) * 6, 0, 100 + i * 4);
          ped.target = { x: -63 + (i - 1) * 6, z: 130 };
        }
      }
    } else if (name === 'chase') {
      // Three stars, three pursuit cars closing in from behind.
      var chaseCar = CH.makeCar(world.scene, 'sports', -30, 40, Math.PI, 0xc9403a);
      world.cars.push(chaseCar);
      player.group.position.set(-30, 0, 40);
      CH.enterCar(player, chaseCar, world, world.events);
      chaseCar.vz = -28;
      world.wanted = 3;
      world.cash = 1250;
      world.missions.startMission(world, world.events, 1);
      // Pursuit cars behind the player; the chase camera looks back at them.
      var offsets = [[-34, 58, Math.PI], [-26, 66, Math.PI], [-38, 48, Math.PI]];
      offsets.forEach(function (o) {
        var cop = CH.makeCar(world.scene, 'police', o[0], o[1], o[2], 0x1c1c22);
        cop.driver = 'police';
        cop.vz = -26;
        world.cars.push(cop);
        world.police.copCars.push(cop);
      });
      world.shot.auto = { lane: -30, axis: 'x', dir: -1 };
    } else if (name === 'mission') {
      // Mission 2: the red Comet in the Marina Lot, beacon on it.
      world.cash = 1250;
      world.missionsDone = 1;
      world.missions.startMission(world, world.events, 2);
      var comet = world.missions.state.targetCar;
      player.group.position.set(168, 0, 60);
      player.heading = Math.PI / 2;
      player.group.rotation.y = Math.PI / 2;
      if (comet) {
        comet.group.position.set(176, 0, 60);
        comet.group.rotation.y = Math.PI / 2;
      }
    }
    world.cameraRig.snapTo(world);
    world.mode = 'play';
  }

  // Auto-drive for the moving shots: hold the lane, dodge the car ahead.
  function updateAutoDrive(dt, world) {
    var shot = world.shot;
    if (!shot || !shot.auto || world.player.mode !== 'car') return;
    var car = world.player.car;
    if (!car || car.dead) return;
    // The staged car never dies mid-shot (it may smoke, which looks great).
    car.damage = Math.min(car.damage, 60);
    var laneCoord = shot.auto.axis === 'x' ? car.group.position.x : car.group.position.z;
    var err = shot.auto.lane - laneCoord;
    var steer = CH.clamp(err * 0.25, -0.6, 0.6);
    // Nudge around slow traffic ahead.
    var fx = Math.sin(car.heading);
    var fz = Math.cos(car.heading);
    world.cars.forEach(function (other) {
      if (other === car || other.dead) return;
      var dx = other.group.position.x - car.group.position.x;
      var dz = other.group.position.z - car.group.position.z;
      var ahead = dx * fx + dz * fz;
      var side = dx * fz - dz * fx;
      if (ahead > 0 && ahead < 18 && Math.abs(side) < 4.5) steer += side > 0 ? -0.5 : 0.5;
    });
    CH.driveCar(car, dt, 1, CH.clamp(steer, -1, 1), false, world.city, world.events);
  }

  function updateShotTimer(dt, world) {
    var shot = world.shot;
    if (!shot || shot.ready) return;
    shot.timer += dt;
    var wait = SHOT_TIME[shot.name] || 1;
    if (shot.timer >= wait) {
      shot.ready = true;
      window.__shotReady = true;
    }
  }

  CH.stageShot = stageShot;
  CH.updateAutoDrive = updateAutoDrive;
  CH.updateShotTimer = updateShotTimer;
})();
