// particles.js — one pooled THREE.Points cloud for every burst in the
// game: crash sparks, muzzle flashes, cash sparkles and exhaust puffs.
// A single draw call, recycled slots, no per-particle meshes.
(function () {
  'use strict';

  var MAX = 300;
  var points = null;
  var positions = null;
  var colors = null;
  var vel = null; // per-particle velocity (x, y, z)
  var life = null; // seconds remaining
  var maxLife = null;
  var gravity = null;
  var cursor = 0;
  var geo = null;

  function init(scene) {
    positions = new Float32Array(MAX * 3);
    colors = new Float32Array(MAX * 3);
    vel = new Float32Array(MAX * 3);
    life = new Float32Array(MAX);
    maxLife = new Float32Array(MAX);
    gravity = new Float32Array(MAX);
    for (var i = 0; i < MAX; i++) {
      positions[i * 3 + 1] = -100; // park unused particles below the world
    }
    geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    var mat = new THREE.PointsMaterial({
      size: 0.55, vertexColors: true, transparent: true, opacity: 0.95,
      depthWrite: false, sizeAttenuation: true
    });
    points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    scene.add(points);
  }

  function spawn(x, y, z, vx, vy, vz, r, g, b, ttl, grav) {
    var i = cursor;
    cursor = (cursor + 1) % MAX;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    vel[i * 3] = vx;
    vel[i * 3 + 1] = vy;
    vel[i * 3 + 2] = vz;
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
    life[i] = ttl;
    maxLife[i] = ttl;
    gravity[i] = grav;
  }

  function burst(x, y, z, count, color, speed, ttl) {
    for (var i = 0; i < count; i++) {
      var a = Math.random() * Math.PI * 2;
      var up = Math.random() * 0.9 + 0.2;
      var s = speed * (0.4 + Math.random() * 0.8);
      spawn(
        x, y, z,
        Math.cos(a) * s, up * s * 0.8, Math.sin(a) * s,
        color[0], color[1], color[2],
        ttl * (0.6 + Math.random() * 0.7), -9
      );
    }
  }

  function sparks(x, z) {
    burst(x, 1.2, z, 16, [1.0, 0.75, 0.25], 7, 0.6);
  }

  function muzzle(x, z, fx, fz) {
    burst(x + fx, 1.4, z + fz, 6, [1.0, 0.9, 0.4], 4, 0.18);
  }

  function cashBurst(x, z) {
    burst(x, 1.5, z, 26, [0.4, 1.0, 0.5], 5, 1.1);
  }

  function puff(x, z) {
    spawn(x, 0.5, z, (Math.random() - 0.5), 1.2, (Math.random() - 0.5), 0.6, 0.6, 0.62, 0.7, 1.5);
  }

  function update(dt) {
    var any = false;
    for (var i = 0; i < MAX; i++) {
      if (life[i] <= 0) continue;
      any = true;
      life[i] -= dt;
      if (life[i] <= 0) {
        positions[i * 3 + 1] = -100;
        continue;
      }
      vel[i * 3 + 1] += gravity[i] * dt;
      positions[i * 3] += vel[i * 3] * dt;
      positions[i * 3 + 1] += vel[i * 3 + 1] * dt;
      positions[i * 3 + 2] += vel[i * 3 + 2] * dt;
      if (positions[i * 3 + 1] < 0.1) positions[i * 3 + 1] = 0.1;
    }
    if (any) {
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    }
  }

  window.CH = window.CH || {};
  window.CH.particles = {
    init: init,
    sparks: sparks,
    muzzle: muzzle,
    cashBurst: cashBurst,
    puff: puff,
    update: update
  };
})();
