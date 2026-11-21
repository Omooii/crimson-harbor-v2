// localStorage autosave: money, rank, missions, position, stats. Shot mode never saves.
import { SAVE_KEY } from './config.js';
export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
export function hasSave() { return loadSave() !== null; }
export function writeSave(G) {
  if (G.shot) return;
  const p = G.player;
  const data = {
    v: 4, money: p.money, rp: p.rp, rank: p.rank,
    missionsDone: G.missionsDone, missionId: G.mission ? G.mission.def.id : 0,
    x: p.pos.x, z: p.pos.z, heading: p.heading, health: p.health, armour: p.armour,
    wanted: p.wanted, hour: G.clockHour, ammo: p.ammo, weapon: p.weapon,
    trust: G.trust, stats: G.stats, radio: G.radioStation,
    carKind: p.car ? p.car.kind : null, carDmg: p.car ? p.car.damage : 0,
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch { /* storage full/blocked */ }
}
export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } }
