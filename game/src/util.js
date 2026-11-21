// Small shared helpers: seeded RNG, math, procedural portraits and textures.
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
export const rand = (rng, a, b) => a + rng() * (b - a);
export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length) % arr.length]; }
export function fmtMoney(n) { return '$' + Math.floor(n).toLocaleString('en-US'); }
export function fmtTime(s) {
  s = Math.max(0, Math.ceil(s));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
export function fmtClock(hours) {
  const h = Math.floor(hours) % 24, m = Math.floor((hours % 1) * 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

// Procedural character portrait (canvas 2D), returned as a data URL.
export function makePortrait(opts) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  const rng = mulberry32(opts.seed || 7);
  // background
  const bg = g.createLinearGradient(0, 0, 0, 128);
  bg.addColorStop(0, opts.bg1 || '#ff9a5c'); bg.addColorStop(1, opts.bg2 || '#c33d7a');
  g.fillStyle = bg; g.fillRect(0, 0, 128, 128);
  // sun glow
  g.fillStyle = 'rgba(255,230,160,.5)';
  g.beginPath(); g.arc(96, 26, 22, 0, 7); g.fill();
  // shoulders / jacket
  g.fillStyle = opts.jacket || '#20304a';
  g.beginPath(); g.moveTo(10, 128); g.quadraticCurveTo(20, 88, 64, 86); g.quadraticCurveTo(108, 88, 118, 128); g.closePath(); g.fill();
  g.fillStyle = opts.shirt || '#f2ead8';
  g.beginPath(); g.moveTo(52, 128); g.lineTo(64, 96); g.lineTo(76, 128); g.closePath(); g.fill();
  // neck + head
  g.fillStyle = opts.skin || '#c98a5e';
  g.fillRect(54, 74, 20, 18);
  g.beginPath(); g.ellipse(64, 52, 27, 32, 0, 0, 7); g.fill();
  // ears
  g.beginPath(); g.ellipse(37, 54, 5, 8, 0, 0, 7); g.fill();
  g.beginPath(); g.ellipse(91, 54, 5, 8, 0, 0, 7); g.fill();
  // hair
  g.fillStyle = opts.hair || '#2b1c12';
  if (opts.hairStyle === 'long') {
    g.beginPath(); g.ellipse(64, 44, 30, 26, 0, Math.PI, 0); g.fill();
    g.fillRect(32, 40, 9, 52); g.fillRect(87, 40, 9, 52);
  } else if (opts.hairStyle === 'mohawk') {
    g.beginPath(); g.ellipse(64, 26, 10, 14, 0, 0, 7); g.fill();
    g.beginPath(); g.ellipse(64, 34, 28, 12, 0, Math.PI, 0); g.fill();
  } else if (opts.hairStyle === 'buzz') {
    g.beginPath(); g.ellipse(64, 36, 27, 15, 0, Math.PI, 0); g.fill();
  } else {
    g.beginPath(); g.ellipse(64, 38, 29, 20, 0, Math.PI, 0); g.fill();
    g.beginPath(); g.arc(64, 30, 12, 0, 7); g.fill();
  }
  if (opts.beard) { g.fillStyle = opts.hair || '#2b1c12'; g.beginPath(); g.ellipse(64, 68, 20, 14, 0, 0, Math.PI); g.fill(); }
  // eyes
  g.fillStyle = '#fff';
  g.beginPath(); g.ellipse(53, 52, 6, 4.5, 0, 0, 7); g.fill();
  g.beginPath(); g.ellipse(75, 52, 6, 4.5, 0, 0, 7); g.fill();
  g.fillStyle = opts.eyes || '#241a12';
  g.beginPath(); g.arc(53, 52, 2.6, 0, 7); g.fill();
  g.beginPath(); g.arc(75, 52, 2.6, 0, 7); g.fill();
  // brows
  g.strokeStyle = opts.hair || '#2b1c12'; g.lineWidth = 3; g.lineCap = 'round';
  g.beginPath(); g.moveTo(47, 44); g.lineTo(59, 43); g.stroke();
  g.beginPath(); g.moveTo(69, 43); g.lineTo(81, 44); g.stroke();
  // nose + mouth
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(64, 54); g.lineTo(62, 63); g.lineTo(66, 63); g.stroke();
  g.strokeStyle = '#7a2f2f'; g.lineWidth = 2.5;
  g.beginPath(); g.moveTo(56, 71); g.quadraticCurveTo(64, 75 + (opts.smile || 2), 72, 71); g.stroke();
  if (opts.glasses) {
    g.strokeStyle = '#111'; g.lineWidth = 2.5;
    g.strokeRect(44, 46, 18, 13); g.strokeRect(66, 46, 18, 13);
    g.beginPath(); g.moveTo(62, 51); g.lineTo(66, 51); g.stroke();
  }
  if (opts.earring) { g.fillStyle = '#ffd75e'; g.beginPath(); g.arc(37, 63, 3, 0, 7); g.fill(); }
  if (opts.scar) { g.strokeStyle = 'rgba(120,40,40,.8)'; g.lineWidth = 2; g.beginPath(); g.moveTo(80, 40); g.lineTo(86, 52); g.stroke(); }
  return c.toDataURL('image/png');
}

// Canvas texture helpers (three.js).
export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Building facade texture: colourful wall + lit windows + ground-floor shopfront.
export function facadeTexture(rng, base, lit) {
  return canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    // subtle vertical shading
    const grad = g.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, 'rgba(0,0,0,.18)'); grad.addColorStop(.5, 'rgba(255,255,255,.06)'); grad.addColorStop(1, 'rgba(0,0,0,.18)');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    // windows
    for (let y = 14; y < h - 40; y += 34) {
      for (let x = 12; x < w - 12; x += 28) {
        const on = rng() < lit;
        g.fillStyle = on ? '#ffd98a' : 'rgba(20,30,50,.85)';
        g.fillRect(x, y, 18, 22);
        g.fillStyle = 'rgba(255,255,255,.25)';
        g.fillRect(x, y, 18, 4);
      }
    }
    // shopfront
    g.fillStyle = 'rgba(10,10,20,.55)'; g.fillRect(0, h - 34, w, 34);
    g.fillStyle = lit > 0.4 ? '#ffe6a0' : '#9fc4e8';
    g.fillRect(10, h - 28, 44, 20); g.fillRect(74, h - 28, 44, 20);
    g.fillStyle = '#2a1a10'; g.fillRect(56, h - 28, 16, 22);
  });
}

// Shop sign texture (neon-ish text on a coloured board).
export function signTexture(text, bg, fg) {
  return canvasTexture(256, 64, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = fg; g.lineWidth = 4; g.strokeRect(4, 4, w - 8, h - 8);
    g.fillStyle = fg; g.font = '900 30px Arial Narrow, Arial';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 2);
  });
}
