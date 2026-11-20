// main.js — Crimson Harbor's boot and game loop. Builds the world,
// wires every system together, runs the title / playing / paused /
// busted states, and keeps the save, the HUD and the minimap in step.
(function () {
  'use strict';

  var cfg = window.CH.config;
  var util = window.CH.util;

  var renderer = null;
  var scene = null;
  var camera = null;
  var rng = null;

  var gameState = 'title'; // title | playing | paused | busted
  var clock = 0;
  var playSeconds = 0;
  var cash = 0;
  var muted = false;
  var saveTimer = 0;
  var bustedFine = 0;
  var wantedAtBust = 0;

  // The driver: health and armour, experience and rank, the nitro
  // meter, ability cooldowns, the in-game clock and the record.
  var health = 100;
  var armour = 0;
  var xp = 0;
  var nitroMeter = 100;
  var repairCd = 0;
  var bribeCd = 0;
  var clockMinutes = 17 * 60 + 30; // the game opens at half past five
  var lastDamageAt = -10;
  var statsOpen = false;
  var stats = { earned: 0, busted: 0, wasted: 0, bribes: 0 };

  var taxiCar = null;
  var sportsCar = null;
  var stolenCars = [];
  var frameCount = 0;
  var titleAngle = 0;

  // --- boot --------------------------------------------------------------

  function boot() {
    var seed = window.CH.shots.getSeed();
    rng = util.makeRng(seed * 7919 + 13);
    window.CH.input.install();

    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(1);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('game').appendChild(renderer.domElement);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1600);
    window.CH.camera.init(camera);

    var cityInfo = window.CH.city.build(scene, seed);
    window.CH.particles.init(scene);
    window.CH.traffic.init(scene, rng);
    window.CH.pedestrians.init(scene, rng, 20);
    window.CH.hud.init();
    window.CH.minimap.init(document.getElementById('minimap'));
    window.CH.missions.init(scene, missionHooks());
    window.CH.police.init(scene, rng, {
      onBusted: onBusted
    });
    window.CH.player.init(scene, cfg.spawn.x, cfg.spawn.z, cfg.spawn.heading, playerHooks());
    window.CH.pedestrians.setOnPedHit(onPedHit);

    // Mara's taxi by the garage, and the Comet GT at the dealership.
    taxiCar = window.CH.traffic.spawnParkedAt(scene, 'taxi', cfg.taxiSpot.x, cfg.taxiSpot.z, cfg.taxiSpot.heading);
    sportsCar = window.CH.traffic.spawnParkedAt(
      scene, 'sports', cfg.sportsSpot.x, cfg.sportsSpot.z, cfg.sportsSpot.heading, 0xc0392b
    );

    window.CH.camera.snapTo(cfg.spawn.x, cfg.spawn.z, cfg.spawn.heading);
    bindMenus();
    window.addEventListener('resize', onResize);

    // Debug hook for the playtest: read-only game state.
    window.__CH = debugState;
    window.__CH_CITY = cityInfo;
    // Staging hook for screenshots: put the driver mid-career.
    window.CH.debug = {
      setCash: function (n) { cash = n; },
      setXp: function (n) { xp = n; },
      setClock: function (mins) { clockMinutes = mins; }
    };

    if (window.CH.shots.isStaging()) {
      // Screenshots skip the title screen entirely.
      window.CH.shots.stage({ player: playerState(), taxiCar: taxiCar, sportsCar: sportsCar, scene: scene });
      gameState = 'playing';
      hideAllOverlays();
      window.CH.audio.ensure();
    } else {
      showTitle();
    }
    requestAnimationFrame(loop);
  }

  function playerState() {
    return window.CH.player.getState();
  }

  // --- driver progress ---------------------------------------------------

  function rankFor(points) {
    var ranks = cfg.ranks;
    var idx = 0;
    for (var i = 0; i < ranks.length; i++) {
      if (points >= ranks[i].xp) idx = i;
    }
    var cur = ranks[idx];
    var next = ranks[idx + 1] || null;
    var frac = next ? (points - cur.xp) / (next.xp - cur.xp) : 1;
    return { name: cur.name, frac: frac, index: idx };
  }

  function addXp(n) {
    var before = rankFor(xp).index;
    xp += n;
    var after = rankFor(xp).index;
    if (after > before) {
      window.CH.hud.toast('New rank: ' + rankFor(xp).name + '!');
      window.CH.audio.cash();
    }
  }

  function fmtClock() {
    var h = Math.floor(clockMinutes / 60) % 24;
    var m = Math.floor(clockMinutes % 60);
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }

  function districtNow() {
    var p = playerState();
    return window.CH.districts.districtAt(p.x, p.z);
  }

  // --- hooks ---------------------------------------------------------------

  function playerHooks() {
    return {
      findCar: function (x, z) {
        return window.CH.traffic.nearestParked(x, z, 4.5);
      },
      onEnterCar: function (car) {
        window.CH.traffic.takeParked(car);
        window.CH.audio.click();
        if (car === taxiCar) {
          window.CH.hud.toast('Mara\u2019s taxi — treat her well.');
        } else if (stolenCars.indexOf(car) === -1) {
          stolenCars.push(car);
          window.CH.police.addWanted(1, 'theft');
          window.CH.hud.toast('Car stolen — the law noticed.');
        }
      },
      onExitCar: function (car) {
        window.CH.traffic.parkCar(car);
      },
      onCrime: function (n, reason) {
        window.CH.police.addWanted(n, reason);
      },
      onShoot: function (x, z, fx, fz) {
        window.CH.particles.muzzle(x, z, fx, fz);
      },
      onPunch: function (x, z) {
        window.CH.particles.sparks(x, z);
      }
    };
  }

  function missionHooks() {
    return {
      onBanner: function (title, sub, ms) {
        window.CH.hud.showBanner(title, sub, ms);
      },
      onObjective: function (text) {
        window.CH.hud.setObjective(text);
      },
      onStart: function (m) {
        if (m.lines && m.lines.start) {
          window.CH.hud.showDialogue(m.giver, m.lines.start, 7000);
        }
        if (m.id === 'score') {
          // The big score happens after dark.
          window.CH.city.setNight(true);
          clockMinutes = 21 * 60;
          window.CH.hud.toast('Night falls over the harbor.');
        }
      },
      onStep: function (m, stepIndex) {
        addXp(25);
        window.CH.districts.add(districtNow(), 5);
        var step = m.steps[stepIndex];
        if (step && step.line) {
          window.CH.hud.showDialogue(m.giver, step.line, 7000);
        }
      },
      onComplete: function (m) {
        cash += m.reward;
        stats.earned += m.reward;
        addXp(100);
        armour = Math.min(100, armour + 25);
        window.CH.districts.add(districtNow(), 10);
        window.CH.audio.cash();
        var p = playerState();
        window.CH.particles.cashBurst(p.x, p.z);
        window.CH.hud.showBanner('MISSION COMPLETE', m.name + ' — +$' + m.reward, 4200);
        window.CH.hud.toast('Earned $' + m.reward + ' — ' + m.name);
        if (m.lines && m.lines.done) {
          window.CH.hud.showDialogue(m.giver, m.lines.done, 8000);
        }
        autosave();
      },
      onFail: function (m) {
        window.CH.hud.showBanner('MISSION FAILED', m.name + ' — out of time.', 3600);
        window.CH.hud.toast('Too slow. The job is still open.');
      },
      onTimer: function (seconds) {
        window.CH.hud.setTimer(seconds);
      }
    };
  }

  function onPedHit() {
    window.CH.police.addWanted(1, 'pedestrian');
    window.CH.hud.toast('Pedestrian down! The police are coming.');
  }

  function onCrash(car) {
    window.CH.audio.crash();
    window.CH.particles.sparks(car.x, car.z);
    var p = playerState();
    if (p.inCar && p.car === car && clock - lastDamageAt > 1.5) {
      // The driver's own crash: bodywork and body both pay.
      lastDamageAt = clock;
      car.condition = Math.max(0, car.condition - 6);
      var dmg = 5;
      var absorbed = Math.min(armour, dmg);
      armour -= absorbed;
      health -= (dmg - absorbed);
      if (health <= 0) wasted();
    }
  }

  // Health gone: the driver wakes up at the garage, lighter by a tenth
  // of their cash, the heat forgotten.
  function wasted() {
    if (gameState !== 'playing') return;
    stats.wasted++;
    health = 100;
    cash = Math.max(0, Math.round(cash * 0.9));
    var p = playerState();
    if (p.inCar && p.car) {
      window.CH.player.exitCar();
      window.CH.traffic.parkCar(p.car);
    }
    window.CH.player.setPose(cfg.spawn.x, cfg.spawn.z, cfg.spawn.heading);
    window.CH.police.resetAfterBust();
    window.CH.camera.snapTo(cfg.spawn.x, cfg.spawn.z, cfg.spawn.heading);
    window.CH.hud.showBanner('WASTED', 'Mara drags you back to the garage. The city forgets — for a price.', 5000);
    window.CH.audio.fail();
    autosave();
  }

  function onBusted() {
    if (gameState !== 'playing') return;
    var p = playerState();
    wantedAtBust = window.CH.police.wanted();
    bustedFine = Math.min(cash, 150 + 100 * wantedAtBust);
    stats.busted++;
    window.CH.districts.add(districtNow(), -5);
    gameState = 'busted';
    var overlay = document.getElementById('busted-screen');
    document.getElementById('busted-fine').textContent =
      'Fine: $' + bustedFine + ' — the cops took your cash and your ride.';
    overlay.classList.add('show');
    window.CH.audio.fail();
  }

  function resolveBust() {
    cash = Math.max(0, cash - bustedFine);
    var p = playerState();
    if (p.inCar && p.car) {
      var car = p.car;
      window.CH.player.exitCar();
      window.CH.traffic.parkCar(car);
    }
    window.CH.player.setPose(cfg.spawn.x, cfg.spawn.z, cfg.spawn.heading);
    window.CH.police.resetAfterBust();
    document.getElementById('busted-screen').classList.remove('show');
    window.CH.camera.snapTo(cfg.spawn.x, cfg.spawn.z, cfg.spawn.heading);
    window.CH.hud.toast('Back on the street. Mara is waiting.');
    autosave();
    gameState = 'playing';
  }

  // --- menus ---------------------------------------------------------------

  function $(id) {
    return document.getElementById(id);
  }

  function hideAllOverlays() {
    ['title-screen', 'pause-screen', 'busted-screen', 'stats-screen'].forEach(function (id) {
      var e = $(id);
      if (e) e.classList.remove('show');
    });
  }

  function showTitle() {
    hideAllOverlays();
    $('title-screen').classList.add('show');
    var save = window.CH.save.load();
    $('btn-continue').style.display = save ? 'inline-block' : 'none';
    $('settings-panel').classList.remove('show');
    $('opt-sound').checked = !muted;
    if (save) {
      $('save-line').textContent =
        'Saved game: $' + save.cash + ' — ' + save.completed.length + ' of 4 jobs done.';
    } else {
      $('save-line').textContent = '';
    }
  }

  function bindMenus() {
    $('btn-new').addEventListener('click', function () {
      window.CH.save.clear();
      startGame(null);
    });
    $('btn-continue').addEventListener('click', function () {
      startGame(window.CH.save.load());
    });
    $('btn-settings').addEventListener('click', function () {
      $('settings-panel').classList.toggle('show');
    });
    $('btn-settings-back').addEventListener('click', function () {
      $('settings-panel').classList.remove('show');
    });
    $('opt-sound').addEventListener('change', function (ev) {
      muted = !ev.target.checked;
      window.CH.audio.setMuted(muted);
      window.CH.hud.setMuted(muted);
    });
    $('btn-reset-save').addEventListener('click', function () {
      window.CH.save.clear();
      $('btn-continue').style.display = 'none';
      $('save-line').textContent = 'Saved progress erased.';
    });
    $('btn-resume').addEventListener('click', function () {
      resumeGame();
    });
    $('btn-restart').addEventListener('click', function () {
      window.CH.save.clear();
      location.reload();
    });
    $('btn-busted').addEventListener('click', function () {
      resolveBust();
    });
    window.addEventListener('keydown', function (ev) {
      if (ev.code === 'Enter' && gameState === 'title') {
        var s = window.CH.save.load();
        if (s) startGame(s);
        else startGame(null);
      }
    });
  }

  function startGame(save) {
    window.CH.audio.ensure();
    window.CH.audio.click();
    // Fresh driver by default; a save restores the record.
    xp = 0;
    health = 100;
    armour = 0;
    nitroMeter = 100;
    repairCd = 0;
    bribeCd = 0;
    clockMinutes = 17 * 60 + 30;
    stats = { earned: 0, busted: 0, wasted: 0, bribes: 0 };
    window.CH.districts.reset();
    if (save) {
      cash = save.cash;
      playSeconds = save.playSeconds || 0;
      xp = save.xp || 0;
      health = save.health !== undefined ? save.health : 100;
      armour = save.armour || 0;
      clockMinutes = save.clockMinutes || 1050;
      stats = save.stats || stats;
      window.CH.districts.load(save.standing);
      var completed = save.completed || [];
      var idx = Math.min(save.missionIndex || 0, cfg.missions.length - 1);
      if (save.px !== undefined) {
        window.CH.player.setPose(save.px, save.pz, cfg.spawn.heading);
      }
      if (completed.length < cfg.missions.length) {
        window.CH.missions.startMission(idx);
        // Re-mark the earlier jobs as done for the record.
        var st = window.CH.missions.getState();
        st.completed = completed.slice();
      } else {
        window.CH.hud.setObjective('Free roam — the city is yours.');
      }
    } else {
      cash = 0;
      playSeconds = 0;
      window.CH.missions.startMission(0);
    }
    hideAllOverlays();
    gameState = 'playing';
    window.CH.camera.snapTo(playerState().x, playerState().z, playerState().heading);
  }

  function pauseGame() {
    if (gameState !== 'playing') return;
    gameState = 'paused';
    var done = window.CH.missions.getState().completed.length;
    $('pause-stats').textContent =
      'Cash $' + cash + '  ·  ' + done + ' of 4 jobs done  ·  ' +
      Math.floor(playSeconds / 60) + ' min on the street';
    $('pause-screen').classList.add('show');
  }

  function resumeGame() {
    if (gameState !== 'paused') return;
    $('pause-screen').classList.remove('show');
    gameState = 'playing';
  }

  // --- driver record (Tab) -------------------------------------------------

  function buildStatsHtml() {
    var m = window.CH.missions.getState();
    var rank = rankFor(xp);
    var rows = [
      ['Cash on hand', '$' + cash],
      ['Total earned', '$' + stats.earned],
      ['Driver rank', rank.name + ' (' + xp + ' XP)'],
      ['Jobs done', m.completed.length + ' of ' + cfg.missions.length],
      ['Cars stolen', String(stolenCars.length)],
      ['Times busted', String(stats.busted)],
      ['Times wasted', String(stats.wasted)],
      ['Bribes paid', String(stats.bribes)],
      ['Time on the street', Math.floor(playSeconds / 60) + ' min']
    ];
    var html = '<div class="stats-grid">';
    for (var i = 0; i < rows.length; i++) {
      html += '<div class="k">' + rows[i][0] + '</div><div class="v">' + rows[i][1] + '</div>';
    }
    html += '</div><div class="stats-section">DISTRICT STANDING</div><div class="stats-grid">';
    var all = window.CH.districts.all();
    for (var j = 0; j < all.length; j++) {
      html += '<div class="k">' + all[j].name + '</div><div class="v">' +
        all[j].label + ' (' + all[j].value + ')</div>';
    }
    html += '</div>';
    return html;
  }

  function toggleStats() {
    statsOpen = !statsOpen;
    if (statsOpen) {
      window.CH.hud.showStats(buildStatsHtml());
    } else {
      window.CH.hud.hideStats();
    }
  }

  // --- save ------------------------------------------------------------------

  function autosave() {
    var p = playerState();
    var m = window.CH.missions.getState();
    window.CH.save.save({
      cash: cash,
      missionIndex: Math.max(0, m.index),
      completed: m.completed,
      px: p.x,
      pz: p.z,
      playSeconds: playSeconds,
      xp: xp,
      health: health,
      armour: armour,
      standing: window.CH.districts.serialize(),
      stats: stats,
      clockMinutes: clockMinutes
    });
  }

  // --- debug hook ------------------------------------------------------------

  function debugState() {
    var p = playerState();
    var m = window.CH.missions.getState();
    var marker = window.CH.missions.markerPos({
      player: p, taxiCar: taxiCar, sportsCar: sportsCar
    });
    var mission = window.CH.missions.currentMission();
    return {
      x: p.x,
      z: p.z,
      heading: p.heading,
      speed: p.speed,
      inCar: p.inCar,
      carKind: p.car ? p.car.kind : null,
      wanted: window.CH.police.wanted(),
      cash: cash,
      health: Math.round(health),
      armour: Math.round(armour),
      xp: xp,
      rank: rankFor(xp).name,
      night: window.CH.city.isNight(),
      district: districtNow(),
      mission: mission ? mission.name : null,
      missionIndex: m.index,
      step: m.step,
      marker: marker,
      state: gameState,
      camYaw: window.CH.camera.getYaw(),
      cops: window.CH.police.cruisers().length + window.CH.police.cops().length,
      parked: window.CH.traffic.parked().map(function (c) {
        return { x: c.x, z: c.z, kind: c.kind };
      }),
      taxi: { x: taxiCar.x, z: taxiCar.z },
      sports: { x: sportsCar.x, z: sportsCar.z }
    };
  }

  // --- loop ------------------------------------------------------------------

  var lastT = 0;

  function loop(t) {
    requestAnimationFrame(loop);
    var dt = Math.min(0.1, (t - lastT) / 1000 || 0.016);
    lastT = t;
    frameCount++;

    if (gameState === 'title') {
      // A slow cinematic orbit over the sunset city.
      titleAngle += dt * 0.05;
      var cx = Math.cos(titleAngle) * 120;
      var cz = Math.sin(titleAngle) * 120;
      camera.position.set(cx, 55, cz);
      camera.lookAt(0, 4, 0);
      renderer.render(scene, camera);
      window.CH.input.endFrame();
      if (frameCount === 2) window.__CH_READY = true;
      return;
    }

    if (gameState === 'paused' || gameState === 'busted') {
      // P (or Esc) resumes from pause; the busted screen needs its button.
      if (gameState === 'paused' && window.CH.input.tapped('pause')) {
        resumeGame();
      }
      renderer.render(scene, camera);
      window.CH.input.endFrame();
      return;
    }

    // --- playing ---
    clock += dt;
    playSeconds += dt;
    clockMinutes += dt / 5; // one in-game minute every five seconds
    var input = window.CH.input;
    var p = playerState();

    // The driver record freezes the world while it is open.
    if (input.tapped('stats')) {
      toggleStats();
      input.endFrame();
      return;
    }
    if (statsOpen) {
      if (input.tapped('pause')) toggleStats();
      renderer.render(scene, camera);
      input.endFrame();
      return;
    }

    // Global keys.
    if (input.tapped('pause')) {
      pauseGame();
      input.endFrame();
      return;
    }
    if (input.tapped('mute')) {
      muted = !muted;
      window.CH.audio.setMuted(muted);
      window.CH.hud.setMuted(muted);
    }

    // Cooldowns tick down; health comes back while the heat is off.
    if (repairCd > 0) repairCd -= dt;
    if (bribeCd > 0) bribeCd -= dt;
    if (window.CH.police.wanted() === 0 && health > 0 && health < 100) {
      health = Math.min(100, health + 3 * dt);
    }
    if (!input.held('nitro') || !p.inCar) {
      nitroMeter = Math.min(100, nitroMeter + 12 * dt);
    }

    // Quick Repair: bodywork and a patch-up, once every 30 seconds.
    if (input.tapped('repair')) {
      if (repairCd > 0) {
        window.CH.hud.toast('Quick Repair recharging (' + Math.ceil(repairCd) + 's).');
      } else {
        repairCd = cfg.abilities.repair.cooldown;
        if (p.inCar && p.car) p.car.condition = 100;
        health = Math.min(100, health + 20);
        window.CH.audio.click();
        window.CH.hud.toast('Patched up — car and driver.');
      }
    }
    // Bribe: $150 buys one star off the heat.
    if (input.tapped('bribe') && bribeCd <= 0) {
      var w = window.CH.police.wanted();
      if (w === 0) {
        window.CH.hud.toast('No heat to pay off.');
      } else if (cash < cfg.abilities.bribe.cost) {
        window.CH.hud.toast('A bribe costs $' + cfg.abilities.bribe.cost + '.');
      } else {
        bribeCd = cfg.abilities.bribe.cooldown;
        cash -= cfg.abilities.bribe.cost;
        stats.bribes++;
        window.CH.police.setWanted(w - 1);
        window.CH.audio.cash();
        window.CH.hud.toast('The officer looks the other way. -$150.');
      }
    }

    // Driving or walking.
    var auto = window.CH.shots.autopilot(p);
    if (p.inCar && p.car) {
      var throttle = 0;
      var steer = 0;
      var handbrake = false;
      var nitro = false;
      if (auto) {
        throttle = auto.throttle;
        steer = auto.steer;
        handbrake = auto.handbrake;
      } else {
        if (input.held('forward')) throttle = 1;
        else if (input.held('back')) throttle = -1;
        if (input.held('left')) steer += 1;
        if (input.held('right')) steer -= 1;
        handbrake = input.held('brake');
        if (input.held('nitro') && nitroMeter > 0) {
          nitro = true;
          nitroMeter = Math.max(0, nitroMeter - cfg.abilities.nitro.drain * dt);
        }
      }
      window.CH.vehicles.drive(p.car, dt, { throttle: throttle, steer: steer, handbrake: handbrake, nitro: nitro }, onCrash);
      // Exhaust puffs at speed; nitro burns brighter.
      if (Math.abs(p.car.speed) > 12 && frameCount % 6 === 0) {
        window.CH.particles.puff(
          p.car.x - Math.sin(p.car.heading) * 2.2,
          p.car.z - Math.cos(p.car.heading) * 2.2
        );
      }
      if (nitro && frameCount % 2 === 0) {
        window.CH.particles.puff(
          p.car.x - Math.sin(p.car.heading) * 2.4,
          p.car.z - Math.cos(p.car.heading) * 2.4
        );
      }
      // A battered car smokes from the hood.
      if (p.car.condition < 30 && frameCount % 4 === 0) {
        window.CH.particles.puff(
          p.car.x + Math.sin(p.car.heading) * 2.0,
          p.car.z + Math.cos(p.car.heading) * 2.0
        );
      }
      // Push against traffic cars.
      var others = window.CH.traffic.allCars();
      for (var i = 0; i < others.length; i++) {
        var o = others[i];
        if (o === p.car || o.dead) continue;
        var dx = o.x - p.car.x;
        var dz = o.z - p.car.z;
        var d = Math.sqrt(dx * dx + dz * dz);
        var min = 4.0;
        if (d < min && d > 0.01) {
          var nx = dx / d;
          var nz = dz / d;
          var overlap = (min - d) / 2;
          p.car.x -= nx * overlap;
          p.car.z -= nz * overlap;
          o.x += nx * overlap;
          o.z += nz * overlap;
          if (Math.abs(p.car.speed) > 8) {
            onCrash(p.car);
            p.car.speed *= 0.6;
          }
        }
      }
    }

    window.CH.player.update(dt, input, window.CH.camera.getYaw());
    // Staged foot shot: stroll forward slowly.
    if (auto && auto.walk && !p.inCar) {
      // Nudge the player forward along their heading.
      var nx2 = p.x + Math.sin(p.heading) * 2.2 * dt;
      var nz2 = p.z + Math.cos(p.heading) * 2.2 * dt;
      var res2 = window.CH.city.collideCircle(nx2, nz2, 0.5);
      window.CH.player.setPose(res2.x, res2.z, p.heading);
    }

    var missionCtx = { player: playerState(), taxiCar: taxiCar, sportsCar: sportsCar };
    window.CH.missions.update(dt, missionCtx, clock);
    window.CH.traffic.update(dt, rng, playerState().inCar ? [playerState().car] : []);
    window.CH.pedestrians.update(dt, rng, playerState().inCar ? playerState().car : null);
    window.CH.police.update(dt, playerState(), playerState().inCar ? playerState().car : null, onCrash);
    window.CH.particles.update(dt);

    // Camera follows the player (or their car).
    var target = playerState().inCar && playerState().car
      ? { x: playerState().car.x, z: playerState().car.z, heading: playerState().car.heading, speed: playerState().car.speed }
      : { x: playerState().x, z: playerState().z, heading: playerState().heading, speed: playerState().speed };
    window.CH.camera.update(dt, target, playerState().inCar);

    // Sound follows the action.
    var carSpeed = playerState().inCar && playerState().car
      ? Math.abs(playerState().car.speed) / (playerState().car.spec.topSpeed || 30)
      : 0;
    window.CH.audio.engine(carSpeed, playerState().inCar);
    var nearestCop = window.CH.police.nearestPoliceDist(playerState().x, playerState().z);
    var closeness = window.CH.police.wanted() > 0
      ? util.clamp(1 - nearestCop / 90, 0, 1)
      : 0;
    window.CH.audio.siren(closeness, dt);

    // HUD + minimap.
    var mission = window.CH.missions.currentMission();
    var mState = window.CH.missions.getState();
    var rank = rankFor(xp);
    var pNow = playerState();
    var district = districtNow();
    var standing = window.CH.districts.get(district);
    window.CH.hud.setCash(cash);
    window.CH.hud.setWanted(window.CH.police.wanted());
    window.CH.hud.setSpeed(Math.abs(pNow.inCar && pNow.car ? pNow.car.speed : 0) * 2.237);
    window.CH.hud.setMissionName(mission ? mission.name.toUpperCase() : 'FREE ROAM');
    window.CH.hud.setStage(mission
      ? 'STAGE ' + (mState.index + 1) + '/' + cfg.missions.length + '  ·  $' + mission.reward
      : '');
    window.CH.hud.setTimer(window.CH.missions.timeLeft());
    window.CH.hud.setRank(rank.name, rank.frac);
    window.CH.hud.setHealth(health);
    window.CH.hud.setArmour(armour);
    window.CH.hud.setClock(fmtClock());
    window.CH.hud.setDistrict(district + ' · ' + window.CH.districts.labelFor(standing));
    window.CH.hud.setResponse(window.CH.police.wanted() > 0
      ? window.CH.police.units(pNow.x, pNow.z) : null);
    window.CH.hud.setAbilities({
      nitro: nitroMeter,
      repairCd: Math.max(0, repairCd),
      canBribe: window.CH.police.wanted() > 0 && cash >= cfg.abilities.bribe.cost
    });
    window.CH.hud.setCondition(pNow.inCar && pNow.car ? pNow.car.condition : null);
    window.CH.minimap.update(dt, {
      player: playerState(),
      cars: window.CH.traffic.allCars(),
      police: window.CH.police.cruisers(),
      marker: window.CH.missions.markerPos(missionCtx)
    });

    // Autosave every 10 seconds.
    saveTimer += dt;
    if (saveTimer > 10) {
      saveTimer = 0;
      autosave();
    }

    renderer.render(scene, camera);
    window.CH.input.endFrame();
    if (frameCount === 2) window.__CH_READY = true;
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  window.addEventListener('DOMContentLoaded', boot);
})();
