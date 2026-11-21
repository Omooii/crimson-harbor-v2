// Small shared helpers: seeded random, angles, formatting, DOM lookup.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
export const dist = (x1, z1, x2, z2) => Math.hypot(x2 - x1, z2 - z1);
export const fmtMoney = (n) => '$' + Math.floor(n).toLocaleString('en-US');
export function fmtTime(s) {
  s = Math.max(0, Math.ceil(s));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
export const $ = (id) => document.getElementById(id);
// Pick a random element with the seeded rng.
export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
