// Procedural Web Audio: engine hum, sirens, radio jingles, gunshots. No audio
// files, no network. The context is created up front (suspended until the
// first user gesture resumes it) so audioState() always answers.
import { G, player, SONGS } from './state.js';
import { clamp } from './utils.js';

let ctx = null, master = null, engineOsc = null, engineOsc2 = null, engineGain = null;
let sirenOsc = null, sirenGain = null, radioGain = null, radioTimer = 0, radioNote = 0;
try {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (AC) {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 55;
    engineOsc2 = ctx.createOscillator(); engineOsc2.type = 'square'; engineOsc2.frequency.value = 28;
    engineGain = ctx.createGain(); engineGain.gain.value = 0;
    engineOsc.connect(engineGain); engineOsc2.connect(engineGain); engineGain.connect(master);
    engineOsc.start(); engineOsc2.start();
    sirenOsc = ctx.createOscillator(); sirenOsc.type = 'sine'; sirenOsc.frequency.value = 750;
    sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain); sirenGain.connect(master); sirenOsc.start();
    radioGain = ctx.createGain(); radioGain.gain.value = 0; radioGain.connect(master);
  }
} catch (e) { ctx = null; }

export function audioState() { return ctx ? ctx.state : 'suspended'; }
export function resumeAudio() { if (ctx && ctx.state === 'suspended') ctx.resume(); }
export function setMuted(m) {
  G.muted = m;
  if (master) master.gain.value = m ? 0 : 0.5;
}

function blip(freq, dur, type, vol, when = 0) {
  if (!ctx || G.muted) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(vol || 0.2, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function noiseBurst(dur, vol, low) {
  if (!ctx || G.muted) return;
  const n = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = low || 1200;
  const g = ctx.createGain(); g.gain.value = vol || 0.3;
  src.connect(f); f.connect(g); g.connect(master); src.start();
}
export const sfxShot = () => noiseBurst(0.12, 0.35, 2500);
export const sfxPunch = () => { blip(90, 0.12, 'sine', 0.4); noiseBurst(0.08, 0.2, 500); };
export const sfxClick = () => blip(660, 0.06, 'triangle', 0.15);
export const sfxCash = () => { [523, 659, 784, 1047].forEach((f, i) => blip(f, 0.14, 'triangle', 0.2, i * 0.09)); };
export const sfxHorn = () => { blip(392, 0.35, 'square', 0.12); blip(494, 0.35, 'square', 0.12); };
export const sfxSirenBurst = () => { blip(880, 0.15, 'sine', 0.15); blip(660, 0.15, 'sine', 0.15, 0.15); };

// Radio: a breezy pentatonic jingle that cycles while driving.
const MELODY = [523, 587, 659, 784, 659, 587, 523, 440, 523, 659, 784, 880];
export function updateAudio(dt) {
  if (!ctx) return;
  const speed = player.inCar ? Math.abs(player.carSpeed) : 0;
  if (engineGain) {
    const target = (G.started && !G.paused && player.inCar && !G.over) ? 0.05 + speed * 0.0012 : 0;
    engineGain.gain.value += (target - engineGain.gain.value) * Math.min(1, dt * 6);
    const f = 50 + speed * 2.2 + (G.boostT > 0 ? 25 : 0);
    engineOsc.frequency.value = f; engineOsc2.frequency.value = f / 2;
  }
  if (sirenGain) {
    const near = G.police.some((c) => Math.hypot(c.x - player.x, c.z - player.z) < 90);
    const target = (G.started && !G.paused && G.wanted > 0 && near) ? 0.035 : 0;
    sirenGain.gain.value += (target - sirenGain.gain.value) * Math.min(1, dt * 4);
    sirenOsc.frequency.value = 700 + 250 * (0.5 + 0.5 * Math.sin(G.time * 4.5));
  }
  if (radioGain) {
    const on = G.started && !G.paused && player.inCar && !G.over;
    radioGain.gain.value += ((on ? 0.06 : 0) - radioGain.gain.value) * Math.min(1, dt * 3);
    if (on) {
      radioTimer -= dt;
      if (radioTimer <= 0) {
        radioTimer = 0.22;
        const f = MELODY[radioNote % MELODY.length]; radioNote++;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'triangle'; o.frequency.value = f;
        g.gain.setValueAtTime(0.5, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        o.connect(g); g.connect(radioGain); o.start(); o.stop(ctx.currentTime + 0.22);
      }
    }
  }
  G.radioT += dt;
  if (G.radioT > 45) { G.radioT = 0; G.radioIdx = (G.radioIdx + 1) % SONGS.length; }
}
