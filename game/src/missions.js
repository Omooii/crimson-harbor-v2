// missions.js — Mara's four jobs. Each mission is a list of steps: get
// in a car, or reach a place. The current step's waypoint gets a light
// beam and a minimap marker; finishing a mission pays cash, and the next
// job starts after a short breather. Only the timed Harbor Run can fail,
// and it simply restarts.
(function () {
  'use strict';

  var cfg = window.CH.config;
  var util = window.CH.util;

  var sceneRef = null;
  var hooks = {}; // onBanner, onObjective, onComplete, onFail, onCash,
  // onStart(mission), onStep(mission, stepIndex), onTimer
  var beam = null;
  var ring = null;
  var state = {
    index: -1, // -1: none started yet
    step: 0,
    active: false,
    completed: [],
    timer: 0,
    breather: 0,
    failed: false
  };

  function landmark(name) {
    return cfg[name];
  }

  function currentMission() {
    if (state.index < 0 || state.index >= cfg.missions.length) return null;
    return cfg.missions[state.index];
  }

  function currentStep() {
    var m = currentMission();
    if (!m || !state.active) return null;
    return m.steps[state.step] || null;
  }

  function buildMarker(scene) {
    var beamMat = new THREE.MeshBasicMaterial({
      color: 0xffd76a, transparent: true, opacity: 0.28,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    });
    beam = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 42, 12, 1, true), beamMat);
    beam.visible = false;
    scene.add(beam);
    var ringMat = new THREE.MeshBasicMaterial({
      color: 0xffd76a, transparent: true, opacity: 0.75, side: THREE.DoubleSide
    });
    ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 3.0, 24), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.visible = false;
    scene.add(ring);
  }

  function init(scene, hookFns) {
    sceneRef = scene;
    hooks = hookFns || {};
    buildMarker(scene);
  }

  function startMission(index) {
    var m = cfg.missions[index];
    if (!m) return;
    state.index = index;
    state.step = 0;
    state.active = true;
    state.failed = false;
    state.timer = m.timeLimit || 0;
    state.breather = 0;
    if (hooks.onBanner) hooks.onBanner(m.name, m.intro, 5200);
    if (hooks.onObjective) hooks.onObjective(m.steps[0].text);
    if (hooks.onStart) hooks.onStart(m);
    window.CH.audio.missionStart();
  }

  function restartCurrent() {
    state.step = 0;
    state.active = true;
    state.failed = false;
    var m = currentMission();
    state.timer = (m && m.timeLimit) || 0;
    if (hooks.onObjective) hooks.onObjective(m.steps[0].text);
  }

  // Where the current step points: a fixed landmark, or a moving car.
  function stepTarget(ctx) {
    var step = currentStep();
    if (!step) return null;
    if (step.type === 'enter') {
      if (step.car === 'taxi') return { x: ctx.taxiCar.x, z: ctx.taxiCar.z, car: ctx.taxiCar };
      if (step.car === 'sports') return { x: ctx.sportsCar.x, z: ctx.sportsCar.z, car: ctx.sportsCar };
      return null;
    }
    var lm = landmark(step.at);
    return { x: lm.x, z: lm.z };
  }

  function markerPos(ctx) {
    var t = stepTarget(ctx);
    return t ? { x: t.x, z: t.z } : null;
  }

  function advance(ctx) {
    var m = currentMission();
    var step = currentStep();
    if (step && step.wanted) {
      window.CH.police.setWanted(Math.max(window.CH.police.wanted(), step.wanted));
      if (hooks.onBanner) hooks.onBanner('WANTED', 'The whole city is looking for you now.', 3000);
    }
    state.step++;
    if (state.step >= m.steps.length) {
      complete(ctx);
      return;
    }
    if (hooks.onObjective) hooks.onObjective(m.steps[state.step].text);
    if (hooks.onStep) hooks.onStep(m, state.step);
    window.CH.audio.click();
  }

  function complete(ctx) {
    var m = currentMission();
    state.active = false;
    state.completed.push(m.id);
    beam.visible = false;
    ring.visible = false;
    if (hooks.onComplete) hooks.onComplete(m);
    // Next job after a breather.
    if (state.index + 1 < cfg.missions.length) {
      state.breather = 4;
    }
  }

  function update(dt, ctx, clock) {
    // Breather between jobs.
    if (!state.active && state.breather > 0) {
      state.breather -= dt;
      if (state.breather <= 0) {
        if (state.restartPending) {
          state.restartPending = false;
          restartCurrent();
          if (hooks.onBanner) hooks.onBanner(currentMission().name, 'Try again — the job is still open.', 3000);
        } else {
          startMission(state.index + 1);
        }
      }
      return;
    }
    var m = currentMission();
    var step = currentStep();
    if (!m || !step) {
      beam.visible = false;
      ring.visible = false;
      return;
    }
    // Timed mission countdown.
    if (m.timeLimit) {
      state.timer -= dt;
      if (state.timer <= 0) {
        state.active = false;
        state.failed = true;
        beam.visible = false;
        ring.visible = false;
        if (hooks.onFail) hooks.onFail(m);
        window.CH.audio.fail();
        state.breather = 3;
        // After the breather, the same mission restarts.
        state.restartPending = true;
        return;
      }
      if (hooks.onTimer) hooks.onTimer(Math.max(0, state.timer));
    }
    // Marker follows the step's target.
    var target = stepTarget(ctx);
    if (target) {
      beam.visible = true;
      ring.visible = true;
      var pulse = 1 + Math.sin(clock * 3) * 0.12;
      beam.position.set(target.x, 21, target.z);
      beam.scale.set(pulse, 1, pulse);
      ring.position.set(target.x, 0.35, target.z);
      ring.rotation.z = clock * 0.8;
    } else {
      beam.visible = false;
      ring.visible = false;
    }
    // Step completion.
    var player = ctx.player;
    if (step.type === 'enter') {
      if (player.inCar && player.car === target.car) advance(ctx);
    } else if (step.type === 'goto') {
      var r = step.radius || 16;
      if (util.dist2(player.x, player.z, target.x, target.z) < r) advance(ctx);
    }
  }

  function setStep(i) {
    var m = currentMission();
    if (!m) return;
    state.step = Math.max(0, Math.min(i, m.steps.length - 1));
    if (hooks.onObjective) hooks.onObjective(m.steps[state.step].text);
  }

  function timeLeft() {
    var m = currentMission();
    return m && m.timeLimit ? Math.max(0, state.timer) : null;
  }

  // Screenshot staging: set the countdown to a dramatic value.
  function setTimer(seconds) {
    state.timer = seconds;
  }

  function getState() {
    return state;
  }

  window.CH = window.CH || {};
  window.CH.missions = {
    init: init,
    startMission: startMission,
    setStep: setStep,
    setTimer: setTimer,
    update: update,
    currentMission: currentMission,
    currentStep: currentStep,
    markerPos: markerPos,
    timeLeft: timeLeft,
    getState: getState
  };
})();
