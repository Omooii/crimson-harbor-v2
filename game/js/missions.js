// The 8 jobs: definitions, stage flow, timers, pay, and the gold objective
// beam in the world. Objectives are always on open ground, never in a building.
import { G, player } from './state.js';
import { dist } from './utils.js';
import { groundHeightAt } from './world.js';
import { sfxCash } from './audio.js';
import { addHeat } from './police.js';

export const MISSIONS = [
  { name: 'Harbor Handoff', pay: 800, time: 300, intro: 'Sable: Wheels up, Rook. Get to the garage — easy money.',
    stages: [
      { text: 'Get in your Vortex GT', type: 'car', x: 24, z: 104, r: 6 },
      { text: 'Drive to the garage on Harbor Blvd', type: 'go', x: 20, z: 32, r: 8 },
    ] },
  { name: 'Pier Pickup', pay: 1200, time: 300, intro: 'Ivo: Package is waiting at the pier. No detours.',
    stages: [
      { text: 'Drive to Marina Pier', type: 'go', x: -52, z: 100, r: 8 },
      { text: 'Grab the package', type: 'dwell', x: -52, z: 100, r: 8, dwell: 3 },
      { text: 'Deliver to Harborview', type: 'go', x: 84, z: 24, r: 8 },
    ] },
  { name: 'Beachside Blitz', pay: 1800, time: 360, intro: 'Tess: Cops are sniffing around the beach. Move fast.',
    stages: [
      { text: 'Reach the beach boardwalk', type: 'go', x: -52, z: 160, r: 8 },
      { text: 'Lose the tail — reach Northside', type: 'go', x: 140, z: 20, r: 8 },
    ] },
  { name: 'Northside Nights', pay: 2500, time: 360, intro: 'Sable: Meet me up north. Bring the fast one.',
    stages: [
      { text: 'Meet Sable on Northside Ave', type: 'go', x: 140, z: 100, r: 8 },
      { text: 'Drive to the Pier Avenue garage', type: 'go', x: 80, z: 144, r: 8 },
    ] },
  { name: 'Ocean Drive Run', pay: 3500, time: 420, night: true, intro: 'Ivo: Night run. Ocean Drive, lights off, foot down.',
    stages: [
      { text: 'Night run: reach Ocean Drive south', type: 'go', x: -50, z: 180, r: 8 },
      { text: 'Race to the harbor north end', type: 'go', x: -50, z: -40, r: 8 },
    ] },
  { name: 'Bridge Gambit', pay: 5000, time: 420, intro: 'Tess: The bridge is the only way across. Go loud.',
    stages: [
      { text: 'Cross Harbor Bridge', type: 'go', x: -20, z: -170, r: 8 },
      { text: 'Escape to Pier Avenue', type: 'go', x: 80, z: -40, r: 8 },
    ] },
  { name: 'Harbor Heist', pay: 8000, time: 480, intro: 'Sable: The vault job. In, out, gone. You ready?',
    stages: [
      { text: 'Reach the Harborview vault', type: 'go', x: 140, z: -40, r: 8 },
      { text: 'Grab the loot and reach the pier', type: 'go', x: -52, z: 100, r: 8 },
      { text: 'Lose the heat — reach Northside', type: 'go', x: 140, z: 140, r: 8 },
    ] },
  { name: 'Crimson Getaway', pay: 25000, time: 480, intro: 'Ivo: Boat is waiting. This is the big one, Rook.',
    stages: [
      { text: 'Reach the getaway boat at the pier', type: 'go', x: -120, z: 100, r: 8 },
      { text: 'Shake the cops — reach Ocean Drive', type: 'go', x: -50, z: 160, r: 8 },
      { text: 'Return to the getaway boat', type: 'go', x: -132, z: 100, r: 7 },
    ] },
];

let beam = null, ring = null, sceneRef = null;

export function initMissions(scene) {
  sceneRef = scene;
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xffd54a, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
  beam = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 36, 12, 1, true), beamMat);
  beam.visible = false;
  scene.add(beam);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd54a, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
  ring = new THREE.Mesh(new THREE.RingGeometry(2.4, 3.4, 24), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  scene.add(ring);
}

export function currentStage() {
  if (!G.mission) return null;
  return MISSIONS[G.missionIndex].stages[G.mission.stage];
}

export function startMission(i) {
  G.missionIndex = i;
  const def = MISSIONS[i];
  G.mission = { stage: 0, timeLeft: def.time, dwellT: 0, done: false };
  if (def.night) G.clock = 20.5;
  say(def.intro);
  G.banner = 'JOB ' + (i + 1) + '/8 — ' + def.name.toUpperCase();
  G.bannerT = 3;
}

export function say(line) {
  const who = line.split(':')[0];
  G.dialogue = { who, line: line.split(':').slice(1).join(':').trim() || line };
  G.dialogueT = 6;
}

function completeMission() {
  const def = MISSIONS[G.missionIndex];
  G.money += def.pay;
  G.stats.earned += def.pay;
  G.rp += 150;
  G.missionsDone++;
  sfxCash();
  G.banner = 'JOB COMPLETE — +' + def.pay.toLocaleString('en-US') + ' $';
  G.bannerT = 3.5;
  say('Sable: Clean work, Rook. That\'s how legends are made.');
  G.mission.done = true;
  G.mission.nextT = 2.5;
  if (beam) beam.visible = false;
  if (ring) ring.visible = false;
}

function failMission() {
  G.banner = 'JOB FAILED — OUT OF TIME';
  G.bannerT = 3;
  say('Ivo: Clock ran out. We run it back — same job.');
  G.mission = { stage: 0, timeLeft: MISSIONS[G.missionIndex].time, dwellT: 0, done: false };
}

export function updateMissions(dt) {
  if (!G.mission) return;
  if (G.mission.done) {
    G.mission.nextT -= dt;
    if (G.mission.nextT <= 0) {
      if (G.missionIndex + 1 < MISSIONS.length) startMission(G.missionIndex + 1);
      else { // All 8 done: the city stays open, jobs repeat for cash.
        G.missionIndex = 0; startMission(0);
        G.banner = 'ALL JOBS DONE — FREE ROAM, LEGEND';
        G.bannerT = 4;
      }
    }
    return;
  }
  G.mission.timeLeft -= dt;
  if (G.mission.timeLeft <= 0) { failMission(); return; }
  const st = currentStage();
  if (!st) return;
  // Objective beam + ring track the current stage target.
  if (beam && ring) {
    beam.visible = true; ring.visible = true;
    const gy = groundHeightAt(st.x, st.z);
    beam.position.set(st.x, gy + 18, st.z);
    ring.position.set(st.x, gy + 0.15, st.z);
    const pulse = 1 + Math.sin(G.time * 3) * 0.12;
    ring.scale.set(pulse, pulse, 1);
  }
  if (st.type === 'car') {
    if (player.inCar) advanceStage();
    return;
  }
  const d = dist(player.x, player.z, st.x, st.z);
  if (st.type === 'dwell') {
    if (d < st.r) {
      G.mission.dwellT += dt;
      if (G.mission.dwellT >= (st.dwell || 3)) advanceStage();
    } else G.mission.dwellT = 0;
    return;
  }
  if (d < st.r) advanceStage();
}

function advanceStage() {
  const def = MISSIONS[G.missionIndex];
  if (G.mission.stage + 1 < def.stages.length) {
    G.mission.stage++;
    G.mission.dwellT = 0;
    const lines = [
      'Sable: Nice. Next stop — keep it rolling.',
      'Ivo: Stage clear. I\'m watching the cameras.',
      'Tess: Good. Stay sharp, Rook.',
    ];
    say(lines[G.mission.stage % lines.length]);
    if (G.missionIndex === 2 && G.mission.stage === 1) addHeat(20); // scripted tail
  } else completeMission();
}

export function objectiveInfo() {
  const st = currentStage();
  if (!st || !G.mission || G.mission.done) return null;
  return { x: st.x, z: st.z, d: dist(player.x, player.z, st.x, st.z), text: st.text };
}
