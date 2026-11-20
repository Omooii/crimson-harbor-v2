// audio.js — every sound is synthesized with WebAudio: no audio files are
// loaded, so the game stays fully offline. Engine hum, sirens, gunshots,
// cash and punches are all oscillators and filtered noise.
(function () {
  'use strict';

  var ctx = null;
  var master = null;
  var muted = false;
  var engineNodes = null; // {osc1, osc2, gain, filter}
  var sirenNodes = null; // {osc, gain}
  var sirenPhase = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
    } catch (e) {
      return false;
    }
    return true;
  }

  function setMuted(m) {
    muted = m;
    if (master) master.gain.value = m ? 0 : 0.5;
  }

  function isMuted() {
    return muted;
  }

  // Continuous engine hum: two detuned saws through a lowpass, pitch and
  // loudness following the car's speed (0..1).
  function engine(speedNorm, running) {
    if (!ctx) return;
    if (!running) {
      if (engineNodes) {
        try { engineNodes.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.1); } catch (e) {}
      }
      return;
    }
    if (!engineNodes) {
      var o1 = ctx.createOscillator();
      var o2 = ctx.createOscillator();
      var f = ctx.createBiquadFilter();
      var g = ctx.createGain();
      o1.type = 'sawtooth';
      o2.type = 'square';
      f.type = 'lowpass';
      f.frequency.value = 420;
      g.gain.value = 0;
      o1.connect(f);
      o2.connect(f);
      f.connect(g);
      g.connect(master);
      o1.start();
      o2.start();
      engineNodes = { o1: o1, o2: o2, filter: f, gain: g };
    }
    var t = ctx.currentTime;
    var base = 55 + speedNorm * 130;
    engineNodes.o1.frequency.setTargetAtTime(base, t, 0.08);
    engineNodes.o2.frequency.setTargetAtTime(base * 1.5 + 3, t, 0.08);
    engineNodes.filter.frequency.setTargetAtTime(300 + speedNorm * 900, t, 0.1);
    engineNodes.gain.gain.setTargetAtTime(0.05 + speedNorm * 0.06, t, 0.1);
  }

  // Two-tone police siren. closeness 0..1 (1 = a cruiser right behind you).
  function siren(closeness, dt) {
    if (!ctx) return;
    if (closeness <= 0.01) {
      if (sirenNodes) sirenNodes.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
      return;
    }
    if (!sirenNodes) {
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = 'triangle';
      g.gain.value = 0;
      o.connect(g);
      g.connect(master);
      o.start();
      sirenNodes = { osc: o, gain: g };
    }
    sirenPhase += dt;
    var tone = (Math.floor(sirenPhase * 2.2) % 2 === 0) ? 720 : 960;
    sirenNodes.osc.frequency.setTargetAtTime(tone, ctx.currentTime, 0.03);
    sirenNodes.gain.gain.setTargetAtTime(0.02 + closeness * 0.05, ctx.currentTime, 0.1);
  }

  function noiseBurst(dur, filterFreq, gainVal, type) {
    if (!ctx) return;
    var len = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var f = ctx.createBiquadFilter();
    f.type = type || 'lowpass';
    f.frequency.value = filterFreq;
    var g = ctx.createGain();
    g.gain.value = gainVal;
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start();
  }

  function tone(freq, dur, type, gainVal, when) {
    if (!ctx) return;
    var t0 = ctx.currentTime + (when || 0);
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gainVal || 0.15, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g);
    g.connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  function gunshot() {
    noiseBurst(0.16, 1800, 0.5, 'bandpass');
    tone(90, 0.12, 'sine', 0.4);
  }

  function punch() {
    noiseBurst(0.09, 500, 0.4);
  }

  function crash() {
    noiseBurst(0.25, 900, 0.45);
  }

  function cash() {
    tone(880, 0.12, 'sine', 0.18, 0);
    tone(1174, 0.12, 'sine', 0.18, 0.09);
    tone(1568, 0.22, 'sine', 0.2, 0.18);
  }

  function click() {
    tone(660, 0.07, 'square', 0.08);
  }

  function missionStart() {
    tone(523, 0.14, 'triangle', 0.2, 0);
    tone(784, 0.2, 'triangle', 0.2, 0.12);
  }

  function fail() {
    tone(392, 0.2, 'sawtooth', 0.12, 0);
    tone(311, 0.3, 'sawtooth', 0.12, 0.18);
  }

  window.CH = window.CH || {};
  window.CH.audio = {
    ensure: ensure,
    setMuted: setMuted,
    isMuted: isMuted,
    engine: engine,
    siren: siren,
    gunshot: gunshot,
    punch: punch,
    crash: crash,
    cash: cash,
    click: click,
    missionStart: missionStart,
    fail: fail
  };
})();
