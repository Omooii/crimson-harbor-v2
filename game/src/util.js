// util.js — small shared helpers: seeded random numbers, angles, clamps.
// Everything in the game that needs randomness takes it from one seeded
// generator, so a screenshot staged with ?seed=7 renders the same city
// every time.
(function () {
  'use strict';

  // mulberry32: a tiny deterministic PRNG. seed is any integer.
  function makeRng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  // Shortest signed difference between two headings, in (-PI, PI].
  function angleDiff(a, b) {
    var d = (a - b) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d <= -Math.PI) d += Math.PI * 2;
    return d;
  }

  function angleLerp(a, b, t) {
    return a + angleDiff(b, a) * t;
  }

  function dist2(ax, az, bx, bz) {
    var dx = ax - bx;
    var dz = az - bz;
    return Math.sqrt(dx * dx + dz * dz);
  }

  function pick(rng, arr) {
    return arr[Math.floor(rng() * arr.length)];
  }

  function range(rng, lo, hi) {
    return lo + rng() * (hi - lo);
  }

  function intRange(rng, lo, hi) {
    return lo + Math.floor(rng() * (hi - lo + 1));
  }

  window.CH = window.CH || {};
  window.CH.util = {
    makeRng: makeRng,
    clamp: clamp,
    lerp: lerp,
    angleDiff: angleDiff,
    angleLerp: angleLerp,
    dist2: dist2,
    pick: pick,
    range: range,
    intRange: intRange,
    TAU: Math.PI * 2
  };
})();
