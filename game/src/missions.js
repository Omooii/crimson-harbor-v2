// Mission state machine: 4 jobs, 4 stages each, with a 3D beacon marker, a timer, stage
// dialogue, and pay + RP on completion. Free roam resumes between jobs.
import * as THREE from 'three';
import { MISSIONS } from './config.js';
import { fmtMoney } from './util.js';
import { districtAt, adjustTrust } from './districts.js';
import { spawnCar } from './vehicles.js';

export function createMissions(G) {
  const M = {
    active: null, // {def, stage, timer}
    marker: null,
    markerCar: null,
    beaconMat: null,
    start(id) {
      const def = MISSIONS.find((m) => m.id === id);
      if (!def) return;
      M.active = { def, stage: 0, timer: def.time };
      G.mission = M.active;
      M.showStage();
      G.showDialogue(def.giver, def.intro, 7);
      G.notify('NEW MISSION — ' + def.name);
      G.audio.jingle();
    },
    showStage() {
      const s = M.active.def.stages[M.active.stage];
      M.placeMarker(s.x, s.z);
      if (s.wanted) G.police.setWanted(Math.max(G.player.wanted, s.wanted));
      if (s.car && M.active.def.id === 1 && M.active.stage === 1) {
        // The tuned coupe waits at the garage.
        if (!M.markerCar) M.markerCar = spawnCar(G, 'sports', -144, -90, Math.PI / 2);
      }
      G.hudDirty = true;
    },
    placeMarker(x, z) {
      if (!M.marker) {
        const geo = new THREE.CylinderGeometry(0.9, 0.9, 30, 12, 1, true);
        M.beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
        M.marker = new THREE.Mesh(geo, M.beaconMat);
        const ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 3.2, 24), new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
        ring.rotation.x = -Math.PI / 2; ring.position.y = 0.15;
        M.marker.add(ring);
        G.scene.add(M.marker);
      }
      M.marker.position.set(x, 15, z);
      M.marker.visible = true;
    },
    hideMarker() { if (M.marker) M.marker.visible = false; },
    update(dt) {
      if (M.marker && M.marker.visible) {
        M.marker.rotation.y += dt * 1.2;
        M.beaconMat.opacity = 0.28 + Math.sin(performance.now() * 0.004) * 0.12;
      }
      if (!M.active) {
        // Free roam: starting a job happens at the garage marker when the player is near it.
        const next = MISSIONS.find((m) => !G.missionsDone.includes(m.id));
        if (next) {
          M.placeMarker(-150, -90);
          const d = Math.hypot(G.player.pos.x + 150, G.player.pos.z + 90);
          if (d < 6) {
            G.showInteract('Press <b>E</b> — Start mission: ' + next.name);
            if (G.input.hit('KeyE') && !G.player.car) { M.start(next.id); G.hideInteract(); }
          } else if (G.interactText && G.interactText.includes('Start mission')) G.hideInteract();
        } else M.hideMarker();
        return;
      }
      const a = M.active;
      a.timer -= dt;
      if (a.timer <= 0) {
        G.notify('MISSION FAILED — out of time');
        G.audio.fail();
        M.fail();
        return;
      }
      const s = a.def.stages[a.stage];
      const d = Math.hypot(G.player.pos.x - s.x, G.player.pos.z - s.z);
      const reach = s.car ? 8 : 6;
      let done = d < reach;
      if (s.car && a.def.id === 1 && a.stage === 1) done = G.player.car === M.markerCar;
      if (s.car && a.def.id !== 1) done = d < reach && !!G.player.car;
      if (s.foot) done = d < reach && !G.player.car;
      if (done) M.advance();
    },
    advance() {
      const a = M.active;
      G.audio.pickup();
      G.particles.burst(G.player.pos.x, 2, G.player.pos.z, 24, [1, 0.85, 0.3], 5, 0.9, 1.6);
      a.stage++;
      if (a.stage >= a.def.stages.length) { M.complete(); return; }
      G.banner('STAGE ' + (a.stage + 1) + ' / 4', a.def.stages[a.stage].text);
      M.showStage();
    },
    complete() {
      const a = M.active;
      const p = G.player;
      p.money += a.def.pay;
      p.rp += a.def.rp;
      G.missionsDone.push(a.def.id);
      adjustTrust(G, districtAt(p.pos.x, p.pos.z), 8);
      G.banner('MISSION PASSED', a.def.name + ' — ' + fmtMoney(a.def.pay) + ' · +' + a.def.rp + ' RP');
      G.audio.jingle();
      G.stats.missionsPassed++;
      // Refill ammo reserves as a job perk.
      for (const am of p.ammo) if (am.reserve !== Infinity) am.reserve = Math.max(am.reserve, 60);
      M.active = null;
      G.mission = null;
      M.hideMarker();
      G.hudDirty = true;
    },
    fail() {
      M.active = null;
      G.mission = null;
      M.hideMarker();
      G.hudDirty = true;
    },
  };
  return M;
}
