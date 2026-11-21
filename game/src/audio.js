// WebAudio synth: engine hum, 3 procedural radio stations, sirens, shots, jingles.
// Everything is synthesized — no audio files, no network.
const STATIONS = [
  { name: 'SOL 98.5', song: "Neon Palms", artist: 'The Breakers', bpm: 112, root: 220, scale: [0, 3, 5, 7, 10], wave: 'triangle' },
  { name: 'TIDE FM', song: 'Salt Air', artist: 'Marina Vale', bpm: 92, root: 196, scale: [0, 2, 4, 7, 9], wave: 'sine' },
  { name: 'CRIMSON ROCK', song: 'Redline Run', artist: 'The Getaways', bpm: 132, root: 165, scale: [0, 3, 5, 6, 7, 10], wave: 'sawtooth' },
];

export class AudioEngine {
  constructor() {
    this.ctx = null; this.master = null; this.station = 0; this.radioOn = true;
    this.engineOsc = null; this.engineGain = null; this.sirenOsc = null; this.sirenGain = null;
    this.musicTimer = null; this.step = 0; this.muted = false;
  }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.startEngine(); this.startMusic();
    } catch (e) { /* audio unavailable — game continues silent */ }
  }
  startEngine() {
    const c = this.ctx;
    this.engineOsc = c.createOscillator(); this.engineOsc.type = 'sawtooth'; this.engineOsc.frequency.value = 55;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320;
    this.engineGain = c.createGain(); this.engineGain.gain.value = 0.0;
    this.engineOsc.connect(lp); lp.connect(this.engineGain); this.engineGain.connect(this.master);
    this.engineOsc.start();
  }
  setEngine(speedKmh, inCar) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const f = 45 + Math.min(1, speedKmh / 180) * 130;
    this.engineOsc.frequency.setTargetAtTime(f, t, 0.08);
    this.engineGain.gain.setTargetAtTime(inCar ? 0.05 + Math.min(1, speedKmh / 180) * 0.06 : 0.0, t, 0.1);
  }
  startMusic() {
    const st = STATIONS[this.station];
    const stepDur = 60 / st.bpm / 2;
    let next = this.ctx.currentTime + 0.05;
    const tick = () => {
      if (!this.ctx) return;
      while (next < this.ctx.currentTime + 0.25) {
        if (this.radioOn && !this.muted) this.playStep(st, this.step, next, stepDur);
        next += stepDur; this.step++;
      }
      this.musicTimer = setTimeout(tick, 90);
    };
    tick();
  }
  playStep(st, step, t, dur) {
    const c = this.ctx;
    const semi = st.scale[step % st.scale.length] + 12 * Math.floor((step % 16) / 8);
    const freq = st.root * Math.pow(2, semi / 12);
    if (step % 2 === 0) {
      const o = c.createOscillator(); o.type = st.wave; o.frequency.value = freq;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 1.8);
      o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur * 2);
    }
    if (step % 4 === 0) { // kick
      const o = c.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      const g = c.createGain();
      g.gain.setValueAtTime(0.28, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.2);
    }
    if (step % 8 === 4) { // bass
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = st.root / 2;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.2, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 3);
      o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur * 3.2);
    }
  }
  nextStation() {
    this.station = (this.station + 1) % STATIONS.length;
    this.step = 0;
    return STATIONS[this.station];
  }
  stationLabel() {
    const s = STATIONS[this.station];
    return { name: s.name, line: s.song + ' — ' + s.artist };
  }
  setSiren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenOsc) {
      const c = this.ctx;
      this.sirenOsc = c.createOscillator(); this.sirenOsc.type = 'triangle';
      const lfo = c.createOscillator(); lfo.frequency.value = 0.6;
      const lg = c.createGain(); lg.gain.value = 180;
      lfo.connect(lg); lg.connect(this.sirenOsc.frequency);
      this.sirenOsc.frequency.value = 820;
      this.sirenGain = c.createGain(); this.sirenGain.gain.value = 0.035;
      this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
      this.sirenOsc.start(); lfo.start(); this.sirenLfo = lfo;
    } else if (!on && this.sirenOsc) {
      try { this.sirenOsc.stop(); this.sirenLfo.stop(); } catch (e) {}
      this.sirenOsc = null; this.sirenLfo = null;
    }
  }
  blip(freq, dur, vol, type) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = type || 'square'; o.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(vol || 0.15, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.12));
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + (dur || 0.12) + 0.02);
  }
  shot() { this.blip(180, 0.09, 0.25, 'sawtooth'); this.blip(90, 0.12, 0.2, 'square'); }
  punch() { this.blip(120, 0.07, 0.18, 'sine'); }
  pickup() { this.blip(660, 0.1, 0.16); setTimeout(() => this.blip(880, 0.14, 0.16), 90); }
  cash() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.blip(f, 0.16, 0.18), i * 90)); }
  fail() { this.blip(220, 0.3, 0.2, 'sawtooth'); setTimeout(() => this.blip(165, 0.4, 0.2, 'sawtooth'), 220); }
  starUp() { this.blip(880, 0.1, 0.18); setTimeout(() => this.blip(1175, 0.16, 0.18), 100); }
}
