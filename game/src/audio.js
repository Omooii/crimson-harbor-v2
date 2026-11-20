// Synthesized sound: every effect is built from oscillators and filtered
// noise in WebAudio, so the game ships no audio files at all. The engine
// hum and the police siren are loops whose pitch follows the game; the
// rest are one-shot blips. Audio starts only after a user gesture.
(function () {
  var CH = window.CH;

  function createAudio() {
    var ctx = null;
    var master = null;
    var engineOsc = null;
    var engineGain = null;
    var sirenOsc = null;
    var sirenGain = null;
    var sirenTimer = 0;
    var sirenHigh = false;
    var muted = false;

    function ensure() {
      if (ctx) {
        if (ctx.state === 'suspended') ctx.resume();
        return true;
      }
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);

      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      var engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();

      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 750;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    }

    function blip(freq, seconds, type, volume, slideTo) {
      if (!ensure()) return;
      var t = ctx.currentTime;
      var osc = ctx.createOscillator();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + seconds);
      var gain = ctx.createGain();
      gain.gain.setValueAtTime(volume || 0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + seconds);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t);
      osc.stop(t + seconds + 0.02);
    }

    function noiseBurst(seconds, volume, filterFreq) {
      if (!ensure()) return;
      var t = ctx.currentTime;
      var len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
      var buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      var data = buffer.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var src = ctx.createBufferSource();
      src.buffer = buffer;
      var filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq || 1200;
      var gain = ctx.createGain();
      gain.gain.setValueAtTime(volume || 0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + seconds);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start(t);
    }

    return {
      unlock: ensure,
      setMuted: function (m) {
        muted = m;
        if (master) master.gain.value = m ? 0 : 0.5;
      },
      isMuted: function () { return muted; },
      // Called every frame: the engine follows speed, the siren wails
      // while police are near.
      update: function (dt, speed, sirenOn) {
        if (!ctx) return;
        engineGain.gain.value = speed > 0.5 ? 0.05 + Math.min(0.09, speed * 0.002) : 0.02;
        engineOsc.frequency.value = 50 + speed * 2.2;
        if (sirenOn) {
          sirenTimer += dt;
          if (sirenTimer > 0.45) {
            sirenTimer = 0;
            sirenHigh = !sirenHigh;
            sirenOsc.frequency.value = sirenHigh ? 950 : 650;
          }
          sirenGain.gain.value = 0.045;
        } else {
          sirenGain.gain.value = 0;
        }
      },
      shot: function () { noiseBurst(0.14, 0.35, 2600); },
      punch: function () { noiseBurst(0.09, 0.25, 500); },
      crash: function (hard) { noiseBurst(hard ? 0.35 : 0.18, hard ? 0.5 : 0.3, 700); },
      explosion: function () { noiseBurst(0.8, 0.6, 300); blip(60, 0.5, 'sine', 0.4, 30); },
      pickup: function () { blip(660, 0.1, 'sine', 0.25); setTimeout(function () { blip(990, 0.16, 'sine', 0.25); }, 90); },
      missionDone: function () {
        [523, 659, 784, 1046].forEach(function (f, i) {
          setTimeout(function () { blip(f, 0.22, 'triangle', 0.22); }, i * 130);
        });
      },
      missionFail: function () { blip(320, 0.3, 'sawtooth', 0.18, 160); },
      wantedUp: function () { blip(880, 0.12, 'square', 0.12); setTimeout(function () { blip(880, 0.12, 'square', 0.12); }, 160); },
      click: function () { blip(1200, 0.05, 'sine', 0.15); },
      enterCar: function () { noiseBurst(0.08, 0.2, 900); blip(180, 0.12, 'sine', 0.15, 90); },
    };
  }

  CH.createAudio = createAudio;
})();
