// The crew, the dialogue, and the 4-mission story of Crimson Harbor.
import { makePortrait } from './util.js';

export const CREW = [
  { id: 'mara', name: 'Mara Voss', role: 'DRIVER', ability: 'SLIPSTREAM', desc: '+25% top speed for 10 seconds', key: 'Z',
    portrait: makePortrait({ seed: 11, hair: '#d43a3a', hairStyle: 'long', skin: '#e8b48a', jacket: '#7a1f3a', shirt: '#ffd75e', earring: true, smile: 4, bg1: '#ff9a5c', bg2: '#c33d7a' }) },
  { id: 'dex', name: 'Dex Marlowe', role: 'HACKER', ability: 'GHOST', desc: 'Drop 1 wanted star, instantly', key: 'X',
    portrait: makePortrait({ seed: 23, hair: '#111111', hairStyle: 'mohawk', skin: '#c98a5e', jacket: '#1f3a5c', shirt: '#7fe3ff', glasses: true, bg1: '#4ecdc4', bg2: '#1a3a5c' }) },
  { id: 'rosa', name: 'Rosa Delgado', role: 'MUSCLE', ability: 'ADRENAL', desc: 'Restore 50 armour on the spot', key: 'C',
    portrait: makePortrait({ seed: 37, hair: '#2b1c12', hairStyle: 'buzz', skin: '#8a5a3a', jacket: '#2f4a1f', shirt: '#f2ead8', scar: true, bg1: '#ffd166', bg2: '#7a4a12' }) },
];
export const PLAYER_PORTRAIT = makePortrait({ seed: 5, hair: '#4a2f1a', hairStyle: 'short', skin: '#e8b48a', jacket: '#d43a3a', shirt: '#f2ead8', smile: 3, bg1: '#ff6b6b', bg2: '#7a1f3a' });

export const MISSIONS = [
  {
    name: 'First Gear', pay: 2500, time: 240,
    intro: { who: 'Mara Voss', line: 'New in town? Prove you can drive. Pick up my package at Harbor Market — and don\'t scratch the paint.' },
    stages: [
      { type: 'drive', x: -80, z: 80, r: 12, text: 'Drive to the pickup at Harbor Market', line: { who: 'Mara Voss', line: 'Market\'s on your map. Move — the buyer doesn\'t wait.' } },
      { type: 'interact', x: -80, z: 80, r: 8, text: 'Grab the package (press E)', line: { who: 'Mara Voss', line: 'Got it? Good. Now bring it to the garage on Palm Row.' } },
      { type: 'drive', x: 80, z: 80, r: 12, text: 'Deliver the package to the Palm Row garage', line: { who: 'Mara Voss', line: 'Clean run. You might just survive this town.' } },
    ],
  },
  {
    name: 'Salt & Smoke', pay: 6000, time: 300,
    intro: { who: 'Dex Marlowe', line: 'There\'s a Vortex GT sitting in the Coral Ave showroom. Cameras looped. Go take it — then lose the heat.' },
    stages: [
      { type: 'steal', x: 160, z: -80, r: 10, text: 'Steal the Vortex GT from the showroom lot', line: { who: 'Dex Marlowe', line: 'Alarm\'s going off — you\'ve got two stars. Shake them!' } },
      { type: 'escape', x: 0, z: 0, r: 0, text: 'Lose the cops — break line of sight', line: { who: 'Dex Marlowe', line: 'Clear! Now get that car to the chop shop in Old Harbor.' } },
      { type: 'drive', x: -240, z: 160, r: 12, text: 'Deliver the Vortex GT to the chop shop', line: { who: 'Dex Marlowe', line: 'Six grand, easy. The harbor\'s starting to notice you.' } },
    ],
  },
  {
    name: 'Night Tide', pay: 12000, time: 300,
    intro: { who: 'Rosa Delgado', line: 'Meet Dex at the pier. Then we run the tide — three checkpoints, no brakes, no mercy.' },
    stages: [
      { type: 'goto', x: 330, z: 200, r: 12, text: 'Meet Dex at the pier (on foot)', line: { who: 'Dex Marlowe', line: 'Checkpoints are live. Hit all three before the clock dies.' } },
      { type: 'drive', x: 280, z: 80, r: 14, text: 'Checkpoint 1 — Ocean Blvd', line: null },
      { type: 'drive', x: 280, z: -120, r: 14, text: 'Checkpoint 2 — North Beach', line: null },
      { type: 'drive', x: 0, z: -240, r: 14, text: 'Checkpoint 3 — North Bridge', line: { who: 'Rosa Delgado', line: 'Last stretch! Warehouse, now!' } },
      { type: 'drive', x: -160, z: -160, r: 12, text: 'Reach the warehouse', line: { who: 'Rosa Delgado', line: 'Twelve grand. You drive like the tide itself.' } },
    ],
  },
  {
    name: 'The Crimson Job', pay: 25000, time: 360,
    intro: { who: 'Mara Voss', line: 'This is it. Meridian Bank, the vault, and every cop in the harbor on our tail. One last job — make it legendary.' },
    stages: [
      { type: 'drive', x: 0, z: 0, r: 14, text: 'Reach the Meridian Bank downtown', line: { who: 'Dex Marlowe', line: 'Vault\'s open. Get inside, grab the cash, get OUT.' } },
      { type: 'interact', x: 0, z: 0, r: 10, text: 'Grab the vault cash (press E)', line: { who: 'Mara Voss', line: 'FOUR STARS! Run for the lighthouse — GO GO GO!' } },
      { type: 'drive', x: 330, z: -290, r: 16, text: 'Escape to the lighthouse drop-off', line: { who: 'Mara Voss', line: 'We did it. The harbor is OURS.' } },
    ],
  },
];

export class MissionEngine {
  constructor() {
    this.index = -1;      // -1 = no mission active
    this.stage = 0;
    this.timeLeft = 0;
    this.active = false;
    this.completed = [false, false, false, false];
    this.freeRoam = false;
    this.onDialogue = null;   // (who, line, portrait)
    this.onStage = null;
    this.onComplete = null;   // (mission)
    this.onFail = null;
    this.onStart = null;
  }
  get mission() { return this.index >= 0 ? MISSIONS[this.index] : null; }
  get stageDef() { const m = this.mission; return m ? m.stages[this.stage] : null; }
  get nextIndex() {
    for (let i = 0; i < MISSIONS.length; i++) if (!this.completed[i]) return i;
    return -1;
  }
  start(i) {
    if (i < 0 || i >= MISSIONS.length) return false;
    this.index = i; this.stage = 0;
    this.timeLeft = MISSIONS[i].time;
    this.active = true;
    if (this.onStart) this.onStart(MISSIONS[i], i);
    this.say(MISSIONS[i].intro);
    return true;
  }
  startNext() { return this.start(this.nextIndex); }
  say(d) { if (d && this.onDialogue) this.onDialogue(d.who, d.line, this.portraitFor(d.who)); }
  portraitFor(who) {
    const c = CREW.find(c => c.name === who);
    return c ? c.portrait : PLAYER_PORTRAIT;
  }
  advance() {
    const m = this.mission;
    if (!m) return;
    const s = m.stages[this.stage];
    if (s.line) this.say(s.line);
    this.stage++;
    if (this.stage >= m.stages.length) {
      this.completed[this.index] = true;
      this.active = false;
      const done = m;
      const idx = this.index;
      this.index = -1; this.stage = 0;
      if (this.onComplete) this.onComplete(done, idx);
    } else if (this.onStage) this.onStage(m, this.stage);
  }
  fail(reason) {
    if (!this.active) return;
    const m = this.mission;
    this.active = false; this.index = -1; this.stage = 0;
    if (this.onFail) this.onFail(m, reason);
  }
  update(dt) {
    if (!this.active) return;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) this.fail('TIME UP');
  }
}
