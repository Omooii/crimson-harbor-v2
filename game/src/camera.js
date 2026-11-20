// The chase camera: it sits behind the player (or the car), eases into
// place instead of snapping, lets the mouse orbit the view, pulls back
// with speed, and shakes on crashes and explosions.
(function () {
  var CH = window.CH;

  function createCamera(camera) {
    var yaw = 0;
    var yawOffset = 0;
    var pitch = 0.32;
    var distance = 9;
    var shake = 0;
    var currentPos = new THREE.Vector3(0, 8, -12);
    var currentLook = new THREE.Vector3(0, 1, 0);

    function addShake(amount) {
      shake = Math.min(1.2, shake + amount);
    }

    function update(dt, world, input) {
      var player = world.player;
      // The chase shot looks back: the camera rides ahead of the car so
      // the pursuit is visible behind it, movie-style.
      if (world.shot && world.shot.name === 'chase') {
        var pp = player.mode === 'car' && player.car ? player.car.group.position : player.group.position;
        var hd = player.mode === 'car' && player.car ? player.car.heading : player.heading;
        var fx = Math.sin(hd);
        var fz = Math.cos(hd);
        var rx = Math.cos(hd);
        var rz = -Math.sin(hd);
        var desired = new THREE.Vector3(pp.x + fx * 15 + rx * 5, 4.4, pp.z + fz * 15 + rz * 5);
        currentPos.x = CH.damp(currentPos.x, desired.x, 25, dt);
        currentPos.y = CH.damp(currentPos.y, desired.y, 25, dt);
        currentPos.z = CH.damp(currentPos.z, desired.z, 25, dt);
        var look = new THREE.Vector3(pp.x, pp.y + 1.5, pp.z);
        currentLook.x = CH.damp(currentLook.x, look.x, 25, dt);
        currentLook.y = CH.damp(currentLook.y, look.y, 25, dt);
        currentLook.z = CH.damp(currentLook.z, look.z, 25, dt);
        shake = Math.max(0, shake - dt * 2.2);
        var sx = shake > 0 ? (Math.random() - 0.5) * shake * 0.5 : 0;
        var sy = shake > 0 ? (Math.random() - 0.5) * shake * 0.5 : 0;
        camera.position.set(currentPos.x + sx, currentPos.y + sy, currentPos.z);
        camera.lookAt(currentLook.x + sx, currentLook.y + sy, currentLook.z);
        return;
      }
      var target = player.mode === 'car' && player.car
        ? player.car.group.position
        : player.group.position;
      var heading = player.mode === 'car' && player.car ? player.car.heading : player.heading;
      var speed = player.mode === 'car' && player.car ? Math.abs(player.car.speed) : player.speed;

      // Mouse steers the orbit; it eases back behind the heading.
      yawOffset -= input.mouse.dx * 0.0035;
      yawOffset = CH.clamp(yawOffset, -2.4, 2.4);
      yawOffset = CH.damp(yawOffset, 0, 0.6, dt);
      pitch = CH.clamp(pitch + input.mouse.dy * 0.002, 0.12, 0.9);
      var wantYaw = heading + Math.PI + yawOffset;
      var dy = CH.angleDiff(wantYaw, yaw);
      yaw += dy * Math.min(1, dt * (player.mode === 'car' ? 2.6 : 5));
      world.camYaw = yaw - Math.PI;

      var wantDist = player.mode === 'car' ? 8 + Math.min(2, speed * 0.06) : 7;
      distance = CH.damp(distance, wantDist, 3, dt);
      var height = player.mode === 'car' ? 4.6 : 3.2;
      var lookHeight = player.mode === 'car' ? 1.6 : 1.8;

      var desired = new THREE.Vector3(
        target.x + Math.sin(yaw) * Math.cos(pitch) * distance,
        target.y + height + Math.sin(pitch) * distance * 0.5,
        target.z + Math.cos(yaw) * Math.cos(pitch) * distance
      );
      // Never sink under the street.
      desired.y = Math.max(desired.y, 1.6);
      // Stiff tracking: at full speed the camera must not trail the car.
      currentPos.x = CH.damp(currentPos.x, desired.x, 25, dt);
      currentPos.y = CH.damp(currentPos.y, desired.y, 25, dt);
      currentPos.z = CH.damp(currentPos.z, desired.z, 25, dt);
      // Look slightly ahead of the car so the road fills the frame.
      var ahead = player.mode === 'car' ? 2.5 : 1.5;
      var look = new THREE.Vector3(
        target.x + Math.sin(heading) * ahead,
        target.y + lookHeight,
        target.z + Math.cos(heading) * ahead
      );
      currentLook.x = CH.damp(currentLook.x, look.x, 12, dt);
      currentLook.y = CH.damp(currentLook.y, look.y, 12, dt);
      currentLook.z = CH.damp(currentLook.z, look.z, 12, dt);

      shake = Math.max(0, shake - dt * 2.2);
      var sx = shake > 0 ? (Math.random() - 0.5) * shake * 0.5 : 0;
      var sy = shake > 0 ? (Math.random() - 0.5) * shake * 0.5 : 0;
      camera.position.set(currentPos.x + sx, currentPos.y + sy, currentPos.z);
      camera.lookAt(currentLook.x + sx, currentLook.y + sy, currentLook.z);
    }

    function snapTo(world) {
      var player = world.player;
      var target = player.mode === 'car' && player.car
        ? player.car.group.position
        : player.group.position;
      var heading = player.mode === 'car' && player.car ? player.car.heading : player.heading;
      yaw = heading + Math.PI;
      yawOffset = 0;
      currentPos.set(
        target.x + Math.sin(yaw) * distance,
        target.y + 4,
        target.z + Math.cos(yaw) * distance
      );
      currentLook.set(target.x, target.y + 1.6, target.z);
      world.camYaw = yaw - Math.PI;
    }

    return { update: update, snapTo: snapTo, addShake: addShake };
  }

  CH.createCamera = createCamera;
})();
