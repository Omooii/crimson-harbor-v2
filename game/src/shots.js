// shots.js — screenshot staging. A URL like ?shot=drive&seed=7 skips the
// title screen and places the player, the cars, the wanted level and the
// mission into a fixed, deterministic scene, so the four screenshots are
// real renders of the game at its best. Each shot is its own moment in
// the story, in its own part of the city: the sunset drive west, a night
// street on foot, the Hot Wheels getaway, the Harbor Run climax. During
// a staged shot the game drives itself (autopilot), so the car is
// mid-motion when the shutter falls.
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var shot = params.get('shot') || null;
  var seed = parseInt(params.get('seed') || '7', 10);
  if (isNaN(seed)) seed = 7;

  var staged = null; // the shot we staged, once main hands us the world

  function isStaging() {
    return shot === 'drive' || shot === 'foot' || shot === 'chase' || shot === 'mission';
  }

  function getSeed() {
    return seed;
  }

  function getShot() {
    return shot;
  }

  // Put a few pedestrians on the sidewalks near (x, z), strolling, so a
  // street reads as inhabited.
  function crowdNear(spots) {
    var peds = window.CH.pedestrians.all();
    for (var i = 0; i < spots.length && i < peds.length; i++) {
      var ped = peds[i];
      ped.x = spots[i].x;
      ped.z = spots[i].z;
      ped.target = spots[i].target;
      ped.heading = Math.atan2(spots[i].target.x - ped.x, spots[i].target.z - ped.z);
      ped.mesh.group.position.set(ped.x, 0, ped.z);
    }
  }

  // ctx: {player, taxiCar, sportsCar, scene} — everything main built.
  function stage(ctx) {
    var P = window.CH.player;
    var M = window.CH.missions;
    var V = window.CH.vehicles;
    var T = window.CH.traffic;
    staged = shot;

    if (params.get('night') === '1') {
      window.CH.city.setNight(true);
    }

    if (shot === 'drive') {
      // Westbound on the main street, into the setting sun, the Comet GT
      // at full chat with oncoming traffic in the next lane.
      V.setPose(ctx.sportsCar, 60, -10.5, -Math.PI / 2);
      ctx.sportsCar.speed = 20;
      P.enterCar(ctx.sportsCar);
      // Entering the Comet GT counts as a theft; the drive shot is clean.
      window.CH.police.setWanted(0);
      // Oncoming traffic: a sedan and a truck in the eastbound lane, and
      // a car ahead in our lane — all still ahead when the shutter falls.
      T.spawnParkedAt(ctx.scene, 'sedan', -55, -3.5, Math.PI / 2, 0x2a6ac0);
      T.spawnParkedAt(ctx.scene, 'truck', -40, -3.5, Math.PI / 2, 0xe8e4da);
      T.spawnParkedAt(ctx.scene, 'sedan', -35, -10.5, -Math.PI / 2, 0x5a7a5a);
      M.startMission(0);
      M.setStep(1);
      window.CH.hud.showDialogue('Mara', 'Client\u2019s waiting at the hotel. Look sharp.', 20000);
      window.CH.camera.snapTo(ctx.sportsCar.x, ctx.sportsCar.z, -Math.PI / 2);
    } else if (shot === 'foot') {
      // On foot at the kerb by the garage, at night: streetlights, lit
      // windows, shop signs, people strolling past on both sidewalks.
      P.setPose(-12, 75, Math.PI);
      window.CH.camera.snapTo(-12, 75, Math.PI);
      crowdNear([
        { x: -15.5, z: 52, target: { x: -15.5, z: 90 } },
        { x: 1.5, z: 58, target: { x: 1.5, z: 95 } },
        { x: -15.5, z: 40, target: { x: -15.5, z: 70 } },
        { x: 1.5, z: 45, target: { x: 1.5, z: 75 } }
      ]);
      M.startMission(0);
      window.CH.hud.showDialogue('Mara', 'Taxi\u2019s gassed up. Don\u2019t scratch her — she\u2019s my favorite.', 20000);
    } else if (shot === 'chase') {
      // The Hot Wheels getaway: three stars, three cruisers on the tail,
      // a near-miss sedan in the next lane, the garage far behind.
      V.setPose(ctx.sportsCar, -3.5, 20, Math.PI);
      ctx.sportsCar.speed = 24;
      P.enterCar(ctx.sportsCar);
      window.CH.police.stageChase(ctx.sportsCar.x, ctx.sportsCar.z, Math.PI);
      window.CH.camera.setLookBack(true);
      // The sedan the getaway just squeezed past.
      T.spawnParkedAt(ctx.scene, 'sedan', -10.5, -64, Math.PI / 2, 0x2a6ac0);
      window.CH.debug.setCash(500);
      window.CH.debug.setXp(175);
      M.startMission(1);
      M.setStep(1);
      window.CH.hud.showDialogue('Mara', 'You got her. Now bring her in — easy does it.', 30000);
      window.CH.camera.snapTo(ctx.sportsCar.x, ctx.sportsCar.z, Math.PI);
    } else if (shot === 'mission') {
      // The Harbor Run climax: the crate is loaded, the clock is running,
      // the dock beam stands over the water ahead.
      V.setPose(ctx.sportsCar, 150, 53, Math.PI / 2);
      ctx.sportsCar.speed = 20;
      P.enterCar(ctx.sportsCar);
      window.CH.police.setWanted(0);
      window.CH.debug.setCash(1250);
      window.CH.debug.setXp(325);
      window.CH.debug.setClock(18 * 60 + 20);
      M.startMission(2);
      M.setStep(1);
      M.setTimer(85);
      window.CH.hud.showDialogue('Mara', 'Crate\u2019s loaded. Harbor Dock, and don\u2019t stop for anyone.', 25000);
      window.CH.camera.snapTo(ctx.sportsCar.x, ctx.sportsCar.z, Math.PI / 2);
    }
    return staged;
  }

  // Autopilot input while a shot is staged. Returns null when the shot
  // needs no driving.
  function autopilot(playerState) {
    if (!isStaging()) return null;
    if (shot === 'foot') return { walk: true };
    if (!playerState.inCar) return null;
    var car = playerState.car;
    var util = window.CH.util;
    if (shot === 'drive') {
      // Westbound on the street, into the sunset, holding the lane.
      var headingErr = util.angleDiff(-Math.PI / 2, car.heading);
      var steer = util.clamp(headingErr * 2.0 - (car.z + 10.5) * 0.06, -1, 1);
      return { throttle: 0.85, steer: steer, handbrake: false };
    }
    if (shot === 'mission') {
      // Toward the dock marker.
      var dock = window.CH.config.dock;
      var desired = Math.atan2(dock.x - car.x, dock.z - car.z);
      var steerM = util.clamp(util.angleDiff(desired, car.heading) * 2.0, -1, 1);
      return { throttle: 0.85, steer: steerM, handbrake: false };
    }
    // Northbound up the avenue (the chase).
    var laneErr = (car.x + 3.5) * 0.06;
    var headingErrN = util.angleDiff(Math.PI, car.heading);
    var steerN = util.clamp(headingErrN * 2.0 + laneErr, -1, 1);
    return { throttle: 0.85, steer: steerN, handbrake: false };
  }

  window.CH = window.CH || {};
  window.CH.shots = {
    isStaging: isStaging,
    getSeed: getSeed,
    getShot: getShot,
    stage: stage,
    autopilot: autopilot
  };
})();
