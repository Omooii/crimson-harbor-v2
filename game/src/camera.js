// camera.js — the third-person chase camera. It trails behind the
// player's heading, pulls back and rises with speed, and lets the player
// drag the mouse to look around; the view eases back behind the player
// when the mouse is released.
(function () {
  'use strict';

  var util = window.CH.util;

  var camera = null;
  var yaw = 0; // the direction the camera looks (same convention as heading)
  var yawOffset = 0; // mouse drag, decays back to 0
  var pos = { x: 0, y: 8, z: -12 };
  var look = { x: 0, y: 2, z: 0 };
  var lookBack = false; // chase shots: film from ahead, looking back

  function init(cam) {
    camera = cam;
  }

  function setLookBack(on) {
    lookBack = on;
  }

  function setYaw(y) {
    yaw = y;
    yawOffset = 0;
  }

  function getYaw() {
    return yaw + yawOffset;
  }

  function snapTo(x, z, heading) {
    var back = 11;
    pos.x = x - Math.sin(heading) * back;
    pos.z = z - Math.cos(heading) * back;
    pos.y = 5;
    yaw = heading;
    yawOffset = 0;
  }

  // target: {x, z, heading, speed}; inCar widens the shot.
  function update(dt, target, inCar) {
    // Mouse drag orbits the camera around the player.
    var mdx = window.CH.input.consumeMouseDX();
    yawOffset -= mdx * 0.004;
    yawOffset = util.clamp(yawOffset, -Math.PI, Math.PI);
    // Ease the offset back when the mouse is still.
    if (mdx === 0) yawOffset = util.lerp(yawOffset, 0, Math.min(1, dt * 0.7));

    // The camera wants to sit behind the heading it follows.
    var follow = target.heading;
    yaw = util.angleLerp(yaw, follow, Math.min(1, dt * (inCar ? 2.2 : 3.2)));
    var viewYaw = yaw + yawOffset;

    var speedNorm = util.clamp(Math.abs(target.speed || 0) / 30, 0, 1);
    var dist = (inCar ? 8.8 : 7.5) + speedNorm * 2.5;
    var height = (inCar ? 3.9 : 3.4) + speedNorm * 0.8;

    var wantX;
    var wantZ;
    var wantY;
    if (lookBack) {
      // Ahead of the car and off to one side, looking back at it: the
      // classic chase framing, pursuers visible behind the player.
      var fx = Math.sin(target.heading);
      var fz = Math.cos(target.heading);
      wantX = target.x + fx * 13 - fz * 3.5;
      wantZ = target.z + fz * 13 + fx * 3.5;
      wantY = 4.2;
    } else {
      wantX = target.x - Math.sin(viewYaw) * dist;
      wantZ = target.z - Math.cos(viewYaw) * dist;
      wantY = height + (inCar ? 0.6 : 1.2);
    }
    var k = Math.min(1, dt * 5);
    pos.x = util.lerp(pos.x, wantX, k);
    pos.y = util.lerp(pos.y, wantY, k);
    pos.z = util.lerp(pos.z, wantZ, k);
    if (pos.y < 1.6) pos.y = 1.6;

    // Look slightly ahead of the player, in the direction of travel —
    // or, in look-back mode, right at the player.
    var lookX;
    var lookZ;
    if (lookBack) {
      lookX = target.x;
      lookZ = target.z;
    } else {
      lookX = target.x + Math.sin(target.heading) * 3;
      lookZ = target.z + Math.cos(target.heading) * 3;
    }
    look.x = util.lerp(look.x, lookX, Math.min(1, dt * 8));
    look.y = util.lerp(look.y, inCar ? 1.4 : 1.8, Math.min(1, dt * 8));
    look.z = util.lerp(look.z, lookZ, Math.min(1, dt * 8));

    camera.position.set(pos.x, pos.y, pos.z);
    camera.lookAt(look.x, look.y, look.z);
  }

  window.CH = window.CH || {};
  window.CH.camera = {
    init: init,
    setYaw: setYaw,
    setLookBack: setLookBack,
    getYaw: getYaw,
    snapTo: snapTo,
    update: update
  };
})();
