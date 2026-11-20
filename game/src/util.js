// Shared helpers: the CH namespace, a seeded random generator, and the
// small math every system needs. Loaded first; every other file hangs its
// factory off CH and calls these helpers.
(function () {
  var CH = window.CH || (window.CH = {});

  // mulberry32: a tiny deterministic PRNG, so a seed rebuilds the same city.
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function createRandom(seed) {
    var next = mulberry32(seed);
    return {
      next: next,
      range: function (lo, hi) { return lo + next() * (hi - lo); },
      int: function (lo, hi) { return lo + Math.floor(next() * (hi - lo + 1)); },
      pick: function (list) { return list[Math.floor(next() * list.length)]; },
      chance: function (p) { return next() < p; },
    };
  }

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function damp(current, target, rate, dt) {
    return lerp(current, target, 1 - Math.exp(-rate * dt));
  }
  // Shortest signed difference between two headings, in (-PI, PI].
  function angleDiff(a, b) {
    var d = (a - b) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d <= -Math.PI) d += Math.PI * 2;
    return d;
  }
  function dist2(ax, az, bx, bz) {
    var dx = ax - bx, dz = az - bz;
    return dx * dx + dz * dz;
  }
  function dist(ax, az, bx, bz) { return Math.sqrt(dist2(ax, az, bx, bz)); }
  // Where the player actually is: the car while driving (the on-foot
  // group stays behind at the entry point), otherwise the group.
  function playerPos(world) {
    var player = world.player;
    if (player.mode === 'car' && player.car) return player.car.group.position;
    return player.group.position;
  }

  CH.createRandom = createRandom;
  CH.clamp = clamp;
  CH.lerp = lerp;
  CH.damp = damp;
  CH.angleDiff = angleDiff;
  CH.dist2 = dist2;
  CH.dist = dist;
  CH.playerPos = playerPos;
})();
