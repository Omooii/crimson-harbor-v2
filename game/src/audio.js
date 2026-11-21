// Synthesized WebAudio: engine hum, sirens, gunshots, radio music, UI blips. No audio files.
import { RADIO } from './config.js';
export function createAudio() {
  const A = {
    ctx: null, master: null, musicGain: null, sfxGain: null,
    engineOsc: null, engineGain: null, sirenOsc: null, sirenGain: null,
    radioTimer: 0, radioStep: 0, radioOn: true,
    vol: { master: 0.8, music: 0.6, sfx: 0.9 },
    ensure() {
      if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      A.ctx = new C();
      A.master = A.ctx.createGain(); A.master.gain.value = A.vol.master; A.master.connect(A.ctx.destination);
      A.musicGain = A.ctx.createGain(); A.musicGain.gain.value = A.vol.music; A.musicGain.connect(A.master);
      A.sfxGain = A.ctx.createGain(); A.sfxGain.gain.value = A.vol.sfx; A.sfxGain.connect(A.master);
      A.engineOsc = A.ctx.createOscillator(); A.engineOsc.type = 'sawtooth'; A.engineOsc.frequency.value = 55;
      A.engineGain = A.ctx.createGain(); A.engineGain.gain.value = 0;
      const lp = A.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320;
      A.engineOsc.connect(lp); lp.connect(A.engineGain); A.engineGain.connect(A.sfxGain); A.engineOsc.start();
      A.sirenOsc = A.ctx.createOscillator(); A.sirenOsc.type = 'triangle'; A.sirenOsc.frequency.value = 700;
      A.sirenGain = A.ctx.createGain(); A.sirenGain.gain.value = 0;
      A.sirenOsc.connect(A.sirenGain); A.sirenGain.connect(A.sfxGain); A.sirenOsc.start();
    },
    setVolumes(v) {
      A.vol = v;
      if (!A.ctx) return;
      A.master.gain.value = v.master; A.musicGain.gain.value = v.music; A.sfxGain.gain.value = v.sfx;
    },
    blip(freq, dur, type, vol) {
      if (!A.ctx) return;
      const o = A.ctx.createOscillator(), g = A.ctx.createGain();
      o.type = type || 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.25, A.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, A.ctx.currentTime + (dur || 0.12));
      o.connect(g); g.connect(A.sfxGain); o.start(); o.stop(A.ctx.currentTime + (dur || 0.12) + 0.02);
    },
    noise(dur, vol, freq) {
      if (!A.ctx) return;
      const len = Math.floor(A.ctx.sampleRate * dur);
      const buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = A.ctx.createBufferSource(); src.buffer = buf;
      const f = A.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 1200;
      const g = A.ctx.createGain(); g.gain.value = vol || 0.4;
      src.connect(f); f.connect(g); g.connect(A.sfxGain); src.start();
    },
    shot() { A.noise(0.14, 0.5, 2600); A.blip(180, 0.08, 'square', 0.18); },
    punch() { A.noise(0.08, 0.35, 500); },
    crash() { A.noise(0.3, 0.5, 700); A.blip(70, 0.25, 'sawtooth', 0.3); },
    pickup() { A.blip(660, 0.09, 'sine', 0.3); setTimeout(() => A.blip(990, 0.14, 'sine', 0.3), 80); },
    jingle() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => A.blip(f, 0.22, 'triangle', 0.3), i * 110)); },
    fail() { [392, 330, 262].forEach((f, i) => setTimeout(() => A.blip(f, 0.25, 'sawtooth', 0.2), i * 130)); },
    update(dt, G) {
      if (!A.ctx) return;
      const t = A.ctx.currentTime;
      // Engine: pitch follows speed, only when driving.
      const target = G.player.car ? 0.05 + Math.min(0.16, Math.abs(G.player.car.speed) * 0.004) : 0;
      A.engineGain.gain.setTargetAtTime(target, t, 0.1);
      if (G.player.car) A.engineOsc.frequency.setTargetAtTime(50 + Math.abs(G.player.car.speed) * 4.5, t, 0.08);
      // Siren: two-tone wail while wanted.
      const wanted = G.player.wanted > 0 && G.police.cars.length > 0;
      A.sirenGain.gain.setTargetAtTime(wanted ? 0.045 : 0, t, 0.2);
      if (wanted) A.sirenOsc.frequency.value = 680 + Math.sin(t * 4.4) * 160;
      // Radio: a tiny step sequencer over the station's scale.
      if (!A.radioOn) return;
      A.radioTimer -= dt;
      if (A.radioTimer <= 0) {
        const st = RADIO[G.radioStation];
        A.radioTimer = 60 / st.tempo / 2;
        const step = A.radioStep++;
        const scale = st.scale;
        const deg = scale[step % scale.length] + 12 * Math.floor((step / scale.length) % 2);
        const freq = st.base * Math.pow(2, deg / 12);
        const o = A.ctx.createOscillator(), g = A.ctx.createGain();
        o.type = step % 8 === 0 ? 'triangle' : 'square';
        o.frequency.value = freq;
        g.gain.setValueAtTime(step % 4 === 0 ? 0.11 : 0.06, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        o.connect(g); g.connect(A.musicGain); o.start(); o.stop(t + 0.25);
        if (step % 4 === 0) { const b = A.ctx.createOscillator(), bg = A.ctx.createGain(); b.type = 'sine'; b.frequency.value = st.base / 2; bg.gain.setValueAtTime(0.14, t); bg.gain.exponentialRampToValueAtTime(0.001, t + 0.3); b.connect(bg); bg.connect(A.musicGain); b.start(); b.stop(t + 0.32); }
      }
    },
  };
  return A;
}
