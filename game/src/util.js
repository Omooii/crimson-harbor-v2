// Small shared helpers: seeded RNG, math, and canvas texture builders.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const TAU = Math.PI * 2;
export function angDiff(a, b) { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
export function fmtMoney(n) { return '$' + Math.floor(n).toLocaleString('en-US'); }
export function fmtTime(sec) {
  const m = Math.max(0, Math.floor(sec / 60)), s = Math.max(0, Math.floor(sec % 60));
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}
// Deterministic pick from an array with an rng.
export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length) % arr.length]; }
// A canvas texture of `w`x`h` drawn by `draw(ctx, w, h)`; returns a THREE.CanvasTexture.
export function canvasTexture(THREE, w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = 4;
  return t;
}
// Procedural portrait: a stylised face on a coloured disc, drawn from a seed.
export function portraitURL(seed, skin, hair, shirt, hairStyle) {
  const c = document.createElement('canvas'); c.width = c.height = 96;
  const x = c.getContext('2d'); const r = mulberry32(seed);
  const g = x.createLinearGradient(0, 0, 0, 96); g.addColorStop(0, '#2b2f3a'); g.addColorStop(1, '#14161d');
  x.fillStyle = g; x.fillRect(0, 0, 96, 96);
  x.fillStyle = shirt; x.beginPath(); x.moveTo(8, 96); x.quadraticCurveTo(48, 52, 88, 96); x.fill();
  x.fillStyle = skin; x.beginPath(); x.ellipse(48, 44, 24, 28, 0, 0, TAU); x.fill();
  x.fillStyle = hair;
  if (hairStyle === 0) { x.beginPath(); x.ellipse(48, 26, 25, 16, 0, Math.PI, TAU); x.fill(); x.fillRect(22, 24, 52, 8); }
  else if (hairStyle === 1) { x.beginPath(); x.ellipse(48, 22, 26, 18, 0, Math.PI, TAU); x.fill(); x.fillRect(20, 20, 10, 34); x.fillRect(66, 20, 10, 34); }
  else { x.beginPath(); x.ellipse(48, 20, 24, 12, 0, Math.PI, TAU); x.fill(); }
  x.fillStyle = '#1c1c1c';
  x.beginPath(); x.ellipse(38, 44, 3.4, 4.4, 0, 0, TAU); x.ellipse(58, 44, 3.4, 4.4, 0, 0, TAU); x.fill();
  x.strokeStyle = '#1c1c1c'; x.lineWidth = 2; x.beginPath();
  x.moveTo(40, 62); x.quadraticCurveTo(48, 66 + r() * 3, 56, 62); x.stroke();
  x.fillStyle = 'rgba(255,255,255,.08)'; x.beginPath(); x.ellipse(48, 30, 20, 10, 0, Math.PI, TAU); x.fill();
  return c.toDataURL();
}
